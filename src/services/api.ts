const BASE = process.env.NEXT_PUBLIC_API_URL!

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
  parcelas?: Parcela[]
}

export const fmtR    = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
export const fmtData = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')

const call = async (path: string, opts?: RequestInit) => {
  const res = await fetch(`${BASE}${path}`, opts)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export const api = {
  categorias:       ()           => call('/api/categorias'),
  listar: (f: { status_entrega?: string; tipo_pagamento?: string; categoria_id?: string } = {}) => {
    const p = new URLSearchParams()
    if (f.status_entrega) p.set('status_entrega', f.status_entrega)
    if (f.tipo_pagamento) p.set('tipo_pagamento', f.tipo_pagamento)
    if (f.categoria_id)   p.set('categoria_id',   f.categoria_id)
    return call(`/api/lancamentos?${p}`)
  },
  buscar:           (id: string) => call(`/api/lancamentos/${id}`),
  criar:            (body: any)  => call('/api/lancamentos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  confirmarEntrega: (id: string) => call(`/api/lancamentos/${id}/entrega`, { method: 'PATCH' }),
  marcarPago:       (id: string) => call(`/api/parcelas/${id}/pagar`,      { method: 'PATCH' }),
  estornar:         (id: string) => call(`/api/parcelas/${id}/estornar`,   { method: 'PATCH' }),
}
