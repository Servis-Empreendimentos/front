'use client'

import { useMemo, useState } from 'react'
import { api, Funcionario, Viagem, Role, fmtData, hojeISO } from '../services/api'
import { ACCENT, ACCENT_LT, s } from '../lib/theme'
import Icon from './Icon'

type Props = {
  viagens: Viagem[]
  funcionarios: Funcionario[]
  role: Role
  onAtualizar: () => void
  notify: (msg: string, ok?: boolean) => void
}

type FormViagem = {
  funcionario_id: string
  data_inicio: string
  data_fim: string
  destino: string
  finalidade: string
  observacoes: string
}

const blankForm = (): FormViagem => ({
  funcionario_id: '',
  data_inicio: hojeISO(),
  data_fim: hojeISO(),
  destino: '',
  finalidade: '',
  observacoes: '',
})

export default function ViagensView({ viagens, funcionarios, role, onAtualizar, notify }: Props) {
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<FormViagem>(blankForm())
  const [busca, setBusca] = useState('')
  const [fInicio, setFInicio] = useState('')
  const [fFim, setFFim] = useState('')
  const [saving, setSaving] = useState(false)

  const hoje = hojeISO()
  const viagensFiltradas = useMemo(() => viagens
    .filter(item => {
      const funcionario = funcionarios.find(f => f.id === item.funcionario_id)
      const texto = `${funcionario?.nome || ''} ${item.destino} ${item.finalidade || ''}`.toLowerCase()
      if (busca && !texto.includes(busca.toLowerCase())) return false
      if (fInicio && item.data_fim < fInicio) return false
      if (fFim && item.data_inicio > fFim) return false
      return true
    })
    .sort((a, b) => a.data_inicio.localeCompare(b.data_inicio) || a.data_fim.localeCompare(b.data_fim)),
    [viagens, funcionarios, busca, fInicio, fFim])

  const emAndamento = viagens.filter(item => item.data_inicio <= hoje && item.data_fim >= hoje).length
  const proximas = viagens.filter(item => item.data_inicio > hoje).length

  const salvar = async () => {
    if (!form.funcionario_id || !form.data_inicio || !form.data_fim || !form.destino.trim()) return notify('Preencha colaborador, datas e destino', false)
    if (form.data_fim < form.data_inicio) return notify('A data de término não pode ser anterior à de início', false)
    setSaving(true)
    try {
      await api.criarViagem({
        funcionario_id: form.funcionario_id,
        data_inicio: form.data_inicio,
        data_fim: form.data_fim,
        destino: form.destino.trim(),
        finalidade: form.finalidade.trim() || null,
        observacoes: form.observacoes.trim() || null,
      })
      setModal(false)
      setForm(blankForm())
      onAtualizar()
      notify('Viagem cadastrada!')
    } catch (err: any) {
      notify('Erro ao salvar viagem: ' + (err?.message || 'tente novamente'), false)
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

  const nomeFuncionario = (id: string) => funcionarios.find(item => item.id === id)?.nome || 'Colaborador não encontrado'
  const status = (item: Viagem) => item.data_fim < hoje ? { label: 'Encerrada', color: '#7D7D7D', bg: '#F1F4F2' } : item.data_inicio <= hoje ? { label: 'Em andamento', color: ACCENT_LT, bg: '#E8F0EB' } : { label: 'Programada', color: '#8A6A25', bg: '#FCF8EC' }

  return <div>
    <div style={s.row}>
      <div>
        <p className="workspace-eyebrow" style={{ marginBottom: 7 }}>Operação</p>
        <h1 style={s.h1}>Viagens</h1>
        <p style={s.p}>Registre os períodos de viagem dos colaboradores para acompanhar a programação da equipe.</p>
      </div>
      <button onClick={() => { setForm(blankForm()); setModal(true) }} style={s.btnTeal}><Icon name="plus" size={14} color="#fff"/> Nova viagem</button>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 12, marginBottom: '1.35rem' }}>
      <div style={{ ...s.card, padding: '1rem 1.1rem' }}><span style={{ fontSize: 10, color: '#7D7D7D', textTransform: 'uppercase', fontWeight: 800 }}>Total de viagens</span><strong style={{ display: 'block', marginTop: 10, fontSize: 23, color: ACCENT }}>{viagens.length}</strong></div>
      <div style={{ ...s.card, padding: '1rem 1.1rem' }}><span style={{ fontSize: 10, color: '#7D7D7D', textTransform: 'uppercase', fontWeight: 800 }}>Em andamento</span><strong style={{ display: 'block', marginTop: 10, fontSize: 23, color: ACCENT_LT }}>{emAndamento}</strong></div>
      <div style={{ ...s.card, padding: '1rem 1.1rem' }}><span style={{ fontSize: 10, color: '#7D7D7D', textTransform: 'uppercase', fontWeight: 800 }}>Próximas</span><strong style={{ display: 'block', marginTop: 10, fontSize: 23, color: '#8A6A25' }}>{proximas}</strong></div>
    </div>

    <div style={s.card}>
      <div style={{ ...s.toolbar, justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: '#626262', fontWeight: 800 }}>Programação de viagens</span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input style={{ ...s.inp, width: 210 }} placeholder="Buscar colaborador ou destino" value={busca} onChange={e => setBusca(e.target.value)} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: '#7D7D7D' }}>De <input type="date" style={{ ...s.inp, width: 135 }} value={fInicio} onChange={e => setFInicio(e.target.value)} /></label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: '#7D7D7D' }}>Até <input type="date" style={{ ...s.inp, width: 135 }} value={fFim} onChange={e => setFFim(e.target.value)} /></label>
          {(busca || fInicio || fFim) && <button onClick={() => { setBusca(''); setFInicio(''); setFFim('') }} style={{ ...s.btnOut, padding: '.45rem .7rem', fontSize: 11 }}>Limpar</button>}
        </div>
      </div>
      {viagensFiltradas.length === 0 ? <div style={{ padding: '3rem', textAlign: 'center', color: '#969696', fontSize: 13 }}>Nenhuma viagem encontrada para os filtros informados.</div> : <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', minWidth: 780, borderCollapse: 'collapse', fontSize: 12 }}><thead><tr style={{ borderBottom: '2px solid #E2E6E4', background: '#FAFBFA' }}><th style={{ padding: '10px', textAlign: 'left', color: '#7D7D7D', fontSize: 10, textTransform: 'uppercase' }}>Colaborador</th><th style={{ padding: '10px', textAlign: 'left', color: '#7D7D7D', fontSize: 10, textTransform: 'uppercase' }}>Período</th><th style={{ padding: '10px', textAlign: 'left', color: '#7D7D7D', fontSize: 10, textTransform: 'uppercase' }}>Destino</th><th style={{ padding: '10px', textAlign: 'left', color: '#7D7D7D', fontSize: 10, textTransform: 'uppercase' }}>Finalidade</th><th style={{ padding: '10px', textAlign: 'left', color: '#7D7D7D', fontSize: 10, textTransform: 'uppercase' }}>Status</th><th style={{ padding: '10px', textAlign: 'right' }}></th></tr></thead><tbody>{viagensFiltradas.map(item => { const situacao = status(item); return <tr key={item.id} style={{ borderBottom: '1px solid #E2E6E4' }}><td style={{ padding: '12px 10px', fontWeight: 800, color: '#4B5563' }}>{nomeFuncionario(item.funcionario_id)}</td><td style={{ padding: '12px 10px', color: '#626262', whiteSpace: 'nowrap' }}>{fmtData(item.data_inicio)} a {fmtData(item.data_fim)}</td><td style={{ padding: '12px 10px', color: '#626262' }}>{item.destino}</td><td style={{ padding: '12px 10px', color: '#7D7D7D' }}>{item.finalidade || '—'}</td><td style={{ padding: '12px 10px' }}><span style={{ display: 'inline-block', borderRadius: 999, padding: '5px 8px', background: situacao.bg, color: situacao.color, fontSize: 10, fontWeight: 800 }}>{situacao.label}</span></td><td style={{ padding: '12px 10px', textAlign: 'right' }}>{role === 'gestora' && <button onClick={() => excluir(item)} style={{ ...s.btnRed, padding: '.35rem .55rem', fontSize: 10 }}><Icon name="trash" size={12}/> Excluir</button>}</td></tr> })}</tbody></table></div>}
      <div style={{ padding: '.6rem 1.1rem', borderTop: '1px solid #E2E6E4', fontSize: 11, color: '#7D7D7D', background: '#FAFBFA' }}>{viagensFiltradas.length} viagem{viagensFiltradas.length !== 1 ? 's' : ''} exibida{viagensFiltradas.length !== 1 ? 's' : ''} · ordenadas do período mais antigo para o mais recente</div>
    </div>

    {modal && <div style={s.overlay} onClick={e => e.target === e.currentTarget && !saving && setModal(false)}><div style={{ ...s.modal, width: 560 }}><div style={s.mhdr}><h3 style={{ fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="calendar" size={16}/> Nova viagem</h3><button onClick={() => setModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7D7D7D' }}><Icon name="x" size={20}/></button></div><div style={s.fg}><div style={{ gridColumn: '1/-1' }}><label style={s.lb}>Colaborador *</label><select style={s.fi} value={form.funcionario_id} onChange={e => setForm({ ...form, funcionario_id: e.target.value })}><option value="">Selecione o colaborador</option>{funcionarios.filter(item => item.ativo).sort((a, b) => a.nome.localeCompare(b.nome)).map(item => <option key={item.id} value={item.id}>{item.nome}{item.cargo ? ` — ${item.cargo}` : ''}</option>)}</select></div><div><label style={s.lb}>Data de início *</label><input type="date" style={s.fi} value={form.data_inicio} onChange={e => setForm({ ...form, data_inicio: e.target.value })}/></div><div><label style={s.lb}>Data de término *</label><input type="date" style={s.fi} min={form.data_inicio} value={form.data_fim} onChange={e => setForm({ ...form, data_fim: e.target.value })}/></div><div style={{ gridColumn: '1/-1' }}><label style={s.lb}>Destino *</label><input style={s.fi} value={form.destino} onChange={e => setForm({ ...form, destino: e.target.value })} placeholder="Ex: Belo Horizonte/MG"/></div><div style={{ gridColumn: '1/-1' }}><label style={s.lb}>Finalidade</label><input style={s.fi} value={form.finalidade} onChange={e => setForm({ ...form, finalidade: e.target.value })} placeholder="Ex: Visita técnica, compra de materiais, treinamento"/></div><div style={{ gridColumn: '1/-1' }}><label style={s.lb}>Observações</label><textarea style={{ ...s.fi, minHeight: 70, resize: 'vertical' as const }} value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })}/></div>{form.data_fim < form.data_inicio && <p style={{ gridColumn: '1/-1', color: '#9A5B42', fontSize: 11, margin: 0 }}>A data de término não pode ser anterior à data de início.</p>}</div><div style={s.mfoot}><button onClick={() => setModal(false)} style={{ ...s.btnOut, padding: '.5rem 1rem', fontSize: 13 }}>Cancelar</button><button onClick={salvar} disabled={saving || !form.funcionario_id || !form.destino.trim() || form.data_fim < form.data_inicio} style={{ ...s.btnTeal, opacity: saving ? .6 : 1 }}>{saving ? 'Salvando...' : 'Cadastrar viagem'}</button></div></div></div>}
  </div>
}
