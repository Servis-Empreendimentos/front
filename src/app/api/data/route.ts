import { NextRequest, NextResponse } from 'next/server'

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
])

function supabaseConfig() {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '')
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY || ''
  return { url, key }
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
  if (!['GET', 'HEAD'].includes(request.method)) init.body = await request.arrayBuffer()

  try {
    const response = await fetch(`${url}/rest/v1/${path}`, { ...init, cache: 'no-store' })
    const body = await response.text()
    return new NextResponse(body, {
      status: response.status,
      headers: { 'content-type': response.headers.get('content-type') || 'application/json' },
    })
  } catch {
    return NextResponse.json({ detail: 'Não foi possível conectar ao Supabase' }, { status: 502 })
  }
}

export async function GET(request: NextRequest) { return proxy(request) }
export async function POST(request: NextRequest) { return proxy(request) }
export async function PATCH(request: NextRequest) { return proxy(request) }
export async function DELETE(request: NextRequest) { return proxy(request) }
export async function OPTIONS() { return new NextResponse(null, { status: 204 }) }
