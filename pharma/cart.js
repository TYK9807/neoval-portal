/* ============================================================
   Neoval Pharma — shared order/cart logic
   Single source of truth for products + cart state (localStorage).
   ============================================================ */
(function(){
  var STORAGE_KEY='neoval_cart_v1';
  var ORDERS_KEY='neoval_orders_v1';

  // Canonical product catalogue (shared by Catalogue + Commande pages)
  var PRODUCTS=[
    {ref:"NV-OMG-3000",name:"OmegaPure 3000",cat:"Compléments",glyph:"Ω",
     desc:"Oméga-3 EPA/DHA haute concentration, huile de poisson sauvage purifiée. 60 capsules.",
     price:142,carton:24,stock:"in"},
    {ref:"NV-IMM-440",name:"ImmunoShield+",cat:"Immunité",glyph:"⊕",
     desc:"Complexe vitamine C, zinc et échinacée pour le soutien des défenses naturelles. 30 comprimés.",
     price:118,carton:36,stock:"in"},
    {ref:"NV-DRM-S15",name:"DermaActiv Sérum",cat:"Cosmétique",glyph:"◇",
     desc:"Sérum acide hyaluronique + vitamine C, hydratation intense et éclat. Flacon 30 ml.",
     price:265,carton:12,stock:"low"},
    {ref:"NV-MAG-B6",name:"MagnésioPure",cat:"Compléments",glyph:"Mg",
     desc:"Bisglycinate de magnésium et vitamine B6, anti-fatigue et fonction musculaire. 90 gélules.",
     price:96,carton:48,stock:"in"},
    {ref:"NV-COL-10",name:"CollagenPlus",cat:"Articulations",glyph:"≡",
     desc:"Collagène hydrolysé type II, glucosamine et chondroïtine pour le confort articulaire. 240 g.",
     price:198,carton:18,stock:"in"},
    {ref:"NV-SUN-50",name:"SunBarrier SPF50+",cat:"Cosmétique",glyph:"☀",
     desc:"Protection solaire très haute, large spectre UVA/UVB, fini invisible non gras. Tube 50 ml.",
     price:174,carton:24,stock:"low"},
    {ref:"NV-FLO-12B",name:"FloraBalance",cat:"Probiotiques",glyph:"∞",
     desc:"12 milliards UFC, 8 souches probiotiques gastro-résistantes. Équilibre intestinal. 30 gélules.",
     price:156,carton:30,stock:"out"},
    {ref:"NV-VTB-8",name:"VitaBoost B-Complex",cat:"Énergie",glyph:"⚡",
     desc:"Complexe des 8 vitamines B, soutien énergétique et métabolisme. 60 comprimés.",
     price:88,carton:48,stock:"in"}
  ];

  var TVA_RATE=0.20; // 20% TVA Maroc

  function byRef(ref){ for(var i=0;i<PRODUCTS.length;i++){ if(PRODUCTS[i].ref===ref) return PRODUCTS[i]; } return null; }

  // cart shape: { "NV-OMG-3000": 2, ... }  (value = number of cartons)
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
    fmt:function(n){ return Math.round(n).toLocaleString('fr-FR'); },

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
