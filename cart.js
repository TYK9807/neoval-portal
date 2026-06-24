/* ============================================================
   Neoval Pharma — shared order/cart logic
   Single source of truth for products + cart state (localStorage).
   ============================================================ */
(function(){
  var STORAGE_KEY='neoval_cart_v1';
  var ORDERS_KEY='neoval_orders_v1';

  // Canonical product catalogue (shared by Catalogue + Commande pages)
  var PRODUCTS=[
    {ref:"NV-ARC-300",name:"ARCAR 300",cat:"Articulations",glyph:"◈",
     desc:"Formule articulaire pour soutenir la mobilité et le confort des articulations. Boîte de 30 gélules.",
     price:138,carton:24,stock:"in"},
    {ref:"NV-LIB-100",name:"Liberel",cat:"Application locale",glyph:"≋",
     desc:"Gel de massage pour soulager les douleurs musculaires et articulaires. Tube de 100 ml.",
     price:92,carton:20,stock:"in"},
    {ref:"NV-FER-30",name:"FERCAP",cat:"Vitamines & Minéraux",glyph:"Fe",
     desc:"Fer associé à la vitamine C pour lutter contre la fatigue et soutenir la vitalité. Boîte de 30 gélules.",
     price:76,carton:36,stock:"in"},
    {ref:"NV-MAC-40",name:"MACAL",cat:"Vitamines & Minéraux",glyph:"Mg",
     desc:"Magnésium et calcium pour les os, les muscles et l'équilibre nerveux. Boîte de 40 gélules.",
     price:84,carton:36,stock:"low"},
    {ref:"NV-SOU-30",name:"Soulnat",cat:"Articulations",glyph:"◇",
     desc:"Confort articulaire au quotidien, pour des articulations souples. Boîte de 30 gélules.",
     price:124,carton:24,stock:"in"},
    {ref:"NV-DLQ-400",name:"D-LIQ 400 UI",cat:"Vitamines & Minéraux",glyph:"D3",
     desc:"Vitamine D3 en solution buvable, pour l'immunité et la santé osseuse. Flacon de 50 ml.",
     price:68,carton:30,stock:"in"},
    {ref:"NV-NER-30",name:"NERCURE",cat:"Énergie",glyph:"Q10",
     desc:"Acétyl-L-carnitine et coenzyme Q10 pour l'énergie cellulaire et le système nerveux. Boîte de 30 gélules.",
     price:186,carton:18,stock:"low"}
  ];

  var TVA_RATE=0.20; // 20% TVA Maroc

  function byRef(ref){ for(var i=0;i<PRODUCTS.length;i++){ if(PRODUCTS[i].ref===ref) return PRODUCTS[i]; } return null; }

  // cart shape: { "NV-ARC-300": 2, ... }  (value = number of cartons)
  function read(){
    try{ return JSON.parse(localStorage.getItem(STORAGE_KEY))||{}; }
    catch(e){ return {}; }
  }
  function write(c){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
    try{ window.dispatchEvent(new CustomEvent('cart:change',{detail:c})); }catch(e){}
  }

  var Cart={
    PRODUCTS:PRODUCTS,
    TVA_RATE:TVA_RATE,
    byRef:byRef,
    get:read,
    /** total number of cartons across all lines */
    count:function(){ var c=read(),n=0; for(var k in c){ n+=c[k]; } return n; },
    /** distinct product lines */
    lines:function(){ var c=read(); return Object.keys(c).filter(function(k){return c[k]>0;}); },
    add:function(ref,qty){
      qty=qty||1; var c=read(); c[ref]=(c[ref]||0)+qty; if(c[ref]<1) delete c[ref]; write(c); return c;
    },
    set:function(ref,qty){
      var c=read(); if(qty<1){ delete c[ref]; } else { c[ref]=qty; } write(c); return c;
    },
    remove:function(ref){ var c=read(); delete c[ref]; write(c); return c; },
    clear:function(){ write({}); },
    /** {items:[{product, cartons, units, lineTotal}], subtotal, tva, total} */
    summary:function(){
      var c=read(), items=[], subtotal=0;
      Object.keys(c).forEach(function(ref){
        var p=byRef(ref); if(!p||c[ref]<1) return;
        var cartons=c[ref], units=cartons*p.carton, lineTotal=units*p.price;
        subtotal+=lineTotal;
        items.push({product:p,cartons:cartons,units:units,lineTotal:lineTotal});
      });
      var tva=subtotal*TVA_RATE;
      return {items:items, subtotal:subtotal, tva:tva, total:subtotal+tva};
    },
    fmt:function(n){ return Number(n).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2}); },

    /* ---- submitted orders (persistent history) ---- */
    getOrders:function(){
      try{ return JSON.parse(localStorage.getItem(ORDERS_KEY))||[]; }
      catch(e){ return []; }
    },
    /** snapshot the current cart as a confirmed order, prepend to history, return it */
    saveOrder:function(){
      var s=this.summary(); if(!s.items.length) return null;
      var id='CMD-'+Math.floor(100000+Math.random()*900000);
      var order={
        id:id,
        date:new Date().toISOString(),
        status:'En préparation',
        units:s.items.reduce(function(a,it){return a+it.units;},0),
        lineCount:s.items.length,
        subtotal:s.subtotal, tva:s.tva, total:s.total,
        items:s.items.map(function(it){
          return {ref:it.product.ref, name:it.product.name, glyph:it.product.glyph,
                  cartons:it.cartons, units:it.units, lineTotal:it.lineTotal};
        })
      };
      var all=this.getOrders(); all.unshift(order);
      localStorage.setItem(ORDERS_KEY, JSON.stringify(all));
      try{ window.dispatchEvent(new CustomEvent('orders:change',{detail:order})); }catch(e){}
      return order;
    }
  };

  window.NeovalCart=Cart;
})();
