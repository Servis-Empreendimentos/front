'use client'

// Exporta uma lista para Excel (.xlsx), como nas telas da Roesel Transportes.
// A biblioteca só é carregada quando alguém clica em "Exportar Excel",
// para não deixar o sistema mais lento ao abrir.

export type LinhaExcel = Record<string, string | number | null | undefined>
export type AbaExcel = { nome: string; linhas: LinhaExcel[] }

function nomeAba(nome: string) {
  return nome.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Planilha'
}

export async function exportarExcel(arquivo: string, abas: AbaExcel[]) {
  const XLSX = await import('xlsx')
  const livro = XLSX.utils.book_new()
  abas.forEach(aba => {
    const planilha = XLSX.utils.json_to_sheet(aba.linhas.length ? aba.linhas : [{ Aviso: 'Nenhum registro com os filtros atuais' }])
    const colunas = Object.keys(aba.linhas[0] || { Aviso: '' })
    planilha['!cols'] = colunas.map(c => ({
      wch: Math.min(60, Math.max(c.length, ...aba.linhas.map(l => String(l[c] ?? '').length)) + 2),
    }))
    XLSX.utils.book_append_sheet(livro, planilha, nomeAba(aba.nome))
  })
  const hoje = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(livro, `${arquivo}_${hoje}.xlsx`)
}

/** Data ISO (AAAA-MM-DD) para DD/MM/AAAA, que o Excel mostra certo. */
export function dataExcel(iso?: string | null) {
  if (!iso) return ''
  const [a, m, d] = iso.slice(0, 10).split('-')
  return a && m && d ? `${d}/${m}/${a}` : iso
}

/** Valor numérico com 2 casas, para dar para somar no Excel. */
export function valorExcel(v: unknown) {
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0
}
