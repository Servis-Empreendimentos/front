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

export type Lancamento = {
  id: string
  titulo: string
  valor_total: number
  data: string
  categoria_id: string
  categoria_nome?: string
  pago_por: string
  tipo_pagamento: 'avista' | 'parcelado'
  status_entrega: 'pendente' | 'entregue'
  data_entrega?: string
  criado_por: string
  criado_em: string
  arquivo_url?: string
  pago: boolean
  data_pagamento?: string | null
  recorrente: boolean
  dia_vencimento?: number | null
  status_processo: string
  dias_entrega?: number | null
  data_entrega_programada?: string | null
  parcelas?: Parcela[]
}

export type ContaMensal = {
  id: string
  titulo: string
  categoria_id: string
  categoria_nome?: string
  pago_por: string
  dia_vencimento: number
  ativo: boolean
  criado_em: string
}

export const PIPELINE = [
  { id: 'orcamento_aprovado',    label: 'Orçamento aprovado',      icon: '📋' },
  { id: 'em_tratativa',          label: 'Em tratativa',             icon: '🤝' },
  { id: 'orcamento_fechado',     label: 'Orçamento fechado',        icon: '✅' },
  { id: 'pagamento_realizado',   label: 'Pagamento realizado',      icon: '💰' },
  { id: 'entrega_programada',    label: 'Entrega programada',       icon: '📅' },
  { id: 'mercadoria_recebida',   label: 'Mercadoria recebida',      icon: '📦' },
  { id: 'nf_recebida',           label: 'NF recebida',              icon: '🧾' },
]

export const fmtR    = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
export const fmtData = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')

export const api = {
  categorias: async () => {
    const res = await fetch(`${BASE_URL}/rest/v1/categorias?order=nome.asc`, { headers })
    return res.json()
  },

  listar: async (f: { status_entrega?: string; tipo_pagamento?: string; categoria_id?: string; recorrente?: string; status_processo?: string } = {}) => {
    let query = `?order=criado_em.desc&select=*,categorias(nome)`
    if (f.status_entrega)  query += `&status_entrega=eq.${f.status_entrega}`
    if (f.tipo_pagamento)  query += `&tipo_pagamento=eq.${f.tipo_pagamento}`
    if (f.categoria_id)    query += `&categoria_id=eq.${f.categoria_id}`
    if (f.recorrente)      query += `&recorrente=eq.${f.recorrente}`
    if (f.status_processo) query += `&status_processo=eq.${f.status_processo}`
    const res  = await fetch(`${BASE_URL}/rest/v1/lancamentos${query}`, { headers })
    const data = await res.json()
    const lista = (data || []).map((l: any) => ({ ...l, categoria_nome: l.categorias?.nome }))
    if (!lista.length) return []
    const ids = lista.map((l: any) => l.id).join(',')
    const res2 = await fetch(`${BASE_URL}/rest/v1/parcelas?lancamento_id=in.(${ids})&order=numero.asc`, { headers })
    const parcelas = await res2.json()
    const map: Record<string, any[]> = {}
    for (const p of parcelas || []) { if (!map[p.lancamento_id]) map[p.lancamento_id] = []; map[p.lancamento_id].push(p) }
    return lista.map((l: any) => ({ ...l, parcelas: map[l.id] || [] }))
  },

  buscar: async (id: string) => {
    const res  = await fetch(`${BASE_URL}/rest/v1/lancamentos?id=eq.${id}&select=*,categorias(nome)`, { headers })
    const data = await res.json()
    const l    = data[0]
    const res2 = await fetch(`${BASE_URL}/rest/v1/parcelas?lancamento_id=eq.${id}&order=numero.asc`, { headers })
    const parcelas = await res2.json()
    return { ...l, categoria_nome: l.categorias?.nome, parcelas: parcelas || [] }
  },

  uploadPDF: async (file: File): Promise<string> => {
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
    const { parcelas, categoria_nome, ...body } = payload
    const res  = await fetch(`${BASE_URL}/rest/v1/lancamentos`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    const lanc = data[0]
    if (parcelas?.length) {
      await fetch(`${BASE_URL}/rest/v1/parcelas`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify(parcelas.map((p: Parcela) => ({ ...p, lancamento_id: lanc.id }))),
      })
    }
    return lanc
  },

  confirmarEntrega: async (id: string) => {
    await fetch(`${BASE_URL}/rest/v1/lancamentos?id=eq.${id}`, {
      method: 'PATCH',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify({ status_entrega: 'entregue', data_entrega: new Date().toISOString().slice(0, 10) }),
    })
  },

  marcarPago: async (id: string) => {
    await fetch(`${BASE_URL}/rest/v1/parcelas?id=eq.${id}`, {
      method: 'PATCH',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify({ pago: true, data_pagamento: new Date().toISOString().slice(0, 10) }),
    })
  },

  estornar: async (id: string) => {
    await fetch(`${BASE_URL}/rest/v1/parcelas?id=eq.${id}`, {
      method: 'PATCH',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify({ pago: false, data_pagamento: null }),
    })
  },

  listarContasMensais: async () => {
    const res = await fetch(`${BASE_URL}/rest/v1/contas_mensais?order=titulo.asc&select=*,categorias(nome)`, { headers })
    const data = await res.json()
    return (data || []).map((c: any) => ({ ...c, categoria_nome: c.categorias?.nome }))
  },

  criarContaMensal: async (payload: any) => {
    const { categoria_nome, ...body } = payload
    const res = await fetch(`${BASE_URL}/rest/v1/contas_mensais`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    return data[0]
  },

  toggleContaMensal: async (id: string, ativo: boolean) => {
    await fetch(`${BASE_URL}/rest/v1/contas_mensais?id=eq.${id}`, {
      method: 'PATCH',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify({ ativo }),
    })
  },

  gerarLancamentoMensal: async (conta: ContaMensal, criado_por: string) => {
    const hoje = new Date()
    const data = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-${String(conta.dia_vencimento).padStart(2,'0')}`
    const res = await fetch(`${BASE_URL}/rest/v1/lancamentos`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify({
        titulo: conta.titulo,
        valor_total: 0,
        data,
        categoria_id: conta.categoria_id,
        pago_por: conta.pago_por,
        tipo_pagamento: 'avista',
        recorrente: true,
        dia_vencimento: conta.dia_vencimento,
        criado_por,
        pago: false,
        status_processo: 'orcamento_aprovado',
      }),
    })
    const data2 = await res.json()
    return data2[0]
  },
}