import { config } from './config.js';

const $ = (id) => document.getElementById(id);
const rand = (n) => `R${n.toLocaleString('en-ZA')}`;
const icons = {
  'Beauty & Pamper': '🧴',
  'Home & Decor': '🕯️',
  'Tea, Coffee & Treats': '🍵',
  'Style & Fun': '✨',
};

let gifts = [];
let filter = 'All';
let selected = null;

$('party-date').textContent = config.partyDate;
$('title').innerHTML = `${escapeHtml(config.celebrantName)} is turning <em>${config.age}</em>`;
$('message').textContent = config.message;
document.title = `${config.celebrantName}'s ${config.age}th Birthday Gift Registry`;

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

async function loadGifts() {
  try {
    const res = await fetch('/api/gifts');
    gifts = await res.json();
  } catch {
    $('grid').innerHTML = '<p class="muted">Could not load the gift list. Please refresh the page.</p>';
    return;
  }
  render();
}

function render() {
  const categories = ['All', ...new Set(gifts.map((g) => g.category))];
  if (!categories.includes(filter)) filter = 'All';

  $('chips').innerHTML = categories
    .map((c) => `<button class="chip ${c === filter ? 'active' : ''}" data-cat="${escapeHtml(c)}">${escapeHtml(c)}</button>`)
    .join('');

  $('count').textContent = gifts.length
    ? `${gifts.length} gift${gifts.length === 1 ? '' : 's'} still available`
    : '';

  const shown = filter === 'All' ? gifts : gifts.filter((g) => g.category === filter);
  if (!gifts.length) {
    $('grid').innerHTML = '<div class="empty">Every gift has been picked — thank you! 🎉<br/>A card or your company is more than enough.</div>';
    return;
  }

  $('grid').innerHTML = shown
    .map(
      (g, i) => `
      <article class="card reveal" style="--i:${i}" data-id="${g.id}">
        <div class="card-icon">${icons[g.category] || '🎁'}</div>
        <span class="tag">${escapeHtml(g.category)}</span>
        <h3>${escapeHtml(g.name)}</h3>
        <p class="muted small">Available at ${escapeHtml(g.retailer)}</p>
        <div class="card-foot">
          <span class="price"><small>approx.</small> ${rand(g.price)}</span>
          <button class="btn btn-dark btn-sm" data-pick="${g.id}">I'll get this</button>
        </div>
      </article>`,
    )
    .join('');
  requestAnimationFrame(() => document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible')));
}

$('chips').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-cat]');
  if (!btn) return;
  filter = btn.dataset.cat;
  render();
});

$('grid').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-pick]');
  if (!btn) return;
  selected = gifts.find((g) => g.id === btn.dataset.pick);
  $('dialog-gift').textContent = selected.name;
  $('dialog-meta').textContent = `Approx. ${rand(selected.price)} · ${selected.retailer}`;
  $('dialog-error').textContent = '';
  $('pick-dialog').showModal();
  $('guest-name').focus();
});

$('cancel').addEventListener('click', () => $('pick-dialog').close());

$('pick-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('guest-name').value.trim();
  if (name.length < 2) {
    $('dialog-error').textContent = 'Please enter your name.';
    return;
  }
  $('confirm').disabled = true;
  try {
    const res = await fetch('/api/pick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ giftId: selected.id, name }),
    });
    const data = await res.json();
    if (!res.ok) {
      $('dialog-error').textContent = data.error || 'Something went wrong. Please try again.';
      if (res.status === 409) loadGifts();
      return;
    }
    $('pick-dialog').close();
    removeCard(selected.id);
    toast(`Thank you, ${name.split(' ')[0]}! "${selected.name}" is yours to bring. 💝`);
  } catch {
    $('dialog-error').textContent = 'Network problem. Please try again.';
  } finally {
    $('confirm').disabled = false;
  }
});

function removeCard(id) {
  const card = document.querySelector(`[data-id="${id}"]`);
  gifts = gifts.filter((g) => g.id !== id);
  if (!card) return render();
  card.classList.add('leaving');
  card.addEventListener('animationend', render, { once: true });
}

let toastTimer;
function toast(text) {
  const t = $('toast');
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 5000);
}

loadGifts();
// Keep the list fresh when several guests are choosing at the same time
setInterval(() => {
  if (!$('pick-dialog').open) loadGifts();
}, 30000);
