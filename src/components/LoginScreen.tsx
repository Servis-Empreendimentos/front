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
    <div style={{minHeight:'100vh',background:'#F5F7FA',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'DM Sans',sans-serif"}}>
      <div style={{background:'#fff',borderRadius:16,padding:'2.5rem 2rem',width:360,boxShadow:'0 8px 40px rgba(15,23,42,.1)',display:'flex',flexDirection:'column',alignItems:'center',gap:20}}>
        <div style={{textAlign:'center'}}>
          <img src="/logo.jpg" alt="Servis" style={{height:90,objectFit:'contain',marginBottom:12}} onError={e=>(e.currentTarget.style.display='none')}/>
          <h2 style={{fontSize:18,fontWeight:700,color:'#0F172A',margin:0}}>Servis - Conciliação Financeira</h2>
          <p style={{fontSize:12,color:'#64748B',marginTop:4}}>Acesso interno</p>
        </div>
        <div style={{width:'100%',display:'flex',flexDirection:'column',gap:12}}>
          <div><label style={s.lb}>Usuário</label><input style={{...s.fi,fontSize:14}} placeholder="Digite seu usuário" value={login} onChange={e=>setLogin(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleLogin()}/></div>
          <div><label style={s.lb}>Senha</label><input type="password" style={{...s.fi,fontSize:14}} placeholder="Digite sua senha" value={senha} onChange={e=>setSenha(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleLogin()}/></div>
          {erro&&<p style={{fontSize:12,color:'#DC2626',textAlign:'center',margin:0}}>{erro}</p>}
          <button onClick={handleLogin} style={{...s.btnTeal,justifyContent:'center',width:'100%',padding:'.75rem',fontSize:14,borderRadius:9,marginTop:4}}>Entrar</button>
        </div>
      </div>
    </div>
  )
}

export { USUARIOS }