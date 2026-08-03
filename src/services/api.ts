const BASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const KEY      = process.env.NEXT_PUBLIC_SUPABASE_KEY!

const headers = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
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

export type Fornecedor = {
  id: string
  nome: string
  cnpj?: string | null
  criado_em?: string
}

export const PIPELINE = [
  { id: 'orcamento_aprovado',    label: 'Orçamento aprovado',  icon: '📋' },
  { id: 'em_tratativa',          label: 'Em tratativa',         icon: '🤝' },
  { id: 'orcamento_fechado',     label: 'Orçamento fechado',    icon: '✅' },
  { id: 'pagamento_realizado',   label: 'Pagamento realizado',  icon: '💰' },
  { id: 'entrega_programada',    label: 'Entrega programada',   icon: '📅' },
  { id: 'mercadoria_recebida',   label: 'Mercadoria recebida',  icon: '📦' },
  { id: 'nf_recebida',           label: 'NF recebida',          icon: '🧾' },
]

export const PIPELINE_LOCKED_FROM = 'orcamento_fechado'
export const PIPELINE_NF_FROM     = 'mercadoria_recebida'

export const fmtR    = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
export const fmtData = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')
export const fmtCNPJ = (v: string) => {
  const d = v.replace(/\D/g,'').slice(0,14)
  if (d.length <= 2) return d
  if (d.length <= 5) return `${d.slice(0,2)}.${d.slice(2)}`
  if (d.length <= 8) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5)}`
  if (d.length <= 12) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8)}`
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`
}

export const api = {
  categorias: async () => {
    const res = await fetch(`${BASE_URL}/rest/v1/categorias?order=nome.asc`, { headers })
    return res.json()
  },

  listar: async (f: { status_processo?: string; recorrente?: string } = {}) => {
    let query = `?order=criado_em.desc`
    if (f.status_processo) query += `&status_processo=eq.${f.status_processo}`
    if (f.recorrente)      query += `&recorrente=eq.${f.recorrente}`
    const res  = await fetch(`${BASE_URL}/rest/v1/lancamentos${query}`, { headers })
    const data = await res.json()
    if (!data?.length) return []
    return data.map((l: any) => ({ ...l, parcelas: [], itens: [] }))
  },

  buscar: async (id: string) => {
    const [lr, pr, ir] = await Promise.all([
      fetch(`${BASE_URL}/rest/v1/lancamentos?id=eq.${id}`, { headers }),
      fetch(`${BASE_URL}/rest/v1/parcelas?lancamento_id=eq.${id}&order=numero.asc`, { headers }),
      fetch(`${BASE_URL}/rest/v1/itens_lancamento?lancamento_id=eq.${id}&order=tipo.asc,criado_em.asc`, { headers }),
    ])
    const l        = (await lr.json())[0]
    const parcelas = await pr.json()
    const itens    = await ir.json()
    return { ...l, parcelas: parcelas||[], itens: itens||[] }
  },

  uploadArquivo: async (file: File): Promise<string> => {
    const ext  = file.name.split('.').pop() || 'pdf'
    const nome = `${Date.now()}.${ext}`
    await fetch(`${BASE_URL}/storage/v1/object/notas-fiscais/${nome}`, {
      method: 'POST',
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
      body: file,
    })
    return `${BASE_URL}/storage/v1/object/public/notas-fiscais/${nome}`
  },

  criar: async (payload: any) => {
    const { parcelas, itens, ...body } = payload
    body.pago_por = 'Servis Empreendimentos'
    const res  = await fetch(`${BASE_URL}/rest/v1/lancamentos`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(await res.text())
    const data = await res.json()
    const lanc = data[0]
    if (itens?.length) {
      await fetch(`${BASE_URL}/rest/v1/itens_lancamento`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify(itens.map((item: ItemLancamento) => ({
          lancamento_id: lanc.id, tipo: 'orcamento',
          nome: item.nome, quantidade: item.quantidade,
          valor_unitario: item.valor_unitario||0, valor_total: item.valor_total||0,
        }))),
      })
    }
    if (parcelas?.length) {
      await fetch(`${BASE_URL}/rest/v1/parcelas`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify(parcelas.map((p: Parcela) => ({ ...p, lancamento_id: lanc.id }))),
      })
    }
    return lanc
  },

  salvarItensNF: async (lancamento_id: string, itens: ItemLancamento[]) => {
    await fetch(`${BASE_URL}/rest/v1/itens_lancamento?lancamento_id=eq.${lancamento_id}&tipo=eq.nf`, {
      method: 'DELETE', headers,
    })
    if (!itens.length) return
    await fetch(`${BASE_URL}/rest/v1/itens_lancamento`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify(itens.map(i => ({
        lancamento_id, tipo: 'nf',
        nome: i.nome, quantidade: i.quantidade,
        valor_unitario: i.valor_unitario||0, valor_total: i.valor_total||0,
      }))),
    })
  },

  atualizarItem: async (id: string, body: Partial<ItemLancamento>) => {
    await fetch(`${BASE_URL}/rest/v1/itens_lancamento?id=eq.${id}`, {
      method: 'PATCH',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify(body),
    })
  },

  marcarPago: async (id: string) => {
    await fetch(`${BASE_URL}/rest/v1/parcelas?id=eq.${id}`, {
      method: 'PATCH',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify({ pago: true, data_pagamento: new Date().toISOString().slice(0,10) }),
    })
  },

  estornar: async (id: string) => {
    await fetch(`${BASE_URL}/rest/v1/parcelas?id=eq.${id}`, {
      method: 'PATCH',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify({ pago: false, data_pagamento: null }),
    })
  },

  buscarFornecedores: async (termo: string): Promise<Fornecedor[]> => {
    if (!termo || termo.length < 2) return []
    const res = await fetch(
      `${BASE_URL}/rest/v1/fornecedores?or=(nome.ilike.*${termo}*,cnpj.ilike.*${termo}*)&order=nome.asc&limit=8`,
      { headers }
    )
    return res.json()
  },

  listarFornecedores: async (): Promise<Fornecedor[]> => {
    const res = await fetch(`${BASE_URL}/rest/v1/fornecedores?order=nome.asc`, { headers })
    return res.json()
  },

  salvarFornecedor: async (nome: string, cnpj?: string) => {
    const res = await fetch(`${BASE_URL}/rest/v1/fornecedores?nome=ilike.${encodeURIComponent(nome)}&limit=1`, { headers })
    const existentes = await res.json()
    if (existentes?.length) {
      if (cnpj && !existentes[0].cnpj) {
        await fetch(`${BASE_URL}/rest/v1/fornecedores?id=eq.${existentes[0].id}`, {
          method: 'PATCH', headers: { ...headers, Prefer: 'return=minimal' },
          body: JSON.stringify({ cnpj }),
        })
      }
      return existentes[0]
    }
    const res2 = await fetch(`${BASE_URL}/rest/v1/fornecedores`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify({ nome, cnpj: cnpj||null }),
    })
    if (!res2.ok) throw new Error(await res2.text())
    const data = await res2.json()
    return data[0]
  },

  criarFornecedor: async (nome: string, cnpj?: string) => {
    const res = await fetch(`${BASE_URL}/rest/v1/fornecedores`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify({ nome, cnpj: cnpj||null }),
    })
    if (!res.ok) throw new Error(await res.text())
    const data = await res.json()
    return data[0]
  },

  atualizarFornecedor: async (id: string, body: { nome?: string; cnpj?: string | null }) => {
    const res = await fetch(`${BASE_URL}/rest/v1/fornecedores?id=eq.${id}`, {
      method: 'PATCH',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(await res.text())
  },

  excluirFornecedor: async (id: string) => {
    const res = await fetch(`${BASE_URL}/rest/v1/fornecedores?id=eq.${id}`, {
      method: 'DELETE', headers,
    })
    if (!res.ok) throw new Error(await res.text())
  },

  listarContasMensais: async () => {
    const res = await fetch(`${BASE_URL}/rest/v1/contas_mensais?order=titulo.asc`, { headers })
    const data = await res.json()
    return data||[]
  },

  criarContaMensal: async (payload: any) => {
    const { categoria_nome, ...body } = payload
    const res = await fetch(`${BASE_URL}/rest/v1/contas_mensais`, {
      method: 'POST', headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    return data[0]
  },

  toggleContaMensal: async (id: string, ativo: boolean) => {
    await fetch(`${BASE_URL}/rest/v1/contas_mensais?id=eq.${id}`, {
      method: 'PATCH', headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify({ ativo }),
    })
  },

  gerarLancamentoMensal: async (conta: ContaMensal, criado_por: string) => {
    const hoje = new Date()
    const data = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-${String(conta.dia_vencimento).padStart(2,'0')}`
    const res = await fetch(`${BASE_URL}/rest/v1/lancamentos`, {
      method: 'POST', headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify({
        titulo: conta.titulo, valor_total: 0, valor_original: 0, valor_produtos: 0, valor_frete: 0,
        data, pago_por: 'Servis Empreendimentos', tipo_pagamento: 'avista',
        recorrente: true, dia_vencimento: conta.dia_vencimento, criado_por,
        pago: false, status_processo: 'orcamento_aprovado',
      }),
    })
    const data2 = await res.json()
    return data2[0]
  },
}