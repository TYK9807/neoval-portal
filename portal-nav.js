/* ============================================================
   NEOVAL PHARMA — shared mobile navigation
   Injects a hamburger button + slide-in drawer into the portal /
   admin topbar (#bar). Reads each page's existing .bar-nav links,
   account (.who) and logout so every page gets a consistent,
   reachable menu on phones & tablets. Desktop is untouched
   (the burger is display:none above the breakpoint via CSS).
   ============================================================ */
(function () {
  function build() {
    var bar = document.getElementById('bar');
    if (!bar) return;
    var wrap = bar.querySelector('.wrap');
    if (!wrap || wrap.querySelector('.nav-burger')) return;

    /* ---- hamburger button (clusters to the right via CSS) ---- */
    var burger = document.createElement('button');
    burger.className = 'nav-burger';
    burger.type = 'button';
    burger.setAttribute('aria-label', 'Ouvrir le menu');
    burger.setAttribute('aria-expanded', 'false');
    burger.innerHTML = '<span></span><span></span><span></span>';
    wrap.appendChild(burger);

    /* ---- backdrop + drawer ---- */
    var backdrop = document.createElement('div');
    backdrop.className = 'mnav-backdrop';

    var drawer = document.createElement('aside');
    drawer.className = 'mnav-drawer';
    drawer.setAttribute('aria-hidden', 'true');

    /* head */
    var head = document.createElement('div');
    head.className = 'mnav-head';
    head.innerHTML = '<span class="mnav-label">Menu</span>' +
      '<button class="mnav-close" type="button" aria-label="Fermer le menu">&times;</button>';
    drawer.appendChild(head);

    /* nav links — cloned from the page's .bar-nav */
    var nav = document.createElement('nav');
    nav.className = 'mnav-links';
    var srcLinks = bar.querySelectorAll('.bar-nav a');
    srcLinks.forEach(function (a) {
      var link = document.createElement('a');
      link.href = a.getAttribute('href');
      link.className = 'mnav-link' + (a.classList.contains('active') ? ' active' : '');
      link.innerHTML = '<span class="mnav-txt">' + a.textContent.trim() + '</span>';
      nav.appendChild(link);
    });
    drawer.appendChild(nav);

    /* footer — account + cart + logout */
    var foot = document.createElement('div');
    foot.className = 'mnav-foot';

    var who = bar.querySelector('.who');
    if (who) {
      var av = who.querySelector('.av');
      var n = who.querySelector('.meta .n');
      var r = who.querySelector('.meta .r');
      var href = who.getAttribute('href');
      var accountTag = href ? 'a' : 'div';
      var account = document.createElement(accountTag);
      account.className = 'mnav-account';
      if (href) account.href = href;
      account.innerHTML =
        '<span class="mnav-av">' + (av ? av.textContent.trim() : '') + '</span>' +
        '<span class="mnav-id">' +
          '<span class="mnav-name">' + (n ? n.textContent.trim() : 'Mon compte') + '</span>' +
          (r ? '<span class="mnav-role">' + r.textContent.trim() + '</span>' : '') +
        '</span>';
      foot.appendChild(account);
    }

    var cart = bar.querySelector('.cartlink');
    if (cart) {
      var cartCount = cart.querySelector('.cn');
      var cl = document.createElement('a');
      cl.className = 'mnav-cart';
      cl.href = cart.getAttribute('href');
      cl.innerHTML = 'Ma commande <span class="mnav-cn">' + (cartCount ? cartCount.textContent.trim() : '0') + '</span>';
      foot.appendChild(cl);
      /* keep the drawer cart count in sync with the live badge */
      window.addEventListener('cart:change', function () {
        if (cartCount) cl.querySelector('.mnav-cn').textContent = cartCount.textContent.trim();
      });
    }

    var logout = bar.querySelector('.logout');
    if (logout) {
      var lo = document.createElement('a');
      lo.className = 'mnav-logout';
      lo.href = logout.getAttribute('href');
      lo.textContent = logout.textContent.trim();
      foot.appendChild(lo);
    }

    drawer.appendChild(foot);

    document.body.appendChild(backdrop);
    document.body.appendChild(drawer);

    /* ---- open / close wiring ---- */
    function open() {
      drawer.classList.add('open');
      backdrop.classList.add('show');
      burger.classList.add('active');
      burger.setAttribute('aria-expanded', 'true');
      drawer.setAttribute('aria-hidden', 'false');
      /* Avoid body overflow:hidden — it causes iOS Safari to misplace position:fixed elements.
         The drawer itself has overscroll-behavior:contain to prevent scroll bleed-through. */
    }
    function close() {
      drawer.classList.remove('open');
      backdrop.classList.remove('show');
      burger.classList.remove('active');
      burger.setAttribute('aria-expanded', 'false');
      drawer.setAttribute('aria-hidden', 'true');
    }
    function toggle() { drawer.classList.contains('open') ? close() : open(); }

    burger.addEventListener('click', toggle);
    backdrop.addEventListener('click', close);
    head.querySelector('.mnav-close').addEventListener('click', close);
    drawer.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', close); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && drawer.classList.contains('open')) close();
    });
    /* close if the viewport grows back to desktop */
    window.addEventListener('resize', function () {
      if (window.innerWidth > 900 && drawer.classList.contains('open')) close();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();

/* ============================================================
   NEOVAL PHARMA — animated portal background
   Injects 4 soft floating light orbs (teal, gold, seafoam,
   powder-blue) with independent drift animations + smooth
   mouse-parallax at layered depths. All via JS so every portal
   page picks it up automatically. Respects prefers-reduced-motion.
   ============================================================ */
(function () {
  var CSS = [
    /* container: sits above the dot-grid (z:1), below content (z:5) */
    '.bg-orbs{position:fixed;inset:0;z-index:2;pointer-events:none;overflow:hidden;}',
    /* parallax wrapper — JS writes transform here; no animation so it composes cleanly */
    '.bg-op{position:absolute;inset:0;}',
    /* base orb style */
    '.bg-orb{position:absolute;border-radius:50%;will-change:transform;}',

    /* ---- orb 1: teal, top-left ---- */
    '.bg-orb-1{width:680px;height:680px;top:-14%;left:-10%;',
      'background:radial-gradient(circle at 42% 42%, rgba(13,191,168,.34) 0%, transparent 64%);',
      'filter:blur(52px);animation:bgF1 23s ease-in-out infinite;}',

    /* ---- orb 2: warm gold, top-right ---- */
    '.bg-orb-2{width:540px;height:540px;top:-8%;right:-8%;',
      'background:radial-gradient(circle at 58% 38%, rgba(214,170,50,.28) 0%, transparent 64%);',
      'filter:blur(56px);animation:bgF2 31s ease-in-out infinite;}',

    /* ---- orb 3: seafoam, bottom-right ---- */
    '.bg-orb-3{width:620px;height:620px;bottom:-18%;right:4%;',
      'background:radial-gradient(circle at 50% 58%, rgba(46,198,176,.24) 0%, transparent 64%);',
      'filter:blur(60px);animation:bgF3 37s ease-in-out infinite;}',

    /* ---- orb 4: powder-blue, bottom-left ---- */
    '.bg-orb-4{width:480px;height:480px;bottom:-10%;left:14%;',
      'background:radial-gradient(circle at 46% 52%, rgba(72,148,218,.20) 0%, transparent 64%);',
      'filter:blur(48px);animation:bgF4 27s ease-in-out infinite;}',

    /* ---- float keyframes (each a unique wander path) ---- */
    '@keyframes bgF1{0%,100%{transform:translate(0,0) scale(1)}',
      '30%{transform:translate(42px,28px) scale(1.06)}',
      '65%{transform:translate(-20px,52px) scale(.96)}}',

    '@keyframes bgF2{0%,100%{transform:translate(0,0) scale(1)}',
      '38%{transform:translate(-48px,38px) scale(1.08)}',
      '72%{transform:translate(-28px,-24px) scale(.94)}}',

    '@keyframes bgF3{0%,100%{transform:translate(0,0) scale(1)}',
      '26%{transform:translate(-38px,-30px) scale(1.05)}',
      '64%{transform:translate(32px,-50px) scale(.96)}}',

    '@keyframes bgF4{0%,100%{transform:translate(0,0) scale(1)}',
      '44%{transform:translate(58px,-40px) scale(1.07)}',
      '76%{transform:translate(22px,34px) scale(.95)}}',

    /* reduced-motion: freeze all float animations */
    '@media(prefers-reduced-motion:reduce){',
      '.bg-orb{animation:none!important;}}'
  ].join('');

  var ORB_DEPTHS = [0.85, -0.55, 0.70, -0.45];

  function buildBg() {
    if (document.querySelector('.bg-orbs')) return;

    /* inject styles */
    var s = document.createElement('style');
    s.textContent = CSS;
    document.head.appendChild(s);

    /* build orb container */
    var container = document.createElement('div');
    container.className = 'bg-orbs';

    var ops = ORB_DEPTHS.map(function (depth, i) {
      var op = document.createElement('div');
      op.className = 'bg-op';
      op.dataset.depth = depth;
      var orb = document.createElement('div');
      orb.className = 'bg-orb bg-orb-' + (i + 1);
      op.appendChild(orb);
      container.appendChild(op);
      return op;
    });

    /* insert right after #bg-glow if it exists, else before first child */
    var bgGlow = document.getElementById('bg-glow');
    if (bgGlow && bgGlow.parentNode) {
      bgGlow.parentNode.insertBefore(container, bgGlow.nextSibling);
    } else {
      document.body.insertBefore(container, document.body.firstChild);
    }

    /* skip parallax for reduced-motion users and touch-only devices
       (touch devices have no mousemove to drive the lerp, so a perpetual
       rAF loop would run at 60fps doing nothing useful — pure wasted CPU) */
    if (window.matchMedia('(prefers-reduced-motion:reduce)').matches) return;
    if (window.matchMedia('(hover:none)').matches) return;

    /* smooth mouse-parallax: lerp cursor → orb position each frame */
    var tx = 0, ty = 0, cx = 0, cy = 0;
    function lerp(a, b, t) { return a + (b - a) * t; }

    document.addEventListener('mousemove', function (e) {
      tx = (e.clientX / window.innerWidth  - 0.5) * 2; /* -1 → +1 */
      ty = (e.clientY / window.innerHeight - 0.5) * 2;
    });

    (function tick() {
      cx = lerp(cx, tx, 0.055);
      cy = lerp(cy, ty, 0.055);
      ops.forEach(function (op) {
        var d = parseFloat(op.dataset.depth);
        op.style.transform =
          'translate(' + (cx * d * 30).toFixed(2) + 'px,' +
                         (cy * d * 22).toFixed(2) + 'px)';
      });
      requestAnimationFrame(tick);
    })();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildBg);
  } else {
    buildBg();
  }
})();
