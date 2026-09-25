'use client'

import Icon from './Icon'
import { KPI, Badge } from './ui'
import { api, Funcionario, PagamentoFuncionario, Obra, fmtData, fmtR } from '../services/api'
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
  onImportarHolerite: () => void
  onPagar: (funcionario: Funcionario, dataSugerida?: string) => void
  onHistorico: (funcionario: Funcionario) => void
  onAtualizar: () => void
}

const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
const monthName = (date: Date) => date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
const shortMonthName = (date: Date) => `${date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}/${String(date.getFullYear()).slice(2)}`

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
  onImportarHolerite,
  onPagar,
  onHistorico,
  onAtualizar,
}: Props) {
  const hoje = new Date()
  const mesAtual = monthKey(hoje)
  const mesAtualNome = monthName(hoje)
  const meses = buildMonths()
  const nomeObra = (obraId?: string | null) => obraId ? (obras.find(o => o.id === obraId)?.nome || '—') : 'Sem obra'
  const filtered = funcionarios.filter(f => {
    if (!searchFuncionario) return true
    const q = searchFuncionario.toLowerCase()
    return f.nome.toLowerCase().includes(q) || (f.cargo || '').toLowerCase().includes(q) || nomeObra(f.obra_id).toLowerCase().includes(q)
  })
  const ativos = funcionarios.filter(f => f.ativo)
  const pagamentosDoMes = pagamentos.filter(p => p.data_pagamento.startsWith(mesAtual))
  const funcionariosPagosNoMes = new Set(pagamentosDoMes.map(p => p.funcionario_id))
  const totalPagoMes = pagamentosDoMes.reduce((total, p) => total + p.valor, 0)
  const totalFolhaBase = ativos.reduce((total, f) => total + f.salario_base, 0)
  const semPagamentoNoMes = ativos.filter(f => !funcionariosPagosNoMes.has(f.id)).length

  const ultimoPagamento = (funcionarioId: string) => pagamentos.filter(p => p.funcionario_id === funcionarioId).reduce<PagamentoFuncionario | undefined>((ultimo, p) => !ultimo || p.data_pagamento > ultimo.data_pagamento ? p : ultimo, undefined)
  const totalPagoNoMes = (funcionarioId: string, key: string) => {
    const pagos = pagamentos.filter(p => p.funcionario_id === funcionarioId && p.data_pagamento.startsWith(key))
    return pagos.length ? pagos.reduce((total, p) => total + p.valor, 0) : null
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
          <p style={s.p}>Funcionários, salários e adiantamentos — cada um vinculado à obra em que está atuando.</p>
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',justifyContent:'flex-end'}}>
          <button onClick={onImportarHolerite} style={s.btnOut}><Icon name="upload" size={14}/> Importar holerite</button>
          <button onClick={onNovoFuncionario} style={s.btnTeal}><Icon name="plus" size={14} color="#fff"/> Cadastrar funcionário</button>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:12,marginBottom:'1.35rem'}}>
        <KPI l="Funcionários ativos" v={ativos.length} sv="na folha" c={ACCENT_LT}/>
        <KPI l="Folha base mensal" v={fmtR(totalFolhaBase)} sv="soma dos salários" c="#7D7D7D"/>
        <KPI l="Pago neste mês" v={fmtR(totalPagoMes)} sv={mesAtualNome} c="#8BA59A"/>
        <KPI l="Sem pagamento este mês" v={semPagamentoNoMes} sv="ainda pendente" c="#748F84"/>
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
                    <button onClick={()=>onHistorico(f)} style={{...s.btnOut,padding:'.45rem .65rem',fontSize:11}}><Icon name="receipt" size={12}/> Histórico</button>
                    <button title={f.ativo?'Desligar':'Reativar'} onClick={()=>api.atualizarFuncionario(f.id,{ativo:!f.ativo}).then(onAtualizar)} style={{width:30,height:30,display:'inline-flex',alignItems:'center',justifyContent:'center',background:'#fff',border:'1px solid #E2E6E4',borderRadius:8,cursor:'pointer'}}><Icon name={f.ativo?'x':'check'} size={14} color={f.ativo?'#777777':ACCENT_LT}/></button>
                  </div>
                </div>
              )
            })}
            {filtered.length > 0 && <div style={{padding:'13px 10px 0',fontSize:11,color:'#969696'}}>{filtered.length} funcionário{filtered.length !== 1 ? 's' : ''} exibido{filtered.length !== 1 ? 's' : ''} · {funcionariosPagosNoMes.size} pago{funcionariosPagosNoMes.size !== 1 ? 's' : ''} neste mês</div>}
          </div>
        ) : (
          <div style={{padding:'1.1rem 1.2rem 1.35rem'}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12,fontSize:11,color:'#7D7D7D'}}><span style={{width:9,height:9,borderRadius:3,background:'#E8F0EB'}}/> Pago <span style={{width:9,height:9,borderRadius:3,background:'#F1F4F2',marginLeft:6}}/> Pendente <span style={{marginLeft:'auto'}}>Clique em uma célula pendente para registrar</span></div>
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
                      return <td key={m.key} style={{padding:'5px 3px',textAlign:'center'}}><button onClick={()=>{if(!pago && f.ativo) onPagar(f,date)}} disabled={!f.ativo || pago} title={pago ? `Pago: ${fmtR(valor!)}` : f.ativo ? 'Registrar pagamento' : 'Funcionário inativo'} style={{width:'100%',minWidth:58,padding:'7px 3px',borderRadius:8,border:'none',cursor:pago||!f.ativo?'default':'pointer',background:pago?'#E8F0EB':'#F1F4F2',color:pago?ACCENT_LT:'#C4CECA',fontSize:10,fontWeight:800,display:'flex',flexDirection:'column',alignItems:'center',gap:2}}><Icon name={pago?'check':'x'} size={11} color={pago?ACCENT_LT:'#C4CECA'}/>{pago ? fmtR(valor!).replace('R$','') : 'Pagar'}</button></td>
                    })}
                  </tr>)}</tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
