/* admin-nav.js — avatar dropdown + profile modal, shared across all admin pages */
(function(){
  var URL_ = 'https://nxlvdwqvkvgjvellmnic.supabase.co';
  var KEY_ = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54bHZkd3F2a3ZnanZlbGxtbmljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MTIwNDcsImV4cCI6MjA5NzI4ODA0N30.qF8GNEtYeZpgvQbysSVVUgUQGhZ-0ksK-LWK4KxyjJM';

  var MODAL =
    '<div id="nvProfModal" class="nv-modal" hidden>' +
      '<div class="nv-modal-panel">' +
        '<div class="nv-modal-head">' +
          '<span class="nv-modal-kicker">Mon profil</span>' +
          '<button class="nv-modal-close" id="nvProfClose">&#x2715;</button>' +
        '</div>' +
        '<p class="nv-modal-sub">Modifiez votre nom ou votre mot de passe.</p>' +
        '<div class="nv-frow"><label class="nv-flabel">Nom complet</label>' +
          '<input class="nv-finput" type="text" id="nvProfName"></div>' +
        '<div class="nv-frow"><label class="nv-flabel">Email</label>' +
          '<input class="nv-finput" type="email" id="nvProfEmail" disabled></div>' +
        '<div class="nv-frow"><label class="nv-flabel">Nouveau mot de passe <span style="font-weight:400;opacity:.6">(laisser vide pour ne pas modifier)</span></label>' +
          '<input class="nv-finput" type="password" id="nvProfPwd" autocomplete="new-password"></div>' +
        '<div class="nv-modal-foot">' +
          '<button class="nv-modal-btn" id="nvProfSave">Enregistrer</button>' +
          '<span class="nv-modal-msg" id="nvProfMsg"></span>' +
        '</div>' +
      '</div>' +
    '</div>';

  function getClient(){
    return window._sb || window.supabase.createClient(URL_, KEY_, { auth: { storageKey: 'nv-admin' } });
  }

  document.addEventListener('DOMContentLoaded', function(){
    document.body.insertAdjacentHTML('beforeend', MODAL);

    var whoBtn  = document.getElementById('whoBtn');
    var whoMenu = document.getElementById('whoMenu');
    var whoLogout  = document.getElementById('whoLogout');
    var whoProfile = document.getElementById('whoProfile');

    var profModal = document.getElementById('nvProfModal');
    var profClose = document.getElementById('nvProfClose');
    var profSave  = document.getElementById('nvProfSave');
    var profMsg   = document.getElementById('nvProfMsg');

    /* ── dropdown toggle ── */
    if (whoBtn && whoMenu) {
      whoBtn.addEventListener('click', function(e){
        e.stopPropagation();
        var isOpen = !whoMenu.hidden;
        whoMenu.hidden = isOpen;
        whoBtn.setAttribute('aria-expanded', String(!isOpen));
      });
      document.addEventListener('click', function(){
        if (whoMenu && !whoMenu.hidden){
          whoMenu.hidden = true;
          whoBtn.setAttribute('aria-expanded', 'false');
        }
      });
      whoMenu.addEventListener('click', function(e){ e.stopPropagation(); });
    }

    /* ── sign out ── */
    if (whoLogout) {
      whoLogout.addEventListener('click', async function(){
        var sb = getClient();
        await sb.auth.signOut();
        window.location.href = 'Admin Login.html';
      });
    }

    /* ── open profile modal ── */
    if (whoProfile) {
      whoProfile.addEventListener('click', async function(e){
        e.preventDefault();
        if (whoMenu) whoMenu.hidden = true;
        var sb = getClient();
        var { data: { user } } = await sb.auth.getUser();
        if (!user) return;
        var { data: profile } = await sb.from('users').select('name,email').eq('id', user.id).single();
        document.getElementById('nvProfName').value  = (profile && profile.name)  || '';
        document.getElementById('nvProfEmail').value = (profile && profile.email) || user.email || '';
        document.getElementById('nvProfPwd').value   = '';
        profMsg.textContent = '';
        profMsg.style.color = '';
        profModal.hidden = false;
      });
    }

    /* ── close profile modal ── */
    if (profClose) profClose.addEventListener('click', function(){ profModal.hidden = true; });
    if (profModal) profModal.addEventListener('click', function(e){ if (e.target === this) this.hidden = true; });

    /* ── save profile ── */
    if (profSave) {
      profSave.addEventListener('click', async function(){
        var name = document.getElementById('nvProfName').value.trim();
        var pwd  = document.getElementById('nvProfPwd').value;
        if (!name) { profMsg.textContent = 'Le nom est requis.'; return; }

        profSave.disabled = true;
        profSave.textContent = '…';
        profMsg.textContent  = '';

        var sb = getClient();
        var { data: { user } } = await sb.auth.getUser();

        var { error: nameErr } = await sb.from('users').update({ name: name }).eq('id', user.id);
        if (nameErr) {
          profMsg.textContent = 'Erreur : ' + nameErr.message;
          profSave.disabled = false; profSave.textContent = 'Enregistrer';
          return;
        }

        if (pwd) {
          var { error: pwdErr } = await sb.auth.updateUser({ password: pwd });
          if (pwdErr) {
            profMsg.textContent = 'Nom mis à jour. Mot de passe : ' + pwdErr.message;
            profSave.disabled = false; profSave.textContent = 'Enregistrer';
            return;
          }
        }

        var nameEl = document.querySelector('.who .meta .n');
        var avEl   = document.querySelector('.who .av');
        if (nameEl) nameEl.textContent = name;
        if (avEl)   avEl.textContent   = (name.split(' ').map(function(w){ return w[0]||''; }).join('').slice(0,2) || name.slice(0,2) || 'A').toUpperCase();

        profMsg.textContent = 'Enregistré ✓';
        profMsg.style.color = '#0DBFA8';
        setTimeout(function(){
          profModal.hidden = true;
          profMsg.textContent = '';
          profMsg.style.color = '';
        }, 1400);
        profSave.disabled = false; profSave.textContent = 'Enregistrer';
      });
    }
  });
})();
