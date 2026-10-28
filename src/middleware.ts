import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE, lerToken, podeAcessarTabela } from './lib/auth'

// Todas as rotas /api (exceto login/logout/me) exigem sessão válida.
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (pathname.startsWith('/api/auth/')) return NextResponse.next()

  const sessao = await lerToken(request.cookies.get(SESSION_COOKIE)?.value)
  if (!sessao) return NextResponse.json({ detail: 'Sessão expirada. Entre novamente.' }, { status: 401 })

  if (pathname === '/api/data') {
    const path = (request.nextUrl.searchParams.get('path') || '').replace(/^\/+/, '')
    const tabela = path.split('?')[0]
    if (!podeAcessarTabela(sessao.role, tabela, request.method)) {
      return NextResponse.json({ detail: 'Seu perfil não tem permissão para esta ação.' }, { status: 403 })
    }
  } else if (sessao.role === 'entregador' && pathname.startsWith('/api/fornecedores')) {
    return NextResponse.json({ detail: 'Seu perfil não tem permissão para esta ação.' }, { status: 403 })
  }

  return NextResponse.next()
}

export const config = { matcher: '/api/:path*' }
