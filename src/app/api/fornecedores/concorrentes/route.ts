import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const MAX_SUPPLIERS = 250
const MAX_CANDIDATES = 160

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

function isRealSupplier(item: ReturnType<typeof cleanSupplier>) {
  const text = [item.nome, item.segmento, item.tipos, item.razao_social]
    .join(' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  return !(/\bALUGUEL\b|\bFUNCIONARIOS?\b|\bFOLHA\s+DE\s+PAGAMENTO\b|\bADIANTAMENTO\s+SALARIAL\b|\bVALE\s+ALIMENTACAO\b/i.test(text))
}

function keyFor(item: any) {
  const value = String(item.segmento || item.tipos || '').toUpperCase().trim()
  return value || 'SEM SEGMENTO'
}

function baselineGroups(items: any[]) {
  const grouped = new Map<string, any[]>()
  for (const item of items) {
    const key = keyFor(item)
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(item)
  }
  return Array.from(grouped.entries())
    .filter(([, group]) => group.length >= 2 && group[0].segmento + group[0].tipos !== '')
    .slice(0, 30)
    .map(([key, group]) => ({
      titulo: key,
      confianca: 'media',
      criterio: `Os fornecedores compartilham o segmento ou tipo cadastrado: ${key}.`,
      alerta: 'A semelhança de segmento não confirma que os produtos ou serviços sejam iguais; valide comercialmente.',
      fornecedor_ids: group.slice(0, 12).map(item => item.id),
    }))
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY

  let body: any
  try { body = await request.json() }
  catch { return NextResponse.json({ detail: 'Envie uma lista válida de fornecedores.' }, { status: 400 }) }

  const fornecedores = Array.isArray(body?.fornecedores)
    ? body.fornecedores.map(cleanSupplier).filter((item: any) => item.id && item.nome && isRealSupplier(item)).slice(0, MAX_SUPPLIERS)
    : []

  if (fornecedores.length < 2) {
    return NextResponse.json({ detail: 'Cadastre pelo menos dois fornecedores para fazer a comparação.' }, { status: 400 })
  }

  const baseGroups = baselineGroups(fornecedores)
  const candidateIds = new Set(baseGroups.flatMap(group => group.fornecedor_ids))
  const candidates = fornecedores.filter(item => candidateIds.has(item.id)).slice(0, MAX_CANDIDATES)

  if (!apiKey || candidates.length < 2) {
    return NextResponse.json({
      resumo: candidates.length < 2 ? 'Não há segmentos com fornecedores suficientes para formar um grupo.' : 'Grupos iniciais formados pela semelhança dos segmentos cadastrados.',
      grupos: baseGroups,
      sem_concorrencia_clara: fornecedores.filter(item => !candidateIds.has(item.id)).map(item => item.id),
      origem: 'segmento',
    })
  }

  const prompt = `Você é um analista comercial. Valide e refine os grupos de potenciais concorrentes abaixo usando apenas os dados fornecidos.

Regras:
- Potencial concorrente não é certeza; indique confiança alta, media ou baixa.
- Use segmento, tipos, razão social e atividade aparente.
- Não invente produtos ou serviços.
- Mantenha somente grupos com pelo menos 2 fornecedores.
- No máximo 20 grupos e 10 fornecedores por grupo.
- Retorne apenas JSON válido, sem markdown.

Formato:
{"resumo":"frase curta","grupos":[{"titulo":"mercado","confianca":"alta|media|baixa","criterio":"justificativa","alerta":"o que validar","fornecedor_ids":["id"]}],"sem_concorrencia_clara":["id"]}

Fornecedores candidatos:
${JSON.stringify(candidates)}`

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
        model: process.env.ANTHROPIC_COMPETITOR_MODEL || 'claude-haiku-4-5',
        max_tokens: 3000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
  } catch {
    return NextResponse.json({
      resumo: 'A análise detalhada demorou para responder; os grupos abaixo são uma triagem por segmento para conferência.',
      grupos: baseGroups,
      sem_concorrencia_clara: fornecedores.filter(item => !candidateIds.has(item.id)).map(item => item.id),
      origem: 'segmento',
    })
  }

  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    return NextResponse.json({
      resumo: 'A IA não respondeu; os grupos abaixo são uma triagem por segmento para conferência.',
      grupos: baseGroups,
      sem_concorrencia_clara: fornecedores.filter(item => !candidateIds.has(item.id)).map(item => item.id),
      origem: 'segmento',
    })
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
      : baseGroups
    analysis.sem_concorrencia_clara = Array.isArray(analysis.sem_concorrencia_clara)
      ? analysis.sem_concorrencia_clara.filter((id: any) => validIds.has(String(id))).map(String)
      : fornecedores.filter(item => !candidateIds.has(item.id)).map(item => item.id)
    analysis.origem = 'ia'
    return NextResponse.json(analysis)
  } catch {
    return NextResponse.json({
      resumo: 'A resposta detalhada não pôde ser interpretada; os grupos abaixo são uma triagem por segmento para conferência.',
      grupos: baseGroups,
      sem_concorrencia_clara: fornecedores.filter(item => !candidateIds.has(item.id)).map(item => item.id),
      origem: 'segmento',
    })
  }
}
