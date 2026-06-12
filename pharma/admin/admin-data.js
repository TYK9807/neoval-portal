/* ============================================================
   Neoval Pharma — ADMIN data layer
   Orders across ALL pharmacies + stock. Same order shape as
   cart.js (saveOrder) with an added `pharmacy` / `city` field,
   so it integrates with the live n8n workflow later.

   Action mutators (confirmOrder / markDelivered / generateBL)
   are PLACEHOLDERS — they update local state and emit an event.
   In Claude Code these get wired to n8n webhooks.
   ============================================================ */
(function(){
  var ORDERS_KEY = 'neoval_admin_orders_v1';
  var STOCK_KEY  = 'neoval_admin_stock_v1';

  var C = window.NeovalCart;             // shared product catalogue + helpers
  var TVA = C ? C.TVA_RATE : 0.20;

  /* ---- demo credentials (admin, separate from pharmacy login) ---- */
  var AUTH = { email:'admin@neoval.ma', password:'neoval-admin' };

  /* ---- status buckets (identical mapping to the portal) ---- */
  var LABELS = { attente:'En attente', confirme:'Confirmé', livre:'Livré' };
  var ORDER  = ['attente','confirme','livre'];
  function bucket(s){
    s=(s||'').toLowerCase();
    if(s.indexOf('livr')>-1) return 'livre';
    if(s.indexOf('attente')>-1) return 'attente';
    return 'confirme';                   // confirmé / en préparation / validée
  }
  function fmt(n){ return Math.round(n).toLocaleString('fr-FR'); }

  /* ---- build a full order object from a compact line spec ---- */
  function buildOrder(spec){
    var items=[], subtotal=0, units=0;
    spec.lines.forEach(function(l){
      var p=C.byRef(l[0]); if(!p) return;
      var cartons=l[1], u=cartons*p.carton, lineTotal=u*p.price;
      subtotal+=lineTotal; units+=u;
      items.push({ref:p.ref,name:p.name,glyph:p.glyph,cartons:cartons,units:u,lineTotal:lineTotal});
    });
    var tva=subtotal*TVA;
    var iso=new Date(Date.now()-spec.daysAgo*86400000 - (spec.h||0)*3600000).toISOString();
    return {
      id:spec.id, date:iso, status:spec.status,
      pharmacy:spec.pharmacy, city:spec.city,
      units:units, lineCount:items.length,
      subtotal:subtotal, tva:tva, total:subtotal+tva,
      blGenerated: bucket(spec.status)!=='attente',   // BL exists once confirmed
      items:items
    };
  }

  /* ---- seed: 11 orders across 6 pharmacies, mixed statuses ---- */
  var SEED=[
    {id:'CMD-204871', daysAgo:0, h:2,  pharmacy:'Pharmacie Al Andalous', city:'Casablanca', status:'En attente', lines:[['NV-OMG-3000',3],['NV-IMM-440',2],['NV-VTB-8',4]]},
    {id:'CMD-204856', daysAgo:0, h:6,  pharmacy:'Pharmacie Atlas',       city:'Marrakech',  status:'En attente', lines:[['NV-DRM-S15',2],['NV-SUN-50',3]]},
    {id:'CMD-204834', daysAgo:1, h:3,  pharmacy:'Pharmacie Centrale',    city:'Rabat',      status:'En attente', lines:[['NV-COL-10',2],['NV-MAG-B6',5],['NV-VTB-8',2]]},
    {id:'CMD-204798', daysAgo:1, h:9,  pharmacy:'Pharmacie Zerktouni',   city:'Casablanca', status:'En attente', lines:[['NV-IMM-440',4]]},
    {id:'CMD-204755', daysAgo:2, h:4,  pharmacy:'Pharmacie du Détroit',  city:'Tanger',     status:'Confirmé',   lines:[['NV-OMG-3000',4],['NV-MAG-B6',3]]},
    {id:'CMD-204712', daysAgo:3, h:7,  pharmacy:'Pharmacie El Manar',    city:'Fès',        status:'Confirmé',   lines:[['NV-IMM-440',6],['NV-VTB-8',3],['NV-COL-10',2]]},
    {id:'CMD-204689', daysAgo:4, h:2,  pharmacy:'Pharmacie Atlas',       city:'Marrakech',  status:'Confirmé',   lines:[['NV-SUN-50',2],['NV-DRM-S15',1]]},
    {id:'CMD-204641', daysAgo:6, h:5,  pharmacy:'Pharmacie Centrale',    city:'Rabat',      status:'Livré',      lines:[['NV-COL-10',3],['NV-OMG-3000',2]]},
    {id:'CMD-204603', daysAgo:7, h:8,  pharmacy:'Pharmacie Al Andalous', city:'Casablanca', status:'Livré',      lines:[['NV-VTB-8',5],['NV-IMM-440',2]]},
    {id:'CMD-204567', daysAgo:9, h:3,  pharmacy:'Pharmacie du Détroit',  city:'Tanger',     status:'Livré',      lines:[['NV-MAG-B6',6]]},
    {id:'CMD-204529', daysAgo:12,h:6,  pharmacy:'Pharmacie El Manar',    city:'Fès',        status:'Livré',      lines:[['NV-SUN-50',2],['NV-COL-10',1],['NV-OMG-3000',1]]}
  ];

  function seedOrders(){
    var raw=null;
    try{ raw=JSON.parse(localStorage.getItem(ORDERS_KEY)); }catch(e){}
    if(raw && raw.length) return raw;
    var built=SEED.map(buildOrder);
    localStorage.setItem(ORDERS_KEY, JSON.stringify(built));
    return built;
  }

  /* ---- stock seed: numeric on-hand units per reference ---- */
  var STOCK_SEED={
    'NV-OMG-3000':480, 'NV-IMM-440':612, 'NV-DRM-S15':96, 'NV-MAG-B6':720,
    'NV-COL-10':234,   'NV-SUN-50':88,   'NV-FLO-12B':0,  'NV-VTB-8':540
  };
  function seedStock(){
    var raw=null;
    try{ raw=JSON.parse(localStorage.getItem(STOCK_KEY)); }catch(e){}
    if(raw && Object.keys(raw).length) return raw;
    localStorage.setItem(STOCK_KEY, JSON.stringify(STOCK_SEED));
    return Object.assign({}, STOCK_SEED);
  }

  function readOrders(){ try{ return JSON.parse(localStorage.getItem(ORDERS_KEY))||[]; }catch(e){ return []; } }
  function writeOrders(arr){
    localStorage.setItem(ORDERS_KEY, JSON.stringify(arr));
    try{ window.dispatchEvent(new CustomEvent('admin:orders',{detail:arr})); }catch(e){}
  }
  function readStock(){ try{ return JSON.parse(localStorage.getItem(STOCK_KEY))||{}; }catch(e){ return {}; } }
  function writeStock(map){
    localStorage.setItem(STOCK_KEY, JSON.stringify(map));
    try{ window.dispatchEvent(new CustomEvent('admin:stock',{detail:map})); }catch(e){}
  }

  function setStatus(id,status,extra){
    var arr=readOrders(), hit=null;
    arr.forEach(function(o){ if(o.id===id){ if(status) o.status=status; if(extra) Object.assign(o,extra); hit=o; } });
    if(hit) writeOrders(arr);
    return hit;
  }

  var Admin={
    AUTH:AUTH,
    LABELS:LABELS, ORDER:ORDER, bucket:bucket, fmt:fmt,
    PRODUCTS: C ? C.PRODUCTS : [],

    /* orders — newest first */
    getOrders:function(){
      seedOrders();
      return readOrders().slice().sort(function(a,b){ return new Date(b.date)-new Date(a.date); });
    },
    getOrder:function(id){ seedOrders(); return readOrders().filter(function(o){return o.id===id;})[0]||null; },

    /* ---- ACTION PLACEHOLDERS → wire to n8n webhooks in Claude Code ---- */
    confirmOrder:function(id){
      // TODO(n8n): POST /webhook/order-confirm  { orderId:id }
      console.log('[n8n placeholder] confirmOrder', id);
      return setStatus(id,'Confirmé',{blGenerated:true});
    },
    markDelivered:function(id){
      // TODO(n8n): POST /webhook/order-delivered  { orderId:id }
      console.log('[n8n placeholder] markDelivered', id);
      return setStatus(id,'Livré');
    },
    generateBL:function(id){
      // TODO(n8n): POST /webhook/generate-bl  { orderId:id }
      console.log('[n8n placeholder] generateBL', id);
      return setStatus(id,null,{blGenerated:true});
    },

    /* stock */
    getStock:function(){ return seedStock(); },
    stockOf:function(ref){ var s=readStock(); return (ref in s)?s[ref]:0; },
    setStock:function(ref,qty){
      // TODO(n8n): POST /webhook/stock-update  { ref, qty }
      console.log('[n8n placeholder] setStock', ref, qty);
      var s=readStock(); s[ref]=Math.max(0,Math.round(qty||0)); writeStock(s); return s[ref];
    },
    /** qualitative state derived from on-hand units */
    stockState:function(qty){ if(qty<=0) return 'out'; if(qty<120) return 'low'; return 'in'; }
  };

  window.NeovalAdmin=Admin;
})();
