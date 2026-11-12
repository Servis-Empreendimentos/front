'use client'
import { useEffect, useState, type ReactNode } from 'react'
import Icon from './Icon'
import { s, SIDEBAR_BG2 } from '../lib/theme'
import type { Role } from '../services/api'

function NavItem({icon,label,active,onClick,sub}:{icon:string;label:string;active:boolean;onClick:()=>void;sub?:boolean}) {
  return (
    <button onClick={onClick} style={{
      display:'flex',alignItems:'center',gap:sub?10:12,width:'100%',textAlign:'left',
      padding:sub?'.6rem .85rem .6rem 1.1rem':'.72rem .85rem',borderRadius:10,border:'1px solid transparent',cursor:'pointer',
      background:active?'#E8F0EC':'transparent',color:'#626262',
      fontSize:sub?12.5:13,fontWeight:active?700:600,fontFamily:'inherit',marginBottom:4,
      transition:'background .15s, color .15s, border-color .15s',
    }}
    onMouseEnter={e=>{if(!active){e.currentTarget.style.background=SIDEBAR_BG2;e.currentTarget.style.color='#626262'}}}
    onMouseLeave={e=>{if(!active){e.currentTarget.style.background='transparent';e.currentTarget.style.color='#626262'}}}
    >
      <span style={{width:sub?24:28,height:sub?24:28,borderRadius:8,display:'inline-flex',alignItems:'center',justifyContent:'center',background:active?'#D8E6DF':'#F1F5F3',flex:'0 0 auto'}}>
        <Icon name={icon} size={sub?14:16} color="#626262"/>
      </span>
      {label}
      {active&&<span style={{marginLeft:'auto',width:5,height:5,borderRadius:'50%',background:'#748F84'}}/>}
    </button>
  )
}

function NavGroup({icon,label,open,active,onToggle,children}:{icon:string;label:string;open:boolean;active?:boolean;onToggle:()=>void;children:ReactNode}) {
  return (
    <div>
      <button onClick={onToggle} aria-expanded={open} style={{
        display:'flex',alignItems:'center',gap:12,width:'100%',textAlign:'left',
        padding:'.72rem .85rem',borderRadius:10,border:'1px solid transparent',cursor:'pointer',
        background:active&&!open?'#E8F0EC':'transparent',color:'#626262',fontSize:13,fontWeight:active?700:600,fontFamily:'inherit',marginBottom:4,
        transition:'background .15s',
      }}
      onMouseEnter={e=>(e.currentTarget.style.background=SIDEBAR_BG2)}
      onMouseLeave={e=>(e.currentTarget.style.background=active&&!open?'#E8F0EC':'transparent')}
      >
        <span style={{width:28,height:28,borderRadius:8,display:'inline-flex',alignItems:'center',justifyContent:'center',background:active?'#D8E6DF':'#F1F5F3',flex:'0 0 auto'}}>
          <Icon name={icon} size={16} color="#626262"/>
        </span>
        {label}
        <span style={{marginLeft:'auto',transition:'transform .15s',transform:open?'rotate(90deg)':'rotate(0deg)',display:'inline-flex'}}>
          <Icon name="chevronRight" size={13} color="#969696"/>
        </span>
      </button>
      {open&&<div style={{margin:'0 0 6px 1.45rem',paddingLeft:'.4rem',borderLeft:'1px solid #E2EAE6'}}>{children}</div>}
    </div>
  )
}

export type Aba = 'visao'|'lancamentos'|'notas-fiscais'|'mensais'|'fornecedores'|'inventario'|'obras'|'folha'|'pagar'|'contratos'|'viagens'

// Grupos do menu (organização inspirada na Roesel Transportes): ao abrir um grupo,
// o sistema já vai para a primeira tela dele.
const ORCAMENTOS_ABAS: Aba[] = ['lancamentos','notas-fiscais']
const FINANCEIRO_ABAS: Aba[] = ['pagar','mensais','folha','contratos']
const CADASTROS_ABAS: Aba[] = ['fornecedores','inventario']

export default function Sidebar({
  user, role, aba, setAba, onNovoOrcamento, onSair,
}:{
  user: string
  role: Role
  aba: Aba
  setAba: (a:Aba)=>void
  onNovoOrcamento: ()=>void
  onSair: ()=>void
}) {
  const [financeiroAberto,setFinanceiroAberto]=useState<boolean>(FINANCEIRO_ABAS.includes(aba))
  const [orcamentosAberto,setOrcamentosAberto]=useState<boolean>(ORCAMENTOS_ABAS.includes(aba))
  const [cadastrosAberto,setCadastrosAberto]=useState<boolean>(CADASTROS_ABAS.includes(aba))
  const alternarGrupo=(abas:Aba[],aberto:boolean,setAberto:(v:boolean)=>void)=>{
    if(aberto){ setAberto(false); return }
    setAberto(true)
    if(!abas.includes(aba)) setAba(abas[0])
  }
  const roleLabel = role==='gestora'?'Gestora':role==='entregador'?'Usuário da obra':'Lançadora'

  useEffect(()=>{
    if(ORCAMENTOS_ABAS.includes(aba)) setOrcamentosAberto(true)
    if(FINANCEIRO_ABAS.includes(aba)) setFinanceiroAberto(true)
    if(CADASTROS_ABAS.includes(aba)) setCadastrosAberto(true)
  },[aba])
  return (
    <aside className="sidebar-shell" style={s.sidebar}>
      <div style={{padding:'1.45rem 1.15rem .8rem'}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:24}}>
          <div style={{width:34,height:34,borderRadius:10,background:'#E5EEE9',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden'}}>
            <img src="/logo.jpg" alt="" style={{width:29,height:29,objectFit:'cover',objectPosition:'50% 32%',mixBlendMode:'multiply'}} onError={e=>(e.currentTarget.style.display='none')}/>
          </div>
          <div>
            <p style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:17,fontWeight:700,letterSpacing:'-.04em',color:'#626262',margin:0}}>servis</p>
            <p style={{fontSize:9,fontWeight:700,color:'#748F84',letterSpacing:'.14em',textTransform:'uppercase',margin:'1px 0 0'}}>operação</p>
          </div>
        </div>
        <div style={{padding:'12px 12px 13px',borderRadius:12,background:'#F4F8F6',border:'1px solid #DDE9E3'}}>
          <p style={{fontSize:9,fontWeight:700,color:'#626262',textTransform:'uppercase',letterSpacing:'.12em',margin:'0 0 5px'}}>Sessão ativa</p>
          <div style={{display:'flex',alignItems:'center',gap:9}}>
            <span style={{width:30,height:30,borderRadius:'50%',background:'#E8F0EC',color:'#748F84',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:12}}>{user.slice(0,1).toUpperCase()}</span>
            <div style={{minWidth:0}}>
              <p style={{fontSize:13,fontWeight:700,color:'#626262',margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{user}</p>
              <span style={{fontSize:10,color:'#748F84',fontWeight:700}}>{roleLabel}</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{height:1,background:'#E2EAE6',margin:'.7rem 1.15rem 1rem'}}/>

      <div style={{padding:'0 .85rem',flex:1,overflowY:'auto'}}>
        <p style={{fontSize:9,fontWeight:700,color:'#7D7D7D',textTransform:'uppercase',letterSpacing:'.14em',margin:'.5rem 0 .7rem .5rem'}}>Navegação</p>

        {role==='entregador'?(
          <NavItem icon="fileText" label="Andamento dos orçamentos" active={true} onClick={()=>setAba('lancamentos')}/>
        ):(
          <>
            <NavItem icon="dashboard" label="Visão geral" active={aba==='visao'} onClick={()=>setAba('visao')}/>
            <NavItem icon="building" label="Obras" active={aba==='obras'} onClick={()=>setAba('obras')}/>

            <NavGroup icon="fileText" label="Orçamentos" open={orcamentosAberto} active={ORCAMENTOS_ABAS.includes(aba)} onToggle={()=>alternarGrupo(ORCAMENTOS_ABAS,orcamentosAberto,setOrcamentosAberto)}>
              <NavItem sub icon="plus" label="Novo orçamento" active={false} onClick={onNovoOrcamento}/>
              <NavItem sub icon="clipboard" label="Em andamento" active={aba==='lancamentos'} onClick={()=>setAba('lancamentos')}/>
              <NavItem sub icon="receipt" label="Notas fiscais" active={aba==='notas-fiscais'} onClick={()=>setAba('notas-fiscais')}/>
            </NavGroup>

            <NavGroup icon="dollar" label="Financeiro" open={financeiroAberto} active={FINANCEIRO_ABAS.includes(aba)} onToggle={()=>alternarGrupo(FINANCEIRO_ABAS,financeiroAberto,setFinanceiroAberto)}>
              <NavItem sub icon="fileText" label="Contas a pagar" active={aba==='pagar'} onClick={()=>setAba('pagar')}/>
              <NavItem sub icon="refresh" label="Contas mensais" active={aba==='mensais'} onClick={()=>setAba('mensais')}/>
              <NavItem sub icon="users" label="Folha de pagamento" active={aba==='folha'} onClick={()=>setAba('folha')}/>
              <NavItem sub icon="clipboard" label="Contratos por medição" active={aba==='contratos'} onClick={()=>setAba('contratos')}/>
            </NavGroup>

            <NavGroup icon="folder" label="Cadastros" open={cadastrosAberto} active={CADASTROS_ABAS.includes(aba)} onToggle={()=>alternarGrupo(CADASTROS_ABAS,cadastrosAberto,setCadastrosAberto)}>
              <NavItem sub icon="building" label="Fornecedores" active={aba==='fornecedores'} onClick={()=>setAba('fornecedores')}/>
              <NavItem sub icon="package" label="Inventário" active={aba==='inventario'} onClick={()=>setAba('inventario')}/>
            </NavGroup>

            <NavItem icon="truck" label="Viagens" active={aba==='viagens'} onClick={()=>setAba('viagens')}/>
          </>
        )}
      </div>

      <div style={{padding:'1rem .85rem 1.1rem',borderTop:'1px solid #E2EAE6'}}>
        <button onClick={onSair} style={{
          display:'flex',alignItems:'center',gap:11,width:'100%',textAlign:'left',
          padding:'.68rem .85rem',borderRadius:10,border:'1px solid transparent',cursor:'pointer',
          background:'transparent',color:'#626262',fontSize:13,fontWeight:700,fontFamily:'inherit',
        }}
        onMouseEnter={e=>(e.currentTarget.style.background='#E8F0EC')}
        onMouseLeave={e=>(e.currentTarget.style.background='transparent')}
        >
          <span style={{width:28,height:28,borderRadius:8,display:'inline-flex',alignItems:'center',justifyContent:'center',background:'#F1F5F3'}}><Icon name="logout" size={16} color="#626262"/></span>
          Encerrar sessão
        </button>
      </div>
    </aside>
  )
}
