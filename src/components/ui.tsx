'use client'
import { useState, useRef } from 'react'
import Icon from './Icon'
import { s, ACCENT_LT, STEP_ICONS, PIPE_COLORS } from '../lib/theme'
import { api, Fornecedor, ItemLancamento, fmtR, fmtCNPJ, PIPELINE } from '../services/api'

export function KPI({l,v,sv,c}:{l:string;v:string|number;sv?:string;c:string}) {
  return (
    <div style={s.kpi}>
      <div style={{position:'absolute',top:0,left:0,right:0,height:3,borderRadius:'10px 10px 0 0',background:c}}/>
      <p style={{fontSize:10,fontWeight:600,color:'#818885',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:6}}>{l}</p>
      <p style={{fontSize:22,fontWeight:700,color:'#606463',lineHeight:1.1}}>{v}</p>
      {sv&&<p style={{fontSize:11,color:'#818885',marginTop:4}}>{sv}</p>}
    </div>
  )
}

export function Badge({label,bg,color}:{label:string;bg:string;color:string}) {
  return <span style={{...s.badge,background:bg,color}}>{label}</span>
}

export function StepBadge({stepId,label,color}:{stepId:string;label:string;color:string}) {
  return (
    <span style={{...s.badge,background:`${color}18`,color}}>
      <Icon name={STEP_ICONS[stepId]} size={12} color={color}/>
      {label}
    </span>
  )
}

export function FF({lb:label,children,full}:{lb:string;children:React.ReactNode;full?:boolean}) {
  return <div style={full?{gridColumn:'1/-1'}:{}}><label style={s.lb}>{label}</label>{children}</div>
}

export function AnexoBtn({url,label,icon,onAnexar,onSubstituir,loading}:{url?:string|null;label:string;icon:string;onAnexar:()=>void;onSubstituir:()=>void;loading:boolean}) {
  if (url) return (
    <div style={{display:'flex',alignItems:'center',gap:12}}>
      <a href={url} target="_blank" rel="noopener noreferrer" style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:13,color:ACCENT_LT,textDecoration:'none',fontWeight:600}}><Icon name={icon} size={15}/> Ver {label}</a>
      <button onClick={onSubstituir} disabled={loading} style={{...s.btnOut,padding:'3px 10px',fontSize:11}}>{loading?'Enviando...':'Substituir'}</button>
    </div>
  )
  return (
    <div style={{display:'flex',alignItems:'center',gap:12}}>
      <span style={{fontSize:12,color:'#818885'}}>Sem {label} anexada</span>
      <button onClick={onAnexar} disabled={loading} style={{...s.btnTeal,padding:'6px 14px',fontSize:12,opacity:loading?0.6:1}}><Icon name={icon} size={14} color="#fff"/> {loading?'Enviando...':`Anexar ${label}`}</button>
    </div>
  )
}

export function FornecedorInput({value,cnpj,onChange}:{value:string;cnpj:string;onChange:(n:string,c:string)=>void}) {
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
        <div style={{position:'absolute',top:'100%',left:0,right:0,background:'#fff',border:'1.5px solid #E1E7E3',borderRadius:8,zIndex:100,boxShadow:'0 4px 16px rgba(0,0,0,.1)',maxHeight:200,overflowY:'auto'}}>
          {sugestoes.map(f=>(
            <div key={f.id} onClick={()=>{onChange(f.nome,f.cnpj||'');setAberto(false)}}
              style={{padding:'8px 12px',cursor:'pointer',borderBottom:'1px solid #F2F6F8'}}
              onMouseEnter={e=>(e.currentTarget.style.background='#ECF2EF')}
              onMouseLeave={e=>(e.currentTarget.style.background='')}>
              <p style={{margin:0,fontSize:13,fontWeight:600}}>{f.nome}</p>
              {f.cnpj&&<p style={{margin:0,fontSize:11,color:'#818885'}}>{fmtCNPJ(f.cnpj)}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function ItensEditor({itens,onChange}:{itens:ItemLancamento[];onChange:(i:ItemLancamento[])=>void}) {
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
    <div style={{gridColumn:'1/-1',border:'1.5px solid #E1E7E3',borderRadius:8,overflow:'hidden'}}>
      <div style={{background:'#FBFCFB',padding:'8px 12px',borderBottom:'1px solid #E1E7E3',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <span style={{fontSize:10,fontWeight:700,color:'#818885',textTransform:'uppercase',letterSpacing:'.05em'}}>Itens do orçamento ({itens.length}) — opcional</span>
        <button onClick={add} type="button" style={{...s.btnTeal,padding:'3px 10px',fontSize:11}}><Icon name="plus" size={12} color="#fff"/> Item</button>
      </div>
      {itens.length===0&&<p style={{padding:'12px',fontSize:12,color:'#818885',margin:0}}>Nenhum item adicionado. Você pode salvar só com o valor do frete, ou adicionar um item.</p>}
      {itens.map((item,i)=>(
        <div key={i} style={{display:'grid',gridTemplateColumns:'1fr 70px 110px 110px 24px',gap:8,padding:'8px 12px',borderBottom:'1px solid #E1E7E3',alignItems:'end'}}>
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
            <input style={{...s.fi,fontSize:12,background:'#F6F8F7',color:'#7F9C93',fontWeight:700}} value={fmtR(item.valor_total||0)} readOnly/>
          </div>
          <button onClick={()=>rem(i)} type="button" style={{background:'none',border:'none',cursor:'pointer',color:'#777B79',padding:0,display:'flex'}}><Icon name="x" size={16}/></button>
        </div>
      ))}
      {itens.length>0&&(
        <div style={{padding:'8px 12px',background:'#F6F8F7',display:'flex',justifyContent:'flex-end'}}>
          <span style={{fontSize:13,fontWeight:700,color:'#7F9C93'}}>Total: {fmtR(total)}</span>
        </div>
      )}
    </div>
  )
}

export function PipelineStepper({atual,onChange}:{atual:string;onChange:(id:string)=>void}) {
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
                  background:done?'#7F9C93':current?cor:'#E1E7E3',
                  display:'flex',alignItems:'center',justifyContent:'center',
                  boxShadow:current?`0 0 0 3px ${cor}33`:'none',transition:'all .2s',
                }}>
                  {done?<Icon name="check" size={16} color="#fff"/>:<Icon name={STEP_ICONS[step.id]} size={16} color={current?'#fff':'#818885'}/>}
                </button>
                <span style={{fontSize:9,fontWeight:600,color:current?cor:done?'#7F9C93':'#818885',textAlign:'center',maxWidth:70,lineHeight:1.2}}>{step.label}</span>
              </div>
              {i<PIPELINE.length-1&&<div style={{flex:1,height:2,background:i<idx?'#7F9C93':'#E1E7E3',margin:'0 4px',marginBottom:20}}/>}
            </div>
          )
        })}
      </div>
    </div>
  )
}