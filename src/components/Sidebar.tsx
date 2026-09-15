'use client'
import Icon from './Icon'
import { s, SIDEBAR_BG2, ACCENT } from '../lib/theme'

function NavItem({icon,label,active,onClick}:{icon:string;label:string;active:boolean;onClick:()=>void}) {
  return (
    <button onClick={onClick} style={{
      display:'flex',alignItems:'center',gap:12,width:'100%',textAlign:'left',
      padding:'.72rem .85rem',borderRadius:10,border:'1px solid transparent',cursor:'pointer',
      background:active?'rgba(255,255,255,.13)':'transparent',color:active?'#fff':'#A9C0BB',
      fontSize:13,fontWeight:active?700:600,fontFamily:'inherit',marginBottom:4,
      transition:'background .15s, color .15s, border-color .15s',
    }}
    onMouseEnter={e=>{if(!active){e.currentTarget.style.background=SIDEBAR_BG2;e.currentTarget.style.color='#fff'}}}
    onMouseLeave={e=>{if(!active){e.currentTarget.style.background='transparent';e.currentTarget.style.color='#A9C0BB'}}}
    >
      <span style={{width:28,height:28,borderRadius:8,display:'inline-flex',alignItems:'center',justifyContent:'center',background:active?'rgba(255,255,255,.14)':'rgba(255,255,255,.05)'}}>
        <Icon name={icon} size={16} color={active?'#fff':'#A9C0BB'}/>
      </span>
      {label}
      {active&&<span style={{marginLeft:'auto',width:5,height:5,borderRadius:'50%',background:'#F2A17D'}}/>}
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
  const roleLabel = role==='gestora'?'Gestora':role==='entregador'?'Conferente de obra':'Lançadora'
  return (
    <aside className="sidebar-shell" style={s.sidebar}>
      <div style={{padding:'1.45rem 1.15rem .8rem'}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:24}}>
          <div style={{width:34,height:34,borderRadius:10,background:'#F2A17D',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden'}}>
            <img src="/logo.jpg" alt="" style={{width:29,height:29,objectFit:'cover',objectPosition:'50% 32%',mixBlendMode:'multiply'}} onError={e=>(e.currentTarget.style.display='none')}/>
          </div>
          <div>
            <p style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:17,fontWeight:700,letterSpacing:'-.04em',color:'#fff',margin:0}}>servis</p>
            <p style={{fontSize:9,fontWeight:700,color:'#9DB6B1',letterSpacing:'.14em',textTransform:'uppercase',margin:'1px 0 0'}}>operação</p>
          </div>
        </div>
        <div style={{padding:'12px 12px 13px',borderRadius:12,background:'rgba(255,255,255,.07)',border:'1px solid rgba(255,255,255,.08)'}}>
          <p style={{fontSize:9,fontWeight:700,color:'#7F9C96',textTransform:'uppercase',letterSpacing:'.12em',margin:'0 0 5px'}}>Sessão ativa</p>
          <div style={{display:'flex',alignItems:'center',gap:9}}>
            <span style={{width:30,height:30,borderRadius:'50%',background:'#D9ECE6',color:'#1D6863',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:12}}>{user.slice(0,1).toUpperCase()}</span>
            <div style={{minWidth:0}}>
              <p style={{fontSize:13,fontWeight:700,color:'#fff',margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{user}</p>
              <span style={{fontSize:10,color:'#F2A17D',fontWeight:700}}>{roleLabel}</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{height:1,background:'rgba(255,255,255,.10)',margin:'.7rem 1.15rem 1rem'}}/>

      <div style={{padding:'0 .85rem',flex:1}}>
        <p style={{fontSize:9,fontWeight:700,color:'#7F9C96',textTransform:'uppercase',letterSpacing:'.14em',margin:'.5rem 0 .7rem .5rem'}}>Workspace</p>

        {role==='entregador'?(
          <NavItem icon="truck" label="Entregas" active={true} onClick={()=>{}}/>
        ):(
          <>
            <NavItem icon="dashboard" label="Visão geral" active={aba==='visao'} onClick={()=>setAba('visao')}/>
            <NavItem icon="plus" label="Novo orçamento" active={false} onClick={onNovoOrcamento}/>
            <NavItem icon="fileText" label="Lançamentos" active={aba==='lancamentos'} onClick={()=>setAba('lancamentos')}/>
            <NavItem icon="building" label="Fornecedores" active={aba==='fornecedores'} onClick={()=>setAba('fornecedores')}/>
            <NavItem icon="refresh" label="Contas mensais" active={aba==='mensais'} onClick={()=>setAba('mensais')}/>
          </>
        )}
      </div>

      <div style={{padding:'1rem .85rem 1.1rem',borderTop:'1px solid rgba(255,255,255,.10)'}}>
        <button onClick={onSair} style={{
          display:'flex',alignItems:'center',gap:11,width:'100%',textAlign:'left',
          padding:'.68rem .85rem',borderRadius:10,border:'1px solid transparent',cursor:'pointer',
          background:'transparent',color:'#F2A17D',fontSize:13,fontWeight:700,fontFamily:'inherit',
        }}
        onMouseEnter={e=>(e.currentTarget.style.background='rgba(242,161,125,.10)')}
        onMouseLeave={e=>(e.currentTarget.style.background='transparent')}
        >
          <span style={{width:28,height:28,borderRadius:8,display:'inline-flex',alignItems:'center',justifyContent:'center',background:'rgba(242,161,125,.10)'}}><Icon name="logout" size={16} color="#F2A17D"/></span>
          Encerrar sessão
        </button>
      </div>
    </aside>
  )
}
