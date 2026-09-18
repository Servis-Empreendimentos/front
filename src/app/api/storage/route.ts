import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function supabaseConfig() {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '')
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY || ''
  return { url, key }
}

export async function POST(request: NextRequest) {
  const { url, key } = supabaseConfig()
  if (!url || !key) return NextResponse.json({ detail: 'Supabase não configurado no Vercel' }, { status: 503 })

  const form = await request.formData()
  const file = form.get('file')
  if (!(file instanceof File)) return NextResponse.json({ detail: 'Arquivo não enviado' }, { status: 400 })
  if (file.size > 20 * 1024 * 1024) return NextResponse.json({ detail: 'O arquivo deve ter no máximo 20 MB' }, { status: 413 })

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_') || 'documento.pdf'
  const objectName = `${Date.now()}-${safeName}`
  try {
    const response = await fetch(`${url}/storage/v1/object/notas-fiscais/${objectName}`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': file.type || 'application/octet-stream',
        'x-upsert': 'true',
      },
      body: await file.arrayBuffer(),
    })
    const detail = await response.text()
    if (!response.ok) return NextResponse.json({ detail: detail || 'Falha ao enviar arquivo para o Supabase' }, { status: response.status })
    return NextResponse.json({ url: `${url}/storage/v1/object/public/notas-fiscais/${objectName}` })
  } catch {
    return NextResponse.json({ detail: 'Não foi possível conectar ao armazenamento' }, { status: 502 })
  }
}
