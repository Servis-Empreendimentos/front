// Autenticação feita no servidor. Este arquivo NÃO deve ser importado por componentes 'use client'.
// Usa apenas Web Crypto para funcionar tanto nas rotas (Node) quanto no middleware (Edge).

export type Role = 'lancadora' | 'gestora' | 'entregador'
// Permissões extras que podem ser dadas a um usuário sem torná-lo gestora.
// A gestora já tem todas. Exemplo no APP_USERS: "permissoes":["excluir_contas_mensais"]
export type Permissao = 'excluir_contas_mensais'
export const PERMISSOES: Permissao[] = ['excluir_contas_mensais']

export type Sessao = { login: string; nome: string; role: Role; permissoes?: Permissao[]; exp: number }

type Usuario = { senha: string; nome: string; role: Role; permissoes?: string[] }

export const SESSION_COOKIE = 'servis_sessao'
export const SESSION_MAX_AGE = 60 * 60 * 12 // 12 horas

// Configure APP_USERS no Vercel com um JSON no formato:
// {"anne":{"senha":"...","nome":"Anne","role":"gestora"}}
// Para liberar só uma ação extra, sem mudar o perfil, acrescente "permissoes", por exemplo:
// {"anne":{"senha":"...","nome":"Anne","role":"lancadora","permissoes":["excluir_contas_mensais"]}}
// A lista abaixo só é usada enquanto APP_USERS não estiver configurada, e fica apenas no servidor.
const USUARIOS_PADRAO: Record<string, Usuario> = {
  anne: { senha: 'anne123', nome: 'Anne', role: 'gestora', permissoes: ['excluir_contas_mensais'] },
  mayara: { senha: 'mayara123', nome: 'Mayara', role: 'gestora' },
  edna: { senha: 'edna123', nome: 'Edna', role: 'lancadora' },
  adriana: { senha: 'adriana123', nome: 'Adriana', role: 'lancadora' },
  laryssa: {senha: 'laryssa123', nome: 'Laryssa', role: 'gestora'},
  Clau: { senha: 'clau123', nome: 'Clau', role: 'gestora' },
  obra: { senha: 'obra123', nome: 'Obra', role: 'entregador' },
}

function usuarios(): Record<string, Usuario> {
  const raw = process.env.APP_USERS
  if (!raw) return Object.fromEntries(Object.entries(USUARIOS_PADRAO).map(([login, u]) => [login.trim().toLowerCase(), u]))
  try {
    const parsed = JSON.parse(raw)
    return Object.fromEntries(Object.entries(parsed).map(([login, u]: [string, any]) => [login.trim().toLowerCase(), u as Usuario]))
  } catch {
    return USUARIOS_PADRAO
  }
}

function segredo() {
  return process.env.SESSION_SECRET
    || process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.SUPABASE_SERVICE_KEY
    || process.env.SUPABASE_KEY
    || 'servis-dev-secret'
}

const enc = new TextEncoder()

function b64url(bytes: Uint8Array) {
  let bin = ''
  bytes.forEach(b => { bin += String.fromCharCode(b) })
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromB64url(value: string) {
  const bin = atob(value.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(bin, c => c.charCodeAt(0))
}

async function assinar(payload: string) {
  const key = await crypto.subtle.importKey('raw', enc.encode(segredo()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return b64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(payload))))
}

function iguais(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export function autenticar(login: string, senha: string): Omit<Sessao, 'exp'> | null {
  const chave = login.trim().toLowerCase()
  const usuario = usuarios()[chave]
  if (!usuario || !iguais(String(usuario.senha), senha)) return null
  const permissoes = (Array.isArray(usuario.permissoes) ? usuario.permissoes : [])
    .map(p => String(p).trim().toLowerCase())
    .filter((p): p is Permissao => (PERMISSOES as string[]).includes(p))
  return { login: chave, nome: usuario.nome, role: usuario.role, permissoes }
}

export function temPermissao(sessao: Pick<Sessao, 'role' | 'permissoes'>, permissao: Permissao) {
  if (sessao.role === 'gestora') return true
  if (sessao.role === 'entregador') return false
  return Boolean(sessao.permissoes?.includes(permissao))
}

export async function criarToken(sessao: Omit<Sessao, 'exp'>) {
  const payload = b64url(enc.encode(JSON.stringify({ ...sessao, exp: Date.now() + SESSION_MAX_AGE * 1000 })))
  return `${payload}.${await assinar(payload)}`
}

export async function lerToken(token?: string | null): Promise<Sessao | null> {
  if (!token) return null
  const [payload, assinatura] = token.split('.')
  if (!payload || !assinatura) return null
  if (!iguais(await assinar(payload), assinatura)) return null
  try {
    const sessao = JSON.parse(new TextDecoder().decode(fromB64url(payload))) as Sessao
    if (!sessao.exp || sessao.exp < Date.now()) return null
    return sessao
  } catch {
    return null
  }
}

// Regras de acesso ao banco por perfil, aplicadas no servidor.
const TABELAS_OBRA: Record<string, string[]> = {
  lancamentos: ['GET', 'PATCH'],
  itens_lancamento: ['GET', 'PATCH', 'POST', 'DELETE'],
  obras: ['GET'],
}
const EXCLUSAO_SO_GESTORA = new Set(['lancamentos', 'fornecedores', 'inventario', 'viagens', 'obras'])

// Excluir uma conta mensal (e, junto, todos os pagamentos dela) exige a permissão
// "excluir_contas_mensais". Excluir um pagamento avulso pelo histórico continua como antes.
function excluiContaMensal(tabela: string, query: string) {
  if (tabela === 'contas_mensais') return true
  return tabela === 'pagamentos_contas_mensais' && /(^|&)conta_mensal_id=/.test(query)
}

export function podeAcessarTabela(sessao: Pick<Sessao, 'role' | 'permissoes'>, tabela: string, metodo: string, query = '') {
  const { role } = sessao
  if (role === 'entregador') return Boolean(TABELAS_OBRA[tabela]?.includes(metodo))
  if (metodo === 'DELETE' && excluiContaMensal(tabela, query)) return temPermissao(sessao, 'excluir_contas_mensais')
  if (metodo === 'DELETE' && EXCLUSAO_SO_GESTORA.has(tabela)) return role === 'gestora'
  return true
}
