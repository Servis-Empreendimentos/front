'use client'
import { useEffect, useState } from 'react'
import Icon from './Icon'
import { s, ACCENT, ACCENT_LT } from '../lib/theme'

// Aviso que aparece uma única vez para cada usuário depois de uma atualização
// do sistema (mesma ideia do aviso da Roesel Transportes).
// Para anunciar uma nova atualização no futuro: troque AVISO_ID e a lista NOVIDADES.
const AVISO_ID = 'servis-novidades-2026-11-organizacao'

const NOVIDADES: { icone: string; titulo: string; texto: string }[] = [
  { icone: 'folder', titulo: 'Menu organizado por assunto', texto: 'Orçamentos, Financeiro e Cadastros agora são grupos. Clicar no grupo já abre a primeira tela dele.' },
  { icone: 'refresh', titulo: 'O sistema lembra onde você estava', texto: 'Se a página recarregar, você volta para a mesma tela, com os mesmos filtros e buscas.' },
  { icone: 'edit', titulo: 'Rascunho automático do orçamento', texto: 'O novo orçamento é guardado enquanto você preenche. Se fechar sem salvar, ele volta na próxima vez.' },
  { icone: 'download', titulo: 'Exportar para Excel', texto: 'Orçamentos, notas fiscais, contas a pagar, contas mensais, folha, fornecedores, inventário e obras têm o botão "Exportar Excel".' },
]

export default function AvisoNovidades({ usuario }: { usuario: string }) {
  const [visivel, setVisivel] = useState(false)
  const chave = `servis:aviso:${AVISO_ID}:${usuario.toLowerCase()}`

  useEffect(() => {
    if (!usuario) return
    try { if (!window.localStorage.getItem(chave)) setVisivel(true) } catch {}
  }, [usuario, chave])

  const fechar = () => {
    try { window.localStorage.setItem(chave, new Date().toISOString()) } catch {}
    setVisivel(false)
  }

  if (!visivel) return null

  return (
    <div style={{ ...s.overlay, zIndex: 120, alignItems: 'center' }} role="dialog" aria-modal="true" aria-labelledby="aviso-novidades-titulo">
      <div style={{ ...s.modal, width: 560 }}>
        <div style={{ padding: '1.4rem 1.6rem 1.1rem', background: '#E8F0EC', borderBottom: '1px solid #DDE9E3' }}>
          <p style={{ fontSize: 10, fontWeight: 800, color: ACCENT_LT, textTransform: 'uppercase', letterSpacing: '.16em', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="bell" size={13} color={ACCENT_LT} /> Novidades
          </p>
          <h2 id="aviso-novidades-titulo" style={{ ...s.h1, fontSize: 22, marginTop: 6 }}>O sistema foi atualizado</h2>
        </div>
        <div style={{ padding: '1.2rem 1.6rem', display: 'grid', gap: 14 }}>
          {NOVIDADES.map(n => (
            <div key={n.titulo} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ width: 32, height: 32, borderRadius: 9, background: '#F1F5F3', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
                <Icon name={n.icone} size={16} color={ACCENT_LT} />
              </span>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#626262' }}>{n.titulo}</p>
                <p style={{ margin: '3px 0 0', fontSize: 12.5, color: '#7D7D7D', lineHeight: 1.5 }}>{n.texto}</p>
              </div>
            </div>
          ))}
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#7D7D7D' }}>Se notar algo diferente do esperado, avise o responsável pelo sistema.</p>
        </div>
        <div style={s.mfoot}>
          <button onClick={fechar} style={{ ...s.btnTeal, background: ACCENT }}>Entendi</button>
        </div>
      </div>
    </div>
  )
}
