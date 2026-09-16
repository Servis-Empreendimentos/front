'use client'
import { useState } from 'react'

const USUARIOS: Record<string, { senha: string; nome: string; role: 'lancadora'|'gestora'|'entregador' }> = {
  'anne':    { senha: 'anne123',    nome: 'Anne',    role: 'lancadora'  },
  'mayara':  { senha: 'mayara123',  nome: 'Mayara',  role: 'lancadora'  },
  'edna':    { senha: 'edna123',    nome: 'Edna',    role: 'lancadora'  },
  'erick':   { senha: 'erick123',   nome: 'Erick',   role: 'lancadora'  },
  'clau':    { senha: 'clau123',    nome: 'Clau',    role: 'gestora'    },
  'obra':    { senha: 'obra123',    nome: 'Obra',    role: 'entregador' },
}

export default function LoginScreen({ onLogin }: { onLogin: (nome: string, role: 'lancadora'|'gestora'|'entregador') => void }) {
  const [login, setLogin] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')

  const handleLogin = () => {
    const usuario = USUARIOS[login.trim().toLowerCase()]
    if (usuario && usuario.senha === senha) {
      onLogin(usuario.nome, usuario.role)
      return
    }
    setErro('Usuário ou senha incorretos.')
    setTimeout(() => setErro(''), 3000)
  }

  return (
    <main className="login-only-screen">
      <section className="login-only-card" aria-label="Acesso ao sistema">
        <img className="login-only-logo" src="/logo.jpg" alt="Servis Empreendimentos" />

        <form className="login-only-form" onSubmit={event => { event.preventDefault(); handleLogin() }}>
          <label className="login-only-label" htmlFor="usuario">Usuário</label>
          <input
            id="usuario"
            className="login-only-input"
            autoFocus
            autoComplete="username"
            placeholder="Digite seu usuário"
            value={login}
            onChange={event => setLogin(event.target.value)}
          />

          <label className="login-only-label" htmlFor="senha">Senha</label>
          <input
            id="senha"
            className="login-only-input"
            type="password"
            autoComplete="current-password"
            placeholder="Digite sua senha"
            value={senha}
            onChange={event => setSenha(event.target.value)}
          />

          {erro && <p className="login-only-error" role="alert">{erro}</p>}

          <button className="login-only-button" type="submit">Entrar</button>
        </form>
      </section>
    </main>
  )
}

export { USUARIOS }
