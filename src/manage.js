const $ = (id) => document.getElementById(id);
const rand = (n) => `R${n.toLocaleString('en-ZA')}`;

let gifts = [];
let view = 'shown';

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

async function load() {
  try {
    const res = await fetch('/api/manage');
    if (!res.ok) throw new Error();
    gifts = await res.json();
  } catch {
    $('list').innerHTML = '<li class="muted">Could not load the gifts. Please refresh the page.</li>';
    return;
  }
  render();
}

function render() {
  const onList = gifts.filter((g) => !g.hidden && !g.picked);
  $('s-shown').textContent = onList.length;
  $('s-hidden').textContent = gifts.filter((g) => g.hidden).length;
  $('s-picked').textContent = gifts.filter((g) => g.picked).length;

  const q = $('search').value.trim().toLowerCase();
  const shown = gifts
    .filter((g) => (view === 'all' ? true : view === 'hidden' ? g.hidden : !g.hidden))
    .filter((g) => !q || `${g.name} ${g.category} ${g.retailer}`.toLowerCase().includes(q));

  if (!shown.length) {
    $('list').innerHTML = `<li class="empty">${view === 'hidden' && !q ? 'No gifts removed yet.' : 'No gifts match.'}</li>`;
    return;
  }

  $('list').innerHTML = shown
    .map(
      (g) => `
      <li class="manage-item ${g.hidden ? 'is-hidden' : ''}">
        <div class="manage-thumb">${g.image ? `<img src="${escapeHtml(g.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" />` : ''}</div>
        <div class="manage-info">
          <b>${escapeHtml(g.name)}</b>
          <span class="muted small">${escapeHtml(g.category)} · ${rand(g.price)} · ${escapeHtml(g.retailer)}
            ${g.picked ? ' · <span class="pill">Picked by a guest</span>' : ''}
            ${g.hidden ? ' · <span class="pill">Removed</span>' : ''}</span>
        </div>
        ${
          g.hidden
            ? `<button class="btn btn-accent btn-sm" data-toggle="${escapeHtml(g.id)}" data-hide="false">Bring back</button>`
            : `<button class="btn btn-ghost btn-sm" data-toggle="${escapeHtml(g.id)}" data-hide="true">Remove</button>`
        }
      </li>`,
    )
    .join('');
}

$('views').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-view]');
  if (!btn) return;
  view = btn.dataset.view;
  document.querySelectorAll('#views .chip').forEach((c) => c.classList.toggle('active', c === btn));
  render();
});

$('search').addEventListener('input', render);

$('list').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-toggle]');
  if (!btn) return;
  const gift = gifts.find((g) => g.id === btn.dataset.toggle);
  const hidden = btn.dataset.hide === 'true';
  btn.disabled = true;
  try {
    const res = await fetch('/api/manage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ giftId: gift.id, hidden }),
    });
    if (!res.ok) throw new Error();
    gift.hidden = hidden;
    toast(hidden ? `Removed "${gift.name}" from the list.` : `"${gift.name}" is back on the list.`);
    render();
  } catch {
    btn.disabled = false;
    toast('Could not save that change. Please try again.');
  }
});

let toastTimer;
function toast(text) {
  const t = $('toast');
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 4000);
}

load();
