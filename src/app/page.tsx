'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { api, Lancamento, ItemLancamento, ContaMensal, Fornecedor, fmtR, fmtData, fmtCNPJ, PIPELINE, PIPELINE_LOCKED_FROM, PIPELINE_NF_FROM } from '../services/api'
import { s, ACCENT, ACCENT_LT, PIPE_COLORS } from '../lib/theme'
import Icon from '../components/Icon'
import Sidebar from '../components/Sidebar'
import LoginScreen, { USUARIOS } from '../components/LoginScreen'
import { KPI, Badge, StepBadge, FF, AnexoBtn, FornecedorInput, ItensEditor, PipelineStepper } from '../components/ui'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY!
const AI_KEY   = process.env.NEXT_PUBLIC_ANTHROPIC_KEY!

function pipeIdx(st: string) { return PIPELINE.findIndex(p => p.id === st) }
function isLocked(st: string) { return pipeIdx(st) >= pipeIdx(PIPELINE_LOCKED_FROM) }
function canAttachNF(st: string) { return pipeIdx(st) >= pipeIdx(PIPELINE_NF_FROM) }

function addDiasCorridos(dias: number): string {
  const d = new Date(); d.setDate(d.getDate() + dias); return d.toISOString().slice(0,10)
}
function addDiasUteis(dias: number): string {
  let count = 0; const d = new Date()
  while (count < dias) { d.setDate(d.getDate()+1); const dow=d.getDay(); if(dow!==0&&dow!==6) count++ }
  return d.toISOString().slice(0,10)
}

async function sbPatch(table: string, query: string, body: any) {
  const res = await fetch(`${SUPA_URL}/rest/v1/${table}${query}`, {
    method:'PATCH',
    headers:{ apikey:SUPA_KEY, Authorization:`Bearer ${SUPA_KEY}`, 'Content-Type':'application/json', Prefer:'return=minimal' },
    body:JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await res.text())
}

async function lerDocIA(file: File, prompt: string): Promise<any> {
  const base64 = await new Promise<string>((res,rej) => {
    const r = new FileReader()
    r.onload = () => res((r.result as string).split(',')[1])
    r.onerror = () => rej(new Error('Erro'))
    r.readAsDataURL(file)
  })
  const isPDF = file.type === 'application/pdf'
  const mediaType = isPDF ? 'application/pdf' : file.type==='image/png' ? 'image/png' : 'image/jpeg'
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method:'POST',
    headers:{ 'x-api-key':AI_KEY, 'anthropic-version':'2023-06-01', 'content-type':'application/json', 'anthropic-dangerous-direct-browser-access':'true' },
    body:JSON.stringify({
      model:'claude-sonnet-4-5', max_tokens:2000,
      messages:[{ role:'user', content:[
        { type:isPDF?'document':'image', source:{ type:'base64', media_type:mediaType, data:base64 } },
        { type:'text', text:prompt }
      ]}]
    })
  })
  const data = await response.json()
  const text = data.content?.[0]?.text || ''
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('Falhou')
  return JSON.parse(match[0])
}

export default function Home() {
  const [logado,setLogado]=useState(false)
  const [user,setUser]=useState('')
  const [role,setRole]=useState<'lancadora'|'gestora'|'entregador'>('lancadora')
  const [aba,setAba]=useState<'visao'|'lancamentos'|'mensais'|'fornecedores'>('visao')
  const [data,setData]=useState<Lancamento[]>([])
  const [cats,setCats]=useState<any[]>([])
  const [contasMensais,setContasMensais]=useState<ContaMensal[]>([])
  const [fornecedores,setFornecedores]=useState<Fornecedor[]>([])
  const [loading,setLoading]=useState(true)
  const [fPipe,setFPipe]=useState('')
  const [fRec,setFRec]=useState('')
  const [fDataIni,setFDataIni]=useState('')
  const [fDataFim,setFDataFim]=useState('')
  const [search,setSearch]=useState('')
  const [searchForn,setSearchForn]=useState('')
  const [modal,setModal]=useState(false)
  const [detalhe,setDetalhe]=useState<Lancamento|null>(null)
  const [saving,setSaving]=useState(false)
  const [acao,setAcao]=useState('')
  const [toast,setToast]=useState<{msg:string;ok:boolean}|null>(null)
  const [form,setForm]=useState<any>({})
  const [itensOrcamento,setItensOrcamento]=useState<ItemLancamento[]>([])
  const [rawFrete,setRawFrete]=useState('')
  const [loadingIA,setLoadingIA]=useState(false)
  const [loadingAnexo,setLoadingAnexo]=useState(false)
  const [rawDesconto,setRawDesconto]=useState('')
  const [modalEntregaProg,setModalEntregaProg]=useState(false)
  const [entregaTipo,setEntregaTipo]=useState('corridos')
  const [diasEntrega,setDiasEntrega]=useState('')
  const [entregaData1,setEntregaData1]=useState('')
  const [entregaData2State,setEntregaData2State]=useState('')
  const [entregaItens1,setEntregaItens1]=useState('')
  const [entregaItens2,setEntregaItens2]=useState('')
  const [modalFormaPgto,setModalFormaPgto]=useState(false)
  const [formaPgtoTipo,setFormaPgtoTipo]=useState('pix')
  const [formaPgtoParc,setFormaPgtoParc]=useState('')
  const [formaPgtoObs,setFormaPgtoObs]=useState('')
  const [formaPgtoData,setFormaPgtoData]=useState('')
  const [modalNFItens,setModalNFItens]=useState(false)
  const [itensNFEditor,setItensNFEditor]=useState<ItemLancamento[]>([])
  const [nfFileTemp,setNfFileTemp]=useState<File|null>(null)
  const [loadingIANF,setLoadingIANF]=useState(false)
  const [modalMensal,setModalMensal]=useState(false)
  const [formMensal,setFormMensal]=useState<any>({})
  const [modalGerar,setModalGerar]=useState<ContaMensal|null>(null)
  const [valorGerar,setValorGerar]=useState('')
  const [modalPagParcial,setModalPagParcial]=useState(false)
  const [pagParcialTipo,setPagParcialTipo]=useState('pix')
  const [pagParcialValor,setPagParcialValor]=useState('')
  const [pagParcialData,setPagParcialData]=useState('')
  const [pagParcialObs,setPagParcialObs]=useState('')
  const [pagParcialParc,setPagParcialParc]=useState('')
  const [modalFornecedor,setModalFornecedor]=useState(false)
  const [fornecedorEdit,setFornecedorEdit]=useState<Fornecedor|null>(null)
  const [formFornecedor,setFormFornecedor]=useState<{nome:string;cnpj:string}>({nome:'',cnpj:''})

  const orcIARef=useRef<HTMLInputElement>(null)
  const propostaDetRef=useRef<HTMLInputElement>(null)
  const nfDetRef=useRef<HTMLInputElement>(null)

  const showToast=(msg:string,ok=true)=>{setToast({msg,ok});setTimeout(()=>setToast(null),4500)}
  const set=(k:string,v:any)=>setForm((p:any)=>({...p,[k]:v}))
  const setM=(k:string,v:any)=>setFormMensal((p:any)=>({...p,[k]:v}))

  const load=useCallback(async()=>{
    setLoading(true)
    try {
      const [lista,mensais,categorias,forns]=await Promise.all([
        api.listar({status_processo:fPipe,recorrente:fRec}),
        api.listarContasMensais(),
        api.categorias(),
        api.listarFornecedores(),
      ])
      setData(lista);setContasMensais(mensais);setCats(categorias);setFornecedores(forns)
    } catch {showToast('Erro ao carregar dados',false)}
    finally {setLoading(false)}
  },[fPipe,fRec])

  useEffect(()=>{if(logado)load()},[load,logado])

  const openNovo=()=>{
    setForm({data:new Date().toISOString().slice(0,10),pago:false,recorrente:false,status_processo:'orcamento_aprovado',titulo:'',cnpj:''})
    setItensOrcamento([]);setRawFrete('');setRawDesconto('');setDetalhe(null);setModal(true)
  }

  const openDetalhe=async(id:string)=>{
    const d=await api.buscar(id);setDetalhe(d);setModal(true)
  }

  const handleImportarOrcamento=async(file:File)=>{
    setLoadingIA(true)
    try {
      const dados=await lerDocIA(file,`Extraia todos os dados deste orçamento e retorne APENAS um JSON válido:
{"titulo":"nome da empresa","cnpj":"somente números","data":"YYYY-MM-DD","valor_frete":0.00,"itens":[{"nome":"produto","quantidade":1.0,"valor_unitario":0.00}]}`)
      if(dados.titulo) set('titulo',dados.titulo)
      if(dados.cnpj) set('cnpj',dados.cnpj)
      if(dados.data) set('data',dados.data)
      if(dados.valor_frete>0) setRawFrete(dados.valor_frete.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}))
      if(dados.itens?.length>0) {
        setItensOrcamento(dados.itens.map((i:any)=>({
          nome:i.nome||'', quantidade:i.quantidade||1,
          valor_unitario:i.valor_unitario||0,
          valor_total:(i.quantidade||1)*(i.valor_unitario||0),
          tipo:'orcamento' as const,
        })))
        showToast('Orçamento importado com itens!')
      } else {
        showToast('Empresa e dados importados, mas nenhum item foi identificado. Adicione manualmente se precisar.',false)
      }
    } catch {showToast('Não foi possível ler o PDF. Preencha manualmente.',false)}
    finally {setLoadingIA(false)}
  }

  const handleSave=async()=>{
    if(!form.titulo||!form.data) return showToast('Preencha empresa e data',false)
    setSaving(true)
    try {
      const valor_produtos=itensOrcamento.reduce((s,i)=>s+(i.valor_total||0),0)
      const vFrete=parseFloat(rawFrete.replace(/\D/g,''))/100||0
      const valor_total=valor_produtos+vFrete
      await api.criar({...form,valor_produtos,valor_frete:vFrete,valor_total,valor_original:valor_total,criado_por:user,itens:itensOrcamento})
      if(form.titulo) await api.salvarFornecedor(form.titulo,form.cnpj||undefined)
      setModal(false);showToast('Orçamento salvo!');load()
    } catch (err:any) {
      showToast('Erro ao salvar: '+(err?.message||'desconhecido'),false)
    } finally {setSaving(false)}
  }

  const handleSalvarDesconto=async()=>{
    if(!detalhe) return
    const valor_desconto=parseFloat(rawDesconto.replace(/\D/g,''))/100||0
    const valor_total=(detalhe.valor_original||detalhe.valor_total)-valor_desconto
    try {
      await sbPatch('lancamentos',`?id=eq.${detalhe.id}`,{tem_desconto:valor_desconto>0,valor_desconto,valor_total})
      const d=await api.buscar(detalhe.id);setDetalhe(d);setRawDesconto('');showToast('Desconto aplicado!')
    } catch (err:any) { showToast('Erro: '+(err?.message||''),false) }
  }

  const handleAnexarProposta=async(file:File)=>{
    if(!detalhe) return
    setLoadingAnexo(true)
    try {
      const url=await api.uploadArquivo(file)
      await sbPatch('lancamentos',`?id=eq.${detalhe.id}`,{proposta_url:url})
      const d=await api.buscar(detalhe.id);setDetalhe(d);showToast('Proposta anexada!')
    } catch (err:any) {showToast('Erro ao enviar: '+(err?.message||''),false)}
    finally {setLoadingAnexo(false)}
  }

  const handleAnexarNFComIA=async(file:File)=>{
    if(!detalhe) return
    setNfFileTemp(file);setLoadingIANF(true)
    try {
      const dados=await lerDocIA(file,`Extraia todos os itens desta nota fiscal e retorne APENAS um JSON válido:
{"valor_frete":0.00,"itens":[{"nome":"produto","quantidade":1.0,"valor_unitario":0.00}]}`)
      const itens=(dados.itens||[]).map((i:any)=>({
        nome:i.nome||'', quantidade:i.quantidade||1,
        valor_unitario:i.valor_unitario||0,
        valor_total:(i.quantidade||1)*(i.valor_unitario||0),
        tipo:'nf' as const,
      }))
      setItensNFEditor(itens);setModalNFItens(true)
    } catch {
      setItensNFEditor([]);setModalNFItens(true)
      showToast('IA não extraiu itens. Preencha manualmente.',false)
    } finally {setLoadingIANF(false)}
  }

  const handleSalvarNF=async()=>{
    if(!detalhe||!nfFileTemp) return
    setLoadingAnexo(true)
    try {
      const url=await api.uploadArquivo(nfFileTemp)
      await sbPatch('lancamentos',`?id=eq.${detalhe.id}`,{arquivo_url:url})
      await api.salvarItensNF(detalhe.id,itensNFEditor)
      const d=await api.buscar(detalhe.id);setDetalhe(d)
      setModalNFItens(false);setNfFileTemp(null);setItensNFEditor([])
      showToast('NF e itens salvos!')
    } catch (err:any) {showToast('Erro ao salvar NF: '+(err?.message||''),false)}
    finally {setLoadingAnexo(false)}
  }

  const handlePipelineChange=async(novoStatus:string)=>{
    if(!detalhe) return
    if(novoStatus==='entrega_programada'){setEntregaTipo('corridos');setDiasEntrega('');setEntregaData1('');setEntregaData2State('');setEntregaItens1('');setEntregaItens2('');setModalEntregaProg(true);return}
    if(novoStatus==='pagamento_realizado'){setFormaPgtoTipo('pix');setFormaPgtoParc('');setFormaPgtoObs('');setFormaPgtoData(new Date().toISOString().slice(0,10));setModalFormaPgto(true);return}
    try {
      await sbPatch('lancamentos',`?id=eq.${detalhe.id}`,{status_processo:novoStatus})
      const d=await api.buscar(detalhe.id);setDetalhe(d)
      const step=PIPELINE.find(p=>p.id===novoStatus)
      showToast(`${step?.label}`)
      load()
    } catch (err:any) { showToast('Erro: '+(err?.message||''),false) }
  }

  const handleConfirmarFormaPgto=async()=>{
    if(!detalhe||!formaPgtoData) return showToast('Informe a data do pagamento',false)
    setSaving(true)
    try {
      let fp=formaPgtoTipo==='pix'?'PIX':formaPgtoTipo==='boleto'?'Boleto':formaPgtoTipo==='transferencia'?'Transferência':formaPgtoTipo==='cartao'?'Cartão':formaPgtoTipo==='avista'?'À vista':formaPgtoTipo==='parcelado'?`Parcelado${formaPgtoParc?` ${formaPgtoParc}x`:''}`:formaPgtoTipo
      if(formaPgtoObs) fp+=` — ${formaPgtoObs}`
      await sbPatch('lancamentos',`?id=eq.${detalhe.id}`,{status_processo:'pagamento_realizado',pago:true,data_pagamento:formaPgtoData,forma_pagamento:fp})
      const d=await api.buscar(detalhe.id);setDetalhe(d)
      setModalFormaPgto(false);showToast('Pagamento registrado!');load()
    } catch (err:any) { showToast('Erro: '+(err?.message||''),false) }
    finally {setSaving(false)}
  }

  const handleConfirmarPagParcial=async()=>{
    if(!detalhe||!pagParcialData||!pagParcialValor) return showToast('Preencha valor e data',false)
    setSaving(true)
    try {
      const valorNovo=parseFloat(pagParcialValor.replace(/\D/g,''))/100
      const valorPagoAtual=detalhe.valor_produtos||0
      const novoValorPago=valorPagoAtual+valorNovo
      const novoSaldo=Math.max(0,(detalhe.saldo_devedor||0)-valorNovo)
      const quitado=novoSaldo<=0

      let fp=pagParcialTipo==='pix'?'PIX':pagParcialTipo==='boleto'?'Boleto':pagParcialTipo==='transferencia'?'Transferência':pagParcialTipo==='cartao'?'Cartão':pagParcialTipo==='avista'?'À vista':pagParcialTipo==='parcelado'?`Parcelado${pagParcialParc?` ${pagParcialParc}x`:''}`:pagParcialTipo
      if(pagParcialObs) fp+=` — ${pagParcialObs}`

      await sbPatch('lancamentos',`?id=eq.${detalhe.id}`,{
        valor_produtos: novoValorPago,
        saldo_devedor: novoSaldo,
        pago: quitado,
        data_pagamento: pagParcialData,
        forma_pagamento: fp,
      })
      const d=await api.buscar(detalhe.id);setDetalhe(d)
      setModalPagParcial(false)
      setPagParcialValor('');setPagParcialObs('');setPagParcialParc('')
      showToast(quitado?'Pagamento quitado!':'Pagamento parcial registrado!')
      load()
    } catch (err:any) { showToast('Erro: '+(err?.message||''),false) }
    finally {setSaving(false)}
  }

  const handleConfirmarEntregaProg=async()=>{
    if(!detalhe) return
    if(entregaTipo!=='parcial'&&!diasEntrega) return showToast('Informe o número de dias',false)
    if(entregaTipo==='parcial'&&(!entregaData1||!entregaData2State)) return showToast('Informe as duas datas',false)
    setSaving(true)
    try {
      let data_entrega_programada=''
      if(entregaTipo==='corridos') data_entrega_programada=addDiasCorridos(parseInt(diasEntrega))
      else if(entregaTipo==='uteis') data_entrega_programada=addDiasUteis(parseInt(diasEntrega))
      else data_entrega_programada=entregaData1
      await sbPatch('lancamentos',`?id=eq.${detalhe.id}`,{
        status_processo:'entrega_programada',
        dias_entrega:entregaTipo!=='parcial'?parseInt(diasEntrega):null,
        data_entrega_programada,
        entrega_tipo:entregaTipo,
        entrega_data2:entregaTipo==='parcial'?entregaData2State:null,
        entrega_itens1:entregaTipo==='parcial'?entregaItens1:null,
        entrega_itens2:entregaTipo==='parcial'?entregaItens2:null,
      })
      const d=await api.buscar(detalhe.id);setDetalhe(d)
      setModalEntregaProg(false);showToast('Entrega programada!');load()
    } catch (err:any) { showToast('Erro: '+(err?.message||''),false) }
    finally {setSaving(false)}
  }

  const handlePagar=async(parcelaId:string,lancId:string)=>{
    setAcao(parcelaId)
    try {await api.marcarPago(parcelaId);showToast('Pago!');const d=await api.buscar(lancId);setDetalhe(d)}
    catch {showToast('Erro',false)}
    finally {setAcao('')}
  }

  const handleEstornar=async(parcelaId:string,lancId:string)=>{
    setAcao(parcelaId)
    try {await api.estornar(parcelaId);showToast('Estornado!');const d=await api.buscar(lancId);setDetalhe(d)}
    catch {showToast('Erro',false)}
    finally {setAcao('')}
  }

  const handleExcluir=async(id:string)=>{
    if(!confirm('Excluir este lançamento?')) return
    await fetch(`${SUPA_URL}/rest/v1/lancamentos?id=eq.${id}`,{method:'DELETE',headers:{apikey:SUPA_KEY,Authorization:`Bearer ${SUPA_KEY}`}})
    setModal(false);showToast('Excluído!');load()
  }

  const handleMarcarItemEntregue=async(item:ItemLancamento,data_entrega:string)=>{
    if(!detalhe) return
    await api.atualizarItem(item.id!,{entregue:true,data_entrega})
    const d=await api.buscar(detalhe.id)
    const todos=d.itens?.filter((i:any)=>i.tipo==='orcamento')||[]
    const todosEntregues=todos.every((i:any)=>i.entregue)
    if(todosEntregues&&d.status_processo==='entrega_programada') {
      await sbPatch('lancamentos',`?id=eq.${detalhe.id}`,{status_processo:'mercadoria_recebida',status_entrega:'entregue',data_entrega})
    }
    const d2=await api.buscar(detalhe.id);setDetalhe(d2);showToast('Item confirmado!');load()
  }

  const handleSaveMensal=async()=>{
    if(!formMensal.titulo||!formMensal.pago_por||!formMensal.dia_vencimento) return showToast('Preencha todos os campos',false)
    setSaving(true)
    try {
      await api.criarContaMensal({...formMensal,ativo:true})
      setModalMensal(false);setFormMensal({});showToast('Conta mensal cadastrada!');load()
    } catch (err:any) {showToast('Erro: '+(err?.message||''),false)}
    finally {setSaving(false)}
  }

  const handleGerarLancamento=async()=>{
    if(!modalGerar||!valorGerar) return showToast('Informe o valor',false)
    setSaving(true)
    try {
      const lanc=await api.gerarLancamentoMensal(modalGerar,user)
      const valor=parseFloat(valorGerar.replace(/\D/g,''))/100
      await sbPatch('lancamentos',`?id=eq.${lanc.id}`,{valor_total:valor,valor_original:valor,valor_produtos:valor})
      setModalGerar(null);setValorGerar('');showToast('Lançamento gerado!');setAba('lancamentos');load()
    } catch (err:any) {showToast('Erro: '+(err?.message||''),false)}
    finally {setSaving(false)}
  }

  const openNovoFornecedor=()=>{
    setFornecedorEdit(null)
    setFormFornecedor({nome:'',cnpj:''})
    setModalFornecedor(true)
  }
  const openEditarFornecedor=(f:Fornecedor)=>{
    setFornecedorEdit(f)
    setFormFornecedor({nome:f.nome,cnpj:f.cnpj||''})
    setModalFornecedor(true)
  }
  const handleSalvarFornecedor=async()=>{
    if(!formFornecedor.nome.trim()) return showToast('Informe o nome do fornecedor',false)
    setSaving(true)
    try {
      if(fornecedorEdit) {
        await api.atualizarFornecedor(fornecedorEdit.id,{nome:formFornecedor.nome.trim(),cnpj:formFornecedor.cnpj||null})
        showToast('Fornecedor atualizado!')
      } else {
        await api.criarFornecedor(formFornecedor.nome.trim(),formFornecedor.cnpj||undefined)
        showToast('Fornecedor cadastrado!')
      }
      setModalFornecedor(false);load()
    } catch (err:any) {
      showToast('Erro ao salvar: '+(err?.message||''),false)
    } finally {setSaving(false)}
  }
  const handleExcluirFornecedor=async(f:Fornecedor)=>{
    if(!confirm(`Excluir o fornecedor "${f.nome}"?`)) return
    try {
      await api.excluirFornecedor(f.id)
      showToast('Fornecedor excluído!');load()
    } catch (err:any) {
      showToast('Erro ao excluir: '+(err?.message||''),false)
    }
  }

  if(!logado) return <LoginScreen onLogin={(nome,r)=>{setUser(nome);setRole(r);setLogado(true);setAba(r==='entregador'?'lancamentos':'visao')}}/>

  const filtered=data.filter(l=>{
    if(search) {
      const q=search.toLowerCase()
      const matchBusca=[l.titulo,l.cnpj,l.criado_por,l.nf_numero].some(f=>f?.toLowerCase().includes(q))
      if(!matchBusca) return false
    }
    if(fDataIni && l.data < fDataIni) return false
    if(fDataFim && l.data > fDataFim) return false
    return true
  })

  const filteredFornecedores = fornecedores.filter(f=>{
    if(!searchForn) return true
    const q=searchForn.toLowerCase()
    return f.nome.toLowerCase().includes(q) || (f.cnpj||'').includes(q)
  })

  const totalValor=data.reduce((s,l)=>s+l.valor_total,0)
  const totalSaldo=data.reduce((s,l)=>s+(l.saldo_devedor||0),0)
  const totalPagos=data.filter(l=>l.pago).length
  const totalPendente=data.filter(l=>l.status_entrega==='pendente').length
  const th=(label:string)=><th style={{padding:'8px 11px',textAlign:'left',fontSize:10,fontWeight:700,color:'#64748B',textTransform:'uppercase',whiteSpace:'nowrap'}}>{label}</th>

  return (
    <div style={s.page}>

      <Sidebar
        user={user}
        role={role}
        aba={aba}
        setAba={setAba}
        onNovoOrcamento={openNovo}
        onSair={()=>setLogado(false)}
      />

      <div style={s.content}>
        <main style={s.main}>

          {role==='entregador'&&(
            <div>
              <div style={s.row}>
                <div><h1 style={s.h1}>Entregas</h1><p style={s.p}>Confirme os itens recebidos na obra</p></div>
              </div>
              <div style={s.card}>
                <div style={s.toolbar}>
                  <input style={{...s.inp,width:200}} placeholder="Buscar empresa..." value={search} onChange={e=>setSearch(e.target.value)}/>
                  <select style={s.inp} value={fPipe} onChange={e=>setFPipe(e.target.value)}>
                    <option value="">Todas as etapas</option>
                    {PIPELINE.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </div>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                  <thead><tr style={{background:'#FAFBFC',borderBottom:'2px solid #E2E8F0'}}>{th('Empresa')}{th('Etapa')}{th('Data programada')}</tr></thead>
                  <tbody>
                    {loading?<tr><td colSpan={3} style={{textAlign:'center',padding:'3rem',color:'#64748B'}}>Carregando...</td></tr>
                    :filtered.map(l=>{
                      const step=PIPELINE.find(p=>p.id===l.status_processo)
                      const cor=PIPE_COLORS[l.status_processo]||'#64748B'
                      return (
                        <tr key={l.id} onClick={()=>openDetalhe(l.id)} style={{borderBottom:'1px solid #E2E8F0',cursor:'pointer'}}
                          onMouseEnter={e=>(e.currentTarget.style.background='#F8FAFB')} onMouseLeave={e=>(e.currentTarget.style.background='')}>
                          <td style={{padding:'10px 11px',fontWeight:600}}>{l.titulo}</td>
                          <td style={{padding:'10px 11px'}}>{step&&<StepBadge stepId={step.id} label={step.label} color={cor}/>}</td>
                          <td style={{padding:'10px 11px',color:'#64748B'}}>{l.data_entrega_programada?fmtData(l.data_entrega_programada):'—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {role!=='entregador'&&aba==='visao'&&(
            <div>
              <div style={s.row}>
                <div><h1 style={s.h1}>Visão Geral</h1><p style={s.p}>Resumo financeiro · Servis Empreendimentos</p></div>
                <button onClick={openNovo} style={s.btnTeal}><Icon name="plus" size={14} color="#fff"/> Novo orçamento</button>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(5,minmax(0,1fr))',gap:10,marginBottom:'1.25rem'}}>
                <KPI l="Total" v={data.length} sv="lançamentos" c={ACCENT_LT}/>
                <KPI l="Valor total" v={fmtR(totalValor)} sv="soma dos contratos" c="#D97706"/>
                <KPI l="Saldo devedor" v={fmtR(totalSaldo)} sv="valores em aberto" c="#DC2626"/>
                <KPI l="Pagos" v={totalPagos} sv="lançamentos quitados" c="#16A34A"/>
                <KPI l="Entregas pendentes" v={totalPendente} sv="aguardando confirmação" c="#7C3AED"/>
              </div>
              <div style={s.card}>
                <div style={s.toolbar}>
                  <span style={{fontSize:10,fontWeight:700,color:'#64748B',textTransform:'uppercase',letterSpacing:'.1em'}}>Lançamentos recentes</span>
                </div>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                  <thead>
                    <tr style={{background:'#FAFBFC',borderBottom:'2px solid #E2E8F0'}}>
                      {th('Empresa')}{th('Etapa')}{th('Data')}{th('Total')}{th('Saldo Dev.')}{th('Pgto')}
                    </tr>
                  </thead>
                  <tbody>
                    {loading?<tr><td colSpan={6} style={{textAlign:'center',padding:'3rem',color:'#64748B'}}>Carregando...</td></tr>
                    :data.slice(0,8).map(l=>{
                      const step=PIPELINE.find(p=>p.id===l.status_processo)
                      const cor=PIPE_COLORS[l.status_processo]||'#64748B'
                      const temSaldo=l.saldo_devedor&&l.saldo_devedor>0
                      return (
                        <tr key={l.id} onClick={()=>openDetalhe(l.id)} style={{borderBottom:'1px solid #E2E8F0',cursor:'pointer'}}
                          onMouseEnter={e=>(e.currentTarget.style.background='#F8FAFB')} onMouseLeave={e=>(e.currentTarget.style.background='')}>
                          <td style={{padding:'8px 11px',fontWeight:500,maxWidth:180,overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis'}}>{l.titulo}</td>
                          <td style={{padding:'8px 11px'}}>{step&&<StepBadge stepId={step.id} label={step.label} color={cor}/>}</td>
                          <td style={{padding:'8px 11px',color:'#64748B'}}>{fmtData(l.data)}</td>
                          <td style={{padding:'8px 11px',fontWeight:700}}>{fmtR(l.valor_total)}</td>
                          <td style={{padding:'8px 11px',textAlign:'right'}}>{temSaldo?<span style={{color:'#DC2626',fontWeight:700,fontSize:11}}>{fmtR(l.saldo_devedor!)}</span>:<span style={{color:'#CBD5E1'}}>—</span>}</td>
                          <td style={{padding:'8px 11px',textAlign:'center'}}>{l.pago?<Icon name="check" size={14} color="#16A34A"/>:<Icon name="x" size={14} color="#DC2626"/>}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <div style={{padding:'.6rem 1.1rem',borderTop:'1px solid #E2E8F0',fontSize:11,color:'#64748B',background:'#FAFBFC'}}>
                  <button onClick={()=>setAba('lancamentos')} style={{background:'none',border:'none',color:ACCENT,fontWeight:600,cursor:'pointer',fontSize:11,padding:0}}>Ver todos os lançamentos →</button>
                </div>
              </div>
            </div>
          )}

          {role!=='entregador'&&aba==='mensais'&&(
            <div>
              <div style={s.row}>
                <div><h1 style={s.h1}>Contas Mensais</h1><p style={s.p}>Água, luz, internet e outros fixos</p></div>
                <button onClick={()=>setModalMensal(true)} style={s.btnTeal}><Icon name="plus" size={14} color="#fff"/> Nova conta mensal</button>
              </div>
              <div style={s.card}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                  <thead><tr style={{background:'#FAFBFC',borderBottom:'2px solid #E2E8F0'}}>{th('Conta')}{th('Pago por')}{th('Dia venc.')}{th('Status')}{th('Ações')}</tr></thead>
                  <tbody>
                    {contasMensais.length===0&&<tr><td colSpan={5} style={{textAlign:'center',padding:'3rem',color:'#64748B'}}>Nenhuma conta mensal cadastrada</td></tr>}
                    {contasMensais.map(c=>(
                      <tr key={c.id} style={{borderBottom:'1px solid #E2E8F0'}}>
                        <td style={{padding:'10px 11px',fontWeight:600}}>{c.titulo}</td>
                        <td style={{padding:'10px 11px',color:'#64748B'}}>{c.pago_por}</td>
                        <td style={{padding:'10px 11px',textAlign:'center'}}><span style={{background:'#E0F5F7',color:ACCENT_LT,borderRadius:6,padding:'2px 8px',fontWeight:600}}>dia {c.dia_vencimento}</span></td>
                        <td style={{padding:'10px 11px'}}><Badge label={c.ativo?'Ativa':'Inativa'} bg={c.ativo?'#EAF7EE':'#EEF0F3'} color={c.ativo?'#16A34A':'#64748B'}/></td>
                        <td style={{padding:'10px 11px'}}>
                          <div style={{display:'flex',gap:8}}>
                            {c.ativo&&<button onClick={()=>{setModalGerar(c);setValorGerar('')}} style={{...s.btnTeal,padding:'4px 10px',fontSize:11}}><Icon name="plus" size={12} color="#fff"/> Lançar este mês</button>}
                            <button onClick={()=>api.toggleContaMensal(c.id,!c.ativo).then(load)} style={{...s.btnOut,padding:'4px 10px',fontSize:11,color:c.ativo?'#DC2626':'#16A34A'}}>{c.ativo?'Desativar':'Ativar'}</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {role!=='entregador'&&aba==='fornecedores'&&(
            <div>
              <div style={s.row}>
                <div><h1 style={s.h1}>Fornecedores</h1><p style={s.p}>Cadastro de empresas para preenchimento automático nos orçamentos</p></div>
                <button onClick={openNovoFornecedor} style={s.btnTeal}><Icon name="plus" size={14} color="#fff"/> Novo fornecedor</button>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:10,marginBottom:'1.25rem'}}>
                <KPI l="Total de fornecedores" v={fornecedores.length} sv={`${filteredFornecedores.length} exibidos`} c={ACCENT_LT}/>
                <KPI l="Com CNPJ cadastrado" v={fornecedores.filter(f=>f.cnpj).length} sv="dados completos" c="#16A34A"/>
              </div>
              <div style={s.card}>
                <div style={s.toolbar}>
                  <span style={{fontSize:10,fontWeight:700,color:'#64748B',textTransform:'uppercase',letterSpacing:'.1em',flex:1}}>Todos os fornecedores</span>
                  <input style={{...s.inp,width:220}} placeholder="Buscar por nome ou CNPJ..." value={searchForn} onChange={e=>setSearchForn(e.target.value)}/>
                </div>
                <div style={{overflowX:'auto',maxHeight:520,overflowY:'auto'}}>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                    <thead style={{position:'sticky',top:0,zIndex:2}}>
                      <tr style={{background:'#FAFBFC',borderBottom:'2px solid #E2E8F0'}}>
                        {th('Nome')}{th('CNPJ')}{th('Ações')}
                      </tr>
                    </thead>
                    <tbody>
                      {loading?<tr><td colSpan={3} style={{textAlign:'center',padding:'3rem',color:'#64748B'}}>Carregando...</td></tr>
                      :filteredFornecedores.length===0?<tr><td colSpan={3} style={{textAlign:'center',padding:'3rem',color:'#64748B'}}>Nenhum fornecedor cadastrado</td></tr>
                      :filteredFornecedores.map(f=>(
                        <tr key={f.id} style={{borderBottom:'1px solid #E2E8F0'}}
                          onMouseEnter={e=>(e.currentTarget.style.background='#F8FAFB')} onMouseLeave={e=>(e.currentTarget.style.background='')}>
                          <td style={{padding:'10px 11px',fontWeight:600}}>{f.nome}</td>
                          <td style={{padding:'10px 11px',color:'#64748B'}}>{f.cnpj?fmtCNPJ(f.cnpj):'—'}</td>
                          <td style={{padding:'10px 11px'}}>
                            <div style={{display:'flex',gap:8}}>
                              <button onClick={()=>openEditarFornecedor(f)} style={{...s.btnOut,padding:'4px 10px',fontSize:11}}><Icon name="edit" size={12}/> Editar</button>
                              {role==='gestora'&&(
                                <button onClick={()=>handleExcluirFornecedor(f)} style={{...s.btnRed,padding:'4px 10px',fontSize:11}}><Icon name="trash" size={12}/> Excluir</button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{padding:'.5rem 1.1rem',borderTop:'1px solid #E2E8F0',fontSize:11,color:'#64748B',background:'#FAFBFC'}}>
                  {filteredFornecedores.length} fornecedor{filteredFornecedores.length!==1?'es':''} de {fornecedores.length} total
                </div>
              </div>
            </div>
          )}

          {role!=='entregador'&&aba==='lancamentos'&&(
            <div>
              <div style={s.row}>
                <div><h1 style={s.h1}>Orçamentos e Notas Fiscais</h1><p style={s.p}>Controle de pagamentos e entregas · Financeiro</p></div>
                <button onClick={openNovo} style={s.btnTeal}><Icon name="plus" size={14} color="#fff"/> Novo orçamento</button>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(5,minmax(0,1fr))',gap:10,marginBottom:'1.25rem'}}>
                <KPI l="Total" v={data.length} sv={`${filtered.length} exibidos`} c={ACCENT_LT}/>
                <KPI l="Valor total" v={fmtR(totalValor)} sv="soma dos contratos" c="#D97706"/>
                <KPI l="Saldo devedor" v={fmtR(totalSaldo)} sv="valores em aberto" c="#DC2626"/>
                <KPI l="Pagos" v={totalPagos} sv="lançamentos quitados" c="#16A34A"/>
                <KPI l="Entregas pendentes" v={totalPendente} sv="aguardando confirmação" c="#7C3AED"/>
              </div>
              <div style={s.card}>
                <div style={s.toolbar}>
                  <span style={{fontSize:10,fontWeight:700,color:'#64748B',textTransform:'uppercase',letterSpacing:'.1em',flex:1}}>Todos os lançamentos</span>
                  <input style={{...s.inp,width:160}} placeholder="Buscar..." value={search} onChange={e=>setSearch(e.target.value)}/>
                  <div style={{display:'flex',alignItems:'center',gap:4}}>
                    <label style={{fontSize:11,color:'#64748B',fontWeight:600}}>De:</label>
                    <input type="date" style={s.inp} value={fDataIni} onChange={e=>setFDataIni(e.target.value)}/>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:4}}>
                    <label style={{fontSize:11,color:'#64748B',fontWeight:600}}>Até:</label>
                    <input type="date" style={s.inp} value={fDataFim} onChange={e=>setFDataFim(e.target.value)}/>
                  </div>
                  {(fDataIni||fDataFim)&&(
                    <button onClick={()=>{setFDataIni('');setFDataFim('')}} style={{...s.btnOut,padding:'4px 8px',fontSize:11}}>Limpar datas</button>
                  )}
                  <select style={s.inp} value={fPipe} onChange={e=>setFPipe(e.target.value)}>
                    <option value="">Todas as etapas</option>
                    {PIPELINE.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                  <select style={s.inp} value={fRec} onChange={e=>setFRec(e.target.value)}>
                    <option value="">Todos</option><option value="true">Mensais</option><option value="false">Avulsos</option>
                  </select>
                </div>
                <div style={{overflowX:'auto',maxHeight:440,overflowY:'auto'}}>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                    <thead style={{position:'sticky',top:0,zIndex:2}}>
                      <tr style={{background:'#FAFBFC',borderBottom:'2px solid #E2E8F0'}}>
                        {th('Empresa')}{th('NF Nº')}{th('Etapa')}{th('Data')}{th('Valor Pago')}{th('Frete')}{th('Desconto')}{th('Total')}{th('Saldo Dev.')}{th('Pgto')}{th('Proposta')}{th('NF')}{th('Lançado por')}
                      </tr>
                    </thead>
                    <tbody>
                      {loading?<tr><td colSpan={13} style={{textAlign:'center',padding:'3rem',color:'#64748B'}}>Carregando...</td></tr>
                      :filtered.length===0?<tr><td colSpan={13} style={{textAlign:'center',padding:'3rem',color:'#64748B'}}>Nenhum registro</td></tr>
                      :filtered.map(l=>{
                        const step=PIPELINE.find(p=>p.id===l.status_processo)
                        const cor=PIPE_COLORS[l.status_processo]||'#64748B'
                        const temSaldo=l.saldo_devedor&&l.saldo_devedor>0
                        return (
                          <tr key={l.id} onClick={()=>openDetalhe(l.id)} style={{borderBottom:'1px solid #E2E8F0',cursor:'pointer'}}
                            onMouseEnter={e=>(e.currentTarget.style.background='#F8FAFB')} onMouseLeave={e=>(e.currentTarget.style.background='')}>
                            <td style={{padding:'8px 11px',fontWeight:500,maxWidth:130,overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis'}}>{l.titulo}</td>
                            <td style={{padding:'8px 11px',color:'#64748B',fontSize:11}}>{l.nf_numero||'—'}</td>
                            <td style={{padding:'8px 11px'}}>{step&&<StepBadge stepId={step.id} label={step.label} color={cor}/>}</td>
                            <td style={{padding:'8px 11px',color:'#64748B',whiteSpace:'nowrap'}}>{fmtData(l.data)}</td>
                            <td style={{padding:'8px 11px',fontWeight:500}}>{l.valor_produtos?fmtR(l.valor_produtos):'—'}</td>
                            <td style={{padding:'8px 11px',color:'#64748B'}}>{l.valor_frete?fmtR(l.valor_frete):'—'}</td>
                            <td style={{padding:'8px 11px',textAlign:'center'}}>{l.tem_desconto&&l.valor_desconto?<span style={{color:'#D97706',fontWeight:600,fontSize:11}}>-{fmtR(l.valor_desconto)}</span>:<span style={{color:'#CBD5E1'}}>—</span>}</td>
                            <td style={{padding:'8px 11px',fontWeight:700}}>{fmtR(l.valor_total)}</td>
                            <td style={{padding:'8px 11px',textAlign:'right'}}>{temSaldo?<span style={{color:'#DC2626',fontWeight:700,fontSize:11}}>{fmtR(l.saldo_devedor!)}</span>:<span style={{color:'#CBD5E1'}}>—</span>}</td>
                            <td style={{padding:'8px 11px',textAlign:'center'}}>{l.pago?<Icon name="check" size={14} color="#16A34A"/>:<Icon name="x" size={14} color="#DC2626"/>}</td>
                            <td style={{padding:'8px 11px',textAlign:'center'}}>{l.proposta_url?<a href={l.proposta_url} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} style={{color:ACCENT_LT,display:'inline-flex'}}><Icon name="clipboard" size={15}/></a>:<span style={{color:'#CBD5E1'}}>—</span>}</td>
                            <td style={{padding:'8px 11px',textAlign:'center'}}>{l.arquivo_url?<a href={l.arquivo_url} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} style={{color:ACCENT_LT,display:'inline-flex'}}><Icon name="receipt" size={15}/></a>:<span style={{color:'#CBD5E1'}}>—</span>}</td>
                            <td style={{padding:'8px 11px',color:'#64748B',fontSize:11}}>{l.criado_por}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <div style={{padding:'.5rem 1.1rem',borderTop:'1px solid #E2E8F0',fontSize:11,color:'#64748B',background:'#FAFBFC'}}>
                  {filtered.length} registro{filtered.length!==1?'s':''} de {data.length} total
                </div>
              </div>
            </div>
          )}
        </main>

        <footer style={s.footer}>
          <img src="/logo.jpg" alt="Servis" style={{height:24,objectFit:'contain'}} onError={e=>(e.currentTarget.style.display='none')}/>
          <p style={{fontSize:11,color:'#64748B'}}>Servis Empreendimentos · Conciliação Financeira</p>
          <p style={{fontSize:11,color:'#64748B'}}>© 2025</p>
        </footer>
      </div>

      {modal&&detalhe&&(
        <div style={s.overlay} onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div style={s.modal}>
            <div style={s.mhdr}>
              <h3 style={{fontSize:15,fontWeight:700}}>{detalhe.titulo}</h3>
              <button onClick={()=>setModal(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#64748B'}}><Icon name="x" size={20}/></button>
            </div>

            {role==='entregador'?(
              <div style={{padding:'1.25rem 1.5rem'}}>
                {(()=>{
                  const step=PIPELINE.find(p=>p.id===detalhe.status_processo)
                  const cor=PIPE_COLORS[detalhe.status_processo]||'#64748B'
                  const itensOrc=detalhe.itens?.filter(i=>i.tipo==='orcamento')||[]
                  return (
                    <>
                      <div style={{display:'flex',gap:12,alignItems:'center',marginBottom:16}}>
                        {step&&<StepBadge stepId={step.id} label={step.label} color={cor}/>}
                        {detalhe.data_entrega_programada&&<span style={{fontSize:12,color:'#7C3AED',fontWeight:600,display:'inline-flex',alignItems:'center',gap:4}}><Icon name="calendar" size={13}/>{fmtData(detalhe.data_entrega_programada)}</span>}
                      </div>
                      {detalhe.entrega_tipo==='parcial'&&(
                        <div style={{background:'#F5F3FF',border:'1.5px solid #DDD6FE',borderRadius:8,padding:'10px 14px',marginBottom:16}}>
                          <p style={{fontSize:12,fontWeight:600,color:'#6D28D9',margin:'0 0 6px'}}>Entrega parcial</p>
                          {detalhe.entrega_itens1&&<p style={{fontSize:11,color:'#6D28D9',margin:'0 0 4px'}}>1ª: {detalhe.entrega_itens1}</p>}
                          {detalhe.entrega_itens2&&<p style={{fontSize:11,color:'#6D28D9',margin:0}}>2ª: {detalhe.entrega_itens2}</p>}
                        </div>
                      )}
                      <div style={{border:'1.5px solid #E2E8F0',borderRadius:8,overflow:'hidden'}}>
                        <div style={{background:'#FAFBFC',padding:'8px 12px',borderBottom:'1px solid #E2E8F0'}}>
                          <span style={{fontSize:10,fontWeight:700,color:'#64748B',textTransform:'uppercase'}}>Itens para confirmar ({itensOrc.length})</span>
                        </div>
                        {itensOrc.length===0&&<p style={{padding:'12px',fontSize:12,color:'#64748B',margin:0}}>Nenhum item cadastrado.</p>}
                        {itensOrc.map(item=>{
                          const inputId=`data-item-${item.id}`
                          return (
                            <div key={item.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 12px',borderBottom:'1px solid #E2E8F0',background:item.entregue?'#F0FDF4':'#fff'}}>
                              <div>
                                <p style={{margin:0,fontSize:13,fontWeight:600}}>{item.nome}</p>
                                <p style={{margin:'2px 0 0',fontSize:11,color:'#64748B'}}>Quantidade: {item.quantidade}</p>
                                {item.entregue&&item.data_entrega&&<p style={{margin:'2px 0 0',fontSize:11,color:'#16A34A'}}>Confirmado em {fmtData(item.data_entrega)}</p>}
                              </div>
                              {!item.entregue?(
                                <div style={{display:'flex',alignItems:'center',gap:8}}>
                                  <input type="date" id={inputId} defaultValue={new Date().toISOString().slice(0,10)} style={{...s.fi,width:'auto',fontSize:11}}/>
                                  <button onClick={async()=>{
                                    const el=document.getElementById(inputId) as HTMLInputElement
                                    await handleMarcarItemEntregue(item,el?.value||new Date().toISOString().slice(0,10))
                                  }} style={{...s.btnGrn,padding:'4px 10px',fontSize:11}}>Confirmar</button>
                                </div>
                              ):(
                                <span style={{fontSize:12,color:'#16A34A',fontWeight:700,display:'inline-flex',alignItems:'center',gap:4}}><Icon name="check" size={13}/>Recebido</span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )
                })()}
              </div>
            ):(
              <div style={{padding:'1.25rem 1.5rem'}}>
                <PipelineStepper atual={detalhe.status_processo||'orcamento_aprovado'} onChange={handlePipelineChange}/>

                {isLocked(detalhe.status_processo)&&(
                  <div style={{background:'#FFFBEB',border:'1.5px solid #FDE68A',borderRadius:8,padding:'10px 14px',marginBottom:16,display:'flex',alignItems:'center',gap:8}}>
                    <Icon name="lock" size={15} color="#92400E"/>
                    <p style={{fontSize:12,fontWeight:600,color:'#92400E',margin:0}}>Orçamento fechado — valores não podem ser alterados</p>
                  </div>
                )}

                {detalhe.status_processo==='entrega_programada'&&(
                  <div style={{background:'#F5F3FF',border:'1.5px solid #DDD6FE',borderRadius:8,padding:'10px 14px',marginBottom:16}}>
                    {detalhe.entrega_tipo==='parcial'?(
                      <>
                        <p style={{fontSize:12,fontWeight:600,color:'#6D28D9',margin:'0 0 4px'}}>Entrega parcial</p>
                        {detalhe.entrega_itens1&&<p style={{fontSize:11,color:'#6D28D9',margin:'0 0 2px'}}>1ª: {detalhe.data_entrega_programada?fmtData(detalhe.data_entrega_programada):''} — {detalhe.entrega_itens1}</p>}
                        {detalhe.entrega_itens2&&<p style={{fontSize:11,color:'#6D28D9',margin:0}}>2ª: {detalhe.entrega_data2?fmtData(detalhe.entrega_data2):''} — {detalhe.entrega_itens2}</p>}
                      </>
                    ):(
                      <p style={{fontSize:12,fontWeight:600,color:'#6D28D9',margin:0}}>
                        Entrega em {detalhe.data_entrega_programada?fmtData(detalhe.data_entrega_programada):'?'}
                        {detalhe.dias_entrega&&` (${detalhe.dias_entrega} dias ${detalhe.entrega_tipo==='uteis'?'úteis':'corridos'})`}
                      </p>
                    )}
                  </div>
                )}

                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px 24px',marginBottom:16}}>
                  {([
                    ['Empresa',detalhe.titulo],
                    ['CNPJ',detalhe.cnpj?fmtCNPJ(detalhe.cnpj):'—'],
                    ['NF Nº',detalhe.nf_numero||'—'],
                    ['Lançado por',detalhe.criado_por],
                    ['Data',fmtData(detalhe.data)],
                    ...(detalhe.forma_pagamento?[['Forma de pagamento',detalhe.forma_pagamento]]:[] as any),
                    ...(detalhe.data_pagamento?[['Data do pagamento',fmtData(detalhe.data_pagamento)]]:[] as any),
                  ] as [string,string][]).map(([k,v])=>(
                    <div key={k}><p style={{fontSize:10,fontWeight:600,color:'#64748B',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:2}}>{k}</p><p style={{fontSize:14,fontWeight:500}}>{v}</p></div>
                  ))}
                </div>

                <div style={{border:'1.5px solid #E2E8F0',borderRadius:8,padding:'14px 16px',marginBottom:16}}>
                  <p style={{fontSize:10,fontWeight:700,color:'#64748B',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:12}}>Valores</p>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:12,marginBottom:12}}>
                    <div>
                      <p style={{fontSize:10,color:'#64748B',fontWeight:600,textTransform:'uppercase',marginBottom:4}}>Valor Pago</p>
                      <p style={{fontSize:14,fontWeight:700,color:'#0F172A'}}>{fmtR(detalhe.valor_produtos||0)}</p>
                    </div>
                    <div>
                      <p style={{fontSize:10,color:'#64748B',fontWeight:600,textTransform:'uppercase',marginBottom:4}}>Frete</p>
                      <p style={{fontSize:14,fontWeight:700,color:'#0F172A'}}>{fmtR(detalhe.valor_frete||0)}</p>
                    </div>
                    <div>
                      <p style={{fontSize:10,color:'#64748B',fontWeight:600,textTransform:'uppercase',marginBottom:4}}>Desconto</p>
                      <p style={{fontSize:14,fontWeight:700,color:detalhe.tem_desconto?'#D97706':'#CBD5E1'}}>{detalhe.tem_desconto&&detalhe.valor_desconto?`- ${fmtR(detalhe.valor_desconto)}`:'—'}</p>
                    </div>
                    <div>
                      <p style={{fontSize:10,color:'#64748B',fontWeight:600,textTransform:'uppercase',marginBottom:4}}>Total</p>
                      <p style={{fontSize:14,fontWeight:700,color:'#16A34A'}}>{fmtR(detalhe.valor_total)}</p>
                    </div>
                    <div>
                      <p style={{fontSize:10,color:'#64748B',fontWeight:600,textTransform:'uppercase',marginBottom:4}}>Saldo Devedor</p>
                      <p style={{fontSize:14,fontWeight:700,color:detalhe.saldo_devedor&&detalhe.saldo_devedor>0?'#DC2626':'#16A34A'}}>
                        {detalhe.saldo_devedor&&detalhe.saldo_devedor>0?fmtR(detalhe.saldo_devedor):'Quitado'}
                      </p>
                    </div>
                  </div>

                  {detalhe.saldo_devedor&&detalhe.saldo_devedor>0?(
                    <div style={{paddingTop:12,borderTop:'1px solid #E2E8F0'}}>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                        <p style={{fontSize:12,color:'#DC2626',fontWeight:600,margin:0,display:'flex',alignItems:'center',gap:6}}>
                          <Icon name="alert" size={14}/> Saldo em aberto: {fmtR(detalhe.saldo_devedor)}
                        </p>
                        <button onClick={()=>{
                          setPagParcialTipo('pix');setPagParcialValor('');setPagParcialObs('');setPagParcialParc('')
                          setPagParcialData(new Date().toISOString().slice(0,10))
                          setModalPagParcial(true)
                        }} style={{...s.btnGrn,padding:'6px 14px',fontSize:12}}>
                          <Icon name="dollar" size={13} color="#fff"/> Registrar pagamento
                        </button>
                      </div>
                    </div>
                  ):null}

                  {detalhe.status_processo==='em_tratativa'&&!isLocked(detalhe.status_processo)&&(
                    <div style={{marginTop:14,paddingTop:14,borderTop:'1px solid #E2E8F0'}}>
                      <p style={{fontSize:11,fontWeight:600,color:'#D97706',marginBottom:8}}>Em tratativa — aplicar desconto</p>
                      <div style={{display:'flex',gap:8,alignItems:'center'}}>
                        <input style={{...s.fi,flex:1}} value={rawDesconto} placeholder="R$ 0,00"
                          onChange={e=>{const d=e.target.value.replace(/\D/g,'');setRawDesconto(d?(parseInt(d)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'')} }/>
                        <button onClick={handleSalvarDesconto} disabled={!rawDesconto} style={{...s.btnTeal,opacity:!rawDesconto?0.6:1,whiteSpace:'nowrap' as const}}>Aplicar</button>
                        {detalhe.tem_desconto&&(
                          <button onClick={async()=>{
                            await sbPatch('lancamentos',`?id=eq.${detalhe.id}`,{tem_desconto:false,valor_desconto:0,valor_total:detalhe.valor_original||detalhe.valor_total})
                            const d=await api.buscar(detalhe.id);setDetalhe(d);setRawDesconto('');showToast('Desconto removido!')
                          }} style={{...s.btnOut,color:'#DC2626',borderColor:'#FEE2E2',whiteSpace:'nowrap' as const}}>Remover</button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {(()=>{
                  const itensOrc=detalhe.itens?.filter(i=>i.tipo==='orcamento')||[]
                  const itensNF=detalhe.itens?.filter(i=>i.tipo==='nf')||[]
                  if(itensOrc.length===0&&itensNF.length===0) return null
                  return (
                    <div style={{border:'1.5px solid #E2E8F0',borderRadius:8,overflow:'hidden',marginBottom:16}}>
                      <div style={{background:'#FAFBFC',padding:'8px 12px',borderBottom:'1px solid #E2E8F0',display:'flex',gap:16}}>
                        <span style={{fontSize:10,fontWeight:700,color:'#64748B',textTransform:'uppercase'}}>Itens orçamento ({itensOrc.length})</span>
                        {itensNF.length>0&&<span style={{fontSize:10,fontWeight:700,color:ACCENT_LT,textTransform:'uppercase'}}>Itens NF ({itensNF.length})</span>}
                      </div>
                      <div style={{display:'grid',gridTemplateColumns:itensNF.length>0?'1fr 1fr':'1fr'}}>
                        <div style={{borderRight:itensNF.length>0?'1px solid #E2E8F0':'none'}}>
                          {itensOrc.map(item=>(
                            <div key={item.id} style={{padding:'8px 12px',borderBottom:'1px solid #E2E8F0',background:item.entregue?'#F0FDF4':'#fff'}}>
                              <p style={{margin:0,fontSize:12,fontWeight:600}}>{item.nome}</p>
                              <p style={{margin:'2px 0 0',fontSize:11,color:'#64748B'}}>Qtd: {item.quantidade} · {fmtR(item.valor_unitario||0)}/un · Total: {fmtR(item.valor_total||0)}</p>
                              {item.entregue&&<span style={{fontSize:11,color:'#16A34A'}}>Recebido {item.data_entrega?fmtData(item.data_entrega):''}</span>}
                            </div>
                          ))}
                          <div style={{padding:'8px 12px',background:'#F9FAFB'}}>
                            <span style={{fontSize:12,fontWeight:700}}>Total: {fmtR(itensOrc.reduce((s,i)=>s+(i.valor_total||0),0))}</span>
                          </div>
                        </div>
                        {itensNF.length>0&&(
                          <div>
                            {itensNF.map(item=>(
                              <div key={item.id} style={{padding:'8px 12px',borderBottom:'1px solid #E2E8F0'}}>
                                <p style={{margin:0,fontSize:12,fontWeight:600}}>{item.nome}</p>
                                <p style={{margin:'2px 0 0',fontSize:11,color:'#64748B'}}>Qtd: {item.quantidade} · {fmtR(item.valor_unitario||0)}/un · Total: {fmtR(item.valor_total||0)}</p>
                              </div>
                            ))}
                            <div style={{padding:'8px 12px',background:'#F9FAFB'}}>
                              <span style={{fontSize:12,fontWeight:700,color:ACCENT_LT}}>Total NF: {fmtR(itensNF.reduce((s,i)=>s+(i.valor_total||0),0))}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })()}

                <div style={{border:'1.5px solid #E2E8F0',borderRadius:8,padding:'12px 14px',marginBottom:12}}>
                  <p style={{fontSize:10,fontWeight:700,color:'#64748B',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:10,display:'flex',alignItems:'center',gap:6}}><Icon name="clipboard" size={13}/>Proposta</p>
                  <input ref={propostaDetRef} type="file" accept="application/pdf,image/*" style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0];if(f)handleAnexarProposta(f)}}/>
                  <AnexoBtn url={detalhe.proposta_url} label="proposta" icon="clipboard" onAnexar={()=>propostaDetRef.current?.click()} onSubstituir={()=>propostaDetRef.current?.click()} loading={loadingAnexo}/>
                </div>

                <div style={{border:'1.5px solid #E2E8F0',borderRadius:8,padding:'12px 14px',marginBottom:16,background:canAttachNF(detalhe.status_processo)?'#fff':'#F9FAFB'}}>
                  <p style={{fontSize:10,fontWeight:700,color:'#64748B',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:10,display:'flex',alignItems:'center',gap:6}}><Icon name="receipt" size={13}/>Nota Fiscal</p>
                  {canAttachNF(detalhe.status_processo)?(
                    <>
                      <input ref={nfDetRef} type="file" accept="application/pdf,image/*" style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0];if(f)handleAnexarNFComIA(f)}}/>
                      {loadingIANF?<p style={{fontSize:12,color:ACCENT_LT,fontWeight:600}}>Lendo NF com IA...</p>
                      :<AnexoBtn url={detalhe.arquivo_url} label="nota fiscal" icon="receipt" onAnexar={()=>nfDetRef.current?.click()} onSubstituir={()=>nfDetRef.current?.click()} loading={loadingAnexo}/>}
                    </>
                  ):(
                    <p style={{fontSize:12,color:'#64748B',margin:0}}>Disponível após <strong>Mercadoria recebida</strong></p>
                  )}
                </div>

                {detalhe.tipo_pagamento==='parcelado'&&(detalhe.parcelas||[]).length>0&&(
                  <div style={{border:'1.5px solid #E2E8F0',borderRadius:8,overflow:'hidden',marginBottom:16}}>
                    <div style={{background:'#FAFBFC',padding:'8px 12px',borderBottom:'1px solid #E2E8F0'}}>
                      <span style={{fontSize:10,fontWeight:700,color:'#64748B',textTransform:'uppercase'}}>
                        Parcelas · Pago: {fmtR((detalhe.parcelas||[]).filter(p=>p.pago).reduce((s,p)=>s+p.valor,0))} de {fmtR(detalhe.valor_total)}
                      </span>
                    </div>
                    {(detalhe.parcelas||[]).map(p=>(
                      <div key={p.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 12px',borderBottom:'1px solid #E2E8F0',background:p.pago?'#F0FDF4':'#fff'}}>
                        <div>
                          <p style={{fontSize:13,fontWeight:600,margin:0}}>Parcela {p.numero} — {fmtR(p.valor)}</p>
                          <p style={{fontSize:11,color:'#64748B',margin:'2px 0 0'}}>Venc.: {fmtData(p.data_vencimento)}{p.data_pagamento&&` · Pago: ${fmtData(p.data_pagamento)}`}</p>
                        </div>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          {p.pago?(
                            <><span style={{fontSize:12,color:'#16A34A',fontWeight:600}}>Pago</span>
                            <button onClick={()=>handleEstornar(p.id!,detalhe.id)} disabled={!!acao} style={{fontSize:11,color:'#64748B',background:'none',border:'none',cursor:'pointer',textDecoration:'underline'}}>Estornar</button></>
                          ):(
                            <button onClick={()=>handlePagar(p.id!,detalhe.id)} disabled={!!acao} style={{...s.btnTeal,padding:'4px 12px',fontSize:11,opacity:!!acao?0.5:1}}>{acao===p.id?'...':'Marcar pago'}</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div style={s.mfoot}>
              <button onClick={()=>setModal(false)} style={{...s.btnOut,padding:'.5rem 1rem',fontSize:13}}>Fechar</button>
              {role==='gestora'&&<button onClick={()=>handleExcluir(detalhe.id)} style={{...s.btnRed,padding:'.5rem 1rem',fontSize:13}}><Icon name="trash" size={13}/> Excluir</button>}
            </div>
          </div>
        </div>
      )}

      {modal&&!detalhe&&(
        <div style={s.overlay} onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div style={s.modal}>
            <div style={s.mhdr}>
              <h3 style={{fontSize:15,fontWeight:700}}>Novo Orçamento</h3>
              <button onClick={()=>setModal(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#64748B'}}><Icon name="x" size={20}/></button>
            </div>
            <div style={s.fg}>
              <div style={{gridColumn:'1/-1',padding:'14px 16px',background:'linear-gradient(135deg,#E0F5F7,#EAF3FD)',borderRadius:10,border:'1.5px dashed '+ACCENT_LT}}>
                <p style={{fontSize:11,fontWeight:700,color:ACCENT_LT,textTransform:'uppercase',letterSpacing:'.05em',marginBottom:8,display:'flex',alignItems:'center',gap:6}}><Icon name="sparkles" size={14} color={ACCENT_LT}/>Importar orçamento com IA</p>
                <p style={{fontSize:12,color:'#0F172A',marginBottom:10}}>Suba o PDF do orçamento e a IA extrai empresa, CNPJ, itens e frete automaticamente.</p>
                <input ref={orcIARef} type="file" accept="application/pdf,image/*" style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0];if(f)handleImportarOrcamento(f)}}/>
                <button onClick={()=>orcIARef.current?.click()} disabled={loadingIA} style={{...s.btnTeal,opacity:loadingIA?0.6:1,width:'100%',justifyContent:'center'}}>
                  <Icon name="upload" size={14} color="#fff"/> {loadingIA?'Lendo orçamento...':'Selecionar PDF do orçamento'}
                </button>
              </div>
              <FF lb="Nome da empresa *" full>
                <FornecedorInput value={form.titulo||''} cnpj={form.cnpj||''} onChange={(nome,cnpj)=>{set('titulo',nome);set('cnpj',cnpj)}}/>
              </FF>
              <FF lb="CNPJ">
                <input style={s.fi} value={form.cnpj?fmtCNPJ(form.cnpj):''} placeholder="00.000.000/0000-00" maxLength={18} onChange={e=>set('cnpj',e.target.value.replace(/\D/g,''))}/>
              </FF>
              <FF lb="Data *">
                <input type="date" style={s.fi} value={form.data||''} onChange={e=>set('data',e.target.value)}/>
              </FF>
              <ItensEditor itens={itensOrcamento} onChange={setItensOrcamento}/>
              <FF lb="Valor do frete">
                <input style={s.fi} value={rawFrete} placeholder="R$ 0,00" onChange={e=>{
                  const d=e.target.value.replace(/\D/g,'')
                  setRawFrete(d?(parseInt(d)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'')
                }}/>
              </FF>
              <div style={{background:'#F0F7F9',borderRadius:8,padding:'12px 14px',border:'1.5px solid #E0F5F7'}}>
                <p style={{fontSize:10,fontWeight:600,color:'#64748B',textTransform:'uppercase',marginBottom:4}}>Total do orçamento</p>
                <p style={{fontSize:20,fontWeight:700,color:ACCENT_LT}}>
                  {fmtR(itensOrcamento.reduce((s,i)=>s+(i.valor_total||0),0)+(parseFloat(rawFrete.replace(/\D/g,''))/100||0))}
                </p>
              </div>
            </div>
            <div style={s.mfoot}>
              <button onClick={()=>setModal(false)} style={{...s.btnOut,padding:'.5rem 1rem',fontSize:13}}>Fechar</button>
              <button onClick={handleSave} disabled={saving||loadingIA} style={{...s.btnTeal,opacity:(saving||loadingIA)?0.6:1}}>{saving?'Salvando...':'Salvar orçamento'}</button>
            </div>
          </div>
        </div>
      )}

      {modalFormaPgto&&(
        <div style={s.overlay} onClick={e=>e.target===e.currentTarget&&setModalFormaPgto(false)}>
          <div style={{...s.modal,width:440}}>
            <div style={s.mhdr}>
              <h3 style={{fontSize:15,fontWeight:700,display:'flex',alignItems:'center',gap:8}}><Icon name="dollar" size={16}/>Registrar Pagamento</h3>
              <button onClick={()=>setModalFormaPgto(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#64748B'}}><Icon name="x" size={20}/></button>
            </div>
            <div style={{padding:'1.5rem',display:'grid',gap:14}}>
              <div><label style={s.lb}>Forma de pagamento *</label>
                <select style={s.fi} value={formaPgtoTipo} onChange={e=>setFormaPgtoTipo(e.target.value)}>
                  <option value="pix">PIX</option><option value="transferencia">Transferência bancária</option>
                  <option value="boleto">Boleto</option><option value="cartao">Cartão</option>
                  <option value="avista">À vista (dinheiro)</option><option value="parcelado">Parcelado</option>
                </select>
              </div>
              {formaPgtoTipo==='parcelado'&&(
                <div><label style={s.lb}>Número de parcelas *</label>
                  <input type="number" min={2} max={48} style={s.fi} value={formaPgtoParc} onChange={e=>setFormaPgtoParc(e.target.value)} placeholder="Ex: 3"/>
                </div>
              )}
              <div><label style={s.lb}>Data do pagamento *</label>
                <input type="date" style={s.fi} value={formaPgtoData} onChange={e=>setFormaPgtoData(e.target.value)}/>
              </div>
              <div><label style={s.lb}>Observações</label>
                <input style={s.fi} value={formaPgtoObs} onChange={e=>setFormaPgtoObs(e.target.value)} placeholder="Ex: 30/60/90 dias"/>
              </div>
            </div>
            <div style={s.mfoot}>
              <button onClick={()=>setModalFormaPgto(false)} style={{...s.btnOut,padding:'.5rem 1rem',fontSize:13}}>Cancelar</button>
              <button onClick={handleConfirmarFormaPgto} disabled={saving||!formaPgtoData} style={{...s.btnTeal,opacity:(saving||!formaPgtoData)?0.6:1}}>{saving?'Salvando...':'Confirmar'}</button>
            </div>
          </div>
        </div>
      )}

      {modalPagParcial&&detalhe&&(
        <div style={s.overlay} onClick={e=>e.target===e.currentTarget&&setModalPagParcial(false)}>
          <div style={{...s.modal,width:460}}>
            <div style={s.mhdr}>
              <h3 style={{fontSize:15,fontWeight:700,display:'flex',alignItems:'center',gap:8}}><Icon name="dollar" size={16}/>Registrar Pagamento</h3>
              <button onClick={()=>setModalPagParcial(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#64748B'}}><Icon name="x" size={20}/></button>
            </div>
            <div style={{padding:'1.5rem',display:'grid',gap:14}}>
              <div style={{background:'#FFFBEB',borderRadius:8,padding:'10px 14px'}}>
                <p style={{fontSize:12,color:'#92400E',margin:'0 0 4px',fontWeight:600}}>Saldo em aberto</p>
                <p style={{fontSize:20,fontWeight:700,color:'#DC2626',margin:0}}>{fmtR(detalhe.saldo_devedor||0)}</p>
              </div>
              <div><label style={s.lb}>Valor pago agora *</label>
                <input style={s.fi} value={pagParcialValor} placeholder="R$ 0,00" onChange={e=>{
                  const d=e.target.value.replace(/\D/g,'')
                  setPagParcialValor(d?(parseInt(d)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'')
                }}/>
                {pagParcialValor&&(()=>{
                  const v=parseFloat(pagParcialValor.replace(/\D/g,''))/100
                  const novoSaldo=Math.max(0,(detalhe.saldo_devedor||0)-v)
                  return <p style={{fontSize:11,color:novoSaldo===0?'#16A34A':'#D97706',marginTop:6,fontWeight:600}}>
                    {novoSaldo===0?'Quitará o saldo total':`Saldo restante: ${fmtR(novoSaldo)}`}
                  </p>
                })()}
              </div>
              <div><label style={s.lb}>Forma de pagamento *</label>
                <select style={s.fi} value={pagParcialTipo} onChange={e=>setPagParcialTipo(e.target.value)}>
                  <option value="pix">PIX</option><option value="transferencia">Transferência bancária</option>
                  <option value="boleto">Boleto</option><option value="cartao">Cartão</option>
                  <option value="avista">À vista (dinheiro)</option><option value="parcelado">Parcelado</option>
                </select>
              </div>
              {pagParcialTipo==='parcelado'&&(
                <div><label style={s.lb}>Número de parcelas</label>
                  <input type="number" min={2} style={s.fi} value={pagParcialParc} onChange={e=>setPagParcialParc(e.target.value)} placeholder="Ex: 2"/>
                </div>
              )}
              <div><label style={s.lb}>Data do pagamento *</label>
                <input type="date" style={s.fi} value={pagParcialData} onChange={e=>setPagParcialData(e.target.value)}/>
              </div>
              <div><label style={s.lb}>Observações</label>
                <input style={s.fi} value={pagParcialObs} onChange={e=>setPagParcialObs(e.target.value)} placeholder="Opcional"/>
              </div>
            </div>
            <div style={s.mfoot}>
              <button onClick={()=>setModalPagParcial(false)} style={{...s.btnOut,padding:'.5rem 1rem',fontSize:13}}>Cancelar</button>
              <button onClick={handleConfirmarPagParcial} disabled={saving||!pagParcialValor||!pagParcialData} style={{...s.btnGrn,opacity:(saving||!pagParcialValor||!pagParcialData)?0.6:1,padding:'.5rem 1.2rem',fontSize:13}}>
                {saving?'Salvando...':'Confirmar pagamento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalEntregaProg&&(
        <div style={s.overlay} onClick={e=>e.target===e.currentTarget&&setModalEntregaProg(false)}>
          <div style={{...s.modal,width:480}}>
            <div style={s.mhdr}>
              <h3 style={{fontSize:15,fontWeight:700,display:'flex',alignItems:'center',gap:8}}><Icon name="calendar" size={16}/>Programar Entrega</h3>
              <button onClick={()=>setModalEntregaProg(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#64748B'}}><Icon name="x" size={20}/></button>
            </div>
            <div style={{padding:'1.5rem',display:'grid',gap:14}}>
              <div><label style={s.lb}>Tipo de entrega *</label>
                <select style={s.fi} value={entregaTipo} onChange={e=>setEntregaTipo(e.target.value)}>
                  <option value="corridos">Dias corridos</option>
                  <option value="uteis">Dias úteis</option>
                  <option value="parcial">Entrega parcial (duas datas)</option>
                </select>
              </div>
              {entregaTipo!=='parcial'?(
                <div><label style={s.lb}>Número de dias *</label>
                  <input type="number" min={1} style={s.fi} value={diasEntrega} placeholder="Ex: 30" onChange={e=>setDiasEntrega(e.target.value)}/>
                  {diasEntrega&&<p style={{fontSize:12,color:'#7C3AED',marginTop:8,fontWeight:600}}>
                    Previsão: {fmtData(entregaTipo==='uteis'?addDiasUteis(parseInt(diasEntrega)):addDiasCorridos(parseInt(diasEntrega)))}
                  </p>}
                </div>
              ):(
                <>
                  <div><label style={s.lb}>Data da 1ª entrega *</label><input type="date" style={s.fi} value={entregaData1} onChange={e=>setEntregaData1(e.target.value)}/></div>
                  <div><label style={s.lb}>Itens da 1ª entrega</label><textarea style={{...s.fi,minHeight:60,resize:'vertical' as const}} value={entregaItens1} onChange={e=>setEntregaItens1(e.target.value)} placeholder="Ex: 50% dos produtos"/></div>
                  <div><label style={s.lb}>Data da 2ª entrega *</label><input type="date" style={s.fi} value={entregaData2State} onChange={e=>setEntregaData2State(e.target.value)}/></div>
                  <div><label style={s.lb}>Itens da 2ª entrega</label><textarea style={{...s.fi,minHeight:60,resize:'vertical' as const}} value={entregaItens2} onChange={e=>setEntregaItens2(e.target.value)} placeholder="Ex: Restante dos produtos"/></div>
                </>
              )}
            </div>
            <div style={s.mfoot}>
              <button onClick={()=>setModalEntregaProg(false)} style={{...s.btnOut,padding:'.5rem 1rem',fontSize:13}}>Cancelar</button>
              <button onClick={handleConfirmarEntregaProg} disabled={saving} style={{...s.btnTeal,opacity:saving?0.6:1}}>{saving?'Salvando...':'Confirmar'}</button>
            </div>
          </div>
        </div>
      )}

      {modalNFItens&&(
        <div style={s.overlay} onClick={e=>e.target===e.currentTarget&&setModalNFItens(false)}>
          <div style={{...s.modal,width:700}}>
            <div style={s.mhdr}>
              <h3 style={{fontSize:15,fontWeight:700,display:'flex',alignItems:'center',gap:8}}><Icon name="receipt" size={16}/>Itens da Nota Fiscal</h3>
              <button onClick={()=>setModalNFItens(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#64748B'}}><Icon name="x" size={20}/></button>
            </div>
            <div style={{padding:'1.25rem 1.5rem'}}>
              <p style={{fontSize:12,color:'#64748B',marginBottom:16}}>Revise os itens extraídos pela IA antes de salvar.</p>
              <ItensEditor itens={itensNFEditor} onChange={setItensNFEditor}/>
            </div>
            <div style={s.mfoot}>
              <button onClick={()=>setModalNFItens(false)} style={{...s.btnOut,padding:'.5rem 1rem',fontSize:13}}>Cancelar</button>
              <button onClick={handleSalvarNF} disabled={loadingAnexo} style={{...s.btnTeal,opacity:loadingAnexo?0.6:1}}>{loadingAnexo?'Salvando...':'Salvar NF e itens'}</button>
            </div>
          </div>
        </div>
      )}

      {modalMensal&&(
        <div style={s.overlay} onClick={e=>e.target===e.currentTarget&&setModalMensal(false)}>
          <div style={{...s.modal,width:480}}>
            <div style={s.mhdr}>
              <h3 style={{fontSize:15,fontWeight:700}}>Nova Conta Mensal</h3>
              <button onClick={()=>setModalMensal(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#64748B'}}><Icon name="x" size={20}/></button>
            </div>
            <div style={s.fg}>
              <FF lb="Nome da conta *" full><input style={s.fi} value={formMensal.titulo||''} onChange={e=>setM('titulo',e.target.value)} placeholder="Ex: Conta de Água"/></FF>
              <FF lb="Pago por *" full><input style={s.fi} value={formMensal.pago_por||''} onChange={e=>setM('pago_por',e.target.value)} placeholder="Ex: Servis Empreendimentos"/></FF>
              <FF lb="Dia de vencimento *" full><input type="number" min={1} max={31} style={s.fi} value={formMensal.dia_vencimento||''} onChange={e=>setM('dia_vencimento',parseInt(e.target.value)||null)} placeholder="Ex: 10"/></FF>
            </div>
            <div style={s.mfoot}>
              <button onClick={()=>setModalMensal(false)} style={{...s.btnOut,padding:'.5rem 1rem',fontSize:13}}>Cancelar</button>
              <button onClick={handleSaveMensal} disabled={saving} style={{...s.btnTeal,opacity:saving?0.6:1}}>{saving?'Salvando...':'Cadastrar'}</button>
            </div>
          </div>
        </div>
      )}

      {modalGerar&&(
        <div style={s.overlay} onClick={e=>e.target===e.currentTarget&&setModalGerar(null)}>
          <div style={{...s.modal,width:420}}>
            <div style={s.mhdr}>
              <h3 style={{fontSize:15,fontWeight:700,display:'flex',alignItems:'center',gap:8}}><Icon name="refresh" size={15}/>{modalGerar.titulo} — Este mês</h3>
              <button onClick={()=>setModalGerar(null)} style={{background:'none',border:'none',cursor:'pointer',color:'#64748B'}}><Icon name="x" size={20}/></button>
            </div>
            <div style={{padding:'1.5rem'}}>
              <p style={{fontSize:13,color:'#64748B',marginBottom:16}}>Informe o valor da conta neste mês:</p>
              <label style={s.lb}>Valor *</label>
              <input style={s.fi} value={valorGerar} placeholder="R$ 0,00" onChange={e=>{
                const d=e.target.value.replace(/\D/g,'')
                setValorGerar(d?(parseInt(d)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'')
              }}/>
            </div>
            <div style={s.mfoot}>
              <button onClick={()=>setModalGerar(null)} style={{...s.btnOut,padding:'.5rem 1rem',fontSize:13}}>Cancelar</button>
              <button onClick={handleGerarLancamento} disabled={saving||!valorGerar} style={{...s.btnTeal,opacity:(saving||!valorGerar)?0.6:1}}>{saving?'Gerando...':'Gerar lançamento'}</button>
            </div>
          </div>
        </div>
      )}

      {modalFornecedor&&(
        <div style={s.overlay} onClick={e=>e.target===e.currentTarget&&setModalFornecedor(false)}>
          <div style={{...s.modal,width:440}}>
            <div style={s.mhdr}>
              <h3 style={{fontSize:15,fontWeight:700}}>{fornecedorEdit?'Editar Fornecedor':'Novo Fornecedor'}</h3>
              <button onClick={()=>setModalFornecedor(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#64748B'}}><Icon name="x" size={20}/></button>
            </div>
            <div style={{padding:'1.5rem',display:'grid',gap:14}}>
              <div>
                <label style={s.lb}>Nome da empresa *</label>
                <input style={s.fi} value={formFornecedor.nome} onChange={e=>setFormFornecedor(p=>({...p,nome:e.target.value}))} placeholder="Ex: Materiais São José"/>
              </div>
              <div>
                <label style={s.lb}>CNPJ</label>
                <input style={s.fi} value={formFornecedor.cnpj?fmtCNPJ(formFornecedor.cnpj):''} maxLength={18} placeholder="00.000.000/0000-00"
                  onChange={e=>setFormFornecedor(p=>({...p,cnpj:e.target.value.replace(/\D/g,'')}))}/>
              </div>
            </div>
            <div style={s.mfoot}>
              <button onClick={()=>setModalFornecedor(false)} style={{...s.btnOut,padding:'.5rem 1rem',fontSize:13}}>Cancelar</button>
              <button onClick={handleSalvarFornecedor} disabled={saving} style={{...s.btnTeal,opacity:saving?0.6:1}}>{saving?'Salvando...':(fornecedorEdit?'Salvar alterações':'Cadastrar')}</button>
            </div>
          </div>
        </div>
      )}

      {toast&&(
        <div style={{position:'fixed',bottom:20,right:20,padding:'.75rem 1.25rem',borderRadius:10,fontSize:13,fontWeight:500,color:'#fff',background:toast.ok?'#16A34A':'#DC2626',boxShadow:'0 4px 16px rgba(0,0,0,.2)',zIndex:100,maxWidth:400}}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}