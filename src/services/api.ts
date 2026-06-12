'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { api, Lancamento, Parcela, fmtR, fmtData } from '../services/api'

const USUARIOS: Record<string, { senha: string; nome: string; role: 'lancadora' | 'gestora' }> = {
  'anne':   { senha: 'anne123',   nome: 'Anne',   role: 'lancadora' },
  'mayara': { senha: 'mayara123', nome: 'Mayara', role: 'lancadora' },
  'edna':   { senha: 'edna123',   nome: 'Edna',   role: 'lancadora' },
  'erick':  { senha: 'erick123',  nome: 'Erick',  role: 'lancadora' },
  'clau':   { senha: 'clau123',   nome: 'Clau',   role: 'gestora'   },
}

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
  kpi:     { background:'#fff', border:'1px solid #DDE5EA', borderRadius:10, padding:'1rem', position:'relative' as const, overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,.04)' },
  card:    { background:'#fff', border:'1px solid #DDE5EA', borderRadius:10, overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,.04)', marginBottom:'1.25rem' },
  toolbar: { display:'flex', alignItems:'center', gap:8, padding:'.8rem 1.1rem', borderBottom:'1px solid #DDE5EA', background:'#FAFCFD', flexWrap:'wrap' as const },
  badge:   { display:'inline-flex', alignItems:'center', padding:'2px 9px', borderRadius:20, fontSize:11, fontWeight:600, whiteSpace:'nowrap' as const },
  inp:     { border:'1.5px solid #DDE5EA', borderRadius:7, padding:'5px 10px', fontSize:12, fontFamily:'inherit', outline:'none', background:'#fff', color:'#1A2B38' },
  overlay: { position:'fixed' as const, inset:0, background:'rgba(0,0,0,.4)', zIndex:50, display:'flex', alignItems:'flex-start', justifyContent:'center', paddingTop:56 },
  modal:   { background:'#fff', borderRadius:14, width:700, maxWidth:'95vw', maxHeight:'90vh', overflowY:'auto' as const, boxShadow:'0 20px 60px rgba(0,0,0,.2)' },
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

function FF({lb:label,children}:{lb:string;children:React.ReactNode}) {
  return <div><label style={s.lb}>{label}</label>{children}</div>
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
  const [data,setData]=useState<Lancamento[]>([]); const [cats,setCats]=useState<any[]>([])
  const [loading,setLoading]=useState(true); const [fStatus,setFStatus]=useState(''); const [fTipo,setFTipo]=useState(''); const [fCat,setFCat]=useState('')
  const [search,setSearch]=useState(''); const [modal,setModal]=useState(false); const [detalhe,setDetalhe]=useState<Lancamento|null>(null)
  const [saving,setSaving]=useState(false); const [acao,setAcao]=useState(''); const [toast,setToast]=useState<{msg:string;ok:boolean}|null>(null)
  const [form,setForm]=useState<any>({}); const [parcelas,setParcelas]=useState<Parcela[]>([])
  const [arquivo,setArquivo]=useState<File|null>(null)
  const fileRef=useRef<HTMLInputElement>(null)

  const showToast=(msg:string,ok=true)=>{setToast({msg,ok});setTimeout(()=>setToast(null),3000)}
  const set=(k:string,v:any)=>setForm((p:any)=>({...p,[k]:v}))

  const load=useCallback(async()=>{
    setLoading(true)
    try {
      const [lista,categorias]=await Promise.all([api.listar({status_entrega:fStatus,tipo_pagamento:fTipo,categoria_id:fCat}),api.categorias()])
      setData(lista);setCats(categorias)
    } catch {showToast('Erro ao carregar dados',false)}
    finally {setLoading(false)}
  },[fStatus,fTipo,fCat])

  useEffect(()=>{if(logado)load()},[load,logado])

  const openNovo=()=>{setForm({tipo_pagamento:'avista',data:new Date().toISOString().slice(0,10)});setParcelas([]);setArquivo(null);setDetalhe(null);setModal(true)}
  const openDetalhe=async(id:string)=>{const d=await api.buscar(id);setDetalhe(d);setParcelas(d.parcelas||[]);setModal(true)}

  const handleSave=async()=>{
    if(!form.titulo||!form.valor_total||!form.data||!form.categoria_id||!form.pago_por) return showToast('Preencha todos os campos obrigatórios',false)
    setSaving(true)
    try {
      let arquivo_url = undefined
      if(arquivo) arquivo_url = await api.uploadPDF(arquivo)
      await api.criar({...form,valor_total:parseFloat(form.valor_total),criado_por:user,arquivo_url,parcelas})
      setModal(false);showToast('Lançamento salvo!');load()
    } catch {showToast('Erro ao salvar',false)}
    finally {setSaving(false)}
  }

  const handleEntrega=async(id:string)=>{
    setAcao(id)
    try {await api.confirmarEntrega(id);showToast('Entrega confirmada!');setModal(false);load()}
    catch {showToast('Erro',false)}
    finally {setAcao('')}
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

  if(!logado) return <LoginScreen onLogin={(nome,r)=>{setUser(nome);setRole(r);setLogado(true)}}/>

  const filtered=data.filter(l=>{
    if(!search) return true
    const q=search.toLowerCase()
    return [l.titulo,l.pago_por,l.criado_por,l.categoria_nome].some(f=>f?.toLowerCase().includes(q))
  })

  const totalValor=data.reduce((s,l)=>s+l.valor_total,0)
  const totalEntregue=data.filter(l=>l.status_entrega==='entregue').length
  const totalPendente=data.filter(l=>l.status_entrega==='pendente').length
  const totalPago=data.reduce((s,l)=>s+(l.parcelas||[]).filter(p=>p.pago).reduce((a,p)=>a+p.valor,0),0)
  const th=(label:string)=><th style={{padding:'8px 11px',textAlign:'left',fontSize:10,fontWeight:700,color:'#7A919E',textTransform:'uppercase',whiteSpace:'nowrap'}}>{label}</th>

  return (
    <div style={s.page}>
      <header style={s.topbar}>
        <img src="/logo.jpg" alt="Servis" style={{height:40,objectFit:'contain'}} onError={e=>(e.currentTarget.style.display='none')}/>
        <span style={{fontWeight:700,fontSize:15,color:'#0097A8'}}>Servis - Conciliação Financeira</span>
        <div style={{flex:1}}/>
        <div style={{display:'flex',alignItems:'center',gap:8,fontSize:12,color:'#7A919E'}}>
          <span>👤 {user}</span>
          <span style={{...s.badge,background:role==='gestora'?'#EAF7EE':'#E0F5F7',color:role==='gestora'?'#27AE60':'#0097A8'}}>{role==='gestora'?'Gestora':'Lançadora'}</span>
          <button onClick={()=>setLogado(false)} style={{...s.btnOut,padding:'3px 10px',fontSize:11,color:'#E74C3C',borderColor:'#FDECEA'}}>Sair</button>
        </div>
      </header>

      <main style={s.main}>
        <div style={s.row}>
          <div><h1 style={s.h1}>Lançamentos — Notas Fiscais</h1><p style={s.p}>Controle de pagamentos e entregas · Financeiro</p></div>
          {role==='lancadora'&&<button onClick={openNovo} style={s.btnTeal}>＋ Novo lançamento</button>}
        </div>

        <div style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:10,marginBottom:'1.25rem'}}>
          <KPI l="Total de lançamentos" v={data.length} sv={`${filtered.length} exibidos`} c="#0097A8"/>
          <KPI l="Valor total" v={fmtR(totalValor)} sv="soma dos registros" c="#E67E22"/>
          <KPI l="Entregas pendentes" v={totalPendente} sv="aguardando confirmação" c="#E74C3C"/>
          <KPI l="Já entregues" v={totalEntregue} sv={`${fmtR(totalPago)} pagos`} c="#27AE60"/>
        </div>

        <div style={s.card}>
          <div style={s.toolbar}>
            <span style={{fontSize:10,fontWeight:700,color:'#7A919E',textTransform:'uppercase',letterSpacing:'.1em',flex:1}}>Todos os lançamentos</span>
            <input style={{...s.inp,width:180}} placeholder="Buscar..." value={search} onChange={e=>setSearch(e.target.value)}/>
            <select style={s.inp} value={fStatus} onChange={e=>setFStatus(e.target.value)}>
              <option value="">Todas as entregas</option><option value="pendente">Pendente</option><option value="entregue">Entregue</option>
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
                  {th('Título')}{th('Categoria')}{th('Data')}{th('Valor total')}{th('Pago por')}{th('Tipo')}{th('Parcelas')}{th('NF')}{th('Entrega')}{th('Lançado por')}
                </tr>
              </thead>
              <tbody>
                {loading?<tr><td colSpan={10} style={{textAlign:'center',padding:'3rem',color:'#7A919E'}}>Carregando...</td></tr>
                :filtered.length===0?<tr><td colSpan={10} style={{textAlign:'center',padding:'3rem',color:'#7A919E'}}>Nenhum lançamento encontrado</td></tr>
                :filtered.map(l=>{
                  const parc=l.parcelas||[];const pagas=parc.filter(p=>p.pago).length
                  const st=ST[l.status_entrega];const tp=ST[l.tipo_pagamento]
                  return (
                    <tr key={l.id} onClick={()=>openDetalhe(l.id)} style={{borderBottom:'1px solid #DDE5EA',cursor:'pointer'}}
                      onMouseEnter={e=>(e.currentTarget.style.background='#F0F7F9')} onMouseLeave={e=>(e.currentTarget.style.background='')}>
                      <td style={{padding:'8px 11px',fontWeight:500,maxWidth:200,overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis'}}>{l.titulo}</td>
                      <td style={{padding:'8px 11px',color:'#7A919E',fontSize:11}}>{l.categoria_nome||'—'}</td>
                      <td style={{padding:'8px 11px',color:'#7A919E',whiteSpace:'nowrap'}}>{fmtData(l.data)}</td>
                      <td style={{padding:'8px 11px',fontWeight:700}}>{fmtR(l.valor_total)}</td>
                      <td style={{padding:'8px 11px',color:'#7A919E'}}>{l.pago_por}</td>
                      <td style={{padding:'8px 11px'}}><Badge label={l.tipo_pagamento==='avista'?'À vista':'Parcelado'} bg={tp.bg} color={tp.color}/></td>
                      <td style={{padding:'8px 11px',textAlign:'center'}}>
                        {parc.length>0?<span style={{background:'#E0F5F7',color:'#0097A8',borderRadius:6,padding:'2px 7px',fontWeight:600}}>{pagas}/{parc.length}</span>:<span style={{color:'#7A919E'}}>—</span>}
                      </td>
                      <td style={{padding:'8px 11px',textAlign:'center'}}>
                        {l.arquivo_url?<a href={l.arquivo_url} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} style={{fontSize:16}}>📄</a>:<span style={{color:'#DDE5EA'}}>—</span>}
                      </td>
                      <td style={{padding:'8px 11px'}}><Badge label={l.status_entrega==='entregue'?'✓ Entregue':'⏳ Pendente'} bg={st.bg} color={st.color}/></td>
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
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px 24px',marginBottom:20}}>
                  {[['Valor total',fmtR(detalhe.valor_total)],['Data',fmtData(detalhe.data)],['Categoria',detalhe.categoria_nome||'—'],['Pago por',detalhe.pago_por],
                    ['Tipo',detalhe.tipo_pagamento==='avista'?'À vista':'Parcelado (por medição)'],['Lançado por',detalhe.criado_por],
                    ['Entrega',detalhe.status_entrega==='entregue'?`✓ Entregue em ${detalhe.data_entrega?fmtData(detalhe.data_entrega):'—'}`:'⏳ Pendente'],
                  ].map(([k,v])=>(
                    <div key={k}><p style={{fontSize:10,fontWeight:600,color:'#7A919E',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:2}}>{k}</p><p style={{fontSize:14,fontWeight:500}}>{v}</p></div>
                  ))}
                </div>

                {detalhe.arquivo_url&&(
                  <a href={detalhe.arquivo_url} target="_blank" rel="noopener noreferrer"
                    style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:13,color:'#0097A8',marginBottom:16,textDecoration:'none',fontWeight:600}}>
                    📄 Ver nota fiscal (PDF)
                  </a>
                )}

                {detalhe.tipo_pagamento==='parcelado'&&(detalhe.parcelas||[]).length>0&&(
                  <div style={{border:'1.5px solid #DDE5EA',borderRadius:8,overflow:'hidden',marginBottom:16}}>
                    <div style={{background:'#FAFCFD',padding:'8px 12px',borderBottom:'1px solid #DDE5EA'}}>
                      <span style={{fontSize:10,fontWeight:700,color:'#7A919E',textTransform:'uppercase',letterSpacing:'.05em'}}>
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

                {detalhe.status_entrega==='pendente'&&(
                  <button onClick={()=>handleEntrega(detalhe.id)} disabled={!!acao} style={{...s.btnGrn,width:'100%',justifyContent:'center',opacity:!!acao?0.6:1}}>
                    {acao===detalhe.id?'Confirmando...':'✓ Confirmar entrega'}
                  </button>
                )}
              </div>
            ):(
              <div style={s.fg}>
                <FF lb="Título *"><input style={s.fi} value={form.titulo||''} onChange={e=>set('titulo',e.target.value)} placeholder="Ex: NF Manutenção Elétrica"/></FF>
                <FF lb="Valor total (R$) *"><input type="number" step="0.01" style={s.fi} value={form.valor_total||''} onChange={e=>set('valor_total',e.target.value)} placeholder="0,00"/></FF>
                <FF lb="Data *"><input type="date" style={s.fi} value={form.data||''} onChange={e=>set('data',e.target.value)}/></FF>
                <FF lb="Categoria *">
                  <select style={s.fi} value={form.categoria_id||''} onChange={e=>set('categoria_id',e.target.value)}>
                    <option value="">Selecione...</option>
                    {cats.map((c:any)=><option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </FF>
                <FF lb="Pago por *"><input style={s.fi} value={form.pago_por||''} onChange={e=>set('pago_por',e.target.value)} placeholder="Ex: Empresa X"/></FF>
                <FF lb="Tipo de pagamento *">
                  <select style={s.fi} value={form.tipo_pagamento||'avista'} onChange={e=>set('tipo_pagamento',e.target.value)}>
                    <option value="avista">À vista</option>
                    <option value="parcelado">Parcelado (por medição)</option>
                  </select>
                </FF>
                <div style={{gridColumn:'1/-1'}}>
                  <label style={s.lb}>Nota fiscal (PDF) — opcional</label>
                  <input ref={fileRef} type="file" accept="application/pdf,image/*"
                    onChange={e=>setArquivo(e.target.files?.[0]||null)}
                    style={{...s.fi,padding:'6px 10px',cursor:'pointer'}}/>
                  {arquivo&&<p style={{fontSize:11,color:'#0097A8',marginTop:4}}>📄 {arquivo.name}</p>}
                </div>
                {form.tipo_pagamento==='parcelado'&&<ParcelasEditor parcelas={parcelas} onChange={setParcelas}/>}
              </div>
            )}

            <div style={s.mfoot}>
              <button onClick={()=>setModal(false)} style={{...s.btnOut,padding:'.5rem 1rem',fontSize:13}}>Fechar</button>
              {!detalhe&&<button onClick={handleSave} disabled={saving} style={{...s.btnTeal,opacity:saving?0.6:1}}>{saving?'Salvando...':'Salvar'}</button>}
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