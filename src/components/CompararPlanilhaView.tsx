'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { api, fmtR } from '../services/api'
import { ACCENT, ACCENT_LT, s } from '../lib/theme'
import { comparar, lerPlanilha, type ItemDiferenca, type ResultadoComparacao, type TipoDiferenca } from '../lib/compararPlanilha'
import { exportarExcel, dataExcel, valorExcel } from '../lib/exportarExcel'
import { KPI, PageHeader } from './ui'
import Icon from './Icon'

export type AbaDestino = 'folha' | 'contratos' | 'mensais'
type Props = {
  notify: (msg: string, ok?: boolean) => void
  onAbrirLancamento: (id: string) => void
  onNovoLancamento: (dados: { titulo: string; data: string | null; valor: number }) => void
  onIrPara: (aba: AbaDestino) => void
}

// Guarda a última comparação enquanto o sistema está aberto, para não perder
// o resultado ao ir corrigir um lançamento em outra tela e voltar.
type Memoria = { res: ResultadoComparacao | null; arquivo: string; file: File | null; medida: Medida; fMes: string; fTipo: string; busca: string }
let memoria: Memoria = { res: null, arquivo: '', file: null, medida: 'pago', fMes: '', fTipo: '', busca: '' }

type Acao = { rotulo: string; fazer: () => void } | null
type Medida = 'pago' | 'total'

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const rotuloMes = (m: string) => (/^\d{4}-\d{2}$/.test(m) ? `${MESES[Number(m.slice(5)) - 1]}/${m.slice(2, 4)}` : m)
const dataBR = (d: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : '')

const EXPLICA: Record<TipoDiferenca, string> = {
  'Falta no sistema': 'Está na planilha e não foi lançado no sistema.',
  'Falta no sistema (aluguel)': 'Aluguel de alojamento que está na planilha e não no sistema.',
  'Valor diferente': 'O mesmo pagamento está nos dois, mas com valor diferente.',
  'Repetido na planilha': 'A mesma compra aparece duas vezes na planilha; o sistema tem uma.',
  'No sistema, mas não fechado': 'Está no sistema como orçamento aprovado ou em tratativa, por isso não entra no total.',
  'Só no sistema': 'Está no sistema e não está na planilha.',
  'Folha do mês': 'Soma da folha do mês na planilha comparada com a Folha de pagamento do sistema.',
  'Contrato por medição': 'Linhas do fornecedor na planilha comparadas com as medições lançadas no contrato.',
}

export default function CompararPlanilhaView({ notify, onAbrirLancamento, onNovoLancamento, onIrPara }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [arquivo, setArquivo] = useState(memoria.arquivo)
  const [carregando, setCarregando] = useState(false)
  const [res, setRes] = useState<ResultadoComparacao | null>(memoria.res)
  const [medida, setMedida] = useState<Medida>(memoria.medida)
  const [fMes, setFMes] = useState(memoria.fMes)
  const [fTipo, setFTipo] = useState(memoria.fTipo)
  const [busca, setBusca] = useState(memoria.busca)
  useEffect(() => { memoria = { ...memoria, res, arquivo, medida, fMes, fTipo, busca } }, [res, arquivo, medida, fMes, fTipo, busca])

  const acaoDo = (i: ItemDiferenca): Acao => {
    if (i.lancamentoId) return { rotulo: 'Abrir no sistema', fazer: () => onAbrirLancamento(i.lancamentoId!) }
    if (i.tipo === 'Falta no sistema' || i.tipo === 'Falta no sistema (aluguel)')
      return { rotulo: 'Lançar no sistema', fazer: () => onNovoLancamento({ titulo: [i.fornecedor, i.descricao].filter(Boolean).join(' - '), data: i.data, valor: i.planilhaTotal || i.planilhaPago }) }
    if (i.tipo === 'Folha do mês') return { rotulo: 'Abrir a Folha', fazer: () => onIrPara('folha') }
    if (i.tipo === 'Contrato por medição') return { rotulo: 'Abrir contratos', fazer: () => onIrPara('contratos') }
    if (i.noSistema === 'Contas mensais') return { rotulo: 'Abrir contas mensais', fazer: () => onIrPara('mensais') }
    return null
  }

  const processar = async (file: File) => {
    setCarregando(true); setRes(null); setFMes(''); setFTipo('')
    try {
      const [linhas, lancamentos, notas, folha, mensais, contratos] = await Promise.all([
        lerPlanilha(file),
        api.listar({}),
        api.listarNotas(),
        api.listarPagamentosFuncionarios(),
        api.listarPagamentosMensais(),
        api.listarContratosMedicao(),
      ])
      if (!linhas.length) throw new Error('A aba Pagamentos da planilha está vazia.')
      const comNotas = lancamentos.map(l => ({ ...l, notas: notas.filter(n => n.lancamento_id === l.id) }))
      // deixa a tela mostrar "Comparando..." antes do cálculo, que leva alguns segundos
      await new Promise(r => setTimeout(r, 30))
      setRes(comparar(linhas, comNotas, folha, mensais, contratos))
      setArquivo(file.name)
      memoria.file = file
    } catch (e: any) {
      notify(e?.message || 'Não consegui ler a planilha.', false)
    } finally {
      setCarregando(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const pl = (x: { planilhaPago: number; planilhaTotal: number }) => (medida === 'pago' ? x.planilhaPago : x.planilhaTotal)
  const si = (x: { sistemaPago: number; sistemaTotal: number }) => (medida === 'pago' ? x.sistemaPago : x.sistemaTotal)

  const itensFiltrados = useMemo(() => {
    if (!res) return []
    const q = busca.trim().toLowerCase()
    return res.itens.filter(i =>
      (!fMes || i.mes === fMes) &&
      (!fTipo || i.tipo === fTipo) &&
      (!q || `${i.fornecedor} ${i.descricao} ${i.noSistema}`.toLowerCase().includes(q)) &&
      Math.abs(pl(i) - si(i)) > 0.005,
    )
  }, [res, fMes, fTipo, busca, medida])

  const tipos = useMemo(() => (res ? Array.from(new Set(res.itens.map(i => i.tipo))) : []), [res])

  const exportar = () => {
    if (!res) return
    exportarExcel('diferenca-planilha-x-sistema', [
      {
        nome: 'Resumo por mês',
        linhas: [...res.meses, res.totais].map(m => ({
          'Mês': m.mes === 'TOTAL' ? 'TOTAL' : rotuloMes(m.mes),
          'Planilha (pago)': valorExcel(m.planilhaPago), 'Sistema (pago)': valorExcel(m.sistemaPago), 'Diferença (pago)': valorExcel(m.planilhaPago - m.sistemaPago),
          'Planilha (total)': valorExcel(m.planilhaTotal), 'Sistema (total)': valorExcel(m.sistemaTotal), 'Diferença (total)': valorExcel(m.planilhaTotal - m.sistemaTotal),
        })),
      },
      {
        nome: 'O que está diferente',
        linhas: res.itens.map(i => ({
          'Mês': rotuloMes(i.mes), 'Data': dataExcel(i.data), 'Linha da planilha': i.linhas.join(', '),
          'Fornecedor': i.fornecedor, 'Descrição': i.descricao, 'No sistema': i.noSistema,
          'Planilha (pago)': valorExcel(i.planilhaPago), 'Sistema (pago)': valorExcel(i.sistemaPago), 'Diferença (pago)': valorExcel(i.planilhaPago - i.sistemaPago),
          'Planilha (total)': valorExcel(i.planilhaTotal), 'Sistema (total)': valorExcel(i.sistemaTotal), 'Diferença (total)': valorExcel(i.planilhaTotal - i.sistemaTotal),
          'O que é': i.tipo,
        })),
      },
    ])
  }

  const corDif = (v: number) => (Math.abs(v) < 0.005 ? '#7D7D7D' : v > 0 ? '#C99A4B' : '#626262')
  const th: React.CSSProperties = { textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#7D7D7D', textTransform: 'uppercase', letterSpacing: '.06em', padding: '10px 12px', borderBottom: '1px solid #E2E6E4', background: '#FAFBFA', whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { fontSize: 12.5, padding: '9px 12px', borderBottom: '1px solid #EEF1EF', color: '#626262', verticalAlign: 'top' }
  const num: React.CSSProperties = { ...td, textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }

  return (
    <div>
      <PageHeader eyebrow="Financeiro" title="Comparar com a planilha" description="Escolha a planilha de controle da obra. O sistema lê a aba Pagamentos e mostra, mês a mês, o que está diferente dos lançamentos daqui.">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {res && <button onClick={exportar} style={s.btnOut}><Icon name="download" size={14} color="#626262" /> Exportar Excel</button>}
          {res && memoria.file && <button onClick={() => memoria.file && processar(memoria.file)} disabled={carregando} style={s.btnOut} title="Compara a mesma planilha de novo, já com o que você corrigiu no sistema"><Icon name="refresh" size={14} color="#626262" /> Comparar de novo</button>}
          <button onClick={() => inputRef.current?.click()} disabled={carregando} style={{ ...s.btnTeal, opacity: carregando ? 0.7 : 1 }}>
            <Icon name="upload" size={14} color="#fff" /> {carregando ? 'Comparando…' : res ? 'Escolher outra planilha' : 'Escolher planilha'}
          </button>
          <input ref={inputRef} type="file" accept=".xlsx,.xls,.xlsm" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) processar(f) }} />
        </div>
      </PageHeader>

      {!res && !carregando && (
        <div style={{ ...s.card, padding: '2.2rem 1.5rem', textAlign: 'center' }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#626262', margin: 0 }}>Nenhuma planilha escolhida</p>
          <p style={{ fontSize: 12.5, color: '#7D7D7D', margin: '6px 0 16px' }}>A planilha fica só no seu computador. Nada dela é gravado no sistema.</p>
          <button onClick={() => inputRef.current?.click()} style={{ ...s.btnTeal, margin: '0 auto' }}><Icon name="upload" size={14} color="#fff" /> Escolher planilha</button>
        </div>
      )}
      {carregando && <div style={{ ...s.card, padding: '2rem', textAlign: 'center', fontSize: 13, color: '#7D7D7D' }}>Lendo a planilha e comparando com o sistema… pode levar alguns segundos.</div>}

      {res && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: '#7D7D7D' }}>{arquivo} · {res.linhasLidas} linhas lidas · comparar pelo</span>
            {(['pago', 'total'] as Medida[]).map(m => (
              <button key={m} onClick={() => setMedida(m)} style={{ ...s.btnOut, padding: '.38rem .75rem', background: medida === m ? '#E8F0EC' : '#fff', borderColor: medida === m ? ACCENT : '#DDE3E0' }}>
                {m === 'pago' ? 'Valor pago' : 'Valor total'}
              </button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14, marginBottom: '1.35rem' }}>
            <KPI l={`Planilha (${medida})`} v={fmtR(pl(res.totais))} c={ACCENT} />
            <KPI l={`Sistema (${medida})`} v={fmtR(si(res.totais))} sv="Total geral da Visão geral" c={ACCENT_LT} />
            <KPI l="Diferença" v={fmtR(pl(res.totais) - si(res.totais))} sv="positivo = tem mais na planilha" c="#C99A4B" />
          </div>

          <div>
            <div style={s.card}>
              <div style={s.toolbar}><span style={{ fontSize: 13, fontWeight: 700 }}>Por mês</span><span style={{ fontSize: 11, color: '#7D7D7D' }}>clique num mês para ver o que forma a diferença</span></div>
              <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
                <thead><tr><th style={th}>Mês</th><th style={{ ...th, textAlign: 'right' }}>Planilha</th><th style={{ ...th, textAlign: 'right' }}>Sistema</th><th style={{ ...th, textAlign: 'right' }}>Diferença</th></tr></thead>
                <tbody>
                  {res.meses.map(m => {
                    const d = pl(m) - si(m), ativo = fMes === m.mes
                    return (
                      <tr key={m.mes} onClick={() => setFMes(ativo ? '' : m.mes)} style={{ cursor: 'pointer', background: ativo ? '#E8F0EC' : undefined }}>
                        <td style={{ ...td, fontWeight: 700 }}>{rotuloMes(m.mes)}</td>
                        <td style={num}>{fmtR(pl(m))}</td>
                        <td style={num}>{fmtR(si(m))}</td>
                        <td style={{ ...num, fontWeight: 700, color: corDif(d) }}>{fmtR(d)}</td>
                      </tr>
                    )
                  })}
                  <tr style={{ background: '#FAFBFA' }}>
                    <td style={{ ...td, fontWeight: 800 }}>Total</td>
                    <td style={{ ...num, fontWeight: 700 }}>{fmtR(pl(res.totais))}</td>
                    <td style={{ ...num, fontWeight: 700 }}>{fmtR(si(res.totais))}</td>
                    <td style={{ ...num, fontWeight: 800, color: corDif(pl(res.totais) - si(res.totais)) }}>{fmtR(pl(res.totais) - si(res.totais))}</td>
                  </tr>
                </tbody>
              </table></div>
            </div>

            <div style={s.card}>
              <div style={s.toolbar}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>O que está diferente{fMes ? ` em ${rotuloMes(fMes)}` : ''}</span>
                <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar fornecedor" style={{ ...s.inp, minWidth: 160 }} />
                <select value={fTipo} onChange={e => setFTipo(e.target.value)} style={s.inp}>
                  <option value="">Todos os tipos</option>
                  {tipos.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                {(fMes || fTipo || busca) && <button onClick={() => { setFMes(''); setFTipo(''); setBusca('') }} style={{ ...s.btnOut, padding: '.38rem .7rem' }}>Limpar filtros</button>}
                <span style={{ marginLeft: 'auto', fontSize: 12, color: '#7D7D7D' }}>
                  {itensFiltrados.length} itens · soma {fmtR(itensFiltrados.reduce((t, i) => t + pl(i) - si(i), 0))}
                </span>
              </div>
              <div style={{ overflowX: 'auto', maxHeight: '68vh', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
                  <thead style={{ position: 'sticky', top: 0 }}><tr>
                    <th style={th}>Data</th><th style={th}>Fornecedor</th><th style={{ ...th, textAlign: 'right' }}>Planilha</th><th style={{ ...th, textAlign: 'right' }}>Sistema</th><th style={{ ...th, textAlign: 'right' }}>Diferença</th><th style={th}>O que é</th><th style={th}></th>
                  </tr></thead>
                  <tbody>
                    {itensFiltrados.map((i, k) => <Linha key={k} i={i} pl={pl(i)} si={si(i)} td={td} num={num} cor={corDif(pl(i) - si(i))} acao={acaoDo(i)} />)}
                    {!itensFiltrados.length && <tr><td colSpan={7} style={{ ...td, textAlign: 'center', padding: '1.6rem', color: '#7D7D7D' }}>Nada diferente com esses filtros.</td></tr>}
                  </tbody>
                </table>
              </div>
              {fMes && (
                <p style={{ fontSize: 11.5, color: '#7D7D7D', padding: '10px 14px', margin: 0, borderTop: '1px solid #EEF1EF' }}>
                  A soma dos itens deste mês é igual à diferença do mês na tabela de cima (os pagamentos iguais nos dois não aparecem na lista).
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Linha({ i, pl, si, td, num, cor, acao }: { i: ItemDiferenca; pl: number; si: number; td: React.CSSProperties; num: React.CSSProperties; cor: string; acao: Acao }) {
  const [sobre, setSobre] = useState(false)
  return (
    <tr onClick={acao?.fazer} onMouseEnter={() => setSobre(true)} onMouseLeave={() => setSobre(false)}
      style={{ cursor: acao ? 'pointer' : 'default', background: acao && sobre ? '#F4F8F6' : undefined }}
      title={acao ? `${acao.rotulo} · ${EXPLICA[i.tipo]}` : EXPLICA[i.tipo]}>
      <td style={{ ...td, whiteSpace: 'nowrap' }}>{i.data ? dataBR(i.data) : rotuloMes(i.mes)}{i.linhas.length ? <div style={{ fontSize: 10.5, color: '#969696' }}>{i.linhas.length > 1 ? 'linhas' : 'linha'} {i.linhas.join(', ')}</div> : null}</td>
      <td style={td}>
        <div style={{ fontWeight: 600 }}>{i.fornecedor}</div>
        {i.descricao && <div style={{ fontSize: 11, color: '#969696' }}>{i.descricao}</div>}
        {i.noSistema && i.tipo !== 'Só no sistema' && i.tipo !== 'Folha do mês' && i.tipo !== 'Contrato por medição' && <div style={{ fontSize: 11, color: '#748F84' }}>no sistema: {i.noSistema}</div>}
      </td>
      <td style={num}>{fmtR(pl)}</td>
      <td style={num}>{fmtR(si)}</td>
      <td style={{ ...num, fontWeight: 700, color: cor }}>{fmtR(pl - si)}</td>
      <td style={td}><span style={{ ...s.badge, background: '#F1F5F3', color: '#626262' }}>{i.tipo}</span></td>
      <td style={{ ...td, whiteSpace: 'nowrap' }}>
        {acao
          ? <button onClick={e => { e.stopPropagation(); acao.fazer() }} style={{ ...s.btnOut, padding: '.34rem .65rem', fontSize: 11.5 }}>{acao.rotulo} <Icon name="chevronRight" size={12} color="#626262" /></button>
          : i.tipo === 'Repetido na planilha' ? <span style={{ fontSize: 11, color: '#969696' }}>corrigir na planilha</span> : null}
      </td>
    </tr>
  )
}
