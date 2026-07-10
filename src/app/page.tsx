'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { api, Lancamento, Parcela, ItemLancamento, ContaMensal, Fornecedor, fmtR, fmtData, fmtCNPJ, PIPELINE, PIPELINE_LOCKED_FROM, PIPELINE_NF_FROM } from '../services/api'

const USUARIOS: Record<string, { senha: string; nome: string; role: 'lancadora'|'gestora'|'entregador' }> = {
  'anne':    { senha: 'anne123',    nome: 'Anne',    role: 'lancadora'  },
  'mayara':  { senha: 'mayara123',  nome: 'Mayara',  role: 'lancadora'  },
  'edna':    { senha: 'edna123',    nome: 'Edna',    role: 'lancadora'  },
  'erick':   { senha: 'erick123',   nome: 'Erick',   role: 'lancadora'  },
  'clau':    { senha: 'clau123',    nome: 'Clau',    role: 'gestora'    },
  'matheus': { senha: 'matheus123', nome: 'Matheus', role: 'entregador' },
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
  modal:   { background:'#fff', borderRadius:14, width:760, maxWidth:'95vw', maxHeight:'92vh', overflowY:'auto' as const, boxShadow:'0 20px 60px rgba(0,0,0,.2)' },
  mhdr:    { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'1rem 1.5rem', borderBottom:'1px solid #DDE5EA', position:'sticky' as const, top:0, background:'#fff', zIndex:1 },
  mfoot:   { display:'flex', gap:8, justifyContent:'flex-end', padding:'1rem 1.5rem', borderTop:'1px solid #DDE5EA', background:'#FAFCFD', position:'sticky' as const, bottom:0 },
  fg:      { display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px 14px', padding:'1.25rem 1.5rem' },
  fi:      { width:'100%', border:'1.5px solid #DDE5EA', borderRadius:8, padding:'7px 10px', fontSize:13, fontFamily:'inherit', color:'#1A2B38', outline:'none', boxSizing:'border-box' as const },
  lb:      { display:'block', fontSize:10, fontWeight:600, color:'#7A919E', textTransform:'uppercase' as const, letterSpacing:'.05em', marginBottom:4 },
  footer:  { background:'#fff', borderTop:'1px solid #DDE5EA', padding:'.65rem 1.5rem', display:'flex', justifyContent:'space-between', alignItems:'center' },
}

const PIPE_COLORS: Record<string,string> = {
  orcamento_aprovado:'#7A919E', em_tratativa:'#E67E22', orcamento_fechado:'#2980B9',
  pagamento_realizado:'#27AE60', entrega_programada:'#8E44AD', mercadoria_recebida:'#0097A8', nf_recebida:'#1A2B38',
}

function pipeIdx(s: string) { return PIPELINE.findIndex(p => p.id === s) }
function isLocked(s: string) { return pipeIdx(s) >= pipeIdx(PIPELINE_LOCKED_FROM) }
function canAttachNF(s: string) { return pipeIdx(s) >= pipeIdx(PIPELINE_NF_FROM) }

function addDiasCorridos(dias: number): string {
  const d = new Date(); d.setDate(d.getDate() + dias); return d.toISOString().slice(0,10)
}
function addDiasUteis(dias: number): string {
  let count = 0; const d = new Date()
  while (count < dias) { d.setDate(d.getDate()+1); const dow=d.getDay(); if(dow!==0&&dow!==6) count++ }
  return d.toISOString().slice(0,10)
}

async function sbPatch(table: string, query: string, body: any) {
  await fetch(`${SUPA_URL}/rest/v1/${table}${query}`, {
    method:'PATCH',
    headers:{ apikey:SUPA_KEY, Authorization:`Bearer ${SUPA_KEY}`, 'Content-Type':'application/json', Prefer:'return=minimal' },
    body:JSON.stringify(body),
  })
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

function AnexoBtn({url,label,icon,onAnexar,onSubstituir,loading}:{url?:string|null;label:string;icon:string;onAnexar:()=>void;onSubstituir:()=>void;loading:boolean}) {
  if (url) return (
    <div style={{display:'flex',alignItems:'center',gap:12}}>
      <a href={url} target="_blank" rel="noopener noreferrer" style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:13,color:'#0097A8',textDecoration:'none',fontWeight:600}}>{icon} Ver {label}</a>
      <button onClick={onSubstituir} disabled={loading} style={{...s.btnOut,padding:'3px 10px',fontSize:11}}>{loading?'Enviando...':'Substituir'}</button>
    </div>
  )
  return (
    <div style={{display:'flex',alignItems:'center',gap:12}}>
      <span style={{fontSize:12,color:'#7A919E'}}>Sem {label} anexada</span>
      <button onClick={onAnexar} disabled={loading} style={{...s.btnTeal,padding:'6px 14px',fontSize:12,opacity:loading?0.6:1}}>{loading?'Enviando...':`${icon} Anexar ${label}`}</button>
    </div>
  )
}

function FornecedorInput({value,cnpj,onChange}:{value:string;cnpj:string;onChange:(n:string,c:string)=>void}) {
  const [sugestoes,setSugestoes]=useState<Fornecedor[]>([])
  const [aberto,setAberto]=useState(false)
  const timer=useRef<any>(null)
  const buscar=(termo:string)=>{
    clearTimeout(timer.current)
    timer.current=setTimeout(async()=>{
      const res=await api.buscarFornecedores(termo)
      setSugestoes(res);setAberto(res.length>0)
    },300)
  }
  return (
    <div style={{position:'relative' as const}}>
      <input style={s.fi} value={value} placeholder="Digite o nome da empresa..."
        onChange={e=>{onChange(e.target.value,cnpj);buscar(e.target.value)}}
        onBlur={()=>setTimeout(()=>setAberto(false),200)}/>
      {aberto&&(
        <div style={{position:'absolute',top:'100%',left:0,right:0,background:'#fff',border:'1.5px solid #DDE5EA',borderRadius:8,zIndex:100,boxShadow:'0 4px 16px rgba(0,0,0,.1)',maxHeight:200,overflowY:'auto'}}>
          {sugestoes.map(f=>(
            <div key={f.id} onClick={()=>{onChange(f.nome,f.cnpj||'');setAberto(false)}}
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

function ItensEditor({itens,onChange}:{itens:ItemLancamento[];onChange:(i:ItemLancamento[])=>void}) {
  const add=()=>onChange([...itens,{nome:'',quantidade:1,valor_unitario:0,valor_total:0,tipo:'orcamento'}])
  const rem=(i:number)=>onChange(itens.filter((_,idx)=>idx!==i))
  const upd=(i:number,k:string,v:any)=>onChange(itens.map((item,idx)=>{
    if(idx!==i) return item
    const u={...item,[k]:v}
    if(k==='quantidade'||k==='valor_unitario') u.valor_total=(parseFloat(String(u.quantidade))||0)*(parseFloat(String(u.valor_unitario))||0)
    return u
  }))
  const total=itens.reduce((s,i)=>s+(i.valor_total||0),0)
  return (
    <div style={{gridColumn:'1/-1',border:'1.5px solid #DDE5EA',borderRadius:8,overflow:'hidden'}}>
      <div style={{background:'#FAFCFD',padding:'8px 12px',borderBottom:'1px solid #DDE5EA',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <span style={{fontSize:10,fontWeight:700,color:'#7A919E',textTransform:'uppercase',letterSpacing:'.05em'}}>Itens do orçamento ({itens.length})</span>
        <button onClick={add} type="button" style={{...s.btnTeal,padding:'3px 10px',fontSize:11}}>+ Item</button>
      </div>
      {itens.length===0&&<p style={{padding:'12px',fontSize:12,color:'#7A919E',margin:0}}>Clique em + Item para adicionar produtos.</p>}
      {itens.map((item,i)=>(
        <div key={i} style={{display:'grid',gridTemplateColumns:'1fr 70px 110px 110px 24px',gap:8,padding:'8px 12px',borderBottom:'1px solid #DDE5EA',alignItems:'end'}}>
          <div>
            <label style={{...s.lb,marginBottom:2}}>Produto/Serviço</label>
            <input style={{...s.fi,fontSize:12}} value={item.nome} placeholder="Ex: Cimento CP-II 50kg" onChange={e=>upd(i,'nome',e.target.value)}/>
          </div>
          <div>
            <label style={{...s.lb,marginBottom:2}}>Qtd</label>
            <input type="number" step="0.001" min="0" style={{...s.fi,fontSize:12}} value={item.quantidade||''} onChange={e=>upd(i,'quantidade',parseFloat(e.target.value)||0)}/>
          </div>
          <div>
            <label style={{...s.lb,marginBottom:2}}>Vlr unitário</label>
            <input type="number" step="0.01" min="0" style={{...s.fi,fontSize:12}} value={item.valor_unitario??''} placeholder="0,00" onChange={e=>upd(i,'valor_unitario',parseFloat(e.target.value)||0)}/>
          </div>
          <div>
            <label style={{...s.lb,marginBottom:2}}>Total</label>
            <input style={{...s.fi,fontSize:12,background:'#F9FAFB',color:'#27AE60',fontWeight:700}} value={fmtR(item.valor_total||0)} readOnly/>
          </div>
          <button onClick={()=>rem(i)} type="button" style={{background:'none',border:'none',cursor:'pointer',color:'#E74C3C',fontSize:18,padding:0}}>×</button>
        </div>
      ))}
      {itens.length>0&&(
        <div style={{padding:'8px 12px',background:'#F9FAFB',display:'flex',justifyContent:'flex-end'}}>
          <span style={{fontSize:13,fontWeight:700,color:'#27AE60'}}>Total produtos: {fmtR(total)}</span>
        </div>
      )}
    </div>
  )
}

function PipelineStepper({atual,onChange}:{atual:string;onChange:(id:string)=>void}) {
  const idx=PIPELINE.findIndex(p=>p.id===atual)
  return (
    <div style={{overflowX:'auto',paddingBottom:4}}>
      <div style={{display:'flex',alignItems:'center',minWidth:600,marginBottom:16}}>
        {PIPELINE.map((step,i)=>{
          const done=i<idx; const current=i===idx; const cor=PIPE_COLORS[step.id]
          return (
            <div key={step.id} style={{display:'flex',alignItems:'center',flex:1}}>
              <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4,flex:'0 0 auto'}}>
                <button onClick={()=>onChange(step.id)} style={{
                  width:36,height:36,borderRadius:'50%',border:'none',cursor:'pointer',
                  background:done?'#27AE60':current?cor:'#DDE5EA',
                  color:done||current?'#fff':'#7A919E',fontSize:16,
                  display:'flex',alignItems:'center',justifyContent:'center',
                  boxShadow:current?`0 0 0 3px ${cor}33`:'none',transition:'all .2s',
                }}>{done?'✓':step.icon}</button>
                <span style={{fontSize:9,fontWeight:600,color:current?cor:done?'#27AE60':'#7A919E',textAlign:'center',maxWidth:70,lineHeight:1.2}}>{step.label}</span>
              </div>
              {i<PIPELINE.length-1&&<div style={{flex:1,height:2,background:i<idx?'#27AE60':'#DDE5EA',margin:'0 4px',marginBottom:20}}/>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function LoginScreen({onLogin}:{onLogin:(nome:string,role:'lancadora'|'gestora'|'entregador')=>void}) {
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
  const [logado,setLogado]=useState(false)
  const [user,setUser]=useState('')
  const [role,setRole]=useState<'lancadora'|'gestora'|'entregador'>('lancadora')
  const [aba,setAba]=useState<'lancamentos'|'mensais'>('lancamentos')
  const [data,setData]=useState<Lancamento[]>([])
  const [contasMensais,setContasMensais]=useState<ContaMensal[]>([])
  const [loading,setLoading]=useState(true)
  const [fPipe,setFPipe]=useState('')
  const [fRec,setFRec]=useState('')
  const [search,setSearch]=useState('')
  const [modal,setModal]=useState(false)
  const [detalhe,setDetalhe]=useState<Lancamento|null>(null)
  const [saving,setSaving]=useState(false)
  const [acao,setAcao]=useState('')
  const [toast,setToast]=useState<{msg:string;ok:boolean}|null>(null)
  // Novo orçamento
  const [form,setForm]=useState<any>({})
  const [itensOrcamento,setItensOrcamento]=useState<ItemLancamento[]>([])
  const [rawFrete,setRawFrete]=useState('')
  const [loadingIA,setLoadingIA]=useState(false)
  const [loadingAnexo,setLoadingAnexo]=useState(false)
  // Desconto
  const [rawDesconto,setRawDesconto]=useState('')
  // Entrega programada
  const [modalEntregaProg,setModalEntregaProg]=useState(false)
  const [entregaTipo,setEntregaTipo]=useState('corridos')
  const [diasEntrega,setDiasEntrega]=useState('')
  const [entregaData1,setEntregaData1]=useState('')
  const [entregaData2State,setEntregaData2State]=useState('')
  const [entregaItens1,setEntregaItens1]=useState('')
  const [entregaItens2,setEntregaItens2]=useState('')
  // Forma de pagamento
  const [modalFormaPgto,setModalFormaPgto]=useState(false)
  const [formaPgtoTipo,setFormaPgtoTipo]=useState('pix')
  const [formaPgtoParc,setFormaPgtoParc]=useState('')
  const [formaPgtoObs,setFormaPgtoObs]=useState('')
  const [formaPgtoData,setFormaPgtoData]=useState('')
  // NF itens
  const [modalNFItens,setModalNFItens]=useState(false)
  const [itensNFEditor,setItensNFEditor]=useState<ItemLancamento[]>([])
  const [nfFileTemp,setNfFileTemp]=useState<File|null>(null)
  const [loadingIANF,setLoadingIANF]=useState(false)
  // Contas mensais
  const [modalMensal,setModalMensal]=useState(false)
  const [formMensal,setFormMensal]=useState<any>({})
  const [modalGerar,setModalGerar]=useState<ContaMensal|null>(null)
  const [valorGerar,setValorGerar]=useState('')

  const orcIARef=useRef<HTMLInputElement>(null)
  const propostaDetRef=useRef<HTMLInputElement>(null)
  const nfDetRef=useRef<HTMLInputElement>(null)

  const showToast=(msg:string,ok=true)=>{setToast({msg,ok});setTimeout(()=>setToast(null),3500)}
  const set=(k:string,v:any)=>setForm((p:any)=>({...p,[k]:v}))
  const setM=(k:string,v:any)=>setFormMensal((p:any)=>({...p,[k]:v}))

  const load=useCallback(async()=>{
    setLoading(true)
    try {
      const [lista,mensais]=await Promise.all([
        api.listar({status_processo:fPipe,recorrente:fRec}),
        api.listarContasMensais(),
      ])
      setData(lista);setContasMensais(mensais)
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
      const dados=await lerDocIA(file,`Extraia todos os dados deste orçamento e retorne APENAS um JSON válido, sem texto adicional:
{
  "titulo": "nome da empresa fornecedora",
  "cnpj": "somente números sem formatação",
  "data": "YYYY-MM-DD",
  "valor_frete": 0.00,
  "itens": [{"nome": "nome completo do produto", "quantidade": 1.0, "valor_unitario": 0.00}]
}
Liste TODOS os itens/produtos. Se não encontrar algum campo use string vazia ou zero.`)
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
      }
      showToast('✅ Orçamento importado com sucesso!')
    } catch {showToast('⚠️ Não foi possível extrair. Preencha manualmente.',false)}
    finally {setLoadingIA(false)}
  }

  const handleSave=async()=>{
    if(!form.titulo||!form.data) return showToast('Preencha empresa e data',false)
    if(itensOrcamento.length===0) return showToast('Adicione pelo menos um item',false)
    setSaving(true)
    try {
      const valor_produtos=itensOrcamento.reduce((s,i)=>s+(i.valor_total||0),0)
      const vFrete=parseFloat(rawFrete.replace(/\D/g,''))/100||0
      const valor_total=valor_produtos+vFrete
      await api.criar({
        ...form, valor_produtos, valor_frete:vFrete,
        valor_total, valor_original:valor_total, criado_por:user, itens:itensOrcamento,
      })
      if(form.titulo) await api.salvarFornecedor(form.titulo,form.cnpj||undefined)
      setModal(false);showToast('Orçamento salvo!');load()
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

  const handleAnexarProposta=async(file:File)=>{
    if(!detalhe) return
    setLoadingAnexo(true)
    try {
      const url=await api.uploadArquivo(file)
      await sbPatch('lancamentos',`?id=eq.${detalhe.id}`,{proposta_url:url})
      const d=await api.buscar(detalhe.id);setDetalhe(d);showToast('Proposta anexada!')
    } catch {showToast('Erro ao enviar',false)}
    finally {setLoadingAnexo(false)}
  }

  const handleAnexarNFComIA=async(file:File)=>{
    if(!detalhe) return
    setNfFileTemp(file);setLoadingIANF(true)
    try {
      const dados=await lerDocIA(file,`Extraia todos os itens desta nota fiscal e retorne APENAS um JSON válido:
{
  "valor_frete": 0.00,
  "itens": [{"nome": "nome completo do produto", "quantidade": 1.0, "valor_unitario": 0.00}]
}
Liste TODOS os itens. Se não encontrar use zero.`)
      const itens=(dados.itens||[]).map((i:any)=>({
        nome:i.nome||'', quantidade:i.quantidade||1,
        valor_unitario:i.valor_unitario||0,
        valor_total:(i.quantidade||1)*(i.valor_unitario||0),
        tipo:'nf' as const,
      }))
      setItensNFEditor(itens);setModalNFItens(true)
    } catch {
      setItensNFEditor([]);setModalNFItens(true)
      showToast('⚠️ IA não extraiu itens. Preencha manualmente.',false)
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
      showToast('✅ NF e itens salvos!')
    } catch {showToast('Erro ao salvar NF',false)}
    finally {setLoadingAnexo(false)}
  }

  const handlePipelineChange=async(novoStatus:string)=>{
    if(!detalhe) return
    if(novoStatus==='entrega_programada'){setEntregaTipo('corridos');setDiasEntrega('');setEntregaData1('');setEntregaData2State('');setEntregaItens1('');setEntregaItens2('');setModalEntregaProg(true);return}
    if(novoStatus==='pagamento_realizado'){setFormaPgtoTipo('pix');setFormaPgtoParc('');setFormaPgtoObs('');setFormaPgtoData(new Date().toISOString().slice(0,10));setModalFormaPgto(true);return}
    await sbPatch('lancamentos',`?id=eq.${detalhe.id}`,{status_processo:novoStatus})
    const d=await api.buscar(detalhe.id);setDetalhe(d)
    const step=PIPELINE.find(p=>p.id===novoStatus)
    showToast(`${step?.icon} ${step?.label}`)
    load()
  }

  const handleConfirmarFormaPgto=async()=>{
    if(!detalhe||!formaPgtoData) return showToast('Informe a data do pagamento',false)
    setSaving(true)
    try {
      let fp=formaPgtoTipo==='pix'?'PIX':formaPgtoTipo==='boleto'?'Boleto':formaPgtoTipo==='transferencia'?'Transferência':formaPgtoTipo==='cartao'?'Cartão':formaPgtoTipo==='parcelado'?`Parcelado${formaPgtoParc?` ${formaPgtoParc}x`:''}`:formaPgtoTipo
      if(formaPgtoObs) fp+=` — ${formaPgtoObs}`
      await sbPatch('lancamentos',`?id=eq.${detalhe.id}`,{
        status_processo:'pagamento_realizado', pago:true,
        data_pagamento:formaPgtoData, forma_pagamento:fp,
      })
      const d=await api.buscar(detalhe.id);setDetalhe(d)
      setModalFormaPgto(false);showToast('💰 Pagamento registrado!');load()
    } finally {setSaving(false)}
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
      setModalEntregaProg(false);showToast(`📅 Entrega programada!`);load()
    } finally {setSaving(false)}
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

  const handleSaveMensal=async()=>{
    if(!formMensal.titulo||!formMensal.categoria_id||!formMensal.pago_por||!formMensal.dia_vencimento) return showToast('Preencha todos os campos',false)
    setSaving(true)
    try {
      await api.criarContaMensal({...formMensal,ativo:true})
      setModalMensal(false);setFormMensal({});showToast('Conta mensal cadastrada!');load()
    } catch {showToast('Erro',false)}
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
    } catch {showToast('Erro',false)}
    finally {setSaving(false)}
  }

  const handleMarcarItemEntregue=async(item:ItemLancamento,data_entrega:string)=>{
    if(!detalhe) return
    await api.atualizarItem(item.id!,{entregue:true,data_entrega})
    // Se todos entregues, move para mercadoria_recebida
    const d=await api.buscar(detalhe.id)
    const todos=d.itens?.filter((i:any)=>i.tipo==='orcamento')||[]
    const todosEntregues=todos.every((i:any)=>i.entregue)
    if(todosEntregues&&d.status_processo==='entrega_programada') {
      await sbPatch('lancamentos',`?id=eq.${detalhe.id}`,{status_processo:'mercadoria_recebida',status_entrega:'entregue',data_entrega})
    }
    const d2=await api.buscar(detalhe.id);setDetalhe(d2);showToast('Item confirmado!')
    load()
  }

  if(!logado) return <LoginScreen onLogin={(nome,r)=>{setUser(nome);setRole(r);setLogado(true)}}/>

  const filtered=data.filter(l=>{
    if(!search) return true
    const q=search.toLowerCase()
    return [l.titulo,l.cnpj,l.criado_por].some(f=>f?.toLowerCase().includes(q))
  })

  const totalValor=data.reduce((s,l)=>s+l.valor_total,0)
  const totalPagos=data.filter(l=>l.pago).length
  const totalPendente=data.filter(l=>l.status_entrega==='pendente').length
  const th=(label:string)=><th style={{padding:'8px 11px',textAlign:'left',fontSize:10,fontWeight:700,color:'#7A919E',textTransform:'uppercase',whiteSpace:'nowrap'}}>{label}</th>
  const [cats,setCats]=useState<any[]>([])
  useEffect(()=>{if(logado)api.categorias().then(setCats)},[logado])

  return (
    <div style={s.page}>
      <header style={s.topbar}>
        <img src="/logo.jpg" alt="Servis" style={{height:40,objectFit:'contain'}} onError={e=>(e.currentTarget.style.display='none')}/>
        <span style={{fontWeight:700,fontSize:15,color:'#0097A8'}}>Servis - Conciliação Financeira</span>
        {role!=='entregador'&&(
          <nav style={{display:'flex',gap:4,marginLeft:16}}>
            {(['lancamentos','mensais'] as const).map(a=>(
              <button key={a} onClick={()=>setAba(a)} style={{padding:'.4rem .9rem',borderRadius:7,border:'none',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit',background:aba===a?'#0097A8':'transparent',color:aba===a?'#fff':'#7A919E'}}>
                {a==='lancamentos'?'Lançamentos':'🔄 Contas Mensais'}
              </button>
            ))}
          </nav>
        )}
        <div style={{flex:1}}/>
        <div style={{display:'flex',alignItems:'center',gap:8,fontSize:12,color:'#7A919E'}}>
          <span>👤 {user}</span>
          <span style={{...s.badge,background:role==='gestora'?'#EAF7EE':role==='entregador'?'#FEF5EB':'#E0F5F7',color:role==='gestora'?'#27AE60':role==='entregador'?'#E67E22':'#0097A8'}}>
            {role==='gestora'?'Gestora':role==='entregador'?'Entregador':'Lançadora'}
          </span>
          <button onClick={()=>setLogado(false)} style={{...s.btnOut,padding:'3px 10px',fontSize:11,color:'#E74C3C',borderColor:'#FDECEA'}}>Sair</button>
        </div>
      </header>

      <main style={s.main}>

        {/* ENTREGADOR VIEW */}
        {role==='entregador'&&(
          <div>
            <div style={s.row}>
              <div><h1 style={s.h1}>Entregas</h1><p style={s.p}>Confirme os itens recebidos</p></div>
            </div>
            <div style={s.card}>
              <div style={s.toolbar}>
                <input style={{...s.inp,width:200}} placeholder="Buscar empresa..." value={search} onChange={e=>setSearch(e.target.value)}/>
                <select style={s.inp} value={fPipe} onChange={e=>setFPipe(e.target.value)}>
                  <option value="">Todas as etapas</option>
                  {PIPELINE.map(p=><option key={p.id} value={p.id}>{p.icon} {p.label}</option>)}
                </select>
              </div>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead>
                  <tr style={{background:'#FAFCFD',borderBottom:'2px solid #DDE5EA'}}>
                    {th('Empresa')}{th('Etapa')}{th('Data programada')}
                  </tr>
                </thead>
                <tbody>
                  {loading?<tr><td colSpan={3} style={{textAlign:'center',padding:'3rem',color:'#7A919E'}}>Carregando...</td></tr>
                  :filtered.map(l=>{
                    const step=PIPELINE.find(p=>p.id===l.status_processo)
                    const cor=PIPE_COLORS[l.status_processo]||'#7A919E'
                    return (
                      <tr key={l.id} onClick={()=>openDetalhe(l.id)} style={{borderBottom:'1px solid #DDE5EA',cursor:'pointer'}}
                        onMouseEnter={e=>(e.currentTarget.style.background='#F0F7F9')} onMouseLeave={e=>(e.currentTarget.style.background='')}>
                        <td style={{padding:'10px 11px',fontWeight:600}}>{l.titulo}</td>
                        <td style={{padding:'10px 11px'}}><span style={{...s.badge,background:`${cor}18`,color:cor}}>{step?.icon} {step?.label}</span></td>
                        <td style={{padding:'10px 11px',color:'#7A919E'}}>{l.data_entrega_programada?fmtData(l.data_entrega_programada):'—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CONTAS MENSAIS */}
        {role!=='entregador'&&aba==='mensais'&&(
          <div>
            <div style={s.row}>
              <div><h1 style={s.h1}>Contas Mensais</h1><p style={s.p}>Água, luz, internet e outros fixos</p></div>
              <button onClick={()=>setModalMensal(true)} style={s.btnTeal}>＋ Nova conta mensal</button>
            </div>
            <div style={s.card}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead><tr style={{background:'#FAFCFD',borderBottom:'2px solid #DDE5EA'}}>{th('Conta')}{th('Pago por')}{th('Dia venc.')}{th('Status')}{th('Ações')}</tr></thead>
                <tbody>
                  {contasMensais.length===0&&<tr><td colSpan={5} style={{textAlign:'center',padding:'3rem',color:'#7A919E'}}>Nenhuma conta mensal cadastrada</td></tr>}
                  {contasMensais.map(c=>(
                    <tr key={c.id} style={{borderBottom:'1px solid #DDE5EA'}}>
                      <td style={{padding:'10px 11px',fontWeight:600}}>{c.titulo}</td>
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

        {/* LANÇAMENTOS */}
        {role!=='entregador'&&aba==='lancamentos'&&(
          <div>
            <div style={s.row}>
              <div><h1 style={s.h1}>Orçamentos e Notas Fiscais</h1><p style={s.p}>Controle de pagamentos e entregas · Financeiro</p></div>
              <button onClick={openNovo} style={s.btnTeal}>＋ Novo orçamento</button>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:10,marginBottom:'1.25rem'}}>
              <KPI l="Total" v={data.length} sv={`${filtered.length} exibidos`} c="#0097A8"/>
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
              </div>
              <div style={{overflowX:'auto',maxHeight:440,overflowY:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                  <thead style={{position:'sticky',top:0,zIndex:2}}>
                    <tr style={{background:'#FAFCFD',borderBottom:'2px solid #DDE5EA'}}>
                      {th('Empresa')}{th('CNPJ')}{th('Etapa')}{th('Data')}{th('Produtos')}{th('Frete')}{th('Desconto')}{th('Total')}{th('Pgto')}{th('Proposta')}{th('NF')}{th('Lançado por')}
                    </tr>
                  </thead>
                  <tbody>
                    {loading?<tr><td colSpan={12} style={{textAlign:'center',padding:'3rem',color:'#7A919E'}}>Carregando...</td></tr>
                    :filtered.length===0?<tr><td colSpan={12} style={{textAlign:'center',padding:'3rem',color:'#7A919E'}}>Nenhum registro</td></tr>
                    :filtered.map(l=>{
                      const step=PIPELINE.find(p=>p.id===l.status_processo)
                      const cor=PIPE_COLORS[l.status_processo]||'#7A919E'
                      return (
                        <tr key={l.id} onClick={()=>openDetalhe(l.id)} style={{borderBottom:'1px solid #DDE5EA',cursor:'pointer'}}
                          onMouseEnter={e=>(e.currentTarget.style.background='#F0F7F9')} onMouseLeave={e=>(e.currentTarget.style.background='')}>
                          <td style={{padding:'8px 11px',fontWeight:500,maxWidth:130,overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis'}}>{l.titulo}</td>
                          <td style={{padding:'8px 11px',color:'#7A919E',fontSize:11}}>{l.cnpj?fmtCNPJ(l.cnpj):'—'}</td>
                          <td style={{padding:'8px 11px'}}><span style={{...s.badge,background:`${cor}18`,color:cor}}>{step?.icon} {step?.label||l.status_processo}</span></td>
                          <td style={{padding:'8px 11px',color:'#7A919E',whiteSpace:'nowrap'}}>{fmtData(l.data)}</td>
                          <td style={{padding:'8px 11px',color:'#7A919E'}}>{l.valor_produtos?fmtR(l.valor_produtos):'—'}</td>
                          <td style={{padding:'8px 11px',color:'#7A919E'}}>{l.valor_frete?fmtR(l.valor_frete):'—'}</td>
                          <td style={{padding:'8px 11px',textAlign:'center'}}>{l.tem_desconto&&l.valor_desconto?<span style={{color:'#E67E22',fontWeight:600,fontSize:11}}>-{fmtR(l.valor_desconto)}</span>:<span style={{color:'#DDE5EA'}}>—</span>}</td>
                          <td style={{padding:'8px 11px',fontWeight:700}}>{fmtR(l.valor_total)}</td>
                          <td style={{padding:'8px 11px',textAlign:'center'}}>{l.pago?<span style={{color:'#27AE60',fontWeight:700}}>✓</span>:<span style={{color:'#E74C3C',fontWeight:700}}>✗</span>}</td>
                          <td style={{padding:'8px 11px',textAlign:'center'}}>{l.proposta_url?<a href={l.proposta_url} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} style={{fontSize:16}}>📋</a>:<span style={{color:'#DDE5EA'}}>—</span>}</td>
                          <td style={{padding:'8px 11px',textAlign:'center'}}>{l.arquivo_url?<a href={l.arquivo_url} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} style={{fontSize:16}}>🧾</a>:<span style={{color:'#DDE5EA'}}>—</span>}</td>
                          <td style={{padding:'8px 11px',color:'#7A919E',fontSize:11}}>{l.criado_por}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{padding:'.5rem 1.1rem',borderTop:'1px solid #DDE5EA',fontSize:11,color:'#7A919E',background:'#FAFCFD'}}>
                {filtered.length} registro{filtered.length!==1?'s':''} de {data.length} total
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

      {/* MODAL PRINCIPAL */}
      {modal&&detalhe&&(
        <div style={s.overlay} onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div style={s.modal}>
            <div style={s.mhdr}>
              <h3 style={{fontSize:15,fontWeight:700}}>{detalhe.titulo}</h3>
              <button onClick={()=>setModal(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#7A919E',fontSize:20}}>×</button>
            </div>

            {/* VIEW MATHEUS */}
            {role==='entregador'?(
              <div style={{padding:'1.25rem 1.5rem'}}>
                {(() => {
                  const step=PIPELINE.find(p=>p.id===detalhe.status_processo)
                  const cor=PIPE_COLORS[detalhe.status_processo]||'#7A919E'
                  const itensOrc=detalhe.itens?.filter(i=>i.tipo==='orcamento')||[]
                  return (
                    <>
                      <div style={{display:'flex',gap:12,alignItems:'center',marginBottom:16}}>
                        <span style={{...s.badge,background:`${cor}18`,color:cor,fontSize:12,padding:'4px 12px'}}>{step?.icon} {step?.label}</span>
                        {detalhe.data_entrega_programada&&(
                          <span style={{fontSize:12,color:'#8E44AD',fontWeight:600}}>📅 {fmtData(detalhe.data_entrega_programada)}</span>
                        )}
                      </div>
                      {detalhe.entrega_tipo==='parcial'&&(
                        <div style={{background:'#F4EEF9',border:'1.5px solid #D8B4FE',borderRadius:8,padding:'10px 14px',marginBottom:16}}>
                          <p style={{fontSize:12,fontWeight:600,color:'#6B21A8',margin:'0 0 6px'}}>📦 Entrega parcial</p>
                          {detalhe.entrega_itens1&&<p style={{fontSize:11,color:'#6B21A8',margin:'0 0 4px'}}>1ª entrega ({detalhe.data_entrega_programada?fmtData(detalhe.data_entrega_programada):'?'}): {detalhe.entrega_itens1}</p>}
                          {detalhe.entrega_itens2&&<p style={{fontSize:11,color:'#6B21A8',margin:0}}>2ª entrega ({detalhe.entrega_data2?fmtData(detalhe.entrega_data2):'?'}): {detalhe.entrega_itens2}</p>}
                        </div>
                      )}
                      <div style={{border:'1.5px solid #DDE5EA',borderRadius:8,overflow:'hidden'}}>
                        <div style={{background:'#FAFCFD',padding:'8px 12px',borderBottom:'1px solid #DDE5EA'}}>
                          <span style={{fontSize:10,fontWeight:700,color:'#7A919E',textTransform:'uppercase'}}>Itens para entrega ({itensOrc.length})</span>
                        </div>
                        {itensOrc.length===0&&<p style={{padding:'12px',fontSize:12,color:'#7A919E',margin:0}}>Nenhum item cadastrado.</p>}
                        {itensOrc.map(item=>{
                          const inputId=`data-item-${item.id}`
                          return (
                            <div key={item.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 12px',borderBottom:'1px solid #DDE5EA',background:item.entregue?'#F0FFF4':'#fff'}}>
                              <div>
                                <p style={{margin:0,fontSize:13,fontWeight:600}}>{item.nome}</p>
                                <p style={{margin:'2px 0 0',fontSize:11,color:'#7A919E'}}>Quantidade: {item.quantidade}</p>
                                {item.entregue&&item.data_entrega&&<p style={{margin:'2px 0 0',fontSize:11,color:'#27AE60'}}>✓ Entregue em {fmtData(item.data_entrega)}</p>}
                              </div>
                              {!item.entregue?(
                                <div style={{display:'flex',alignItems:'center',gap:8}}>
                                  <input type="date" id={inputId} defaultValue={new Date().toISOString().slice(0,10)} style={{...s.fi,width:'auto',fontSize:11}}/>
                                  <button onClick={async()=>{
                                    const el=document.getElementById(inputId) as HTMLInputElement
                                    await handleMarcarItemEntregue(item, el?.value||new Date().toISOString().slice(0,10))
                                  }} style={{...s.btnGrn,padding:'4px 10px',fontSize:11}}>Confirmar</button>
                                </div>
                              ):(
                                <span style={{fontSize:12,color:'#27AE60',fontWeight:700}}>✓ Entregue</span>
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
              /* VIEW NORMAL */
              <div style={{padding:'1.25rem 1.5rem'}}>
                <PipelineStepper atual={detalhe.status_processo||'orcamento_aprovado'} onChange={handlePipelineChange}/>

                {isLocked(detalhe.status_processo)&&(
                  <div style={{background:'#FEF5EB',border:'1.5px solid #FDE68A',borderRadius:8,padding:'10px 14px',marginBottom:16}}>
                    <p style={{fontSize:12,fontWeight:600,color:'#92400E',margin:0}}>🔒 Orçamento fechado — valores não podem ser alterados</p>
                  </div>
                )}

                {detalhe.status_processo==='entrega_programada'&&(
                  <div style={{background:'#F4EEF9',border:'1.5px solid #D8B4FE',borderRadius:8,padding:'10px 14px',marginBottom:16}}>
                    {detalhe.entrega_tipo==='parcial'?(
                      <>
                        <p style={{fontSize:12,fontWeight:600,color:'#6B21A8',margin:'0 0 4px'}}>📦 Entrega parcial</p>
                        {detalhe.entrega_itens1&&<p style={{fontSize:11,color:'#6B21A8',margin:'0 0 2px'}}>1ª: {detalhe.data_entrega_programada?fmtData(detalhe.data_entrega_programada):''} — {detalhe.entrega_itens1}</p>}
                        {detalhe.entrega_itens2&&<p style={{fontSize:11,color:'#6B21A8',margin:0}}>2ª: {detalhe.entrega_data2?fmtData(detalhe.entrega_data2):''} — {detalhe.entrega_itens2}</p>}
                      </>
                    ):(
                      <p style={{fontSize:12,fontWeight:600,color:'#6B21A8',margin:0}}>
                        📅 Entrega em {detalhe.data_entrega_programada?fmtData(detalhe.data_entrega_programada):'?'}
                        {detalhe.dias_entrega&&` (${detalhe.dias_entrega} dias ${detalhe.entrega_tipo==='uteis'?'úteis':'corridos'})`}
                      </p>
                    )}
                  </div>
                )}

                {/* DADOS */}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px 24px',marginBottom:16}}>
                  {[
                    ['Empresa',detalhe.titulo],['CNPJ',detalhe.cnpj?fmtCNPJ(detalhe.cnpj):'—'],
                    ['Lançado por',detalhe.criado_por],['Data',fmtData(detalhe.data)],
                    ...(detalhe.forma_pagamento?[['Forma de pagamento',detalhe.forma_pagamento]]:[] as any),
                  ].map(([k,v]:any)=>(
                    <div key={k}><p style={{fontSize:10,fontWeight:600,color:'#7A919E',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:2}}>{k}</p><p style={{fontSize:14,fontWeight:500}}>{v}</p></div>
                  ))}
                </div>

                {/* VALORES */}
                <div style={{border:'1.5px solid #DDE5EA',borderRadius:8,padding:'14px 16px',marginBottom:16}}>
                  <p style={{fontSize:10,fontWeight:700,color:'#7A919E',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:12}}>Valores</p>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
                    <div>
                      <p style={{fontSize:10,color:'#7A919E',fontWeight:600,textTransform:'uppercase',marginBottom:4}}>Produtos</p>
                      <p style={{fontSize:14,fontWeight:700,color:'#1A2B38'}}>{fmtR(detalhe.valor_produtos||0)}</p>
                    </div>
                    <div>
                      <p style={{fontSize:10,color:'#7A919E',fontWeight:600,textTransform:'uppercase',marginBottom:4}}>Frete</p>
                      <p style={{fontSize:14,fontWeight:700,color:'#1A2B38'}}>{fmtR(detalhe.valor_frete||0)}</p>
                    </div>
                    <div>
                      <p style={{fontSize:10,color:'#7A919E',fontWeight:600,textTransform:'uppercase',marginBottom:4}}>Desconto</p>
                      <p style={{fontSize:14,fontWeight:700,color:detalhe.tem_desconto?'#E67E22':'#DDE5EA'}}>{detalhe.tem_desconto&&detalhe.valor_desconto?`- ${fmtR(detalhe.valor_desconto)}`:'—'}</p>
                    </div>
                    <div>
                      <p style={{fontSize:10,color:'#7A919E',fontWeight:600,textTransform:'uppercase',marginBottom:4}}>Total final</p>
                      <p style={{fontSize:14,fontWeight:700,color:'#27AE60'}}>{fmtR(detalhe.valor_total)}</p>
                    </div>
                  </div>
                  {detalhe.status_processo==='em_tratativa'&&!isLocked(detalhe.status_processo)&&(
                    <div style={{marginTop:14,paddingTop:14,borderTop:'1px solid #DDE5EA'}}>
                      <p style={{fontSize:11,fontWeight:600,color:'#E67E22',marginBottom:8}}>🤝 Em tratativa — aplicar desconto</p>
                      <div style={{display:'flex',gap:8,alignItems:'center'}}>
                        <input style={{...s.fi,flex:1}} value={rawDesconto} placeholder="R$ 0,00"
                          onChange={e=>{const d=e.target.value.replace(/\D/g,'');setRawDesconto(d?(parseInt(d)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'')} }/>
                        <button onClick={handleSalvarDesconto} disabled={!rawDesconto} style={{...s.btnTeal,opacity:!rawDesconto?0.6:1,whiteSpace:'nowrap' as const}}>Aplicar</button>
                        {detalhe.tem_desconto&&(
                          <button onClick={async()=>{
                            await sbPatch('lancamentos',`?id=eq.${detalhe.id}`,{tem_desconto:false,valor_desconto:0,valor_total:(detalhe.valor_original||detalhe.valor_total)})
                            const d=await api.buscar(detalhe.id);setDetalhe(d);setRawDesconto('');showToast('Desconto removido!')
                          }} style={{...s.btnOut,color:'#E74C3C',borderColor:'#FDECEA',whiteSpace:'nowrap' as const}}>Remover</button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* ITENS */}
                {(() => {
                  const itensOrc=detalhe.itens?.filter(i=>i.tipo==='orcamento')||[]
                  const itensNF=detalhe.itens?.filter(i=>i.tipo==='nf')||[]
                  if(itensOrc.length===0&&itensNF.length===0) return null
                  return (
                    <div style={{border:'1.5px solid #DDE5EA',borderRadius:8,overflow:'hidden',marginBottom:16}}>
                      <div style={{background:'#FAFCFD',padding:'8px 12px',borderBottom:'1px solid #DDE5EA',display:'flex',gap:16}}>
                        <span style={{fontSize:10,fontWeight:700,color:'#7A919E',textTransform:'uppercase'}}>📋 Itens orçamento ({itensOrc.length})</span>
                        {itensNF.length>0&&<span style={{fontSize:10,fontWeight:700,color:'#0097A8',textTransform:'uppercase'}}>🧾 Itens NF ({itensNF.length})</span>}
                      </div>
                      <div style={{display:'grid',gridTemplateColumns:itensNF.length>0?'1fr 1fr':'1fr'}}>
                        <div style={{borderRight:itensNF.length>0?'1px solid #DDE5EA':'none'}}>
                          {itensOrc.map(item=>(
                            <div key={item.id} style={{padding:'8px 12px',borderBottom:'1px solid #DDE5EA',background:item.entregue?'#F0FFF4':'#fff'}}>
                              <p style={{margin:0,fontSize:12,fontWeight:600}}>{item.nome}</p>
                              <p style={{margin:'2px 0 0',fontSize:11,color:'#7A919E'}}>Qtd: {item.quantidade} · {fmtR(item.valor_unitario||0)}/un · Total: {fmtR(item.valor_total||0)}</p>
                              {item.entregue&&<span style={{fontSize:11,color:'#27AE60'}}>✓ Entregue {item.data_entrega?fmtData(item.data_entrega):''}</span>}
                            </div>
                          ))}
                          <div style={{padding:'8px 12px',background:'#F9FAFB'}}>
                            <span style={{fontSize:12,fontWeight:700}}>Total: {fmtR(itensOrc.reduce((s,i)=>s+(i.valor_total||0),0))}</span>
                          </div>
                        </div>
                        {itensNF.length>0&&(
                          <div>
                            {itensNF.map(item=>(
                              <div key={item.id} style={{padding:'8px 12px',borderBottom:'1px solid #DDE5EA'}}>
                                <p style={{margin:0,fontSize:12,fontWeight:600}}>{item.nome}</p>
                                <p style={{margin:'2px 0 0',fontSize:11,color:'#7A919E'}}>Qtd: {item.quantidade} · {fmtR(item.valor_unitario||0)}/un · Total: {fmtR(item.valor_total||0)}</p>
                              </div>
                            ))}
                            <div style={{padding:'8px 12px',background:'#F9FAFB'}}>
                              <span style={{fontSize:12,fontWeight:700,color:'#0097A8'}}>Total NF: {fmtR(itensNF.reduce((s,i)=>s+(i.valor_total||0),0))}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })()}

                {/* PROPOSTA */}
                <div style={{border:'1.5px solid #DDE5EA',borderRadius:8,padding:'12px 14px',marginBottom:12}}>
                  <p style={{fontSize:10,fontWeight:700,color:'#7A919E',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:10}}>📋 Proposta</p>
                  <input ref={propostaDetRef} type="file" accept="application/pdf,image/*" style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0];if(f)handleAnexarProposta(f)}}/>
                  <AnexoBtn url={detalhe.proposta_url} label="proposta" icon="📋" onAnexar={()=>propostaDetRef.current?.click()} onSubstituir={()=>propostaDetRef.current?.click()} loading={loadingAnexo}/>
                </div>

                {/* NOTA FISCAL */}
                <div style={{border:'1.5px solid #DDE5EA',borderRadius:8,padding:'12px 14px',marginBottom:16,background:canAttachNF(detalhe.status_processo)?'#fff':'#F9FAFB'}}>
                  <p style={{fontSize:10,fontWeight:700,color:'#7A919E',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:10}}>🧾 Nota Fiscal</p>
                  {canAttachNF(detalhe.status_processo)?(
                    <>
                      <input ref={nfDetRef} type="file" accept="application/pdf,image/*" style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0];if(f)handleAnexarNFComIA(f)}}/>
                      {loadingIANF?(
                        <p style={{fontSize:12,color:'#0097A8',fontWeight:600}}>🤖 Lendo NF com IA...</p>
                      ):(
                        <AnexoBtn url={detalhe.arquivo_url} label="nota fiscal" icon="🧾" onAnexar={()=>nfDetRef.current?.click()} onSubstituir={()=>nfDetRef.current?.click()} loading={loadingAnexo}/>
                      )}
                    </>
                  ):(
                    <p style={{fontSize:12,color:'#7A919E',margin:0}}>📦 Disponível após <strong>Mercadoria recebida</strong></p>
                  )}
                </div>

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
                          <p style={{fontSize:13,fontWeight:600,margin:0}}>Parcela {p.numero} — {fmtR(p.valor)}</p>
                          <p style={{fontSize:11,color:'#7A919E',margin:'2px 0 0'}}>Venc.: {fmtData(p.data_vencimento)}{p.data_pagamento&&` · Pago: ${fmtData(p.data_pagamento)}`}</p>
                        </div>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          {p.pago?(
                            <><span style={{fontSize:12,color:'#27AE60',fontWeight:600}}>✓ Pago</span>
                            <button onClick={()=>handleEstornar(p.id!,detalhe.id)} disabled={!!acao} style={{fontSize:11,color:'#7A919E',background:'none',border:'none',cursor:'pointer',textDecoration:'underline'}}>Estornar</button></>
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
              {role==='gestora'&&<button onClick={()=>handleExcluir(detalhe.id)} style={{...s.btnRed,padding:'.5rem 1rem',fontSize:13}}>🗑 Excluir</button>}
            </div>
          </div>
        </div>
      )}

      {/* MODAL NOVO ORÇAMENTO */}
      {modal&&!detalhe&&(
        <div style={s.overlay} onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div style={s.modal}>
            <div style={s.mhdr}>
              <h3 style={{fontSize:15,fontWeight:700}}>Novo Orçamento</h3>
              <button onClick={()=>setModal(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#7A919E',fontSize:20}}>×</button>
            </div>
            <div style={s.fg}>
              {/* IA IMPORT */}
              <div style={{gridColumn:'1/-1',padding:'14px 16px',background:'linear-gradient(135deg,#E0F5F7,#EAF3FD)',borderRadius:10,border:'1.5px dashed #0097A8'}}>
                <p style={{fontSize:11,fontWeight:700,color:'#0097A8',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:8}}>🤖 Importar orçamento com IA</p>
                <p style={{fontSize:12,color:'#1A2B38',marginBottom:10}}>Suba o PDF do orçamento e a IA extrai empresa, CNPJ, todos os itens e valor do frete automaticamente.</p>
                <input ref={orcIARef} type="file" accept="application/pdf,image/*" style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0];if(f)handleImportarOrcamento(f)}}/>
                <button onClick={()=>orcIARef.current?.click()} disabled={loadingIA} style={{...s.btnTeal,opacity:loadingIA?0.6:1,width:'100%',justifyContent:'center'}}>
                  {loadingIA?'🔄 Lendo orçamento...':'📄 Selecionar PDF do orçamento'}
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
                <p style={{fontSize:10,fontWeight:600,color:'#7A919E',textTransform:'uppercase',marginBottom:4}}>Total do orçamento</p>
                <p style={{fontSize:20,fontWeight:700,color:'#0097A8'}}>
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

      {/* MODAL FORMA DE PAGAMENTO */}
      {modalFormaPgto&&(
        <div style={s.overlay} onClick={e=>e.target===e.currentTarget&&setModalFormaPgto(false)}>
          <div style={{...s.modal,width:440}}>
            <div style={s.mhdr}>
              <h3 style={{fontSize:15,fontWeight:700}}>💰 Registrar Pagamento</h3>
              <button onClick={()=>setModalFormaPgto(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#7A919E',fontSize:20}}>×</button>
            </div>
            <div style={{padding:'1.5rem',display:'grid',gap:14}}>
              <div>
                <label style={s.lb}>Forma de pagamento *</label>
                <select style={s.fi} value={formaPgtoTipo} onChange={e=>setFormaPgtoTipo(e.target.value)}>
                  <option value="pix">PIX</option>
                  <option value="transferencia">Transferência bancária</option>
                  <option value="boleto">Boleto</option>
                  <option value="cartao">Cartão</option>
                  <option value="avista">À vista (dinheiro)</option>
                  <option value="parcelado">Parcelado</option>
                </select>
              </div>
              {formaPgtoTipo==='parcelado'&&(
                <div>
                  <label style={s.lb}>Número de parcelas *</label>
                  <input type="number" min={2} max={48} style={s.fi} value={formaPgtoParc} onChange={e=>setFormaPgtoParc(e.target.value)} placeholder="Ex: 3"/>
                </div>
              )}
              <div>
                <label style={s.lb}>Data do pagamento *</label>
                <input type="date" style={s.fi} value={formaPgtoData} onChange={e=>setFormaPgtoData(e.target.value)}/>
              </div>
              <div>
                <label style={s.lb}>Observações</label>
                <input style={s.fi} value={formaPgtoObs} onChange={e=>setFormaPgtoObs(e.target.value)} placeholder="Ex: 30/60/90 dias"/>
              </div>
            </div>
            <div style={s.mfoot}>
              <button onClick={()=>setModalFormaPgto(false)} style={{...s.btnOut,padding:'.5rem 1rem',fontSize:13}}>Cancelar</button>
              <button onClick={handleConfirmarFormaPgto} disabled={saving||!formaPgtoData} style={{...s.btnTeal,opacity:(saving||!formaPgtoData)?0.6:1}}>{saving?'Salvando...':'Confirmar pagamento'}</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ENTREGA PROGRAMADA */}
      {modalEntregaProg&&(
        <div style={s.overlay} onClick={e=>e.target===e.currentTarget&&setModalEntregaProg(false)}>
          <div style={{...s.modal,width:480}}>
            <div style={s.mhdr}>
              <h3 style={{fontSize:15,fontWeight:700}}>📅 Programar Entrega</h3>
              <button onClick={()=>setModalEntregaProg(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#7A919E',fontSize:20}}>×</button>
            </div>
            <div style={{padding:'1.5rem',display:'grid',gap:14}}>
              <div>
                <label style={s.lb}>Tipo de entrega *</label>
                <select style={s.fi} value={entregaTipo} onChange={e=>setEntregaTipo(e.target.value)}>
                  <option value="corridos">Dias corridos</option>
                  <option value="uteis">Dias úteis</option>
                  <option value="parcial">Entrega parcial (duas datas)</option>
                </select>
              </div>

              {entregaTipo!=='parcial'?(
                <div>
                  <label style={s.lb}>Número de dias *</label>
                  <input type="number" min={1} style={s.fi} value={diasEntrega} placeholder="Ex: 30" onChange={e=>setDiasEntrega(e.target.value)}/>
                  {diasEntrega&&(
                    <p style={{fontSize:12,color:'#8E44AD',marginTop:8,fontWeight:600}}>
                      📅 Previsão: {fmtData(entregaTipo==='uteis'?addDiasUteis(parseInt(diasEntrega)):addDiasCorridos(parseInt(diasEntrega)))}
                    </p>
                  )}
                </div>
              ):(
                <>
                  <div>
                    <label style={s.lb}>Data da 1ª entrega *</label>
                    <input type="date" style={s.fi} value={entregaData1} onChange={e=>setEntregaData1(e.target.value)}/>
                  </div>
                  <div>
                    <label style={s.lb}>Itens da 1ª entrega</label>
                    <textarea style={{...s.fi,minHeight:60,resize:'vertical' as const}} value={entregaItens1} onChange={e=>setEntregaItens1(e.target.value)} placeholder="Ex: 50% dos produtos, cimento e areia"/>
                  </div>
                  <div>
                    <label style={s.lb}>Data da 2ª entrega *</label>
                    <input type="date" style={s.fi} value={entregaData2State} onChange={e=>setEntregaData2State(e.target.value)}/>
                  </div>
                  <div>
                    <label style={s.lb}>Itens da 2ª entrega</label>
                    <textarea style={{...s.fi,minHeight:60,resize:'vertical' as const}} value={entregaItens2} onChange={e=>setEntregaItens2(e.target.value)} placeholder="Ex: Restante dos produtos, tijolos"/>
                  </div>
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

      {/* MODAL ITENS NF */}
      {modalNFItens&&(
        <div style={s.overlay} onClick={e=>e.target===e.currentTarget&&setModalNFItens(false)}>
          <div style={{...s.modal,width:700}}>
            <div style={s.mhdr}>
              <h3 style={{fontSize:15,fontWeight:700}}>🧾 Itens da Nota Fiscal</h3>
              <button onClick={()=>setModalNFItens(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#7A919E',fontSize:20}}>×</button>
            </div>
            <div style={{padding:'1.25rem 1.5rem'}}>
              <p style={{fontSize:12,color:'#7A919E',marginBottom:16}}>Revise os itens extraídos pela IA. Você pode editar antes de salvar.</p>
              <ItensEditor itens={itensNFEditor} onChange={setItensNFEditor}/>
            </div>
            <div style={s.mfoot}>
              <button onClick={()=>setModalNFItens(false)} style={{...s.btnOut,padding:'.5rem 1rem',fontSize:13}}>Cancelar</button>
              <button onClick={handleSalvarNF} disabled={loadingAnexo} style={{...s.btnTeal,opacity:loadingAnexo?0.6:1}}>{loadingAnexo?'Salvando...':'Salvar NF e itens'}</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONTAS MENSAIS */}
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

      {/* MODAL GERAR MENSAL */}
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

      {toast&&(
        <div style={{position:'fixed',bottom:20,right:20,padding:'.75rem 1.25rem',borderRadius:10,fontSize:13,fontWeight:500,color:'#fff',background:toast.ok?'#27AE60':'#E74C3C',boxShadow:'0 4px 16px rgba(0,0,0,.2)',zIndex:100}}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}