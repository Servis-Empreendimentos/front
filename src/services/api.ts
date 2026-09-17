const configuredApiBase = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '')
// O frontend publicado não deve tentar acessar localhost do computador do visitante.
const API_BASE = process.env.NODE_ENV === 'production' && /localhost|127\.0\.0\.1/.test(configuredApiBase) ? '' : configuredApiBase
const SUPA_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '')
const SUPA_KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY || ''
const SUPA_HEADERS = {
  apikey: SUPA_KEY,
  Authorization: `Bearer ${SUPA_KEY}`,
  'Content-Type': 'application/json',
}

const LOCAL_LANCAMENTOS_KEY = 'servis.lancamentos.v1'
const LOCAL_FORNECEDORES_KEY = 'servis.fornecedores.v1'
const LOCAL_ACCOUNTS_KEY = 'servis.contas-mensais.v1'
const LOCAL_PAYMENTS_KEY = 'servis.pagamentos-mensais.v1'

type RequestOptions = RequestInit & { timeoutMs?: number }

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!API_BASE) throw new Error('Backend não configurado para esta operação')
  const { timeoutMs = 4500, ...init } = options
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(`${API_BASE}${path}`, { ...init, signal: controller.signal })
    if (!response.ok) {
      let detail = ''
      try { detail = (await response.json())?.detail || '' } catch {}
      throw new Error(detail || `API ${response.status}`)
    }
    if (response.status === 204) return undefined as T
    return await response.json()
  } catch (error: any) {
    if (error?.name === 'AbortError') throw new Error('A API demorou para responder. Tente novamente.')
    if (error instanceof TypeError) throw new Error('Não foi possível conectar à API. Verifique a URL pública do backend.')
    throw error
  } finally {
    clearTimeout(timer)
  }
}

async function supabaseRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!SUPA_URL || !SUPA_KEY) throw new Error('Supabase não configurado no frontend')
  const response = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    ...options,
    headers: { ...SUPA_HEADERS, ...(options.headers || {}) },
  })
  if (!response.ok) {
    let detail = ''
    try { detail = await response.text() } catch {}
    throw new Error(detail || `Supabase ${response.status}`)
  }
  if (response.status === 204) return undefined as T
  return await response.json()
}

async function readRemote<T>(backendPath: string, supabasePath: string, options: RequestOptions = {}): Promise<T> {
  if (API_BASE) {
    try {
      return await request<T>(backendPath, options)
    } catch {
      // O backend antigo pode estar desligado. O banco oficial continua sendo o Supabase.
    }
  }
  return supabaseRequest<T>(supabasePath, options)
}

async function safeRead<T>(backendPath: string, supabasePath: string, fallback: T, options: RequestOptions = {}): Promise<T> {
  try { return await readRemote<T>(backendPath, supabasePath, options) } catch { return fallback }
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
  unidade_medida?: string | null
  valor_unitario?: number | null
  valor_total?: number | null
  entregue?: boolean
  data_entrega?: string | null
  criado_em?: string
}

export type Lancamento = {
  id: string
  titulo: string
  numero_orcamento?: string | null
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
  fornecedor_master_id?: string | null
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

const localLancamentos = () => readLocal<Lancamento[]>(LOCAL_LANCAMENTOS_KEY, [])
const localFornecedores = () => readLocal<Fornecedor[]>(LOCAL_FORNECEDORES_KEY, [])
const localAccounts = () => readLocal<ContaMensal[]>(LOCAL_ACCOUNTS_KEY, [])
const localPayments = () => readLocal<PagamentoContaMensal[]>(LOCAL_PAYMENTS_KEY, [])

export const api = {
  categorias: async () => safeRead<any[]>('/api/categorias', 'categorias?order=nome.asc', []),

  listar: async (f: { status_processo?: string; recorrente?: string } = {}) => {
    const backend = new URLSearchParams({ order: 'criado_em.desc' })
    const supabase = new URLSearchParams({ order: 'criado_em.desc' })
    if (f.status_processo) { backend.set('status_processo', f.status_processo); supabase.set('status_processo', `eq.${f.status_processo}`) }
    if (f.recorrente) { backend.set('recorrente', f.recorrente); supabase.set('recorrente', `eq.${f.recorrente}`) }
    const fallback = localLancamentos().filter(item => (!f.status_processo || item.status_processo === f.status_processo) && (!f.recorrente || String(item.recorrente) === f.recorrente))
    const remote = await safeRead<Lancamento[] | null>(`/api/lancamentos?${backend.toString()}`, `lancamentos?${supabase.toString()}`, null)
    if (remote !== null) return API_BASE ? remote : remote.map(item => ({ ...item, parcelas: [], itens: [] }))
    return fallback
  },

  buscar: async (id: string) => {
    const fallback: Lancamento = localLancamentos().find(item => item.id === id) || { id, titulo: '', valor_total: 0, data: '', status_entrega: 'pendente', criado_por: '', criado_em: '', pago: false, recorrente: false, status_processo: 'orcamento_aprovado', parcelas: [], itens: [] }
    if (API_BASE) {
      try { return await request<Lancamento>(`/api/lancamentos/${id}`) }
      catch { /* backend indisponível: cai para a consulta direta ao Supabase abaixo */ }
    }
    try {
      const [lancamentos, parcelas, itens] = await Promise.all([
        supabaseRequest<Lancamento[]>(`lancamentos?id=eq.${encodeURIComponent(id)}`),
        supabaseRequest<Parcela[]>(`parcelas?lancamento_id=eq.${encodeURIComponent(id)}&order=numero.asc`),
        supabaseRequest<ItemLancamento[]>(`itens_lancamento?lancamento_id=eq.${encodeURIComponent(id)}&order=tipo.asc,criado_em.asc`),
      ])
      return lancamentos[0] ? { ...lancamentos[0], parcelas: parcelas || [], itens: itens || [] } : fallback
    } catch { return fallback }
  },

  atualizarLancamento: async (id: string, body: Record<string, unknown>) => {
    try {
      await readRemote(`/api/lancamentos/${id}`, `lancamentos?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(body) })
    } catch (error) {
      const local = localLancamentos()
      if (!local.some(item => item.id === id)) throw error
      writeLocal(LOCAL_LANCAMENTOS_KEY, local.map(item => item.id === id ? { ...item, ...body } as Lancamento : item))
    }
  },

  excluirLancamento: async (id: string) => {
    try { await readRemote(`/api/lancamentos/${id}`, `lancamentos?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' }) }
    catch { writeLocal(LOCAL_LANCAMENTOS_KEY, localLancamentos().filter(item => item.id !== id)) }
  },

  uploadArquivo: async (file: File): Promise<string> => {
    if (!SUPA_URL || !SUPA_KEY) throw new Error('Armazenamento de arquivos não configurado')
    const ext = file.name.split('.').pop() || 'pdf'
    const nome = `${Date.now()}.${ext}`
    const response = await fetch(`${SUPA_URL}/storage/v1/object/notas-fiscais/${nome}`, { method: 'POST', headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` }, body: file })
    if (!response.ok) throw new Error('Falha ao enviar arquivo para o armazenamento')
    return `${SUPA_URL}/storage/v1/object/public/notas-fiscais/${nome}`
  },

  lerDocumento: async (file: File, prompt: string) => {
    const body = new FormData()
    body.append('file', file, file.name)
    body.append('prompt', prompt)
    if (API_BASE) {
      try { return await request<any>('/api/documentos/ler', { method: 'POST', body, timeoutMs: 60000 }) }
      catch { /* tenta a rota serverless do frontend abaixo */ }
    }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 60000)
    try {
      const response = await fetch('/api/documentos/ler', { method: 'POST', body, signal: controller.signal })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.detail || `Leitura de PDF indisponível (${response.status})`)
      return data
    } catch (error: any) {
      if (error?.name === 'AbortError') throw new Error('A leitura do PDF demorou para responder. Tente novamente.')
      throw error
    } finally {
      clearTimeout(timer)
    }
  },

  criar: async (payload: any) => {
    const { parcelas, itens, categoria_nome, ...bodySemFilhos } = payload
    const body = { ...bodySemFilhos, pago_por: 'Servis Empreendimentos' }
    try {
      if (API_BASE) {
        try {
          return await request<Lancamento>('/api/lancamentos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, parcelas, itens }) })
        } catch {
          // Continua no Supabase: o backend antigo pode não estar publicado.
        }
      }
      const data = await supabaseRequest<Lancamento[]>('lancamentos', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(body) })
      const lanc = data[0]
      if (!lanc) throw new Error('O banco não retornou o orçamento criado')
      if (itens?.length) await supabaseRequest('itens_lancamento', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(itens.map((item: ItemLancamento) => ({ lancamento_id: lanc.id, tipo: 'orcamento', nome: item.nome, quantidade: item.quantidade, unidade_medida: item.unidade_medida || 'Un', valor_unitario: item.valor_unitario || 0, valor_total: item.valor_total || 0 }))) })
      if (parcelas?.length) await supabaseRequest('parcelas', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(parcelas.map((p: Parcela) => ({ ...p, lancamento_id: lanc.id }))) })
      return lanc
    } catch {
      const now = new Date().toISOString()
      const local: Lancamento & { __localFallback?: boolean } = {
        ...body,
        id: localId('orcamento'),
        criado_em: now,
        status_entrega: body.status_entrega || 'pendente',
        pago: Boolean(body.pago),
        recorrente: Boolean(body.recorrente),
        status_processo: body.status_processo || 'orcamento_aprovado',
        saldo_devedor: body.saldo_devedor ?? body.valor_total ?? 0,
        parcelas: parcelas || [],
        itens: (itens || []).map((item: ItemLancamento) => ({ ...item, id: item.id || localId('item'), unidade_medida: item.unidade_medida || 'Un' })),
        __localFallback: true,
      }
      writeLocal(LOCAL_LANCAMENTOS_KEY, [local, ...localLancamentos()])
      return local
    }
  },

  salvarItensNF: async (lancamento_id: string, itens: ItemLancamento[]) => {
    try {
      if (API_BASE) {
        try {
          await request('/api/itens-lancamento/batch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lancamento_id, itens }) })
          return
        } catch {
          // Continua no Supabase: o backend antigo pode não estar publicado.
        }
      }
      await supabaseRequest(`itens_lancamento?lancamento_id=eq.${encodeURIComponent(lancamento_id)}&tipo=eq.nf`, { method: 'DELETE' })
      if (itens.length) await supabaseRequest('itens_lancamento', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(itens.map(i => ({ lancamento_id, tipo: 'nf', nome: i.nome, quantidade: i.quantidade, unidade_medida: i.unidade_medida || 'Un', valor_unitario: i.valor_unitario || 0, valor_total: i.valor_total || 0 }))) })
    } catch {
      writeLocal(LOCAL_LANCAMENTOS_KEY, localLancamentos().map(item => item.id === lancamento_id ? { ...item, itens: [...(item.itens || []).filter(existing => existing.tipo !== 'nf'), ...itens] } : item))
    }
  },

  atualizarItem: async (id: string, body: Partial<ItemLancamento>) => {
    try { await readRemote(`/api/itens-lancamento/${id}`, `itens_lancamento?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(body) }) }
    catch { writeLocal(LOCAL_LANCAMENTOS_KEY, localLancamentos().map(item => ({ ...item, itens: item.itens?.map(existing => existing.id === id ? { ...existing, ...body } : existing) }))) }
  },

  marcarPago: async (id: string) => {
    try { await readRemote(`/api/parcelas/${id}/pagar`, `parcelas?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ pago: true, data_pagamento: new Date().toISOString().slice(0, 10) }) }) }
    catch { writeLocal(LOCAL_LANCAMENTOS_KEY, localLancamentos().map(item => ({ ...item, parcelas: item.parcelas?.map(parcela => parcela.id === id ? { ...parcela, pago: true, data_pagamento: new Date().toISOString().slice(0, 10) } : parcela) }))) }
  },

  estornar: async (id: string) => {
    try { await readRemote(`/api/parcelas/${id}/estornar`, `parcelas?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ pago: false, data_pagamento: null }) }) }
    catch { writeLocal(LOCAL_LANCAMENTOS_KEY, localLancamentos().map(item => ({ ...item, parcelas: item.parcelas?.map(parcela => parcela.id === id ? { ...parcela, pago: false, data_pagamento: null } : parcela) }))) }
  },

  buscarFornecedores: async (termo: string): Promise<Fornecedor[]> => {
    if (!termo || termo.length < 2) return []
    const fallback = localFornecedores().filter(item => item.nome.toLowerCase().includes(termo.toLowerCase()) || (item.cnpj || '').includes(termo))
    const query = `fornecedores?or=(nome.ilike.*${encodeURIComponent(termo)}*,cnpj.ilike.*${encodeURIComponent(termo)}*)&order=nome.asc&limit=8`
    return safeRead<Fornecedor[] | null>(`/api/fornecedores?q=${encodeURIComponent(termo)}`, query, null).then(remote => remote === null ? fallback : remote)
  },

  listarFornecedores: async (): Promise<Fornecedor[]> => safeRead<Fornecedor[] | null>('/api/fornecedores', 'fornecedores?order=nome.asc', null).then(remote => remote === null ? localFornecedores() : remote),

  salvarFornecedor: async (nome: string, cnpj?: string) => {
    const existentes = await api.buscarFornecedores(nome)
    if (existentes.length) {
      if (cnpj && !existentes[0].cnpj) await api.atualizarFornecedor(existentes[0].id, { cnpj })
      return existentes[0]
    }
    return api.criarFornecedor(nome, cnpj)
  },

  criarFornecedor: async (nome: string, cnpj?: string, fornecedorMasterId?: string | null) => {
    try {
      return await readRemote<Fornecedor>(
        '/api/fornecedores',
        'fornecedores',
        { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ nome, cnpj: cnpj || null, fornecedor_master_id: fornecedorMasterId || null }) },
      ).then((result: any) => Array.isArray(result) ? result[0] : result)
    } catch {
      const fornecedor = { id: localId('fornecedor'), nome, cnpj: cnpj || null, fornecedor_master_id: fornecedorMasterId || null, criado_em: new Date().toISOString() }
      writeLocal(LOCAL_FORNECEDORES_KEY, [fornecedor, ...localFornecedores()])
      return fornecedor
    }
  },

  atualizarFornecedor: async (id: string, body: { nome?: string; cnpj?: string | null; fornecedor_master_id?: string | null }) => {
    try { await readRemote(`/api/fornecedores/${id}`, `fornecedores?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(body) }) }
    catch { writeLocal(LOCAL_FORNECEDORES_KEY, localFornecedores().map(item => item.id === id ? { ...item, ...body } : item)) }
  },

  excluirFornecedor: async (id: string) => {
    try { await readRemote(`/api/fornecedores/${id}`, `fornecedores?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' }) }
    catch { writeLocal(LOCAL_FORNECEDORES_KEY, localFornecedores().filter(item => item.id !== id)) }
  },

  // Contas mensais são uma rotina pessoal do navegador e não consultam o banco.
  listarContasMensais: async (): Promise<ContaMensal[]> => localAccounts(),

  criarContaMensal: async (payload: Omit<ContaMensal, 'id' | 'criado_em'>) => {
    const local = { ...payload, id: localId('conta'), criado_em: new Date().toISOString() }
    writeLocal(LOCAL_ACCOUNTS_KEY, [...localAccounts(), local])
    return local
  },

  toggleContaMensal: async (id: string, ativo: boolean) => {
    writeLocal(LOCAL_ACCOUNTS_KEY, localAccounts().map(conta => conta.id === id ? { ...conta, ativo } : conta))
  },

  listarPagamentosMensais: async (): Promise<PagamentoContaMensal[]> => localPayments(),

  listarPagamentosDaConta: async (contaId: string): Promise<PagamentoContaMensal[]> => localPayments().filter(item => item.conta_mensal_id === contaId),

  registrarPagamentoMensal: async (conta_mensal_id: string, valor: number, data_pagamento: string) => {
    const local = { id: localId('pagamento'), conta_mensal_id, valor, data_pagamento, criado_em: new Date().toISOString() }
    writeLocal(LOCAL_PAYMENTS_KEY, [local, ...localPayments()])
    return local
  },

  excluirPagamentoMensal: async (id: string) => {
    writeLocal(LOCAL_PAYMENTS_KEY, localPayments().filter(item => item.id !== id))
  },
}
