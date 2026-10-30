const $ = (id) => document.getElementById(id);
const rand = (n) => `R${n.toLocaleString('en-ZA')}`;
const KEY = 'registry-admin-pw';

function getPw() {
  try { return sessionStorage.getItem(KEY) || ''; } catch { return ''; }
}
function setPw(pw) {
  try { pw ? sessionStorage.setItem(KEY, pw) : sessionStorage.removeItem(KEY); } catch {}
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

async function api(path, options = {}) {
  const res = await fetch(path, { ...options, headers: { 'x-admin-password': getPw(), ...options.headers } });
  if (res.status === 401) throw new Error('unauthorised');
  return res;
}

async function load() {
  let data;
  try {
    data = await (await api('/api/admin/picks')).json();
  } catch (err) {
    showLogin(err.message === 'unauthorised' ? 'Wrong password.' : 'Could not reach the server.');
    return;
  }
  $('login').hidden = true;
  $('dashboard').hidden = false;

  const picks = [...data.picks].sort((a, b) => b.pickedAt.localeCompare(a.pickedAt));
  $('s-picked').textContent = picks.length;
  $('s-left').textContent = data.available;
  $('s-value').textContent = rand(picks.reduce((sum, p) => sum + p.price, 0));

  $('rows').innerHTML = picks.length
    ? picks
        .map(
          (p) => `<tr>
            <td><b>${escapeHtml(p.guestName)}</b></td>
            <td>${escapeHtml(p.giftName)}</td>
            <td class="muted">${escapeHtml(p.category)}</td>
            <td>${rand(p.price)}</td>
            <td class="muted">${escapeHtml(p.retailer)}</td>
            <td class="muted">${new Date(p.pickedAt).toLocaleString('en-ZA')}</td>
            <td><button class="btn btn-ghost btn-sm" data-release="${p.id}" title="Put this gift back on the public list">Release</button></td>
          </tr>`,
        )
        .join('')
    : '<tr><td colspan="7" class="muted" style="text-align:center;padding:32px">No gifts picked yet.</td></tr>';
}

function showLogin(message = '') {
  $('dashboard').hidden = true;
  $('login').hidden = false;
  $('login-error').textContent = message;
}

$('login').addEventListener('submit', (e) => {
  e.preventDefault();
  setPw($('password').value);
  load();
});

$('logout').addEventListener('click', () => {
  setPw('');
  showLogin();
});

$('refresh').addEventListener('click', load);

$('download').addEventListener('click', async () => {
  const res = await api('/api/admin/picks.csv');
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement('a'), { href: url, download: 'gift-picks.csv' });
  a.click();
  URL.revokeObjectURL(url);
});

$('rows').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-release]');
  if (!btn || !confirm('Put this gift back on the list for other guests?')) return;
  await api(`/api/admin/picks/${btn.dataset.release}`, { method: 'DELETE' });
  load();
});

if (getPw()) load();
