export const SIDEBAR_BG  = '#0B1420'
export const SIDEBAR_BG2 = '#141F2C'
export const ACCENT      = '#0E7C86'
export const ACCENT_LT   = '#0097A8'

export const s = {
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

export const PIPE_COLORS: Record<string,string> = {
  orcamento_aprovado:'#64748B', em_tratativa:'#D97706', orcamento_fechado:'#2563EB',
  pagamento_realizado:'#16A34A', entrega_programada:'#7C3AED', mercadoria_recebida:ACCENT_LT, nf_recebida:'#0F172A',
}

export const STEP_ICONS: Record<string,string> = {
  orcamento_aprovado:'fileText', em_tratativa:'users', orcamento_fechado:'checkCircle',
  pagamento_realizado:'dollar', entrega_programada:'calendar', mercadoria_recebida:'package', nf_recebida:'receipt',
}