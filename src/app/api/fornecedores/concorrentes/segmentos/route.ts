import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const MAX_SUPPLIERS = 250

function parseJson(text: string) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try { return JSON.parse(cleaned) }
  catch {
    const match = cleaned.match(/\[[\s\S]*\]/)
    if (!match) throw new Error('A IA não retornou uma lista JSON válida')
    return JSON.parse(match[0])
  }
}

function cleanSupplier(item: any) {
  return {
    id: String(item?.id || ''),
    nome: String(item?.nome || '').trim(),
    segmento_atual: String(item?.segmento || '').trim(),
    tipos: String(item?.tipos || '').trim(),
    razao_social: String(item?.razao_social || '').trim(),
    observacoes: String(item?.observacoes || '').trim(),
  }
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ detail: 'Revisão de segmentos não configurada. Adicione ANTHROPIC_API_KEY como variável privada no Vercel.' }, { status: 503 })

  let body: any
  try { body = await request.json() }
  catch { return NextResponse.json({ detail: 'Envie uma lista válida de fornecedores.' }, { status: 400 }) }

  const fornecedores = Array.isArray(body?.fornecedores)
    ? body.fornecedores.map(cleanSupplier).filter((item: any) => item.id && item.nome).slice(0, MAX_SUPPLIERS)
    : []

  if (!fornecedores.length) return NextResponse.json({ detail: 'Nenhum fornecedor foi enviado para revisão.' }, { status: 400 })

  const prompt = `Revise os segmentos dos fornecedores abaixo para uma empresa de obras.

Objetivo: identificar somente segmentos provavelmente errados, genéricos ou incompatíveis com o nome, tipos, razão social e observações. Não altere um segmento que pareça correto apenas para deixá-lo mais bonito.

Regras:
- Retorne somente fornecedores que realmente precisam de revisão.
- Sugira um segmento curto e padronizado em português, por exemplo: ELÉTRICO, HIDRÁULICA, ESTRUTURA, CONCRETO, AÇO, ESQUADRIAS, VIDRAÇARIA, CLIMATIZAÇÃO, DRYWALL, LOCAÇÃO DE EQUIPAMENTOS, TRANSPORTE, SERVIÇOS GERAIS, PROJETO/ENGENHARIA, MATERIAIS DIVERSOS.
- Não invente atividade. Se não houver evidência suficiente, não retorne o fornecedor.
- Não use CNPJ para descobrir dados externos.
- Confiança alta: evidência clara. Média: indício razoável. Baixa: apenas suspeita; evite retornar baixa.
- Não retorne fornecedores cujo segmento atual já esteja adequado.
- Retorne somente JSON válido, sem markdown.

Formato obrigatório:
[
  {"fornecedor_id":"id existente","nome":"nome atual","segmento_atual":"valor atual","segmento_sugerido":"novo valor","confianca":"alta|media","motivo":"explicação curta baseada somente nos dados enviados"}
]

Fornecedores:
${JSON.stringify(fornecedores)}`

  let response: Response
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: AbortSignal.timeout(45000),
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_SEGMENT_MODEL || 'claude-haiku-4-5',
        max_tokens: 7000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
  } catch {
    return NextResponse.json({ detail: 'A revisão demorou para responder. Tente novamente com menos fornecedores filtrados.' }, { status: 504 })
  }

  const result = await response.json().catch(() => ({}))
  if (!response.ok) return NextResponse.json({ detail: result?.error?.message || 'O serviço de IA recusou a revisão.' }, { status: 502 })

  const text = (result?.content || [])
    .filter((block: any) => block?.type === 'text')
    .map((block: any) => block.text || '')
    .join('')

  try {
    const valid = new Map<string, any>(fornecedores.map((item: any) => [item.id, item]))
    const suggestions = parseJson(text)
    const output = Array.isArray(suggestions) ? suggestions.map((suggestion: any) => {
      const original = valid.get(String(suggestion?.fornecedor_id || ''))
      return original ? {
        fornecedor_id: original.id,
        nome: original.nome,
        segmento_atual: original.segmento_atual || 'Sem segmento',
        segmento_sugerido: String(suggestion?.segmento_sugerido || '').trim().toUpperCase(),
        confianca: suggestion?.confianca === 'alta' ? 'alta' : 'media',
        motivo: String(suggestion?.motivo || 'Revise este cadastro antes de salvar.'),
      } : null
    }).filter((item: any) => item && item.segmento_sugerido && item.segmento_sugerido !== item.segmento_atual.toUpperCase()) : []
    return NextResponse.json({ suggestions: output.slice(0, 120), total_fornecedores: fornecedores.length })
  } catch (error: any) {
    return NextResponse.json({ detail: error?.message || 'A resposta da IA não pôde ser interpretada.' }, { status: 502 })
  }
}
