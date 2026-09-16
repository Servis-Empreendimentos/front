const API_BASE = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '')
const SUPA_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '')
const SUPA_KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY || ''
const SUPA_HEADERS = {
  apikey: SUPA_KEY,
  Authorization: `Bearer ${SUPA_KEY}`,
  'Content-Type': 'application/json',
}

const LOCAL_ACCOUNTS_KEY = 'servis.contas-mensais.v1'
const LOCAL_PAYMENTS_KEY = 'servis.pagamentos-mensais.v1'

type RequestOptions = RequestInit & { timeoutMs?: number }

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { timeoutMs = 4500, ...init } = options
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    if (API_BASE) {
      const response = await fetch(`${API_BASE}${path}`, { ...init, signal: controller.signal })
      if (!response.ok) {
        let detail = ''
        try { detail = (await response.json())?.detail || '' } catch {}
        throw new Error(detail || `API ${response.status}`)
      }
      if (response.status === 204) return undefined as T
      return await response.json()
    }
    if (SUPA_URL) {
      const response = await fetch(`${SUPA_URL}${path}`, { ...init, headers: { ...SUPA_HEADERS, ...(init.headers || {}) }, signal: controller.signal })
      if (!response.ok) throw new Error(`Supabase ${response.status}`)
      return await response.json()
    }
    throw new Error('API não configurada')
  } finally {
    clearTimeout(timer)
  }
}

async function safeRequest<T>(path: string, fallback: T, options: RequestOptions = {}): Promise<T> {
  try { return await request<T>(path, options) } catch { return fallback }
}

function readLocal<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try { return JSON.parse(window.localStorage.getItem(key) || JSON.stringify(fallback)) as T } catch { return fallback }
}

function writeLocal<T>(key: string, value: T) {
  if (typeof window !== 'undefined') window.localStorage.setItem(key, JSON.stringify(value))
}

function localId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export type Parcela = {
  id?: string
  lancamento_id?: string
  numero: number
  valor: number
  data_vencimento: string
  pago: boolean
  data_pagamento?: string | null
}

export type ItemLancamento = {
  id?: string
  lancamento_id?: string
  tipo: 'orcamento' | 'nf'
  nome: string
  quantidade: number
  valor_unitario?: number | null
  valor_total?: number | null
  entregue?: boolean
  data_entrega?: string | null
  criado_em?: string
}

export type Lancamento = {
  id: string
  titulo: string
  cnpj?: string | null
  valor_total: number
  valor_original?: number | null
  valor_produtos?: number | null
  valor_frete?: number | null
  tem_desconto?: boolean
  valor_desconto?: number | null
  saldo_devedor?: number | null
  nf_numero?: string | null
  data: string
  pago_por?: string | null
  tipo_pagamento?: 'avista' | 'parcelado'
  forma_pagamento?: string | null
  status_entrega: 'pendente' | 'entregue'
  data_entrega?: string | null
  criado_por: string
  criado_em: string
  proposta_url?: string | null
  arquivo_url?: string | null
  pago: boolean
  data_pagamento?: string | null
  recorrente: boolean
  dia_vencimento?: number | null
  status_processo: string
  dias_entrega?: number | null
  data_entrega_programada?: string | null
  entrega_tipo?: string | null
  entrega_data2?: string | null
  entrega_itens1?: string | null
  entrega_itens2?: string | null
  itens?: ItemLancamento[]
  parcelas?: Parcela[]
}

export type ContaMensal = {
  id: string
  titulo: string
  categoria_id?: string
  categoria_nome?: string
  pago_por: string
  dia_vencimento: number
  ativo: boolean
  criado_em: string
}

export type PagamentoContaMensal = {
  id: string
  conta_mensal_id: string
  valor: number
  data_pagamento: string
  criado_em?: string
}

export type Fornecedor = {
  id: string
  nome: string
  cnpj?: string | null
  criado_em?: string
}

export const PIPELINE = [
  { id: 'orcamento_aprovado', label: 'Orçamento recebido', icon: '📋' },
  { id: 'em_tratativa', label: 'Em tratativa', icon: '🤝' },
  { id: 'orcamento_fechado', label: 'Orçamento fechado', icon: '✅' },
  { id: 'pagamento_realizado', label: 'Pagamento realizado', icon: '💰' },
  { id: 'entrega_programada', label: 'Entrega programada', icon: '📅' },
  { id: 'mercadoria_recebida', label: 'Mercadoria recebida', icon: '📦' },
  { id: 'nf_recebida', label: 'NF recebida', icon: '🧾' },
]

export const PIPELINE_LOCKED_FROM = 'orcamento_fechado'
export const PIPELINE_NF_FROM = 'mercadoria_recebida'

export const fmtR = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
export const fmtData = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')
export const fmtCNPJ = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 14)
  if (d.length <= 2) return d
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

const localAccounts = () => readLocal<ContaMensal[]>(LOCAL_ACCOUNTS_KEY, [])
const localPayments = () => readLocal<PagamentoContaMensal[]>(LOCAL_PAYMENTS_KEY, [])

export const api = {
  categorias: async () => safeRequest<any[]>('/api/categorias', []),

  listar: async (f: { status_processo?: string; recorrente?: string } = {}) => {
    const params = new URLSearchParams({ order: 'criado_em.desc' })
    if (f.status_processo) params.set('status_processo', f.status_processo)
    if (f.recorrente) params.set('recorrente', f.recorrente)
    return safeRequest<Lancamento[]>(`/api/lancamentos?${params.toString()}`, [])
  },

  buscar: async (id: string) => {
    const fallback: Lancamento = { id, titulo: '', valor_total: 0, data: '', status_entrega: 'pendente', criado_por: '', criado_em: '', pago: false, recorrente: false, status_processo: 'orcamento_aprovado', parcelas: [], itens: [] }
    return safeRequest<Lancamento>(`/api/lancamentos/${id}`, fallback)
  },

  atualizarLancamento: async (id: string, body: Record<string, unknown>) => {
    await request(`/api/lancamentos/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  },

  excluirLancamento: async (id: string) => {
    await request(`/api/lancamentos/${id}`, { method: 'DELETE' })
  },

  uploadArquivo: async (file: File): Promise<string> => {
    if (!SUPA_URL || !SUPA_KEY) throw new Error('Armazenamento de arquivos não configurado')
    const ext = file.name.split('.').pop() || 'pdf'
    const nome = `${Date.now()}.${ext}`
    const response = await fetch(`${SUPA_URL}/storage/v1/object/notas-fiscais/${nome}`, { method: 'POST', headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` }, body: file })
    if (!response.ok) throw new Error('Falha ao enviar arquivo')
    return `${SUPA_URL}/storage/v1/object/public/notas-fiscais/${nome}`
  },

  lerDocumento: async (file: File, prompt: string) => {
    const body = new FormData()
    body.append('file', file, file.name)
    body.append('prompt', prompt)
    return request<any>('/api/documentos/ler', { method: 'POST', body, timeoutMs: 60000 })
  },

  criar: async (payload: any) => {
    const body = { ...payload, pago_por: 'Servis Empreendimentos' }
    return request<Lancamento>('/api/lancamentos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  },

  salvarItensNF: async (lancamento_id: string, itens: ItemLancamento[]) => {
    await request('/api/itens-lancamento/batch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lancamento_id, itens }) })
  },

  atualizarItem: async (id: string, body: Partial<ItemLancamento>) => {
    await request(`/api/itens-lancamento/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  },

  marcarPago: async (id: string) => {
    await request(`/api/parcelas/${id}/pagar`, { method: 'PATCH' })
  },

  estornar: async (id: string) => {
    await request(`/api/parcelas/${id}/estornar`, { method: 'PATCH' })
  },

  buscarFornecedores: async (termo: string): Promise<Fornecedor[]> => {
    if (!termo || termo.length < 2) return []
    return safeRequest<Fornecedor[]>(`/api/fornecedores?q=${encodeURIComponent(termo)}`, [])
  },

  listarFornecedores: async (): Promise<Fornecedor[]> => safeRequest<Fornecedor[]>('/api/fornecedores', []),

  salvarFornecedor: async (nome: string, cnpj?: string) => {
    const existentes = await api.buscarFornecedores(nome)
    if (existentes.length) {
      if (cnpj && !existentes[0].cnpj) await api.atualizarFornecedor(existentes[0].id, { cnpj })
      return existentes[0]
    }
    return api.criarFornecedor(nome, cnpj)
  },

  criarFornecedor: async (nome: string, cnpj?: string) => request<Fornecedor>('/api/fornecedores', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome, cnpj: cnpj || null }) }),

  atualizarFornecedor: async (id: string, body: { nome?: string; cnpj?: string | null }) => {
    await request(`/api/fornecedores/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  },

  excluirFornecedor: async (id: string) => {
    await request(`/api/fornecedores/${id}`, { method: 'DELETE' })
  },

  listarContasMensais: async (): Promise<ContaMensal[]> => {
    const fallback = localAccounts()
    const remote = await safeRequest<ContaMensal[] | null>('/api/contas-mensais', null)
    return remote === null ? fallback : remote
  },

  criarContaMensal: async (payload: Omit<ContaMensal, 'id' | 'criado_em'>) => {
    const local = { ...payload, id: localId('conta'), criado_em: new Date().toISOString() }
    try {
      return await request<ContaMensal>('/api/contas-mensais', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    } catch {
      const accounts = localAccounts()
      writeLocal(LOCAL_ACCOUNTS_KEY, [...accounts, local])
      return local
    }
  },

  toggleContaMensal: async (id: string, ativo: boolean) => {
    try {
      await request(`/api/contas-mensais/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ativo }) })
    } catch {
      writeLocal(LOCAL_ACCOUNTS_KEY, localAccounts().map(conta => conta.id === id ? { ...conta, ativo } : conta))
    }
  },

  listarPagamentosMensais: async (): Promise<PagamentoContaMensal[]> => {
    const fallback = localPayments().sort((a, b) => a.data_pagamento.localeCompare(b.data_pagamento))
    const remote = await safeRequest<PagamentoContaMensal[] | null>('/api/contas-mensais/pagamentos', null)
    return remote === null ? fallback : remote
  },

  listarPagamentosDaConta: async (contaId: string): Promise<PagamentoContaMensal[]> => {
    const fallback = localPayments().filter(pagamento => pagamento.conta_mensal_id === contaId).sort((a, b) => a.data_pagamento.localeCompare(b.data_pagamento))
    const remote = await safeRequest<PagamentoContaMensal[] | null>(`/api/contas-mensais/${contaId}/pagamentos`, null)
    return remote === null ? fallback : remote
  },

  registrarPagamentoMensal: async (conta_mensal_id: string, valor: number, data_pagamento: string) => {
    try {
      return await request<PagamentoContaMensal>(`/api/contas-mensais/${conta_mensal_id}/pagamentos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ valor, data_pagamento }) })
    } catch {
      const pagamento = { id: localId('pagamento'), conta_mensal_id, valor, data_pagamento, criado_em: new Date().toISOString() }
      writeLocal(LOCAL_PAYMENTS_KEY, [pagamento, ...localPayments()])
      return pagamento
    }
  },

  excluirPagamentoMensal: async (id: string) => {
    try {
      await request(`/api/pagamentos-contas-mensais/${id}`, { method: 'DELETE' })
    } catch {
      writeLocal(LOCAL_PAYMENTS_KEY, localPayments().filter(pagamento => pagamento.id !== id))
    }
  },
}
