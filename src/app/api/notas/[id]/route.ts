import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE, lerToken } from '../../../../lib/auth'
import { SupabaseErro, supabaseServidor } from '../../../../lib/supabaseServer'

export const dynamic = 'force-dynamic'

// Salva a nota fiscal de um lançamento: tipo (produto/serviço), número, frete e itens.
// - Primeiro lançamento da nota: gestora ou lançadora.
// - Edição de uma nota já lançada: somente a gestora.
// Com "atualizar_valores", os valores do lançamento (itens, frete, total e saldo) passam a ser os da nota.

type LancamentoNF = {
  id: string
  arquivo_url: string | null
  tipo_nf: string | null
  nf_numero: string | null
  valor_total: number | null
  valor_frete: number | null
  valor_desconto: number | null
  tem_desconto: boolean | null
  saldo_devedor: number | null
  pago: boolean | null
  data_pagamento: string | null
}

type ItemEntrada = { nome?: unknown; quantidade?: unknown; unidade_medida?: unknown; valor_unitario?: unknown; valor_total?: unknown }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const centavos = (v: number) => Math.round(v * 100) / 100
const numero = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : NaN)
const hojeBrasilia = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
const erro = (detail: string, status: number) => NextResponse.json({ detail }, { status })

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const sessao = await lerToken(request.cookies.get(SESSION_COOKIE)?.value)
  if (!sessao) return erro('Sessão expirada. Entre novamente.', 401)
  if (sessao.role === 'entregador') return erro('Seu perfil não tem permissão para esta ação.', 403)
  if (!UUID.test(params.id)) return erro('Lançamento inválido', 400)

  let body: any
  try { body = await request.json() } catch { return erro('Dados inválidos', 400) }

  // Validação dos dados da nota
  const tipo_nf = body?.tipo_nf
  if (tipo_nf !== 'produto' && tipo_nf !== 'servico') return erro('Informe se a nota é de produto ou de serviço.', 400)
  const nf_numero = typeof body?.nf_numero === 'string' ? body.nf_numero.trim().slice(0, 60) : ''
  const valor_frete = body?.valor_frete === undefined || body?.valor_frete === null ? 0 : numero(body.valor_frete)
  if (!Number.isFinite(valor_frete) || valor_frete < 0) return erro('Valor do frete inválido.', 400)
  const arquivo_url = typeof body?.arquivo_url === 'string' && /^https?:\/\//.test(body.arquivo_url) ? body.arquivo_url : null
  if (!Array.isArray(body?.itens)) return erro('Itens da nota inválidos.', 400)
  if (body.itens.length > 500) return erro('A nota tem itens demais.', 400)

  const itens = []
  const brutos = body.itens as ItemEntrada[]
  for (let i = 0; i < brutos.length; i++) {
    const bruto = brutos[i]
    const nome = typeof bruto?.nome === 'string' ? bruto.nome.trim() : ''
    const quantidade = numero(bruto?.quantidade)
    const valor_unitario = bruto?.valor_unitario === undefined || bruto?.valor_unitario === null ? 0 : numero(bruto.valor_unitario)
    const valor_total = bruto?.valor_total === undefined || bruto?.valor_total === null ? quantidade * valor_unitario : numero(bruto.valor_total)
    if (!nome) return erro(`Item ${i + 1}: informe a descrição.`, 400)
    if (!Number.isFinite(quantidade) || quantidade <= 0) return erro(`Item ${i + 1}: quantidade inválida.`, 400)
    if (!Number.isFinite(valor_unitario) || valor_unitario < 0 || !Number.isFinite(valor_total) || valor_total < 0) return erro(`Item ${i + 1}: valor inválido.`, 400)
    const unidade = typeof bruto?.unidade_medida === 'string' && bruto.unidade_medida.trim() ? bruto.unidade_medida.trim().slice(0, 20) : 'Un'
    itens.push({ lancamento_id: params.id, tipo: 'nf', nome: nome.slice(0, 300), quantidade, unidade_medida: unidade, valor_unitario: centavos(valor_unitario), valor_total: centavos(valor_total) })
  }

  try {
    const { lancamento, itensNF } = await carregar(params.id)
    if (!lancamento) return erro('Lançamento não encontrado', 404)

    const jaLancada = notaJaLancada(lancamento, itensNF)
    if (jaLancada && sessao.role !== 'gestora') return erro('Somente a gestora pode editar uma nota fiscal já lançada.', 403)
    if (!jaLancada && !arquivo_url) return erro('Anexe o arquivo da nota fiscal.', 400)

    const patch: Record<string, unknown> = { tipo_nf, nf_numero: nf_numero || null, valor_frete: centavos(valor_frete) }
    if (arquivo_url) patch.arquivo_url = arquivo_url

    // Na edição a gestora pode levar os valores da nota para o lançamento (total e saldo devedor).
    if (body?.atualizar_valores === true) {
      const valor_produtos = centavos(itens.reduce((s, item) => s + item.valor_total, 0))
      const desconto = lancamento.tem_desconto ? Number(lancamento.valor_desconto || 0) : 0
      const base = centavos(valor_produtos + valor_frete)
      if (desconto > 0 && desconto >= base) return erro('O desconto do lançamento é maior que o novo valor da nota. Remova o desconto antes.', 400)
      const novoTotal = centavos(base - desconto)
      const totalAtual = Number(lancamento.valor_total || 0)
      const saldoAtual = lancamento.pago ? 0 : (typeof lancamento.saldo_devedor === 'number' && lancamento.saldo_devedor > 0 ? Math.min(lancamento.saldo_devedor, totalAtual) : totalAtual)
      const jaPago = Math.max(0, totalAtual - saldoAtual)
      const novoSaldo = centavos(Math.max(0, novoTotal - jaPago))
      Object.assign(patch, { valor_produtos, valor_original: base, valor_total: novoTotal, saldo_devedor: novoSaldo })
      if (lancamento.pago && novoSaldo > 0) patch.pago = false
      if (!lancamento.pago && jaPago > 0 && novoSaldo === 0) {
        patch.pago = true
        if (!lancamento.data_pagamento) patch.data_pagamento = hojeBrasilia()
      }
    }

    const id = encodeURIComponent(params.id)
    await supabaseServidor(`lancamentos?id=eq.${id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(patch) })
    await supabaseServidor(`itens_lancamento?lancamento_id=eq.${id}&tipo=eq.nf`, { method: 'DELETE' })
    if (itens.length) await supabaseServidor('itens_lancamento', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(itens) })

    return NextResponse.json({ ok: true, editada: jaLancada })
  } catch (e) { return falha(e) }
}

async function carregar(id: string) {
  const enc = encodeURIComponent(id)
  const [lancamentos, itensNF] = await Promise.all([
    supabaseServidor<LancamentoNF[]>(`lancamentos?select=id,arquivo_url,tipo_nf,nf_numero,valor_total,valor_frete,valor_desconto,tem_desconto,saldo_devedor,pago,data_pagamento&id=eq.${enc}`),
    supabaseServidor<{ id: string }[]>(`itens_lancamento?select=id&lancamento_id=eq.${enc}&tipo=eq.nf&limit=1`),
  ])
  return { lancamento: lancamentos?.[0], itensNF: itensNF || [] }
}

// Uma nota conta como lançada quando já tem arquivo, tipo ou itens de NF gravados.
function notaJaLancada(l: LancamentoNF, itensNF: unknown[]) {
  return Boolean(l.arquivo_url || l.tipo_nf || itensNF.length > 0)
}

function falha(e: unknown) {
  if (e instanceof SupabaseErro) return erro(e.message, e.status >= 500 ? 502 : e.status)
  return erro(`Não foi possível salvar a nota: ${(e as Error)?.message || 'erro desconhecido'}`, 502)
}
