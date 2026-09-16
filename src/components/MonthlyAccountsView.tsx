'use client'

import Icon from './Icon'
import { KPI, Badge } from './ui'
import { api, ContaMensal, PagamentoContaMensal, fmtData, fmtR } from '../services/api'
import { ACCENT, ACCENT_LT, s } from '../lib/theme'

type MonthlyView = 'lista' | 'grade'

type Props = {
  contasMensais: ContaMensal[]
  pagamentosMensais: PagamentoContaMensal[]
  searchMensal: string
  setSearchMensal: (value: string) => void
  viewMensal: MonthlyView
  setViewMensal: (value: MonthlyView) => void
  onNovaConta: () => void
  onPagar: (conta: ContaMensal, dataSugerida?: string) => void
  onHistorico: (conta: ContaMensal) => void
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
    return {
      key: monthKey(date),
      label: shortMonthName(date),
      year: date.getFullYear(),
      month: date.getMonth() + 1,
    }
  })
}

export default function MonthlyAccountsView({
  contasMensais,
  pagamentosMensais,
  searchMensal,
  setSearchMensal,
  viewMensal,
  setViewMensal,
  onNovaConta,
  onPagar,
  onHistorico,
  onAtualizar,
}: Props) {
  const hoje = new Date()
  const mesAtual = monthKey(hoje)
  const mesAtualNome = monthName(hoje)
  const meses = buildMonths()
  const filtered = contasMensais.filter(conta => !searchMensal || conta.titulo.toLowerCase().includes(searchMensal.toLowerCase()))
  const ativas = contasMensais.filter(conta => conta.ativo)
  const pagamentosDoMes = pagamentosMensais.filter(pagamento => pagamento.data_pagamento.startsWith(mesAtual))
  const contasPagas = new Set(pagamentosDoMes.map(pagamento => pagamento.conta_mensal_id))
  const totalPagoMes = pagamentosDoMes.reduce((total, pagamento) => total + pagamento.valor, 0)
  const emAtraso = ativas.filter(conta => !contasPagas.has(conta.id) && hoje.getDate() > conta.dia_vencimento).length
  const ultimoPagamento = (contaId: string) => pagamentosMensais.filter(pagamento => pagamento.conta_mensal_id === contaId).reduce<PagamentoContaMensal | undefined>((ultimo, pagamento) => !ultimo || pagamento.data_pagamento > ultimo.data_pagamento ? pagamento : ultimo, undefined)
  const pagamentoNoMes = (contaId: string, key: string) => {
    const pagamentos = pagamentosMensais.filter(pagamento => pagamento.conta_mensal_id === contaId && pagamento.data_pagamento.startsWith(key))
    return pagamentos.length ? pagamentos.reduce((total, pagamento) => total + pagamento.valor, 0) : null
  }

  const statusConta = (conta: ContaMensal) => {
    if (!conta.ativo) return { label: 'Inativa', bg: '#EDF0EE', color: '#7D7D7D', icon: 'x' }
    if (contasPagas.has(conta.id)) return { label: 'Pago neste mês', bg: '#E8F0EB', color: ACCENT_LT, icon: 'check' }
    if (hoje.getDate() > conta.dia_vencimento) return { label: 'Em atraso', bg: '#F1F4F2', color: '#626262', icon: 'alert' }
    return { label: `Vence dia ${conta.dia_vencimento}`, bg: '#E8EFEC', color: ACCENT_LT, icon: 'calendar' }
  }

  const suggestedDate = (conta: ContaMensal, year = hoje.getFullYear(), month = hoje.getMonth() + 1) => {
    const day = Math.min(conta.dia_vencimento || 1, 28)
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  return (
    <div>
      <div style={s.row}>
        <div>
          <p className="workspace-eyebrow" style={{ marginBottom: 7 }}>Rotina financeira</p>
          <h1 style={s.h1}>Contas mensais</h1>
          <p style={s.p}>Uma visão simples do que já foi pago e do que precisa de atenção em {mesAtualNome}.</p>
        </div>
        <button onClick={onNovaConta} style={s.btnTeal}><Icon name="plus" size={14} color="#fff"/> Cadastrar conta</button>
      </div>

      <div style={{display:'flex',alignItems:'flex-start',gap:13,background:'#E8EFEC',border:'1px solid #D6E2DB',borderRadius:14,padding:'14px 16px',marginBottom:'1.25rem'}}>
        <span style={{width:32,height:32,flex:'0 0 auto',borderRadius:9,background:'#fff',color:ACCENT_LT,display:'inline-flex',alignItems:'center',justifyContent:'center'}}><Icon name="sparkles" size={16}/></span>
        <div>
          <p style={{fontSize:12,fontWeight:800,color:'#626262',margin:'1px 0 4px'}}>Como acompanhar</p>
          <p style={{fontSize:12,lineHeight:1.5,color:'#71817E',margin:0}}>Cadastre cada conta uma vez. Todo mês, clique em <strong>Registrar pagamento</strong> quando quitar. Use o histórico para conferir valores anteriores.</p>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:12,marginBottom:'1.35rem'}}>
        <KPI l="Contas ativas" v={ativas.length} sv="em acompanhamento" c={ACCENT_LT}/>
        <KPI l="Pagas neste mês" v={contasPagas.size} sv={`de ${ativas.length} contas ativas`} c="#8BA59A"/>
        <KPI l="Total pago no mês" v={fmtR(totalPagoMes)} sv={mesAtualNome} c="#748F84"/>
        <KPI l="Precisam de atenção" v={emAtraso} sv="vencidas sem pagamento" c="#7D7D7D"/>
      </div>

      <div style={s.card}>
        <div style={{...s.toolbar,justifyContent:'space-between'}}>
          <div>
            <p style={{fontSize:12,fontWeight:800,color:'#626262',margin:0}}>Acompanhamento de {mesAtualNome}</p>
            <p style={{fontSize:11,color:'#969696',margin:'3px 0 0'}}>Clique em uma conta para abrir o histórico completo.</p>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:9,flexWrap:'wrap'}}>
            <div style={{display:'flex',gap:3,padding:3,border:'1px solid #E2E6E4',borderRadius:9,background:'#F6F8F7'}}>
              <button onClick={()=>setViewMensal('lista')} style={{padding:'.4rem .75rem',borderRadius:7,border:'none',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:'inherit',background:viewMensal==='lista'?ACCENT:'transparent',color:viewMensal==='lista'?'#fff':'#7D7D7D'}}>Lista</button>
              <button onClick={()=>setViewMensal('grade')} style={{padding:'.4rem .75rem',borderRadius:7,border:'none',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:'inherit',background:viewMensal==='grade'?ACCENT:'transparent',color:viewMensal==='grade'?'#fff':'#7D7D7D'}}>Grade anual</button>
            </div>
            <input aria-label="Buscar conta mensal" style={{...s.inp,width:210}} placeholder="Buscar conta..." value={searchMensal} onChange={e=>setSearchMensal(e.target.value)}/>
          </div>
        </div>

        {viewMensal === 'lista' ? (
          <div style={{padding:'0 1.2rem 1.2rem'}}>
            <div style={{display:'grid',gridTemplateColumns:'minmax(190px,1.35fr) minmax(120px,.8fr) minmax(150px,1fr) minmax(135px,.9fr) minmax(190px,1.25fr)',gap:12,padding:'12px 10px 9px',borderBottom:'1px solid #E2E6E4',color:'#969696',fontSize:10,fontWeight:800,letterSpacing:'.10em',textTransform:'uppercase'}}>
              <span>Conta</span><span>Vencimento</span><span>Situação</span><span>Último pagamento</span><span style={{textAlign:'right'}}>Ações</span>
            </div>
            {filtered.length === 0 ? (
              <div style={{textAlign:'center',padding:'3.2rem 1rem'}}>
                <span style={{width:44,height:44,borderRadius:13,background:'#E8EFEC',color:ACCENT_LT,display:'inline-flex',alignItems:'center',justifyContent:'center'}}><Icon name="refresh" size={21}/></span>
                <p style={{fontSize:15,fontWeight:800,color:'#626262',margin:'13px 0 5px'}}>{contasMensais.length ? 'Nenhuma conta encontrada' : 'Comece pelas suas contas fixas'}</p>
                <p style={{fontSize:12,color:'#969696',maxWidth:330,lineHeight:1.5,margin:'0 auto 14px'}}>{contasMensais.length ? 'Tente outro nome na busca.' : 'Cadastre água, luz, internet ou qualquer despesa recorrente para acompanhar todos os meses.'}</p>
                {!contasMensais.length && <button onClick={onNovaConta} style={{...s.btnTeal,margin:'0 auto'}}>Cadastrar primeira conta</button>}
              </div>
            ) : filtered.map(conta => {
              const status = statusConta(conta)
              const ultimo = ultimoPagamento(conta.id)
              const pagoAtual = pagamentoNoMes(conta.id, mesAtual)
              return (
                <div key={conta.id} onClick={()=>onHistorico(conta)} style={{display:'grid',gridTemplateColumns:'minmax(190px,1.35fr) minmax(120px,.8fr) minmax(150px,1fr) minmax(135px,.9fr) minmax(190px,1.25fr)',gap:12,alignItems:'center',padding:'14px 10px',borderBottom:'1px solid #E2E6E4',cursor:'pointer',transition:'background .15s'}} onMouseEnter={e=>(e.currentTarget.style.background='#F5F7F6')} onMouseLeave={e=>(e.currentTarget.style.background='')}>
                  <div style={{minWidth:0}}>
                    <p style={{fontSize:13,fontWeight:800,color:'#626262',margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{conta.titulo}</p>
                    <p style={{fontSize:11,color:'#969696',margin:'4px 0 0'}}>Pago por {conta.pago_por}</p>
                  </div>
                  <div>
                    <p style={{fontSize:12,fontWeight:700,color:'#626262',margin:0}}>Dia {conta.dia_vencimento}</p>
                    <p style={{fontSize:10,color:'#969696',margin:'3px 0 0'}}>recorrente mensal</p>
                  </div>
                  <Badge label={status.label} bg={status.bg} color={status.color}/>
                  <div>
                    {pagoAtual !== null ? <p style={{fontSize:12,fontWeight:800,color:ACCENT_LT,margin:0}}>{fmtR(pagoAtual)}</p> : <p style={{fontSize:12,fontWeight:700,color:'#969696',margin:0}}>{ultimo ? fmtR(ultimo.valor) : 'Ainda não pago'}</p>}
                    <p style={{fontSize:10,color:'#969696',margin:'3px 0 0'}}>{pagoAtual !== null ? 'pago neste mês' : ultimo ? `em ${fmtData(ultimo.data_pagamento)}` : 'sem histórico'}</p>
                  </div>
                  <div style={{display:'flex',justifyContent:'flex-end',gap:6,flexWrap:'wrap'}} onClick={e=>e.stopPropagation()}>
                    {conta.ativo && <button onClick={()=>onPagar(conta)} style={{...s.btnGrn,padding:'.45rem .7rem',fontSize:11}}><Icon name="dollar" size={12} color="#fff"/> Registrar pagamento</button>}
                    <button onClick={()=>onHistorico(conta)} style={{...s.btnOut,padding:'.45rem .65rem',fontSize:11}}><Icon name="receipt" size={12}/> Histórico</button>
                    <button title={conta.ativo?'Pausar conta':'Reativar conta'} onClick={()=>api.toggleContaMensal(conta.id,!conta.ativo).then(onAtualizar)} style={{width:30,height:30,display:'inline-flex',alignItems:'center',justifyContent:'center',background:'#fff',border:'1px solid #E2E6E4',borderRadius:8,cursor:'pointer'}}><Icon name={conta.ativo?'x':'check'} size={14} color={conta.ativo?'#777777':ACCENT_LT}/></button>
                  </div>
                </div>
              )
            })}
            {filtered.length > 0 && <div style={{padding:'13px 10px 0',fontSize:11,color:'#969696'}}>{filtered.length} conta{filtered.length !== 1 ? 's' : ''} exibida{filtered.length !== 1 ? 's' : ''} · {contasPagas.size} paga{contasPagas.size !== 1 ? 's' : ''} neste mês</div>}
          </div>
        ) : (
          <div style={{padding:'1.1rem 1.2rem 1.35rem'}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12,fontSize:11,color:'#7D7D7D'}}><span style={{width:9,height:9,borderRadius:3,background:'#E8F0EB'}}/> Pago <span style={{width:9,height:9,borderRadius:3,background:'#F1F4F2',marginLeft:6}}/> Pendente <span style={{marginLeft:'auto'}}>Clique em uma célula pendente para registrar</span></div>
            {filtered.length === 0 ? <p style={{textAlign:'center',padding:'2.5rem',color:'#969696',fontSize:13}}>Nenhuma conta encontrada.</p> : (
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,minWidth:830}}>
                  <thead><tr>
                    <th style={{padding:'9px 10px',textAlign:'left',fontSize:10,fontWeight:800,color:'#969696',textTransform:'uppercase',position:'sticky',left:0,background:'#fff',zIndex:1}}>Conta</th>
                    {meses.map(m=><th key={m.key} style={{padding:'9px 5px',textAlign:'center',fontSize:10,fontWeight:800,color:'#969696',textTransform:'uppercase',whiteSpace:'nowrap'}}>{m.label}</th>)}
                  </tr></thead>
                  <tbody>{filtered.map(conta=><tr key={conta.id}>
                    <td style={{padding:'10px',fontWeight:800,color:'#626262',whiteSpace:'nowrap',position:'sticky',left:0,background:'#fff',zIndex:1}}>{conta.titulo}<span style={{display:'block',fontSize:10,fontWeight:500,color:'#A2AAA6',marginTop:3}}>dia {conta.dia_vencimento}</span></td>
                    {meses.map(m=>{
                      const valor = pagamentoNoMes(conta.id, m.key)
                      const pago = valor !== null
                      const date = `${m.year}-${String(m.month).padStart(2,'0')}-${String(Math.min(conta.dia_vencimento || 1, 28)).padStart(2,'0')}`
                      return <td key={m.key} style={{padding:'5px 3px',textAlign:'center'}}><button onClick={()=>{if(!pago && conta.ativo) onPagar(conta,date)}} disabled={!conta.ativo || pago} title={pago ? `Pago: ${fmtR(valor!)}` : conta.ativo ? 'Registrar pagamento' : 'Conta inativa'} style={{width:'100%',minWidth:58,padding:'7px 3px',borderRadius:8,border:'none',cursor:pago||!conta.ativo?'default':'pointer',background:pago?'#E8F0EB':'#F1F4F2',color:pago?ACCENT_LT:'#C4CECA',fontSize:10,fontWeight:800,display:'flex',flexDirection:'column',alignItems:'center',gap:2}}><Icon name={pago?'check':'x'} size={11} color={pago?ACCENT_LT:'#C4CECA'}/>{pago ? fmtR(valor!).replace('R$','') : 'Pagar'}</button></td>
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
