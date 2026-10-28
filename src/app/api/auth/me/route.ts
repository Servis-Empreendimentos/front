import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE, lerToken } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const sessao = await lerToken(request.cookies.get(SESSION_COOKIE)?.value)
  if (!sessao) return NextResponse.json({ detail: 'Sem sessão' }, { status: 401 })
  return NextResponse.json({ nome: sessao.nome, role: sessao.role })
}
