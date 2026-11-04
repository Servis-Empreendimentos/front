// Configuração e chamadas ao Supabase feitas apenas no servidor (rotas /api).
export function supabaseConfig() {
  const configuredUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const url = configuredUrl
    .replace(/\/rest\/v1\/?$/, '')
    .replace(/\/$/, '')
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_KEY ||
    ''
  return { url, key }
}

export class SupabaseErro extends Error {
  status: number
  constructor(message: string, status: number) { super(message); this.status = status }
}

// Chamada ao REST do Supabase com a chave do servidor. Lança SupabaseErro se a resposta não for 2xx.
export async function supabaseServidor<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const { url, key } = supabaseConfig()
  if (!url || !key) throw new SupabaseErro('Supabase não configurado no Vercel', 503)
  const headers = new Headers(init.headers)
  headers.set('apikey', key)
  headers.set('Authorization', `Bearer ${key}`)
  if (typeof init.body === 'string' && !headers.has('content-type')) headers.set('content-type', 'application/json')
  const response = await fetch(`${url}/rest/v1/${path.replace(/^\/+/, '')}`, { ...init, headers, cache: 'no-store' })
  const texto = await response.text()
  if (!response.ok) {
    let detalhe = texto
    try { const json = JSON.parse(texto); detalhe = json?.message || json?.detail || texto } catch {}
    throw new SupabaseErro(detalhe || `Erro ${response.status} ao acessar o banco`, response.status)
  }
  if (!texto.trim()) return undefined as T
  return JSON.parse(texto) as T
}
