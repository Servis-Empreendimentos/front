'use client'
import { useState } from 'react'
import type { Role } from '../services/api'

export default function LoginScreen({ onLogin }: { onLogin: (nome: string, role: Role) => void }) {
  const [login, setLogin] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [entrando, setEntrando] = useState(false)

  const handleLogin = async () => {
    if (!login.trim() || !senha) return setErro('Informe usuário e senha.')
    setEntrando(true)
    setErro('')
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ login, senha }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setErro(data?.detail || 'Usuário ou senha incorretos.')
        setSenha('')
        return
      }
      onLogin(data.nome, data.role)
    } catch {
      setErro('Não foi possível conectar. Verifique sua internet e tente novamente.')
    } finally {
      setEntrando(false)
    }
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
            autoCapitalize="none"
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

          <button className="login-only-button" type="submit" disabled={entrando} style={{ opacity: entrando ? 0.7 : 1 }}>
            {entrando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </section>
    </main>
  )
}
