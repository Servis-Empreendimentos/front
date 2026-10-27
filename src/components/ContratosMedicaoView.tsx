'use client'

import { useState } from 'react'
import { api, ContratoMedicao, MedicaoContrato, Obra, fmtData, fmtR } from '../services/api'
import { ACCENT, ACCENT_LT, s } from '../lib/theme'
import Icon from './Icon'

type Props = { contratos: ContratoMedicao[]; obras: Obra[]; onAtualizar: () => void }

const money = (value: string) => Number(value.replace(/\D/g, '')) / 100 || 0
const moneyText = (value: number) => value ? value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : ''

export default function ContratosMedicaoView({ contratos, obras, onAtualizar }: Props) {
  const [novo, setNovo] = useState(false)
  const [medicaoContrato, setMedicaoContrato] = useState<ContratoMedicao | null>(null)
  const [form, setForm] = useState({ titulo: '', fornecedor: '', obra_id: '', valor_total: '', observacoes: '' })
  const [medicao, setMedicao] = useState({ valor: '', data_medicao: new Date().toISOString().slice(0, 10), nf_numero: '', observacoes: '' })
  const [saving, setSaving] = useState(false)
  const [busca, setBusca] = useState('')

  const totalContratado = contratos.reduce((sum, contrato) => sum + contrato.valor_total, 0)
  const totalMedido = contratos.reduce((sum, contrato) => sum + (contrato.medicoes || []).reduce((acc, item) => acc + item.valor, 0), 0)
  const filtrados = contratos.filter(contrato => `${contrato.titulo} ${contrato.fornecedor || ''}`.toLowerCase().includes(busca.toLowerCase()))

  const salvarContrato = async () => {
    if (!form.titulo.trim() || money(form.valor_total) <= 0) return
    setSaving(true)
    try {
      await api.criarContratoMedicao({ titulo: form.titulo.trim(), fornecedor: form.fornecedor.trim() || null, obra_id: form.obra_id || null, valor_total: money(form.valor_total), observacoes: form.observacoes.trim() || null, ativo: true })
      setNovo(false); setForm({ titulo: '', fornecedor: '', obra_id: '', valor_total: '', observacoes: '' }); onAtualizar()
    } finally { setSaving(false) }
  }

  const salvarMedicao = async () => {
    if (!medicaoContrato || money(medicao.valor) <= 0 || !medicao.data_medicao) return
    const acumulado = (medicaoContrato.medicoes || []).reduce((sum, item) => sum + item.valor, 0)
    if (acumulado + money(medicao.valor) > medicaoContrato.valor_total + 0.009) return
    setSaving(true)
    try {
      await api.criarMedicaoContrato({ contrato_id: medicaoContrato.id, numero: (medicaoContrato.medicoes || []).length + 1, valor: money(medicao.valor), data_medicao: medicao.data_medicao, nf_numero: medicao.nf_numero.trim() || null, observacoes: medicao.observacoes.trim() || null, pago: true })
      setMedicaoContrato(null); setMedicao({ valor: '', data_medicao: new Date().toISOString().slice(0, 10), nf_numero: '', observacoes: '' }); onAtualizar()
    } finally { setSaving(false) }
  }

  return <div>
    <div style={s.row}>
      <div><p className="workspace-eyebrow" style={{ marginBottom: 7 }}>Financeiro</p><h1 style={s.h1}>Contratos por medição</h1><p style={s.p}>Cadastre o valor total do contrato e registre cada pagamento conforme as medições e notas fiscais recebidas.</p></div>
      <button onClick={() => setNovo(true)} style={s.btnTeal}><Icon name="plus" size={14} color="#fff"/> Novo contrato</button>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginBottom: '1.35rem' }}>
      <div style={{ ...s.card, padding: '1rem 1.1rem' }}><span style={{ fontSize: 10, color: '#7D7D7D', textTransform: 'uppercase', fontWeight: 800 }}>Contratos ativos</span><strong style={{ display: 'block', marginTop: 10, fontSize: 23, color: ACCENT }}>{contratos.length}</strong></div>
      <div style={{ ...s.card, padding: '1rem 1.1rem' }}><span style={{ fontSize: 10, color: '#7D7D7D', textTransform: 'uppercase', fontWeight: 800 }}>Valor contratado</span><strong style={{ display: 'block', marginTop: 10, fontSize: 19, color: '#626262' }}>{fmtR(totalContratado)}</strong></div>
      <div style={{ ...s.card, padding: '1rem 1.1rem' }}><span style={{ fontSize: 10, color: '#7D7D7D', textTransform: 'uppercase', fontWeight: 800 }}>Pago por medição</span><strong style={{ display: 'block', marginTop: 10, fontSize: 19, color: ACCENT_LT }}>{fmtR(totalMedido)}</strong></div>
      <div style={{ ...s.card, padding: '1rem 1.1rem' }}><span style={{ fontSize: 10, color: '#7D7D7D', textTransform: 'uppercase', fontWeight: 800 }}>Saldo de contratos</span><strong style={{ display: 'block', marginTop: 10, fontSize: 19, color: '#626262' }}>{fmtR(totalContratado - totalMedido)}</strong></div>
    </div>
    <div style={s.card}>
      <div style={{ ...s.toolbar, justifyContent: 'space-between' }}><span style={{ fontSize: 11, color: '#626262', fontWeight: 800 }}>Contratos cadastrados</span><input style={{ ...s.inp, width: 240 }} placeholder="Buscar contrato ou fornecedor" value={busca} onChange={e => setBusca(e.target.value)} /></div>
      {filtrados.length === 0 ? <div style={{ padding: '3rem', textAlign: 'center', color: '#969696', fontSize: 13 }}>Nenhum contrato cadastrado.</div> : filtrados.map(contrato => {
        const pago = (contrato.medicoes || []).reduce((sum, item) => sum + item.valor, 0)
        const saldo = contrato.valor_total - pago
        return <div key={contrato.id} style={{ padding: '1rem 1.2rem', borderTop: '1px solid #E2E6E4' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'start' }}><div><strong style={{ color: '#374151', fontSize: 14 }}>{contrato.titulo}</strong><p style={{ margin: '4px 0 0', color: '#7D7D7D', fontSize: 11 }}>{contrato.fornecedor || 'Fornecedor não informado'} · {obras.find(o => o.id === contrato.obra_id)?.nome || 'Sem obra'}</p></div><button onClick={() => setMedicaoContrato(contrato)} disabled={saldo <= 0.009} style={{ ...s.btnGrn, padding: '.45rem .7rem', fontSize: 11, opacity: saldo <= 0.009 ? .5 : 1 }}><Icon name="plus" size={12} color="#fff"/> Lançar medição</button></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginTop: 14, fontSize: 12 }}><span>Contrato<br/><strong>{fmtR(contrato.valor_total)}</strong></span><span>Pago ({contrato.medicoes?.length || 0} medições)<br/><strong style={{ color: ACCENT_LT }}>{fmtR(pago)}</strong></span><span>Saldo<br/><strong style={{ color: saldo > 0.009 ? '#626262' : ACCENT_LT }}>{fmtR(saldo)}</strong></span></div>
          {(contrato.medicoes || []).length > 0 && <div style={{ marginTop: 12, borderTop: '1px solid #EDF0EE', paddingTop: 9 }}>{(contrato.medicoes || []).map(item => <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '6px 0', fontSize: 11, color: '#626262' }}><span><strong>Medição {item.numero}</strong> · {fmtData(item.data_medicao)}{item.nf_numero ? ` · NF ${item.nf_numero}` : ''}</span><strong style={{ color: ACCENT_LT }}>{fmtR(item.valor)}</strong></div>)}</div>}
        </div>
      })}
    </div>

    {(novo || medicaoContrato) && <div style={s.overlay} onClick={e => e.target === e.currentTarget && !saving && (novo ? setNovo(false) : setMedicaoContrato(null))}><div style={{ ...s.modal, width: 520 }}><div style={s.mhdr}><h3 style={{ fontSize: 15, fontWeight: 700 }}>{novo ? 'Novo contrato por medição' : `Nova medição — ${medicaoContrato?.titulo}`}</h3><button onClick={() => novo ? setNovo(false) : setMedicaoContrato(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7D7D7D' }}><Icon name="x" size={20}/></button></div><div style={s.fg}>{novo ? <><div style={{ gridColumn: '1/-1' }}><label style={s.lb}>Nome do contrato *</label><input style={s.fi} value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} placeholder="Ex: Estrutura metálica da obra"/></div><div><label style={s.lb}>Fornecedor</label><input style={s.fi} value={form.fornecedor} onChange={e => setForm({ ...form, fornecedor: e.target.value })}/></div><div><label style={s.lb}>Valor total *</label><input style={s.fi} value={form.valor_total} onChange={e => setForm({ ...form, valor_total: moneyText(money(e.target.value)) })} placeholder="R$ 100.000,00"/></div><div><label style={s.lb}>Obra</label><select style={s.fi} value={form.obra_id} onChange={e => setForm({ ...form, obra_id: e.target.value })}><option value="">Sem obra vinculada</option>{obras.filter(o => o.ativa).map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}</select></div><div style={{ gridColumn: '1/-1' }}><label style={s.lb}>Observações</label><textarea style={{ ...s.fi, minHeight: 70 }} value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })}/></div></> : <><div><label style={s.lb}>Valor da medição *</label><input style={s.fi} value={medicao.valor} onChange={e => setMedicao({ ...medicao, valor: moneyText(money(e.target.value)) })} placeholder="R$ 0,00"/></div><div><label style={s.lb}>Data do pagamento *</label><input type="date" style={s.fi} value={medicao.data_medicao} onChange={e => setMedicao({ ...medicao, data_medicao: e.target.value })}/></div><div><label style={s.lb}>Número da NF</label><input style={s.fi} value={medicao.nf_numero} onChange={e => setMedicao({ ...medicao, nf_numero: e.target.value })}/></div><div style={{ gridColumn: '1/-1' }}><label style={s.lb}>Observações</label><textarea style={{ ...s.fi, minHeight: 70 }} value={medicao.observacoes} onChange={e => setMedicao({ ...medicao, observacoes: e.target.value })} placeholder="Ex: Medição aprovada conforme NF recebida"/></div><p style={{ gridColumn: '1/-1', margin: 0, fontSize: 11, color: '#7D7D7D' }}>Saldo disponível: <strong>{fmtR((medicaoContrato?.valor_total || 0) - (medicaoContrato?.medicoes || []).reduce((sum, item) => sum + item.valor, 0))}</strong></p></>}</div><div style={s.mfoot}><button onClick={() => novo ? setNovo(false) : setMedicaoContrato(null)} style={{ ...s.btnOut, padding: '.5rem 1rem', fontSize: 13 }}>Cancelar</button><button onClick={novo ? salvarContrato : salvarMedicao} disabled={saving} style={{ ...s.btnTeal, opacity: saving ? .6 : 1 }}>{saving ? 'Salvando...' : novo ? 'Cadastrar contrato' : 'Salvar medição'}</button></div></div></div>}
  </div>
}
