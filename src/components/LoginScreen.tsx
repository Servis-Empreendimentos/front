'use client'
import { useState } from 'react'
import { s } from '../lib/theme'

const USUARIOS: Record<string, { senha: string; nome: string; role: 'lancadora'|'gestora'|'entregador' }> = {
  'anne':    { senha: 'anne123',    nome: 'Anne',    role: 'lancadora'  },
  'mayara':  { senha: 'mayara123',  nome: 'Mayara',  role: 'lancadora'  },
  'edna':    { senha: 'edna123',    nome: 'Edna',    role: 'lancadora'  },
  'erick':   { senha: 'erick123',   nome: 'Erick',   role: 'lancadora'  },
  'clau':    { senha: 'clau123',    nome: 'Clau',    role: 'gestora'    },
  'obra': { senha: 'obra123', nome: 'Obra', role: 'entregador' },
}

export default function LoginScreen({onLogin}:{onLogin:(nome:string,role:'lancadora'|'gestora'|'entregador')=>void}) {
  const [login,setLogin]=useState(''); const [senha,setSenha]=useState(''); const [erro,setErro]=useState('')
  const handleLogin=()=>{
    const u=USUARIOS[login.trim().toLowerCase()]
    if(u&&u.senha===senha) onLogin(u.nome,u.role)
    else {setErro('Usuário ou senha incorretos.');setTimeout(()=>setErro(''),3000)}
  }
  return (
    <div style={{minHeight:'100vh',background:'#F4F6F4',display:'flex',alignItems:'stretch',fontFamily:"'DM Sans',sans-serif"}}>
      <div className="login-aside" style={{flex:'1 1 50%',background:'#9BAFA7',padding:'clamp(2rem, 7vw, 6rem)',display:'flex',flexDirection:'column',justifyContent:'space-between',color:'#fff',position:'relative',overflow:'hidden'}}>
        <div style={{position:'absolute',width:420,height:420,borderRadius:'50%',border:'1px solid rgba(255,255,255,.10)',right:-180,top:-160}}/>
        <div style={{position:'absolute',width:300,height:300,borderRadius:'50%',border:'1px solid rgba(143,168,160,.24)',left:-180,bottom:-130}}/>
        <div style={{position:'relative'}}>
          <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:'clamp(3.5rem, 11vh, 8rem)'}}>
            <div style={{width:42,height:42,borderRadius:12,background:'#DCE8E2',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden'}}>
              <img src="/logo.jpg" alt="" style={{width:35,height:35,objectFit:'cover',objectPosition:'50% 32%',mixBlendMode:'multiply'}} onError={e=>(e.currentTarget.style.display='none')}/>
            </div>
            <div><p style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:21,fontWeight:700,letterSpacing:'-.05em',margin:0}}>servis</p><p style={{fontSize:9,fontWeight:700,color:'#AFC1B9',letterSpacing:'.18em',textTransform:'uppercase',margin:'2px 0 0'}}>operação</p></div>
          </div>
          <p style={{fontSize:11,fontWeight:700,letterSpacing:'.16em',textTransform:'uppercase',color:'#AFC1B9',margin:'0 0 16px'}}>Painel interno</p>
          <h1 style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:'clamp(34px, 4.2vw, 60px)',lineHeight:1.02,letterSpacing:'-.065em',margin:0,maxWidth:540}}>Clareza para cada etapa da obra.</h1>
          <p style={{fontSize:15,lineHeight:1.65,color:'#C0D0CA',maxWidth:430,margin:'24px 0 0'}}>Acompanhe orçamentos, pagamentos, entregas e notas fiscais em um único lugar.</p>
        </div>
        <p style={{position:'relative',fontSize:11,color:'#9BAFA7',margin:0}}>Servis Empreendimentos · acesso restrito</p>
      </div>
      <div style={{flex:'1 1 50%',display:'flex',alignItems:'center',justifyContent:'center',padding:'2rem'}}>
        <div style={{width:'100%',maxWidth:410}}>
          <div style={{marginBottom:32}}>
            <p style={{fontSize:11,fontWeight:700,color:'#6F8E83',textTransform:'uppercase',letterSpacing:'.15em',margin:'0 0 10px'}}>Bem-vinda de volta</p>
            <h2 style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:30,letterSpacing:'-.05em',color:'#606463',margin:0}}>Entre no seu workspace</h2>
            <p style={{fontSize:13,color:'#818885',margin:'10px 0 0'}}>Use suas credenciais para continuar.</p>
          </div>
          <div style={{background:'#fff',border:'1px solid #E1E7E3',borderRadius:18,padding:'1.5rem',boxShadow:'0 14px 34px rgba(96,100,99,.07)',display:'flex',flexDirection:'column',gap:16}}>
            <div><label style={s.lb}>Usuário</label><input autoFocus style={{...s.fi,fontSize:14,padding:'11px 12px'}} placeholder="Digite seu usuário" value={login} onChange={e=>setLogin(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleLogin()}/></div>
            <div><label style={s.lb}>Senha</label><input type="password" style={{...s.fi,fontSize:14,padding:'11px 12px'}} placeholder="Digite sua senha" value={senha} onChange={e=>setSenha(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleLogin()}/></div>
            {erro&&<p style={{fontSize:12,color:'#777B79',background:'#F0F3F1',borderRadius:8,padding:'9px 10px',textAlign:'center',margin:0}}>{erro}</p>}
            <button onClick={handleLogin} style={{...s.btnTeal,justifyContent:'center',width:'100%',padding:'.78rem',fontSize:14,borderRadius:10,marginTop:3}}>Acessar painel</button>
          </div>
          <p style={{fontSize:11,color:'#A2AAA6',textAlign:'center',margin:'18px 0 0'}}>Se você não possui acesso, procure a gestão.</p>
        </div>
      </div>
    </div>
  )
}

export { USUARIOS }
