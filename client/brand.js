// Shop branding shared by the owner and reseller apps: logo in the header, the brand colour as the accent.
const HEX=/^#[0-9a-f]{6}$/i;
export const BRAND_COLORS=['#0f6e5c','#1f4fd1','#7a3fd1','#c2185b','#d1452b','#b7791f','#2f7a45','#191c1a'];
export const normBrand=b=>({logo:'',color:'',address:'',phone:'',instagram:'',website:'',footer:'',...(b&&typeof b==='object'?b:{})});

export function applyBrand(brand,{name,sub}){
  const b=normBrand(brand);const root=document.documentElement;
  if(HEX.test(b.color)){root.style.setProperty('--brand',b.color);root.classList.add('branded')}
  else{root.style.removeProperty('--brand');root.classList.remove('branded')}
  const mark=document.getElementById('brand-mark');
  if(mark){
    const want=b.logo?`<img class="mark logo" src="${encodeURI(b.logo)}" alt="">`:'';
    if(b.logo&&mark.dataset.logo!==b.logo){mark.dataset.logo=b.logo;if(!mark.dataset.svg)mark.dataset.svg=mark.innerHTML;mark.innerHTML=want}
    else if(!b.logo&&mark.dataset.logo){delete mark.dataset.logo;mark.innerHTML=mark.dataset.svg||''}
  }
  const n=document.getElementById('brand-name');if(n)n.textContent=name||'Modern POS';
  const s=document.getElementById('shop-sub');if(s)s.textContent=sub||'';
  if(name)document.title=name;
}
