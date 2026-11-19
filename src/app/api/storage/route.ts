import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function supabaseConfig() {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '')
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY || ''
  return { url, key }
}

const BUCKET = 'notas-fiscais'
const nomeSeguro = (nome: string) => nome.replace(/[^a-zA-Z0-9._-]/g, '_') || 'documento.pdf'
const pastaSegura = (pasta: unknown) => String(pasta || '').replace(/[^a-z0-9_-]/gi, '')

// O Vercel recusa envios acima de ~4,5 MB (fotos de celular costumam passar disso).
// Por isso o navegador pede aqui um link de envio assinado e manda o arquivo direto para o
// Supabase, sem passar pelo Vercel. O envio pelo próprio Vercel (multipart) continua como reserva.
async function linkAssinado(request: NextRequest, url: string, key: string) {
  const body = await request.json().catch(() => ({}))
  const pasta = pastaSegura(body?.pasta)
  const objectName = `${pasta ? pasta + '/' : ''}${Date.now()}-${nomeSeguro(String(body?.nome || ''))}`
  try {
    const response = await fetch(`${url}/storage/v1/object/upload/sign/${BUCKET}/${objectName}`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: '{}',
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok || !data?.url) return NextResponse.json({ detail: data?.message || 'Não foi possível preparar o envio do arquivo' }, { status: response.ok ? 502 : response.status })
    return NextResponse.json({ upload_url: `${url}/storage/v1${data.url}`, url: `${url}/storage/v1/object/public/${BUCKET}/${objectName}` })
  } catch {
    return NextResponse.json({ detail: 'Não foi possível conectar ao armazenamento' }, { status: 502 })
  }
}

export async function POST(request: NextRequest) {
  const { url, key } = supabaseConfig()
  if (!url || !key) return NextResponse.json({ detail: 'Supabase não configurado no Vercel' }, { status: 503 })
  if ((request.headers.get('content-type') || '').includes('application/json')) return linkAssinado(request, url, key)

  const form = await request.formData()
  const file = form.get('file')
  if (!(file instanceof File)) return NextResponse.json({ detail: 'Arquivo não enviado' }, { status: 400 })
  if (file.size > 20 * 1024 * 1024) return NextResponse.json({ detail: 'O arquivo deve ter no máximo 20 MB' }, { status: 413 })

  const safeName = nomeSeguro(file.name)
  // Pasta opcional dentro do bucket (ex.: "contratos" para os anexos dos contratos por medição).
  const pasta = pastaSegura(form.get('pasta'))
  const objectName = `${pasta ? pasta + '/' : ''}${Date.now()}-${safeName}`
  try {
    const response = await fetch(`${url}/storage/v1/object/${BUCKET}/${objectName}`, {
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
    return NextResponse.json({ url: `${url}/storage/v1/object/public/${BUCKET}/${objectName}` })
  } catch {
    return NextResponse.json({ detail: 'Não foi possível conectar ao armazenamento' }, { status: 502 })
  }
}
