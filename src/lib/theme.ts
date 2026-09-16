export const SIDEBAR_BG  = '#A7BBB3'
export const SIDEBAR_BG2 = '#C4D2CC'
export const ACCENT      = '#8BA59A'
export const ACCENT_LT   = '#748F84'

export const s = {
  page:    { minHeight:'100vh', display:'flex', fontFamily:"'DM Sans',sans-serif", background:'#F7F9F8', color:'#626262' },
  sidebar: { width:268, minWidth:268, background:SIDEBAR_BG, display:'flex', flexDirection:'column' as const, position:'sticky' as const, top:0, height:'100vh', overflowY:'auto' as const, zIndex:40, boxShadow:'8px 0 28px rgba(91,112,103,.10)' },
  content: { flex:1, display:'flex', flexDirection:'column' as const, minWidth:0 },
  main:    { flex:1, padding:'2rem clamp(1rem, 3vw, 2.75rem)' },
  row:     { display:'flex', alignItems:'flex-end', justifyContent:'space-between', gap:16, marginBottom:'1.4rem' },
  h1:      { fontFamily:"'Space Grotesk',sans-serif", fontSize:26, lineHeight:1.1, fontWeight:700, letterSpacing:'-.045em', color:'#626262', margin:0 },
  p:       { fontSize:13, color:'#7D7D7D', marginTop:6, marginBottom:0 },
  btnTeal: { display:'flex', alignItems:'center', justifyContent:'center', gap:8, background:ACCENT, color:'#fff', border:'none', padding:'.66rem 1.05rem', borderRadius:9, fontSize:13, fontWeight:700, cursor:'pointer', boxShadow:'0 5px 13px rgba(139,165,154,.22)' },
  btnOut:  { display:'flex', alignItems:'center', gap:6, background:'#fff', color:'#626262', border:'1px solid #DDE3E0', padding:'.54rem .85rem', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer' },
  btnGrn:  { display:'flex', alignItems:'center', gap:6, background:ACCENT, color:'#fff', border:'none', padding:'.62rem 1rem', borderRadius:9, fontSize:13, fontWeight:700, cursor:'pointer', boxShadow:'0 5px 13px rgba(139,165,154,.18)' },
  btnRed:  { display:'flex', alignItems:'center', gap:6, background:'#fff', color:'#777777', border:'1px solid #DDE3E0', padding:'.54rem .85rem', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer' },
  kpi:     { background:'#fff', border:'1px solid #E2E6E4', borderRadius:14, padding:'1.05rem 1.1rem', position:'relative' as const, overflow:'hidden', boxShadow:'0 2px 10px rgba(98,98,98,.045)' },
  card:    { background:'#fff', border:'1px solid #E2E6E4', borderRadius:16, overflow:'hidden', boxShadow:'0 2px 10px rgba(98,98,98,.045)', marginBottom:'1.35rem' },
  toolbar: { display:'flex', alignItems:'center', gap:9, padding:'.95rem 1.2rem', borderBottom:'1px solid #E2E6E4', background:'#FAFBFA', flexWrap:'wrap' as const },
  badge:   { display:'inline-flex', alignItems:'center', gap:5, padding:'4px 10px', borderRadius:20, fontSize:11, fontWeight:700, whiteSpace:'nowrap' as const },
  inp:     { border:'1px solid #DDE3E0', borderRadius:8, padding:'7px 10px', fontSize:12, fontFamily:'inherit', outline:'none', background:'#fff', color:'#626262' },
  overlay: { position:'fixed' as const, inset:0, background:'rgba(98,98,98,.46)', zIndex:50, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'46px 16px 20px', backdropFilter:'blur(3px)' },
  modal:   { background:'#fff', borderRadius:18, width:760, maxWidth:'95vw', maxHeight:'92vh', overflowY:'auto' as const, boxShadow:'0 24px 70px rgba(98,98,98,.20)' },
  mhdr:    { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'1.15rem 1.5rem', borderBottom:'1px solid #E2E6E4', position:'sticky' as const, top:0, background:'#fff', zIndex:1 },
  mfoot:   { display:'flex', gap:8, justifyContent:'flex-end', padding:'1rem 1.5rem', borderTop:'1px solid #E2E6E4', background:'#FAFBFA', position:'sticky' as const, bottom:0 },
  fg:      { display:'grid', gridTemplateColumns:'1fr 1fr', gap:'13px 16px', padding:'1.45rem 1.5rem' },
  fi:      { width:'100%', border:'1px solid #DDE3E0', borderRadius:9, padding:'8px 11px', fontSize:13, fontFamily:'inherit', color:'#626262', outline:'none', boxSizing:'border-box' as const, background:'#fff' },
  lb:      { display:'block', fontSize:10, fontWeight:700, color:'#7D7D7D', textTransform:'uppercase' as const, letterSpacing:'.08em', marginBottom:5 },
}

export const PIPE_COLORS: Record<string,string> = {
  orcamento_aprovado:'#969696', em_tratativa:'#858585', orcamento_fechado:'#707070',
  pagamento_realizado:'#748F84', entrega_programada:'#8E9994', mercadoria_recebida:ACCENT_LT, nf_recebida:'#626262',
}

export const STEP_ICONS: Record<string,string> = {
  orcamento_aprovado:'fileText', em_tratativa:'users', orcamento_fechado:'checkCircle',
  pagamento_realizado:'dollar', entrega_programada:'calendar', mercadoria_recebida:'package', nf_recebida:'receipt',
}
