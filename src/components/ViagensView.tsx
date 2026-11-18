'use client'

import { useMemo, useState } from 'react'
import { api, Funcionario, Viagem, Role, fmtData, fmtR, hojeISO, mascaraMoeda, moedaParaCampo, parseMoeda } from '../services/api'
import { ACCENT, ACCENT_LT, s } from '../lib/theme'
import { exportarExcel, dataExcel, valorExcel } from '../lib/exportarExcel'
import Icon from './Icon'

// Viagens: lança só a compra da passagem — valor, data da compra e empresa.
// Registros antigos (com colaborador, período e destino) continuam aparecendo
// e podem ser completados pelo botão "Editar".

type Props = {
  viagens: Viagem[]
  funcionarios: Funcionario[]
  role: Role
  onAtualizar: () => void
  notify: (msg: string, ok?: boolean) => void
}

type FormViagem = {
  valor: string
  data_compra: string
  empresa: string
}

const blankForm = (): FormViagem => ({ valor: '', data_compra: hojeISO(), empresa: '' })

const th = { padding: '10px', textAlign: 'left' as const, color: '#7D7D7D', fontSize: 10, textTransform: 'uppercase' as const }

function mensagemErro(err: any) {
  const msg = String(err?.message || '')
  if (/data_compra|empresa|valor/.test(msg) && /column|coluna|schema/i.test(msg)) {
    return 'o banco ainda não tem os campos novos de viagem. Rode o arquivo viagens-campos-novos.sql no Supabase.'
  }
  return msg || 'tente novamente'
}

export default function ViagensView({ viagens, funcionarios, role, onAtualizar, notify }: Props) {
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<Viagem | null>(null)
  const [form, setForm] = useState<FormViagem>(blankForm())
  const [busca, setBusca] = useState('')
  const [fInicio, setFInicio] = useState('')
  const [fFim, setFFim] = useState('')
  const [saving, setSaving] = useState(false)

  const hoje = hojeISO()
  const mesAtual = hoje.slice(0, 7)
  const dataRef = (item: Viagem) => item.data_compra || ''

  const viagensFiltradas = useMemo(() => viagens
    .filter(item => {
      const texto = `${item.empresa || ''} ${item.destino || ''}`.toLowerCase()
      if (busca && !texto.includes(busca.toLowerCase())) return false
      if (fInicio && (!item.data_compra || item.data_compra < fInicio)) return false
      if (fFim && (!item.data_compra || item.data_compra > fFim)) return false
      return true
    })
    .sort((a, b) => dataRef(b).localeCompare(dataRef(a)) || String(b.criado_em || '').localeCompare(String(a.criado_em || ''))),
    [viagens, busca, fInicio, fFim])

  const totalGeral = viagens.reduce((soma, item) => soma + (Number(item.valor) || 0), 0)
  const totalMes = viagens.filter(item => (item.data_compra || '').startsWith(mesAtual)).reduce((soma, item) => soma + (Number(item.valor) || 0), 0)
  const totalFiltrado = viagensFiltradas.reduce((soma, item) => soma + (Number(item.valor) || 0), 0)

  const abrirNova = () => { setEditando(null); setForm(blankForm()); setModal(true) }
  const abrirEdicao = (item: Viagem) => {
    setEditando(item)
    setForm({ valor: moedaParaCampo(item.valor ?? null), data_compra: item.data_compra || hojeISO(), empresa: item.empresa || '' })
    setModal(true)
  }

  const valorNum = parseMoeda(form.valor)
  const podeSalvar = valorNum > 0 && !!form.data_compra && !!form.empresa.trim()

  const salvar = async () => {
    if (!podeSalvar) return notify('Preencha valor, data da compra e empresa', false)
    setSaving(true)
    const payload = { valor: valorNum, data_compra: form.data_compra, empresa: form.empresa.trim() }
    try {
      if (editando) await api.atualizarViagem(editando.id, payload)
      else await api.criarViagem(payload)
      setModal(false)
      setEditando(null)
      setForm(blankForm())
      onAtualizar()
      notify(editando ? 'Viagem atualizada!' : 'Viagem cadastrada!')
    } catch (err: any) {
      notify('Erro ao salvar viagem: ' + mensagemErro(err), false)
    } finally {
      setSaving(false)
    }
  }

  const excluir = async (viagem: Viagem) => {
    if (!confirm('Excluir esta viagem?')) return
    try {
      await api.excluirViagem(viagem.id)
      onAtualizar()
      notify('Viagem excluída!')
    } catch (err: any) {
      notify('Erro ao excluir viagem: ' + (err?.message || 'tente novamente'), false)
    }
  }

  const exportar = async () => {
    try {
      await exportarExcel('viagens', [{
        nome: 'Viagens',
        linhas: viagensFiltradas.map(item => ({
          'Data da compra': dataExcel(item.data_compra),
          'Empresa': item.empresa || '',
          'Valor': item.valor != null ? valorExcel(item.valor) : '',
        })),
      }])
      notify('Planilha gerada. Confira a pasta de downloads.')
    } catch (err: any) {
      notify('Erro ao gerar planilha: ' + (err?.message || 'tente novamente'), false)
    }
  }

  // Texto de apoio só para registros antigos, que ainda não têm os dados da compra.
  const resumoAntigo = (item: Viagem) => {
    const nome = item.funcionario_id ? funcionarios.find(f => f.id === item.funcionario_id)?.nome : ''
    const partes = [nome, item.destino, item.data_inicio ? fmtData(item.data_inicio) : ''].filter(Boolean)
    return partes.length ? `Registro antigo: ${partes.join(' · ')}` : 'Registro antigo'
  }

  return <div>
    <div style={s.row}>
      <div>
        <p className="workspace-eyebrow" style={{ marginBottom: 7 }}>Operação</p>
        <h1 style={s.h1}>Viagens</h1>
        <p style={s.p}>Lance as passagens compradas: valor, data da compra e empresa.</p>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={exportar} style={s.btnOut} title="Baixar esta lista em Excel"><Icon name="download" size={14}/> Exportar Excel</button>
        <button onClick={abrirNova} style={s.btnTeal}><Icon name="plus" size={14} color="#fff"/> Nova viagem</button>
      </div>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 12, marginBottom: '1.35rem' }}>
      <div style={{ ...s.card, padding: '1rem 1.1rem' }}><span style={{ fontSize: 10, color: '#7D7D7D', textTransform: 'uppercase', fontWeight: 800 }}>Total de viagens</span><strong style={{ display: 'block', marginTop: 10, fontSize: 23, color: ACCENT }}>{viagens.length}</strong></div>
      <div style={{ ...s.card, padding: '1rem 1.1rem' }}><span style={{ fontSize: 10, color: '#7D7D7D', textTransform: 'uppercase', fontWeight: 800 }}>Gasto no mês</span><strong style={{ display: 'block', marginTop: 10, fontSize: 23, color: ACCENT_LT }}>{fmtR(totalMes)}</strong></div>
      <div style={{ ...s.card, padding: '1rem 1.1rem' }}><span style={{ fontSize: 10, color: '#7D7D7D', textTransform: 'uppercase', fontWeight: 800 }}>Gasto total</span><strong style={{ display: 'block', marginTop: 10, fontSize: 23, color: '#8A6A25' }}>{fmtR(totalGeral)}</strong></div>
    </div>

    <div style={s.card}>
      <div style={{ ...s.toolbar, justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: '#626262', fontWeight: 800 }}>Passagens compradas</span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input style={{ ...s.inp, width: 210 }} placeholder="Buscar empresa" value={busca} onChange={e => setBusca(e.target.value)} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: '#7D7D7D' }}>De <input type="date" style={{ ...s.inp, width: 135 }} value={fInicio} onChange={e => setFInicio(e.target.value)} /></label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: '#7D7D7D' }}>Até <input type="date" style={{ ...s.inp, width: 135 }} value={fFim} onChange={e => setFFim(e.target.value)} /></label>
          {(busca || fInicio || fFim) && <button onClick={() => { setBusca(''); setFInicio(''); setFFim('') }} style={{ ...s.btnOut, padding: '.45rem .7rem', fontSize: 11 }}>Limpar</button>}
        </div>
      </div>
      {viagensFiltradas.length === 0
        ? <div style={{ padding: '3rem', textAlign: 'center', color: '#969696', fontSize: 13 }}>Nenhuma viagem encontrada para os filtros informados.</div>
        : <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr style={{ borderBottom: '2px solid #E2E6E4', background: '#FAFBFA' }}>
              <th style={th}>Data da compra</th>
              <th style={th}>Empresa</th>
              <th style={{ ...th, textAlign: 'right' }}>Valor</th>
              <th style={{ padding: '10px', textAlign: 'right' }}></th>
            </tr></thead>
            <tbody>{viagensFiltradas.map(item => {
              const antigo = !item.data_compra && !item.empresa && item.valor == null
              return <tr key={item.id} style={{ borderBottom: '1px solid #E2E6E4' }}>
                <td style={{ padding: '12px 10px', color: '#626262', whiteSpace: 'nowrap' }}>{fmtData(item.data_compra)}</td>
                <td style={{ padding: '12px 10px', fontWeight: 800, color: '#4B5563' }}>
                  {item.empresa || '—'}
                  {antigo && <span style={{ display: 'block', fontWeight: 400, fontSize: 10, color: '#969696', marginTop: 3 }}>{resumoAntigo(item)}</span>}
                </td>
                <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 800, color: ACCENT, whiteSpace: 'nowrap' }}>{item.valor != null ? fmtR(Number(item.valor)) : '—'}</td>
                <td style={{ padding: '12px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button onClick={() => abrirEdicao(item)} style={{ ...s.btnOut, padding: '.35rem .55rem', fontSize: 10, marginRight: 6 }}>Editar</button>
                  {role === 'gestora' && <button onClick={() => excluir(item)} style={{ ...s.btnRed, padding: '.35rem .55rem', fontSize: 10 }}><Icon name="trash" size={12}/> Excluir</button>}
                </td>
              </tr>
            })}</tbody>
          </table>
        </div>}
      <div style={{ padding: '.6rem 1.1rem', borderTop: '1px solid #E2E6E4', fontSize: 11, color: '#7D7D7D', background: '#FAFBFA', display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <span>{viagensFiltradas.length} viagem{viagensFiltradas.length !== 1 ? 's' : ''} exibida{viagensFiltradas.length !== 1 ? 's' : ''} · da compra mais recente para a mais antiga</span>
        <strong style={{ color: '#626262' }}>Total exibido: {fmtR(totalFiltrado)}</strong>
      </div>
    </div>

    {modal && <div style={s.overlay} onClick={e => e.target === e.currentTarget && !saving && setModal(false)}>
      <div style={{ ...s.modal, width: 460 }}>
        <div style={s.mhdr}>
          <h3 style={{ fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="truck" size={16}/> {editando ? 'Editar viagem' : 'Nova viagem'}</h3>
          <button onClick={() => setModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7D7D7D' }}><Icon name="x" size={20}/></button>
        </div>
        <div style={s.fg}>
          <div><label style={s.lb}>Valor da compra *</label><input style={s.fi} inputMode="numeric" value={form.valor} onChange={e => setForm({ ...form, valor: mascaraMoeda(e.target.value) })} placeholder="R$ 0,00" autoFocus/></div>
          <div><label style={s.lb}>Data da compra *</label><input type="date" style={s.fi} value={form.data_compra} onChange={e => setForm({ ...form, data_compra: e.target.value })}/></div>
          <div style={{ gridColumn: '1/-1' }}><label style={s.lb}>Empresa onde a passagem foi comprada *</label><input style={s.fi} value={form.empresa} onChange={e => setForm({ ...form, empresa: e.target.value })} placeholder="Ex: LATAM, Gol, Azul, 123milhas"/></div>
          {editando && !editando.data_compra && <p style={{ gridColumn: '1/-1', color: '#7D7D7D', fontSize: 11, margin: 0 }}>{resumoAntigo(editando)}</p>}
        </div>
        <div style={s.mfoot}>
          <button onClick={() => setModal(false)} style={{ ...s.btnOut, padding: '.5rem 1rem', fontSize: 13 }}>Cancelar</button>
          <button onClick={salvar} disabled={saving || !podeSalvar} style={{ ...s.btnTeal, opacity: saving || !podeSalvar ? .6 : 1 }}>{saving ? 'Salvando...' : editando ? 'Salvar alterações' : 'Cadastrar viagem'}</button>
        </div>
      </div>
    </div>}
  </div>
}
