'use client'

import { useEffect, useRef, useState } from 'react'
import { api, AnexoContrato, ContratoMedicao, MedicaoContrato, Obra, fmtData, fmtR, hojeISO } from '../services/api'
import { ACCENT, ACCENT_LT, s } from '../lib/theme'
import Icon from './Icon'

type Props = { contratos: ContratoMedicao[]; obras: Obra[]; onAtualizar: () => void; notify: (msg: string, ok?: boolean) => void }

const money = (value: string) => Number(value.replace(/\D/g, '')) / 100 || 0
const moneyText = (value: number) => value ? value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : ''
const ACEITA = '.pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx,.xls,.xlsx'

type AnexarNF = { contrato: ContratoMedicao; medicao_id: string; nf_numero: string; arquivos: File[] }

// Campo de arquivo com a mesma cara dos outros campos do sistema.
function CampoArquivos({ arquivos, onChange, multiplo = true, texto }: { arquivos: File[]; onChange: (files: File[]) => void; multiplo?: boolean; texto: string }) {
  const ref = useRef<HTMLInputElement>(null)
  return <div>
    <input ref={ref} type="file" accept={ACEITA} multiple={multiplo} style={{ display: 'none' }} onChange={e => { onChange(Array.from(e.target.files || [])); e.target.value = '' }} />
    <button type="button" onClick={() => ref.current?.click()} style={{ ...s.fi, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: arquivos.length ? '#626262' : '#969696', textAlign: 'left' }}>
      <Icon name="upload" size={14} color={ACCENT_LT} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{arquivos.length ? arquivos.map(f => f.name).join(', ') : texto}</span>
    </button>
    {arquivos.length > 0 && <button type="button" onClick={() => onChange([])} style={{ background: 'none', border: 'none', color: '#969696', fontSize: 11, cursor: 'pointer', padding: '4px 0 0' }}>Remover arquivo{arquivos.length > 1 ? 's' : ''}</button>}
  </div>
}

function LinhaAnexo({ anexo, medicao, podeExcluir, onExcluir }: { anexo: AnexoContrato; medicao?: MedicaoContrato; podeExcluir: boolean; onExcluir: () => void }) {
  const detalhe = [anexo.nf_numero ? `NF ${anexo.nf_numero}` : '', medicao ? `Medição ${medicao.numero}` : '', anexo.criado_em ? fmtData(anexo.criado_em.slice(0, 10)) : '', anexo.enviado_por || ''].filter(Boolean).join(' · ')
  return <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 11 }}>
    <a href={anexo.arquivo_url} target="_blank" rel="noreferrer" title="Abrir arquivo" style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, flex: 1, color: '#626262', textDecoration: 'none' }}>
      <Icon name="fileText" size={15} color={ACCENT_LT} />
      <span style={{ minWidth: 0 }}>
        <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'underline', textDecorationColor: '#C9D6D0' }}>{anexo.nome}</strong>
        {detalhe && <span style={{ color: '#969696' }}>{detalhe}</span>}
      </span>
    </a>
    {podeExcluir && <button onClick={onExcluir} title="Excluir anexo" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#969696', padding: 4 }}><Icon name="trash" size={14} /></button>}
  </div>
}

export default function ContratosMedicaoView({ contratos, obras, onAtualizar, notify }: Props) {
  const [novo, setNovo] = useState(false)
  const [medicaoContrato, setMedicaoContrato] = useState<ContratoMedicao | null>(null)
  const [form, setForm] = useState({ titulo: '', fornecedor: '', obra_id: '', valor_total: '', observacoes: '' })
  const [medicao, setMedicao] = useState({ valor: '', data_medicao: hojeISO(), nf_numero: '', observacoes: '' })
  const [arquivoContrato, setArquivoContrato] = useState<File[]>([])
  const [arquivoNFMedicao, setArquivoNFMedicao] = useState<File[]>([])
  const [anexarNF, setAnexarNF] = useState<AnexarNF | null>(null)
  const [enviando, setEnviando] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [busca, setBusca] = useState('')
  const [usuario, setUsuario] = useState<{ nome?: string; role?: string }>({})
  const inputContrato = useRef<HTMLInputElement>(null)
  const contratoAlvo = useRef<ContratoMedicao | null>(null)

  useEffect(() => {
    fetch('/api/auth/me', { cache: 'no-store' }).then(r => r.ok ? r.json() : {}).then(setUsuario).catch(() => {})
  }, [])
  const ehGestora = usuario.role === 'gestora'

  const totalContratado = contratos.reduce((sum, contrato) => sum + contrato.valor_total, 0)
  const totalMedido = contratos.reduce((sum, contrato) => sum + (contrato.medicoes || []).reduce((acc, item) => acc + item.valor, 0), 0)
  const filtrados = contratos.filter(contrato => `${contrato.titulo} ${contrato.fornecedor || ''}`.toLowerCase().includes(busca.toLowerCase()))

  // Envia os arquivos um a um. Devolve quantos foram salvos e a primeira mensagem de erro, se houver.
  const enviarArquivos = async (files: File[], dados: Parameters<typeof api.anexarArquivoContrato>[1]) => {
    let ok = 0; let erro = ''
    for (const file of files) {
      try { await api.anexarArquivoContrato(file, { ...dados, enviado_por: usuario.nome || null }); ok++ }
      catch (err: any) { if (!erro) erro = err?.message || 'Falha ao enviar arquivo' }
    }
    return { ok, erro }
  }

  const salvarContrato = async () => {
    if (!form.titulo.trim()) return notify('Informe o nome do contrato', false)
    if (money(form.valor_total) <= 0) return notify('Informe o valor total do contrato', false)
    setSaving(true)
    try {
      const criado = await api.criarContratoMedicao({ titulo: form.titulo.trim(), fornecedor: form.fornecedor.trim() || null, obra_id: form.obra_id || null, valor_total: money(form.valor_total), observacoes: form.observacoes.trim() || null, ativo: true })
      let aviso = ''
      if (arquivoContrato.length && criado?.id) {
        const { erro } = await enviarArquivos(arquivoContrato, { contrato_id: criado.id, tipo: 'contrato' })
        if (erro) aviso = ` Mas o arquivo não foi anexado: ${erro}`
      }
      setNovo(false); setForm({ titulo: '', fornecedor: '', obra_id: '', valor_total: '', observacoes: '' }); setArquivoContrato([]); onAtualizar()
      notify('Contrato cadastrado!' + aviso, !aviso)
    } catch (err: any) {
      notify('Erro ao salvar contrato: ' + (err?.message || 'tente novamente'), false)
    } finally { setSaving(false) }
  }

  const salvarMedicao = async () => {
    if (!medicaoContrato) return
    if (money(medicao.valor) <= 0) return notify('Informe o valor da medição', false)
    if (!medicao.data_medicao) return notify('Informe a data do pagamento', false)
    const acumulado = (medicaoContrato.medicoes || []).reduce((sum, item) => sum + item.valor, 0)
    if (acumulado + money(medicao.valor) > medicaoContrato.valor_total + 0.009) return notify(`O valor passa do saldo do contrato (${fmtR(medicaoContrato.valor_total - acumulado)})`, false)
    const proximoNumero = Math.max(0, ...(medicaoContrato.medicoes || []).map(item => item.numero || 0)) + 1
    setSaving(true)
    try {
      const criada = await api.criarMedicaoContrato({ contrato_id: medicaoContrato.id, numero: proximoNumero, valor: money(medicao.valor), data_medicao: medicao.data_medicao, nf_numero: medicao.nf_numero.trim() || null, observacoes: medicao.observacoes.trim() || null, pago: true })
      let aviso = ''
      if (arquivoNFMedicao.length) {
        const { erro } = await enviarArquivos(arquivoNFMedicao, { contrato_id: medicaoContrato.id, tipo: 'nota_fiscal', medicao_id: criada?.id || null, nf_numero: medicao.nf_numero.trim() || null })
        if (erro) aviso = ` Mas a nota fiscal não foi anexada: ${erro}`
      }
      setMedicaoContrato(null); setMedicao({ valor: '', data_medicao: hojeISO(), nf_numero: '', observacoes: '' }); setArquivoNFMedicao([]); onAtualizar()
      notify(`Medição ${proximoNumero} registrada!` + aviso, !aviso)
    } catch (err: any) {
      notify('Erro ao salvar medição: ' + (err?.message || 'tente novamente'), false)
    } finally { setSaving(false) }
  }

  // "Anexar contrato" abre direto a escolha do arquivo e já envia.
  const escolherContrato = (contrato: ContratoMedicao) => { contratoAlvo.current = contrato; inputContrato.current?.click() }
  const enviarContrato = async (files: File[]) => {
    const contrato = contratoAlvo.current
    if (!contrato || !files.length) return
    setEnviando(contrato.id)
    const { ok, erro } = await enviarArquivos(files, { contrato_id: contrato.id, tipo: 'contrato' })
    setEnviando(null)
    if (ok) onAtualizar()
    notify(erro ? (ok ? `${ok} arquivo(s) anexado(s). Erro no restante: ${erro}` : erro) : ok > 1 ? `${ok} arquivos do contrato anexados!` : 'Contrato anexado!', !erro)
  }

  const salvarNF = async () => {
    if (!anexarNF) return
    if (!anexarNF.arquivos.length) return notify('Escolha o arquivo da nota fiscal', false)
    setSaving(true)
    const { ok, erro } = await enviarArquivos(anexarNF.arquivos, { contrato_id: anexarNF.contrato.id, tipo: 'nota_fiscal', medicao_id: anexarNF.medicao_id || null, nf_numero: anexarNF.nf_numero.trim() || null })
    setSaving(false)
    if (ok) { setAnexarNF(null); onAtualizar() }
    notify(erro ? (ok ? `${ok} nota(s) anexada(s). Erro no restante: ${erro}` : erro) : ok > 1 ? `${ok} notas fiscais anexadas!` : 'Nota fiscal anexada!', !erro)
  }

  const excluirAnexo = async (anexo: AnexoContrato) => {
    if (!window.confirm(`Excluir o anexo "${anexo.nome}"?`)) return
    try { await api.excluirAnexoContrato(anexo.id); onAtualizar(); notify('Anexo excluído') }
    catch (err: any) { notify('Erro ao excluir anexo: ' + (err?.message || 'tente novamente'), false) }
  }

  const abrirAnexarNF = (contrato: ContratoMedicao, item?: MedicaoContrato) => setAnexarNF({ contrato, medicao_id: item?.id || '', nf_numero: item?.nf_numero || '', arquivos: [] })
  const fecharModal = () => { if (saving) return; setNovo(false); setMedicaoContrato(null); setAnexarNF(null); setArquivoContrato([]); setArquivoNFMedicao([]) }

  const tituloSecao = { fontSize: 10, fontWeight: 800, color: '#7D7D7D', textTransform: 'uppercase' as const, letterSpacing: '.06em' }
  const btnPequeno = { ...s.btnOut, padding: '.3rem .55rem', fontSize: 11 }

  return <div>
    <input ref={inputContrato} type="file" accept={ACEITA} multiple style={{ display: 'none' }} onChange={e => { const files = Array.from(e.target.files || []); e.target.value = ''; enviarContrato(files) }} />
    <div style={s.row}>
      <div><p className="workspace-eyebrow" style={{ marginBottom: 7 }}>Financeiro</p><h1 style={s.h1}>Contratos por medição</h1><p style={s.p}>Cadastre o valor total do contrato, anexe o contrato e registre cada pagamento conforme as medições e notas fiscais recebidas.</p></div>
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
        const anexos = contrato.anexos || []
        const arquivosContrato = anexos.filter(a => a.tipo === 'contrato')
        const notas = anexos.filter(a => a.tipo !== 'contrato')
        const medicaoDe = (a: AnexoContrato) => (contrato.medicoes || []).find(m => m.id === a.medicao_id)
        return <div key={contrato.id} style={{ padding: '1rem 1.2rem', borderTop: '1px solid #E2E6E4' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'start' }}>
            <div>
              <strong style={{ color: '#374151', fontSize: 14 }}>{contrato.titulo}</strong>
              <p style={{ margin: '4px 0 0', color: '#7D7D7D', fontSize: 11 }}>{contrato.fornecedor || 'Fornecedor não informado'} · {obras.find(o => o.id === contrato.obra_id)?.nome || 'Sem obra'}</p>
            </div>
            <button onClick={() => setMedicaoContrato(contrato)} disabled={saldo <= 0.009} style={{ ...s.btnGrn, padding: '.45rem .7rem', fontSize: 11, opacity: saldo <= 0.009 ? .5 : 1 }}><Icon name="plus" size={12} color="#fff"/> Lançar medição</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginTop: 14, fontSize: 12 }}><span>Contrato<br/><strong>{fmtR(contrato.valor_total)}</strong></span><span>Pago ({contrato.medicoes?.length || 0} medições)<br/><strong style={{ color: ACCENT_LT }}>{fmtR(pago)}</strong></span><span>Saldo<br/><strong style={{ color: saldo > 0.009 ? '#626262' : ACCENT_LT }}>{fmtR(saldo)}</strong></span></div>
          {(contrato.medicoes || []).length > 0 && <div style={{ marginTop: 12, borderTop: '1px solid #EDF0EE', paddingTop: 9 }}>{(contrato.medicoes || []).map(item => {
            const nfs = notas.filter(a => a.medicao_id === item.id)
            return <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '6px 0', fontSize: 11, color: '#626262', flexWrap: 'wrap' }}>
              <span><strong>Medição {item.numero}</strong> · {fmtData(item.data_medicao)}{item.nf_numero ? ` · NF ${item.nf_numero}` : ''}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {nfs.length > 0
                  ? nfs.map(a => <a key={a.id} href={a.arquivo_url} target="_blank" rel="noreferrer" title={a.nome} style={{ display: 'flex', alignItems: 'center', gap: 4, color: ACCENT_LT, fontWeight: 700, textDecoration: 'none' }}><Icon name="fileText" size={13} color={ACCENT_LT}/> Ver NF</a>)
                  : <button onClick={() => abrirAnexarNF(contrato, item)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#969696', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, padding: 0 }}><Icon name="upload" size={12}/> Anexar NF</button>}
                <strong style={{ color: ACCENT_LT }}>{fmtR(item.valor)}</strong>
              </span>
            </div>
          })}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 12, marginTop: 12 }}>
            <div style={{ border: '1px solid #EDF0EE', borderRadius: 10, padding: '.7rem .8rem', background: '#FAFBFA' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={tituloSecao}>Contrato ({arquivosContrato.length})</span>
                <button onClick={() => escolherContrato(contrato)} disabled={enviando === contrato.id} style={{ ...btnPequeno, opacity: enviando === contrato.id ? .6 : 1 }}><Icon name="upload" size={12}/> {enviando === contrato.id ? 'Enviando...' : 'Anexar contrato'}</button>
              </div>
              {arquivosContrato.length === 0 ? <p style={{ margin: '8px 0 0', fontSize: 11, color: '#969696' }}>Nenhum arquivo do contrato anexado.</p> : arquivosContrato.map(a => <LinhaAnexo key={a.id} anexo={a} podeExcluir={ehGestora} onExcluir={() => excluirAnexo(a)} />)}
            </div>
            <div style={{ border: '1px solid #EDF0EE', borderRadius: 10, padding: '.7rem .8rem', background: '#FAFBFA' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={tituloSecao}>Notas fiscais ({notas.length})</span>
                <button onClick={() => abrirAnexarNF(contrato)} style={btnPequeno}><Icon name="upload" size={12}/> Anexar nota fiscal</button>
              </div>
              {notas.length === 0 ? <p style={{ margin: '8px 0 0', fontSize: 11, color: '#969696' }}>Nenhuma nota fiscal anexada.</p> : notas.map(a => <LinhaAnexo key={a.id} anexo={a} medicao={medicaoDe(a)} podeExcluir={ehGestora} onExcluir={() => excluirAnexo(a)} />)}
            </div>
          </div>
        </div>
      })}
    </div>

    {(novo || medicaoContrato) && <div style={s.overlay} onClick={e => e.target === e.currentTarget && fecharModal()}><div style={{ ...s.modal, width: 520 }}><div style={s.mhdr}><h3 style={{ fontSize: 15, fontWeight: 700 }}>{novo ? 'Novo contrato por medição' : `Nova medição — ${medicaoContrato?.titulo}`}</h3><button onClick={fecharModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7D7D7D' }}><Icon name="x" size={20}/></button></div><div style={s.fg}>{novo ? <>
      <div style={{ gridColumn: '1/-1' }}><label style={s.lb}>Nome do contrato *</label><input style={s.fi} value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} placeholder="Ex: Estrutura metálica da obra"/></div>
      <div><label style={s.lb}>Fornecedor</label><input style={s.fi} value={form.fornecedor} onChange={e => setForm({ ...form, fornecedor: e.target.value })}/></div>
      <div><label style={s.lb}>Valor total *</label><input style={s.fi} value={form.valor_total} onChange={e => setForm({ ...form, valor_total: moneyText(money(e.target.value)) })} placeholder="R$ 100.000,00"/></div>
      <div><label style={s.lb}>Obra</label><select style={s.fi} value={form.obra_id} onChange={e => setForm({ ...form, obra_id: e.target.value })}><option value="">Sem obra vinculada</option>{obras.filter(o => o.ativa).map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}</select></div>
      <div><label style={s.lb}>Arquivo do contrato</label><CampoArquivos arquivos={arquivoContrato} onChange={setArquivoContrato} texto="Escolher PDF ou foto"/></div>
      <div style={{ gridColumn: '1/-1' }}><label style={s.lb}>Observações</label><textarea style={{ ...s.fi, minHeight: 70 }} value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })}/></div>
    </> : <>
      <div><label style={s.lb}>Valor da medição *</label><input style={s.fi} value={medicao.valor} onChange={e => setMedicao({ ...medicao, valor: moneyText(money(e.target.value)) })} placeholder="R$ 0,00"/></div>
      <div><label style={s.lb}>Data do pagamento *</label><input type="date" style={s.fi} value={medicao.data_medicao} onChange={e => setMedicao({ ...medicao, data_medicao: e.target.value })}/></div>
      <div><label style={s.lb}>Número da NF</label><input style={s.fi} value={medicao.nf_numero} onChange={e => setMedicao({ ...medicao, nf_numero: e.target.value })}/></div>
      <div><label style={s.lb}>Arquivo da nota fiscal</label><CampoArquivos arquivos={arquivoNFMedicao} onChange={setArquivoNFMedicao} texto="Escolher PDF ou foto"/></div>
      <div style={{ gridColumn: '1/-1' }}><label style={s.lb}>Observações</label><textarea style={{ ...s.fi, minHeight: 70 }} value={medicao.observacoes} onChange={e => setMedicao({ ...medicao, observacoes: e.target.value })} placeholder="Ex: Medição aprovada conforme NF recebida"/></div>
      <p style={{ gridColumn: '1/-1', margin: 0, fontSize: 11, color: '#7D7D7D' }}>Saldo disponível: <strong>{fmtR((medicaoContrato?.valor_total || 0) - (medicaoContrato?.medicoes || []).reduce((sum, item) => sum + item.valor, 0))}</strong></p>
    </>}</div><div style={s.mfoot}><button onClick={fecharModal} style={{ ...s.btnOut, padding: '.5rem 1rem', fontSize: 13 }}>Cancelar</button><button onClick={novo ? salvarContrato : salvarMedicao} disabled={saving} style={{ ...s.btnTeal, opacity: saving ? .6 : 1 }}>{saving ? 'Salvando...' : novo ? 'Cadastrar contrato' : 'Salvar medição'}</button></div></div></div>}

    {anexarNF && <div style={s.overlay} onClick={e => e.target === e.currentTarget && fecharModal()}><div style={{ ...s.modal, width: 480 }}>
      <div style={s.mhdr}><h3 style={{ fontSize: 15, fontWeight: 700 }}>Anexar nota fiscal — {anexarNF.contrato.titulo}</h3><button onClick={fecharModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7D7D7D' }}><Icon name="x" size={20}/></button></div>
      <div style={s.fg}>
        <div style={{ gridColumn: '1/-1' }}><label style={s.lb}>Arquivo(s) da nota fiscal *</label><CampoArquivos arquivos={anexarNF.arquivos} onChange={arquivos => setAnexarNF({ ...anexarNF, arquivos })} texto="Escolher PDF ou foto (pode escolher vários)"/></div>
        <div><label style={s.lb}>Medição</label><select style={s.fi} value={anexarNF.medicao_id} onChange={e => { const m = (anexarNF.contrato.medicoes || []).find(x => x.id === e.target.value); setAnexarNF({ ...anexarNF, medicao_id: e.target.value, nf_numero: anexarNF.nf_numero || m?.nf_numero || '' }) }}><option value="">Sem medição vinculada</option>{(anexarNF.contrato.medicoes || []).map(m => <option key={m.id} value={m.id}>Medição {m.numero} · {fmtData(m.data_medicao)} · {fmtR(m.valor)}</option>)}</select></div>
        <div><label style={s.lb}>Número da NF</label><input style={s.fi} value={anexarNF.nf_numero} onChange={e => setAnexarNF({ ...anexarNF, nf_numero: e.target.value })}/></div>
      </div>
      <div style={s.mfoot}><button onClick={fecharModal} style={{ ...s.btnOut, padding: '.5rem 1rem', fontSize: 13 }}>Cancelar</button><button onClick={salvarNF} disabled={saving} style={{ ...s.btnTeal, opacity: saving ? .6 : 1 }}>{saving ? 'Enviando...' : 'Anexar'}</button></div>
    </div></div>}
  </div>
}
