import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE, lerToken } from '../../../../lib/auth'
import { SupabaseErro, supabaseServidor } from '../../../../lib/supabaseServer'

export const dynamic = 'force-dynamic'

// Notas fiscais de um orçamento ([id] = id do lançamento). Um orçamento pode ter várias notas.
// - POST   /api/notas/[id]            lança uma nota nova (qualquer perfil, inclusive o usuário da obra)
// - PUT    /api/notas/[id]?nota=ID    edita uma nota já lançada (somente gestora)
// - DELETE /api/notas/[id]?nota=ID    exclui uma nota (somente gestora)
// Com "atualizar_valores", o valor dos itens, o frete, o total e o saldo do orçamento
// passam a ser a soma de todas as notas dele (os pagamentos já feitos são mantidos).
// Depois de cada mudança, os campos-resumo do lançamento (arquivo_url, nf_numero, tipo_nf)
// são refeitos a partir das notas, para as listas e filtros continuarem funcionando.

type LancamentoNF = {
  id: string
  arquivo_url: string | null
  tipo_nf: string | null
  nf_numero: string | null
  criado_em: string | null
  valor_total: number | null
  valor_desconto: number | null
  tem_desconto: boolean | null
  saldo_devedor: number | null
  pago: boolean | null
  data_pagamento: string | null
}

type Nota = { id: string; numero: string | null; tipo: string; arquivo_url: string | null; valor_frete: number; valor_itens: number; valor_total: number; criado_em: string }
type ItemEntrada = { nome?: unknown; quantidade?: unknown; unidade_medida?: unknown; valor_unitario?: unknown; valor_total?: unknown }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const LEGADO = 'legado' // nota antiga gravada só nos campos do lançamento (antes da tabela notas_fiscais)
const centavos = (v: number) => Math.round(v * 100) / 100
const numero = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : NaN)
const hojeBrasilia = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
const erro = (detail: string, status: number) => NextResponse.json({ detail }, { status })
const SO_GESTORA = 'Somente a gestora pode editar ou excluir uma nota fiscal já lançada.'

type Contexto = { params: { id: string } }

async function sessaoValida(request: NextRequest) {
  const sessao = await lerToken(request.cookies.get(SESSION_COOKIE)?.value)
  if (!sessao) return { resposta: erro('Sessão expirada. Entre novamente.', 401) }
  return { sessao }
}

export async function POST(request: NextRequest, { params }: Contexto) {
  const { sessao, resposta } = await sessaoValida(request)
  if (!sessao) return resposta
  if (!UUID.test(params.id)) return erro('Lançamento inválido', 400)
  const dados = await lerDados(request)
  if ('resposta' in dados) return dados.resposta
  if (!dados.arquivo_url) return erro('Anexe o arquivo da nota fiscal.', 400)
  if (dados.atualizar_valores && sessao.role !== 'gestora') return erro('Somente a gestora pode alterar os valores do orçamento.', 403)

  try {
    const lancamento = await carregarLancamento(params.id)
    if (!lancamento) return erro('Lançamento não encontrado', 404)
    await migrarNotaLegada(lancamento)
    const criada = await supabaseServidor<Nota[]>('notas_fiscais', {
      method: 'POST', headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ lancamento_id: params.id, numero: dados.numero, tipo: dados.tipo, arquivo_url: dados.arquivo_url, valor_frete: dados.valor_frete, valor_itens: dados.valor_itens, valor_total: centavos(dados.valor_itens + dados.valor_frete), criado_por: sessao.nome }),
    })
    const nota = criada?.[0]
    if (!nota) throw new Error('O banco não retornou a nota criada')
    await gravarItens(params.id, nota.id, dados.itens)
    await atualizarResumo(lancamento, dados.atualizar_valores)
    return NextResponse.json({ ok: true, nota_id: nota.id })
  } catch (e) { return falha(e) }
}

export async function PUT(request: NextRequest, { params }: Contexto) {
  const { sessao, resposta } = await sessaoValida(request)
  if (!sessao) return resposta
  if (sessao.role !== 'gestora') return erro(SO_GESTORA, 403)
  if (!UUID.test(params.id)) return erro('Lançamento inválido', 400)
  const dados = await lerDados(request)
  if ('resposta' in dados) return dados.resposta

  try {
    const lancamento = await carregarLancamento(params.id)
    if (!lancamento) return erro('Lançamento não encontrado', 404)
    const notaId = await resolverNota(request, lancamento)
    if (!notaId) return erro('Nota fiscal não encontrada neste orçamento.', 404)
    const patch: Record<string, unknown> = { numero: dados.numero, tipo: dados.tipo, valor_frete: dados.valor_frete, valor_itens: dados.valor_itens, valor_total: centavos(dados.valor_itens + dados.valor_frete) }
    if (dados.arquivo_url) patch.arquivo_url = dados.arquivo_url
    await supabaseServidor(`notas_fiscais?id=eq.${notaId}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(patch) })
    await supabaseServidor(`itens_lancamento?nota_id=eq.${notaId}`, { method: 'DELETE' })
    await gravarItens(params.id, notaId, dados.itens)
    await atualizarResumo(lancamento, dados.atualizar_valores)
    return NextResponse.json({ ok: true, nota_id: notaId })
  } catch (e) { return falha(e) }
}

export async function DELETE(request: NextRequest, { params }: Contexto) {
  const { sessao, resposta } = await sessaoValida(request)
  if (!sessao) return resposta
  if (sessao.role !== 'gestora') return erro(SO_GESTORA, 403)
  if (!UUID.test(params.id)) return erro('Lançamento inválido', 400)
  try {
    const lancamento = await carregarLancamento(params.id)
    if (!lancamento) return erro('Lançamento não encontrado', 404)
    const notaId = await resolverNota(request, lancamento)
    if (!notaId) return erro('Nota fiscal não encontrada neste orçamento.', 404)
    await supabaseServidor(`itens_lancamento?nota_id=eq.${notaId}`, { method: 'DELETE' })
    await supabaseServidor(`notas_fiscais?id=eq.${notaId}`, { method: 'DELETE' })
    await atualizarResumo(lancamento, request.nextUrl.searchParams.get('atualizar_valores') === 'true')
    return NextResponse.json({ ok: true })
  } catch (e) { return falha(e) }
}

// ---------- validação ----------

async function lerDados(request: NextRequest) {
  let body: any
  try { body = await request.json() } catch { return { resposta: erro('Dados inválidos', 400) } }
  const tipo = body?.tipo_nf
  if (tipo !== 'produto' && tipo !== 'servico') return { resposta: erro('Informe se a nota é de produto ou de serviço.', 400) }
  const numeroNF = typeof body?.nf_numero === 'string' && body.nf_numero.trim() ? body.nf_numero.trim().slice(0, 60) : null
  const valor_frete = body?.valor_frete === undefined || body?.valor_frete === null ? 0 : numero(body.valor_frete)
  if (!Number.isFinite(valor_frete) || valor_frete < 0) return { resposta: erro('Valor do frete inválido.', 400) }
  const arquivo_url = typeof body?.arquivo_url === 'string' && /^https?:\/\//.test(body.arquivo_url) ? body.arquivo_url : null
  if (!Array.isArray(body?.itens)) return { resposta: erro('Itens da nota inválidos.', 400) }
  if (body.itens.length > 500) return { resposta: erro('A nota tem itens demais.', 400) }

  const itens: { nome: string; quantidade: number; unidade_medida: string; valor_unitario: number; valor_total: number }[] = []
  const brutos = body.itens as ItemEntrada[]
  for (let i = 0; i < brutos.length; i++) {
    const bruto = brutos[i]
    const nome = typeof bruto?.nome === 'string' ? bruto.nome.trim() : ''
    const quantidade = numero(bruto?.quantidade)
    const valor_unitario = bruto?.valor_unitario === undefined || bruto?.valor_unitario === null ? 0 : numero(bruto.valor_unitario)
    const valor_total = bruto?.valor_total === undefined || bruto?.valor_total === null ? quantidade * valor_unitario : numero(bruto.valor_total)
    if (!nome) return { resposta: erro(`Item ${i + 1}: informe a descrição.`, 400) }
    if (!Number.isFinite(quantidade) || quantidade <= 0) return { resposta: erro(`Item ${i + 1}: quantidade inválida.`, 400) }
    if (!Number.isFinite(valor_unitario) || valor_unitario < 0 || !Number.isFinite(valor_total) || valor_total < 0) return { resposta: erro(`Item ${i + 1}: valor inválido.`, 400) }
    const unidade = typeof bruto?.unidade_medida === 'string' && bruto.unidade_medida.trim() ? bruto.unidade_medida.trim().slice(0, 20) : 'Un'
    itens.push({ nome: nome.slice(0, 300), quantidade, unidade_medida: unidade, valor_unitario: centavos(valor_unitario), valor_total: centavos(valor_total) })
  }
  return {
    tipo, numero: numeroNF, valor_frete: centavos(valor_frete), arquivo_url, itens,
    valor_itens: centavos(itens.reduce((s, item) => s + item.valor_total, 0)),
    atualizar_valores: body?.atualizar_valores === true,
  }
}

// ---------- banco ----------

async function carregarLancamento(id: string) {
  const lancamentos = await supabaseServidor<LancamentoNF[]>(`lancamentos?select=id,arquivo_url,tipo_nf,nf_numero,criado_em,valor_total,valor_desconto,tem_desconto,saldo_devedor,pago,data_pagamento&id=eq.${id}`)
  return lancamentos?.[0]
}

async function listarNotas(lancamentoId: string) {
  return (await supabaseServidor<Nota[]>(`notas_fiscais?select=id,numero,tipo,arquivo_url,valor_frete,valor_itens,valor_total,criado_em&lancamento_id=eq.${lancamentoId}&order=criado_em.asc`)) || []
}

// Antes da tabela notas_fiscais, a nota ficava só nos campos do lançamento. Na primeira mudança
// ela vira uma linha da tabela nova, com os itens de NF que já existiam.
async function migrarNotaLegada(l: LancamentoNF) {
  const notas = await listarNotas(l.id)
  if (notas.length) return null
  const soltos = await supabaseServidor<{ id: string; valor_total: number | null }[]>(`itens_lancamento?select=id,valor_total&lancamento_id=eq.${l.id}&tipo=eq.nf&nota_id=is.null`)
  if (!l.arquivo_url && !l.tipo_nf && !soltos?.length) return null
  const valor_itens = centavos((soltos || []).reduce((s, i) => s + Number(i.valor_total || 0), 0))
  const criada = await supabaseServidor<Nota[]>('notas_fiscais', {
    method: 'POST', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ lancamento_id: l.id, numero: l.nf_numero, tipo: l.tipo_nf === 'servico' ? 'servico' : 'produto', arquivo_url: l.arquivo_url, valor_frete: 0, valor_itens, valor_total: valor_itens, criado_em: l.criado_em || undefined }),
  })
  const nota = criada?.[0]
  if (nota && soltos?.length) await supabaseServidor(`itens_lancamento?lancamento_id=eq.${l.id}&tipo=eq.nf&nota_id=is.null`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ nota_id: nota.id }) })
  return nota?.id || null
}

async function resolverNota(request: NextRequest, l: LancamentoNF) {
  const nota = request.nextUrl.searchParams.get('nota') || ''
  if (nota === LEGADO) return migrarNotaLegada(l)
  if (!UUID.test(nota)) return null
  const achadas = await supabaseServidor<{ id: string }[]>(`notas_fiscais?select=id&id=eq.${nota}&lancamento_id=eq.${l.id}`)
  return achadas?.[0]?.id || null
}

async function gravarItens(lancamentoId: string, notaId: string, itens: { nome: string; quantidade: number; unidade_medida: string; valor_unitario: number; valor_total: number }[]) {
  if (!itens.length) return
  await supabaseServidor('itens_lancamento', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(itens.map(i => ({ ...i, lancamento_id: lancamentoId, nota_id: notaId, tipo: 'nf' }))) })
}

// Refaz o resumo do lançamento a partir das notas e, se pedido, os valores do orçamento.
async function atualizarResumo(l: LancamentoNF, atualizarValores: boolean) {
  const notas = await listarNotas(l.id)
  const ultima = notas[notas.length - 1]
  const comArquivo = notas.filter(n => n.arquivo_url)
  const numeros = notas.map(n => n.numero).filter(Boolean).join(', ')
  const patch: Record<string, unknown> = {
    arquivo_url: comArquivo.length ? comArquivo[comArquivo.length - 1].arquivo_url : null,
    nf_numero: numeros ? numeros.slice(0, 250) : null,
    tipo_nf: ultima ? ultima.tipo : null,
  }

  if (atualizarValores && notas.length) {
    const valor_produtos = centavos(notas.reduce((s, n) => s + Number(n.valor_itens || 0), 0))
    const valor_frete = centavos(notas.reduce((s, n) => s + Number(n.valor_frete || 0), 0))
    const desconto = l.tem_desconto ? Number(l.valor_desconto || 0) : 0
    const base = centavos(valor_produtos + valor_frete)
    if (desconto > 0 && desconto >= base) throw new SupabaseErro('O desconto do orçamento é maior que o valor das notas. Remova o desconto antes.', 400)
    const novoTotal = centavos(base - desconto)
    const totalAtual = Number(l.valor_total || 0)
    const saldoAtual = l.pago ? 0 : (typeof l.saldo_devedor === 'number' && l.saldo_devedor > 0 ? Math.min(l.saldo_devedor, totalAtual) : totalAtual)
    const jaPago = Math.max(0, totalAtual - saldoAtual)
    const novoSaldo = centavos(Math.max(0, novoTotal - jaPago))
    Object.assign(patch, { valor_produtos, valor_frete, valor_original: base, valor_total: novoTotal, saldo_devedor: novoSaldo })
    if (l.pago && novoSaldo > 0) patch.pago = false
    if (!l.pago && jaPago > 0 && novoSaldo === 0) {
      patch.pago = true
      if (!l.data_pagamento) patch.data_pagamento = hojeBrasilia()
    }
  }
  await supabaseServidor(`lancamentos?id=eq.${l.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(patch) })
}

function falha(e: unknown) {
  if (e instanceof SupabaseErro) {
    if (/notas_fiscais|nota_id/.test(e.message) && (e.status === 404 || /does not exist|schema cache|Could not find/i.test(e.message))) {
      return erro('O banco ainda não tem a tabela de notas fiscais. Rode o arquivo notas-fiscais.sql no Supabase (SQL Editor) e tente de novo.', 503)
    }
    return erro(e.message, e.status >= 500 ? 502 : e.status)
  }
  return erro(`Não foi possível salvar a nota: ${(e as Error)?.message || 'erro desconhecido'}`, 502)
}

