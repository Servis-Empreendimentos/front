// Compara a planilha de controle da obra (aba "Pagamentos") com os dados do sistema.
// Tudo roda no navegador: nada da planilha é enviado para o servidor.
//
// Regras (as mesmas da conciliação feita à mão em nov/2026):
// - Cada linha da planilha é casada com no máximo um lançamento do sistema, escolhendo primeiro
//   os pares mais certos (mesmo fornecedor + mesmo valor + mesma NF + data próxima).
// - Linhas de folha (FUNCIONÁRIOS, SALÁRIO, FOLHA, ADIANTAMENTO) que não casam com lançamento
//   são comparadas, mês a mês, com a Folha do sistema.
// - Linhas de fornecedores que têm contrato por medição são comparadas com as medições.
// - Os valores do sistema seguem a Visão geral: só orçamentos fechados, "pago" igual ao card Valor pago.

import { isComprometido, valorPagoLancamento } from '../services/api'
import type { ContratoMedicao, Lancamento, PagamentoContaMensal, PagamentoFuncionario } from '../services/api'

export type LinhaPlanilha = {
  linha: number
  data: string | null       // AAAA-MM-DD
  vencimento: string | null
  dataPgto: string | null
  nf: string
  parcela: string
  prestador: string
  descricao: string
  total: number
  pago: number
}

export type TipoDiferenca =
  | 'Falta no sistema'
  | 'Falta no sistema (aluguel)'
  | 'Valor diferente'
  | 'Repetido na planilha'
  | 'No sistema, mas não fechado'
  | 'Só no sistema'
  | 'Folha do mês'
  | 'Contrato por medição'

export type ItemDiferenca = {
  mes: string               // AAAA-MM
  data: string | null
  linhaPlanilha: number | null
  linhas: number[]          // todas as linhas da planilha deste item (parcelas do mesmo lançamento)
  lancamentoId: string | null
  fornecedor: string
  descricao: string
  noSistema: string
  planilhaTotal: number
  sistemaTotal: number
  planilhaPago: number
  sistemaPago: number
  tipo: TipoDiferenca
}

export type ResumoMes = { mes: string; planilhaTotal: number; sistemaTotal: number; planilhaPago: number; sistemaPago: number }

export type ResultadoComparacao = {
  linhasLidas: number
  meses: ResumoMes[]
  itens: ItemDiferenca[]
  totais: ResumoMes
}

// ---------------------------------------------------------------- leitura da planilha

const semAcento = (v: unknown) => String(v ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toUpperCase()
const limpa = (v: unknown) => semAcento(v).replace(/[^A-Z0-9]+/g, ' ').trim()

function paraISO(v: unknown): string | null {
  if (v instanceof Date && !isNaN(v.getTime())) {
    const d = new Date(v.getTime() - v.getTimezoneOffset() * 60000)
    return d.toISOString().slice(0, 10)
  }
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    const d = new Date(Math.round((v - 25569) * 86400000))
    return d.toISOString().slice(0, 10)
  }
  const t = String(v ?? '').trim()
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (m) {
    const ano = m[3].length === 2 ? `20${m[3]}` : m[3]
    return `${ano}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10)
  return null
}

function paraNumero(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  const t = String(v ?? '').replace(/[R$\s]/g, '')
  if (!t) return 0
  const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t)
  return Number.isFinite(n) ? n : 0
}

export async function lerPlanilha(arquivo: File): Promise<LinhaPlanilha[]> {
  const XLSX = await import('xlsx')
  const livro = XLSX.read(await arquivo.arrayBuffer(), { type: 'array', cellDates: true })
  const nomeAba = livro.SheetNames.find(n => limpa(n) === 'PAGAMENTOS') || livro.SheetNames[0]
  const linhas = XLSX.utils.sheet_to_json<unknown[]>(livro.Sheets[nomeAba], { header: 1, raw: true, defval: null })
  const idxCab = linhas.findIndex(l => Array.isArray(l) && l.some(c => limpa(c) === 'PRESTADOR'))
  if (idxCab < 0) throw new Error('Não achei a aba "Pagamentos" com a coluna "Prestador" na planilha.')
  const cab = (linhas[idxCab] as unknown[]).map(limpa)
  const col = (...nomes: string[]) => cab.findIndex(c => nomes.some(n => c === n || c.startsWith(n)))
  const c = {
    n: col('N'), data: col('DATA'), nf: col('NOTA FISCAL'), parcela: col('PARCELA'), venc: col('VENCIMENTO'),
    prest: col('PRESTADOR'), desc: col('DESCRICAO'), total: col('VALOR TOTAL'), dpg: col('DATA PGTO'), pago: col('VALOR PAGO'),
  }
  const pega = (l: unknown[], i: number) => (i >= 0 ? l[i] : null)
  const out: LinhaPlanilha[] = []
  linhas.slice(idxCab + 1).forEach((l, i) => {
    if (!Array.isArray(l)) return
    const prest = String(pega(l, c.prest) ?? '').trim()
    const desc = String(pega(l, c.desc) ?? '').trim()
    const total = paraNumero(pega(l, c.total))
    const pago = paraNumero(pega(l, c.pago))
    if (!prest && !desc) return
    if (!total && !pago && pega(l, c.n) == null) return
    out.push({
      linha: idxCab + i + 2,
      data: paraISO(pega(l, c.data)),
      vencimento: paraISO(pega(l, c.venc)),
      dataPgto: paraISO(pega(l, c.dpg)),
      nf: String(pega(l, c.nf) ?? '').trim(),
      parcela: String(pega(l, c.parcela) ?? '').trim(),
      prestador: prest || desc,
      descricao: desc,
      total,
      pago,
    })
  })
  return out
}

// ---------------------------------------------------------------- comparação

const GENERICAS = new Set(['LTDA', 'ME', 'EPP', 'DE', 'DA', 'DO', 'DOS', 'DAS', 'E', 'EIRELI', 'SA', 'COMERCIO', 'PEDIDO', 'OBRA', 'IGREJA', 'SERVICOS', 'MATERIAIS', 'PARA', 'CONSTRUCAO', 'LOCACAO', 'EQUIPAMENTOS'])
// Nomes que aparecem diferentes na planilha e no sistema.
const APELIDOS: Record<string, string[]> = {
  PLUXEE: ['FUNCIONARIOS VALE ALIMENTACAO', 'VALE ALIMENTACAO'],
  'GBA SEGURANCA': ['G B A PRESTADORA', 'GBA'],
  'G B A': ['GBA SEGURANCA'],
  CIMENTAO: ['GALPAO BETIM', 'HORIZONTE DISTRIBUIDORA'],
  BLOJAF: ['GERABLOCOS'],
  'C C CONTROLE': ['MICROPOINT'],
  MICROPOINT: ['C C CONTROLE'],
  LIBANO: ['LIBANIO'],
  COFERMETA: ['COFERMENTA'],
  MAPIM: ['MAPIN'],
  PERICOM: ['PERICON'],
  'MINAS LOCC': ['MINAS LOOC'],
  ORIGINAL: ['ORIGINAL LOCACOES'],
}

function bigramas(t: string) {
  const m = new Map<string, number>()
  for (let i = 0; i < t.length - 1; i++) { const b = t.slice(i, i + 2); m.set(b, (m.get(b) || 0) + 1) }
  return m
}
function dice(a: string, b: string) {
  if (!a || !b) return 0
  if (a === b) return 1
  const A = bigramas(a), B = bigramas(b)
  let comum = 0
  A.forEach((n, k) => { comum += Math.min(n, B.get(k) || 0) })
  return (2 * comum) / (Math.max(1, a.length - 1) + Math.max(1, b.length - 1))
}
function sim0(a: string, b: string) {
  if (!a || !b) return 0
  const ta = a.split(' ').filter(t => !GENERICAS.has(t) && t.length > 2)
  const tb = new Set(b.split(' '))
  if (ta.length && tb.has(ta[0])) return 1
  if (ta.length && ta.filter(t => tb.has(t)).length / ta.length >= 0.5) return 0.9
  return dice(a, b.slice(0, a.length + 3))
}
const cacheSemelhanca = new Map<string, number>()
export function semelhanca(planilha: string, sistema: string) {
  const chave = `${planilha}\u0000${sistema}`
  const guardado = cacheSemelhanca.get(chave)
  if (guardado != null) return guardado
  const r = calcularSemelhanca(planilha, sistema)
  if (cacheSemelhanca.size > 200000) cacheSemelhanca.clear()
  cacheSemelhanca.set(chave, r)
  return r
}
function calcularSemelhanca(planilha: string, sistema: string) {
  const a = limpa(planilha), b = limpa(sistema)
  let r = sim0(a, b)
  Object.entries(APELIDOS).forEach(([k, vs]) => {
    if (a.startsWith(k)) vs.forEach(v => { r = Math.max(r, b.includes(v) ? 1 : sim0(v, b)) })
  })
  return r
}

const digitosNF = (v: unknown) => { const d = String(v ?? '').replace(/\D/g, '').replace(/^0+/, ''); return d.length >= 2 ? d : '' }
const centavos = (v: number) => Math.round(v * 100)
const dias = (a: string, b: string) => Math.abs((Date.parse(a) - Date.parse(b)) / 86400000)
const TOLERANCIA = 1
const mesDe = (d: string | null | undefined) => (d ? d.slice(0, 7) : 'sem data')

const ehFolha = (l: LinhaPlanilha) => /FUNCION|SALARIO|FOLHA|ADIANTAMENTO/.test(semAcento(l.prestador))
const ehAluguel = (l: LinhaPlanilha) => /ALUGUEL ALOJ/.test(semAcento(l.prestador))

export function comparar(
  planilha: LinhaPlanilha[],
  lancamentos: Lancamento[],
  pagamentosFolha: PagamentoFuncionario[],
  pagamentosMensais: PagamentoContaMensal[],
  contratos: ContratoMedicao[],
): ResultadoComparacao {
  const itens: ItemDiferenca[] = []
  const iguais: { mes: string; pt: number; st: number; pp: number; sp: number }[] = []
  const datasLinha = (l: LinhaPlanilha) => [l.data, l.vencimento, l.dataPgto].filter(Boolean) as string[]

  // 1) linhas de fornecedores com contrato por medição
  const contratoDaLinha = new Map<number, ContratoMedicao>()
  planilha.forEach(l => {
    if (ehFolha(l)) return
    const c = contratos.find(ct => ct.medicoes?.length && semelhanca(l.prestador, ct.titulo) >= 0.9)
    if (c) contratoDaLinha.set(l.linha, c)
  })

  // 2) casamento planilha x lançamentos
  type Cand = { sc: number; i: number; j: number; ve: boolean; d: number }
  const cands: Cand[] = []
  const lancs = lancamentos.map(l => {
    const vals = new Set([l.valor_total, l.valor_original || 0].filter(v => v).map(centavos))
    const nfs = new Set([l.nf_numero, ...(l.notas || []).map(n => n.numero)].map(digitosNF).filter(Boolean))
    const datas = [l.data, l.data_pagamento].filter(Boolean) as string[]
    return { l, vals, nfs, datas, nome: limpa(l.titulo) }
  })
  planilha.forEach((p, i) => {
    if (contratoDaLinha.has(p.linha)) return
    const sv = new Set([p.total, p.pago].filter(v => v).map(centavos))
    const snf = digitosNF(p.nf)
    const ds = datasLinha(p)
    lancs.forEach((x, j) => {
      const nm = semelhanca(p.prestador, x.l.titulo)
      const ve = Array.from(sv).some(v => x.vals.has(v))
      const vn = !ve && Array.from(sv).some(a => Array.from(x.vals).some(b => Math.abs(a - b) <= Math.max(100, 0.03 * a)))
      const nf = !!snf && x.nfs.has(snf)
      let d = 999
      ds.forEach(a => x.datas.forEach(b => { d = Math.min(d, dias(a, b)) }))
      const zero = x.vals.size === 0
      const ok = (nm >= 0.6 && (ve || nf || (vn && d <= 30) || (zero && d <= 5))) || (ve && nf) || (ve && d <= 3 && nm >= 0.4)
      if (!ok) return
      const sc = nm * 3 + (ve ? 3 : vn ? 1.5 : 0) + (nf ? 3 : 0) + 2 * Math.max(0, 1 - d / 30) + (zero && nm >= 0.6 ? 1 : 0)
      cands.push({ sc, i, j, ve, d })
    })
  })
  cands.sort((a, b) => b.sc - a.sc)
  const parDaLinha = new Map<number, number>()
  const linhasDoLanc = new Map<number, number[]>()
  cands.forEach(c => {
    if (parDaLinha.has(c.i) || linhasDoLanc.has(c.j)) return
    parDaLinha.set(c.i, c.j); linhasDoLanc.set(c.j, [c.i])
  })
  const distancia = (p: LinhaPlanilha, x: typeof lancs[number]) => {
    let d = 999
    datasLinha(p).forEach(a => x.datas.forEach(b => { d = Math.min(d, dias(a, b)) }))
    return d
  }
  const livre = (i: number) => !parDaLinha.has(i) && !contratoDaLinha.has(planilha[i].linha)

  // 2b) mesmo valor e data bem próxima, mesmo com nome escrito diferente
  //     (ex.: "BLOJAF" na planilha e "GERABLOCOS" no sistema)
  planilha.forEach((p, i) => {
    if (!livre(i) || ehFolha(p)) return
    const sv = [p.total, p.pago].filter(v => v >= 50).map(centavos)
    if (!sv.length) return
    let melhor = -1, md = 99
    lancs.forEach((x, j) => {
      if (linhasDoLanc.has(j) || !sv.some(v => x.vals.has(v))) return
      const d = distancia(p, x)
      if (d <= 5 && d < md) { md = d; melhor = j }
    })
    if (melhor >= 0) { parDaLinha.set(i, melhor); linhasDoLanc.set(melhor, [i]) }
  })
  // 2c) mesmo fornecedor e data bem próxima, com valor diferente: vira "valor diferente"
  //     em vez de aparecer duas vezes ("falta no sistema" + "só no sistema")
  planilha.forEach((p, i) => {
    if (!livre(i) || ehFolha(p)) return
    let melhor = -1, md = 99
    lancs.forEach((x, j) => {
      if (linhasDoLanc.has(j) || semelhanca(p.prestador, x.l.titulo) < 0.85) return
      const d = distancia(p, x)
      if (d <= 7 && d < md) { md = d; melhor = j }
    })
    if (melhor >= 0) { parDaLinha.set(i, melhor); linhasDoLanc.set(melhor, [i]) }
  })
  // 2d) parcelas: várias linhas da planilha (entrada, final, 2ª parcela...) para um lançamento só
  const PARCELA = /ENTRADA|FINAL|PARCELA|QUITACAO|SALDO|MEDICAO|50|\d+ ?\/ ?\d+/
  planilha.forEach((p, i) => {
    if (!livre(i) || ehFolha(p)) return
    const snf = digitosNF(p.nf)
    const ehParcela = PARCELA.test(semAcento(`${p.parcela} ${p.descricao}`))
    let melhor = -1, ms = 0
    lancs.forEach((x, j) => {
      const nm = semelhanca(p.prestador, x.l.titulo)
      if (nm < 0.7) return
      const nf = !!snf && x.nfs.has(snf)
      const d = distancia(p, x)
      const ok = (nf && d <= 365) || (ehParcela && nm >= 0.85 && d <= 120 && (p.total || p.pago) <= (x.l.valor_total || 0) + 0.005)
      if (!ok) return
      // mesma linha repetida (mesmo valor de uma linha já casada) fica como "Repetido na planilha"
      const v = p.total || p.pago
      if ((linhasDoLanc.get(j) || []).some(k => Math.abs((planilha[k].total || planilha[k].pago) - v) < 0.005)) return
      const sc = nm + (nf ? 2 : 0) - d / 365
      if (sc > ms) { ms = sc; melhor = j }
    })
    if (melhor >= 0) { parDaLinha.set(i, melhor); linhasDoLanc.set(melhor, [...(linhasDoLanc.get(melhor) || []), i]) }
  })

  // 3) linhas sem par: repetidas na própria planilha?
  const repetida = new Map<number, number>()
  planilha.forEach((p, i) => {
    if (parDaLinha.has(i) || contratoDaLinha.has(p.linha) || ehFolha(p)) return
    const v = p.total || p.pago
    if (!v) return
    const dsP = datasLinha(p)
    const a = digitosNF(p.nf)
    for (const [k, _] of Array.from(parDaLinha)) {
      const q = planilha[k]
      if (Math.abs((q.total || q.pago) - v) > 0.005 || semelhanca(p.prestador, q.prestador) < 0.7) continue
      let d = 999
      dsP.forEach(x => datasLinha(q).forEach(y => { d = Math.min(d, dias(x, y)) }))
      const b = digitosNF(q.nf)
      const pend = /PEND/.test(semAcento(p.nf)) || /PEND/.test(semAcento(q.nf))
      if ((a && a === b && d <= 60) || (pend && (a || b) && v >= 1000 && d <= 120) || (!a && !b && d <= 15 && !ehAluguel(p))) {
        repetida.set(i, k); break
      }
    }
  })

  // 4) monta a lista
  const fechado = (l: Lancamento) => isComprometido(l)
  const folhaPlanilha = new Map<string, { t: number; p: number }>()
  const contratoPlanilha = new Map<string, { t: number; p: number; nome: string }>()
  planilha.forEach((p, i) => {
    const mes = mesDe(p.data)
    const ct = contratoDaLinha.get(p.linha)
    if (ct) {
      const k = `${ct.id}|${mes}`
      const atual = contratoPlanilha.get(k) || { t: 0, p: 0, nome: ct.titulo }
      atual.t += p.total; atual.p += p.pago; contratoPlanilha.set(k, atual); return
    }
    const j = parDaLinha.get(i)
    const base = { mes, data: p.data, linhaPlanilha: p.linha, linhas: [p.linha], lancamentoId: null as string | null, fornecedor: p.prestador, descricao: p.descricao, planilhaTotal: p.total, planilhaPago: p.pago }
    if (j != null) {
      const grupo = linhasDoLanc.get(j) || [i]
      if (grupo[0] !== i) return // as outras parcelas entram junto com a primeira linha
      const l = lancamentos[j]
      const rows = grupo.map(k => planilha[k])
      const pt = rows.reduce((t, r) => t + r.total, 0), pp = rows.reduce((t, r) => t + r.pago, 0)
      const g = { ...base, linhas: rows.map(r => r.linha), lancamentoId: l.id, planilhaTotal: pt, planilhaPago: pp,
        descricao: rows.length > 1 ? `${rows.length} linhas da planilha (parcelas) para este lançamento` : p.descricao }
      if (!fechado(l)) { itens.push({ ...g, noSistema: `${l.titulo} (ainda não fechado)`, sistemaTotal: 0, sistemaPago: 0, tipo: 'No sistema, mas não fechado' }); return }
      const st = l.valor_total || 0, sp = valorPagoLancamento(l)
      // diferença de até R$ 1,00 é arredondamento: conta como igual
      if (Math.abs(pt - st) > TOLERANCIA || Math.abs(pp - sp) > TOLERANCIA) itens.push({ ...g, noSistema: l.titulo, sistemaTotal: st, sistemaPago: sp, tipo: 'Valor diferente' })
      else iguais.push({ mes, pt, st, pp, sp })
      return
    }
    if (repetida.has(i)) { itens.push({ ...base, noSistema: `igual à linha ${planilha[repetida.get(i)!].linha} da planilha`, sistemaTotal: 0, sistemaPago: 0, tipo: 'Repetido na planilha' }); return }
    if (ehFolha(p)) { const a = folhaPlanilha.get(mes) || { t: 0, p: 0 }; a.t += p.total; a.p += p.pago; folhaPlanilha.set(mes, a); return }
    itens.push({ ...base, noSistema: '', sistemaTotal: 0, sistemaPago: 0, tipo: ehAluguel(p) ? 'Falta no sistema (aluguel)' : 'Falta no sistema' })
  })
  lancamentos.forEach((l, j) => {
    if (linhasDoLanc.has(j) || !fechado(l)) return
    itens.push({ mes: mesDe(l.data), data: l.data, linhaPlanilha: null, linhas: [], lancamentoId: l.id, fornecedor: l.titulo, descricao: '', noSistema: l.titulo, planilhaTotal: 0, sistemaTotal: l.valor_total || 0, planilhaPago: 0, sistemaPago: valorPagoLancamento(l), tipo: 'Só no sistema' })
  })
  // folha por mês
  const folhaSistema = new Map<string, number>()
  pagamentosFolha.forEach(p => folhaSistema.set(mesDe(p.data_pagamento), (folhaSistema.get(mesDe(p.data_pagamento)) || 0) + (Number(p.valor) || 0)))
  new Set([...Array.from(folhaPlanilha.keys()), ...Array.from(folhaSistema.keys())]).forEach(mes => {
    const pl = folhaPlanilha.get(mes) || { t: 0, p: 0 }, si = folhaSistema.get(mes) || 0
    itens.push({ mes, data: null, linhaPlanilha: null, linhas: [], lancamentoId: null, fornecedor: 'Folha + adiantamento + 13º + FGTS do mês', descricao: '', noSistema: 'Folha de pagamento', planilhaTotal: pl.t, sistemaTotal: si, planilhaPago: pl.p, sistemaPago: si, tipo: 'Folha do mês' })
  })
  // contratos por medição, por mês
  const contratoSistema = new Map<string, { v: number; nome: string }>()
  contratos.forEach(ct => (ct.medicoes || []).forEach(m => {
    const k = `${ct.id}|${mesDe(m.data_medicao)}`
    const a = contratoSistema.get(k) || { v: 0, nome: ct.titulo }; a.v += Number(m.valor) || 0; contratoSistema.set(k, a)
  }))
  new Set([...Array.from(contratoPlanilha.keys()), ...Array.from(contratoSistema.keys())]).forEach(k => {
    const pl = contratoPlanilha.get(k), si = contratoSistema.get(k)
    itens.push({ mes: k.split('|')[1], data: null, linhaPlanilha: null, linhas: [], lancamentoId: null, fornecedor: `${(pl || si)!.nome} (contrato x medições)`, descricao: '', noSistema: 'Contratos por medição', planilhaTotal: pl?.t || 0, sistemaTotal: si?.v || 0, planilhaPago: pl?.p || 0, sistemaPago: si?.v || 0, tipo: 'Contrato por medição' })
  })
  // contas mensais pagas (entram no total geral do sistema)
  pagamentosMensais.forEach(p => itens.push({ mes: mesDe(p.data_pagamento), data: p.data_pagamento, linhaPlanilha: null, linhas: [], lancamentoId: null, fornecedor: 'Pagamento de conta mensal', descricao: '', noSistema: 'Contas mensais', planilhaTotal: 0, sistemaTotal: Number(p.valor) || 0, planilhaPago: 0, sistemaPago: Number(p.valor) || 0, tipo: 'Só no sistema' }))

  // 5) resumo por mês (os pares iguais entram só no resumo)
  const meses = new Map<string, ResumoMes>()
  const soma = (mes: string, pt: number, st: number, pp: number, sp: number) => {
    const m = meses.get(mes) || { mes, planilhaTotal: 0, sistemaTotal: 0, planilhaPago: 0, sistemaPago: 0 }
    m.planilhaTotal += pt; m.sistemaTotal += st; m.planilhaPago += pp; m.sistemaPago += sp; meses.set(mes, m)
  }
  iguais.forEach(x => soma(x.mes, x.pt, x.st, x.pp, x.sp))
  itens.forEach(x => soma(x.mes, x.planilhaTotal, x.sistemaTotal, x.planilhaPago, x.sistemaPago))
  const lista = Array.from(meses.values()).sort((a, b) => a.mes.localeCompare(b.mes))
  const totais = lista.reduce((t, m) => ({ mes: 'TOTAL', planilhaTotal: t.planilhaTotal + m.planilhaTotal, sistemaTotal: t.sistemaTotal + m.sistemaTotal, planilhaPago: t.planilhaPago + m.planilhaPago, sistemaPago: t.sistemaPago + m.sistemaPago }), { mes: 'TOTAL', planilhaTotal: 0, sistemaTotal: 0, planilhaPago: 0, sistemaPago: 0 })
  const diferente = (x: ItemDiferenca) => Math.abs(x.planilhaTotal - x.sistemaTotal) > TOLERANCIA || Math.abs(x.planilhaPago - x.sistemaPago) > TOLERANCIA
  return {
    linhasLidas: planilha.length,
    meses: lista,
    itens: itens.filter(diferente).sort((a, b) => a.mes.localeCompare(b.mes) || (a.data || '').localeCompare(b.data || '')),
    totais,
  }
}
