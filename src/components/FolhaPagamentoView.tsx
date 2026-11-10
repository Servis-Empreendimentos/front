'use client'

import { useEffect, useState } from 'react'
import Icon from './Icon'
import { KPI, Badge } from './ui'
import { api, Funcionario, PagamentoFuncionario, Obra, fmtData, fmtR, mascaraMoeda, parseMoeda, moedaParaCampo } from '../services/api'
import { ACCENT, ACCENT_LT, s } from '../lib/theme'

type FolhaView = 'lista' | 'grade'

type Props = {
  funcionarios: Funcionario[]
  pagamentos: PagamentoFuncionario[]
  obras: Obra[]
  searchFuncionario: string
  setSearchFuncionario: (value: string) => void
  viewFolha: FolhaView
  setViewFolha: (value: FolhaView) => void
  onNovoFuncionario: () => void
  onEditarFuncionario: (funcionario: Funcionario) => void
  onImportarHolerite: () => void
  onPagar: (funcionario: Funcionario, dataSugerida?: string) => void
  onHistorico: (funcionario: Funcionario) => void
  onAtualizar: () => void
  notify: (msg: string, ok?: boolean) => void
}

const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
const monthName = (date: Date) => date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)
const shortMonthName = (date: Date) => `${date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}/${String(date.getFullYear()).slice(2)}`

const TIPO_LABEL: Record<PagamentoFuncionario['tipo'], string> = {
  salario: 'Salário',
  adiantamento: 'Adiantamento',
  decimo_terceiro: '13º salário',
  vale: 'Vale',
  outro: 'Outro',
}

const TH = {padding:'9px 10px',fontSize:10,fontWeight:800,color:'#969696',textTransform:'uppercase' as const,letterSpacing:'.08em',borderBottom:'1px solid #E2E6E4',whiteSpace:'nowrap' as const}

function buildMonths() {
  return Array.from({ length: 12 }).map((_, index) => {
    const date = new Date()
    date.setDate(1)
    date.setMonth(date.getMonth() - (11 - index))
    return { key: monthKey(date), label: shortMonthName(date), year: date.getFullYear(), month: date.getMonth() + 1 }
  })
}

export default function FolhaPagamentoView({
  funcionarios,
  pagamentos,
  obras,
  searchFuncionario,
  setSearchFuncionario,
  viewFolha,
  setViewFolha,
  onNovoFuncionario,
  onEditarFuncionario,
  onImportarHolerite,
  onPagar,
  onHistorico,
  onAtualizar,
  notify,
}: Props) {
  const hoje = new Date()
  const mesAtual = monthKey(hoje)
  const mesAtualNome = monthName(hoje)
  const meses = buildMonths()
  const [detalhe, setDetalhe] = useState<{ funcionario: Funcionario | null; key: string; label: string; date: string } | null>(null)
  const [excluindo, setExcluindo] = useState<string | null>(null)
  const [editando, setEditando] = useState<{ id: string; valor: string; tipo: PagamentoFuncionario['tipo']; data: string } | null>(null)
  const [salvandoEdicao, setSalvandoEdicao] = useState(false)
  const [resumoTodos, setResumoTodos] = useState(false)

  useEffect(() => { setEditando(null) }, [detalhe])
  useEffect(() => {
    if (!detalhe) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      if (editando) setEditando(null)
      else setDetalhe(null)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [detalhe, editando])
  const nomeFuncionario = (id: string) => funcionarios.find(f => f.id === id)?.nome || 'Funcionário removido'
  const nomeObra = (obraId?: string | null) => obraId ? (obras.find(o => o.id === obraId)?.nome || '—') : 'Sem obra'
  const filtered = funcionarios.filter(f => {
    if (!searchFuncionario) return true
    const q = searchFuncionario.toLowerCase()
    return f.nome.toLowerCase().includes(q) || (f.cargo || '').toLowerCase().includes(q) || nomeObra(f.obra_id).toLowerCase().includes(q)
  })
  const ativos = funcionarios.filter(f => f.ativo)
  const pagamentosDoMes = pagamentos.filter(p => p.data_pagamento.startsWith(mesAtual))
  const funcionariosPagosNoMes = new Set(pagamentosDoMes.map(p => p.funcionario_id))
  const totalAdiantamentoMes = pagamentosDoMes.filter(p => p.tipo === 'adiantamento').reduce((total, p) => total + p.valor, 0)
  const totalFolhaMes = pagamentosDoMes.filter(p => p.tipo === 'salario').reduce((total, p) => total + p.valor, 0)
  const totalDecimoTerceiroMes = pagamentosDoMes.filter(p => p.tipo === 'decimo_terceiro').reduce((total, p) => total + p.valor, 0)
  const totalFolhaBase = ativos.reduce((total, f) => total + f.salario_base, 0)
  const semPagamentoNoMes = ativos.filter(f => !funcionariosPagosNoMes.has(f.id)).length

  const ultimoPagamento = (funcionarioId: string) => pagamentos.filter(p => p.funcionario_id === funcionarioId).reduce<PagamentoFuncionario | undefined>((ultimo, p) => !ultimo || p.data_pagamento > ultimo.data_pagamento ? p : ultimo, undefined)
  const totalPagoNoMes = (funcionarioId: string, key: string) => {
    const pagos = pagamentos.filter(p => p.funcionario_id === funcionarioId && p.data_pagamento.startsWith(key))
    return pagos.length ? pagos.reduce((total, p) => total + p.valor, 0) : null
  }

  type ResumoMes = { key: string; adiantamento: number; salario: number; decimo: number; outros: number; total: number; funcAdiant: Set<string>; funcSalario: Set<string> }
  const resumoMap = new Map<string, ResumoMes>()
  const novoResumo = (key: string): ResumoMes => ({ key, adiantamento: 0, salario: 0, decimo: 0, outros: 0, total: 0, funcAdiant: new Set(), funcSalario: new Set() })
  meses.forEach(m => resumoMap.set(m.key, novoResumo(m.key)))
  pagamentos.forEach(p => {
    const key = (p.data_pagamento || '').slice(0, 7)
    if (!/^\d{4}-\d{2}$/.test(key)) return
    const r = resumoMap.get(key) || novoResumo(key)
    resumoMap.set(key, r)
    if (p.tipo === 'adiantamento') { r.adiantamento += p.valor; r.funcAdiant.add(p.funcionario_id) }
    else if (p.tipo === 'salario') { r.salario += p.valor; r.funcSalario.add(p.funcionario_id) }
    else if (p.tipo === 'decimo_terceiro') r.decimo += p.valor
    else r.outros += p.valor
    r.total += p.valor
  })
  const resumoMeses = Array.from(resumoMap.values()).sort((a, b) => b.key.localeCompare(a.key))
  const resumoVisivel = resumoTodos ? resumoMeses : resumoMeses.slice(0, 12)
  const temDecimo = resumoMeses.some(r => r.decimo > 0)
  const temOutros = resumoMeses.some(r => r.outros > 0)
  const mesesLancados = resumoMeses.filter(r => r.total > 0).length
  const labelMes = (key: string) => { const [y, m] = key.split('-').map(Number); return cap(monthName(new Date(y, m - 1, 1))) }

  const pagamentosDetalhe = detalhe
    ? pagamentos.filter(p => (!detalhe.funcionario || p.funcionario_id === detalhe.funcionario.id) && p.data_pagamento.startsWith(detalhe.key)).sort((a, b) => a.data_pagamento.localeCompare(b.data_pagamento) || nomeFuncionario(a.funcionario_id).localeCompare(nomeFuncionario(b.funcionario_id)))
    : []
  const totalDetalhe = pagamentosDetalhe.reduce((total, p) => total + p.valor, 0)
  const porTipoDetalhe = Object.entries(pagamentosDetalhe.reduce<Record<string, number>>((acc, p) => { acc[p.tipo] = (acc[p.tipo] || 0) + p.valor; return acc }, {}))
  const funcionariosPagosDetalhe = new Set(pagamentosDetalhe.map(p => p.funcionario_id)).size
  const ultimoAntesDetalhe = detalhe?.funcionario
    ? pagamentos.filter(p => p.funcionario_id === detalhe.funcionario!.id && p.data_pagamento < `${detalhe.key}-01`).reduce<PagamentoFuncionario | undefined>((ultimo, p) => !ultimo || p.data_pagamento > ultimo.data_pagamento ? p : ultimo, undefined)
    : undefined

  const editarPagamento = (p: PagamentoFuncionario) => setEditando({ id: p.id, valor: moedaParaCampo(p.valor), tipo: p.tipo, data: p.data_pagamento.slice(0, 10) })

  const salvarEdicao = async () => {
    if (!editando) return
    const valor = parseMoeda(editando.valor)
    if (valor <= 0) return notify('Informe um valor maior que zero', false)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(editando.data)) return notify('Informe a data do pagamento', false)
    setSalvandoEdicao(true)
    try {
      await api.atualizarPagamentoFuncionario(editando.id, { valor, tipo: editando.tipo, data_pagamento: editando.data })
      const mudouMes = detalhe && !editando.data.startsWith(detalhe.key)
      notify(mudouMes ? `Pagamento atualizado e movido para ${labelMes(editando.data.slice(0, 7)).toLowerCase()}` : 'Pagamento atualizado!')
      setEditando(null)
      onAtualizar()
    } catch (err: any) {
      notify('Erro ao salvar: ' + (err?.message || 'tente novamente'), false)
    } finally {
      setSalvandoEdicao(false)
    }
  }

  const excluirPagamento = async (p: PagamentoFuncionario) => {
    if (!confirm(`Excluir o pagamento de ${fmtR(p.valor)} (${TIPO_LABEL[p.tipo] || p.tipo}) de ${fmtData(p.data_pagamento)}?`)) return
    setExcluindo(p.id)
    try {
      await api.excluirPagamentoFuncionario(p.id)
      notify('Pagamento excluído!')
      onAtualizar()
    } catch (err: any) {
      notify('Erro ao excluir: ' + (err?.message || 'tente novamente'), false)
    } finally {
      setExcluindo(null)
    }
  }

  const statusFuncionario = (f: Funcionario) => {
    if (!f.ativo) return { label: 'Inativo', bg: '#EDF0EE', color: '#7D7D7D' }
    if (funcionariosPagosNoMes.has(f.id)) return { label: 'Pago neste mês', bg: '#E8F0EB', color: ACCENT_LT }
    return { label: 'Pendente este mês', bg: '#F1F4F2', color: '#626262' }
  }

  return (
    <div>
      <div style={s.row}>
        <div>
          <p className="workspace-eyebrow" style={{ marginBottom: 7 }}>Financeiro</p>
          <h1 style={s.h1}>Folha de pagamento</h1>
          <p style={s.p}>Importe adiantamentos e folhas mensais separadamente — cada pagamento fica vinculado ao colaborador e à competência correta.</p>
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',justifyContent:'flex-end'}}>
          <button onClick={onImportarHolerite} style={s.btnOut}><Icon name="upload" size={14}/> Importar holerite</button>
          <button onClick={onNovoFuncionario} style={s.btnTeal}><Icon name="plus" size={14} color="#fff"/> Cadastrar funcionário</button>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:12,marginBottom:'1.35rem'}}>
        <KPI l="Funcionários ativos" v={ativos.length} sv="na folha" c={ACCENT_LT}/>
        <KPI l="Folha base mensal" v={fmtR(totalFolhaBase)} sv="soma dos salários" c="#7D7D7D"/>
        <KPI l="Adiantamentos" v={fmtR(totalAdiantamentoMes)} sv={mesAtualNome} c="#8BA59A"/>
        <KPI l="Folha mensal" v={fmtR(totalFolhaMes)} sv={mesAtualNome} c="#748F84"/>
        <KPI l="13º salário" v={fmtR(totalDecimoTerceiroMes)} sv={mesAtualNome} c="#8BA59A"/>
        <KPI l="Sem pagamento este mês" v={semPagamentoNoMes} sv="ainda pendente" c="#748F84"/>
      </div>

      <div style={{...s.card,marginBottom:'1.35rem'}}>
        <div style={{...s.toolbar,justifyContent:'space-between'}}>
          <div>
            <p style={{fontSize:12,fontWeight:800,color:'#626262',margin:0}}>Resumo por mês</p>
            <p style={{fontSize:11,color:'#969696',margin:'3px 0 0'}}>Valores somados pela data de pagamento · {mesesLancados} {mesesLancados === 1 ? 'mês lançado' : 'meses lançados'} · clique num mês para editar ou excluir os pagamentos</p>
          </div>
          {resumoMeses.length > 12 && <button onClick={()=>setResumoTodos(v=>!v)} style={{...s.btnOut,padding:'.4rem .75rem',fontSize:11}}>{resumoTodos ? 'Mostrar últimos 12 meses' : `Mostrar todos (${resumoMeses.length})`}</button>}
        </div>
        <div style={{overflowX:'auto',padding:'0 1.2rem 1.1rem'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,minWidth:560}}>
            <thead><tr>
              <th style={{...TH,textAlign:'left'}}>Mês</th>
              <th style={{...TH,textAlign:'right'}}>Adiantamento</th>
              <th style={{...TH,textAlign:'right'}}>Folha mensal</th>
              {temDecimo && <th style={{...TH,textAlign:'right'}}>13º salário</th>}
              {temOutros && <th style={{...TH,textAlign:'right'}}>Vales e outros</th>}
              <th style={{...TH,textAlign:'right'}}>Total do mês</th>
            </tr></thead>
            <tbody>{resumoVisivel.map(r=>{
              const vazio = (v: number, n?: number) => v > 0
                ? <><span style={{fontWeight:800,color:'#626262'}}>{fmtR(v)}</span>{n !== undefined && <span style={{display:'block',fontSize:10,color:'#969696',marginTop:2}}>{n} funcionário{n !== 1 ? 's' : ''}</span>}</>
                : <span style={{fontSize:11,color:'#C4CECA',fontWeight:700}}>Não lançado</span>
              return <tr key={r.key} onClick={()=>setDetalhe({funcionario:null,key:r.key,label:labelMes(r.key),date:`${r.key}-05`})} title="Clique para ver, editar ou excluir os pagamentos deste mês" style={{borderBottom:'1px solid #EEF1EF',background:r.key===mesAtual?'#F6F8F7':undefined,cursor:'pointer'}} onMouseEnter={e=>(e.currentTarget.style.background='#F1F4F2')} onMouseLeave={e=>(e.currentTarget.style.background=r.key===mesAtual?'#F6F8F7':'')}>
                <td style={{padding:'9px 10px',fontWeight:800,color:'#626262',whiteSpace:'nowrap'}}>{labelMes(r.key)}{r.key===mesAtual && <span style={{fontSize:10,fontWeight:700,color:ACCENT_LT,textTransform:'none',marginLeft:6}}>mês atual</span>}</td>
                <td style={{padding:'9px 10px',textAlign:'right'}}>{vazio(r.adiantamento, r.funcAdiant.size)}</td>
                <td style={{padding:'9px 10px',textAlign:'right'}}>{vazio(r.salario, r.funcSalario.size)}</td>
                {temDecimo && <td style={{padding:'9px 10px',textAlign:'right',color:r.decimo?'#626262':'#C4CECA',fontWeight:r.decimo?800:700}}>{r.decimo ? fmtR(r.decimo) : '—'}</td>}
                {temOutros && <td style={{padding:'9px 10px',textAlign:'right',color:r.outros?'#626262':'#C4CECA',fontWeight:r.outros?800:700}}>{r.outros ? fmtR(r.outros) : '—'}</td>}
                <td style={{padding:'9px 10px',textAlign:'right',fontWeight:800,color:r.total?ACCENT_LT:'#C4CECA'}}>{r.total ? fmtR(r.total) : '—'}</td>
              </tr>
            })}</tbody>
          </table>
        </div>
      </div>

      <div style={s.card}>
        <div style={{...s.toolbar,justifyContent:'space-between'}}>
          <div>
            <p style={{fontSize:12,fontWeight:800,color:'#626262',margin:0}}>Acompanhamento de {mesAtualNome}</p>
            <p style={{fontSize:11,color:'#969696',margin:'3px 0 0'}}>Clique num funcionário para abrir o histórico completo.</p>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:9,flexWrap:'wrap'}}>
            <div style={{display:'flex',gap:3,padding:3,border:'1px solid #E2E6E4',borderRadius:9,background:'#F6F8F7'}}>
              <button onClick={()=>setViewFolha('lista')} style={{padding:'.4rem .75rem',borderRadius:7,border:'none',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:'inherit',background:viewFolha==='lista'?ACCENT:'transparent',color:viewFolha==='lista'?'#fff':'#7D7D7D'}}>Lista</button>
              <button onClick={()=>setViewFolha('grade')} style={{padding:'.4rem .75rem',borderRadius:7,border:'none',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:'inherit',background:viewFolha==='grade'?ACCENT:'transparent',color:viewFolha==='grade'?'#fff':'#7D7D7D'}}>Grade anual</button>
            </div>
            <input aria-label="Buscar funcionário" style={{...s.inp,width:220}} placeholder="Buscar por nome, cargo ou obra..." value={searchFuncionario} onChange={e=>setSearchFuncionario(e.target.value)}/>
          </div>
        </div>

        {viewFolha === 'lista' ? (
          <div style={{padding:'0 1.2rem 1.2rem'}}>
            <div style={{display:'grid',gridTemplateColumns:'minmax(180px,1.2fr) minmax(130px,.85fr) minmax(120px,.8fr) minmax(150px,1fr) minmax(135px,.9fr) minmax(170px,1.1fr)',gap:12,padding:'12px 10px 9px',borderBottom:'1px solid #E2E6E4',color:'#969696',fontSize:10,fontWeight:800,letterSpacing:'.10em',textTransform:'uppercase'}}>
              <span>Funcionário</span><span>Obra</span><span>Salário base</span><span>Situação</span><span>Último pagamento</span><span style={{textAlign:'right'}}>Ações</span>
            </div>
            {filtered.length === 0 ? (
              <div style={{textAlign:'center',padding:'3.2rem 1rem'}}>
                <span style={{width:44,height:44,borderRadius:13,background:'#E8EFEC',color:ACCENT_LT,display:'inline-flex',alignItems:'center',justifyContent:'center'}}><Icon name="users" size={21}/></span>
                <p style={{fontSize:15,fontWeight:800,color:'#626262',margin:'13px 0 5px'}}>{funcionarios.length ? 'Nenhum funcionário encontrado' : 'Cadastre o primeiro funcionário'}</p>
                <p style={{fontSize:12,color:'#969696',maxWidth:330,lineHeight:1.5,margin:'0 auto 14px'}}>{funcionarios.length ? 'Tente outro nome na busca.' : 'Vincule cada funcionário à obra em que ele está atuando pra acompanhar o gasto de folha por obra.'}</p>
                {!funcionarios.length && <button onClick={onNovoFuncionario} style={{...s.btnTeal,margin:'0 auto'}}>Cadastrar primeiro funcionário</button>}
              </div>
            ) : filtered.map(f => {
              const status = statusFuncionario(f)
              const ultimo = ultimoPagamento(f.id)
              const pagoAtual = totalPagoNoMes(f.id, mesAtual)
              return (
                <div key={f.id} onClick={()=>onHistorico(f)} style={{display:'grid',gridTemplateColumns:'minmax(180px,1.2fr) minmax(130px,.85fr) minmax(120px,.8fr) minmax(150px,1fr) minmax(135px,.9fr) minmax(170px,1.1fr)',gap:12,alignItems:'center',padding:'14px 10px',borderBottom:'1px solid #E2E6E4',cursor:'pointer',transition:'background .15s'}} onMouseEnter={e=>(e.currentTarget.style.background='#F5F7F6')} onMouseLeave={e=>(e.currentTarget.style.background='')}>
                  <div style={{minWidth:0}}>
                    <p style={{fontSize:13,fontWeight:800,color:'#626262',margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{f.nome}</p>
                    <p style={{fontSize:11,color:'#969696',margin:'4px 0 0'}}>{f.cargo || 'Sem cargo definido'}</p>
                  </div>
                  <p style={{fontSize:12,fontWeight:700,color:'#626262',margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{nomeObra(f.obra_id)}</p>
                  <p style={{fontSize:12,fontWeight:700,color:'#626262',margin:0}}>{fmtR(f.salario_base)}</p>
                  <Badge label={status.label} bg={status.bg} color={status.color}/>
                  <div>
                    {pagoAtual !== null ? <p style={{fontSize:12,fontWeight:800,color:ACCENT_LT,margin:0}}>{fmtR(pagoAtual)}</p> : <p style={{fontSize:12,fontWeight:700,color:'#969696',margin:0}}>{ultimo ? fmtR(ultimo.valor) : 'Sem histórico'}</p>}
                    <p style={{fontSize:10,color:'#969696',margin:'3px 0 0'}}>{pagoAtual !== null ? 'pago neste mês' : ultimo ? `em ${fmtData(ultimo.data_pagamento)}` : '—'}</p>
                  </div>
                  <div style={{display:'flex',justifyContent:'flex-end',gap:6,flexWrap:'wrap'}} onClick={e=>e.stopPropagation()}>
                    {f.ativo && <button onClick={()=>onPagar(f)} style={{...s.btnGrn,padding:'.45rem .7rem',fontSize:11}}><Icon name="dollar" size={12} color="#fff"/> Pagar</button>}
                    <button onClick={()=>onEditarFuncionario(f)} style={{...s.btnOut,padding:'.45rem .65rem',fontSize:11}}><Icon name="edit" size={12}/> Editar</button>
                    <button onClick={()=>onHistorico(f)} style={{...s.btnOut,padding:'.45rem .65rem',fontSize:11}}><Icon name="receipt" size={12}/> Histórico</button>
                    <button title={f.ativo?'Desligar':'Reativar'} onClick={()=>{if(f.ativo&&!confirm(`Desligar ${f.nome}? O cadastro deixará de aparecer como pendente na folha.`))return;api.atualizarFuncionario(f.id,{ativo:!f.ativo}).then(()=>{onAtualizar();notify(f.ativo?'Funcionário desligado':'Funcionário reativado')}).catch((err:any)=>notify('Erro: '+(err?.message||'tente novamente'),false))}} style={{width:30,height:30,display:'inline-flex',alignItems:'center',justifyContent:'center',background:'#fff',border:'1px solid #E2E6E4',borderRadius:8,cursor:'pointer'}}><Icon name={f.ativo?'x':'check'} size={14} color={f.ativo?'#777777':ACCENT_LT}/></button>
                  </div>
                </div>
              )
            })}
            {filtered.length > 0 && <div style={{padding:'13px 10px 0',fontSize:11,color:'#969696'}}>{filtered.length} funcionário{filtered.length !== 1 ? 's' : ''} exibido{filtered.length !== 1 ? 's' : ''} · {funcionariosPagosNoMes.size} pago{funcionariosPagosNoMes.size !== 1 ? 's' : ''} neste mês</div>}
          </div>
        ) : (
          <div style={{padding:'1.1rem 1.2rem 1.35rem'}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12,fontSize:11,color:'#7D7D7D'}}><span style={{width:9,height:9,borderRadius:3,background:'#E8F0EB'}}/> Pago <span style={{width:9,height:9,borderRadius:3,background:'#F1F4F2',marginLeft:6}}/> Pendente <span style={{marginLeft:'auto'}}>Clique em um mês para ver os detalhes</span></div>
            {filtered.length === 0 ? <p style={{textAlign:'center',padding:'2.5rem',color:'#969696',fontSize:13}}>Nenhum funcionário encontrado.</p> : (
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,minWidth:830}}>
                  <thead><tr>
                    <th style={{padding:'9px 10px',textAlign:'left',fontSize:10,fontWeight:800,color:'#969696',textTransform:'uppercase',position:'sticky',left:0,background:'#fff',zIndex:1}}>Funcionário</th>
                    {meses.map(m=><th key={m.key} style={{padding:'9px 5px',textAlign:'center',fontSize:10,fontWeight:800,color:'#969696',textTransform:'uppercase',whiteSpace:'nowrap'}}>{m.label}</th>)}
                  </tr></thead>
                  <tbody>{filtered.map(f=><tr key={f.id}>
                    <td style={{padding:'10px',fontWeight:800,color:'#626262',whiteSpace:'nowrap',position:'sticky',left:0,background:'#fff',zIndex:1}}>{f.nome}<span style={{display:'block',fontSize:10,fontWeight:500,color:'#A2AAA6',marginTop:3}}>{nomeObra(f.obra_id)}</span></td>
                    {meses.map(m=>{
                      const valor = totalPagoNoMes(f.id, m.key)
                      const pago = valor !== null
                      const date = `${m.year}-${String(m.month).padStart(2,'0')}-05`
                      return <td key={m.key} style={{padding:'5px 3px',textAlign:'center'}}><button onClick={()=>setDetalhe({funcionario:f,key:m.key,label:cap(monthName(new Date(m.year,m.month-1,1))),date})} title={pago ? `Pago: ${fmtR(valor!)} · clique para ver os detalhes` : f.ativo ? 'Sem pagamento · clique para ver' : 'Funcionário inativo · clique para ver'} style={{width:'100%',minWidth:58,padding:'7px 3px',borderRadius:8,border:'none',cursor:'pointer',fontFamily:'inherit',background:pago?'#E8F0EB':'#F1F4F2',color:pago?ACCENT_LT:'#C4CECA',fontSize:10,fontWeight:800,display:'flex',flexDirection:'column',alignItems:'center',gap:2}}><Icon name={pago?'check':'x'} size={11} color={pago?ACCENT_LT:'#C4CECA'}/>{pago ? fmtR(valor!).replace('R$','') : 'Pagar'}</button></td>
                    })}
                  </tr>)}</tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {detalhe && (
        <div style={s.overlay} onClick={e=>e.target===e.currentTarget&&setDetalhe(null)}>
          <div role="dialog" aria-modal="true" aria-label={detalhe.funcionario ? `Pagamentos de ${detalhe.funcionario.nome} em ${detalhe.label}` : `Folha de ${detalhe.label}`} style={{...s.modal,width:detalhe.funcionario?540:640}}>
            <div style={s.mhdr}>
              <div style={{minWidth:0}}>
                <h3 style={{fontSize:15,fontWeight:700,margin:0}}>{detalhe.funcionario ? detalhe.funcionario.nome : `Folha de ${detalhe.label.toLowerCase()}`}</h3>
                <p style={{fontSize:12,color:'#7D7D7D',margin:'3px 0 0'}}>{detalhe.funcionario ? <>{detalhe.label} · {nomeObra(detalhe.funcionario.obra_id)}{detalhe.funcionario.cargo ? ` · ${detalhe.funcionario.cargo}` : ''}</> : 'Todos os funcionários'}</p>
              </div>
              <button aria-label="Fechar" onClick={()=>setDetalhe(null)} style={{background:'none',border:'none',cursor:'pointer',color:'#7D7D7D'}}><Icon name="x" size={20}/></button>
            </div>
            <div style={{padding:'1.25rem 1.5rem'}}>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:10,marginBottom:16}}>
                <div style={{border:'1px solid #E2E6E4',borderRadius:10,padding:'10px 12px',background:pagamentosDetalhe.length?'#E8F0EB':'#F6F8F7'}}>
                  <p style={{fontSize:10,fontWeight:800,color:'#969696',textTransform:'uppercase',letterSpacing:'.08em',margin:0}}>Pago no mês</p>
                  <p style={{fontSize:17,fontWeight:800,color:pagamentosDetalhe.length?ACCENT_LT:'#969696',margin:'4px 0 0'}}>{fmtR(totalDetalhe)}</p>
                </div>
                {detalhe.funcionario ? (
                  <div style={{border:'1px solid #E2E6E4',borderRadius:10,padding:'10px 12px'}}>
                    <p style={{fontSize:10,fontWeight:800,color:'#969696',textTransform:'uppercase',letterSpacing:'.08em',margin:0}}>Salário base atual</p>
                    <p style={{fontSize:17,fontWeight:800,color:'#626262',margin:'4px 0 0'}}>{fmtR(detalhe.funcionario.salario_base)}</p>
                  </div>
                ) : (
                  <div style={{border:'1px solid #E2E6E4',borderRadius:10,padding:'10px 12px'}}>
                    <p style={{fontSize:10,fontWeight:800,color:'#969696',textTransform:'uppercase',letterSpacing:'.08em',margin:0}}>Funcionários pagos</p>
                    <p style={{fontSize:17,fontWeight:800,color:'#626262',margin:'4px 0 0'}}>{funcionariosPagosDetalhe} <span style={{fontSize:11,fontWeight:600,color:'#969696'}}>· {pagamentosDetalhe.length} pagamento{pagamentosDetalhe.length !== 1 ? 's' : ''}</span></p>
                  </div>
                )}
              </div>

              {pagamentosDetalhe.length === 0 ? (
                <div style={{textAlign:'center',padding:'1.4rem 0 .6rem'}}>
                  <p style={{fontSize:13,fontWeight:700,color:'#626262',margin:0}}>Nenhum pagamento registrado neste mês.</p>
                  {detalhe.funcionario && <p style={{fontSize:12,color:'#969696',margin:'6px 0 0'}}>{ultimoAntesDetalhe ? `Pagamento anterior: ${fmtR(ultimoAntesDetalhe.valor)} (${TIPO_LABEL[ultimoAntesDetalhe.tipo] || ultimoAntesDetalhe.tipo}) em ${fmtData(ultimoAntesDetalhe.data_pagamento)}.` : 'Não há pagamentos anteriores a este mês.'}</p>}
                  {detalhe.funcionario && !detalhe.funcionario.ativo && <p style={{fontSize:12,color:'#969696',margin:'6px 0 0'}}>Funcionário inativo.</p>}
                </div>
              ) : (
                <>
                  <div style={{border:'1.5px solid #E2E6E4',borderRadius:8,overflow:'hidden'}}>
                    {pagamentosDetalhe.map(p=>editando?.id===p.id ? (
                      <div key={p.id} style={{padding:'12px 14px',borderBottom:'1px solid #E2E6E4',background:'#F6F8F7'}}>
                        {!detalhe.funcionario && <p style={{margin:'0 0 8px',fontSize:12,fontWeight:800,color:'#626262'}}>{nomeFuncionario(p.funcionario_id)}</p>}
                        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:8}}>
                          <div><label style={s.lb}>Tipo</label>
                            <select style={s.fi} value={editando.tipo} onChange={e=>setEditando({...editando,tipo:e.target.value as PagamentoFuncionario['tipo']})}>
                              {(Object.keys(TIPO_LABEL) as PagamentoFuncionario['tipo'][]).map(tipo=><option key={tipo} value={tipo}>{TIPO_LABEL[tipo]}</option>)}
                            </select>
                          </div>
                          <div><label style={s.lb}>Valor</label>
                            <input autoFocus style={s.fi} value={editando.valor} placeholder="R$ 0,00" onChange={e=>setEditando({...editando,valor:mascaraMoeda(e.target.value)})} onKeyDown={e=>{if(e.key==='Enter') salvarEdicao()}}/>
                          </div>
                          <div><label style={s.lb}>Data do pagamento</label>
                            <input type="date" style={s.fi} value={editando.data} onChange={e=>setEditando({...editando,data:e.target.value})}/>
                          </div>
                        </div>
                        <div style={{display:'flex',justifyContent:'flex-end',gap:6,marginTop:10}}>
                          <button onClick={()=>setEditando(null)} disabled={salvandoEdicao} style={{...s.btnOut,padding:'.4rem .8rem',fontSize:12}}>Cancelar</button>
                          <button onClick={salvarEdicao} disabled={salvandoEdicao} style={{...s.btnGrn,padding:'.4rem .8rem',fontSize:12,opacity:salvandoEdicao?0.6:1}}>{salvandoEdicao ? 'Salvando...' : 'Salvar'}</button>
                        </div>
                      </div>
                    ) : (
                      <div key={p.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,padding:'10px 14px',borderBottom:'1px solid #E2E6E4'}}>
                        <div style={{minWidth:0}}>
                          {!detalhe.funcionario && <p style={{margin:'0 0 2px',fontSize:12,fontWeight:800,color:'#626262',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{nomeFuncionario(p.funcionario_id)}</p>}
                          <p style={{margin:0,fontSize:14,fontWeight:700,color:'#8BA59A'}}>{fmtR(p.valor)} <span style={{fontSize:11,fontWeight:600,color:'#7D7D7D'}}>· {TIPO_LABEL[p.tipo] || p.tipo}</span></p>
                          <p style={{margin:'2px 0 0',fontSize:12,color:'#7D7D7D'}}>Pago em {fmtData(p.data_pagamento)}</p>
                        </div>
                        <div style={{display:'flex',gap:4,flexShrink:0}}>
                          <button aria-label="Editar pagamento" title="Editar pagamento" disabled={!!editando||excluindo===p.id} onClick={()=>editarPagamento(p)} style={{width:30,height:30,display:'inline-flex',alignItems:'center',justifyContent:'center',background:'#fff',border:'1px solid #E2E6E4',borderRadius:8,cursor:'pointer',color:'#626262',opacity:editando?0.4:1}}>
                            <Icon name="edit" size={14}/>
                          </button>
                          <button aria-label="Excluir pagamento" title="Excluir pagamento" disabled={!!editando||excluindo===p.id} onClick={()=>excluirPagamento(p)} style={{width:30,height:30,display:'inline-flex',alignItems:'center',justifyContent:'center',background:'#fff',border:'1px solid #E2E6E4',borderRadius:8,cursor:'pointer',color:'#777777',opacity:editando||excluindo===p.id?0.4:1}}>
                            <Icon name="trash" size={14}/>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {porTipoDetalhe.length > 1 && (
                    <div style={{display:'flex',flexWrap:'wrap',gap:'6px 14px',marginTop:10,fontSize:11,color:'#7D7D7D'}}>
                      {porTipoDetalhe.map(([tipo, valor])=><span key={tipo}>{TIPO_LABEL[tipo as PagamentoFuncionario['tipo']] || tipo}: <strong style={{color:'#626262'}}>{fmtR(valor)}</strong></span>)}
                    </div>
                  )}
                </>
              )}
            </div>
            <div style={s.mfoot}>
              {detalhe.funcionario ? (
                <>
                  <button onClick={()=>{const f=detalhe.funcionario!;setDetalhe(null);onHistorico(f)}} style={{...s.btnOut,padding:'.5rem 1rem',fontSize:13}}><Icon name="receipt" size={13}/> Histórico completo</button>
                  {detalhe.funcionario.ativo && (
                    <button onClick={()=>{const {funcionario,date}=detalhe;setDetalhe(null);onPagar(funcionario!,date)}} style={s.btnGrn}>
                      <Icon name="dollar" size={13} color="#fff"/> {pagamentosDetalhe.length ? 'Lançar outro pagamento' : 'Registrar pagamento'}
                    </button>
                  )}
                </>
              ) : (
                <button onClick={()=>setDetalhe(null)} style={{...s.btnOut,padding:'.5rem 1rem',fontSize:13}}>Fechar</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
