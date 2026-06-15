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
  parcelas?: Parcela[]
}

export const fmtR    = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
export const fmtData = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')

export const api = {
  categorias: async () => {
    const res = await fetch(`${BASE_URL}/rest/v1/categorias?order=nome.asc`, { headers })
    return res.json()
  },

  listar: async (f: { status_entrega?: string; tipo_pagamento?: string; categoria_id?: string; recorrente?: string } = {}) => {
    let query = `?order=criado_em.desc&select=*,categorias(nome)`
    if (f.status_entrega) query += `&status_entrega=eq.${f.status_entrega}`
    if (f.tipo_pagamento) query += `&tipo_pagamento=eq.${f.tipo_pagamento}`
    if (f.categoria_id)   query += `&categoria_id=eq.${f.categoria_id}`
    if (f.recorrente)     query += `&recorrente=eq.${f.recorrente}`
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
    const nome = `${Date.now()}_${file.name}`
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
}