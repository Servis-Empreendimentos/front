'use client'
import Icon from './Icon'
import { s, SIDEBAR_BG2, ACCENT } from '../lib/theme'

function NavItem({icon,label,active,onClick}:{icon:string;label:string;active:boolean;onClick:()=>void}) {
  return (
    <button onClick={onClick} style={{
      display:'flex',alignItems:'center',gap:11,width:'100%',textAlign:'left',
      padding:'.6rem .9rem',borderRadius:8,border:'none',cursor:'pointer',
      background:active?ACCENT:'transparent',color:active?'#fff':'#94A3B8',
      fontSize:13,fontWeight:600,fontFamily:'inherit',marginBottom:2,
      transition:'background .15s',
    }}
    onMouseEnter={e=>{if(!active)e.currentTarget.style.background=SIDEBAR_BG2}}
    onMouseLeave={e=>{if(!active)e.currentTarget.style.background='transparent'}}
    >
      <Icon name={icon} size={16} color={active?'#fff':'#94A3B8'}/>
      {label}
    </button>
  )
}

type Aba = 'visao'|'lancamentos'|'mensais'|'fornecedores'

export default function Sidebar({
  user, role, aba, setAba, onNovoOrcamento, onSair,
}:{
  user: string
  role: 'lancadora'|'gestora'|'entregador'
  aba: Aba
  setAba: (a:Aba)=>void
  onNovoOrcamento: ()=>void
  onSair: ()=>void
}) {
  return (
    <aside style={s.sidebar}>
      <div style={{padding:'1.25rem 1.1rem .5rem'}}>
        <img src="/logo.jpg" alt="Servis" style={{height:34,objectFit:'contain',marginBottom:14,filter:'brightness(0) invert(1)'}} onError={e=>(e.currentTarget.style.display='none')}/>
        <p style={{fontSize:9,fontWeight:700,color:'#475569',textTransform:'uppercase',letterSpacing:'.08em',margin:'0 0 4px'}}>Sessão ativa</p>
        <p style={{fontSize:15,fontWeight:700,color:'#fff',margin:0}}>{user}</p>
        <span style={{...s.badge,background:role==='gestora'?'#0D3B2E':role==='entregador'?'#3B2A0D':'#0D2E3B',color:role==='gestora'?'#4ADE80':role==='entregador'?'#F5A623':'#4FC3D9',marginTop:6}}>
          {role==='gestora'?'Gestora':role==='entregador'?'Conferente de obra':'Lançadora'}
        </span>
      </div>

      <div style={{height:1,background:'#1E2A38',margin:'.75rem 0'}}/>

      <div style={{padding:'0 .9rem',flex:1}}>
        <p style={{fontSize:9,fontWeight:700,color:'#475569',textTransform:'uppercase',letterSpacing:'.08em',margin:'.5rem 0 .6rem .5rem'}}>Navegação</p>

        {role==='entregador'?(
          <NavItem icon="truck" label="Entregas" active={true} onClick={()=>{}}/>
        ):(
          <>
            <NavItem icon="dashboard" label="Visão Geral" active={aba==='visao'} onClick={()=>setAba('visao')}/>
            <NavItem icon="plus" label="Novo Orçamento" active={false} onClick={onNovoOrcamento}/>
            <NavItem icon="fileText" label="Lançamentos" active={aba==='lancamentos'} onClick={()=>setAba('lancamentos')}/>
            <NavItem icon="building" label="Fornecedores" active={aba==='fornecedores'} onClick={()=>setAba('fornecedores')}/>
            <NavItem icon="refresh" label="Contas Mensais" active={aba==='mensais'} onClick={()=>setAba('mensais')}/>
          </>
        )}
      </div>

      <div style={{padding:'.9rem',borderTop:'1px solid #1E2A38'}}>
        <button onClick={onSair} style={{
          display:'flex',alignItems:'center',gap:11,width:'100%',textAlign:'left',
          padding:'.6rem .9rem',borderRadius:8,border:'none',cursor:'pointer',
          background:'transparent',color:'#F87171',fontSize:13,fontWeight:600,fontFamily:'inherit',
        }}
        onMouseEnter={e=>(e.currentTarget.style.background='#2A1416')}
        onMouseLeave={e=>(e.currentTarget.style.background='transparent')}
        >
          <Icon name="logout" size={16} color="#F87171"/> Sair
        </button>
      </div>
    </aside>
  )
}