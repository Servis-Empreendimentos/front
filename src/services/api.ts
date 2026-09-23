const configuredApiBase = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '')
// O frontend publicado não deve tentar acessar localhost do computador do visitante.
const API_BASE = process.env.NODE_ENV === 'production' && /localhost|127\.0\.0\.1/.test(configuredApiBase) ? '' : configuredApiBase
const DATA_PROXY = '/api/data'

const LOCAL_LANCAMENTOS_KEY = 'servis.lancamentos.v1'
const LOCAL_FORNECEDORES_KEY = 'servis.fornecedores.v1'
const LOCAL_OBRAS_KEY = 'servis.obras.v1'
const LOCAL_FUNCIONARIOS_KEY = 'servis.funcionarios.v1'
const LOCAL_PAGAMENTOS_FUNC_KEY = 'servis.pagamentos-funcionario.v1'
const LOCAL_ACCOUNTS_KEY = 'servis.contas-mensais.v1'
const LOCAL_PAYMENTS_KEY = 'servis.pagamentos-mensais.v1'
const SHARED_LOCAL_KEYS = [
  LOCAL_LANCAMENTOS_KEY,
  LOCAL_FORNECEDORES_KEY,
  LOCAL_OBRAS_KEY,
  LOCAL_FUNCIONARIOS_KEY,
  LOCAL_PAGAMENTOS_FUNC_KEY,
]

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
  const response = await fetch(
    `${DATA_PROXY}?path=${encodeURIComponent(path)}`,
    {
      ...options,
      headers: { ...(options.headers || {}) },
      cache: 'no-store',
    },
  )
  if (!response.ok) {
    let detail = ''
    try { detail = await response.text() } catch {}
    throw new Error(detail || `Supabase ${response.status}`)
  }
  if (response.status === 204) return undefined as T
  return await response.json()
}

async function readRemote<T>(backendPath: string, supabasePath: string, options: RequestOptions = {}): Promise<T> {
  return supabaseRequest<T>(supabasePath, options)
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
  obra_id?: string | null
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

export type Obra = {
  id: string
  nome: string
  endereco?: string | null
  ativa: boolean
  criado_em?: string
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

export type Funcionario = {
  id: string
  nome: string
  cargo?: string | null
  salario_base: number
  obra_id?: string | null
  ativo: boolean
  criado_em?: string
}

export type PagamentoFuncionario = {
  id: string
  funcionario_id: string
  valor: number
  tipo: 'salario' | 'adiantamento' | 'vale' | 'outro'
  data_pagamento: string
  criado_em?: string
}

export type Fornecedor = {
  id: string
  nome: string
  cnpj?: string | null
  segmento?: string | null
  fornecedor_master_id?: string | null
  criado_em?: string
}

export type InventarioItem = {
  id: string
  nome: string
  tipo?: 'Máquina' | 'Equipamento' | string | null
  categoria?: string | null
  patrimonio?: string | null
  marca_modelo?: string | null
  numero_serie?: string | null
  status?: 'Disponível' | 'Em uso' | 'Em manutenção' | 'Inativo' | string | null
  obra_id?: string | null
  unidade: string
  quantidade: number
  estoque_minimo: number
  localizacao?: string | null
  observacoes?: string | null
  ativo?: boolean
  criado_em?: string
  atualizado_em?: string
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

export const mesLabel = (mesKey: string) => {
  const [ano, mes] = mesKey.split('-').map(Number)
  const nome = new Date(ano, (mes || 1) - 1, 1).toLocaleDateString('pt-BR', { month: 'long' })
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)}/${ano}`
}
export const fmtData = (d?: string | null) => {
  if (!d) return '—'
  const date = new Date(d + 'T00:00:00')
  if (isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('pt-BR')
}
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
  limparCacheLocal: () => {
    if (typeof window !== 'undefined') SHARED_LOCAL_KEYS.forEach(key => window.localStorage.removeItem(key))
  },

  categorias: async () => readRemote<any[]>('/api/categorias', 'categorias?order=nome.asc'),

  listar: async (f: { status_processo?: string; recorrente?: string; obra_id?: string } = {}) => {
    const backend = new URLSearchParams({ order: 'data.desc,criado_em.desc' })
    const supabase = new URLSearchParams({ order: 'data.desc,criado_em.desc' })
    if (f.status_processo) { backend.set('status_processo', f.status_processo); supabase.set('status_processo', `eq.${f.status_processo}`) }
    if (f.recorrente) { backend.set('recorrente', f.recorrente); supabase.set('recorrente', `eq.${f.recorrente}`) }
    if (f.obra_id) { backend.set('obra_id', f.obra_id); supabase.set('obra_id', `eq.${f.obra_id}`) }
    return readRemote<Lancamento[]>(`/api/lancamentos?${backend.toString()}`, `lancamentos?${supabase.toString()}`)
  },

  buscar: async (id: string) => {
    const [lancamentos, parcelas, itens] = await Promise.all([
      supabaseRequest<Lancamento[]>(`lancamentos?id=eq.${encodeURIComponent(id)}`),
      supabaseRequest<Parcela[]>(`parcelas?lancamento_id=eq.${encodeURIComponent(id)}&order=numero.asc`),
      supabaseRequest<ItemLancamento[]>(`itens_lancamento?lancamento_id=eq.${encodeURIComponent(id)}&order=tipo.asc,criado_em.asc`),
    ])
    if (!lancamentos[0]) throw new Error('Lançamento não encontrado no banco')
    return { ...lancamentos[0], parcelas: parcelas || [], itens: itens || [] }
  },

  atualizarLancamento: async (id: string, body: Record<string, unknown>) => {
    try {
      await readRemote(`/api/lancamentos/${id}`, `lancamentos?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(body) })
    } catch (error) { throw error }
  },

  excluirLancamento: async (id: string) => {
    await readRemote(`/api/lancamentos/${id}`, `lancamentos?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' })
  },

  uploadArquivo: async (file: File): Promise<string> => {
    const form = new FormData()
    form.append('file', file, file.name)
    const response = await fetch('/api/storage', { method: 'POST', body: form })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error('Falha ao enviar arquivo para o armazenamento')
    if (!data.url) throw new Error(data.detail || 'Armazenamento de arquivos não configurado')
    return data.url
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
    const data = await supabaseRequest<Lancamento[]>('lancamentos', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(body) })
    const lanc = data[0]
    if (!lanc) throw new Error('O banco não retornou o orçamento criado')
    if (itens?.length) await supabaseRequest('itens_lancamento', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(itens.map((item: ItemLancamento) => ({ lancamento_id: lanc.id, tipo: 'orcamento', nome: item.nome, quantidade: item.quantidade, unidade_medida: item.unidade_medida || 'Un', valor_unitario: item.valor_unitario || 0, valor_total: item.valor_total || 0 }))) })
    if (parcelas?.length) await supabaseRequest('parcelas', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(parcelas.map((p: Parcela) => ({ ...p, lancamento_id: lanc.id }))) })
    return lanc
  },

  salvarItensNF: async (lancamento_id: string, itens: ItemLancamento[]) => {
    await supabaseRequest(`itens_lancamento?lancamento_id=eq.${encodeURIComponent(lancamento_id)}&tipo=eq.nf`, { method: 'DELETE' })
    if (itens.length) await supabaseRequest('itens_lancamento', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(itens.map(i => ({ lancamento_id, tipo: 'nf', nome: i.nome, quantidade: i.quantidade, unidade_medida: i.unidade_medida || 'Un', valor_unitario: i.valor_unitario || 0, valor_total: i.valor_total || 0 }))) })
  },

  atualizarItem: async (id: string, body: Partial<ItemLancamento>) => {
    await readRemote(`/api/itens-lancamento/${id}`, `itens_lancamento?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(body) })
  },

  marcarPago: async (id: string) => {
    await readRemote(`/api/parcelas/${id}/pagar`, `parcelas?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ pago: true, data_pagamento: new Date().toISOString().slice(0, 10) }) })
  },

  estornar: async (id: string) => {
    await readRemote(`/api/parcelas/${id}/estornar`, `parcelas?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ pago: false, data_pagamento: null }) })
  },

  buscarFornecedores: async (termo: string): Promise<Fornecedor[]> => {
    if (!termo || termo.length < 2) return []
    const query = `fornecedores?or=(nome.ilike.*${encodeURIComponent(termo)}*,cnpj.ilike.*${encodeURIComponent(termo)}*,segmento.ilike.*${encodeURIComponent(termo)}*)&order=nome.asc&limit=8`
    return readRemote<Fornecedor[]>(`/api/fornecedores?q=${encodeURIComponent(termo)}`, query)
  },

  listarFornecedores: async (): Promise<Fornecedor[]> => readRemote<Fornecedor[]>('/api/fornecedores', 'fornecedores?order=nome.asc'),

  salvarFornecedor: async (nome: string, cnpj?: string, segmento?: string) => {
    const existentes = await api.buscarFornecedores(nome)
    if (existentes.length) {
      if (cnpj && !existentes[0].cnpj) await api.atualizarFornecedor(existentes[0].id, { cnpj })
      if (segmento && !existentes[0].segmento) await api.atualizarFornecedor(existentes[0].id, { segmento })
      return existentes[0]
    }
    return api.criarFornecedor(nome, cnpj, null, segmento)
  },

  criarFornecedor: async (nome: string, cnpj?: string, fornecedorMasterId?: string | null, segmento?: string) => {
    return await readRemote<Fornecedor>(
      '/api/fornecedores',
      'fornecedores',
      { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ nome, cnpj: cnpj || null, segmento: segmento || null, fornecedor_master_id: fornecedorMasterId || null }) },
    ).then((result: any) => Array.isArray(result) ? result[0] : result)
  },

  atualizarFornecedor: async (id: string, body: { nome?: string; cnpj?: string | null; segmento?: string | null; fornecedor_master_id?: string | null }) => {
    await readRemote(`/api/fornecedores/${id}`, `fornecedores?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(body) })
  },

  excluirFornecedor: async (id: string) => {
    await readRemote(`/api/fornecedores/${id}`, `fornecedores?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' })
  },

  listarInventario: async (): Promise<InventarioItem[]> => readRemote<InventarioItem[]>('/api/inventario', 'inventario?order=nome.asc'),

  criarInventario: async (payload: Omit<InventarioItem, 'id' | 'criado_em' | 'atualizado_em'>) => {
    const data = await supabaseRequest<InventarioItem[]>('inventario', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(payload) })
    return data[0]
  },

  atualizarInventario: async (id: string, body: Partial<Omit<InventarioItem, 'id' | 'criado_em' | 'atualizado_em'>>) => {
    await supabaseRequest(`inventario?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ ...body, atualizado_em: new Date().toISOString() }) })
  },

  excluirInventario: async (id: string) => {
    await supabaseRequest(`inventario?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' })
  },

  listarObras: async (): Promise<Obra[]> => readRemote<Obra[]>('/api/obras', 'obras?order=nome.asc'),

  criarObra: async (nome: string, endereco?: string) => {
    return await readRemote<Obra>(
      '/api/obras',
      'obras',
      { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ nome, endereco: endereco || null, ativa: true }) },
    ).then((result: any) => Array.isArray(result) ? result[0] : result)
  },

  atualizarObra: async (id: string, body: { nome?: string; endereco?: string | null; ativa?: boolean }) => {
    await readRemote(`/api/obras/${id}`, `obras?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(body) })
  },

  listarFuncionarios: async (): Promise<Funcionario[]> => readRemote<Funcionario[]>('/api/funcionarios', 'funcionarios?order=nome.asc'),

  criarFuncionario: async (payload: { nome: string; cargo?: string | null; salario_base: number; obra_id?: string | null }) => {
    return await readRemote<Funcionario>(
      '/api/funcionarios',
      'funcionarios',
      { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ ...payload, ativo: true }) },
    ).then((result: any) => Array.isArray(result) ? result[0] : result)
  },

  atualizarFuncionario: async (id: string, body: { nome?: string; cargo?: string | null; salario_base?: number; obra_id?: string | null; ativo?: boolean }) => {
    await readRemote(`/api/funcionarios/${id}`, `funcionarios?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(body) })
  },

  listarPagamentosFuncionarios: async (): Promise<PagamentoFuncionario[]> => readRemote<PagamentoFuncionario[]>('/api/pagamentos-funcionario', 'pagamentos_funcionario?order=data_pagamento.desc'),

  listarPagamentosDoFuncionario: async (funcionarioId: string): Promise<PagamentoFuncionario[]> => {
    const todos = await readRemote<PagamentoFuncionario[]>('/api/pagamentos-funcionario', `pagamentos_funcionario?funcionario_id=eq.${encodeURIComponent(funcionarioId)}&order=data_pagamento.desc`)
    return API_BASE ? todos.filter(p => p.funcionario_id === funcionarioId) : todos
  },

  registrarPagamentoFuncionario: async (funcionario_id: string, valor: number, data_pagamento: string, tipo: PagamentoFuncionario['tipo'] = 'salario') => {
    return await readRemote<PagamentoFuncionario>(
      '/api/pagamentos-funcionario',
      'pagamentos_funcionario',
      { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ funcionario_id, valor, tipo, data_pagamento }) },
    ).then((result: any) => Array.isArray(result) ? result[0] : result)
  },

  excluirPagamentoFuncionario: async (id: string) => {
    await readRemote(`/api/pagamentos-funcionario/${id}`, `pagamentos_funcionario?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' })
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
