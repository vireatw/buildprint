/*! 築跡 Buildprint — website backend (Firebase)
 *
 * index.html was first written to run inside Claude, where `window.claude.use(name)` hands out
 * the database, the signed-in user, file storage and downloads. On buildprint.tw this file
 * provides the same four things on top of Firebase, so index.html barely needs to know the
 * difference. It also owns the sign-in screen and the 成員與邀請碼 card in 設定.
 *
 *   db        → Firestore (same paths as before: site/info, sites/{id}, reports/{date}, punch/{uid}, …)
 *   user      → Firebase Auth + members/{uid} (role 'edit' | 'view') + admins/{uid}
 *   assets    → photos and drawings stored in Firestore (blobs/{id} + blobs/{id}/parts/{n}),
 *               so the free Spark plan is enough; no Firebase Storage needed
 *   downloads → a normal browser download
 */
import { FIREBASE_CONFIG } from './config.js';

const FB = window.BP_FB_BASE || 'https://www.gstatic.com/firebasejs/10.12.2/';
const W = window.BP_WEB;                       // stub created in index.html <head>
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let A, F, app, auth, db;                       // firebase-auth / firebase-firestore modules
let me = null;                                 // { uid, email, name, role: 'admin'|'edit'|'view' }

/* ---------------- start ---------------- */
async function boot() {
  overlay('loading');
  try {
    const [fa, aa, fs] = await Promise.all([import(FB + 'firebase-app.js'), import(FB + 'firebase-auth.js'), import(FB + 'firebase-firestore.js')]);
    A = aa; F = fs;
    app = fa.initializeApp(FIREBASE_CONFIG);
    auth = A.getAuth(app);
    try {
      db = F.initializeFirestore(app, { ignoreUndefinedProperties: true, localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }) });
    } catch (e) { db = F.initializeFirestore(app, { ignoreUndefinedProperties: true }); }
  } catch (e) {
    console.error(e); overlay('error', '連不上伺服器，請確認網路後重新整理。'); return;
  }
  A.onAuthStateChanged(auth, async u => {
    if (registering) return;   // the 註冊 form finishes its own sign-up
    if (u && handled === u.uid) return;   // already dealt with this sign-in (e.g. right after 註冊)
    handled = u ? u.uid : null;
    if (!u) { me = null; overlay('signin'); return; }
    overlay('loading');
    try { await resolveMember(u); }
    catch (e) { console.error(e); overlay('error', '讀取帳號資料失敗（' + (e.code || e.message) + '）。請重新整理。'); return; }
    if (!me.role) { overlay('join'); return; }
    enter();
  });
}

async function resolveMember(u) {
  me = { uid: u.uid, email: u.email || '', name: u.displayName || '', role: null };
  const [ad, mb] = await Promise.all([
    F.getDoc(F.doc(db, 'admins/' + u.uid)).catch(() => null),
    F.getDoc(F.doc(db, 'members/' + u.uid)).catch(() => null),
  ]);
  if (ad && ad.exists()) me.role = 'admin';
  else if (mb && mb.exists()) me.role = (mb.data().role === 'edit') ? 'edit' : 'view';
  if (!me.name && mb && mb.exists()) me.name = mb.data().name || '';
  if (!me.name) me.name = (me.email || '').split('@')[0];
  if (me.role) {   // keep the public name card up to date (used for 「誰填的」 and 打卡 names)
    F.setDoc(F.doc(db, 'profiles/' + u.uid), { name: me.name }, { merge: true }).catch(() => {});
  }
}

let entered = null, handled = null;
function enter() {
  overlay(null);
  if (entered) { if (entered !== me.uid) location.reload(); return; }   // switching accounts: start the app fresh
  entered = me.uid;
  window.claude = { use: async name => CAPS[name] ? CAPS[name]() : null };
  W._resolve();
}

/* ---------------- db: the small Firestore-like API index.html was written against ---------------- */
const docSnap = s => ({ id: s.id, exists: s.exists(), data: () => s.data(), metadata: { fromCache: !!(s.metadata && s.metadata.fromCache) } });
const qSnap = q => ({ size: q.size, docs: q.docs.map(d => ({ id: d.id, exists: true, data: () => d.data() })), metadata: { fromCache: !!(q.metadata && q.metadata.fromCache) } });
const fsErr = e => { if (e && !e.code) e.code = 'unknown'; return e; };
function docApi(path) {
  const r = F.doc(db, path);
  return {
    get: async () => docSnap(await F.getDoc(r)),
    set: (v, o) => F.setDoc(r, v, o || {}).catch(e => { throw fsErr(e); }),
    update: v => F.updateDoc(r, v).catch(e => { throw fsErr(e); }),
    delete: () => F.deleteDoc(r).catch(e => { throw fsErr(e); }),
    onSnapshot: (ok, err) => F.onSnapshot(r, { includeMetadataChanges: true }, s => ok(docSnap(s)), e => err && err(fsErr(e))),
  };
}
function colApi(path, cons) {
  cons = cons || [];
  const q = () => F.query(F.collection(db, path), ...cons);
  return {
    orderBy: (f, d) => colApi(path, cons.concat(F.orderBy(f, d || 'asc'))),
    limit: n => colApi(path, cons.concat(F.limit(n))),
    where: (f, op, v) => colApi(path, cons.concat(F.where(f, op, v))),
    get: async () => qSnap(await F.getDocs(q())),
    onSnapshot: (ok, err) => F.onSnapshot(q(), { includeMetadataChanges: true }, s => ok(qSnap(s)), e => err && err(fsErr(e))),
  };
}
const DBAPI = { doc: docApi, collection: path => colApi(path) };

/* ---------------- user ---------------- */
const USERAPI = {
  id: async () => me && me.uid,
  can: async what => what === 'data.write' ? !!(me && (me.role === 'admin' || me.role === 'edit')) : !!me,
  profiles: async ids => {
    const out = {};
    await Promise.all((ids || []).map(async id => {
      try { const s = await F.getDoc(F.doc(db, 'profiles/' + id)); out[id] = { name: s.exists() ? (s.data().name || '') : '' }; }
      catch (e) { out[id] = { name: '' }; }
    }));
    return out;
  },
};

/* ---------------- assets: images and PDFs kept in Firestore, in ≤700 KB pieces ---------------- */
const PART = 700000;                                    // base64 characters per Firestore document (limit is 1 MiB)
const PLACEHOLDER = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7#bp-';
const blobUrl = {}, blobLoading = {};
const rid = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
const b64Of = blob => new Promise((ok, no) => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result).split(',')[1] || ''); fr.onerror = no; fr.readAsDataURL(blob); });

async function fitImage(blob) {   // big drawings: keep them sharp but under ~2 MB
  if (!/^image\/(jpeg|png|webp)/.test(blob.type) || blob.size < 1.8e6) return blob;
  const bmp = await createImageBitmap(blob);
  let max = 3000, q = 0.85, out = blob;
  for (let i = 0; i < 5; i++) {
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(bmp, 0, 0, c.width, c.height);
    out = await new Promise(r => c.toBlob(r, 'image/jpeg', q));
    if (out && out.size < 1.8e6) break;
    max *= 0.8; q = Math.max(0.6, q - 0.08);
  }
  return out || blob;
}
async function putBlob(id, type, b64) {
  const n = Math.max(1, Math.ceil(b64.length / PART));
  for (let i = 0; i < n; i++) await F.setDoc(F.doc(db, `blobs/${id}/parts/${String(i).padStart(3, '0')}`), { d: b64.slice(i * PART, (i + 1) * PART) });
  await F.setDoc(F.doc(db, 'blobs/' + id), { type, n, at: new Date().toISOString(), by: me ? me.uid : '' });   // written last: readers never see half a file
}
const ASSETAPI = {
  upload: async (blob, opts) => {
    if (blob.size > 25e6) { const e = new Error('檔案太大'); e.code = 'too_large'; throw e; }
    let b = await fitImage(blob);
    const type = (opts && opts.type && b === blob) ? opts.type : (b.type || 'application/octet-stream');
    const id = rid();
    try { await putBlob(id, type, await b64Of(b)); } catch (e) { throw fsErr(e); }
    blobUrl[id] = URL.createObjectURL(b);
    return { id };
  },
};
async function loadBlob(id) {
  try {
    const m = await F.getDoc(F.doc(db, 'blobs/' + id));
    if (!m.exists()) throw new Error('missing');
    const { type, n } = m.data();
    const ps = await F.getDocs(F.query(F.collection(db, `blobs/${id}/parts`), F.orderBy(F.documentId())));
    const b64 = ps.docs.map(d => d.data().d || '').join('');
    if (ps.size < n) throw new Error('incomplete');
    const bin = atob(b64), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    blobUrl[id] = URL.createObjectURL(new Blob([u8], { type: type || 'image/jpeg' }));
  } catch (e) { console.warn('blob', id, e); blobUrl[id] = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="4" height="3"><rect width="4" height="3" fill="#ddd"/></svg>'); }
  const ph = PLACEHOLDER + id;
  document.querySelectorAll('img').forEach(im => { if (im.getAttribute('src') === ph) im.src = blobUrl[id]; });
}
W.blobSrc = id => {
  if (blobUrl[id]) return blobUrl[id];
  if (!blobLoading[id] && db) blobLoading[id] = loadBlob(id);
  return PLACEHOLDER + id;
};
W.isPending = src => String(src || '').indexOf('#bp-') > 0;

/* ---------------- downloads ---------------- */
const DLAPI = {
  save: async ({ filename, data }) => {
    const u = URL.createObjectURL(data instanceof Blob ? data : new Blob([data]));
    const a = document.createElement('a'); a.href = u; a.download = filename || 'download'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 60000);
  },
};
const CAPS = { db: () => DBAPI, user: () => USERAPI, assets: () => ASSETAPI, downloads: () => DLAPI };

/* ---------------- sign-in screen ---------------- */
const AUTH_ERR = {
  'auth/invalid-credential': 'Email 或密碼不對', 'auth/wrong-password': 'Email 或密碼不對', 'auth/user-not-found': '找不到這個 Email 的帳號',
  'auth/email-already-in-use': '這個 Email 已經註冊過了，請直接登入', 'auth/weak-password': '密碼至少要 6 個字',
  'auth/invalid-email': 'Email 格式不對', 'auth/too-many-requests': '嘗試太多次，請稍後再試', 'auth/network-request-failed': '網路連線失敗',
  'auth/missing-password': '請輸入密碼',
};
const authMsg = e => AUTH_ERR[e && e.code] || ('發生錯誤：' + ((e && (e.code || e.message)) || e));
const LOGO = '<img class="bplogo" src="icon-512.png?v=2" alt="" aria-hidden="true">';   // the BUILD footprint logo (same file as the home-screen icon)

const CSS = `
#bpGate{position:fixed;inset:0;z-index:9999;background:#15232E;color:#fff;display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:calc(env(safe-area-inset-top) + 48px) 20px 40px;font-family:"Noto Sans TC","PingFang TC",system-ui,sans-serif}
#bpGate[hidden]{display:none}
#bpGate .bx{width:100%;max-width:380px}
#bpGate .hd{display:flex;align-items:center;gap:14px;margin-bottom:26px}
#bpGate .hd .bplogo{width:56px;height:56px;flex:none;display:block}
#bpGate .hd b{display:block;font-size:26px;letter-spacing:.06em}
#bpGate .hd small{color:#9fb0bf;font-size:14px}
#bpGate .tabs{display:flex;background:#22343f;border-radius:12px;padding:4px;margin-bottom:18px}
#bpGate .tabs button{flex:1;border:0;background:none;color:#cfd8e0;font:inherit;font-weight:700;padding:10px;border-radius:9px}
#bpGate .tabs button[aria-pressed=true]{background:#fff;color:#15232E}
#bpGate label{display:block;font-size:14px;color:#cfd8e0;margin:12px 0 6px}
#bpGate input{width:100%;box-sizing:border-box;font:inherit;font-size:17px;padding:12px 14px;border-radius:12px;border:1px solid #3a4d5b;background:#0f1a22;color:#fff}
#bpGate input:focus{outline:2px solid #F2A900;border-color:transparent}
#bpGate .go{width:100%;margin-top:20px;border:0;border-radius:12px;padding:14px;font:inherit;font-weight:700;font-size:17px;background:#F2A900;color:#15232E}
#bpGate .go:disabled{opacity:.6}
#bpGate .lnk{background:none;border:0;color:#9fc3ea;font:inherit;padding:10px 0;text-decoration:underline}
#bpGate .err{color:#ffb4a8;min-height:1.4em;margin-top:12px;font-size:15px}
#bpGate .note{color:#9fb0bf;font-size:14px;line-height:1.6}
#bpGate .uid{display:flex;gap:8px;align-items:center;margin-top:8px}
#bpGate .uid code{flex:1;min-width:0;overflow:auto;background:#0f1a22;border-radius:8px;padding:8px 10px;font-size:13px;color:#cfd8e0}
#bpGate .uid button{border:1px solid #3a4d5b;background:none;color:#fff;border-radius:8px;padding:8px 10px;font:inherit;font-size:14px}
#bpGate .spin{width:28px;height:28px;border:3px solid #3a4d5b;border-top-color:#F2A900;border-radius:50%;animation:bpspin .8s linear infinite;margin:40px auto}
#bpGate.splash{align-items:center;padding-top:env(safe-area-inset-top);padding-bottom:calc(env(safe-area-inset-bottom) + 40px)}
#bpGate.splash .hd{flex-direction:column;gap:0;text-align:center;margin-bottom:0}
#bpGate.splash .hd .bplogo{width:128px;height:128px;margin-bottom:22px}
#bpGate.splash .hd b{font-size:34px;letter-spacing:.18em;padding-left:.18em;line-height:1.2}
#bpGate.splash .hd small{display:block;margin-top:6px;font-size:14px;letter-spacing:.04em}
#bpGate.splash .spin{display:block;margin:34px auto 0}
#bpGate .lockup{display:block;width:200px;max-width:58vw;height:auto;margin:0 auto}
#bpGate .walk{position:relative;width:236px;height:64px;margin:30px auto 0}
#bpGate .walk i{position:absolute;width:44px;height:21px;background:url(logo-print.png?v=1) center/contain no-repeat;opacity:0;transform:rotate(var(--r));animation:bpstep 2.5s cubic-bezier(.3,.7,.4,1) infinite}
@keyframes bpstep{0%{opacity:0;transform:translateY(-6px) scale(.7) rotate(var(--r))}7%{opacity:1;transform:translateY(0) scale(1.1) rotate(var(--r))}13%{transform:scale(1) rotate(var(--r))}55%{opacity:.9}78%,100%{opacity:0;transform:scale(1) rotate(var(--r))}}
@media (prefers-reduced-motion:reduce){#bpGate .walk i{animation:none;opacity:.85}}
#bpGate.splash .err{text-align:center;margin-top:28px}
@keyframes bpspin{to{transform:rotate(360deg)}}
.bp-codes{display:grid;gap:10px;margin:10px 0}
.bp-code{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.bp-code b{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:18px;letter-spacing:.08em}
.bp-code .k{min-width:4.5em;color:var(--muted);font-size:15px}
.bp-mem li{display:flex;align-items:center;gap:8px;padding:10px 0;border-top:1px solid var(--line)}
.bp-mem li:first-child{border-top:0}
.bp-mem .who{flex:1 1 auto;min-width:0}
.bp-mem .who b,.bp-mem .who .note{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bp-mem .seg{flex:none}
.bp-mem .seg button{padding:6px 10px}
.bp-mem .mini{flex:none}
.bp-mem ul{list-style:none;margin:0;padding:0}
#bpStatus{position:fixed;left:16px;right:16px;bottom:calc(env(safe-area-inset-bottom) + 90px);z-index:9000;background:#15232E;color:#fff;border-radius:14px;padding:14px 16px;box-shadow:0 8px 30px rgba(0,0,0,.35);display:flex;gap:12px;align-items:center;justify-content:space-between;font-size:15px;line-height:1.5}
#bpStatus[hidden]{display:none}
#bpStatus .btn{flex:none}
`;
function ensureGate() {
  let g = $('#bpGate'); if (g) return g;
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  g = document.createElement('div'); g.id = 'bpGate'; g.setAttribute('role', 'dialog'); g.setAttribute('aria-label', '登入築跡');
  document.body.appendChild(g); return g;
}
let tab = 'in';
function overlay(state, msg) {
  const g = ensureGate();
  if (!state) { g.hidden = true; g.innerHTML = ''; return; }
  g.hidden = false;
  const head = `<div class="hd">${LOGO}<div><b>築跡</b><small>Buildprint · 工地日報</small></div></div>`;
  g.classList.toggle('splash', state === 'loading' || state === 'error');   // loading: big centred logo, 築跡 underneath
  const lock = `<img class="lockup" src="logo-lockup.png?v=1" alt="築跡 BuildPrint" width="600" height="704">`;   // the full logo: BUILD footprint, 築跡, BuildPrint — in white
  if (state === 'loading') {   // footprints walking across under the logo, one step at a time (築跡: the traces of building)
    const steps = [0, 1, 2, 3, 4].map(i => `<i style="left:${i * 48}px;top:${i % 2 ? 36 : 6}px;--r:${i % 2 ? 7 : -7}deg;animation-delay:${(i * 0.32).toFixed(2)}s"></i>`).join('');
    g.innerHTML = `<div class="bx">${lock}<div class="walk" role="img" aria-label="載入中">${steps}</div></div>`; return; }
  if (state === 'error') { g.innerHTML = `<div class="bx">${lock}<p class="err">${esc(msg)}</p><button class="go" onclick="location.reload()">重新整理</button></div>`; return; }
  if (state === 'join') {
    g.innerHTML = `<div class="bx">${head}
      <p class="note">你好，<b>${esc(me.name)}</b>（${esc(me.email)}）。輸入工地管理員給你的邀請碼就能加入。</p>
      <label for="bpCode">邀請碼</label><input id="bpCode" autocomplete="off" autocapitalize="characters" placeholder="例如 K7Q2-M9PX">
      <button class="go" id="bpJoin">加入</button><p class="err" id="bpErr"></p>
      <p class="note" style="margin-top:28px">你是工地管理員嗎？第一次設定時，要把下面這串帳號 ID 加到 Firebase 的 admins 名單（設定說明第 8 步），再重新整理這頁。</p>
      <div class="uid"><code id="bpUid">${esc(me.uid)}</code><button id="bpCopy">複製</button></div>
      <button class="lnk" id="bpOut">登出，換一個帳號</button></div>`;
    $('#bpCopy').onclick = () => copy(me.uid, $('#bpCopy'));
    $('#bpOut').onclick = () => A.signOut(auth);
    const go = async () => {
      const b = $('#bpJoin'), err = $('#bpErr'); err.textContent = '';
      const code = normCode($('#bpCode').value); if (!code) { err.textContent = '請輸入邀請碼'; return; }
      b.disabled = true;
      try { await joinWith(code); enter(); }
      catch (e) { err.textContent = e.message || authMsg(e); b.disabled = false; }
    };
    $('#bpJoin').onclick = go; $('#bpCode').onkeydown = e => { if (e.key === 'Enter') go(); };
    return;
  }
  // signin
  g.innerHTML = `<div class="bx">${head}
    <div class="tabs" role="tablist"><button data-t="in" aria-pressed="${tab === 'in'}">登入</button><button data-t="up" aria-pressed="${tab === 'up'}">註冊</button></div>
    <form id="bpForm" novalidate>
      ${tab === 'up' ? '<label for="bpName">名字（同事會看到）</label><input id="bpName" autocomplete="name" placeholder="例如 王小明">' : ''}
      <label for="bpEmail">Email</label><input id="bpEmail" type="email" autocomplete="email" inputmode="email" autocapitalize="off">
      <label for="bpPw">密碼${tab === 'up' ? '（至少 6 個字）' : ''}</label><input id="bpPw" type="password" autocomplete="${tab === 'up' ? 'new-password' : 'current-password'}">
      ${tab === 'up' ? '<label for="bpCode">邀請碼</label><input id="bpCode" autocomplete="off" autocapitalize="characters" placeholder="管理員給你的，例如 K7Q2-M9PX">' : ''}
      <button class="go" id="bpGo" type="submit">${tab === 'up' ? '註冊並加入' : '登入'}</button>
    </form>
    <p class="err" id="bpErr"></p>
    ${tab === 'in' ? '<button class="lnk" id="bpReset">忘記密碼</button>' : '<p class="note">工地管理員第一次註冊時，邀請碼可以留空。</p>'}
  </div>`;
  g.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { tab = b.dataset.t; overlay('signin'); });
  const err = $('#bpErr');
  $('#bpForm').onsubmit = async ev => {
    ev.preventDefault(); err.textContent = '';
    const email = $('#bpEmail').value.trim(), pw = $('#bpPw').value, b = $('#bpGo');
    if (!email) { err.textContent = '請輸入 Email'; return; }
    b.disabled = true;
    try {
      if (tab === 'in') { await A.signInWithEmailAndPassword(auth, email, pw); return; }
      const name = $('#bpName').value.trim(), code = normCode($('#bpCode').value);
      if (!name) { err.textContent = '請輸入名字'; b.disabled = false; return; }
      const jc = code || null;
      registering = true;
      const cred = await A.createUserWithEmailAndPassword(auth, email, pw);
      handled = cred.user.uid;
      await A.updateProfile(cred.user, { displayName: name });
      // onAuthStateChanged fired before the name was set: finish here
      me = { uid: cred.user.uid, email, name, role: null };
      await F.setDoc(F.doc(db, 'profiles/' + cred.user.uid), { name }, { merge: true }).catch(() => {});
      if (jc) {
        try { await joinWith(jc); enter(); return; }
        catch (e) { overlay('join'); const er = $('#bpErr'); if (er) er.textContent = e.message; return; }
      }
      await resolveMember(cred.user); if (me.role) enter(); else overlay('join');
    } catch (e) { err.textContent = authMsg(e); b.disabled = false; }
    finally { registering = false; }
  };
  const r = $('#bpReset'); if (r) r.onclick = async () => {
    const email = $('#bpEmail').value.trim(); if (!email) { err.textContent = '先在上面輸入你的 Email，再按忘記密碼'; return; }
    try { await A.sendPasswordResetEmail(auth, email); err.textContent = '已寄出重設密碼的信，請到信箱收信（也看看垃圾郵件）'; }
    catch (e) { err.textContent = authMsg(e); }
  };
}
let registering = false;
const normCode = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^(.{4})(.+)$/, '$1-$2');
async function joinWith(code) {
  let jc;
  try { jc = await F.getDoc(F.doc(db, 'joinCodes/' + code)); } catch (e) { throw new Error('邀請碼不對，請跟管理員確認'); }
  if (!jc.exists()) throw new Error('邀請碼不對，請跟管理員確認');
  const role = jc.data().role === 'edit' ? 'edit' : 'view';
  await F.setDoc(F.doc(db, 'members/' + me.uid), { role, code, name: me.name || '', email: me.email || '', at: new Date().toISOString() });
  await F.setDoc(F.doc(db, 'profiles/' + me.uid), { name: me.name || '' }, { merge: true }).catch(() => {});
  me.role = role;
}
async function copy(text, btn) {
  try { await navigator.clipboard.writeText(text); if (btn) { const t = btn.textContent; btn.textContent = '已複製'; setTimeout(() => btn.textContent = t, 1500); } }
  catch (e) { prompt('複製這段文字', text); }
}

/* ---------------- 設定 → 成員與邀請碼（and 登出、從舊版匯入） ---------------- */
const ROLE_T = { admin: '管理員', edit: '可編輯', view: '只能看' };
W.membersCard = () => {
  if (!me) return '';
  const mine = `<p class="note">你是 <b>${esc(me.name)}</b>（${esc(me.email)}）· ${ROLE_T[me.role] || ''}</p>`;
  const out = '<div class="actions"><button class="btn" id="bpSignOut" type="button">登出</button></div>';
  if (me.role !== 'admin') return `<div class="card"><h2>帳號</h2>${mine}${out}</div>`;
  return `<div class="card" id="bpMembers"><h2>成員與邀請碼</h2>
    <p class="note">把邀請碼傳給同事（LINE 就可以），對方在 buildprint.tw 註冊時輸入就會加入。老闆、主管給「只能看」；工地主任、工程師要填日報，給「可編輯」。</p>
    <div class="bp-codes" id="bpCodes"><span class="note">讀取中…</span></div>
    <div class="actions"><button class="btn" id="bpNewCodes" type="button">換新邀請碼</button></div>
    <p class="note">換新之後舊的邀請碼就不能用了；已經加入的人不受影響。</p>
    <h2 style="margin-top:18px">成員</h2><div class="bp-mem" id="bpMem"><span class="note">讀取中…</span></div>
    ${mine}${out}
  </div>
  <div class="card"><h2>從舊版匯入</h2><p class="note">在舊版（Claude 裡的築跡）設定頁按「匯出全部資料」，再到這裡選那個檔案。同一個工地重複匯入，會用檔案裡的內容覆蓋。</p>
    <div class="actions"><label class="btn"><input type="file" id="bpImport" accept="application/json,.json" hidden>選擇搬家檔案</label></div></div>`;
};
W.wireMembers = () => {
  const so = $('#bpSignOut'); if (so) so.onclick = async () => { await A.signOut(auth); location.reload(); };
  if (!me || me.role !== 'admin' || !$('#bpMembers')) return;
  showCodes(); showMembers();
  $('#bpNewCodes').onclick = async () => { if (!confirm('換新邀請碼？舊的邀請碼會失效。')) return; await makeCodes(true); showCodes(); };
  const imp = $('#bpImport'); if (imp) imp.onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) importFile(f); };
};
const newCode = () => { const A_ = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', r = crypto.getRandomValues(new Uint8Array(8)); let s = ''; r.forEach(x => s += A_[x % A_.length]); return s.slice(0, 4) + '-' + s.slice(4); };
async function makeCodes(replace) {
  const ref = F.doc(db, 'settings/codes'), cur = await F.getDoc(ref);
  if (cur.exists() && !replace) return cur.data();
  if (cur.exists()) { const o = cur.data(); for (const c of [o.edit, o.view]) if (c) await F.deleteDoc(F.doc(db, 'joinCodes/' + c)).catch(() => {}); }
  const v = { edit: newCode(), view: newCode(), at: new Date().toISOString() };
  await F.setDoc(F.doc(db, 'joinCodes/' + v.edit), { role: 'edit' });
  await F.setDoc(F.doc(db, 'joinCodes/' + v.view), { role: 'view' });
  await F.setDoc(ref, v);
  return v;
}
async function showCodes() {
  const box = $('#bpCodes'); if (!box) return;
  try {
    const v = await makeCodes(false);
    box.innerHTML = [['edit', '可編輯'], ['view', '只能看']].map(([k, t]) => `<div class="bp-code"><span class="k">${t}</span><b>${esc(v[k])}</b><button class="btn" type="button" data-cp="${esc(v[k])}" data-t="${t}">複製邀請訊息</button></div>`).join('');
    box.querySelectorAll('[data-cp]').forEach(b => b.onclick = () => copy(`邀請你加入「築跡」工地日報（${b.dataset.t}）\n1. 打開 https://buildprint.tw\n2. 按「註冊」，邀請碼輸入：${b.dataset.cp}`, b));
  } catch (e) { box.innerHTML = `<span class="note">讀取邀請碼失敗（${esc(e.code || e.message)}）</span>`; }
}
async function showMembers() {
  const box = $('#bpMem'); if (!box) return;
  try {
    const qs = await F.getDocs(F.collection(db, 'members'));
    const rows = qs.docs.map(d => Object.assign({ uid: d.id }, d.data())).sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')));
    if (!rows.length) { box.innerHTML = '<p class="muted">還沒有成員。把上面的邀請碼傳給同事吧。</p>'; return; }
    box.innerHTML = `<ul>${rows.map(m => `<li><div class="who"><b>${esc(m.name || '未具名')}</b><div class="note">${esc(m.email || '')}</div></div>
      <div class="seg">${[['edit', '可編輯'], ['view', '只能看']].map(([k, t]) => `<button type="button" data-mr="${m.uid}" data-v="${k}" aria-pressed="${m.role === k}">${t}</button>`).join('')}</div>
      <button class="mini" type="button" data-mx="${m.uid}" data-n="${esc(m.name || m.email || '')}" aria-label="移除">✕</button></li>`).join('')}</ul>`;
    box.querySelectorAll('[data-mr]').forEach(b => b.onclick = async () => { await F.updateDoc(F.doc(db, 'members/' + b.dataset.mr), { role: b.dataset.v }); showMembers(); });
    box.querySelectorAll('[data-mx]').forEach(b => b.onclick = async () => { if (!confirm(`把「${b.dataset.n}」移出？對方之後就看不到這個 app 了。`)) return; await F.deleteDoc(F.doc(db, 'members/' + b.dataset.mx)); showMembers(); });
  } catch (e) { box.innerHTML = `<span class="note">讀取成員失敗（${esc(e.code || e.message)}）</span>`; }
}

/* ---------------- 從舊版匯入：the file made by 「匯出全部資料」 in the Claude version ---------------- */
async function importFile(file) {
  // the 設定 page re-renders as soon as the first site arrives, so progress goes in a floating box of our own
  let box = $('#bpStatus'); if (!box) { box = document.createElement('div'); box.id = 'bpStatus'; box.setAttribute('role', 'status'); document.body.appendChild(box); }
  const say = (t, done) => { box.innerHTML = t + (done ? '<button class="btn" type="button" id="bpStatusOk">好</button>' : ''); box.hidden = false; const ok = $('#bpStatusOk'); if (ok) ok.onclick = () => { box.hidden = true; }; };
  let j; try { j = JSON.parse(await file.text()); } catch (e) { say('這不是搬家檔案（讀不出內容）'); return; }
  if (!j || j.format !== 'buildprint-export-1') { say('這不是築跡的搬家檔案'); return; }
  // the person who exported is the person importing: their old Claude ID becomes their new account
  const swap = o => { if (!j.me) return o; return JSON.parse(JSON.stringify(o).split(JSON.stringify(j.me).slice(1, -1)).join(me.uid)); };
  try {
    const ids = Object.keys(j.blobs || {}); let n = 0;
    for (const id of ids) {
      n++; say(`<span class="spin"></span> 上傳照片和圖 ${n}／${ids.length}…`);
      const ex = await F.getDoc(F.doc(db, 'blobs/' + id)); if (ex.exists()) continue;
      await putBlob(id, j.blobs[id].type || 'image/jpeg', j.blobs[id].b64 || '');
    }
    say('<span class="spin"></span> 寫入工地和日報…');
    for (const [sid, site] of Object.entries(j.sites || {})) {
      await F.setDoc(F.doc(db, sid === 'main' ? 'site/info' : 'sites/' + sid), swap(site));
      for (const [date, r] of Object.entries((j.reports || {})[sid] || {}))
        await F.setDoc(F.doc(db, (sid === 'main' ? 'reports/' : `sites/${sid}/reports/`) + date), swap(r));
    }
    for (const [pid, p] of Object.entries(j.punch || {})) {
      const v = swap(p); const id = pid === j.me ? me.uid : pid; v.id = id;
      Object.values(v.sites || {}).forEach(days => Object.values(days || {}).forEach(d => { if (d && Array.isArray(d.log)) d.log = d.log.map(x => Array.isArray(x) ? { k: x[0], at: x[1] } : x); }));
      if (id === me.uid && v.name == null) v.name = me.name;
      await F.setDoc(F.doc(db, 'punch/' + id), v);
    }
    for (const [pid, name] of Object.entries(j.names || {})) if (pid !== j.me && name) await F.setDoc(F.doc(db, 'profiles/' + pid), { name, legacy: true }, { merge: true });
    const nr = Object.values(j.reports || {}).reduce((a, R) => a + Object.keys(R).length, 0);
    say(`匯入完成：${Object.keys(j.sites || {}).length} 個工地、${nr} 份日報、${ids.length} 張照片和圖。`, true);
  } catch (e) { console.error(e); say('匯入到一半失敗（' + esc(e.code || e.message) + '），可以再匯入一次，已完成的部分會被覆蓋。', true); }
}

boot();
