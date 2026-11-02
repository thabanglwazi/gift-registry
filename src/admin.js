const $ = (id) => document.getElementById(id);
const rand = (n) => `R${n.toLocaleString('en-ZA')}`;
const KEY = 'registry-admin-pw';

let picks = [];
let gifts = [];
let editing = null; // gift being edited, or {} when adding
let removing = null; // pick being removed

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
  const res = await fetch(path, {
    ...options,
    headers: { 'x-admin-password': getPw(), 'Content-Type': 'application/json', ...options.headers },
  });
  if (res.status === 401) throw new Error('unauthorised');
  return res;
}

async function load() {
  let data;
  try {
    [data, gifts] = await Promise.all([
      api('/api/admin/picks').then((r) => r.json()),
      api('/api/admin/gifts').then((r) => r.json()),
    ]);
  } catch (err) {
    showLogin(err.message === 'unauthorised' ? 'Wrong password.' : 'Could not reach the server.');
    return;
  }
  $('login').hidden = true;
  $('dashboard').hidden = false;

  picks = [...data.picks].sort((a, b) => b.pickedAt.localeCompare(a.pickedAt));
  $('s-picked').textContent = picks.length;
  $('s-left').textContent = data.available;
  $('s-value').textContent = rand(picks.reduce((sum, p) => sum + p.price, 0));
  renderPicks();
  renderGifts();
}

function renderPicks() {
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
            <td><button class="btn btn-ghost btn-sm" data-remove-pick="${escapeHtml(p.giftId)}">Remove</button></td>
          </tr>`,
        )
        .join('')
    : '<tr><td colspan="7" class="muted" style="text-align:center;padding:32px">No gifts picked yet.</td></tr>';
}

function renderGifts() {
  const q = $('gift-search').value.trim().toLowerCase();
  // Deleted gifts go to the bottom so they're out of the way but can still be restored
  const shown = gifts
    .filter((g) => !q || `${g.name} ${g.category} ${g.retailer}`.toLowerCase().includes(q))
    .sort((a, b) => Number(Boolean(a.deleted)) - Number(Boolean(b.deleted)));
  $('categories').innerHTML = [...new Set(gifts.map((g) => g.category))].map((c) => `<option value="${escapeHtml(c)}">`).join('');
  $('gift-list').innerHTML = shown.length
    ? shown
        .map((g) => {
          const tags = [
            g.deleted && 'Deleted',
            g.added && 'Added by you',
            g.edited && 'Edited',
            g.picked && 'Picked',
            g.hidden && 'Removed from list',
          ]
            .filter(Boolean)
            .map((t) => ` · <span class="pill">${t}</span>`)
            .join('');
          const id = escapeHtml(g.id);
          const buttons = g.deleted
            ? `<button class="btn btn-accent btn-sm" data-restore="${id}">Restore</button>`
            : `<button class="btn btn-ghost btn-sm" data-edit="${id}">Edit</button>
               <button class="btn btn-ghost btn-sm btn-danger" data-delete="${id}">Delete</button>`;
          return `
          <li class="manage-item ${g.deleted ? 'is-hidden' : ''}">
            <div class="manage-thumb">${g.image ? `<img src="${escapeHtml(g.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" />` : ''}</div>
            <div class="manage-info">
              <b>${escapeHtml(g.name)}</b>
              <span class="muted small">${escapeHtml(g.category)} · ${rand(g.price)} · ${escapeHtml(g.retailer || '')}${tags}</span>
            </div>
            <div class="row-actions">${buttons}</div>
          </li>`;
        })
        .join('')
    : '<li class="empty">No gifts match.</li>';
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

$('tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-tab]');
  if (!btn) return;
  document.querySelectorAll('#tabs .chip').forEach((c) => c.classList.toggle('active', c === btn));
  $('tab-picks').hidden = btn.dataset.tab !== 'picks';
  $('tab-gifts').hidden = btn.dataset.tab !== 'gifts';
});

$('download').addEventListener('click', async () => {
  const res = await api('/api/admin/csv');
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement('a'), { href: url, download: 'gift-picks.csv' });
  a.click();
  URL.revokeObjectURL(url);
});

// Removing a pick
$('rows').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-remove-pick]');
  if (!btn) return;
  removing = picks.find((p) => p.giftId === btn.dataset.removePick);
  $('remove-title').textContent = removing.giftName;
  $('remove-meta').textContent = `Picked by ${removing.guestName}`;
  $('remove-dialog').showModal();
});

$('remove-dialog').addEventListener('click', async (e) => {
  const choice = e.target.closest('[data-remove]')?.dataset.remove;
  if (!choice) return;
  $('remove-dialog').close();
  if (choice === 'cancel') return;
  const keepOff = choice === 'off' ? '&keepOff=1' : '';
  const res = await api(`/api/admin/picks?giftId=${encodeURIComponent(removing.giftId)}${keepOff}`, { method: 'DELETE' });
  toast(res.ok ? (keepOff ? 'Pick removed. The gift stays off the list.' : 'Pick removed. The gift is back on the list.') : 'Could not remove that pick.');
  load();
});

// Editing and adding gifts
$('gift-search').addEventListener('input', renderGifts);

function openEditor(gift) {
  editing = gift;
  $('edit-eyebrow').textContent = gift.id ? 'Edit gift' : 'Add a gift';
  for (const k of ['name', 'category', 'price', 'retailer', 'url', 'image']) $(`f-${k}`).value = gift[k] ?? '';
  $('edit-undo').hidden = !gift.edited;
  $('edit-error').textContent = '';
  $('edit-dialog').showModal();
}

$('gift-list').addEventListener('click', async (e) => {
  const edit = e.target.closest('[data-edit]');
  if (edit) return openEditor(gifts.find((g) => g.id === edit.dataset.edit));

  const del = e.target.closest('[data-delete]');
  if (del) {
    const gift = gifts.find((g) => g.id === del.dataset.delete);
    const note = gift.picked ? '\n\nA guest has already picked it. Their pick stays on the Picked gifts tab.' : '';
    if (!confirm(`Delete "${gift.name}" from the registry?${note}`)) return;
    del.disabled = true;
    const res = await api(`/api/admin/gifts?giftId=${encodeURIComponent(gift.id)}`, { method: 'DELETE' });
    toast(res.ok ? (gift.added ? 'Gift deleted.' : 'Gift deleted. You can restore it at the bottom of the list.') : 'Could not delete that gift.');
    return load();
  }

  const restore = e.target.closest('[data-restore]');
  if (restore) {
    restore.disabled = true;
    const res = await api(`/api/admin/gifts?giftId=${encodeURIComponent(restore.dataset.restore)}&undo=1`, { method: 'DELETE' });
    toast(res.ok ? 'Gift restored to the registry.' : 'Could not restore that gift.');
    load();
  }
});

$('add-gift').addEventListener('click', () => openEditor({}));
$('edit-cancel').addEventListener('click', () => $('edit-dialog').close());

$('edit-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = { id: editing.id };
  for (const k of ['name', 'category', 'price', 'retailer', 'url', 'image']) body[k] = $(`f-${k}`).value;
  $('edit-save').disabled = true;
  try {
    const res = await api('/api/admin/gifts', { method: 'PUT', body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) {
      $('edit-error').textContent = data.error || 'Could not save.';
      return;
    }
    $('edit-dialog').close();
    toast(editing.id ? 'Gift updated.' : 'Gift added to the registry.');
    load();
  } catch {
    $('edit-error').textContent = 'Could not reach the server.';
  } finally {
    $('edit-save').disabled = false;
  }
});

$('edit-undo').addEventListener('click', async () => {
  if (!confirm('Go back to the original name, price, link and photo?')) return;
  await api(`/api/admin/gifts?giftId=${encodeURIComponent(editing.id)}&undo=1`, { method: 'DELETE' });
  $('edit-dialog').close();
  toast('Changes undone.');
  load();
});

let toastTimer;
function toast(text) {
  const t = $('toast');
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 4000);
}

if (getPw()) load();
