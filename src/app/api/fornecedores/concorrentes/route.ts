import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const MAX_SUPPLIERS = 250

function parseJson(text: string) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try { return JSON.parse(cleaned) }
  catch {
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('A IA não retornou um JSON válido')
    return JSON.parse(match[0])
  }
}

function cleanSupplier(item: any) {
  return {
    id: String(item?.id || ''),
    nome: String(item?.nome || '').trim(),
    segmento: String(item?.segmento || '').trim(),
    tipos: String(item?.tipos || '').trim(),
    razao_social: String(item?.razao_social || '').trim(),
    cidade: String(item?.cidade || '').trim(),
    estado: String(item?.estado || '').trim(),
  }
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ detail: 'Análise de concorrentes não configurada. Adicione ANTHROPIC_API_KEY como variável privada no Vercel.' }, { status: 503 })
  }

  let body: any
  try { body = await request.json() }
  catch { return NextResponse.json({ detail: 'Envie uma lista válida de fornecedores.' }, { status: 400 }) }

  const fornecedores = Array.isArray(body?.fornecedores)
    ? body.fornecedores.map(cleanSupplier).filter((item: any) => item.id && item.nome).slice(0, MAX_SUPPLIERS)
    : []

  if (fornecedores.length < 2) {
    return NextResponse.json({ detail: 'Cadastre pelo menos dois fornecedores para fazer a comparação.' }, { status: 400 })
  }

  const prompt = `Analise esta lista de fornecedores de uma empresa de obras e identifique apenas potenciais concorrentes entre eles.

Regras importantes:
- Não trate a análise como verdade absoluta: use termos como "potencial concorrente".
- Compare principalmente segmento, tipos de serviço/produto, razão social e atividade aparente.
- Fornecedores do mesmo segmento podem não ser concorrentes; só agrupe quando houver evidência razoável de sobreposição.
- Não use cidade ou estado isoladamente para concluir concorrência.
- Não invente produtos, serviços ou relações que não aparecem nos dados.
- Um fornecedor pode aparecer em mais de um grupo se atuar em atividades diferentes.
- Retorne no máximo 30 grupos e no máximo 12 fornecedores por grupo.
- Ignore nomes claramente internos, funcionários, aluguéis, pagamentos, alojamentos ou descrições administrativas quando não representarem empresas concorrentes.
- A resposta deve ser somente JSON válido, sem markdown.

Formato obrigatório:
{
  "resumo": "uma frase curta sobre o resultado",
  "grupos": [
    {
      "titulo": "nome curto do mercado ou atividade",
      "confianca": "alta|media|baixa",
      "criterio": "por que estes fornecedores foram considerados potenciais concorrentes",
      "fornecedor_ids": ["id existente"],
      "alerta": "limitação ou ponto que precisa de confirmação humana"
    }
  ],
  "sem_concorrencia_clara": ["id existente"]
}

Lista de fornecedores:
${JSON.stringify(fornecedores)}`

  let response: Response
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_COMPETITOR_MODEL || 'claude-sonnet-4-5',
        max_tokens: 6000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
  } catch {
    return NextResponse.json({ detail: 'Não foi possível conectar ao serviço de análise.' }, { status: 502 })
  }

  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    return NextResponse.json({ detail: result?.error?.message || 'O serviço de análise recusou a solicitação.' }, { status: 502 })
  }

  const text = (result?.content || [])
    .filter((block: any) => block?.type === 'text')
    .map((block: any) => block.text || '')
    .join('')

  try {
    const analysis = parseJson(text)
    const validIds = new Set(fornecedores.map((item: any) => item.id))
    analysis.grupos = Array.isArray(analysis.grupos)
      ? analysis.grupos.map((group: any) => ({
          titulo: String(group?.titulo || 'Grupo sem nome'),
          confianca: ['alta', 'media', 'baixa'].includes(group?.confianca) ? group.confianca : 'baixa',
          criterio: String(group?.criterio || ''),
          alerta: String(group?.alerta || 'Confirme a relação antes de tomar decisões comerciais.'),
          fornecedor_ids: Array.isArray(group?.fornecedor_ids) ? group.fornecedor_ids.filter((id: any) => validIds.has(String(id))).map(String) : [],
        })).filter((group: any) => group.fornecedor_ids.length >= 2)
      : []
    analysis.sem_concorrencia_clara = Array.isArray(analysis.sem_concorrencia_clara)
      ? analysis.sem_concorrencia_clara.filter((id: any) => validIds.has(String(id))).map(String)
      : []
    return NextResponse.json(analysis)
  } catch (error: any) {
    return NextResponse.json({ detail: error?.message || 'A resposta da IA não pôde ser interpretada.' }, { status: 502 })
  }
}
