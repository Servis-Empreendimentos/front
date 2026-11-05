import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE, lerToken } from '../../../lib/auth'
import { supabaseConfig } from '../../../lib/supabaseServer'

export const dynamic = 'force-dynamic'

const TABLES = new Set([
  'categorias',
  'lancamentos',
  'parcelas',
  'itens_lancamento',
  'fornecedores',
  'inventario',
  'obras',
  'funcionarios',
  'historico_salarios',
  'pagamentos_funcionario',
  'contratos_medicao',
  'medicoes_contrato',
  'viagens',
  'contas_mensais',
  'pagamentos_contas_mensais',
  'notas_fiscais',
])

// Campos da nota fiscal só podem ser gravados pela rota /api/notas/[id], que confere se a nota
// já foi lançada (e, nesse caso, só deixa a gestora editar). A gestora continua com acesso direto.
const CAMPOS_NF_LANCAMENTO = ['tipo_nf', 'nf_numero', 'arquivo_url']
const CAMPOS_VALOR_ITEM = ['tipo', 'nome', 'quantidade', 'unidade_medida', 'valor_unitario', 'valor_total', 'lancamento_id']

function lerJson(buffer: ArrayBuffer): any {
  try { return JSON.parse(new TextDecoder().decode(buffer)) } catch { return null }
}

async function itemEhDeNota(path: string, url: string, key: string) {
  const id = new URLSearchParams(path.split('?')[1] || '').get('id')?.replace(/^eq\./, '')
  if (!id) return true
  const response = await fetch(`${url}/rest/v1/itens_lancamento?select=tipo&id=eq.${encodeURIComponent(id)}`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: 'no-store' })
  const itens = await response.json().catch(() => [])
  return !Array.isArray(itens) || itens.some((item: any) => item?.tipo === 'nf')
}

async function alteraNotaFiscal(path: string, method: string, body: ArrayBuffer | undefined, url: string, key: string) {
  const tabela = path.split('?')[0]
  if (tabela === 'notas_fiscais') return true
  const json = body ? lerJson(body) : null
  const registros: any[] = Array.isArray(json) ? json : json ? [json] : []
  if (tabela === 'lancamentos' && (method === 'PATCH' || method === 'POST')) {
    return registros.some(r => CAMPOS_NF_LANCAMENTO.some(c => r?.[c] !== undefined && r?.[c] !== null))
  }
  if (tabela !== 'itens_lancamento') return false
  if (method === 'DELETE') return !/(^|&)tipo=eq\.orcamento(&|$)/.test(path.split('?')[1] || '')
  if (method === 'POST') return registros.some(r => r?.tipo !== 'orcamento')
  if (method === 'PATCH') {
    // Marcar item como entregue continua liberado; mudar descrição ou valores de item de nota, não.
    if (!registros.some(r => CAMPOS_VALOR_ITEM.some(c => c in (r || {})))) return false
    return itemEhDeNota(path, url, key)
  }
  return false
}

function validPath(value: string) {
  const path = value.replace(/^\/+/, '')
  const table = path.split('?')[0]
  return Boolean(table && TABLES.has(table) && /^[a-zA-Z0-9_/?=&.*(),:+%-]+$/.test(path))
}

async function proxy(request: NextRequest) {
  const { url, key } = supabaseConfig()
  if (!url || !key) {
    return NextResponse.json({ detail: 'Supabase não configurado no Vercel' }, { status: 503 })
  }

  const requestedPath = request.nextUrl.searchParams.get('path') || ''
  if (!validPath(requestedPath)) {
    return NextResponse.json({ detail: 'Tabela ou caminho não permitido' }, { status: 400 })
  }

  const path = requestedPath.replace(/^\/+/, '')
  const headers: Record<string, string> = {
    apikey: key,
    Authorization: `Bearer ${key}`,
  }
  for (const name of ['content-type', 'prefer', 'range']) {
    const value = request.headers.get(name)
    if (value) headers[name] = value
  }

  const init: RequestInit = { method: request.method, headers }
  let corpo: ArrayBuffer | undefined
  if (!['GET', 'HEAD'].includes(request.method)) { corpo = await request.arrayBuffer(); init.body = corpo }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const sessao = await lerToken(request.cookies.get(SESSION_COOKIE)?.value)
    if (sessao?.role !== 'gestora' && await alteraNotaFiscal(path, request.method, corpo, url, key)) {
      return NextResponse.json({ detail: 'Somente a gestora pode editar uma nota fiscal já lançada.' }, { status: 403 })
    }
  }

  try {
    const response = await fetch(`${url}/rest/v1/${path}`, { ...init, cache: 'no-store' })
    if (response.status === 204) {
      return new NextResponse(null, {
        status: 204,
        headers: { 'cache-control': 'no-store' },
      })
    }
    const body = await response.text()
    return new NextResponse(body, {
      status: response.status,
      headers: {
        'content-type': response.headers.get('content-type') || 'application/json',
        // Nunca guardar em cache: cada usuário precisa ver o que os outros acabaram de lançar.
        'cache-control': 'no-store, max-age=0',
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { detail: `Não foi possível conectar ao Supabase: ${error?.message || 'erro de rede'}` },
      { status: 502 },
    )
  }
}

export async function GET(request: NextRequest) { return proxy(request) }
export async function POST(request: NextRequest) { return proxy(request) }
export async function PATCH(request: NextRequest) { return proxy(request) }
export async function DELETE(request: NextRequest) { return proxy(request) }
export async function OPTIONS() { return new NextResponse(null, { status: 204 }) }
