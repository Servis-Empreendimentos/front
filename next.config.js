/** @type {import('next').NextConfig} */
// Como na Roesel Transportes: as páginas (HTML) nunca ficam guardadas no cache do navegador,
// então depois de cada atualização no Vercel todo mundo já abre a versão nova.
const nextConfig = {
  async headers() {
    return [
      {
        source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
        has: [{ type: 'header', key: 'accept', value: '(.*text/html.*)' }],
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, max-age=0' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '-1' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
