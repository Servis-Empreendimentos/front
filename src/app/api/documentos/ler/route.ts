import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const DOCUMENT_MAX_BYTES = 20 * 1024 * 1024
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])

function parseJson(text: string) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try { return JSON.parse(cleaned) }
  catch {
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('A IA não retornou um JSON válido')
    return JSON.parse(match[0])
  }
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ detail: 'Leitura de documentos não configurada no Vercel. Adicione ANTHROPIC_API_KEY como variável privada.' }, { status: 503 })

  const form = await request.formData()
  const file = form.get('file')
  const prompt = String(form.get('prompt') || '')
  if (!(file instanceof File)) return NextResponse.json({ detail: 'Envie um arquivo PDF ou imagem.' }, { status: 400 })

  const filename = (file.name || '').toLowerCase()
  const contentType = (file.type || '').toLowerCase()
  const isPdf = contentType === 'application/pdf' || filename.endsWith('.pdf')
  const isImage = contentType.startsWith('image/')
  if (!isPdf && !isImage) return NextResponse.json({ detail: 'Envie um PDF ou uma imagem.' }, { status: 415 })
  if (file.size === 0) return NextResponse.json({ detail: 'O arquivo está vazio.' }, { status: 400 })
  if (file.size > DOCUMENT_MAX_BYTES) return NextResponse.json({ detail: 'O arquivo deve ter no máximo 20 MB.' }, { status: 413 })

  const mediaType = isPdf ? 'application/pdf' : (IMAGE_TYPES.has(contentType) ? contentType : 'image/jpeg')
  const sourceType = isPdf ? 'document' : 'image'
  const data = Buffer.from(await file.arrayBuffer()).toString('base64')

  let response: Response
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_DOCUMENT_MODEL || 'claude-sonnet-4-5',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: [
            { type: sourceType, source: { type: 'base64', media_type: mediaType, data } },
            { type: 'text', text: prompt },
          ],
        }],
      }),
    })
  } catch {
    return NextResponse.json({ detail: 'Não foi possível conectar ao serviço de leitura.' }, { status: 502 })
  }

  const result = await response.json().catch(() => ({}))
  if (!response.ok) return NextResponse.json({ detail: result?.error?.message || 'O serviço de leitura recusou o documento.' }, { status: 502 })

  const text = (result?.content || []).filter((block: any) => block?.type === 'text').map((block: any) => block.text || '').join('')
  try { return NextResponse.json(parseJson(text)) }
  catch (error: any) { return NextResponse.json({ detail: error?.message || 'Resposta inválida do serviço de leitura.' }, { status: 502 }) }
}
