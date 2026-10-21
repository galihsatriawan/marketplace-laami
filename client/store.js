// Public storefront: catalog -> cart -> checkout. The order goes to the POS (re-priced and checked there) and the
// buyer sends the composed message to the shop's WhatsApp. Same look and code style as the Modern POS apps.
import {applyBrand} from './brand.js';
export function mountStore(opts){
'use strict';
const {data,api}=opts;
if(window.__storeMounted)return;window.__storeMounted=true;

const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
const rp=n=>{n=Math.round(num(n));return (n<0?'−':'')+'Rp'+Math.abs(n).toLocaleString('id-ID')};
const rpBig=n=>{n=Math.round(num(n));return `${n<0?'−':''}<span class="cur">Rp</span>${Math.abs(n).toLocaleString('id-ID')}`};
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,9);
const ls={get:(k,d)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}},set:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
const ss={get:(k,d)=>{try{const v=sessionStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}},set:(k,v)=>{try{v==null?sessionStorage.removeItem(k):sessionStorage.setItem(k,JSON.stringify(v))}catch(e){}}};

let D=data, view='katalog', q='', entering=true, busy=false;
const SLUG=D.slug, CART_KEY=`toko.cart.${SLUG}`, DONE_KEY=`toko.done.${SLUG}`, BUYER_KEY='toko.buyer';
let cart=ls.get(CART_KEY,[]);if(!Array.isArray(cart))cart=[];
let co={delivery:'ambil',...ls.get(BUYER_KEY,{})}; // buyer details, remembered on this device
let done=ss.get(DONE_KEY,null);if(done)view='selesai';
// One id per cart: sending again after a dropped connection is recognised instead of doubled.
let orderId=null;
const saveCart=()=>{orderId=null;ls.set(CART_KEY,cart)};

const prod=id=>D.products.find(p=>p.id===id);
const variantOf=(p,vid)=>p?(vid?p.variants.find(v=>v.id===vid):p.variants[0]):null;
const hasVariants=p=>p.variants.length>1||!!p.variants[0].name;
const sizeEntries=st=>{const o=D.sizes||[];const r=k=>{const i=o.indexOf(k);return i<0?999:i};return Object.entries(st||{}).sort((a,b)=>r(a[0])-r(b[0]))};
const vStock=v=>Object.values(v.stock).reduce((a,b)=>a+num(b),0);
const vCover=v=>v&&(v.media.find(m=>m.type==='image')?.url);
const cover=p=>{for(const v of p.variants){const c=vCover(v);if(c)return c}return null};
const mediaOf=(p,v)=>v&&v.media.length?v.media:p.variants.flatMap(x=>x.media);
// Wholesale: the highest tier whose min <= the TOTAL pcs in the cart (models may be mixed), per product.
const cartPcs=()=>cart.reduce((a,c)=>a+c.qty,0);
const tierFor=(p,pcs)=>{let best=null;for(const t of p.tiers||[])if(pcs>=t.min)best=t;return best};
const unitPrice=(p,pcs=cartPcs())=>{const t=tierFor(p,pcs);return t?t.price:p.price};
const cartTotal=()=>cart.reduce((a,c)=>{const p=prod(c.productId);return a+(p?unitPrice(p)*c.qty:0)},0);
const cartBase=()=>cart.reduce((a,c)=>{const p=prod(c.productId);return a+(p?p.price*c.qty:0)},0);
// The next wholesale step any product in the cart could reach.
const nextTier=()=>{const pcs=cartPcs();let best=null;for(const c of cart){const p=prod(c.productId);for(const t of p?.tiers||[])if(t.min>pcs&&t.price<unitPrice(p)&&(!best||t.min<best.min))best={...t,name:p.name}}return best};
const tierHint=p=>p.tiers&&p.tiers.length?`Beli ${p.tiers[0].min}+ ${rp(p.tiers[0].price)}/pcs`:'';

function clampCart(){
  cart=cart.map(c=>{const v=variantOf(prod(c.productId),c.variantId);return v?{...c,variantId:v.id,qty:Math.min(c.qty,num(v.stock[c.size]))}:null}).filter(c=>c&&c.qty>0);ls.set(CART_KEY,cart);
}
async function refresh(){
  try{const r=await fetch(`${api}/api/public/stores/${SLUG}`,{cache:'no-store'});
    if(r.status===404){$('#main').innerHTML=`<section class="panel"><div class="empty"><b>Toko sedang tutup.</b> Coba lagi nanti.</div></section>`;return}
    if(!r.ok)return;D=await r.json();clampCart();render()}catch(e){}
}

function renderTop(){
  const n=cartPcs();const b=$('#cart-btn');
  if(b)b.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.4 10.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 7H6.2"/><circle cx="9" cy="19.5" r="1.3"/><circle cx="17" cy="19.5" r="1.3"/></svg>${n?`<span class="badge">${n}</span>`:''}`;
}
function render(){
  applyBrand(D.brand,{name:D.shop,sub:'Toko online'});renderTop();
  const m=$('#main');
  m.innerHTML=({katalog:vKatalog,keranjang:vKeranjang,selesai:vSelesai})[view]()+cartBar();
  if(entering){entering=false;m.classList.remove('enter');void m.offsetWidth;m.classList.add('enter')}
}
function go(v){view=v;entering=true;render();window.scrollTo(0,0)}

function cartBar(){
  if(view!=='katalog'||!cart.length)return '';
  const save=cartBase()-cartTotal();
  return `<div class="cartbar"><div><div style="font-weight:600">${cartPcs()} pcs · ${rp(cartTotal())}</div><div class="small" style="opacity:.75">${save>0?`hemat ${rp(save)} harga grosir`:'belum termasuk ongkir'}</div></div>
    <button class="btn" data-act="go" data-id="keranjang" style="background:var(--surface);color:var(--text);border-color:var(--surface)">Lihat keranjang</button></div>`;
}

function vKatalog(){
  const s=q.toLowerCase();const b=D.brand||{};
  const list=D.products.filter(p=>!s||p.name.toLowerCase().includes(s));
  const meta=[b.address&&esc(b.address),b.instagram&&`IG ${esc(b.instagram)}`].filter(Boolean);
  return `<section class="panel"><div class="store-intro"><h1 style="font-size:var(--fs-title);line-height:34px;letter-spacing:-.02em">${esc(D.shop)}</h1>
      ${D.intro?`<p style="margin:0">${esc(D.intro)}</p>`:''}${meta.length?`<div class="small muted">${meta.map(x=>`<span>${x}</span>`).join('')}</div>`:''}
      <div class="small muted">Pilih baju, masukkan keranjang, lalu kirim pesanan lewat WhatsApp.</div></div></section>
  ${D.products.length>4?`<input class="in" type="search" id="cat-q" placeholder="Cari baju" value="${esc(q)}" data-input="q" aria-label="Cari baju">`:''}
  ${list.length?`<div class="catalog">${list.map(p=>{const nv=hasVariants(p)?p.variants.length:0;const vids=p.variants.flatMap(v=>v.media).some(m=>m.type==='video');
    const sizes=[...new Set(p.variants.flatMap(v=>sizeEntries(v.stock).map(([k])=>k)))];
    return `<button class="cat-card" data-act="product" data-id="${esc(p.id)}">
      <div class="cat-img">${cover(p)?`<img src="${esc(cover(p))}" alt="" loading="lazy">`:`<span>${esc(p.name.slice(0,1))}</span>`}${vids?'<span class="pill neu media-badge">Video</span>':''}</div>
      <div class="cat-body"><div class="cat-name">${esc(p.name)}</div><div class="cat-price money">${rp(p.price)}</div>
      ${tierHint(p)?`<span class="tier-hint">${tierHint(p)}</span>`:''}
      <div class="small muted">${nv>1?`${nv} variasi · `:''}${esc(sizes.join(', '))}</div></div></button>`}).join('')}</div>`
  :`<section class="panel"><div class="empty">${D.products.length?'Tidak ada yang cocok.':'<b>Belum ada baju yang tersedia.</b> Cek lagi nanti.'}</div></section>`}
  <div class="foot">${esc(D.shop)}</div>`;
}

let ps=null; // product sheet state
function productSheet(id){
  const p=prod(id);if(!p)return;
  if(!ps||ps.id!==id){const v0=p.variants.find(v=>vStock(v)>0)||p.variants[0];ps={id,vid:v0.id,qty:1}}
  const v=variantOf(p,ps.vid)||p.variants[0];
  const sizes=sizeEntries(v.stock);
  if(!(ps.size in v.stock)||num(v.stock[ps.size])<=0)ps.size=(sizes.find(([,n])=>num(n)>0)||sizes[0]||[])[0];
  const have=num(v.stock[ps.size]);const media=mediaOf(p,v);
  const inCart=cart.filter(c=>c.productId===id&&c.variantId===v.id&&c.size===ps.size).reduce((a,c)=>a+c.qty,0);
  const max=Math.max(0,have-inCart);
  if(ps.qty>max)ps.qty=Math.max(1,max);
  const pcsAfter=cartPcs()+ps.qty;const price=unitPrice(p,pcsAfter);
  openSheet(p.name,`<div class="form">
    ${media.length?`<div class="gallery" id="gal">${media.map((m,i)=>`<button type="button" class="g-item" data-act="view" data-id="${i}" aria-label="Lihat layar penuh">${m.type==='video'?`<video src="${esc(m.url)}#t=0.1" muted playsinline preload="metadata"></video><span class="g-play" aria-hidden="true"></span>`:`<img src="${esc(m.url)}" alt="">`}</button>`).join('')}</div>`:''}
    <div class="sum money">${price<p.price?`<span class="was">${rp(p.price)}</span>`:''}${rpBig(price)}</div>
    ${p.tiers.length?`<div class="tiers-box"><b>Harga grosir</b>${p.tiers.map(t=>`<span>Beli ${t.min}+ pcs: ${rp(t.price)}/pcs</span>`).join('')}<span class="small" style="opacity:.8">Dihitung dari total semua baju di keranjang, boleh campur model.</span></div>`:''}
    ${hasVariants(p)?`<div class="f"><span class="lbl">Variasi</span><div class="chips">${p.variants.map(x=>{const c=vCover(x);return `<button type="button" class="chip var-chip" data-act="ps-var" data-id="${esc(x.id)}" aria-pressed="${x.id===v.id}">${c?`<img src="${esc(c)}" alt="">`:''}${esc(x.name||'Lainnya')}</button>`}).join('')}</div></div>`:''}
    <div class="f"><span class="lbl">Ukuran</span><div class="chips">${sizes.map(([sz,n])=>`<button type="button" class="chip" data-act="ps-size" data-id="${esc(sz)}" aria-pressed="${sz===ps.size}" ${num(n)<=0?'disabled':''}>${esc(sz)}</button>`).join('')}</div></div>
    <div class="f"><span class="lbl">Jumlah</span><div class="stepper"><button type="button" class="btn" data-act="ps-dec" aria-label="Kurangi">−</button><span class="num">${ps.qty}</span><button type="button" class="btn" data-act="ps-inc" aria-label="Tambah" ${ps.qty>=max?'disabled':''}>+</button>
      <span class="small muted">${inCart?`${inCart} sudah di keranjang · `:''}stok ${have}</span></div></div>
  </div>`,`<button class="btn pri" data-act="add-cart" ${max<=0?'disabled':''}>${max<=0?'Stok habis':`Masukkan keranjang · ${rp(price*ps.qty)}`}</button>`);
}

function vKeranjang(){
  if(!cart.length)return `<div class="title-row"><div><h1>Keranjang</h1></div></div><section class="panel"><div class="empty"><b>Keranjang kosong.</b> Pilih baju di <button class="link" data-act="go" data-id="katalog">katalog</button>.</div></section>`;
  const pcs=cartPcs();const save=cartBase()-cartTotal();const nt=nextTier();
  return `<div class="title-row"><div><h1>Keranjang</h1><p>${pcs} pcs · <button class="link" data-act="go" data-id="katalog">tambah baju lain</button></p></div><button class="btn sm ghost danger" data-act="cart-clear">Kosongkan</button></div>
  <section class="panel"><ul class="list" style="padding-top:8px">${cart.map((c,i)=>{const p=prod(c.productId);const v=variantOf(p,c.variantId);const max=num(v.stock[c.size]);const img=vCover(v)||cover(p);const u=unitPrice(p);
    return `<li class="li">${img?`<img class="thumb sm" src="${esc(img)}" alt="">`:''}<div class="grow"><div class="t">${esc(p.name)}</div><div class="s">${v.name?esc(v.name)+' · ':''}Ukuran ${esc(c.size)} · ${u<p.price?`<span class="was">${rp(p.price)}</span>`:''}${rp(u)}/pcs</div>
      <div class="stepper sm"><button type="button" class="btn sm" data-act="cart-dec" data-id="${i}" aria-label="Kurangi">−</button><span class="num">${c.qty}</span><button type="button" class="btn sm" data-act="cart-inc" data-id="${i}" aria-label="Tambah" ${c.qty>=max?'disabled':''}>+</button></div></div>
      <div class="r"><div class="v money">${rp(u*c.qty)}</div></div></li>`}).join('')}</ul>
    ${nt?`<div class="panel-b" style="padding-top:0"><div class="tier-hint" style="font-size:13.5px">Tambah ${nt.min-pcs} pcs lagi (boleh campur model) supaya ${esc(nt.name)} jadi ${rp(nt.price)}/pcs.</div></div>`:''}</section>
  <section class="panel"><div class="panel-b">
    <form class="form" id="checkout" data-form="checkout" style="padding-bottom:0">
      <div class="calc">${save>0?`<div class="ln"><span class="k">Harga normal</span><span class="money">${rp(cartBase())}</span></div><div class="ln"><span class="k">Hemat harga grosir</span><span class="money" style="color:var(--hue)">−${rp(save)}</span></div>`:''}
        <div class="ln tot"><span>Total ${pcs} pcs</span><span class="money" id="co-total">${rp(cartTotal())}</span></div></div>
      <div class="f"><label for="co-name">Nama</label><input class="in" id="co-name" name="name" value="${esc(co.name||'')}" autocomplete="name" placeholder="Nama kamu" maxlength="80"></div>
      <div class="f"><label for="co-phone">No. WhatsApp</label><input class="in" id="co-phone" name="phone" value="${esc(co.phone||'')}" type="tel" inputmode="tel" autocomplete="tel" placeholder="0812 3456 7890" maxlength="20"></div>
      <div class="f"><span class="lbl">Pengambilan</span><div class="seg full" role="group" aria-label="Pengambilan"><button type="button" data-act="delivery" data-id="ambil" aria-pressed="${co.delivery!=='kirim'}">Diambil di toko</button><button type="button" data-act="delivery" data-id="kirim" aria-pressed="${co.delivery==='kirim'}">Dikirim</button></div></div>
      <div class="f" id="co-addrbox" ${co.delivery==='kirim'?'':'hidden'}><label for="co-addr">Alamat lengkap</label><textarea class="in" id="co-addr" name="address" rows="3" maxlength="500" autocomplete="street-address" placeholder="Jalan, RT/RW, kelurahan, kecamatan, kota, kode pos">${esc(co.address||'')}</textarea><span class="hint">Ongkir dikabari toko lewat WhatsApp.</span></div>
      <div class="f"><label for="co-note">Catatan <span class="muted" style="font-weight:400">(opsional)</span></label><input class="in" id="co-note" name="note" value="${esc(co.note||'')}" maxlength="300" placeholder="Contoh: tolong dibungkus kado"></div>
      <button class="btn pri full" type="submit" ${busy?'disabled':''}>${busy?'Mengirim…':'Pesan lewat WhatsApp'}</button>
      <div class="small muted">Pesananmu tercatat di ${esc(D.shop)}, lalu WhatsApp terbuka dengan pesan yang sudah terisi. Tinggal tekan kirim.</div>
    </form></div></section>`;
}

function vSelesai(){
  const o=done;if(!o){view='katalog';return vKatalog()}
  return `<section class="panel"><div class="panel-b" style="display:flex;flex-direction:column;gap:14px;padding-top:24px">
    <span class="pill pos" style="align-self:flex-start">Pesanan tercatat</span>
    <div><div class="small muted">Kode pesanan</div><div class="done-code" id="done-code">${esc(o.code)}</div></div>
    <div class="calc"><div class="ln"><span class="k">${o.pcs} pcs${o.tier?' · harga grosir':''}</span><span class="money">${rp(o.total)}</span></div></div>
    <p style="margin:0">Satu langkah lagi: kirim pesanannya ke WhatsApp ${esc(D.shop)}. Kalau WhatsApp belum terbuka, tekan tombol di bawah.</p>
    <a class="btn full wa-btn" id="wa-link" href="${esc(o.waUrl)}" rel="noopener">Buka WhatsApp &amp; kirim pesanan</a>
    <button class="btn full" data-act="new-order">Belanja lagi</button>
  </div></section>`;
}

/* sheets + toast (same behaviour as the POS apps) */
let closeTimer=null;
function openSheet(title,body,foot){
  const root=$('#sheet-root');clearTimeout(closeTimer);
  const ex=root.querySelector('.scrim:not(.out)');
  if(ex){const sh=ex.querySelector('.sheet'),h=ex.querySelector('.sheet-h h2');if(h.textContent!==title){h.textContent=title;sh.scrollTop=0}
    $('#sheet-body').innerHTML=body;const f=sh.querySelector('.sheet-f');
    if(foot){if(f)f.innerHTML=foot;else sh.insertAdjacentHTML('beforeend',`<div class="sheet-f">${foot}</div>`)}else if(f)f.remove();}
  else root.innerHTML=`<div class="scrim" data-act="scrim"><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="sheet-h"><h2>${esc(title)}</h2><button class="btn ghost sm" data-act="close">Tutup</button></div>
      <div id="sheet-body">${body}</div>${foot?`<div class="sheet-f">${foot}</div>`:''}</div></div>`;
}
function closeSheet(){ps=null;const sc=$('#sheet-root .scrim');if(!sc)return;sc.classList.add('out');clearTimeout(closeTimer);closeTimer=setTimeout(()=>{$('#sheet-root').innerHTML=''},220)}
function toast(msg){const r=$('#toast-root');r.innerHTML=`<div class="toast" role="status">${esc(msg)}</div>`;clearTimeout(toast.t);toast.t=setTimeout(()=>r.innerHTML='',3200)}

/* media viewer */
let viewing=null;
function openViewer(pid,start){
  const p=prod(pid);const v=variantOf(p,ps&&ps.vid);const media=p?mediaOf(p,v):[];if(!media.length)return;viewing=pid;
  let root=$('#viewer-root');if(!root){root=document.createElement('div');root.id='viewer-root';document.body.appendChild(root)}
  root.innerHTML=`<div class="viewer" role="dialog" aria-modal="true" aria-label="${esc(p.name)}">
    <div class="viewer-track" id="vtrack">${media.map(m=>`<div class="viewer-slide">${m.type==='video'?`<video src="${esc(m.url)}" controls playsinline preload="metadata"></video>`:`<img src="${esc(m.url)}" alt="">`}</div>`).join('')}</div>
    <div class="viewer-top"><span class="viewer-count" id="vcount">${start+1} / ${media.length}</span><button type="button" class="viewer-btn" data-act="viewer-close" aria-label="Tutup">×</button></div>
    <div class="viewer-bottom"><div class="viewer-cap"><b>${esc(p.name)}${v&&v.name?' · '+esc(v.name):''}</b><span>${rp(unitPrice(p))}</span></div></div></div>`;
  const t=$('#vtrack');t.scrollLeft=start*t.clientWidth;
  const sync=()=>{const i=Math.round(t.scrollLeft/t.clientWidth);$('#vcount').textContent=`${i+1} / ${media.length}`;t.querySelectorAll('video').forEach(x=>{if(x.closest('.viewer-slide')!==t.children[i])x.pause()})};
  t.addEventListener('scroll',()=>{clearTimeout(sync.t);sync.t=setTimeout(sync,80)});
}
function closeViewer(){viewing=null;const r=$('#viewer-root');if(r)r.innerHTML=''}

const keepCheckout=()=>{const f=$('#checkout');if(!f)return;co={...co,name:f.name.value,phone:f.phone.value,address:f.address.value,note:f.note.value};ls.set(BUYER_KEY,{name:co.name,phone:co.phone,address:co.address,delivery:co.delivery})};

async function submitOrder(f){
  if(busy||!cart.length)return;keepCheckout();
  const name=co.name.trim(),phone=co.phone.replace(/[^\d+]/g,''),address=(co.address||'').trim();
  if(!name){toast('Isi nama kamu dulu');f.name.focus();return}
  if(phone.replace(/\D/g,'').length<9){toast('Isi nomor WhatsApp yang aktif');f.phone.focus();return}
  if(co.delivery==='kirim'&&address.length<10){toast('Isi alamat lengkap untuk pengiriman');f.address.focus();return}
  busy=true;const btn=f.querySelector('[type=submit]');btn.disabled=true;btn.textContent='Mengirim…';
  orderId=orderId||uid();
  let res,j={};
  try{res=await fetch(`${api}/api/public/stores/${SLUG}/orders`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:orderId,items:cart,name,phone,address:co.delivery==='kirim'?address:'',delivery:co.delivery,note:co.note||''})});j=await res.json().catch(()=>({}))}
  catch(e){busy=false;btn.disabled=false;btn.textContent='Pesan lewat WhatsApp';toast('Tidak ada koneksi internet. Coba lagi.');return}
  busy=false;
  if(!res.ok){btn.disabled=false;btn.textContent='Pesan lewat WhatsApp';toast(j.error||'Pesanan gagal dikirim. Coba lagi.');if(res.status===409){orderId=null;await refresh()}return}
  done={code:j.code,waUrl:j.waUrl,total:j.total,pcs:j.pcs,tier:j.tier};ss.set(DONE_KEY,done);
  cart=[];saveCart();co.note='';ls.set(BUYER_KEY,{name:co.name,phone:co.phone,address:co.address,delivery:co.delivery});
  go('selesai');
  // The link above is what the buyer taps if the browser blocks this jump.
  setTimeout(()=>{try{window.location.href=j.waUrl}catch(e){}},400);
}

document.addEventListener('click',e=>{
  const el=e.target.closest('[data-act]');if(!el)return;
  const act=el.dataset.act,id=el.dataset.id;
  if(act==='scrim'){if(e.target===el)closeSheet();return}
  switch(act){
    case 'go':closeSheet();go(id);break;
    case 'cart':closeSheet();go(view==='keranjang'?'katalog':'keranjang');break;
    case 'close':closeSheet();break;
    case 'view':openViewer(ps.id,+id);break;
    case 'viewer-close':closeViewer();break;
    case 'product':productSheet(id);break;
    case 'ps-size':ps.size=id;ps.qty=1;productSheet(ps.id);break;
    case 'ps-var':ps.vid=id;ps.qty=1;productSheet(ps.id);{const g=$('#gal');if(g)g.scrollLeft=0}break;
    case 'ps-inc':ps.qty++;productSheet(ps.id);break;
    case 'ps-dec':ps.qty=Math.max(1,ps.qty-1);productSheet(ps.id);break;
    case 'add-cart':{const p=prod(ps.id);const v=variantOf(p,ps.vid);const line=cart.find(c=>c.productId===ps.id&&c.variantId===v.id&&c.size===ps.size);if(line)line.qty+=ps.qty;else cart.push({productId:ps.id,variantId:v.id,size:ps.size,qty:ps.qty});
      saveCart();toast(`${p.name}${v.name?' '+v.name:''} ${ps.size} ×${ps.qty} masuk keranjang`);closeSheet();render();break}
    case 'cart-inc':keepCheckout();cart[+id].qty++;saveCart();render();break;
    case 'cart-dec':keepCheckout();if(cart[+id].qty>1)cart[+id].qty--;else cart.splice(+id,1);saveCart();render();break;
    case 'cart-clear':cart=[];saveCart();render();break;
    case 'delivery':{keepCheckout();co.delivery=id==='kirim'?'kirim':'ambil';el.parentElement.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===el)));const b=$('#co-addrbox');if(b)b.hidden=co.delivery!=='kirim';if(co.delivery==='kirim')$('#co-addr')?.focus();keepCheckout();break}
    case 'new-order':done=null;ss.set(DONE_KEY,null);go('katalog');break;
  }
});
document.addEventListener('input',e=>{
  if(e.target.closest('#checkout')){keepCheckout();return}
  if(e.target.dataset.input==='q'){q=e.target.value;const pos=e.target.selectionStart;render();const n=$('#cat-q');if(n){n.focus();try{n.setSelectionRange(pos,pos)}catch(_){}}}
});
document.addEventListener('submit',e=>{if(e.target.dataset.form!=='checkout')return;e.preventDefault();submitOrder(e.target)});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(viewing)closeViewer();else closeSheet()}});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&!$('#sheet-root .scrim')&&!busy)refresh()});

clampCart();render();
}
