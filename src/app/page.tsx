'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { api, Lancamento, ItemLancamento, ContaMensal, Fornecedor, Obra, Funcionario, PagamentoFuncionario, PagamentoContaMensal, fmtR, fmtData, fmtCNPJ, mesLabel, PIPELINE, PIPELINE_LOCKED_FROM, PIPELINE_NF_FROM } from '../services/api'
import { s, ACCENT, ACCENT_LT, PIPE_COLORS } from '../lib/theme'
import Icon from '../components/Icon'
import Sidebar from '../components/Sidebar'
import LoginScreen from '../components/LoginScreen'
import { KPI, Badge, StepBadge, FF, AnexoBtn, FornecedorInput, ItensEditor, PipelineStepper } from '../components/ui'
import MonthlyAccountsView from '../components/MonthlyAccountsView'
import FolhaPagamentoView from '../components/FolhaPagamentoView'

function pipeIdx(st: string) { return PIPELINE.findIndex(p => p.id === st) }
function isLocked(st: string) { return pipeIdx(st) >= pipeIdx(PIPELINE_LOCKED_FROM) }
function canAttachNF(st: string) { return pipeIdx(st) >= pipeIdx(PIPELINE_NF_FROM) }
function isNotaFiscal(lancamento: Lancamento) {
  return Boolean(lancamento.arquivo_url)
}

function addDiasCorridos(dias: number): string {
  const d = new Date(); d.setDate(d.getDate() + dias); return d.toISOString().slice(0,10)
}
function addDiasUteis(dias: number): string {
  let count = 0; const d = new Date()
  while (count < dias) { d.setDate(d.getDate()+1); const dow=d.getDay(); if(dow!==0&&dow!==6) count++ }
  return d.toISOString().slice(0,10)
}

async function lerDocIA(file: File, prompt: string): Promise<any> {
  return api.lerDocumento(file, prompt)
}

export default function Home() {
  const [logado,setLogado]=useState(false)
  const [user,setUser]=useState('')
  const [role,setRole]=useState<'lancadora'|'gestora'|'entregador'>('lancadora')
  const [aba,setAba]=useState<'visao'|'lancamentos'|'notas-fiscais'|'mensais'|'fornecedores'|'obras'|'folha'|'pagar'>('visao')
  const [data,setData]=useState<Lancamento[]>([])
  const [cats,setCats]=useState<any[]>([])
  const [contasMensais,setContasMensais]=useState<ContaMensal[]>([])
  const [pagamentosMensais,setPagamentosMensais]=useState<PagamentoContaMensal[]>([])
  const [fornecedores,setFornecedores]=useState<Fornecedor[]>([])
  const [obras,setObras]=useState<Obra[]>([])
  const [funcionarios,setFuncionarios]=useState<Funcionario[]>([])
  const [pagamentosFuncionarios,setPagamentosFuncionarios]=useState<PagamentoFuncionario[]>([])
  const [loading,setLoading]=useState(true)
  const [fPipe,setFPipe]=useState('')
  const [fRec,setFRec]=useState('')
  const [fDataIni,setFDataIni]=useState('')
  const [fDataFim,setFDataFim]=useState('')
  const [search,setSearch]=useState('')
  const [searchForn,setSearchForn]=useState('')
  const [searchMensal,setSearchMensal]=useState('')
  const [fObra,setFObra]=useState('')
  const [modalObra,setModalObra]=useState(false)
  const [obraEdit,setObraEdit]=useState<Obra|null>(null)
  const [formObra,setFormObra]=useState<{nome:string;endereco:string}>({nome:'',endereco:''})
  const [searchFuncionario,setSearchFuncionario]=useState('')
  const [viewFolha,setViewFolha]=useState<'lista'|'grade'>('lista')
  const [modalFuncionario,setModalFuncionario]=useState(false)
  const [funcionarioEdit,setFuncionarioEdit]=useState<Funcionario|null>(null)
  const [formFuncionario,setFormFuncionario]=useState<{nome:string;cargo:string;salarioBase:string;obraId:string}>({nome:'',cargo:'',salarioBase:'',obraId:''})
  const [modalPagarFuncionario,setModalPagarFuncionario]=useState<Funcionario|null>(null)
  const [valorPagarFuncionario,setValorPagarFuncionario]=useState('')
  const [dataPagarFuncionario,setDataPagarFuncionario]=useState('')
  const [tipoPagarFuncionario,setTipoPagarFuncionario]=useState<'salario'|'adiantamento'|'vale'|'outro'>('salario')
  const [modalHistoricoFuncionario,setModalHistoricoFuncionario]=useState<Funcionario|null>(null)
  const [historicoFuncionario,setHistoricoFuncionario]=useState<PagamentoFuncionario[]>([])
  const [viewMensal,setViewMensal]=useState<'lista'|'grade'>('lista')
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
  const [nfNumeroTemp,setNfNumeroTemp]=useState('')
  const [rawFreteNF,setRawFreteNF]=useState('')
  const [modalMensal,setModalMensal]=useState(false)
  const [formMensal,setFormMensal]=useState<any>({})
  const [modalPagParcial,setModalPagParcial]=useState(false)
  const [pagParcialTipo,setPagParcialTipo]=useState('pix')
  const [pagParcialValor,setPagParcialValor]=useState('')
  const [pagParcialData,setPagParcialData]=useState('')
  const [pagParcialObs,setPagParcialObs]=useState('')
  const [pagParcialParc,setPagParcialParc]=useState('')
  const [modalFornecedor,setModalFornecedor]=useState(false)
  const [fornecedorEdit,setFornecedorEdit]=useState<Fornecedor|null>(null)
  const [formFornecedor,setFormFornecedor]=useState<{nome:string;cnpj:string;masterId:string}>({nome:'',cnpj:'',masterId:''})
  const [modalPagarConta,setModalPagarConta]=useState<ContaMensal|null>(null)
  const [valorPagarConta,setValorPagarConta]=useState('')
  const [dataPagarConta,setDataPagarConta]=useState('')
  const [modalHistoricoConta,setModalHistoricoConta]=useState<ContaMensal|null>(null)
  const [historicoConta,setHistoricoConta]=useState<PagamentoContaMensal[]>([])

  const orcIARef=useRef<HTMLInputElement>(null)
  const propostaDetRef=useRef<HTMLInputElement>(null)
  const nfDetRef=useRef<HTMLInputElement>(null)

  const HOJE = new Date().toISOString().slice(0,10)

  const showToast=(msg:string,ok=true)=>{setToast({msg,ok});setTimeout(()=>setToast(null),4500)}
  const set=(k:string,v:any)=>setForm((p:any)=>({...p,[k]:v}))
  const setM=(k:string,v:any)=>setFormMensal((p:any)=>({...p,[k]:v}))

  useEffect(()=>{ api.limparCacheLocal() },[])

  const load=useCallback(async(silent=false)=>{
    if(!silent) setLoading(true)
    try {
      const [lista,mensais,categorias,forns,pagMensais,listaObras,listaFuncionarios,listaPagamentosFuncionarios]=await Promise.all([
        api.listar({status_processo:fPipe,recorrente:fRec,obra_id:fObra}),
        api.listarContasMensais(),
        api.categorias(),
        api.listarFornecedores(),
        api.listarPagamentosMensais(),
        api.listarObras(),
        api.listarFuncionarios(),
        api.listarPagamentosFuncionarios(),
      ])
      setData(lista);setContasMensais(mensais);setCats(categorias);setFornecedores(forns);setPagamentosMensais(pagMensais);setObras(listaObras);setFuncionarios(listaFuncionarios);setPagamentosFuncionarios(listaPagamentosFuncionarios)
    } catch {
      setData([]);setCats([]);setFornecedores([]);setObras([]);setFuncionarios([]);setPagamentosFuncionarios([])
      if(!silent) showToast('Não foi possível carregar os dados compartilhados. Verifique a conexão do sistema.',false)
    }
    finally {if(!silent) setLoading(false)}
  },[fPipe,fRec,fObra])

  useEffect(()=>{if(logado)load()},[load,logado])

  useEffect(()=>{
    if(!logado) return
    const interval = setInterval(()=>{ load(true) }, 15000)
    return ()=>clearInterval(interval)
  },[logado,load])

  const openNovo=()=>{
    setForm({data:new Date().toISOString().slice(0,10),pago:false,recorrente:false,status_processo:'orcamento_aprovado',tipo_pagamento:'avista',titulo:'',numero_orcamento:'',cnpj:'',obra_id:'',proposta_url:null})
    setItensOrcamento([]);setRawFrete('');setRawDesconto('');setDetalhe(null);setModal(true)
  }

  const openDetalhe=async(id:string)=>{
    try {
      const d=await api.buscar(id);setDetalhe(d);setModal(true)
    } catch (err:any) {
      showToast('Erro ao abrir lançamento: '+(err?.message||'tente novamente'),false)
    }
  }

  const handleImportarOrcamento=async(file:File)=>{
    setLoadingIA(true)
    try {
      const [leitura, anexo] = await Promise.allSettled([
        lerDocIA(file,`Extraia todos os dados deste orçamento e retorne APENAS um JSON válido:
        {"numero_orcamento":"número do orçamento se existir","titulo":"nome da empresa fornecedora","cnpj":"somente números","data":"YYYY-MM-DD","valor_frete":0.00,"itens":[{"nome":"produto","quantidade":1.0,"unidade_medida":"Kg, Un, Rolo, M, Caixa ou outra unidade do documento","valor_unitario":0.00,"valor_total":0.00}]}
Para cada item, extraia quantidade, unidade de medida, valor unitário E valor total exatamente como aparecem no documento. Liste TODOS os itens/produtos do orçamento, sem pular nenhum.`),
        api.uploadArquivo(file),
      ])
      if (leitura.status === 'rejected') throw leitura.reason
      const dados = leitura.value
      if(dados.titulo) set('titulo',dados.titulo)
      if(dados.numero_orcamento) set('numero_orcamento',String(dados.numero_orcamento))
      if(dados.cnpj) set('cnpj',dados.cnpj)
      if(dados.data) set('data',dados.data)
      if(dados.valor_frete>0) setRawFrete(dados.valor_frete.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}))
      if (anexo.status === 'fulfilled') set('proposta_url', anexo.value)
      if(dados.itens?.length>0) {
        setItensOrcamento(dados.itens.map((i:any)=>({
          nome:i.nome||'',
          quantidade:i.quantidade||1,
          unidade_medida:i.unidade_medida||'Un',
          valor_unitario:i.valor_unitario||0,
          valor_total: i.valor_total>0 ? i.valor_total : (i.quantidade||1)*(i.valor_unitario||0),
          tipo:'orcamento' as const,
        })))
        showToast(anexo.status === 'fulfilled' ? 'Orçamento importado com itens e proposta anexada!' : 'Orçamento lido com itens. O PDF não foi anexado.')
      } else {
        showToast(anexo.status === 'fulfilled' ? 'Empresa e proposta anexada, mas nenhum item foi identificado. Adicione manualmente se precisar.' : 'PDF lido, mas nenhum item foi identificado e o anexo não foi salvo.',false)
      }
    } catch (err:any) {
      showToast(err?.message || 'Não foi possível ler o PDF. Preencha manualmente.',false)
    } finally {setLoadingIA(false)}
  }

  const handleSave=async()=>{
    if(!form.titulo||!form.data) return showToast('Preencha empresa e data',false)
    setSaving(true)
    try {
      const valor_produtos=itensOrcamento.reduce((s,i)=>s+(i.valor_total||0),0)
      const vFrete=parseFloat(rawFrete.replace(/\D/g,''))/100||0
      const valor_total=valor_produtos+vFrete
      await api.criar({
        ...form,
        tipo_pagamento: form.tipo_pagamento || 'avista',
        valor_produtos,
        valor_frete: vFrete,
        valor_total,
        valor_original: valor_total,
        criado_por: user,
        itens: itensOrcamento,
      })
      if(form.titulo) await api.salvarFornecedor(form.titulo,form.cnpj||undefined)
      setModal(false);showToast('Orçamento salvo no banco compartilhado!');load()
    } catch (err:any) {
      showToast('Erro ao salvar: '+(err?.message||'desconhecido'),false)
    } finally {setSaving(false)}
  }

  const handleSalvarDesconto=async()=>{
    if(!detalhe) return
    const valor_desconto=parseFloat(rawDesconto.replace(/\D/g,''))/100||0
    const valor_total=(detalhe.valor_original||detalhe.valor_total)-valor_desconto
    try {
      await api.atualizarLancamento(detalhe.id,{tem_desconto:valor_desconto>0,valor_desconto,valor_total})
      const d=await api.buscar(detalhe.id);setDetalhe(d);setRawDesconto('');showToast('Desconto aplicado!')
    } catch (err:any) { showToast('Erro: '+(err?.message||''),false) }
  }

  const handleAnexarProposta=async(file:File)=>{
    if(!detalhe) return
    setLoadingAnexo(true)
    try {
      const url=await api.uploadArquivo(file)
      await api.atualizarLancamento(detalhe.id,{proposta_url:url})
      const d=await api.buscar(detalhe.id);setDetalhe(d);showToast('Proposta anexada!')
    } catch (err:any) {showToast('Erro ao enviar: '+(err?.message||''),false)}
    finally {setLoadingAnexo(false)}
  }

  const handleAnexarNFComIA=async(file:File)=>{
    if(!detalhe) return
    setNfFileTemp(file);setLoadingIANF(true)
    try {
      const dados=await lerDocIA(file,`Extraia os dados desta nota fiscal e retorne APENAS um JSON válido:
{"numero_nf":"número da nota fiscal","valor_frete":0.00,"itens":[{"nome":"produto","quantidade":1.0,"unidade_medida":"Kg, Un, Rolo, M, Caixa ou outra unidade do documento","valor_unitario":0.00,"valor_total":0.00}]}
Para cada item, extraia quantidade, unidade de medida, valor unitário E valor total exatamente como aparecem no documento. Liste TODOS os itens.`)
      const itens=(dados.itens||[]).map((i:any)=>({
        nome:i.nome||'', quantidade:i.quantidade||1, unidade_medida:i.unidade_medida||'Un',
        valor_unitario:i.valor_unitario||0,
        valor_total: i.valor_total>0 ? i.valor_total : (i.quantidade||1)*(i.valor_unitario||0),
        tipo:'nf' as const,
      }))
      setItensNFEditor(itens)
      setNfNumeroTemp(dados.numero_nf||'')
      setRawFreteNF(dados.valor_frete>0?dados.valor_frete.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'')
      setModalNFItens(true)
    } catch {
      setItensNFEditor([]);setNfNumeroTemp('');setRawFreteNF('');setModalNFItens(true)
      showToast('IA não extraiu os dados. Preencha manualmente.',false)
    } finally {setLoadingIANF(false)}
  }

  const handleSalvarNF=async()=>{
    if(!detalhe||!nfFileTemp) return
    setLoadingAnexo(true)
    try {
      const url=await api.uploadArquivo(nfFileTemp)
      const vFreteNF=parseFloat(rawFreteNF.replace(/\D/g,''))/100||0
      await api.atualizarLancamento(detalhe.id,{arquivo_url:url,nf_numero:nfNumeroTemp||undefined,valor_frete:vFreteNF||detalhe.valor_frete})
      await api.salvarItensNF(detalhe.id,itensNFEditor)
      const d=await api.buscar(detalhe.id);setDetalhe(d)
      setModalNFItens(false);setModal(false);setNfFileTemp(null);setItensNFEditor([]);setNfNumeroTemp('');setRawFreteNF('')
      setAba('notas-fiscais');load()
      showToast('NF e itens salvos!')
    } catch (err:any) {showToast('Erro ao salvar NF: '+(err?.message||''),false)}
    finally {setLoadingAnexo(false)}
  }

  const handlePipelineChange=async(novoStatus:string)=>{
    if(!detalhe) return
    if(novoStatus==='entrega_programada'){setEntregaTipo('corridos');setDiasEntrega('');setEntregaData1('');setEntregaData2State('');setEntregaItens1('');setEntregaItens2('');setModalEntregaProg(true);return}
    if(novoStatus==='pagamento_realizado'){setFormaPgtoTipo('pix');setFormaPgtoParc('');setFormaPgtoObs('');setFormaPgtoData(new Date().toISOString().slice(0,10));setModalFormaPgto(true);return}
    try {
      await api.atualizarLancamento(detalhe.id,{status_processo:novoStatus})
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
      await api.atualizarLancamento(detalhe.id,{status_processo:'pagamento_realizado',pago:true,data_pagamento:formaPgtoData,forma_pagamento:fp})
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

      await api.atualizarLancamento(detalhe.id,{
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
      await api.atualizarLancamento(detalhe.id,{
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
    await api.excluirLancamento(id)
    setModal(false);showToast('Excluído!');load()
  }

  const handleMarcarItemEntregue=async(item:ItemLancamento,data_entrega:string)=>{
    if(!detalhe) return
    await api.atualizarItem(item.id!,{entregue:true,data_entrega})
    const d=await api.buscar(detalhe.id)
    const todos=d.itens?.filter((i:any)=>i.tipo==='orcamento')||[]
    const todosEntregues=todos.every((i:any)=>i.entregue)
    if(todosEntregues&&d.status_processo==='entrega_programada') {
      await api.atualizarLancamento(detalhe.id,{status_processo:'mercadoria_recebida',status_entrega:'entregue',data_entrega})
    }
    const d2=await api.buscar(detalhe.id);setDetalhe(d2);showToast('Item confirmado!');load()
  }

  const handleSaveMensal=async()=>{
    if(!formMensal.titulo||!formMensal.dia_vencimento) return showToast('Preencha todos os campos',false)
    setSaving(true)
    try {
      await api.criarContaMensal({...formMensal,pago_por:'Servis Empreendimentos',ativo:true})
      setModalMensal(false);setFormMensal({});showToast('Conta mensal cadastrada!');load()
    } catch (err:any) {showToast('Erro: '+(err?.message||''),false)}
    finally {setSaving(false)}
  }

  const openNovoFornecedor=()=>{
    setFornecedorEdit(null)
    setFormFornecedor({nome:'',cnpj:'',masterId:''})
    setModalFornecedor(true)
  }
  const openEditarFornecedor=(f:Fornecedor)=>{
    setFornecedorEdit(f)
    setFormFornecedor({nome:f.nome,cnpj:f.cnpj||'',masterId:f.fornecedor_master_id||''})
    setModalFornecedor(true)
  }
  const handleSalvarFornecedor=async()=>{
    if(!formFornecedor.nome.trim()) return showToast('Informe o nome do fornecedor',false)
    setSaving(true)
    try {
      if(fornecedorEdit) {
        await api.atualizarFornecedor(fornecedorEdit.id,{nome:formFornecedor.nome.trim(),cnpj:formFornecedor.cnpj||null,fornecedor_master_id:formFornecedor.masterId||null})
        showToast('Fornecedor atualizado!')
      } else {
        await api.criarFornecedor(formFornecedor.nome.trim(),formFornecedor.cnpj||undefined,formFornecedor.masterId||null)
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

  const openNovaObra=()=>{
    setObraEdit(null)
    setFormObra({nome:'',endereco:''})
    setModalObra(true)
  }
  const openEditarObra=(o:Obra)=>{
    setObraEdit(o)
    setFormObra({nome:o.nome,endereco:o.endereco||''})
    setModalObra(true)
  }
  const handleSalvarObra=async()=>{
    if(!formObra.nome.trim()) return showToast('Informe o nome da obra',false)
    setSaving(true)
    try {
      if(obraEdit) {
        await api.atualizarObra(obraEdit.id,{nome:formObra.nome.trim(),endereco:formObra.endereco||null})
        showToast('Obra atualizada!')
      } else {
        await api.criarObra(formObra.nome.trim(),formObra.endereco||undefined)
        showToast('Obra cadastrada!')
      }
      setModalObra(false);load()
    } catch (err:any) {
      showToast('Erro ao salvar: '+(err?.message||''),false)
    } finally {setSaving(false)}
  }
  const handleToggleObra=async(o:Obra)=>{
    try { await api.atualizarObra(o.id,{ativa:!o.ativa}); showToast(o.ativa?'Obra pausada':'Obra reativada'); load() }
    catch (err:any) { showToast('Erro: '+(err?.message||''),false) }
  }

  const openNovoFuncionario=()=>{
    setFuncionarioEdit(null)
    setFormFuncionario({nome:'',cargo:'',salarioBase:'',obraId:''})
    setModalFuncionario(true)
  }
  const openEditarFuncionario=(f:Funcionario)=>{
    setFuncionarioEdit(f)
    setFormFuncionario({nome:f.nome,cargo:f.cargo||'',salarioBase:f.salario_base?f.salario_base.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'',obraId:f.obra_id||''})
    setModalFuncionario(true)
  }
  const handleSalvarFuncionario=async()=>{
    if(!formFuncionario.nome.trim()) return showToast('Informe o nome do funcionário',false)
    setSaving(true)
    try {
      const salario=parseFloat(formFuncionario.salarioBase.replace(/\D/g,''))/100||0
      if(funcionarioEdit) {
        await api.atualizarFuncionario(funcionarioEdit.id,{nome:formFuncionario.nome.trim(),cargo:formFuncionario.cargo||null,salario_base:salario,obra_id:formFuncionario.obraId||null})
        showToast('Funcionário atualizado!')
      } else {
        await api.criarFuncionario({nome:formFuncionario.nome.trim(),cargo:formFuncionario.cargo||null,salario_base:salario,obra_id:formFuncionario.obraId||null})
        showToast('Funcionário cadastrado!')
      }
      setModalFuncionario(false);load()
    } catch (err:any) {
      showToast('Erro ao salvar: '+(err?.message||''),false)
    } finally {setSaving(false)}
  }

  const abrirPagarFuncionario=(f:Funcionario, dataSugerida?:string)=>{
    setModalPagarFuncionario(f)
    setValorPagarFuncionario(f.salario_base?f.salario_base.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'')
    setDataPagarFuncionario(dataSugerida || new Date().toISOString().slice(0,10))
    setTipoPagarFuncionario('salario')
  }

  const handleRegistrarPagamentoFuncionario=async()=>{
    if(!modalPagarFuncionario||!valorPagarFuncionario||!dataPagarFuncionario) return showToast('Preencha valor e data',false)
    setSaving(true)
    try {
      const valor=parseFloat(valorPagarFuncionario.replace(/\D/g,''))/100
      await api.registrarPagamentoFuncionario(modalPagarFuncionario.id,valor,dataPagarFuncionario,tipoPagarFuncionario)
      setModalPagarFuncionario(null);showToast('Pagamento registrado!');load()
    } catch (err:any) {
      showToast('Erro: '+(err?.message||''),false)
    } finally {setSaving(false)}
  }

  const abrirHistoricoFuncionario=async(f:Funcionario)=>{
    setModalHistoricoFuncionario(f)
    const h=await api.listarPagamentosDoFuncionario(f.id)
    setHistoricoFuncionario(h)
  }

  const handleExcluirPagamentoFuncionario=async(id:string)=>{
    if(!confirm('Excluir este pagamento?')) return
    await api.excluirPagamentoFuncionario(id)
    if(modalHistoricoFuncionario) { const h=await api.listarPagamentosDoFuncionario(modalHistoricoFuncionario.id); setHistoricoFuncionario(h) }
    showToast('Pagamento excluído!');load()
  }

  const abrirPagarConta=(c:ContaMensal, dataSugerida?:string)=>{
    setModalPagarConta(c)
    setValorPagarConta('')
    setDataPagarConta(dataSugerida || new Date().toISOString().slice(0,10))
  }

  const handleRegistrarPagamentoConta=async()=>{
    if(!modalPagarConta||!valorPagarConta||!dataPagarConta) return showToast('Preencha valor e data',false)
    setSaving(true)
    try {
      const valor=parseFloat(valorPagarConta.replace(/\D/g,''))/100
      await api.registrarPagamentoMensal(modalPagarConta.id,valor,dataPagarConta)
      setModalPagarConta(null);showToast('Pagamento registrado!');load()
    } catch (err:any) {
      showToast('Erro: '+(err?.message||''),false)
    } finally {setSaving(false)}
  }

  const abrirHistoricoConta=async(c:ContaMensal)=>{
    setModalHistoricoConta(c)
    const h=await api.listarPagamentosDaConta(c.id)
    setHistoricoConta(h)
  }

  const handleExcluirPagamentoConta=async(id:string)=>{
    if(!confirm('Excluir este pagamento?')) return
    await api.excluirPagamentoMensal(id)
    if(modalHistoricoConta) { const h=await api.listarPagamentosDaConta(modalHistoricoConta.id); setHistoricoConta(h) }
    showToast('Pagamento excluído!');load()
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
  const listaOrcamentos = aba==='notas-fiscais' ? filtered.filter(isNotaFiscal) : filtered.filter(lancamento=>!isNotaFiscal(lancamento))

  const matchFornecedor = (f:Fornecedor) => {
    if(!searchForn) return true
    const q=searchForn.toLowerCase()
    return f.nome.toLowerCase().includes(q) || (f.cnpj||'').includes(q)
  }
  const fornecedorMasters = fornecedores.filter(f=>!f.fornecedor_master_id)
  const fornecedorMasterIds = new Set(fornecedorMasters.map(m=>m.id))
  const fornecedorRows:{fornecedor:Fornecedor;isSub:boolean}[] = []
  fornecedorMasters.forEach(m=>{
    const subs = fornecedores.filter(f=>f.fornecedor_master_id===m.id)
    const subsMatching = subs.filter(matchFornecedor)
    const masterMatches = matchFornecedor(m)
    if(masterMatches||subsMatching.length>0) {
      fornecedorRows.push({fornecedor:m,isSub:false})
      ;(masterMatches?subs:subsMatching).forEach(s=>fornecedorRows.push({fornecedor:s,isSub:true}))
    }
  })
  fornecedores.filter(f=>f.fornecedor_master_id&&!fornecedorMasterIds.has(f.fornecedor_master_id)).filter(matchFornecedor).forEach(f=>fornecedorRows.push({fornecedor:f,isSub:false}))

  const totalValor=data.reduce((s,l)=>s+l.valor_total,0)
  const totalSaldo=data.reduce((s,l)=>s+(l.saldo_devedor||0),0)
  const valorPagoLancamento=(l:Lancamento)=>Math.max(0,l.valor_total-(l.saldo_devedor ?? (l.pago?0:l.valor_total)))
  const totalPago=data.reduce((s,l)=>s+valorPagoLancamento(l),0)
  const totalTratativa=data.filter(l=>l.status_processo==='em_tratativa').length
  const obrasVisiveis=obras
  const porObra=[
    ...obrasVisiveis.map(o=>{
      const lancs=data.filter(l=>l.obra_id===o.id)
      return {obra:o,total:lancs.reduce((s,l)=>s+l.valor_total,0),pago:lancs.reduce((s,l)=>s+valorPagoLancamento(l),0),saldo:lancs.reduce((s,l)=>s+(l.saldo_devedor||0),0),qtd:lancs.length}
    }),
    (()=>{
      const semObra=data.filter(l=>!l.obra_id)
      return {obra:{id:'',nome:'Sem obra vinculada',ativa:true} as Obra,total:semObra.reduce((s,l)=>s+l.valor_total,0),pago:semObra.reduce((s,l)=>s+valorPagoLancamento(l),0),saldo:semObra.reduce((s,l)=>s+(l.saldo_devedor||0),0),qtd:semObra.length}
    })(),
  ].filter(item=>item.qtd>0||item.obra.id)
  const maxTotalObra=Math.max(...porObra.map(item=>item.total),1)
  const tratativas=data.filter(l=>l.status_processo==='em_tratativa').slice(0,8)

  type ItemPagar = {id:string;tipo:'nf'|'folha'|'mensais';nome:string;valor:number;data:string;lancamentoId?:string}
  const itensNF:ItemPagar[]=data.filter(l=>l.pago).map(l=>({id:'nf-'+l.id,tipo:'nf',nome:l.titulo,valor:l.valor_total,data:l.data_pagamento||l.data,lancamentoId:l.id}))
  const gruposFolha:Record<string,{valor:number;data:string}>={}
  pagamentosFuncionarios.forEach(p=>{
    const mes=(p.data_pagamento||'').slice(0,7)
    if(!mes) return
    if(!gruposFolha[mes]) gruposFolha[mes]={valor:0,data:p.data_pagamento}
    gruposFolha[mes].valor+=p.valor
    if(p.data_pagamento>gruposFolha[mes].data) gruposFolha[mes].data=p.data_pagamento
  })
  const itensFolha:ItemPagar[]=Object.entries(gruposFolha).map(([mes,g])=>({id:'folha-'+mes,tipo:'folha',nome:`Folha de ${mesLabel(mes)}`,valor:g.valor,data:g.data}))
  const gruposMensais:Record<string,{valor:number;data:string}>={}
  pagamentosMensais.forEach(p=>{
    const mes=(p.data_pagamento||'').slice(0,7)
    if(!mes) return
    if(!gruposMensais[mes]) gruposMensais[mes]={valor:0,data:p.data_pagamento}
    gruposMensais[mes].valor+=p.valor
    if(p.data_pagamento>gruposMensais[mes].data) gruposMensais[mes].data=p.data_pagamento
  })
  const itensMensais:ItemPagar[]=Object.entries(gruposMensais).map(([mes,g])=>({id:'mensais-'+mes,tipo:'mensais',nome:`Contas de ${mesLabel(mes)}`,valor:g.valor,data:g.data}))
  const contasAPagar=[...itensNF,...itensFolha,...itensMensais].sort((a,b)=>(b.data||'').localeCompare(a.data||''))
  const totalContasAPagar=contasAPagar.reduce((s,i)=>s+i.valor,0)

  const th=(label:string)=><th style={{padding:'8px 11px',textAlign:'left',fontSize:10,fontWeight:700,color:'#7D7D7D',textTransform:'uppercase',whiteSpace:'nowrap'}}>{label}</th>

  return (
    <div className="app-shell" style={s.page}>

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

          <div className="workspace-bar">
            <div>
              <p className="workspace-eyebrow">Central de operações</p>
              <p className="workspace-sync"><span className="workspace-sync-dot"/>Dados sincronizados automaticamente</p>
            </div>
            <span className="workspace-date">{new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'})}</span>
          </div>

          {role==='entregador'&&(
            <div>
              <div style={s.row}>
                <div><h1 style={s.h1}>Entregas</h1><p style={s.p}>Confirme os itens recebidos e anexe a nota fiscal</p></div>
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
                  <thead><tr style={{background:'#FAFBFA',borderBottom:'2px solid #E2E6E4'}}>{th('Empresa')}{th('Etapa')}{th('Entrega prevista')}</tr></thead>
                  <tbody>
                    {loading?<tr><td colSpan={3} style={{textAlign:'center',padding:'3rem',color:'#7D7D7D'}}>Carregando...</td></tr>
                    :filtered.filter(l=>l.criado_em&&l.criado_em.slice(0,10)>=HOJE).length===0?<tr><td colSpan={3} style={{textAlign:'center',padding:'3rem',color:'#7D7D7D'}}>Nenhum lançamento aguardando entrega</td></tr>
                    :filtered.filter(l=>l.criado_em&&l.criado_em.slice(0,10)>=HOJE).map(l=>{
                      const step=PIPELINE.find(p=>p.id===l.status_processo)
                      const cor=PIPE_COLORS[l.status_processo]||'#7D7D7D'
                      return (
                        <tr key={l.id} onClick={()=>openDetalhe(l.id)} style={{borderBottom:'1px solid #E2E6E4',cursor:'pointer'}}
                          onMouseEnter={e=>(e.currentTarget.style.background='#F5F7F6')} onMouseLeave={e=>(e.currentTarget.style.background='')}>
                          <td style={{padding:'10px 11px',fontWeight:600}}>{l.titulo}</td>
                          <td style={{padding:'10px 11px'}}>{step&&<StepBadge stepId={step.id} label={step.label} color={cor}/>}</td>
                          <td style={{padding:'10px 11px',color:'#7D7D7D'}}>{l.data_entrega_programada?fmtData(l.data_entrega_programada):'—'}</td>
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
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:12,marginBottom:'1.35rem'}}>
                <KPI l="Valor total" v={fmtR(totalValor)} sv="soma dos contratos" c="#7D7D7D"/>
                <KPI l="Valor pago" v={fmtR(totalPago)} sv="valor já quitado" c="#8BA59A"/>
                <KPI l="Saldo devedor" v={fmtR(totalSaldo)} sv="valores em aberto" c="#777777"/>
                <KPI l="Em tratativa" v={totalTratativa} sv="orçamentos em negociação" c="#748F84"/>
              </div>
              <div className="overview-grid overview-grid-chart-focus">
                <div style={s.card}>
                  <div style={s.toolbar}>
                    <div style={{display:'grid',gap:3,flex:1}}>
                      <span style={{fontSize:10,fontWeight:700,color:'#7D7D7D',textTransform:'uppercase',letterSpacing:'.1em'}}>Resumo por obra</span>
                      <span style={{fontSize:11,color:'#969696'}}>Total contratado, valor pago e saldo devedor</span>
                    </div>
                    <button onClick={()=>setAba('obras')} style={{background:'none',border:'none',color:ACCENT,fontWeight:600,cursor:'pointer',fontSize:11,padding:0}}>Gerenciar obras →</button>
                  </div>
                  {porObra.length===0?(
                    <p style={{padding:'2rem',textAlign:'center',color:'#7D7D7D',fontSize:12}}>Nenhuma obra ou lançamento cadastrado ainda.</p>
                  ):(
                    <div className="overview-table-wrap">
                      <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                        <thead>
                          <tr style={{background:'#FAFBFA',borderBottom:'2px solid #E2E6E4'}}>
                            {th('Obra')}{th('Lançamentos')}{th('Valor total')}{th('Valor pago')}{th('Saldo devedor')}
                          </tr>
                        </thead>
                        <tbody>
                          {porObra.map(item=>(
                            <tr key={item.obra.id||'sem-obra'} style={{borderBottom:'1px solid #E2E6E4',cursor:item.obra.id?'pointer':'default'}}
                              onClick={()=>{if(item.obra.id){setFObra(item.obra.id);setAba('lancamentos')}}}
                              onMouseEnter={e=>(e.currentTarget.style.background='#F5F7F6')} onMouseLeave={e=>(e.currentTarget.style.background='')}>
                              <td style={{padding:'11px',fontWeight:700}}>{item.obra.nome}</td>
                              <td style={{padding:'11px',color:'#7D7D7D'}}>{item.qtd}</td>
                              <td style={{padding:'11px',fontWeight:700}}>{fmtR(item.total)}</td>
                              <td style={{padding:'11px',fontWeight:700,color:ACCENT_LT}}>{fmtR(item.pago)}</td>
                              <td style={{padding:'11px',fontWeight:700,color:item.saldo>0?'#777777':'#A6B0AA'}}>{item.saldo>0?fmtR(item.saldo):'Quitado'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                <div className="overview-chart-card" style={s.card}>
                  <div style={s.toolbar}>
                    <div style={{display:'grid',gap:3}}>
                      <span style={{fontSize:10,fontWeight:700,color:'#7D7D7D',textTransform:'uppercase',letterSpacing:'.1em'}}>Gráfico financeiro</span>
                      <span style={{fontSize:11,color:'#969696'}}>Comparativo por obra</span>
                    </div>
                  </div>
                  <div className="overview-chart" role="img" aria-label="Gráfico de valor total, pago e saldo devedor por obra">
                    {porObra.length===0?<span style={{fontSize:12,color:'#7D7D7D'}}>Sem dados para exibir</span>:porObra.map(item=>(
                      <div className="overview-chart-row" key={item.obra.id||'sem-obra'}>
                        <div className="overview-chart-label" title={item.obra.nome}>{item.obra.nome}</div>
                        <div className="overview-chart-bars">
                          <span className="overview-bar overview-bar-total" style={{width:`${Math.max(5,(item.total/maxTotalObra)*100)}%`}} title={`Total: ${fmtR(item.total)}`}/>
                          <span className="overview-bar overview-bar-paid" style={{width:`${item.total?Math.max(3,(item.pago/item.total)*100):0}%`}} title={`Pago: ${fmtR(item.pago)}`}/>
                        </div>
                        <strong>{fmtR(item.saldo)}</strong>
                      </div>
                    ))}
                  </div>
                  <div className="overview-chart-legend"><span><i className="legend-total"/> Total</span><span><i className="legend-paid"/> Pago</span><span><i className="legend-debt"/> Saldo</span></div>
                </div>
              </div>
              <div style={{height:16}}/>
              <div style={s.card}>
                <div style={s.toolbar}>
                  <div style={{display:'grid',gap:3,flex:1}}>
                    <span style={{fontSize:10,fontWeight:700,color:'#7D7D7D',textTransform:'uppercase',letterSpacing:'.1em'}}>Orçamentos em tratativa</span>
                    <span style={{fontSize:11,color:'#969696'}}>Somente negociações que ainda estão em andamento</span>
                  </div>
                  <button onClick={()=>{setFPipe('em_tratativa');setAba('lancamentos')}} style={{background:'none',border:'none',color:ACCENT,fontWeight:600,cursor:'pointer',fontSize:11,padding:0}}>Ver em Orçamentos →</button>
                </div>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                  <thead>
                    <tr style={{background:'#FAFBFA',borderBottom:'2px solid #E2E6E4'}}>
                      {th('Empresa')}{th('Obra')}{th('Data')}{th('Total')}{th('Saldo devedor')}
                    </tr>
                  </thead>
                  <tbody>
                    {loading?<tr><td colSpan={5} style={{textAlign:'center',padding:'3rem',color:'#7D7D7D'}}>Carregando...</td></tr>
                    :tratativas.length===0?<tr><td colSpan={5} style={{textAlign:'center',padding:'2.5rem',color:'#7D7D7D'}}>Nenhum orçamento em tratativa no momento.</td></tr>
                    :tratativas.map(l=>{
                      const obraDoLanc=obras.find(o=>o.id===l.obra_id)
                      const temSaldo=l.saldo_devedor&&l.saldo_devedor>0
                      return (
                        <tr key={l.id} onClick={()=>openDetalhe(l.id)} style={{borderBottom:'1px solid #E2E6E4',cursor:'pointer'}}
                          onMouseEnter={e=>(e.currentTarget.style.background='#F5F7F6')} onMouseLeave={e=>(e.currentTarget.style.background='')}>
                          <td style={{padding:'10px 11px',fontWeight:600,maxWidth:220,overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis'}}>{l.titulo}</td>
                          <td style={{padding:'10px 11px',color:'#7D7D7D'}}>{obraDoLanc?.nome||'Sem obra'}</td>
                          <td style={{padding:'10px 11px',color:'#7D7D7D',whiteSpace:'nowrap'}}>{fmtData(l.data)}</td>
                          <td style={{padding:'10px 11px',fontWeight:700}}>{fmtR(l.valor_total)}</td>
                          <td style={{padding:'10px 11px',fontWeight:700,color:temSaldo?'#777777':'#A6B0AA'}}>{temSaldo?fmtR(l.saldo_devedor!):'Quitado'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <div style={{padding:'.6rem 1.1rem',borderTop:'1px solid #E2E6E4',fontSize:11,color:'#7D7D7D',background:'#FAFBFA'}}>
                  {tratativas.length} orçamento{tratativas.length!==1?'s':''} em tratativa
                </div>
              </div>
            </div>
          )}

          {role!=='entregador'&&aba==='pagar'&&(
            <div>
              <div style={s.row}>
                <div><h1 style={s.h1}>Contas a Pagar</h1><p style={s.p}>Tudo que já foi pago — notas fiscais, folha de pagamento e contas mensais, num lugar só</p></div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:12,marginBottom:'1.35rem'}}>
                <KPI l="Total pago" v={fmtR(totalContasAPagar)} sv="soma de tudo" c={ACCENT_LT}/>
                <KPI l="Notas fiscais" v={itensNF.length} sv="pagamentos individuais" c="#7D7D7D"/>
                <KPI l="Meses de folha" v={itensFolha.length} sv="agrupados por mês" c="#8BA59A"/>
                <KPI l="Meses de contas fixas" v={itensMensais.length} sv="agrupados por mês" c="#748F84"/>
              </div>
              <div style={s.card}>
                <div style={s.toolbar}>
                  <span style={{fontSize:10,fontWeight:700,color:'#7D7D7D',textTransform:'uppercase',letterSpacing:'.1em'}}>Histórico de pagamentos</span>
                </div>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                  <thead>
                    <tr style={{background:'#FAFBFA',borderBottom:'2px solid #E2E6E4'}}>
                      {th('Descrição')}{th('Valor pago')}
                    </tr>
                  </thead>
                  <tbody>
                    {loading?<tr><td colSpan={2} style={{textAlign:'center',padding:'3rem',color:'#7D7D7D'}}>Carregando...</td></tr>
                    :contasAPagar.length===0?<tr><td colSpan={2} style={{textAlign:'center',padding:'3rem',color:'#7D7D7D'}}>Nenhum pagamento registrado ainda</td></tr>
                    :contasAPagar.map(item=>(
                      <tr key={item.id} onClick={()=>{
                        if(item.tipo==='nf'&&item.lancamentoId) openDetalhe(item.lancamentoId)
                        else if(item.tipo==='folha') setAba('folha')
                        else setAba('mensais')
                      }} style={{borderBottom:'1px solid #E2E6E4',cursor:'pointer'}}
                        onMouseEnter={e=>(e.currentTarget.style.background='#F5F7F6')} onMouseLeave={e=>(e.currentTarget.style.background='')}>
                        <td style={{padding:'11px'}}>
                          <p style={{margin:0,fontWeight:600,color:'#374151'}}>{item.nome}</p>
                          <p style={{margin:'2px 0 0',fontSize:11,color:'#969696'}}>{item.tipo==='nf'?'Nota fiscal':item.tipo==='folha'?'Folha de pagamento':'Contas mensais'} · {fmtData(item.data)}</p>
                        </td>
                        <td style={{padding:'11px',textAlign:'right',fontWeight:700}}>{fmtR(item.valor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{padding:'.5rem 1.1rem',borderTop:'1px solid #E2E6E4',fontSize:11,color:'#7D7D7D',background:'#FAFBFA'}}>
                  {contasAPagar.length} registro{contasAPagar.length!==1?'s':''} · clique numa linha pra ver o detalhe
                </div>
              </div>
            </div>
          )}

          {role!=='entregador'&&aba==='obras'&&(
            <div>
              <div style={s.row}>
                <div><h1 style={s.h1}>Obras</h1><p style={s.p}>Cadastre cada obra e vincule os lançamentos a ela pra ter o gasto separado por obra</p></div>
                <button onClick={openNovaObra} style={s.btnTeal}><Icon name="plus" size={14} color="#fff"/> Nova obra</button>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:12,marginBottom:'1.35rem'}}>
                <KPI l="Total de obras" v={obras.length} sv="cadastradas" c={ACCENT_LT}/>
                <KPI l="Ativas" v={obras.filter(o=>o.ativa).length} sv="em andamento" c="#8BA59A"/>
                <KPI l="Pausadas" v={obras.filter(o=>!o.ativa).length} sv="finalizadas ou paradas" c="#7D7D7D"/>
              </div>
              <div style={s.card}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                  <thead>
                    <tr style={{background:'#FAFBFA',borderBottom:'2px solid #E2E6E4'}}>
                      {th('Obra')}{th('Endereço')}{th('Lançamentos')}{th('Total gasto')}{th('Status')}{th('Ações')}
                    </tr>
                  </thead>
                  <tbody>
                    {loading?<tr><td colSpan={6} style={{textAlign:'center',padding:'3rem',color:'#7D7D7D'}}>Carregando...</td></tr>
                    :obras.length===0?<tr><td colSpan={6} style={{textAlign:'center',padding:'3rem',color:'#7D7D7D'}}>Nenhuma obra cadastrada ainda</td></tr>
                    :obras.map(o=>{
                      const lancs=data.filter(l=>l.obra_id===o.id)
                      const totalObra=lancs.reduce((s,l)=>s+l.valor_total,0)
                      return (
                        <tr key={o.id} style={{borderBottom:'1px solid #E2E6E4',cursor:'pointer'}}
                          onClick={()=>{setFObra(o.id);setAba('lancamentos')}}
                          onMouseEnter={e=>(e.currentTarget.style.background='#F5F7F6')} onMouseLeave={e=>(e.currentTarget.style.background='')}>
                          <td style={{padding:'10px 11px',fontWeight:600}}>{o.nome}</td>
                          <td style={{padding:'10px 11px',color:'#7D7D7D'}}>{o.endereco||'—'}</td>
                          <td style={{padding:'10px 11px',color:'#7D7D7D'}}>{lancs.length}</td>
                          <td style={{padding:'10px 11px',fontWeight:700}}>{fmtR(totalObra)}</td>
                          <td style={{padding:'10px 11px'}}><Badge label={o.ativa?'Ativa':'Pausada'} bg={o.ativa?'#E8F0EC':'#EEF0EE'} color={o.ativa?ACCENT_LT:'#7D7D7D'}/></td>
                          <td style={{padding:'10px 11px'}} onClick={e=>e.stopPropagation()}>
                            <div style={{display:'flex',gap:8}}>
                              <button onClick={()=>openEditarObra(o)} style={{...s.btnOut,padding:'4px 10px',fontSize:11}}><Icon name="edit" size={12}/> Editar</button>
                              <button onClick={()=>handleToggleObra(o)} style={{...s.btnOut,padding:'4px 10px',fontSize:11}}>{o.ativa?'Pausar':'Reativar'}</button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <div style={{padding:'.5rem 1.1rem',borderTop:'1px solid #E2E6E4',fontSize:11,color:'#7D7D7D',background:'#FAFBFA'}}>
                  {obras.length} obra{obras.length!==1?'s':''} cadastrada{obras.length!==1?'s':''} · clique numa linha pra ver os lançamentos dela
                </div>
              </div>
            </div>
          )}

          {role!=='entregador'&&aba==='fornecedores'&&(
            <div>
              <div style={s.row}>
                <div><h1 style={s.h1}>Fornecedores</h1><p style={s.p}>Cadastro de empresas para preenchimento automático nos orçamentos</p></div>
                <button onClick={openNovoFornecedor} style={s.btnTeal}><Icon name="plus" size={14} color="#fff"/> Novo fornecedor</button>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12,marginBottom:'1.35rem'}}>
                <KPI l="Total de fornecedores" v={fornecedores.length} sv={`${fornecedorRows.length} exibidos`} c={ACCENT_LT}/>
                <KPI l="Com CNPJ cadastrado" v={fornecedores.filter(f=>f.cnpj).length} sv="dados completos" c="#8BA59A"/>
              </div>
              <div style={s.card}>
                <div style={s.toolbar}>
                  <span style={{fontSize:10,fontWeight:700,color:'#7D7D7D',textTransform:'uppercase',letterSpacing:'.1em',flex:1}}>Todos os fornecedores</span>
                  <input style={{...s.inp,width:220}} placeholder="Buscar por nome ou CNPJ..." value={searchForn} onChange={e=>setSearchForn(e.target.value)}/>
                </div>
                <div style={{overflowX:'auto',maxHeight:520,overflowY:'auto'}}>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                    <thead style={{position:'sticky',top:0,zIndex:2}}>
                      <tr style={{background:'#FAFBFA',borderBottom:'2px solid #E2E6E4'}}>
                        {th('Nome')}{th('CNPJ')}{th('Ações')}
                      </tr>
                    </thead>
                    <tbody>
                      {loading?<tr><td colSpan={3} style={{textAlign:'center',padding:'3rem',color:'#7D7D7D'}}>Carregando...</td></tr>
                      :fornecedorRows.length===0?<tr><td colSpan={3} style={{textAlign:'center',padding:'3rem',color:'#7D7D7D'}}>Nenhum fornecedor cadastrado</td></tr>
                      :fornecedorRows.map(({fornecedor:f,isSub})=>(
                        <tr key={f.id} style={{borderBottom:'1px solid #E2E6E4',background:isSub?'#FAFBFA':'transparent'}}
                          onMouseEnter={e=>(e.currentTarget.style.background='#F5F7F6')} onMouseLeave={e=>(e.currentTarget.style.background=isSub?'#FAFBFA':'')}>
                          <td style={{padding:'10px 11px',fontWeight:isSub?500:700,paddingLeft:isSub?30:11,color:isSub?'#5A5A5A':'#374151'}}>
                            {isSub&&<span style={{color:'#B7C0BC',marginRight:6}}>└</span>}{f.nome}
                          </td>
                          <td style={{padding:'10px 11px',color:'#7D7D7D'}}>{f.cnpj?fmtCNPJ(f.cnpj):'—'}</td>
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
                <div style={{padding:'.5rem 1.1rem',borderTop:'1px solid #E2E6E4',fontSize:11,color:'#7D7D7D',background:'#FAFBFA'}}>
                  {fornecedorRows.length} fornecedor{fornecedorRows.length!==1?'es':''} de {fornecedores.length} total
                </div>
              </div>
            </div>
          )}

          {role!=='entregador'&&aba==='mensais'&&(
            <MonthlyAccountsView
              contasMensais={contasMensais}
              pagamentosMensais={pagamentosMensais}
              searchMensal={searchMensal}
              setSearchMensal={setSearchMensal}
              viewMensal={viewMensal}
              setViewMensal={setViewMensal}
              onNovaConta={()=>setModalMensal(true)}
              onPagar={abrirPagarConta}
              onHistorico={abrirHistoricoConta}
              onAtualizar={()=>load()}
            />
          )}

          {role!=='entregador'&&aba==='folha'&&(
            <FolhaPagamentoView
              funcionarios={funcionarios}
              pagamentos={pagamentosFuncionarios}
              obras={obras}
              searchFuncionario={searchFuncionario}
              setSearchFuncionario={setSearchFuncionario}
              viewFolha={viewFolha}
              setViewFolha={setViewFolha}
              onNovoFuncionario={openNovoFuncionario}
              onPagar={abrirPagarFuncionario}
              onHistorico={abrirHistoricoFuncionario}
              onAtualizar={()=>load()}
            />
          )}

          {role!=='entregador'&&(aba==='lancamentos'||aba==='notas-fiscais')&&(
            <div>
              <div style={s.card} className="budget-card">
                <div className="budget-toolbar">
                  <div className="budget-toolbar-title">
                    <span>{aba==='notas-fiscais'?'Notas fiscais anexadas':'Orçamentos sem NF anexada'}</span>
                    <small>{listaOrcamentos.length} registro{listaOrcamentos.length!==1?'s':''} encontrado{listaOrcamentos.length!==1?'s':''}</small>
                  </div>
                  <label className="budget-filter budget-filter-search">
                    <span>Buscar empresa ou orçamento</span>
                    <input style={s.inp} placeholder="Digite para buscar..." value={search} onChange={e=>setSearch(e.target.value)}/>
                  </label>
                  <label className="budget-filter">
                    <span>Data inicial</span>
                    <input type="date" style={s.inp} value={fDataIni} onChange={e=>setFDataIni(e.target.value)}/>
                  </label>
                  <label className="budget-filter">
                    <span>Data final</span>
                    <input type="date" style={s.inp} value={fDataFim} onChange={e=>setFDataFim(e.target.value)}/>
                  </label>
                  <label className="budget-filter">
                    <span>Etapa</span>
                    <select style={s.inp} value={fPipe} onChange={e=>setFPipe(e.target.value)}>
                      <option value="">Todas as etapas</option>
                      {PIPELINE.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}
                    </select>
                  </label>
                  <label className="budget-filter">
                    <span>Tipo</span>
                    <select style={s.inp} value={fRec} onChange={e=>setFRec(e.target.value)}>
                      <option value="">Todos</option><option value="true">Mensais</option><option value="false">Avulsos</option>
                    </select>
                  </label>
                  <label className="budget-filter budget-filter-obra">
                    <span>Obra</span>
                    <select style={s.inp} value={fObra} onChange={e=>setFObra(e.target.value)}>
                      <option value="">Todas as obras</option>
                      {obras.map(o=><option key={o.id} value={o.id}>{o.nome}</option>)}
                    </select>
                  </label>
                  {(fDataIni||fDataFim||fPipe||fRec||fObra||search)&&(
                    <button onClick={()=>{setFDataIni('');setFDataFim('');setFPipe('');setFRec('');setFObra('');setSearch('')}} style={{...s.btnOut,padding:'8px 12px',fontSize:11,alignSelf:'end'}}>Limpar filtros</button>
                  )}
                </div>
                <div className="budget-table-wrap">
                  <table className="budget-table" style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                    <colgroup>
                      <col style={{width:'22%'}}/><col style={{width:'13%'}}/><col style={{width:'12%'}}/><col style={{width:'18%'}}/>
                      <col style={{width:'10%'}}/><col style={{width:'10%'}}/><col style={{width:'10%'}}/><col style={{width:'15%'}}/>
                    </colgroup>
                    <thead>
                      <tr style={{background:'#FAFBFA',borderBottom:'2px solid #E2E6E4'}}>
                        {th('Empresa')}{th('Obra')}{th('Nº orçamento')}{th('Etapa')}{th('Data')}{th('Total')}{th('Saldo devedor')}{th('Nota fiscal')}
                      </tr>
                    </thead>
                    <tbody>
                      {loading?<tr><td colSpan={8} style={{textAlign:'center',padding:'3rem',color:'#7D7D7D'}}>Carregando...</td></tr>
                      :listaOrcamentos.length===0?<tr><td colSpan={8} style={{textAlign:'center',padding:'3rem',color:'#7D7D7D'}}>{aba==='notas-fiscais'?'Nenhuma nota fiscal vinculada':'Nenhum orçamento pendente'}</td></tr>
                      :listaOrcamentos.map(l=>{
                        const step=PIPELINE.find(p=>p.id===l.status_processo)
                        const cor=PIPE_COLORS[l.status_processo]||'#7D7D7D'
                        const temSaldo=l.saldo_devedor&&l.saldo_devedor>0
                        const obraDoLanc=obras.find(o=>o.id===l.obra_id)
                        return (
                          <tr key={l.id} onClick={()=>openDetalhe(l.id)} style={{borderBottom:'1px solid #E2E6E4',cursor:'pointer'}}
                            onMouseEnter={e=>(e.currentTarget.style.background='#F5F7F6')} onMouseLeave={e=>(e.currentTarget.style.background='')}>
                            <td className="budget-cell budget-cell-primary" title={l.titulo}>{l.titulo}</td>
                            <td className="budget-cell budget-cell-muted" title={obraDoLanc?.nome||'Sem obra'}>{obraDoLanc?.nome||'Sem obra'}</td>
                            <td className="budget-cell budget-cell-muted">{l.numero_orcamento||'—'}</td>
                            <td className="budget-cell">{step&&<StepBadge stepId={step.id} label={step.label} color={cor}/>}</td>
                            <td className="budget-cell budget-cell-muted budget-cell-nowrap">{fmtData(l.data)}</td>
                            <td className="budget-cell budget-cell-money">{fmtR(l.valor_total)}</td>
                            <td className="budget-cell budget-cell-money">{temSaldo?fmtR(l.saldo_devedor!):<span className="budget-empty">Quitado</span>}</td>
                            <td className="budget-cell">{l.arquivo_url?<a href={l.arquivo_url} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} className="budget-nf-ok"><Icon name="receipt" size={14}/> {l.nf_numero?`NF ${l.nf_numero}`:'Anexada'}</a>:<span className="budget-nf-pending">Pendente anexar</span>}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="budget-card-footer">
                  <span>{listaOrcamentos.length} registro{listaOrcamentos.length!==1?'s':''} nesta visão</span>
                  <span>Clique numa linha para abrir os detalhes completos</span>
                </div>
              </div>
            </div>
          )}
        </main>

      </div>

      {modal&&detalhe&&(
        <div style={s.overlay} onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div style={s.modal}>
            <div style={s.mhdr}>
              <h3 style={{fontSize:15,fontWeight:700}}>{detalhe.titulo}</h3>
              <button onClick={()=>setModal(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#7D7D7D'}}><Icon name="x" size={20}/></button>
            </div>

            {role==='entregador'?(
              <div style={{padding:'1.25rem 1.5rem'}}>
                {(()=>{
                  const step=PIPELINE.find(p=>p.id===detalhe.status_processo)
                  const cor=PIPE_COLORS[detalhe.status_processo]||'#7D7D7D'
                  const itensOrc=detalhe.itens?.filter(i=>i.tipo==='orcamento')||[]
                  return (
                    <>
                      <div style={{display:'flex',gap:12,alignItems:'center',marginBottom:16}}>
                        {step&&<StepBadge stepId={step.id} label={step.label} color={cor}/>}
                        {detalhe.data_entrega_programada&&<span style={{fontSize:12,color:'#748F84',fontWeight:600,display:'inline-flex',alignItems:'center',gap:4}}><Icon name="calendar" size={13}/>{fmtData(detalhe.data_entrega_programada)}</span>}
                      </div>
                      {detalhe.entrega_tipo==='parcial'&&(
                        <div style={{background:'#EDF2EF',border:'1.5px solid #D6E2DB',borderRadius:8,padding:'10px 14px',marginBottom:16}}>
                          <p style={{fontSize:12,fontWeight:600,color:'#748F84',margin:'0 0 6px'}}>Entrega parcial</p>
                          {detalhe.entrega_itens1&&<p style={{fontSize:11,color:'#748F84',margin:'0 0 4px'}}>1ª: {detalhe.entrega_itens1}</p>}
                          {detalhe.entrega_itens2&&<p style={{fontSize:11,color:'#748F84',margin:0}}>2ª: {detalhe.entrega_itens2}</p>}
                        </div>
                      )}
                      <div style={{border:'1.5px solid #E2E6E4',borderRadius:8,overflow:'hidden'}}>
                        <div style={{background:'#FAFBFA',padding:'8px 12px',borderBottom:'1px solid #E2E6E4'}}>
                          <span style={{fontSize:10,fontWeight:700,color:'#7D7D7D',textTransform:'uppercase'}}>Itens para confirmar ({itensOrc.length})</span>
                        </div>
                        {itensOrc.length===0&&<p style={{padding:'12px',fontSize:12,color:'#7D7D7D',margin:0}}>Nenhum item cadastrado.</p>}
                        {itensOrc.map(item=>{
                          const inputId=`data-item-${item.id}`
                          return (
                            <div key={item.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 12px',borderBottom:'1px solid #E2E6E4',background:item.entregue?'#E8F0EB':'#fff'}}>
                              <div>
                                <p style={{margin:0,fontSize:13,fontWeight:600}}>{item.nome}</p>
                                <p style={{margin:'2px 0 0',fontSize:11,color:'#7D7D7D'}}>Quantidade: {item.quantidade}</p>
                                {item.entregue&&item.data_entrega&&<p style={{margin:'2px 0 0',fontSize:11,color:'#8BA59A'}}>Confirmado em {fmtData(item.data_entrega)}</p>}
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
                                <span style={{fontSize:12,color:'#8BA59A',fontWeight:700,display:'inline-flex',alignItems:'center',gap:4}}><Icon name="check" size={13}/>Recebido</span>
                              )}
                            </div>
                          )
                        })}
                      </div>

                      <div style={{border:'1.5px solid #E2E6E4',borderRadius:8,padding:'12px 14px',marginTop:16}}>
                        <p style={{fontSize:10,fontWeight:700,color:'#7D7D7D',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:10,display:'flex',alignItems:'center',gap:6}}>
                          <Icon name="receipt" size={13}/>Nota Fiscal
                        </p>
                        <input ref={nfDetRef} type="file" accept="application/pdf,image/*" style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0];if(f)handleAnexarNFComIA(f)}}/>
                        {loadingIANF?(
                          <p style={{fontSize:12,color:ACCENT_LT,fontWeight:600}}>Lendo NF com IA...</p>
                        ):(
                          <AnexoBtn url={detalhe.arquivo_url} label="nota fiscal" icon="receipt" onAnexar={()=>nfDetRef.current?.click()} onSubstituir={()=>nfDetRef.current?.click()} loading={loadingAnexo}/>
                        )}
                      </div>
                    </>
                  )
                })()}
              </div>
            ):(
              <div style={{padding:'1.25rem 1.5rem'}}>
                <PipelineStepper atual={detalhe.status_processo||'orcamento_aprovado'} onChange={handlePipelineChange}/>

                {isLocked(detalhe.status_processo)&&(
                  <div style={{background:'#F4F6F5',border:'1.5px solid #C7D5CD',borderRadius:8,padding:'10px 14px',marginBottom:16,display:'flex',alignItems:'center',gap:8}}>
                    <Icon name="lock" size={15} color="#626262"/>
                    <p style={{fontSize:12,fontWeight:600,color:'#626262',margin:0}}>Orçamento fechado — valores não podem ser alterados</p>
                  </div>
                )}

                {detalhe.status_processo==='entrega_programada'&&(
                  <div style={{background:'#EDF2EF',border:'1.5px solid #D6E2DB',borderRadius:8,padding:'10px 14px',marginBottom:16}}>
                    {detalhe.entrega_tipo==='parcial'?(
                      <>
                        <p style={{fontSize:12,fontWeight:600,color:'#748F84',margin:'0 0 4px'}}>Entrega parcial</p>
                        {detalhe.entrega_itens1&&<p style={{fontSize:11,color:'#748F84',margin:'0 0 2px'}}>1ª: {detalhe.data_entrega_programada?fmtData(detalhe.data_entrega_programada):''} — {detalhe.entrega_itens1}</p>}
                        {detalhe.entrega_itens2&&<p style={{fontSize:11,color:'#748F84',margin:0}}>2ª: {detalhe.entrega_data2?fmtData(detalhe.entrega_data2):''} — {detalhe.entrega_itens2}</p>}
                      </>
                    ):(
                      <p style={{fontSize:12,fontWeight:600,color:'#748F84',margin:0}}>
                        Entrega em {detalhe.data_entrega_programada?fmtData(detalhe.data_entrega_programada):'?'}
                        {detalhe.dias_entrega&&` (${detalhe.dias_entrega} dias ${detalhe.entrega_tipo==='uteis'?'úteis':'corridos'})`}
                      </p>
                    )}
                  </div>
                )}

                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px 24px',marginBottom:16}}>
                  {([
                    ['Empresa',detalhe.titulo],
                    ['Obra',obras.find(o=>o.id===detalhe.obra_id)?.nome||'Sem obra vinculada'],
                    ['Nº do orçamento',detalhe.numero_orcamento||'—'],
                    ['CNPJ',detalhe.cnpj?fmtCNPJ(detalhe.cnpj):'—'],
                    ['NF Nº',detalhe.nf_numero||'—'],
                    ['Lançado por',detalhe.criado_por],
                    ['Data',fmtData(detalhe.data)],
                    ...(detalhe.forma_pagamento?[['Forma de pagamento',detalhe.forma_pagamento]]:[] as any),
                    ...(detalhe.data_pagamento?[['Data do pagamento',fmtData(detalhe.data_pagamento)]]:[] as any),
                  ] as [string,string][]).map(([k,v])=>(
                    <div key={k}><p style={{fontSize:10,fontWeight:600,color:'#7D7D7D',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:2}}>{k}</p><p style={{fontSize:14,fontWeight:500}}>{v}</p></div>
                  ))}
                </div>

                <div style={{border:'1.5px solid #E2E6E4',borderRadius:8,padding:'14px 16px',marginBottom:16}}>
                  <p style={{fontSize:10,fontWeight:700,color:'#7D7D7D',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:12}}>Valores</p>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:12,marginBottom:12}}>
                    <div>
                      <p style={{fontSize:10,color:'#7D7D7D',fontWeight:600,textTransform:'uppercase',marginBottom:4}}>Valor dos Itens</p>
                      <p style={{fontSize:14,fontWeight:700,color:'#626262'}}>{fmtR(detalhe.valor_produtos||0)}</p>
                    </div>
                    <div>
                      <p style={{fontSize:10,color:'#7D7D7D',fontWeight:600,textTransform:'uppercase',marginBottom:4}}>Frete</p>
                      <p style={{fontSize:14,fontWeight:700,color:'#626262'}}>{fmtR(detalhe.valor_frete||0)}</p>
                    </div>
                    <div>
                      <p style={{fontSize:10,color:'#7D7D7D',fontWeight:600,textTransform:'uppercase',marginBottom:4}}>Desconto</p>
                      <p style={{fontSize:14,fontWeight:700,color:detalhe.tem_desconto?'#7D7D7D':'#C4CECA'}}>{detalhe.tem_desconto&&detalhe.valor_desconto?`- ${fmtR(detalhe.valor_desconto)}`:'—'}</p>
                    </div>
                    <div>
                      <p style={{fontSize:10,color:'#7D7D7D',fontWeight:600,textTransform:'uppercase',marginBottom:4}}>Total</p>
                      <p style={{fontSize:14,fontWeight:700,color:'#8BA59A'}}>{fmtR(detalhe.valor_total)}</p>
                    </div>
                    <div>
                      <p style={{fontSize:10,color:'#7D7D7D',fontWeight:600,textTransform:'uppercase',marginBottom:4}}>Saldo Devedor</p>
                      <p style={{fontSize:14,fontWeight:700,color:detalhe.saldo_devedor&&detalhe.saldo_devedor>0?'#777777':'#8BA59A'}}>
                        {detalhe.saldo_devedor&&detalhe.saldo_devedor>0?fmtR(detalhe.saldo_devedor):'Quitado'}
                      </p>
                    </div>
                  </div>

                  {detalhe.saldo_devedor&&detalhe.saldo_devedor>0?(
                    <div style={{paddingTop:12,borderTop:'1px solid #E2E6E4'}}>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                        <p style={{fontSize:12,color:'#777777',fontWeight:600,margin:0,display:'flex',alignItems:'center',gap:6}}>
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
                    <div style={{marginTop:14,paddingTop:14,borderTop:'1px solid #E2E6E4'}}>
                      <p style={{fontSize:11,fontWeight:600,color:'#7D7D7D',marginBottom:8}}>Em tratativa — aplicar desconto</p>
                      <div style={{display:'flex',gap:8,alignItems:'center'}}>
                        <input style={{...s.fi,flex:1}} value={rawDesconto} placeholder="R$ 0,00"
                          onChange={e=>{const d=e.target.value.replace(/\D/g,'');setRawDesconto(d?(parseInt(d)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'')} }/>
                        <button onClick={handleSalvarDesconto} disabled={!rawDesconto} style={{...s.btnTeal,opacity:!rawDesconto?0.6:1,whiteSpace:'nowrap' as const}}>Aplicar</button>
                        {detalhe.tem_desconto&&(
                          <button onClick={async()=>{
                            await api.atualizarLancamento(detalhe.id,{tem_desconto:false,valor_desconto:0,valor_total:detalhe.valor_original||detalhe.valor_total})
                            const d=await api.buscar(detalhe.id);setDetalhe(d);setRawDesconto('');showToast('Desconto removido!')
                          }} style={{...s.btnOut,color:'#777777',borderColor:'#E2E6E4',whiteSpace:'nowrap' as const}}>Remover</button>
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
                    <div style={{border:'1.5px solid #E2E6E4',borderRadius:8,overflow:'hidden',marginBottom:16}}>
                      <div style={{background:'#FAFBFA',padding:'8px 12px',borderBottom:'1px solid #E2E6E4',display:'flex',gap:16}}>
                        <span style={{fontSize:10,fontWeight:700,color:'#7D7D7D',textTransform:'uppercase'}}>Itens orçamento ({itensOrc.length})</span>
                        {itensNF.length>0&&<span style={{fontSize:10,fontWeight:700,color:ACCENT_LT,textTransform:'uppercase'}}>Itens NF ({itensNF.length})</span>}
                      </div>
                      <div style={{display:'grid',gridTemplateColumns:itensNF.length>0?'1fr 1fr':'1fr'}}>
                        <div style={{borderRight:itensNF.length>0?'1px solid #E2E6E4':'none'}}>
                          {itensOrc.map(item=>(
                            <div key={item.id} style={{padding:'8px 12px',borderBottom:'1px solid #E2E6E4',background:item.entregue?'#E8F0EB':'#fff'}}>
                              <p style={{margin:0,fontSize:12,fontWeight:600}}>{item.nome}</p>
                              <p style={{margin:'2px 0 0',fontSize:11,color:'#7D7D7D'}}>Qtd: {item.quantidade} {item.unidade_medida||'Un'} · {fmtR(item.valor_unitario||0)}/{item.unidade_medida||'Un'} · Total: {fmtR(item.valor_total||0)}</p>
                              {item.entregue&&<span style={{fontSize:11,color:'#8BA59A'}}>Recebido {item.data_entrega?fmtData(item.data_entrega):''}</span>}
                            </div>
                          ))}
                          <div style={{padding:'8px 12px',background:'#F6F8F7'}}>
                            <span style={{fontSize:12,fontWeight:700}}>Total: {fmtR(itensOrc.reduce((s,i)=>s+(i.valor_total||0),0))}</span>
                          </div>
                        </div>
                        {itensNF.length>0&&(
                          <div>
                            {itensNF.map(item=>(
                              <div key={item.id} style={{padding:'8px 12px',borderBottom:'1px solid #E2E6E4'}}>
                                <p style={{margin:0,fontSize:12,fontWeight:600}}>{item.nome}</p>
                                <p style={{margin:'2px 0 0',fontSize:11,color:'#7D7D7D'}}>Qtd: {item.quantidade} {item.unidade_medida||'Un'} · {fmtR(item.valor_unitario||0)}/{item.unidade_medida||'Un'} · Total: {fmtR(item.valor_total||0)}</p>
                              </div>
                            ))}
                            <div style={{padding:'8px 12px',background:'#F6F8F7'}}>
                              <span style={{fontSize:12,fontWeight:700,color:ACCENT_LT}}>Total NF: {fmtR(itensNF.reduce((s,i)=>s+(i.valor_total||0),0))}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })()}

                <div style={{border:'1.5px solid #E2E6E4',borderRadius:8,padding:'12px 14px',marginBottom:12}}>
                  <p style={{fontSize:10,fontWeight:700,color:'#7D7D7D',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:10,display:'flex',alignItems:'center',gap:6}}><Icon name="clipboard" size={13}/>Proposta</p>
                  <input ref={propostaDetRef} type="file" accept="application/pdf,image/*" style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0];if(f)handleAnexarProposta(f)}}/>
                  <AnexoBtn url={detalhe.proposta_url} label="proposta" icon="clipboard" onAnexar={()=>propostaDetRef.current?.click()} onSubstituir={()=>propostaDetRef.current?.click()} loading={loadingAnexo}/>
                </div>

                <div style={{border:'1.5px solid #E2E6E4',borderRadius:8,padding:'12px 14px',marginBottom:16,background:canAttachNF(detalhe.status_processo)?'#fff':'#F6F8F7'}}>
                  <p style={{fontSize:10,fontWeight:700,color:'#7D7D7D',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:10,display:'flex',alignItems:'center',gap:6}}><Icon name="receipt" size={13}/>Nota Fiscal</p>
                  {canAttachNF(detalhe.status_processo)?(
                    <>
                      <input ref={nfDetRef} type="file" accept="application/pdf,image/*" style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0];if(f)handleAnexarNFComIA(f)}}/>
                      {loadingIANF?<p style={{fontSize:12,color:ACCENT_LT,fontWeight:600}}>Lendo NF com IA...</p>
                      :<AnexoBtn url={detalhe.arquivo_url} label="nota fiscal" icon="receipt" onAnexar={()=>nfDetRef.current?.click()} onSubstituir={()=>nfDetRef.current?.click()} loading={loadingAnexo}/>}
                    </>
                  ):(
                    <p style={{fontSize:12,color:'#7D7D7D',margin:0}}>Disponível após <strong>Mercadoria recebida</strong></p>
                  )}
                </div>

                {detalhe.tipo_pagamento==='parcelado'&&(detalhe.parcelas||[]).length>0&&(
                  <div style={{border:'1.5px solid #E2E6E4',borderRadius:8,overflow:'hidden',marginBottom:16}}>
                    <div style={{background:'#FAFBFA',padding:'8px 12px',borderBottom:'1px solid #E2E6E4'}}>
                      <span style={{fontSize:10,fontWeight:700,color:'#7D7D7D',textTransform:'uppercase'}}>
                        Parcelas · Pago: {fmtR((detalhe.parcelas||[]).filter(p=>p.pago).reduce((s,p)=>s+p.valor,0))} de {fmtR(detalhe.valor_total)}
                      </span>
                    </div>
                    {(detalhe.parcelas||[]).map(p=>(
                      <div key={p.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 12px',borderBottom:'1px solid #E2E6E4',background:p.pago?'#E8F0EB':'#fff'}}>
                        <div>
                          <p style={{fontSize:13,fontWeight:600,margin:0}}>Parcela {p.numero} — {fmtR(p.valor)}</p>
                          <p style={{fontSize:11,color:'#7D7D7D',margin:'2px 0 0'}}>Venc.: {fmtData(p.data_vencimento)}{p.data_pagamento&&` · Pago: ${fmtData(p.data_pagamento)}`}</p>
                        </div>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          {p.pago?(
                            <><span style={{fontSize:12,color:'#8BA59A',fontWeight:600}}>Pago</span>
                            <button onClick={()=>handleEstornar(p.id!,detalhe.id)} disabled={!!acao} style={{fontSize:11,color:'#7D7D7D',background:'none',border:'none',cursor:'pointer',textDecoration:'underline'}}>Estornar</button></>
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
              <button onClick={()=>setModal(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#7D7D7D'}}><Icon name="x" size={20}/></button>
            </div>
            <div style={s.fg}>
              <div style={{gridColumn:'1/-1',padding:'14px 16px',background:'linear-gradient(135deg,#E8EFEC,#F0F4F1)',borderRadius:10,border:'1.5px dashed '+ACCENT_LT}}>
                <p style={{fontSize:11,fontWeight:700,color:ACCENT_LT,textTransform:'uppercase',letterSpacing:'.05em',marginBottom:8,display:'flex',alignItems:'center',gap:6}}><Icon name="sparkles" size={14} color={ACCENT_LT}/>Importar orçamento com IA</p>
                <p style={{fontSize:12,color:'#626262',marginBottom:10}}>Suba o PDF do orçamento: a IA extrai empresa, CNPJ, todos os itens (com quantidade, valor unitário e total) e o frete — e a proposta já fica anexada automaticamente.</p>
                <input ref={orcIARef} type="file" accept="application/pdf,image/*" style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0];if(f)handleImportarOrcamento(f)}}/>
                <button onClick={()=>orcIARef.current?.click()} disabled={loadingIA} style={{...s.btnTeal,opacity:loadingIA?0.6:1,width:'100%',justifyContent:'center'}}>
                  <Icon name="upload" size={14} color="#fff"/> {loadingIA?'Lendo orçamento...':'Selecionar PDF do orçamento'}
                </button>
                {form.proposta_url&&(
                  <p style={{fontSize:11,color:'#8BA59A',fontWeight:600,marginTop:8,display:'flex',alignItems:'center',gap:6}}>
                    <Icon name="check" size={13} color="#8BA59A"/> Proposta anexada com sucesso
                  </p>
                )}
              </div>
              <FF lb="Nome da empresa *" full>
                <FornecedorInput value={form.titulo||''} cnpj={form.cnpj||''} onChange={(nome,cnpj)=>{set('titulo',nome);set('cnpj',cnpj)}}/>
              </FF>
              <FF lb="Obra">
                <select style={s.fi} value={form.obra_id||''} onChange={e=>set('obra_id',e.target.value)}>
                  <option value="">Sem obra / despesa geral</option>
                  {obras.filter(o=>o.ativa).map(o=><option key={o.id} value={o.id}>{o.nome}</option>)}
                </select>
              </FF>
              <FF lb="Nº do orçamento">
                <input style={s.fi} value={form.numero_orcamento||''} placeholder="Ex.: ORC-001" onChange={e=>set('numero_orcamento',e.target.value)}/>
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
              <div style={{background:'#ECF2EF',borderRadius:8,padding:'12px 14px',border:'1.5px solid #E8EFEC'}}>
                <p style={{fontSize:10,fontWeight:600,color:'#7D7D7D',textTransform:'uppercase',marginBottom:4}}>Total do orçamento</p>
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
              <button onClick={()=>setModalFormaPgto(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#7D7D7D'}}><Icon name="x" size={20}/></button>
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
              <button onClick={()=>setModalPagParcial(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#7D7D7D'}}><Icon name="x" size={20}/></button>
            </div>
            <div style={{padding:'1.5rem',display:'grid',gap:14}}>
              <div style={{background:'#F4F6F5',borderRadius:8,padding:'10px 14px'}}>
                <p style={{fontSize:12,color:'#626262',margin:'0 0 4px',fontWeight:600}}>Saldo em aberto</p>
                <p style={{fontSize:20,fontWeight:700,color:'#777777',margin:0}}>{fmtR(detalhe.saldo_devedor||0)}</p>
              </div>
              <div><label style={s.lb}>Valor pago agora *</label>
                <input style={s.fi} value={pagParcialValor} placeholder="R$ 0,00" onChange={e=>{
                  const d=e.target.value.replace(/\D/g,'')
                  setPagParcialValor(d?(parseInt(d)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'')
                }}/>
                {pagParcialValor&&(()=>{
                  const v=parseFloat(pagParcialValor.replace(/\D/g,''))/100
                  const novoSaldo=Math.max(0,(detalhe.saldo_devedor||0)-v)
                  return <p style={{fontSize:11,color:novoSaldo===0?'#8BA59A':'#7D7D7D',marginTop:6,fontWeight:600}}>
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
              <button onClick={()=>setModalEntregaProg(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#7D7D7D'}}><Icon name="x" size={20}/></button>
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
                  {diasEntrega&&<p style={{fontSize:12,color:'#748F84',marginTop:8,fontWeight:600}}>
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
              <button onClick={()=>setModalNFItens(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#7D7D7D'}}><Icon name="x" size={20}/></button>
            </div>
            <div style={{padding:'1.25rem 1.5rem'}}>
              <p style={{fontSize:12,color:'#7D7D7D',marginBottom:16}}>Revise os itens extraídos pela IA antes de salvar. Se a IA não conseguir ler algum campo, preencha manualmente.</p>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:16}}>
                <div>
                  <label style={s.lb}>Número da NF</label>
                  <input style={s.fi} value={nfNumeroTemp} onChange={e=>setNfNumeroTemp(e.target.value)} placeholder="Ex: 12345"/>
                </div>
                <div>
                  <label style={s.lb}>Valor do frete</label>
                  <input style={s.fi} value={rawFreteNF} placeholder="R$ 0,00" onChange={e=>{
                    const d=e.target.value.replace(/\D/g,'')
                    setRawFreteNF(d?(parseInt(d)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'')
                  }}/>
                </div>
              </div>
              <ItensEditor itens={itensNFEditor} onChange={setItensNFEditor}/>
            </div>
            <div style={s.mfoot}>
              <button onClick={()=>setModalNFItens(false)} style={{...s.btnOut,padding:'.5rem 1rem',fontSize:13}}>Cancelar</button>
              <button onClick={handleSalvarNF} disabled={loadingAnexo} style={{...s.btnTeal,opacity:loadingAnexo?0.6:1}}>{loadingAnexo?'Salvando...':'Salvar NF e itens'}</button>
            </div>
          </div>
        </div>
      )}

      {modalObra&&(
        <div style={s.overlay} onClick={e=>e.target===e.currentTarget&&setModalObra(false)}>
          <div style={{...s.modal,width:480}}>
            <div style={s.mhdr}>
              <h3 style={{fontSize:15,fontWeight:700}}>{obraEdit?'Editar Obra':'Nova Obra'}</h3>
              <button onClick={()=>setModalObra(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#7D7D7D'}}><Icon name="x" size={20}/></button>
            </div>
            <div style={s.fg}>
              <FF lb="Nome da obra *" full><input style={s.fi} value={formObra.nome} onChange={e=>setFormObra(p=>({...p,nome:e.target.value}))} placeholder="Ex: Alojamento 01"/></FF>
              <FF lb="Endereço" full><input style={s.fi} value={formObra.endereco} onChange={e=>setFormObra(p=>({...p,endereco:e.target.value}))} placeholder="Opcional"/></FF>
            </div>
            <div style={s.mfoot}>
              <button onClick={()=>setModalObra(false)} style={{...s.btnOut,padding:'.5rem 1rem',fontSize:13}}>Cancelar</button>
              <button onClick={handleSalvarObra} disabled={saving} style={{...s.btnTeal,opacity:saving?0.6:1}}>{saving?'Salvando...':(obraEdit?'Salvar alterações':'Cadastrar')}</button>
            </div>
          </div>
        </div>
      )}

      {modalMensal&&(
        <div style={s.overlay} onClick={e=>e.target===e.currentTarget&&setModalMensal(false)}>
          <div style={{...s.modal,width:480}}>
            <div style={s.mhdr}>
              <h3 style={{fontSize:15,fontWeight:700}}>Nova Conta Mensal</h3>
              <button onClick={()=>setModalMensal(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#7D7D7D'}}><Icon name="x" size={20}/></button>
            </div>
            <div style={s.fg}>
              <FF lb="Nome da conta *" full><input style={s.fi} value={formMensal.titulo||''} onChange={e=>setM('titulo',e.target.value)} placeholder="Ex: Conta de Água"/></FF>
              <FF lb="Dia de vencimento *" full><input type="number" min={1} max={31} style={s.fi} value={formMensal.dia_vencimento||''} onChange={e=>setM('dia_vencimento',parseInt(e.target.value)||null)} placeholder="Ex: 10"/></FF>
            </div>
            <div style={s.mfoot}>
              <button onClick={()=>setModalMensal(false)} style={{...s.btnOut,padding:'.5rem 1rem',fontSize:13}}>Cancelar</button>
              <button onClick={handleSaveMensal} disabled={saving} style={{...s.btnTeal,opacity:saving?0.6:1}}>{saving?'Salvando...':'Cadastrar'}</button>
            </div>
          </div>
        </div>
      )}

      {modalFornecedor&&(
        <div style={s.overlay} onClick={e=>e.target===e.currentTarget&&setModalFornecedor(false)}>
          <div style={{...s.modal,width:440}}>
            <div style={s.mhdr}>
              <h3 style={{fontSize:15,fontWeight:700}}>{fornecedorEdit?'Editar Fornecedor':'Novo Fornecedor'}</h3>
              <button onClick={()=>setModalFornecedor(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#7D7D7D'}}><Icon name="x" size={20}/></button>
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
              <div>
                <label style={s.lb}>Fornecedor master (opcional)</label>
                <select style={s.fi} value={formFornecedor.masterId} onChange={e=>setFormFornecedor(p=>({...p,masterId:e.target.value}))}>
                  <option value="">Nenhum — este é um fornecedor independente</option>
                  {fornecedores.filter(f=>!f.fornecedor_master_id&&f.id!==fornecedorEdit?.id).map(f=>(
                    <option key={f.id} value={f.id}>{f.nome}</option>
                  ))}
                </select>
                <p style={{fontSize:11,color:'#969696',margin:'6px 0 0'}}>Escolha um master pra agrupar este fornecedor como sub-item dele (ex: BLINK IGREJA dentro de BLINK - MASTER).</p>
              </div>
            </div>
            <div style={s.mfoot}>
              <button onClick={()=>setModalFornecedor(false)} style={{...s.btnOut,padding:'.5rem 1rem',fontSize:13}}>Cancelar</button>
              <button onClick={handleSalvarFornecedor} disabled={saving} style={{...s.btnTeal,opacity:saving?0.6:1}}>{saving?'Salvando...':(fornecedorEdit?'Salvar alterações':'Cadastrar')}</button>
            </div>
          </div>
        </div>
      )}

      {modalPagarConta&&(
        <div style={s.overlay} onClick={e=>e.target===e.currentTarget&&setModalPagarConta(null)}>
          <div style={{...s.modal,width:420}}>
            <div style={s.mhdr}>
              <h3 style={{fontSize:15,fontWeight:700,display:'flex',alignItems:'center',gap:8}}><Icon name="dollar" size={16}/>{modalPagarConta.titulo}</h3>
              <button onClick={()=>setModalPagarConta(null)} style={{background:'none',border:'none',cursor:'pointer',color:'#7D7D7D'}}><Icon name="x" size={20}/></button>
            </div>
            <div style={{padding:'1.5rem',display:'grid',gap:14}}>
              <div><label style={s.lb}>Valor pago *</label>
                <input style={s.fi} value={valorPagarConta} placeholder="R$ 0,00" onChange={e=>{
                  const d=e.target.value.replace(/\D/g,'')
                  setValorPagarConta(d?(parseInt(d)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'')
                }}/>
              </div>
              <div><label style={s.lb}>Data do pagamento *</label>
                <input type="date" style={s.fi} value={dataPagarConta} onChange={e=>setDataPagarConta(e.target.value)}/>
              </div>
            </div>
            <div style={s.mfoot}>
              <button onClick={()=>setModalPagarConta(null)} style={{...s.btnOut,padding:'.5rem 1rem',fontSize:13}}>Cancelar</button>
              <button onClick={handleRegistrarPagamentoConta} disabled={saving||!valorPagarConta||!dataPagarConta} style={{...s.btnGrn,opacity:(saving||!valorPagarConta||!dataPagarConta)?0.6:1}}>
                {saving?'Salvando...':'Registrar pagamento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalHistoricoConta&&(
        <div style={s.overlay} onClick={e=>e.target===e.currentTarget&&setModalHistoricoConta(null)}>
          <div style={{...s.modal,width:500}}>
            <div style={s.mhdr}>
              <h3 style={{fontSize:15,fontWeight:700}}>{modalHistoricoConta.titulo} — Histórico</h3>
              <button onClick={()=>setModalHistoricoConta(null)} style={{background:'none',border:'none',cursor:'pointer',color:'#7D7D7D'}}><Icon name="x" size={20}/></button>
            </div>
            <div style={{padding:'1.25rem 1.5rem'}}>
              {historicoConta.length===0?(
                <p style={{fontSize:13,color:'#7D7D7D',textAlign:'center',padding:'2rem 0'}}>Nenhum pagamento registrado ainda.</p>
              ):(
                <div style={{border:'1.5px solid #E2E6E4',borderRadius:8,overflow:'hidden'}}>
                  {historicoConta.map(p=>(
                    <div key={p.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',borderBottom:'1px solid #E2E6E4'}}>
                      <div>
                        <p style={{margin:0,fontSize:14,fontWeight:700,color:'#8BA59A'}}>{fmtR(p.valor)}</p>
                        <p style={{margin:'2px 0 0',fontSize:12,color:'#7D7D7D'}}>Pago em {fmtData(p.data_pagamento)}</p>
                      </div>
                      <button onClick={()=>handleExcluirPagamentoConta(p.id)} style={{background:'none',border:'none',cursor:'pointer',color:'#777777'}}>
                        <Icon name="trash" size={15}/>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={s.mfoot}>
              <button onClick={()=>{const c=modalHistoricoConta;setModalHistoricoConta(null);abrirPagarConta(c)}} style={s.btnGrn}>
                <Icon name="dollar" size={13} color="#fff"/> Registrar novo pagamento
              </button>
              <button onClick={()=>setModalHistoricoConta(null)} style={{...s.btnOut,padding:'.5rem 1rem',fontSize:13}}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {modalFuncionario&&(
        <div style={s.overlay} onClick={e=>e.target===e.currentTarget&&setModalFuncionario(false)}>
          <div style={{...s.modal,width:480}}>
            <div style={s.mhdr}>
              <h3 style={{fontSize:15,fontWeight:700}}>{funcionarioEdit?'Editar Funcionário':'Novo Funcionário'}</h3>
              <button onClick={()=>setModalFuncionario(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#7D7D7D'}}><Icon name="x" size={20}/></button>
            </div>
            <div style={s.fg}>
              <FF lb="Nome *" full><input style={s.fi} value={formFuncionario.nome} onChange={e=>setFormFuncionario(p=>({...p,nome:e.target.value}))} placeholder="Ex: João da Silva"/></FF>
              <FF lb="Cargo"><input style={s.fi} value={formFuncionario.cargo} onChange={e=>setFormFuncionario(p=>({...p,cargo:e.target.value}))} placeholder="Ex: Pedreiro"/></FF>
              <FF lb="Salário base *">
                <input style={s.fi} value={formFuncionario.salarioBase} placeholder="R$ 0,00" onChange={e=>{
                  const d=e.target.value.replace(/\D/g,'')
                  setFormFuncionario(p=>({...p,salarioBase:d?(parseInt(d)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):''}))
                }}/>
              </FF>
              <FF lb="Obra" full>
                <select style={s.fi} value={formFuncionario.obraId} onChange={e=>setFormFuncionario(p=>({...p,obraId:e.target.value}))}>
                  <option value="">Sem obra vinculada</option>
                  {obras.filter(o=>o.ativa).map(o=><option key={o.id} value={o.id}>{o.nome}</option>)}
                </select>
              </FF>
            </div>
            <div style={s.mfoot}>
              <button onClick={()=>setModalFuncionario(false)} style={{...s.btnOut,padding:'.5rem 1rem',fontSize:13}}>Cancelar</button>
              <button onClick={handleSalvarFuncionario} disabled={saving} style={{...s.btnTeal,opacity:saving?0.6:1}}>{saving?'Salvando...':(funcionarioEdit?'Salvar alterações':'Cadastrar')}</button>
            </div>
          </div>
        </div>
      )}

      {modalPagarFuncionario&&(
        <div style={s.overlay} onClick={e=>e.target===e.currentTarget&&setModalPagarFuncionario(null)}>
          <div style={{...s.modal,width:420}}>
            <div style={s.mhdr}>
              <h3 style={{fontSize:15,fontWeight:700,display:'flex',alignItems:'center',gap:8}}><Icon name="dollar" size={16}/>{modalPagarFuncionario.nome}</h3>
              <button onClick={()=>setModalPagarFuncionario(null)} style={{background:'none',border:'none',cursor:'pointer',color:'#7D7D7D'}}><Icon name="x" size={20}/></button>
            </div>
            <div style={{padding:'1.5rem',display:'grid',gap:14}}>
              <div><label style={s.lb}>Tipo *</label>
                <select style={s.fi} value={tipoPagarFuncionario} onChange={e=>setTipoPagarFuncionario(e.target.value as any)}>
                  <option value="salario">Salário</option>
                  <option value="adiantamento">Adiantamento</option>
                  <option value="vale">Vale</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
              <div><label style={s.lb}>Valor *</label>
                <input style={s.fi} value={valorPagarFuncionario} placeholder="R$ 0,00" onChange={e=>{
                  const d=e.target.value.replace(/\D/g,'')
                  setValorPagarFuncionario(d?(parseInt(d)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'')
                }}/>
              </div>
              <div><label style={s.lb}>Data do pagamento *</label>
                <input type="date" style={s.fi} value={dataPagarFuncionario} onChange={e=>setDataPagarFuncionario(e.target.value)}/>
              </div>
            </div>
            <div style={s.mfoot}>
              <button onClick={()=>setModalPagarFuncionario(null)} style={{...s.btnOut,padding:'.5rem 1rem',fontSize:13}}>Cancelar</button>
              <button onClick={handleRegistrarPagamentoFuncionario} disabled={saving||!valorPagarFuncionario||!dataPagarFuncionario} style={{...s.btnGrn,opacity:(saving||!valorPagarFuncionario||!dataPagarFuncionario)?0.6:1}}>
                {saving?'Salvando...':'Registrar pagamento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalHistoricoFuncionario&&(
        <div style={s.overlay} onClick={e=>e.target===e.currentTarget&&setModalHistoricoFuncionario(null)}>
          <div style={{...s.modal,width:500}}>
            <div style={s.mhdr}>
              <h3 style={{fontSize:15,fontWeight:700}}>{modalHistoricoFuncionario.nome} — Histórico</h3>
              <button onClick={()=>setModalHistoricoFuncionario(null)} style={{background:'none',border:'none',cursor:'pointer',color:'#7D7D7D'}}><Icon name="x" size={20}/></button>
            </div>
            <div style={{padding:'1.25rem 1.5rem'}}>
              {historicoFuncionario.length===0?(
                <p style={{fontSize:13,color:'#7D7D7D',textAlign:'center',padding:'2rem 0'}}>Nenhum pagamento registrado ainda.</p>
              ):(
                <div style={{border:'1.5px solid #E2E6E4',borderRadius:8,overflow:'hidden'}}>
                  {historicoFuncionario.map(p=>(
                    <div key={p.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',borderBottom:'1px solid #E2E6E4'}}>
                      <div>
                        <p style={{margin:0,fontSize:14,fontWeight:700,color:'#8BA59A'}}>{fmtR(p.valor)} <span style={{fontSize:11,fontWeight:600,color:'#7D7D7D',textTransform:'capitalize'}}>· {p.tipo}</span></p>
                        <p style={{margin:'2px 0 0',fontSize:12,color:'#7D7D7D'}}>Pago em {fmtData(p.data_pagamento)}</p>
                      </div>
                      <button onClick={()=>handleExcluirPagamentoFuncionario(p.id)} style={{background:'none',border:'none',cursor:'pointer',color:'#777777'}}>
                        <Icon name="trash" size={15}/>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={s.mfoot}>
              <button onClick={()=>{const f=modalHistoricoFuncionario;setModalHistoricoFuncionario(null);abrirPagarFuncionario(f)}} style={s.btnGrn}>
                <Icon name="dollar" size={13} color="#fff"/> Registrar novo pagamento
              </button>
              <button onClick={()=>setModalHistoricoFuncionario(null)} style={{...s.btnOut,padding:'.5rem 1rem',fontSize:13}}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {toast&&(
        <div style={{position:'fixed',bottom:20,right:20,padding:'.75rem 1.25rem',borderRadius:10,fontSize:13,fontWeight:500,color:'#fff',background:toast.ok?'#8BA59A':'#777777',boxShadow:'0 4px 16px rgba(0,0,0,.2)',zIndex:100,maxWidth:400}}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
