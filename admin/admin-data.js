(function(){
  var SUPABASE_URL = 'https://nxlvdwqvkvgjvellmnic.supabase.co';
  var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54bHZkd3F2a3ZnanZlbGxtbmljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MTIwNDcsImV4cCI6MjA5NzI4ODA0N30.qF8GNEtYeZpgvQbysSVVUgUQGhZ-0ksK-LWK4KxyjJM';
  var sb = null; // initialised in DOMContentLoaded after ES modules have run

  var LABELS = { attente:'En attente', confirme:'Confirmé', livre:'Livré', annule:'Annulé' };
  var ORDER  = ['attente','confirme','livre'];

  function bucket(s){
    s = (s||'').toLowerCase();
    if(s.indexOf('annul')   > -1) return 'annule';
    if(s.indexOf('livr')    > -1) return 'livre';
    if(s.indexOf('attente') > -1) return 'attente';
    return 'confirme';
  }
  function fmt(n){if(!n&&n!==0)return'0';var num=Number(n);if(isNaN(num))return'0';var fixed=num.toFixed(2);var parts=fixed.split('.');parts[0]=parts[0].replace(/\B(?=(\d{3})+(?!\d))/g,'');return parts[1]==='00'?parts[0]:parts[0]+','+parts[1];}

  var _orders = [];

  function emit(event, detail){
    try{ window.dispatchEvent(new CustomEvent(event, {detail: detail})); }catch(e){}
  }

  function shapeOrder(row){
    var user  = row.users || {};
    var items = (row.order_items || []).map(function(it){
      return {
        name:      it.products ? it.products.name : '—',
        qty:       it.quantity,
        unit_price:it.unit_price,
        lineTotal: it.quantity * it.unit_price
      };
    });
    return {
      id:        'CMD-' + row.id.substring(0, 8).toUpperCase(),
      _uuid:     row.id,
      date:      row.created_at,
      status:    row.status,
      total:     row.total || 0,
      pharmacy:  user.name || user.email || '—',
      city:      '—',
      items:     items,
      lineCount: items.length,
      units:     items.reduce(function(s, it){ return s + it.qty; }, 0),
      blGenerated: (function(){ var b=bucket(row.status); return b!=='attente'&&b!=='annule'; })()
    };
  }

  function loadOrders(){
    return sb
      .from('orders')
      .select('*, users!placed_by(name, email), order_items(quantity, unit_price, products(name))')
      .order('created_at', { ascending: false })
      .then(function(res){
        if(res.error){ console.error('Admin loadOrders:', res.error); return; }
        _orders = (res.data || []).map(shapeOrder);
        emit('admin:orders', _orders);
      });
  }

  function findOrder(id){
    return _orders.filter(function(o){ return o.id === id || o._uuid === id; })[0] || null;
  }

  // Returns the current admin user ID from the shared session, or null.
  function currentUserId(){
    return sb.auth.getSession().then(function(res){
      return res.data && res.data.session ? res.data.session.user.id : null;
    });
  }

  var Admin = {
    LABELS: LABELS, ORDER: ORDER, bucket: bucket, fmt: fmt,
    PRODUCTS: [],

    getOrders: function(){ return _orders.slice(); },
    getOrder:  function(id){ return findOrder(id); },

    confirmOrder: function(id){
      var o = findOrder(id); if(!o) return Promise.resolve();
      return currentUserId().then(function(uid){
        return sb.rpc('confirm_order', { p_order_id: o._uuid, p_admin_id: uid })
          .then(function(res){
            if(res.error){ console.error('confirmOrder:', res.error); return loadOrders(); }
            if(!res.data.ok){
              var names = (res.data.insufficient || []).join(', ');
              alert('Stock insuffisant pour : ' + names + '. Commande non confirmée.');
            }
            return loadOrders();
          });
      });
    },

    markDelivered: function(id){
      var o = findOrder(id); if(!o) return Promise.resolve();
      return currentUserId().then(function(uid){
        return sb.from('orders')
          .update({
            status:       'Livré',
            delivered_by: uid,
            delivered_at: new Date().toISOString()
          })
          .eq('id', o._uuid)
          .then(function(r){
            if(r.error){ console.error('markDelivered:', r.error); }
            return loadOrders();
          });
      });
    },

    generateBL: function(id){
      console.log('[placeholder] generateBL', id);
    },

    getStock:   function(){ return {}; },
    stockOf:    function(){ return 0; },
    setStock:   function(ref, qty){ console.log('[placeholder] setStock', ref, qty); },
    // Consistent with Catalogue.html (< 50 → low, 0 → out)
    stockState: function(qty){ if(qty <= 0) return 'out'; if(qty < 50) return 'low'; return 'in'; },

    reload: loadOrders
  };

  window.NeovalAdmin = Admin;

  document.addEventListener('DOMContentLoaded', function(){
    // window._sb is set by supabase-client.js (ES module) which runs before DOMContentLoaded.
    // Fall back to the UMD global only if the module client is somehow unavailable.
    sb = window._sb || window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { storageKey: 'nv-admin' } });
    loadOrders();
  });
})();
