import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const MAX_SUPPLIERS = 250
const CHUNK_SIZE = 24
const REQUEST_TIMEOUT_MS = 8000

type Supplier = {
  id: string
  nome: string
  segmento_atual: string
  tipos: string
  razao_social: string
  observacoes: string
}

type Suggestion = {
  fornecedor_id: string
  nome: string
  segmento_atual: string
  segmento_sugerido: string
  confianca: 'alta' | 'media'
  motivo: string
}

function parseJson(text: string) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try { return JSON.parse(cleaned) }
  catch {
    const match = cleaned.match(/\[[\s\S]*\]/)
    if (!match) throw new Error('A IA não retornou uma lista JSON válida')
    return JSON.parse(match[0])
  }
}

function cleanSupplier(item: any): Supplier {
  return {
    id: String(item?.id || ''),
    nome: String(item?.nome || '').trim(),
    segmento_atual: String(item?.segmento || '').trim(),
    tipos: String(item?.tipos || '').trim(),
    razao_social: String(item?.razao_social || '').trim(),
    observacoes: String(item?.observacoes || '').trim(),
  }
}

function isRealSupplier(item: Supplier) {
  const text = [item.nome, item.segmento_atual, item.tipos, item.razao_social]
    .join(' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  return !(/\bALUGUEL\b|\bFUNCIONARIOS?\b|\bFOLHA\s+DE\s+PAGAMENTO\b|\bADIANTAMENTO\s+SALARIAL\b|\bVALE\s+ALIMENTACAO\b/i.test(text))
}

function promptFor(items: Supplier[]) {
  return `Revise os segmentos dos fornecedores abaixo para uma empresa de obras.

Retorne somente fornecedores cujo segmento atual esteja provavelmente errado, genérico ou incompatível com nome, tipos, razão social ou observações. Não altere um segmento que pareça adequado.

Regras:
- Sugira um segmento curto e padronizado em português.
- Use somente os dados enviados; não pesquise nem invente atividades.
- Confiança alta exige evidência clara; use média quando houver indício razoável.
- Não retorne fornecedores sem evidência suficiente.
- Retorne somente JSON válido, sem markdown.

Exemplos de segmentos: ELÉTRICO, HIDRÁULICA, ESTRUTURA, CONCRETO, AÇO, ESQUADRIAS, VIDRAÇARIA, CLIMATIZAÇÃO, DRYWALL, LOCAÇÃO DE EQUIPAMENTOS, TRANSPORTE, SERVIÇOS GERAIS, PROJETO/ENGENHARIA, MATERIAIS DIVERSOS.

Formato:
[{"fornecedor_id":"id existente","nome":"nome","segmento_atual":"atual","segmento_sugerido":"NOVO SEGMENTO","confianca":"alta|media","motivo":"explicação curta"}]

Fornecedores:
${JSON.stringify(items)}`
}

async function analyzeChunk(items: Supplier[], apiKey: string): Promise<Suggestion[]> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_SEGMENT_MODEL || 'claude-haiku-4-5',
      max_tokens: 1800,
      messages: [{ role: 'user', content: promptFor(items) }],
    }),
  })
  if (!response.ok) throw new Error(`IA respondeu ${response.status}`)
  const result = await response.json().catch(() => ({}))
  const text = (result?.content || [])
    .filter((block: any) => block?.type === 'text')
    .map((block: any) => block.text || '')
    .join('')
  const parsed = parseJson(text)
  return Array.isArray(parsed) ? parsed as Suggestion[] : []
}

function normalizeSuggestions(items: Supplier[], suggestions: Suggestion[]) {
  const valid = new Map<string, Supplier>(items.map(item => [item.id, item]))
  return suggestions.map((suggestion: any) => {
    const original = valid.get(String(suggestion?.fornecedor_id || ''))
    if (!original) return null
    const suggested = String(suggestion?.segmento_sugerido || '').trim().toUpperCase()
    if (!suggested || suggested === original.segmento_atual.toUpperCase()) return null
    return {
      fornecedor_id: original.id,
      nome: original.nome,
      segmento_atual: original.segmento_atual || 'Sem segmento',
      segmento_sugerido: suggested,
      confianca: suggestion?.confianca === 'alta' ? 'alta' : 'media',
      motivo: String(suggestion?.motivo || 'Revise este cadastro antes de salvar.'),
    } satisfies Suggestion
  }).filter((item): item is Suggestion => Boolean(item))
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ detail: 'Revisão de segmentos não configurada. Adicione ANTHROPIC_API_KEY como variável privada no Vercel.' }, { status: 503 })

  let body: any
  try { body = await request.json() }
  catch { return NextResponse.json({ detail: 'Envie uma lista válida de fornecedores.' }, { status: 400 }) }

  const fornecedores = Array.isArray(body?.fornecedores)
    ? body.fornecedores.map(cleanSupplier).filter((item: Supplier) => item.id && item.nome && isRealSupplier(item)).slice(0, MAX_SUPPLIERS)
    : []
  if (!fornecedores.length) return NextResponse.json({ detail: 'Nenhum fornecedor foi enviado para revisão.' }, { status: 400 })

  const chunks: Supplier[][] = []
  for (let index = 0; index < fornecedores.length; index += CHUNK_SIZE) chunks.push(fornecedores.slice(index, index + CHUNK_SIZE))

  const results = await Promise.allSettled(chunks.map(chunk => analyzeChunk(chunk, apiKey)))
  const suggestions = results
    .filter((result): result is PromiseFulfilledResult<Suggestion[]> => result.status === 'fulfilled')
    .flatMap(result => result.value)
  const normalized = normalizeSuggestions(fornecedores, suggestions)
  const unique = Array.from(new Map(normalized.map(item => [item.fornecedor_id, item])).values())

  return NextResponse.json({
    suggestions: unique.slice(0, 120),
    total_fornecedores: fornecedores.length,
    lotes_processados: results.filter(result => result.status === 'fulfilled').length,
    lotes_total: chunks.length,
    aviso: results.some(result => result.status === 'rejected') ? 'Alguns lotes demoraram e não foram incluídos nesta revisão. Execute novamente para revisar os restantes.' : undefined,
  })
}
