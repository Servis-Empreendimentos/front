import { NextResponse } from 'next/server'
import { SESSION_COOKIE, SESSION_MAX_AGE, autenticar, criarToken } from '../../../../lib/auth'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const usuario = autenticar(String(body?.login || ''), String(body?.senha || ''))
  if (!usuario) return NextResponse.json({ detail: 'Usuário ou senha incorretos.' }, { status: 401 })

  const response = NextResponse.json({ nome: usuario.nome, role: usuario.role })
  response.cookies.set(SESSION_COOKIE, await criarToken(usuario), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })
  return response
}
