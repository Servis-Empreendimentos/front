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

const SIDEBAR_BG  = '#0B1420'
const SIDEBAR_BG2 = '#141F2C'
const ACCENT      = '#0E7C86'
const ACCENT_LT   = '#0097A8'

const s = {
  page:    { minHeight:'100vh', display:'flex', fontFamily:"'DM Sans',sans-serif", background:'#F5F7FA', color:'#0F172A' },
  sidebar: { width:250, minWidth:250, background:SIDEBAR_BG, display:'flex', flexDirection:'column' as const, position:'sticky' as const, top:0, height:'100vh', overflowY:'auto' as const, zIndex:40 },
  content: { flex:1, display:'flex', flexDirection:'column' as const, minWidth:0 },
  main:    { flex:1, padding:'1.5rem' },
  row:     { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.25rem' },
  h1:      { fontSize:20, fontWeight:600, color:'#0F172A' },
  p:       { fontSize:12, color:'#64748B', marginTop:2 },
  btnTeal: { display:'flex', alignItems:'center', gap:8, background:ACCENT, color:'#fff', border:'none', padding:'.5rem 1rem', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' },
  btnOut:  { display:'flex', alignItems:'center', gap:6, background:'transparent', color:'#0F172A', border:'1.5px solid #E2E8F0', padding:'.4rem .8rem', borderRadius:7, fontSize:12, fontWeight:600, cursor:'pointer' },
  btnGrn:  { display:'flex', alignItems:'center', gap:6, background:'#16A34A', color:'#fff', border:'none', padding:'.5rem 1rem', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' },
  btnRed:  { display:'flex', alignItems:'center', gap:6, background:'transparent', color:'#DC2626', border:'1.5px solid #FEE2E2', padding:'.4rem .8rem', borderRadius:7, fontSize:12, fontWeight:600, cursor:'pointer' },
  kpi:     { background:'#fff', border:'1px solid #E2E8F0', borderRadius:10, padding:'1rem', position:'relative' as const, overflow:'hidden', boxShadow:'0 1px 2px rgba(15,23,42,.04)' },
  card:    { background:'#fff', border:'1px solid #E2E8F0', borderRadius:10, overflow:'hidden', boxShadow:'0 1px 2px rgba(15,23,42,.04)', marginBottom:'1.25rem' },
  toolbar: { display:'flex', alignItems:'center', gap:8, padding:'.8rem 1.1rem', borderBottom:'1px solid #E2E8F0', background:'#FAFBFC', flexWrap:'wrap' as const },
  badge:   { display:'inline-flex', alignItems:'center', gap:4, padding:'3px 9px', borderRadius:20, fontSize:11, fontWeight:600, whiteSpace:'nowrap' as const },
  inp:     { border:'1.5px solid #E2E8F0', borderRadius:7, padding:'5px 10px', fontSize:12, fontFamily:'inherit', outline:'none', background:'#fff', color:'#0F172A' },
  overlay: { position:'fixed' as const, inset:0, background:'rgba(15,23,42,.45)', zIndex:50, display:'flex', alignItems:'flex-start', justifyContent:'center', paddingTop:40 },
  modal:   { background:'#fff', borderRadius:14, width:760, maxWidth:'95vw', maxHeight:'92vh', overflowY:'auto' as const, boxShadow:'0 20px 60px rgba(0,0,0,.2)' },
  mhdr:    { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'1rem 1.5rem', borderBottom:'1px solid #E2E8F0', position:'sticky' as const, top:0, background:'#fff', zIndex:1 },
  mfoot:   { display:'flex', gap:8, justifyContent:'flex-end', padding:'1rem 1.5rem', borderTop:'1px solid #E2E8F0', background:'#FAFBFC', position:'sticky' as const, bottom:0 },
  fg:      { display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px 14px', padding:'1.25rem 1.5rem' },
  fi:      { width:'100%', border:'1.5px solid #E2E8F0', borderRadius:8, padding:'7px 10px', fontSize:13, fontFamily:'inherit', color:'#0F172A', outline:'none', boxSizing:'border-box' as const },
  lb:      { display:'block', fontSize:10, fontWeight:600, color:'#64748B', textTransform:'uppercase' as const, letterSpacing:'.05em', marginBottom:4 },
  footer:  { background:'#fff', borderTop:'1px solid #E2E8F0', padding:'.65rem 1.5rem', display:'flex', justifyContent:'space-between', alignItems:'center' },
}

const PIPE_COLORS: Record<string,string> = {
  orcamento_aprovado:'#64748B', em_tratativa:'#D97706', orcamento_fechado:'#2563EB',
  pagamento_realizado:'#16A34A', entrega_programada:'#7C3AED', mercadoria_recebida:ACCENT_LT, nf_recebida:'#0F172A',
}

const STEP_ICONS: Record<string,string> = {
  orcamento_aprovado:'fileText', em_tratativa:'users', orcamento_fechado:'checkCircle',
  pagamento_realizado:'dollar', entrega_programada:'calendar', mercadoria_recebida:'package', nf_recebida:'receipt',
}

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

function Icon({name,size=18,color='currentColor',strokeWidth=1.8}:{name:string;size?:number;color?:string;strokeWidth?:number}) {
  const common = { width:size, height:size, viewBox:'0 0 24 24', fill:'none', stroke:color, strokeWidth, strokeLinecap:'round' as const, strokeLinejoin:'round' as const }
  switch(name) {
    case 'dashboard': return <svg {...common}><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>
    case 'plus': return <svg {...common}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
    case 'fileText': return <svg {...common}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>
    case 'building': return <svg {...common}><rect x="4" y="3" width="16" height="18" rx="1"/><line x1="8" y1="7" x2="8.01" y2="7"/><line x1="12" y1="7" x2="12.01" y2="7"/><line x1="16" y1="7" x2="16.01" y2="7"/><line x1="8" y1="11" x2="8.01" y2="11"/><line x1="12" y1="11" x2="12.01" y2="11"/><line x1="16" y1="11" x2="16.01" y2="11"/><path d="M9 21v-4h6v4"/></svg>
    case 'refresh': return <svg {...common}><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
    case 'logout': return <svg {...common}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
    case 'truck': return <svg {...common}><rect x="1" y="6" width="14" height="11" rx="1"/><path d="M15 9h4l3 3v5h-7z"/><circle cx="6" cy="19" r="2"/><circle cx="17.5" cy="19" r="2"/></svg>
    case 'clipboard': return <svg {...common}><rect x="6" y="3" width="12" height="18" rx="2"/><rect x="9" y="1.3" width="6" height="3" rx="1"/><line x1="9" y1="10" x2="15" y2="10"/><line x1="9" y1="14" x2="15" y2="14"/></svg>
    case 'users': return <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
    case 'checkCircle': return <svg {...common}><circle cx="12" cy="12" r="9"/><polyline points="8 12 11 15 16 9"/></svg>
    case 'dollar': return <svg {...common}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
    case 'calendar': return <svg {...common}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
    case 'package': return <svg {...common}><path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><polyline points="3.3 8 12 13 20.7 8"/><line x1="12" y1="22" x2="12" y2="13"/></svg>
    case 'receipt': return <svg {...common}><path d="M4 2h16v20l-2-1.5L16 22l-2-1.5L12 22l-2-1.5L8 22l-2-1.5L4 22z"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="16" y2="11"/></svg>
    case 'lock': return <svg {...common}><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
    case 'alert': return <svg {...common}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
    case 'edit': return <svg {...common}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>
    case 'trash': return <svg {...common}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
    case 'x': return <svg {...common}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    case 'upload': return <svg {...common}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
    case 'search': return <svg {...common}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
    case 'check': return <svg {...common}><polyline points="20 6 9 17 4 12"/></svg>
    case 'sparkles': return <svg {...common}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/></svg>
    default: return null
  }
}

function KPI({l,v,sv,c}:{l:string;v:string|number;sv?:string;c:string}) {
  return (
    <div style={s.kpi}>
      <div style={{position:'absolute',top:0,left:0,right:0,height:3,borderRadius:'10px 10px 0 0',background:c}}/>
      <p style={{fontSize:10,fontWeight:600,color:'#64748B',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:6}}>{l}</p>
      <p style={{fontSize:22,fontWeight:700,color:'#0F172A',lineHeight:1.1}}>{v}</p>
      {sv&&<p style={{fontSize:11,color:'#64748B',marginTop:4}}>{sv}</p>}
    </div>
  )
}

function Badge({label,bg,color}:{label:string;bg:string;color:string}) {
  return <span style={{...s.badge,background:bg,color}}>{label}</span>
}

function StepBadge({stepId,label,color}:{stepId:string;label:string;color:string}) {
  return (
    <span style={{...s.badge,background:`${color}18`,color}}>
      <Icon name={STEP_ICONS[stepId]} size={12} color={color}/>
      {label}
    </span>
  )
}

function FF({lb:label,children,full}:{lb:string;children:React.ReactNode;full?:boolean}) {
  return <div style={full?{gridColumn:'1/-1'}:{}}><label style={s.lb}>{label}</label>{children}</div>
}

function AnexoBtn({url,label,icon,onAnexar,onSubstituir,loading}:{url?:string|null;label:string;icon:string;onAnexar:()=>void;onSubstituir:()=>void;loading:boolean}) {
  if (url) return (
    <div style={{display:'flex',alignItems:'center',gap:12}}>
      <a href={url} target="_blank" rel="noopener noreferrer" style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:13,color:ACCENT_LT,textDecoration:'none',fontWeight:600}}><Icon name={icon} size={15}/> Ver {label}</a>
      <button onClick={onSubstituir} disabled={loading} style={{...s.btnOut,padding:'3px 10px',fontSize:11}}>{loading?'Enviando...':'Substituir'}</button>
    </div>
  )
  return (
    <div style={{display:'flex',alignItems:'center',gap:12}}>
      <span style={{fontSize:12,color:'#64748B'}}>Sem {label} anexada</span>
      <button onClick={onAnexar} disabled={loading} style={{...s.btnTeal,padding:'6px 14px',fontSize:12,opacity:loading?0.6:1}}><Icon name={icon} size={14} color="#fff"/> {loading?'Enviando...':`Anexar ${label}`}</button>
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
      <input style={s.fi} value={value} placeholder="Digite o nome ou CNPJ..."
        onChange={e=>{onChange(e.target.value,cnpj);buscar(e.target.value)}}
        onFocus={()=>{if(value.length>=2)buscar(value)}}
        onBlur={()=>setTimeout(()=>setAberto(false),200)}/>
      {aberto&&(
        <div style={{position:'absolute',top:'100%',left:0,right:0,background:'#fff',border:'1.5px solid #E2E8F0',borderRadius:8,zIndex:100,boxShadow:'0 4px 16px rgba(0,0,0,.1)',maxHeight:200,overflowY:'auto'}}>
          {sugestoes.map(f=>(
            <div key={f.id} onClick={()=>{onChange(f.nome,f.cnpj||'');setAberto(false)}}
              style={{padding:'8px 12px',cursor:'pointer',borderBottom:'1px solid #F2F6F8'}}
              onMouseEnter={e=>(e.currentTarget.style.background='#F0F7F9')}
              onMouseLeave={e=>(e.currentTarget.style.background='')}>
              <p style={{margin:0,fontSize:13,fontWeight:600}}>{f.nome}</p>
              {f.cnpj&&<p style={{margin:0,fontSize:11,color:'#64748B'}}>{fmtCNPJ(f.cnpj)}</p>}
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
    <div style={{gridColumn:'1/-1',border:'1.5px solid #E2E8F0',borderRadius:8,overflow:'hidden'}}>
      <div style={{background:'#FAFBFC',padding:'8px 12px',borderBottom:'1px solid #E2E8F0',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <span style={{fontSize:10,fontWeight:700,color:'#64748B',textTransform:'uppercase',letterSpacing:'.05em'}}>Itens do orçamento ({itens.length}) — opcional</span>
        <button onClick={add} type="button" style={{...s.btnTeal,padding:'3px 10px',fontSize:11}}><Icon name="plus" size={12} color="#fff"/> Item</button>
      </div>
      {itens.length===0&&<p style={{padding:'12px',fontSize:12,color:'#64748B',margin:0}}>Nenhum item adicionado. Você pode salvar só com o valor do frete, ou adicionar um item.</p>}
      {itens.map((item,i)=>(
        <div key={i} style={{display:'grid',gridTemplateColumns:'1fr 70px 110px 110px 24px',gap:8,padding:'8px 12px',borderBottom:'1px solid #E2E8F0',alignItems:'end'}}>
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
            <input style={{...s.fi,fontSize:12,background:'#F9FAFB',color:'#16A34A',fontWeight:700}} value={fmtR(item.valor_total||0)} readOnly/>
          </div>
          <button onClick={()=>rem(i)} type="button" style={{background:'none',border:'none',cursor:'pointer',color:'#DC2626',padding:0,display:'flex'}}><Icon name="x" size={16}/></button>
        </div>
      ))}
      {itens.length>0&&(
        <div style={{padding:'8px 12px',background:'#F9FAFB',display:'flex',justifyContent:'flex-end'}}>
          <span style={{fontSize:13,fontWeight:700,color:'#16A34A'}}>Total: {fmtR(total)}</span>
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
                  background:done?'#16A34A':current?cor:'#E2E8F0',
                  display:'flex',alignItems:'center',justifyContent:'center',
                  boxShadow:current?`0 0 0 3px ${cor}33`:'none',transition:'all .2s',
                }}>
                  {done?<Icon name="check" size={16} color="#fff"/>:<Icon name={STEP_ICONS[step.id]} size={16} color={current?'#fff':'#64748B'}/>}
                </button>
                <span style={{fontSize:9,fontWeight:600,color:current?cor:done?'#16A34A':'#64748B',textAlign:'center',maxWidth:70,lineHeight:1.2}}>{step.label}</span>
              </div>
              {i<PIPELINE.length-1&&<div style={{flex:1,height:2,background:i<idx?'#16A34A':'#E2E8F0',margin:'0 4px',marginBottom:20}}/>}
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
    <div style={{minHeight:'100vh',background:'#F5F7FA',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'DM Sans',sans-serif"}}>
      <div style={{background:'#fff',borderRadius:16,padding:'2.5rem 2rem',width:360,boxShadow:'0 8px 40px rgba(15,23,42,.1)',display:'flex',flexDirection:'column',alignItems:'center',gap:20}}>
        <div style={{textAlign:'center'}}>
          <img src="/logo.jpg" alt="Servis" style={{height:90,objectFit:'contain',marginBottom:12}} onError={e=>(e.currentTarget.style.display='none')}/>
          <h2 style={{fontSize:18,fontWeight:700,color:'#0F172A',margin:0}}>Servis - Conciliação Financeira</h2>
          <p style={{fontSize:12,color:'#64748B',marginTop:4}}>Acesso interno</p>
        </div>
        <div style={{width:'100%',display:'flex',flexDirection:'column',gap:12}}>
          <div><label style={s.lb}>Usuário</label><input style={{...s.fi,fontSize:14}} placeholder="Digite seu usuário" value={login} onChange={e=>setLogin(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleLogin()}/></div>
          <div><label style={s.lb}>Senha</label><input type="password" style={{...s.fi,fontSize:14}} placeholder="Digite sua senha" value={senha} onChange={e=>setSenha(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleLogin()}/></div>
          {erro&&<p style={{fontSize:12,color:'#DC2626',textAlign:'center',margin:0}}>{erro}</p>}
          <button onClick={handleLogin} style={{...s.btnTeal,justifyContent:'center',width:'100%',padding:'.75rem',fontSize:14,borderRadius:9,marginTop:4}}>Entrar</button>
        </div>
      </div>
    </div>
  )
}

function NavItem({icon,label,active,onClick}:{icon:string;label:string;active:boolean;onClick:()=>void}) {
  return (
    <button onClick={onClick} style={{
      display:'flex',alignItems:'center',gap:11,width:'100%',textAlign:'left',
      padding:'.6rem .9rem',borderRadius:8,border:'none',cursor:'pointer',
      background:active?ACCENT:'transparent',color:active?'#fff':'#94A3B8',
      fontSize:13,fontWeight:600,fontFamily:'inherit',marginBottom:2,
      transition:'background .15s',
    }}
    onMouseEnter={e=>{if(!active)e.currentTarget.style.background=SIDEBAR_BG2}}
    onMouseLeave={e=>{if(!active)e.currentTarget.style.background='transparent'}}
    >
      <Icon name={icon} size={16} color={active?'#fff':'#94A3B8'}/>
      {label}
    </button>
  )
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

      {/* SIDEBAR */}
      <aside style={s.sidebar}>
        <div style={{padding:'1.25rem 1.1rem .5rem'}}>
          <img src="/logo.jpg" alt="Servis" style={{height:34,objectFit:'contain',marginBottom:14,filter:'brightness(0) invert(1)'}} onError={e=>(e.currentTarget.style.display='none')}/>
          <p style={{fontSize:9,fontWeight:700,color:'#475569',textTransform:'uppercase',letterSpacing:'.08em',margin:'0 0 4px'}}>Sessão ativa</p>
          <p style={{fontSize:15,fontWeight:700,color:'#fff',margin:0}}>{user}</p>
          <span style={{...s.badge,background:role==='gestora'?'#0D3B2E':role==='entregador'?'#3B2A0D':'#0D2E3B',color:role==='gestora'?'#4ADE80':role==='entregador'?'#F5A623':'#4FC3D9',marginTop:6}}>
            {role==='gestora'?'Gestora':role==='entregador'?'Conferente de obra':'Lançadora'}
          </span>
        </div>

        <div style={{height:1,background:'#1E2A38',margin:'.75rem 0'}}/>

        <div style={{padding:'0 .9rem',flex:1}}>
          <p style={{fontSize:9,fontWeight:700,color:'#475569',textTransform:'uppercase',letterSpacing:'.08em',margin:'.5rem 0 .6rem .5rem'}}>Navegação</p>

          {role==='entregador'?(
            <NavItem icon="truck" label="Entregas" active={true} onClick={()=>{}}/>
          ):(
            <>
              <NavItem icon="dashboard" label="Visão Geral" active={aba==='visao'} onClick={()=>setAba('visao')}/>
              <NavItem icon="plus" label="Novo Orçamento" active={false} onClick={openNovo}/>
              <NavItem icon="fileText" label="Lançamentos" active={aba==='lancamentos'} onClick={()=>setAba('lancamentos')}/>
              <NavItem icon="building" label="Fornecedores" active={aba==='fornecedores'} onClick={()=>setAba('fornecedores')}/>
              <NavItem icon="refresh" label="Contas Mensais" active={aba==='mensais'} onClick={()=>setAba('mensais')}/>
            </>
          )}
        </div>

        <div style={{padding:'.9rem',borderTop:'1px solid #1E2A38'}}>
          <button onClick={()=>setLogado(false)} style={{
            display:'flex',alignItems:'center',gap:11,width:'100%',textAlign:'left',
            padding:'.6rem .9rem',borderRadius:8,border:'none',cursor:'pointer',
            background:'transparent',color:'#F87171',fontSize:13,fontWeight:600,fontFamily:'inherit',
          }}
          onMouseEnter={e=>(e.currentTarget.style.background='#2A1416')}
          onMouseLeave={e=>(e.currentTarget.style.background='transparent')}
          >
            <Icon name="logout" size={16} color="#F87171"/> Sair
          </button>
        </div>
      </aside>

      {/* CONTEÚDO */}
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