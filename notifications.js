import { supabase } from './supabase-client.js'

const CSS = `
.notif-wrap{position:relative}
.notif-btn{position:relative;width:36px;height:36px;border:1px solid var(--hair);background:transparent;
  cursor:pointer;display:grid;place-items:center;color:var(--body);
  transition:color .25s,border-color .25s;flex:0 0 auto;padding:0}
.notif-btn:hover,.notif-btn.open{color:var(--teal);border-color:var(--teal)}
.notif-btn svg{width:16px;height:16px;stroke:currentColor;fill:none;
  stroke-width:2;stroke-linecap:round;stroke-linejoin:round;display:block}
.notif-btn.ring{animation:nv-ring .5s ease}
@keyframes nv-ring{0%,100%{transform:rotate(0)}20%{transform:rotate(-16deg)}
  40%{transform:rotate(16deg)}60%{transform:rotate(-8deg)}80%{transform:rotate(8deg)}}
.notif-badge{position:absolute;top:-5px;right:-5px;min-width:17px;height:17px;
  padding:0 4px;border-radius:9px;background:var(--teal);color:var(--navy);
  font-family:'IBM Plex Mono',monospace;font-size:10px;display:grid;
  place-items:center;line-height:1;pointer-events:none}
.notif-badge[hidden]{display:none}
.notif-panel{position:absolute;top:calc(100% + 10px);right:0;width:340px;
  max-width:calc(100vw - 24px);background:var(--glass);border:1px solid var(--hair);
  backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);z-index:200;
  box-shadow:0 8px 32px rgba(0,0,0,.12)}
.notif-panel[hidden]{display:none}
.notif-ph{display:flex;align-items:center;justify-content:space-between;
  padding:14px 18px;border-bottom:1px solid var(--hair)}
.notif-ph-lbl{font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.14em;
  text-transform:uppercase;color:var(--faint)}
.notif-markall{font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.1em;
  text-transform:uppercase;color:var(--teal);background:transparent;border:0;
  cursor:pointer;padding:0;transition:opacity .2s}
.notif-markall:hover{opacity:.7}
.notif-list{max-height:360px;overflow-y:auto}
.notif-empty{padding:28px 18px;font-size:13px;color:var(--faint);text-align:center}
.notif-item{display:flex;gap:12px;padding:14px 18px;border-bottom:1px solid var(--hair);
  cursor:pointer;transition:background .2s;text-align:left;width:100%;
  background:transparent;color:var(--white);font-family:inherit;
  border-left:0;border-right:0;border-top:0}
.notif-item:last-child{border-bottom:0}
.notif-item:hover{background:rgba(13,191,168,.045)}
.notif-item.unread{background:rgba(13,191,168,.06)}
.notif-item.unread:hover{background:rgba(13,191,168,.1)}
.notif-dot{flex:0 0 auto;width:7px;height:7px;border-radius:50%;background:var(--teal);
  margin-top:6px;opacity:0;transition:opacity .2s}
.notif-item.unread .notif-dot{opacity:1}
.notif-content{flex:1;min-width:0}
.notif-title{font-size:13px;font-weight:500;color:var(--white);line-height:1.3;
  margin-bottom:3px;display:block}
.notif-body{font-size:12px;color:var(--body);line-height:1.4;margin-bottom:4px;
  display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.notif-time{font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.06em;
  color:var(--faint);display:block}
`

let _items = []
let _channel = null

export async function initNotifications(userId, role) {
  _injectStyles()
  _wireEvents()
  await _load()
  _subscribeRealtime(userId, role)
}

function _injectStyles() {
  if (document.getElementById('nv-notif-css')) return
  const s = document.createElement('style')
  s.id = 'nv-notif-css'
  s.textContent = CSS
  document.head.appendChild(s)
}

function _wireEvents() {
  const btn     = document.getElementById('notifBtn')
  const markAll = document.getElementById('notifMarkAll')
  if (!btn) return
  btn.addEventListener('click', e => { e.stopPropagation(); _togglePanel() })
  if (markAll) markAll.addEventListener('click', _markAll)
  document.addEventListener('click', _outsideClick)
}

function _togglePanel() {
  const btn   = document.getElementById('notifBtn')
  const panel = document.getElementById('notifPanel')
  if (!panel) return
  const opening = panel.hidden
  panel.hidden = !panel.hidden
  if (btn) btn.classList.toggle('open', opening)
}

function _outsideClick(e) {
  const wrap = document.querySelector('.notif-wrap')
  if (!wrap || wrap.contains(e.target)) return
  const panel = document.getElementById('notifPanel')
  const btn   = document.getElementById('notifBtn')
  if (panel) panel.hidden = true
  if (btn)   btn.classList.remove('open')
}

async function _load() {
  const cutoff = Date.now() - 300_000
  for (const k of Object.keys(localStorage)) {
    if (k.startsWith('nv:bell:') && Number(localStorage.getItem(k)) < cutoff) localStorage.removeItem(k)
  }
  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('read', false)
    .order('created_at', { ascending: false })
    .limit(30)
  _items = data || []
  _render()
}

function _render() {
  const list  = document.getElementById('notifList')
  const badge = document.getElementById('notifBadge')
  if (!list || !badge) return
  const unread = _items.filter(n => !n.read).length
  badge.textContent = unread > 99 ? '99+' : String(unread)
  badge.hidden = unread === 0
  if (!_items.length) {
    list.innerHTML = '<div class="notif-empty">Aucune notification</div>'
    return
  }
  list.innerHTML = _items.map(n => `
    <button class="notif-item${n.read ? '' : ' unread'}" data-id="${n.id}" data-link="${_esc(n.link || '')}">
      <span class="notif-dot"></span>
      <span class="notif-content">
        <span class="notif-title">${_esc(n.title)}</span>
        ${n.body ? `<span class="notif-body">${_esc(n.body)}</span>` : ''}
        <span class="notif-time">${_reltime(n.created_at)}</span>
      </span>
    </button>`).join('')
  list.querySelectorAll('.notif-item').forEach(el => {
    el.addEventListener('click', () => _clickItem(el.dataset.id, el.dataset.link))
  })
}

async function _clickItem(id, link) {
  await _markRead(id)
  if (link) {
    const p = window.location.pathname
    const base = p.includes('/admin/')
      ? p.substring(0, p.indexOf('/admin/'))
      : p.substring(0, p.lastIndexOf('/'))
    window.location.href = encodeURI(base + link)
  } else {
    const p = document.getElementById('notifPanel')
    if (p) p.hidden = true
  }
}

async function _markRead(id) {
  const item = _items.find(n => n.id === id)
  if (!item || item.read) return
  item.read = true
  _render()
  await supabase.from('notifications').update({ read: true }).eq('id', id)
}

async function _markAll() {
  const ids = _items.filter(n => !n.read).map(n => n.id)
  if (!ids.length) return
  _items.forEach(n => { n.read = true })
  _render()
  await supabase.from('notifications').update({ read: true }).in('id', ids)
}

function _subscribeRealtime(userId, role) {
  if (_channel) return
  _channel = supabase
    .channel('nv-notifications')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, payload => {
      const n = payload.new
      if (n.user_id !== null && n.user_id !== userId) return
      if (n.user_id === null && n.target_role !== role) return
      if (!_items.some(x => x.id === n.id)) {
        _items.unshift(n)
        _render()
      }
      const bellKey = 'nv:bell:' + n.id
      if (!localStorage.getItem(bellKey)) {
        localStorage.setItem(bellKey, String(Date.now()))
        const btn = document.getElementById('notifBtn')
        if (btn) {
          btn.classList.add('ring')
          btn.addEventListener('animationend', () => btn.classList.remove('ring'), { once: true })
        }
      }
    })
    .subscribe()
}

function _reltime(iso) {
  const d    = new Date(iso)
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60)    return "À l'instant"
  if (diff < 3600)  return Math.floor(diff / 60) + ' min'
  if (diff < 86400) return Math.floor(diff / 3600) + 'h'
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

function _esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
