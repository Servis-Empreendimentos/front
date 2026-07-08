'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { api, Lancamento, Parcela, ContaMensal, Fornecedor, fmtR, fmtData, fmtCNPJ, PIPELINE, PIPELINE_LOCKED_FROM, PIPELINE_NF_FROM } from '../services/api'

const USUARIOS: Record<string, { senha: string; nome: string; role: 'lancadora' | 'gestora' }> = {
  'anne':   { senha: 'anne123',   nome: 'Anne',   role: 'lancadora' },
  'mayara': { senha: 'mayara123', nome: 'Mayara', role: 'lancadora' },
  'edna':   { senha: 'edna123',   nome: 'Edna',   role: 'lancadora' },
  'erick':  { senha: 'erick123',  nome: 'Erick',  role: 'lancadora' },
  'clau':   { senha: 'clau123',   nome: 'Clau',   role: 'gestora'   },
}

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY!
const AI_KEY   = process.env.NEXT_PUBLIC_ANTHROPIC_KEY!

const s = {
  page:    { minHeight:'100vh', display:'flex', flexDirection:'column' as const, fontFamily:"'DM Sans',sans-serif", background:'#F2F6F8', color:'#1A2B38' },
  topbar:  { background:'#fff', borderBottom:'3px solid #0097A8', padding:'.7rem 1.5rem', display:'flex', alignItems:'center', gap:'1rem', position:'sticky' as const, top:0, zIndex:40, boxShadow:'0 2px 10px rgba(0,151,168,.1)' },
  main:    { flex:1, padding:'1.25rem 1.5rem' },
  row:     { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.25rem' },
  h1:      { fontSize:20, fontWeight:600, color:'#1A2B38' },
  p:       { fontSize:12, color:'#7A919E', marginTop:2 },
  btnTeal: { display:'flex', alignItems:'center', gap:8, background:'#0097A8', color:'#fff', border:'none', padding:'.5rem 1rem', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' },
  btnOut:  { display:'flex', alignItems:'center', gap:6, background:'transparent', color:'#1A2B38', border:'1.5px solid #DDE5EA', padding:'.4rem .8rem', borderRadius:7, fontSize:12, fontWeight:600, cursor:'pointer' },
  btnGrn:  { display:'flex', alignItems:'center', gap:6, background:'#27AE60', color:'#fff', border:'none', padding:'.5rem 1rem', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' },
  btnRed:  { display:'flex', alignItems:'center', gap:6, background:'transparent', color:'#E74C3C', border:'1.5px solid #FDECEA', padding:'.4rem .8rem', borderRadius:7, fontSize:12, fontWeight:600, cursor:'pointer' },
  kpi:     { background:'#fff', border:'1px solid #DDE5EA', borderRadius:10, padding:'1rem', position:'relative' as const, overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,.04)' },
  card:    { background:'#fff', border:'1px solid #DDE5EA', borderRadius:10, overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,.04)', marginBottom:'1.25rem' },
  toolbar: { display:'flex', alignItems:'center', gap:8, padding:'.8rem 1.1rem', borderBottom:'1px solid #DDE5EA', background:'#FAFCFD', flexWrap:'wrap' as const },
  badge:   { display:'inline-flex', alignItems:'center', padding:'2px 9px', borderRadius:20, fontSize:11, fontWeight:600, whiteSpace:'nowrap' as const },
  inp:     { border:'1.5px solid #DDE5EA', borderRadius:7, padding:'5px 10px', fontSize:12, fontFamily:'inherit', outline:'none', background:'#fff', color:'#1A2B38' },
  overlay: { position:'fixed' as const, inset:0, background:'rgba(0,0,0,.4)', zIndex:50, display:'flex', alignItems:'flex-start', justifyContent:'center', paddingTop:40 },
  modal:   { background:'#fff', borderRadius:14, width:740, maxWidth:'95vw', maxHeight:'92vh', overflowY:'auto' as const, boxShadow:'0 20px 60px rgba(0,0,0,.2)' },
  mhdr:    { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'1rem 1.5rem', borderBottom:'1px solid #DDE5EA', position:'sticky' as const, top:0, background:'#fff', zIndex:1 },
  mfoot:   { display:'flex', gap:8, justifyContent:'flex-end', padding:'1rem 1.5rem', borderTop:'1px solid #DDE5EA', background:'#FAFCFD', position:'sticky' as const, bottom:0 },
  fg:      { display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px 14px', padding:'1.25rem 1.5rem' },
  fi:      { width:'100%', border:'1.5px solid #DDE5EA', borderRadius:8, padding:'7px 10px', fontSize:13, fontFamily:'inherit', color:'#1A2B38', outline:'none', boxSizing:'border-box' as const },
  lb:      { display:'block', fontSize:10, fontWeight:600, color:'#7A919E', textTransform:'uppercase' as const, letterSpacing:'.05em', marginBottom:4 },
  footer:  { background:'#fff', borderTop:'1px solid #DDE5EA', padding:'.65rem 1.5rem', display:'flex', justifyContent:'space-between', alignItems:'center' },
}

const ST: Record<string, {bg:string;color:string}> = {
  pendente:  {bg:'#FEF5EB',color:'#E67E22'},
  entregue:  {bg:'#EAF7EE',color:'#27AE60'},
  avista:    {bg:'#EAF3FD',color:'#2980B9'},
  parcelado: {bg:'#F4EEF9',color:'#8E44AD'},
}

const PIPE_COLORS: Record<string, string> = {
  orcamento_aprovado:  '#7A919E',
  em_tratativa:        '#E67E22',
  orcamento_fechado:   '#2980B9',
  pagamento_realizado: '#27AE60',
  entrega_programada:  '#8E44AD',
  mercadoria_recebida: '#0097A8',
  nf_recebida:         '#1A2B38',
}

function pipeIdx(status: string) { return PIPELINE.findIndex(p => p.id === status) }
function isLocked(status: string) { return pipeIdx(status) >= pipeIdx(PIPELINE_LOCKED_FROM) }
function canAttachNF(status: string) { return pipeIdx(status) >= pipeIdx(PIPELINE_NF_FROM) }

async function sbPatch(table: string, query: string, body: any) {
  await fetch(`${SUPA_URL}/rest/v1/${table}${query}`, {
    method: 'PATCH',
    headers: { apikey:SUPA_KEY, Authorization:`Bearer ${SUPA_KEY}`, 'Content-Type':'application/json', Prefer:'return=minimal' },
    body: JSON.stringify(body),
  })
}

async function lerNFcomIA(file: File): Promise<any> {
  const base64 = await new Promise<string>((res, rej) => {
    const r = new FileReader()
    r.onload = () => res((r.result as string).split(',')[1])
    r.onerror = () => rej(new Error('Erro ao ler arquivo'))
    r.readAsDataURL(file)
  })
  const isPDF = file.type === 'application/pdf'
  const mediaType = isPDF ? 'application/pdf' : file.type === 'image/png' ? 'image/png' : 'image/jpeg'
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key':AI_KEY, 'anthropic-version':'2023-06-01', 'content-type':'application/json', 'anthropic-dangerous-direct-browser-access':'true' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 1000,
      messages: [{ role:'user', content: [
        { type: isPDF?'document':'image', source:{ type:'base64', media_type:mediaType, data:base64 } },
        { type:'text', text:`Extraia os dados desta nota fiscal e retorne APENAS um JSON válido, sem texto adicional, sem markdown:
{"titulo":"nome do fornecedor ou descrição do serviço","valor_total":0.00,"data":"YYYY-MM-DD","cnpj":"somente números"}
Se não encontrar algum campo, deixe em branco ou zero.` }
      ]}]
    })
  })
  const data = await response.json()
  const text = data.content?.[0]?.text || ''
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('Não foi possível extrair os dados')
  return JSON.parse(match[0])
}

function KPI({l,v,sv,c}:{l:string;v:string|number;sv?:string;c:string}) {
  return (
    <div style={s.kpi}>
      <div style={{position:'absolute',top:0,left:0,right:0,height:3,borderRadius:'10px 10px 0 0',background:c}}/>
      <p style={{fontSize:10,fontWeight:600,color:'#7A919E',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:6}}>{l}</p>
      <p style={{fontSize:22,fontWeight:700,color:'#1A2B38',lineHeight:1.1}}>{v}</p>
      {sv&&<p style={{fontSize:11,color:'#7A919E',marginTop:4}}>{sv}</p>}
    </div>
  )
}

function Badge({label,bg,color}:{label:string;bg:string;color:string}) {
  return <span style={{...s.badge,background:bg,color}}>{label}</span>
}

function FF({lb:label,children,full}:{lb:string;children:React.ReactNode;full?:boolean}) {
  return <div style={full?{gridColumn:'1/-1'}:{}}><label style={s.lb}>{label}</label>{children}</div>
}

function FornecedorInput({ value, cnpj, onChange }: {
  value: string
  cnpj: string
  onChange: (nome: string, cnpj: string) => void
}) {
  const [sugestoes, setSugestoes] = useState<Fornecedor[]>([])
  const [aberto, setAberto] = useState(false)
  const timer = useRef<any>(null)

  const buscar = (termo: string) => {
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      const res = await api.buscarFornecedores(termo)
      setSugestoes(res)
      setAberto(res.length > 0)
    }, 300)
  }

  return (
    <div style={{position:'relative' as const}}>
      <input style={{...s.fi}} value={value} placeholder="Digite o nome da empresa..."
        onChange={e=>{ onChange(e.target.value, cnpj); buscar(e.target.value) }}
        onBlur={()=>setTimeout(()=>setAberto(false),200)}/>
      {aberto&&(
        <div style={{position:'absolute',top:'100%',left:0,right:0,background:'#fff',border:'1.5px solid #DDE5EA',borderRadius:8,zIndex:100,boxShadow:'0 4px 16px rgba(0,0,0,.1)',maxHeight:200,overflowY:'auto'}}>
          {sugestoes.map(f=>(
            <div key={f.id} onClick={()=>{ onChange(f.nome, f.cnpj||''); setAberto(false) }}
              style={{padding:'8px 12px',cursor:'pointer',borderBottom:'1px solid #F2F6F8'}}
              onMouseEnter={e=>(e.currentTarget.style.background='#F0F7F9')}
              onMouseLeave={e=>(e.currentTarget.style.background='')}>
              <p style={{margin:0,fontSize:13,fontWeight:600}}>{f.nome}</p>
              {f.cnpj&&<p style={{margin:0,fontSize:11,color:'#7A919E'}}>{fmtCNPJ(f.cnpj)}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PipelineStepper({ atual, onChange }: { atual: string; onChange: (id: string) => void }) {
  const idx = PIPELINE.findIndex(p => p.id === atual)
  return (
    <div style={{ overflowX:'auto', paddingBottom:4 }}>
      <div style={{ display:'flex', alignItems:'center', minWidth:600, marginBottom:16 }}>
        {PIPELINE.map((step, i) => {
          const done    = i < idx
          const current = i === idx
          const cor     = PIPE_COLORS[step.id]
          return (
            <div key={step.id} style={{ display:'flex', alignItems:'center', flex:1 }}>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, flex:'0 0 auto' }}>
                <button onClick={() => onChange(step.id)}
                  style={{
                    width:36, height:36, borderRadius:'50%', border:'none', cursor:'pointer',
                    background: done ? '#27AE60' : current ? cor : '#DDE5EA',
                    color: done||current ? '#fff' : '#7A919E',
                    fontSize:16, display:'flex', alignItems:'center', justifyContent:'center',
                    boxShadow: current ? `0 0 0 3px ${cor}33` : 'none',
                    transition:'all .2s',
                  }}>
                  {done ? '✓' : step.icon}
                </button>
                <span style={{ fontSize:9, fontWeight:600, color: current ? cor : done ? '#27AE60' : '#7A919E', textAlign:'center', maxWidth:70, lineHeight:1.2 }}>
                  {step.label}
                </span>
              </div>
              {i < PIPELINE.length-1 && (
                <div style={{ flex:1, height:2, background: i < idx ? '#27AE60' : '#DDE5EA', margin:'0 4px', marginBottom:20 }}/>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ParcelasEditor({parcelas,onChange}:{parcelas:Parcela[];onChange:(p:Parcela[])=>void}) {
  const add = () => onChange([...parcelas,{numero:parcelas.length+1,valor:0,data_vencimento:'',pago:false}])
  const rem = (i:number) => onChange(parcelas.filter((_,idx)=>idx!==i).map((p,idx)=>({...p,numero:idx+1})))
  const upd = (i:number,k:keyof Parcela,v:any) => onChange(parcelas.map((p,idx)=>idx===i?{...p,[k]:v}:p))
  return (
    <div style={{gridColumn:'1/-1',border:'1.5px solid #DDE5EA',borderRadius:8,overflow:'hidden'}}>
      <div style={{background:'#FAFCFD',padding:'8px 12px',borderBottom:'1px solid #DDE5EA',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <span style={{fontSize:10,fontWeight:700,color:'#7A919E',textTransform:'uppercase',letterSpacing:'.05em'}}>Parcelas / Medições ({parcelas.length})</span>
        <button onClick={add} type="button" style={{...s.btnTeal,padding:'3px 10px',fontSize:11}}>+ Parcela</button>
      </div>
      {parcelas.length===0&&<p style={{padding:'12px',fontSize:12,color:'#7A919E',margin:0}}>Clique em + Parcela para adicionar.</p>}
      {parcelas.map((p,i)=>(
        <div key={i} style={{display:'grid',gridTemplateColumns:'36px 1fr 1fr 80px 1fr 24px',gap:8,padding:'8px 12px',borderBottom:'1px solid #DDE5EA',alignItems:'center',background:p.pago?'#F0FFF4':'#fff'}}>
          <span style={{fontSize:11,fontWeight:700,color:'#7A919E'}}>#{p.numero}</span>
          <div><label style={{...s.lb,marginBottom:2}}>Valor</label>
            <input type="number" step="0.01" style={{...s.fi,fontSize:12}} value={p.valor||''} placeholder="0,00" onChange={e=>upd(i,'valor',parseFloat(e.target.value)||0)}/>
          </div>
          <div><label style={{...s.lb,marginBottom:2}}>Vencimento</label>
            <input type="date" style={{...s.fi,fontSize:12}} value={p.data_vencimento||''} onChange={e=>upd(i,'data_vencimento',e.target.value)}/>
          </div>
          <div style={{textAlign:'center'}}><label style={{...s.lb,marginBottom:2}}>Pago?</label>
            <input type="checkbox" checked={p.pago||false} onChange={e=>{upd(i,'pago',e.target.checked);if(e.target.checked)upd(i,'data_pagamento',new Date().toISOString().slice(0,10))}} style={{width:16,height:16,cursor:'pointer'}}/>
          </div>
          <div><label style={{...s.lb,marginBottom:2}}>{p.pago?'Pago em':'Situação'}</label>
            {p.pago?<input style={{...s.fi,fontSize:12,background:'#F0FFF4'}} value={p.data_pagamento?fmtData(p.data_pagamento):''} readOnly/>
                   :<span style={{fontSize:12,color:'#E67E22',fontWeight:600}}>Pendente</span>}
          </div>
          <button onClick={()=>rem(i)} type="button" style={{background:'none',border:'none',cursor:'pointer',color:'#E74C3C',fontSize:18,padding:0}}>×</button>
        </div>
      ))}
    </div>
  )
}

function LoginScreen({onLogin}:{onLogin:(nome:string,role:'lancadora'|'gestora')=>void}) {
  const [login,setLogin]=useState(''); const [senha,setSenha]=useState(''); const [erro,setErro]=useState('')
  const handleLogin=()=>{
    const u=USUARIOS[login.trim().toLowerCase()]
    if(u&&u.senha===senha) onLogin(u.nome,u.role)
    else {setErro('Usuário ou senha incorretos.');setTimeout(()=>setErro(''),3000)}
  }
  return (
    <div style={{minHeight:'100vh',background:'#F2F6F8',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'DM Sans',sans-serif"}}>
      <div style={{background:'#fff',borderRadius:16,padding:'2.5rem 2rem',width:360,boxShadow:'0 8px 40px rgba(0,151,168,.15)',display:'flex',flexDirection:'column',alignItems:'center',gap:20}}>
        <div style={{textAlign:'center'}}>
          <img src="/logo.jpg" alt="Servis" style={{height:90,objectFit:'contain',marginBottom:12}} onError={e=>(e.currentTarget.style.display='none')}/>
          <h2 style={{fontSize:18,fontWeight:700,color:'#1A2B38',margin:0}}>Servis - Conciliação Financeira</h2>
          <p style={{fontSize:12,color:'#7A919E',marginTop:4}}>Acesso interno</p>
        </div>
        <div style={{width:'100%',display:'flex',flexDirection:'column',gap:12}}>
          <div><label style={s.lb}>Usuário</label><input style={{...s.fi,fontSize:14}} placeholder="Digite seu usuário" value={login} onChange={e=>setLogin(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleLogin()}/></div>
          <div><label style={s.lb}>Senha</label><input type="password" style={{...s.fi,fontSize:14}} placeholder="Digite sua senha" value={senha} onChange={e=>setSenha(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleLogin()}/></div>
          {erro&&<p style={{fontSize:12,color:'#E74C3C',textAlign:'center',margin:0}}>{erro}</p>}
          <button onClick={handleLogin} style={{...s.btnTeal,justifyContent:'center',width:'100%',padding:'.75rem',fontSize:14,borderRadius:9,marginTop:4}}>Entrar</button>
        </div>
      </div>
    </div>
  )
}

export default function Home() {
  const [logado,setLogado]=useState(false); const [user,setUser]=useState(''); const [role,setRole]=useState<'lancadora'|'gestora'>('lancadora')
  const [aba,setAba]=useState<'lancamentos'|'mensais'>('lancamentos')
  const [data,setData]=useState<Lancamento[]>([]); const [cats,setCats]=useState<any[]>([])
  const [contasMensais,setContasMensais]=useState<ContaMensal[]>([])
  const [loading,setLoading]=useState(true)
  const [fStatus,setFStatus]=useState(''); const [fTipo,setFTipo]=useState(''); const [fCat,setFCat]=useState(''); const [fRec,setFRec]=useState(''); const [fPipe,setFPipe]=useState('')
  const [search,setSearch]=useState(''); const [modal,setModal]=useState(false); const [detalhe,setDetalhe]=useState<Lancamento|null>(null)
  const [modalMensal,setModalMensal]=useState(false); const [formMensal,setFormMensal]=useState<any>({})
  const [modalGerar,setModalGerar]=useState<ContaMensal|null>(null); const [valorGerar,setValorGerar]=useState('')
  const [saving,setSaving]=useState(false); const [acao,setAcao]=useState(''); const [toast,setToast]=useState<{msg:string;ok:boolean}|null>(null)
  const [form,setForm]=useState<any>({}); const [parcelas,setParcelas]=useState<Parcela[]>([])
  const [arquivo,setArquivo]=useState<File|null>(null); const [rawValor,setRawValor]=useState(''); const [loadingIA,setLoadingIA]=useState(false)
  const [modalEntregaProg,setModalEntregaProg]=useState(false); const [diasEntrega,setDiasEntrega]=useState('')
  const [rawDesconto,setRawDesconto]=useState('')
  const nfRef=useRef<HTMLInputElement>(null)
  const nfDetRef=useRef<HTMLInputElement>(null)

  const showToast=(msg:string,ok=true)=>{setToast({msg,ok});setTimeout(()=>setToast(null),3000)}
  const set=(k:string,v:any)=>setForm((p:any)=>({...p,[k]:v}))
  const setM=(k:string,v:any)=>setFormMensal((p:any)=>({...p,[k]:v}))

  const load=useCallback(async()=>{
    setLoading(true)
    try {
      const [lista,categorias,mensais]=await Promise.all([
        api.listar({status_entrega:fStatus,tipo_pagamento:fTipo,categoria_id:fCat,recorrente:fRec,status_processo:fPipe}),
        api.categorias(),
        api.listarContasMensais(),
      ])
      setData(lista);setCats(categorias);setContasMensais(mensais)
    } catch {showToast('Erro ao carregar dados',false)}
    finally {setLoading(false)}
  },[fStatus,fTipo,fCat,fRec,fPipe])

  useEffect(()=>{if(logado)load()},[load,logado])

  const openNovo=()=>{
    setForm({
      tipo_pagamento:'avista',
      data:new Date().toISOString().slice(0,10),
      pago:false,
      recorrente:false,
      status_processo:'orcamento_aprovado',
      pago_por:'Servis Empreendimentos',
      tem_desconto:false,
      valor_desconto:0,
      titulo:'',
      cnpj:'',
    })
    setParcelas([]);setArquivo(null);setRawValor('');setRawDesconto('');setDetalhe(null);setModal(true)
  }

  const openDetalhe=async(id:string)=>{
    const d=await api.buscar(id);setDetalhe(d);setParcelas(d.parcelas||[]);setModal(true)
  }

  const handleImportarNF=async(file:File)=>{
    setLoadingIA(true);setArquivo(file)
    try {
      const dados=await lerNFcomIA(file)
      if(dados.titulo) set('titulo',dados.titulo)
      if(dados.cnpj) set('cnpj',dados.cnpj)
      if(dados.data) set('data',dados.data)
      if(dados.valor_total&&dados.valor_total>0) {
        set('valor_total',dados.valor_total)
        set('valor_original',dados.valor_total)
        setRawValor((dados.valor_total as number).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}))
      }
      showToast('✅ Dados extraídos com sucesso!')
    } catch {showToast('⚠️ Não foi possível extrair. Preencha manualmente.',false)}
    finally {setLoadingIA(false)}
  }

  const handleAnexarNF=async(file:File)=>{
    if(!detalhe) return
    setLoadingIA(true)
    try {
      const url=await api.uploadPDF(file)
      await sbPatch('lancamentos',`?id=eq.${detalhe.id}`,{arquivo_url:url})
      const d=await api.buscar(detalhe.id);setDetalhe(d);showToast('Nota fiscal anexada!')
    } catch {showToast('Erro ao enviar',false)}
    finally {setLoadingIA(false)}
  }

  const handleSave=async()=>{
    if(!form.titulo||!form.valor_total||!form.data||!form.categoria_id) return showToast('Preencha todos os campos obrigatórios',false)
    setSaving(true)
    try {
      let arquivo_url=undefined
      if(arquivo) arquivo_url=await api.uploadPDF(arquivo)
      await api.criar({ ...form, valor_original:form.valor_total, criado_por:user, arquivo_url, parcelas })
      // salva fornecedor
      if(form.titulo) await api.salvarFornecedor(form.titulo, form.cnpj||undefined)
      setModal(false);showToast('Lançamento salvo!');load()
    } catch {showToast('Erro ao salvar',false)}
    finally {setSaving(false)}
  }

  const handleSalvarDesconto=async()=>{
    if(!detalhe) return
    const valor_desconto=parseFloat(rawDesconto.replace(/\D/g,''))/100||0
    const valor_total=(detalhe.valor_original||detalhe.valor_total)-valor_desconto
    await sbPatch('lancamentos',`?id=eq.${detalhe.id}`,{tem_desconto:valor_desconto>0,valor_desconto,valor_total})
    const d=await api.buscar(detalhe.id);setDetalhe(d);setRawDesconto('');showToast('Desconto aplicado!')
  }

  const handleSaveMensal=async()=>{
    if(!formMensal.titulo||!formMensal.categoria_id||!formMensal.pago_por||!formMensal.dia_vencimento) return showToast('Preencha todos os campos',false)
    setSaving(true)
    try {
      await api.criarContaMensal({...formMensal,ativo:true})
      setModalMensal(false);setFormMensal({});showToast('Conta mensal cadastrada!');load()
    } catch {showToast('Erro ao salvar',false)}
    finally {setSaving(false)}
  }

  const handleGerarLancamento=async()=>{
    if(!modalGerar||!valorGerar) return showToast('Informe o valor do mês',false)
    setSaving(true)
    try {
      const lanc=await api.gerarLancamentoMensal(modalGerar,user)
      const valor=parseFloat(valorGerar.replace(/\D/g,''))/100
      await sbPatch('lancamentos',`?id=eq.${lanc.id}`,{valor_total:valor,valor_original:valor})
      setModalGerar(null);setValorGerar('');showToast('Lançamento gerado!');setAba('lancamentos');load()
    } catch {showToast('Erro ao gerar',false)}
    finally {setSaving(false)}
  }

  const handlePipelineChange=async(novoStatus:string)=>{
    if(!detalhe) return
    if(novoStatus==='entrega_programada'){setModalEntregaProg(true);return}
    await sbPatch('lancamentos',`?id=eq.${detalhe.id}`,{status_processo:novoStatus})
    const d=await api.buscar(detalhe.id);setDetalhe(d)
    const step=PIPELINE.find(p=>p.id===novoStatus)
    showToast(`${step?.icon} ${step?.label}`)
    load()
  }

  const handleConfirmarEntregaProg=async()=>{
    if(!detalhe||!diasEntrega) return
    const hoje=new Date(); hoje.setDate(hoje.getDate()+parseInt(diasEntrega))
    const data_entrega_programada=hoje.toISOString().slice(0,10)
    await sbPatch('lancamentos',`?id=eq.${detalhe.id}`,{status_processo:'entrega_programada',dias_entrega:parseInt(diasEntrega),data_entrega_programada})
    const d=await api.buscar(detalhe.id);setDetalhe(d)
    setModalEntregaProg(false);setDiasEntrega('')
    showToast(`📅 Entrega programada para ${fmtData(data_entrega_programada)}`)
    load()
  }

  const handlePagar=async(parcelaId:string,lancId:string)=>{
    setAcao(parcelaId)
    try {await api.marcarPago(parcelaId);showToast('Pago!');const d=await api.buscar(lancId);setDetalhe(d);setParcelas(d.parcelas||[])}
    catch {showToast('Erro',false)}
    finally {setAcao('')}
  }

  const handleEstornar=async(parcelaId:string,lancId:string)=>{
    setAcao(parcelaId)
    try {await api.estornar(parcelaId);showToast('Estornado!');const d=await api.buscar(lancId);setDetalhe(d);setParcelas(d.parcelas||[])}
    catch {showToast('Erro',false)}
    finally {setAcao('')}
  }

  const handleExcluir=async(id:string)=>{
    if(!confirm('Tem certeza que deseja excluir este lançamento?')) return
    await fetch(`${SUPA_URL}/rest/v1/lancamentos?id=eq.${id}`,{method:'DELETE',headers:{apikey:SUPA_KEY,Authorization:`Bearer ${SUPA_KEY}`}})
    setModal(false);showToast('Lançamento excluído!');load()
  }

  const togglePagoDetalhe=async(pago:boolean)=>{
    if(!detalhe) return
    await sbPatch('lancamentos',`?id=eq.${detalhe.id}`,{pago,data_pagamento:pago?new Date().toISOString().slice(0,10):null})
    const d=await api.buscar(detalhe.id);setDetalhe(d);showToast(pago?'Marcado como pago!':'Pagamento removido!')
  }

  const atualizarDataPagamento=async(data_pagamento:string)=>{
    if(!detalhe) return
    await sbPatch('lancamentos',`?id=eq.${detalhe.id}`,{data_pagamento})
    const d=await api.buscar(detalhe.id);setDetalhe(d);showToast('Data atualizada!')
  }

  if(!logado) return <LoginScreen onLogin={(nome,r)=>{setUser(nome);setRole(r);setLogado(true)}}/>

  const filtered=data.filter(l=>{
    if(!search) return true
    const q=search.toLowerCase()
    return [l.titulo,l.pago_por,l.criado_por,l.categoria_nome,l.cnpj].some(f=>f?.toLowerCase().includes(q))
  })

  const totalValor=data.reduce((s,l)=>s+l.valor_total,0)
  const totalPagos=data.filter(l=>l.pago).length
  const totalPendente=data.filter(l=>l.status_entrega==='pendente').length
  const th=(label:string)=><th style={{padding:'8px 11px',textAlign:'left',fontSize:10,fontWeight:700,color:'#7A919E',textTransform:'uppercase',whiteSpace:'nowrap'}}>{label}</th>

  return (
    <div style={s.page}>
      <header style={s.topbar}>
        <img src="/logo.jpg" alt="Servis" style={{height:40,objectFit:'contain'}} onError={e=>(e.currentTarget.style.display='none')}/>
        <span style={{fontWeight:700,fontSize:15,color:'#0097A8'}}>Servis - Conciliação Financeira</span>
        <nav style={{display:'flex',gap:4,marginLeft:16}}>
          {(['lancamentos','mensais'] as const).map(a=>(
            <button key={a} onClick={()=>setAba(a)} style={{padding:'.4rem .9rem',borderRadius:7,border:'none',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit',background:aba===a?'#0097A8':'transparent',color:aba===a?'#fff':'#7A919E'}}>
              {a==='lancamentos'?'Lançamentos':'🔄 Contas Mensais'}
            </button>
          ))}
        </nav>
        <div style={{flex:1}}/>
        <div style={{display:'flex',alignItems:'center',gap:8,fontSize:12,color:'#7A919E'}}>
          <span>👤 {user}</span>
          <span style={{...s.badge,background:role==='gestora'?'#EAF7EE':'#E0F5F7',color:role==='gestora'?'#27AE60':'#0097A8'}}>{role==='gestora'?'Gestora':'Lançadora'}</span>
          <button onClick={()=>setLogado(false)} style={{...s.btnOut,padding:'3px 10px',fontSize:11,color:'#E74C3C',borderColor:'#FDECEA'}}>Sair</button>
        </div>
      </header>

      <main style={s.main}>

        {aba==='mensais'&&(
          <div>
            <div style={s.row}>
              <div><h1 style={s.h1}>Contas Mensais</h1><p style={s.p}>Água, luz, internet e outros fixos</p></div>
              <button onClick={()=>setModalMensal(true)} style={s.btnTeal}>＋ Nova conta mensal</button>
            </div>
            <div style={s.card}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead>
                  <tr style={{background:'#FAFCFD',borderBottom:'2px solid #DDE5EA'}}>
                    {th('Conta')}{th('Categoria')}{th('Pago por')}{th('Dia venc.')}{th('Status')}{th('Ações')}
                  </tr>
                </thead>
                <tbody>
                  {contasMensais.length===0&&<tr><td colSpan={6} style={{textAlign:'center',padding:'3rem',color:'#7A919E'}}>Nenhuma conta mensal cadastrada</td></tr>}
                  {contasMensais.map(c=>(
                    <tr key={c.id} style={{borderBottom:'1px solid #DDE5EA'}}>
                      <td style={{padding:'10px 11px',fontWeight:600}}>{c.titulo}</td>
                      <td style={{padding:'10px 11px',color:'#7A919E',fontSize:11}}>{c.categoria_nome||'—'}</td>
                      <td style={{padding:'10px 11px',color:'#7A919E'}}>{c.pago_por}</td>
                      <td style={{padding:'10px 11px',textAlign:'center'}}><span style={{background:'#E0F5F7',color:'#0097A8',borderRadius:6,padding:'2px 8px',fontWeight:600}}>dia {c.dia_vencimento}</span></td>
                      <td style={{padding:'10px 11px'}}><Badge label={c.ativo?'Ativa':'Inativa'} bg={c.ativo?'#EAF7EE':'#EEF0F3'} color={c.ativo?'#27AE60':'#6B8090'}/></td>
                      <td style={{padding:'10px 11px'}}>
                        <div style={{display:'flex',gap:8}}>
                          {c.ativo&&<button onClick={()=>{setModalGerar(c);setValorGerar('')}} style={{...s.btnTeal,padding:'4px 10px',fontSize:11}}>＋ Lançar este mês</button>}
                          <button onClick={()=>api.toggleContaMensal(c.id,!c.ativo).then(load)} style={{...s.btnOut,padding:'4px 10px',fontSize:11,color:c.ativo?'#E74C3C':'#27AE60'}}>{c.ativo?'Desativar':'Ativar'}</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {aba==='lancamentos'&&(
          <div>
            <div style={s.row}>
              <div><h1 style={s.h1}>Lançamentos — Notas Fiscais</h1><p style={s.p}>Controle de pagamentos e entregas · Financeiro</p></div>
              <button onClick={openNovo} style={s.btnTeal}>＋ Novo lançamento</button>
            </div>

            <div style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:10,marginBottom:'1.25rem'}}>
              <KPI l="Total de lançamentos" v={data.length} sv={`${filtered.length} exibidos`} c="#0097A8"/>
              <KPI l="Valor total" v={fmtR(totalValor)} sv="soma dos registros" c="#E67E22"/>
              <KPI l="Pagos" v={totalPagos} sv="lançamentos quitados" c="#27AE60"/>
              <KPI l="Entregas pendentes" v={totalPendente} sv="aguardando confirmação" c="#E74C3C"/>
            </div>

            <div style={s.card}>
              <div style={s.toolbar}>
                <span style={{fontSize:10,fontWeight:700,color:'#7A919E',textTransform:'uppercase',letterSpacing:'.1em',flex:1}}>Todos os lançamentos</span>
                <input style={{...s.inp,width:160}} placeholder="Buscar..." value={search} onChange={e=>setSearch(e.target.value)}/>
                <select style={s.inp} value={fPipe} onChange={e=>setFPipe(e.target.value)}>
                  <option value="">Todas as etapas</option>
                  {PIPELINE.map(p=><option key={p.id} value={p.id}>{p.icon} {p.label}</option>)}
                </select>
                <select style={s.inp} value={fRec} onChange={e=>setFRec(e.target.value)}>
                  <option value="">Todos</option><option value="true">Mensais</option><option value="false">Avulsos</option>
                </select>
                <select style={s.inp} value={fTipo} onChange={e=>setFTipo(e.target.value)}>
                  <option value="">Todos os tipos</option><option value="avista">À vista</option><option value="parcelado">Parcelado</option>
                </select>
                <select style={s.inp} value={fCat} onChange={e=>setFCat(e.target.value)}>
                  <option value="">Todas as categorias</option>
                  {cats.map((c:any)=><option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div style={{overflowX:'auto',maxHeight:440,overflowY:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                  <thead style={{position:'sticky',top:0,zIndex:2}}>
                    <tr style={{background:'#FAFCFD',borderBottom:'2px solid #DDE5EA'}}>
                      {th('Empresa')}{th('CNPJ')}{th('Etapa')}{th('Categoria')}{th('Data')}{th('Orçamento')}{th('Desconto')}{th('Valor Final')}{th('Pago')}{th('NF')}{th('Lançado por')}
                    </tr>
                  </thead>
                  <tbody>
                    {loading?<tr><td colSpan={11} style={{textAlign:'center',padding:'3rem',color:'#7A919E'}}>Carregando...</td></tr>
                    :filtered.length===0?<tr><td colSpan={11} style={{textAlign:'center',padding:'3rem',color:'#7A919E'}}>Nenhum lançamento encontrado</td></tr>
                    :filtered.map(l=>{
                      const step=PIPELINE.find(p=>p.id===l.status_processo)
                      const cor=PIPE_COLORS[l.status_processo]||'#7A919E'
                      return (
                        <tr key={l.id} onClick={()=>openDetalhe(l.id)} style={{borderBottom:'1px solid #DDE5EA',cursor:'pointer'}}
                          onMouseEnter={e=>(e.currentTarget.style.background='#F0F7F9')} onMouseLeave={e=>(e.currentTarget.style.background='')}>
                          <td style={{padding:'8px 11px',fontWeight:500,maxWidth:140,overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis'}}>{l.titulo}</td>
                          <td style={{padding:'8px 11px',color:'#7A919E',fontSize:11,whiteSpace:'nowrap'}}>{l.cnpj?fmtCNPJ(l.cnpj):'—'}</td>
                          <td style={{padding:'8px 11px'}}><span style={{...s.badge,background:`${cor}18`,color:cor}}>{step?.icon} {step?.label||l.status_processo}</span></td>
                          <td style={{padding:'8px 11px',color:'#7A919E',fontSize:11}}>{l.categoria_nome||'—'}</td>
                          <td style={{padding:'8px 11px',color:'#7A919E',whiteSpace:'nowrap'}}>{fmtData(l.data)}</td>
                          <td style={{padding:'8px 11px',color:'#7A919E'}}>{l.valor_original?fmtR(l.valor_original):'—'}</td>
                          <td style={{padding:'8px 11px',textAlign:'center'}}>
                            {l.tem_desconto&&l.valor_desconto?<span style={{color:'#E67E22',fontWeight:600,fontSize:11}}>-{fmtR(l.valor_desconto)}</span>:<span style={{color:'#DDE5EA'}}>—</span>}
                          </td>
                          <td style={{padding:'8px 11px',fontWeight:700}}>{fmtR(l.valor_total)}</td>
                          <td style={{padding:'8px 11px',textAlign:'center'}}>
                            {l.pago?<span style={{color:'#27AE60',fontWeight:700}}>✓</span>:<span style={{color:'#E74C3C',fontWeight:700}}>✗</span>}
                          </td>
                          <td style={{padding:'8px 11px',textAlign:'center'}}>
                            {l.arquivo_url?<a href={l.arquivo_url} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} style={{fontSize:16}}>📄</a>:<span style={{color:'#DDE5EA'}}>—</span>}
                          </td>
                          <td style={{padding:'8px 11px',color:'#7A919E',fontSize:11}}>{l.criado_por}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{padding:'.5rem 1.1rem',borderTop:'1px solid #DDE5EA',fontSize:11,color:'#7A919E',background:'#FAFCFD'}}>
                {filtered.length} lançamento{filtered.length!==1?'s':''} exibido{filtered.length!==1?'s':''} de {data.length} total
              </div>
            </div>
          </div>
        )}
      </main>

      <footer style={s.footer}>
        <img src="/logo.jpg" alt="Servis" style={{height:28,objectFit:'contain'}} onError={e=>(e.currentTarget.style.display='none')}/>
        <p style={{fontSize:11,color:'#7A919E'}}>Servis Empreendimentos · Conciliação Financeira</p>
        <p style={{fontSize:11,color:'#7A919E'}}>© 2025</p>
      </footer>

      {modal&&(
        <div style={s.overlay} onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div style={s.modal}>
            <div style={s.mhdr}>
              <h3 style={{fontSize:15,fontWeight:700}}>{detalhe?detalhe.titulo:'Novo Lançamento'}</h3>
              <button onClick={()=>setModal(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#7A919E',fontSize:20}}>×</button>
            </div>

            {detalhe?(
              <div style={{padding:'1.25rem 1.5rem'}}>
                <PipelineStepper atual={detalhe.status_processo||'orcamento_aprovado'} onChange={handlePipelineChange}/>

                {isLocked(detalhe.status_processo)&&(
                  <div style={{background:'#FEF5EB',border:'1.5px solid #FDE68A',borderRadius:8,padding:'10px 14px',marginBottom:16}}>
                    <p style={{fontSize:12,fontWeight:600,color:'#92400E',margin:0}}>🔒 Orçamento fechado — valores não podem ser alterados</p>
                  </div>
                )}

                {detalhe.status_processo==='entrega_programada'&&detalhe.data_entrega_programada&&(
                  <div style={{background:'#F4EEF9',border:'1.5px solid #D8B4FE',borderRadius:8,padding:'10px 14px',marginBottom:16}}>
                    <p style={{fontSize:12,fontWeight:600,color:'#6B21A8',margin:0}}>📅 Entrega programada para {fmtData(detalhe.data_entrega_programada)} ({detalhe.dias_entrega} dias)</p>
                  </div>
                )}

                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px 24px',marginBottom:16}}>
                  {[
                    ['Empresa',detalhe.titulo],
                    ['CNPJ',detalhe.cnpj?fmtCNPJ(detalhe.cnpj):'—'],
                    ['Categoria',detalhe.categoria_nome||'—'],
                    ['Pago por',detalhe.pago_por],
                    ['Lançado por',detalhe.criado_por],
                    ['Data',fmtData(detalhe.data)],
                  ].map(([k,v])=>(
                    <div key={k}><p style={{fontSize:10,fontWeight:600,color:'#7A919E',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:2}}>{k}</p><p style={{fontSize:14,fontWeight:500}}>{v}</p></div>
                  ))}
                </div>

                {/* VALORES */}
                <div style={{border:'1.5px solid #DDE5EA',borderRadius:8,padding:'14px 16px',marginBottom:16}}>
                  <p style={{fontSize:10,fontWeight:700,color:'#7A919E',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:12}}>Valores</p>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
                    <div>
                      <p style={{fontSize:10,color:'#7A919E',fontWeight:600,textTransform:'uppercase',marginBottom:4}}>Orçamento original</p>
                      <p style={{fontSize:16,fontWeight:700,color:'#1A2B38'}}>{fmtR(detalhe.valor_original||detalhe.valor_total)}</p>
                    </div>
                    <div>
                      <p style={{fontSize:10,color:'#7A919E',fontWeight:600,textTransform:'uppercase',marginBottom:4}}>Desconto</p>
                      <p style={{fontSize:16,fontWeight:700,color:detalhe.tem_desconto?'#E67E22':'#DDE5EA'}}>
                        {detalhe.tem_desconto&&detalhe.valor_desconto?`- ${fmtR(detalhe.valor_desconto)}`:'Sem desconto'}
                      </p>
                    </div>
                    <div>
                      <p style={{fontSize:10,color:'#7A919E',fontWeight:600,textTransform:'uppercase',marginBottom:4}}>Valor final</p>
                      <p style={{fontSize:16,fontWeight:700,color:'#27AE60'}}>{fmtR(detalhe.valor_total)}</p>
                    </div>
                  </div>

                  {detalhe.status_processo==='em_tratativa'&&!isLocked(detalhe.status_processo)&&(
                    <div style={{marginTop:14,paddingTop:14,borderTop:'1px solid #DDE5EA'}}>
                      <p style={{fontSize:11,fontWeight:600,color:'#E67E22',marginBottom:8}}>🤝 Em tratativa — aplicar desconto</p>
                      <div style={{display:'flex',gap:8,alignItems:'center'}}>
                        <input style={{...s.fi,flex:1}} value={rawDesconto} placeholder="R$ 0,00"
                          onChange={e=>{
                            const digits=e.target.value.replace(/\D/g,'')
                            setRawDesconto(digits?(parseInt(digits)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'')
                          }}/>
                        <button onClick={handleSalvarDesconto} disabled={!rawDesconto} style={{...s.btnTeal,opacity:!rawDesconto?0.6:1,whiteSpace:'nowrap' as const}}>Aplicar</button>
                        {detalhe.tem_desconto&&(
                          <button onClick={async()=>{
                            await sbPatch('lancamentos',`?id=eq.${detalhe.id}`,{tem_desconto:false,valor_desconto:0,valor_total:detalhe.valor_original||detalhe.valor_total})
                            const d=await api.buscar(detalhe.id);setDetalhe(d);setRawDesconto('');showToast('Desconto removido!')
                          }} style={{...s.btnOut,color:'#E74C3C',borderColor:'#FDECEA',whiteSpace:'nowrap' as const}}>Remover</button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* PAGAMENTO */}
                <div style={{border:'1.5px solid #DDE5EA',borderRadius:8,padding:'14px 16px',marginBottom:16,background:detalhe.pago?'#F0FFF4':'#fff'}}>
                  <p style={{fontSize:10,fontWeight:700,color:'#7A919E',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:10}}>Pagamento</p>
                  <div style={{display:'flex',alignItems:'center',gap:16,flexWrap:'wrap' as const}}>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <input type="checkbox" id="det-pago" checked={detalhe.pago||false} onChange={e=>togglePagoDetalhe(e.target.checked)} style={{width:18,height:18,cursor:'pointer'}}/>
                      <label htmlFor="det-pago" style={{fontSize:13,fontWeight:600,color:detalhe.pago?'#166534':'#1A2B38',cursor:'pointer'}}>{detalhe.pago?'✓ Pago':'Marcar como pago'}</label>
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <label style={{fontSize:12,color:'#7A919E',fontWeight:600}}>Data:</label>
                      <input type="date" value={detalhe.data_pagamento||''} onChange={e=>atualizarDataPagamento(e.target.value)} style={{...s.fi,width:'auto',fontSize:12}}/>
                    </div>
                  </div>
                </div>

                {/* NOTA FISCAL — só após mercadoria recebida */}
                {canAttachNF(detalhe.status_processo)&&(
                  <div style={{marginBottom:16}}>
                    <input ref={nfDetRef} type="file" accept="application/pdf,image/*" style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0];if(f)handleAnexarNF(f)}}/>
                    {detalhe.arquivo_url?(
                      <div style={{display:'flex',alignItems:'center',gap:12}}>
                        <a href={detalhe.arquivo_url} target="_blank" rel="noopener noreferrer" style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:13,color:'#0097A8',textDecoration:'none',fontWeight:600}}>📄 Ver nota fiscal (PDF)</a>
                        <button onClick={()=>nfDetRef.current?.click()} disabled={loadingIA} style={{...s.btnOut,padding:'3px 10px',fontSize:11}}>{loadingIA?'Enviando...':'Substituir'}</button>
                      </div>
                    ):(
                      <div style={{display:'flex',alignItems:'center',gap:12}}>
                        <span style={{fontSize:12,color:'#7A919E'}}>Sem nota fiscal anexada</span>
                        <button onClick={()=>nfDetRef.current?.click()} disabled={loadingIA} style={{...s.btnTeal,padding:'6px 14px',fontSize:12,opacity:loadingIA?0.6:1}}>{loadingIA?'Enviando...':'📄 Anexar nota fiscal'}</button>
                      </div>
                    )}
                  </div>
                )}

                {!canAttachNF(detalhe.status_processo)&&(
                  <div style={{marginBottom:16,padding:'10px 14px',background:'#F2F6F8',borderRadius:8,border:'1.5px solid #DDE5EA'}}>
                    <p style={{fontSize:12,color:'#7A919E',margin:0}}>📦 Nota fiscal disponível após <strong>Mercadoria recebida</strong></p>
                  </div>
                )}

                {detalhe.tipo_pagamento==='parcelado'&&(detalhe.parcelas||[]).length>0&&(
                  <div style={{border:'1.5px solid #DDE5EA',borderRadius:8,overflow:'hidden',marginBottom:16}}>
                    <div style={{background:'#FAFCFD',padding:'8px 12px',borderBottom:'1px solid #DDE5EA'}}>
                      <span style={{fontSize:10,fontWeight:700,color:'#7A919E',textTransform:'uppercase'}}>
                        Parcelas · Pago: {fmtR((detalhe.parcelas||[]).filter(p=>p.pago).reduce((s,p)=>s+p.valor,0))} de {fmtR(detalhe.valor_total)}
                      </span>
                    </div>
                    {(detalhe.parcelas||[]).map(p=>(
                      <div key={p.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 12px',borderBottom:'1px solid #DDE5EA',background:p.pago?'#F0FFF4':'#fff'}}>
                        <div>
                          <p style={{fontSize:13,fontWeight:600,margin:0}}>Medição {p.numero} — {fmtR(p.valor)}</p>
                          <p style={{fontSize:11,color:'#7A919E',margin:'2px 0 0'}}>Venc.: {fmtData(p.data_vencimento)}{p.data_pagamento&&` · Pago em: ${fmtData(p.data_pagamento)}`}</p>
                        </div>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          {p.pago?(
                            <><span style={{fontSize:12,color:'#27AE60',fontWeight:600}}>✓ Pago</span>
                            <button onClick={()=>handleEstornar(p.id!,detalhe.id)} disabled={!!acao} style={{fontSize:11,color:'#7A919E',background:'none',border:'none',cursor:'pointer',textDecoration:'underline'}}>Estornar</button></>
                          ):(
                            <button onClick={()=>handlePagar(p.id!,detalhe.id)} disabled={!!acao} style={{...s.btnTeal,padding:'4px 12px',fontSize:11,opacity:!!acao?0.5:1}}>
                              {acao===p.id?'...':'Marcar pago'}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ):(
              <div style={s.fg}>
                <div style={{gridColumn:'1/-1',padding:'14px 16px',background:'linear-gradient(135deg,#E0F5F7,#EAF3FD)',borderRadius:10,border:'1.5px dashed #0097A8'}}>
                  <p style={{fontSize:11,fontWeight:700,color:'#0097A8',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:8}}>🤖 Importar NF com IA</p>
                  <p style={{fontSize:12,color:'#1A2B38',marginBottom:10}}>Suba o PDF ou imagem da nota fiscal e a IA preenche os dados automaticamente.</p>
                  <input ref={nfRef} type="file" accept="application/pdf,image/*" style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0];if(f)handleImportarNF(f)}}/>
                  <button onClick={()=>nfRef.current?.click()} disabled={loadingIA} style={{...s.btnTeal,opacity:loadingIA?0.6:1,width:'100%',justifyContent:'center'}}>
                    {loadingIA?'🔄 Lendo NF com IA...':'📄 Selecionar nota fiscal'}
                  </button>
                  {arquivo&&!loadingIA&&<p style={{fontSize:11,color:'#0097A8',marginTop:8,fontWeight:600}}>✅ {arquivo.name}</p>}
                </div>

                <FF lb="Nome da empresa *" full>
                  <FornecedorInput
                    value={form.titulo||''}
                    cnpj={form.cnpj||''}
                    onChange={(nome,cnpj)=>{ set('titulo',nome); set('cnpj',cnpj) }}
                  />
                </FF>

                <FF lb="CNPJ">
                  <input style={s.fi} value={form.cnpj?fmtCNPJ(form.cnpj):''} placeholder="00.000.000/0000-00" maxLength={18}
                    onChange={e=>set('cnpj',e.target.value.replace(/\D/g,''))}/>
                </FF>

                <FF lb="Valor do orçamento *">
                  <input style={s.fi} value={rawValor} placeholder="R$ 0,00" onChange={e=>{
                    const digits=e.target.value.replace(/\D/g,'')
                    setRawValor(digits?(parseInt(digits)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'')
                    set('valor_total',digits?parseFloat(digits)/100:0)
                    set('valor_original',digits?parseFloat(digits)/100:0)
                  }}/>
                </FF>

                <FF lb="Data *">
                  <input type="date" style={s.fi} value={form.data||''} onChange={e=>set('data',e.target.value)}/>
                </FF>

                <FF lb="Categoria *">
                  <select style={s.fi} value={form.categoria_id||''} onChange={e=>set('categoria_id',e.target.value)}>
                    <option value="">Selecione...</option>
                    {cats.map((c:any)=><option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </FF>

                <FF lb="Pago por">
                  <input style={s.fi} value={form.pago_por||''} onChange={e=>set('pago_por',e.target.value)}/>
                </FF>
              </div>
            )}

            <div style={s.mfoot}>
              <button onClick={()=>setModal(false)} style={{...s.btnOut,padding:'.5rem 1rem',fontSize:13}}>Fechar</button>
              {detalhe&&role==='gestora'&&(
                <button onClick={()=>handleExcluir(detalhe.id)} style={{...s.btnRed,padding:'.5rem 1rem',fontSize:13}}>🗑 Excluir</button>
              )}
              {!detalhe&&<button onClick={handleSave} disabled={saving||loadingIA} style={{...s.btnTeal,opacity:(saving||loadingIA)?0.6:1}}>{saving?'Salvando...':'Salvar'}</button>}
            </div>
          </div>
        </div>
      )}

      {modalEntregaProg&&(
        <div style={s.overlay} onClick={e=>e.target===e.currentTarget&&setModalEntregaProg(false)}>
          <div style={{...s.modal,width:380}}>
            <div style={s.mhdr}>
              <h3 style={{fontSize:15,fontWeight:700}}>📅 Entrega programada</h3>
              <button onClick={()=>setModalEntregaProg(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#7A919E',fontSize:20}}>×</button>
            </div>
            <div style={{padding:'1.5rem'}}>
              <p style={{fontSize:13,color:'#7A919E',marginBottom:16}}>Em quantos dias a entrega está programada?</p>
              <label style={s.lb}>Número de dias *</label>
              <input type="number" min={1} style={s.fi} value={diasEntrega} placeholder="Ex: 30" onChange={e=>setDiasEntrega(e.target.value)}/>
              {diasEntrega&&(
                <p style={{fontSize:12,color:'#8E44AD',marginTop:8,fontWeight:600}}>
                  📅 Previsão: {fmtData((() => { const d=new Date(); d.setDate(d.getDate()+parseInt(diasEntrega)); return d.toISOString().slice(0,10) })())}
                </p>
              )}
            </div>
            <div style={s.mfoot}>
              <button onClick={()=>setModalEntregaProg(false)} style={{...s.btnOut,padding:'.5rem 1rem',fontSize:13}}>Cancelar</button>
              <button onClick={handleConfirmarEntregaProg} disabled={!diasEntrega} style={{...s.btnTeal,opacity:!diasEntrega?0.6:1}}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {modalMensal&&(
        <div style={s.overlay} onClick={e=>e.target===e.currentTarget&&setModalMensal(false)}>
          <div style={{...s.modal,width:480}}>
            <div style={s.mhdr}>
              <h3 style={{fontSize:15,fontWeight:700}}>Nova Conta Mensal</h3>
              <button onClick={()=>setModalMensal(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#7A919E',fontSize:20}}>×</button>
            </div>
            <div style={s.fg}>
              <FF lb="Nome da conta *" full><input style={s.fi} value={formMensal.titulo||''} onChange={e=>setM('titulo',e.target.value)} placeholder="Ex: Conta de Água"/></FF>
              <FF lb="Categoria *">
                <select style={s.fi} value={formMensal.categoria_id||''} onChange={e=>setM('categoria_id',e.target.value)}>
                  <option value="">Selecione...</option>
                  {cats.map((c:any)=><option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </FF>
              <FF lb="Pago por *"><input style={s.fi} value={formMensal.pago_por||''} onChange={e=>setM('pago_por',e.target.value)} placeholder="Ex: Servis"/></FF>
              <FF lb="Dia de vencimento *" full>
                <input type="number" min={1} max={31} style={s.fi} value={formMensal.dia_vencimento||''} onChange={e=>setM('dia_vencimento',parseInt(e.target.value)||null)} placeholder="Ex: 10"/>
              </FF>
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
              <h3 style={{fontSize:15,fontWeight:700}}>🔄 {modalGerar.titulo} — Este mês</h3>
              <button onClick={()=>setModalGerar(null)} style={{background:'none',border:'none',cursor:'pointer',color:'#7A919E',fontSize:20}}>×</button>
            </div>
            <div style={{padding:'1.5rem'}}>
              <p style={{fontSize:13,color:'#7A919E',marginBottom:16}}>Informe o valor da conta neste mês:</p>
              <label style={s.lb}>Valor *</label>
              <input style={s.fi} value={valorGerar} placeholder="R$ 0,00" onChange={e=>{
                const digits=e.target.value.replace(/\D/g,'')
                setValorGerar(digits?(parseInt(digits)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'')
              }}/>
            </div>
            <div style={s.mfoot}>
              <button onClick={()=>setModalGerar(null)} style={{...s.btnOut,padding:'.5rem 1rem',fontSize:13}}>Cancelar</button>
              <button onClick={handleGerarLancamento} disabled={saving||!valorGerar} style={{...s.btnTeal,opacity:(saving||!valorGerar)?0.6:1}}>{saving?'Gerando...':'Gerar lançamento'}</button>
            </div>
          </div>
        </div>
      )}

      {toast&&(
        <div style={{position:'fixed',bottom:20,right:20,padding:'.75rem 1.25rem',borderRadius:10,fontSize:13,fontWeight:500,color:'#fff',background:toast.ok?'#27AE60':'#E74C3C',boxShadow:'0 4px 16px rgba(0,0,0,.2)',zIndex:100}}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}