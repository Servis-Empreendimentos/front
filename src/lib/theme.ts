export const SIDEBAR_BG  = '#173a38'
export const SIDEBAR_BG2 = '#25524E'
export const ACCENT      = '#1D6863'
export const ACCENT_LT   = '#2D8C84'

export const s = {
  page:    { minHeight:'100vh', display:'flex', fontFamily:"'DM Sans',sans-serif", background:'#F7F7F3', color:'#162827' },
  sidebar: { width:268, minWidth:268, background:SIDEBAR_BG, display:'flex', flexDirection:'column' as const, position:'sticky' as const, top:0, height:'100vh', overflowY:'auto' as const, zIndex:40, boxShadow:'8px 0 28px rgba(22,40,39,.08)' },
  content: { flex:1, display:'flex', flexDirection:'column' as const, minWidth:0 },
  main:    { flex:1, padding:'2rem clamp(1rem, 3vw, 2.75rem)' },
  row:     { display:'flex', alignItems:'flex-end', justifyContent:'space-between', gap:16, marginBottom:'1.4rem' },
  h1:      { fontFamily:"'Space Grotesk',sans-serif", fontSize:26, lineHeight:1.1, fontWeight:700, letterSpacing:'-.045em', color:'#162827', margin:0 },
  p:       { fontSize:13, color:'#71817E', marginTop:6, marginBottom:0 },
  btnTeal: { display:'flex', alignItems:'center', justifyContent:'center', gap:8, background:ACCENT, color:'#fff', border:'none', padding:'.66rem 1.05rem', borderRadius:9, fontSize:13, fontWeight:700, cursor:'pointer', boxShadow:'0 5px 13px rgba(29,104,99,.18)' },
  btnOut:  { display:'flex', alignItems:'center', gap:6, background:'#fff', color:'#29413F', border:'1px solid #DDE5E1', padding:'.54rem .85rem', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer' },
  btnGrn:  { display:'flex', alignItems:'center', gap:6, background:'#2E8B61', color:'#fff', border:'none', padding:'.62rem 1rem', borderRadius:9, fontSize:13, fontWeight:700, cursor:'pointer', boxShadow:'0 5px 13px rgba(46,139,97,.16)' },
  btnRed:  { display:'flex', alignItems:'center', gap:6, background:'#fff', color:'#C85E4A', border:'1px solid #F3D7CF', padding:'.54rem .85rem', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer' },
  kpi:     { background:'#fff', border:'1px solid #E7EBE7', borderRadius:14, padding:'1.05rem 1.1rem', position:'relative' as const, overflow:'hidden', boxShadow:'0 2px 10px rgba(22,40,39,.045)' },
  card:    { background:'#fff', border:'1px solid #E7EBE7', borderRadius:16, overflow:'hidden', boxShadow:'0 2px 10px rgba(22,40,39,.045)', marginBottom:'1.35rem' },
  toolbar: { display:'flex', alignItems:'center', gap:9, padding:'.95rem 1.2rem', borderBottom:'1px solid #E7EBE7', background:'#FCFDFC', flexWrap:'wrap' as const },
  badge:   { display:'inline-flex', alignItems:'center', gap:5, padding:'4px 10px', borderRadius:20, fontSize:11, fontWeight:700, whiteSpace:'nowrap' as const },
  inp:     { border:'1px solid #DDE5E1', borderRadius:8, padding:'7px 10px', fontSize:12, fontFamily:'inherit', outline:'none', background:'#fff', color:'#162827' },
  overlay: { position:'fixed' as const, inset:0, background:'rgba(18,35,34,.55)', zIndex:50, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'46px 16px 20px', backdropFilter:'blur(3px)' },
  modal:   { background:'#fff', borderRadius:18, width:760, maxWidth:'95vw', maxHeight:'92vh', overflowY:'auto' as const, boxShadow:'0 24px 70px rgba(18,35,34,.22)' },
  mhdr:    { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'1.15rem 1.5rem', borderBottom:'1px solid #E7EBE7', position:'sticky' as const, top:0, background:'#fff', zIndex:1 },
  mfoot:   { display:'flex', gap:8, justifyContent:'flex-end', padding:'1rem 1.5rem', borderTop:'1px solid #E7EBE7', background:'#FCFDFC', position:'sticky' as const, bottom:0 },
  fg:      { display:'grid', gridTemplateColumns:'1fr 1fr', gap:'13px 16px', padding:'1.45rem 1.5rem' },
  fi:      { width:'100%', border:'1px solid #DDE5E1', borderRadius:9, padding:'8px 11px', fontSize:13, fontFamily:'inherit', color:'#162827', outline:'none', boxSizing:'border-box' as const, background:'#fff' },
  lb:      { display:'block', fontSize:10, fontWeight:700, color:'#71817E', textTransform:'uppercase' as const, letterSpacing:'.08em', marginBottom:5 },
  footer:  { background:'#fff', borderTop:'1px solid #E7EBE7', padding:'.8rem clamp(1rem, 3vw, 2.75rem)', display:'flex', justifyContent:'space-between', alignItems:'center' },
}

export const PIPE_COLORS: Record<string,string> = {
  orcamento_aprovado:'#71817E', em_tratativa:'#D18A3B', orcamento_fechado:'#4C78C2',
  pagamento_realizado:'#2E8B61', entrega_programada:'#8768C6', mercadoria_recebida:ACCENT_LT, nf_recebida:'#284542',
}

export const STEP_ICONS: Record<string,string> = {
  orcamento_aprovado:'fileText', em_tratativa:'users', orcamento_fechado:'checkCircle',
  pagamento_realizado:'dollar', entrega_programada:'calendar', mercadoria_recebida:'package', nf_recebida:'receipt',
}
