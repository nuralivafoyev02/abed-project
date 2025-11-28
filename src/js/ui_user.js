// /src/js/ui_user.js
export async function renderUserUI(user) {
  const main = document.getElementById('main');
  main.innerHTML = `
    <div class="card">
      <div class="flex">
        <h2>Salom, ${escapeHtml(user.full_name || user.phone || 'Foydalanuvchi')}</h2>
        <div class="right small">Balans: <strong id="balance">${Number(user.balance||0).toFixed(2)}</strong></div>
      </div>
      <div id="polls"></div>
      <hr/>
      <h3>Buyurtma tarixi</h3>
      <div id="orders"></div>
    </div>
  `;
  await loadPolls();
  await loadOrders();
}

function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

async function loadPolls() {
  const el = document.getElementById('polls');
  el.innerHTML = '<p>Yuklanmoqda...</p>';
  const resp = await fetch('/api/polls', { credentials: 'include' });
  if (!resp.ok) { el.innerText = 'Polllarni olishda xatolik'; return; }
  const { polls } = await resp.json();
  if (!polls || polls.length === 0) { el.innerHTML = '<p>Hozircha ovqat menyusi yo‘q.</p>'; return; }

  // show first open poll (today) or all
  el.innerHTML = '';
  polls.forEach(p => {
    const container = document.createElement('div');
    container.className = 'card';
    const closeAt = new Date(p.close_at);
    const openAt = new Date(p.open_at);
    const now = new Date();
    const isOpen = now >= openAt && now <= closeAt && !p.is_closed;
    let itemsHtml = '<ul>';
    (p.items || []).forEach((it, idx) => {
      itemsHtml += `<li data-idx="${idx}">${escapeHtml(it.name)} — ${Number(it.price).toFixed(2)} so'm <input type="number" min="0" value="0" class="qty" data-price="${Number(it.price)}" style="width:60px;margin-left:8px"/></li>`;
    });
    itemsHtml += '</ul>';

    container.innerHTML = `
      <div class="flex">
        <strong>Menu: ${escapeHtml(p.date)}</strong>
        <div class="right small">Yopilish: <span class="close-time">${closeAt.toLocaleString()}</span></div>
      </div>
      ${itemsHtml}
      <div class="flex" style="margin-top:8px">
        <div>Jami: <strong id="total-${p.id}">0.00</strong></div>
        <button class="button right order-btn" data-poll="${p.id}" ${isOpen ? '' : 'disabled'}>Buyurtma berish</button>
      </div>
      <div class="small">Status: ${isOpen ? 'Ochilgan — buyurtma qiling' : 'Yopilgan yoki hali ochilmagan'}</div>
    `;
    el.appendChild(container);

    // attach qty listeners
    const qtyInputs = container.querySelectorAll('.qty');
    qtyInputs.forEach(inp => {
      inp.addEventListener('input', () => {
        let total = 0;
        qtyInputs.forEach(i2 => {
          const q = Number(i2.value || 0);
          const p = Number(i2.dataset.price || 0);
          total += q * p;
        });
        container.querySelector(`#total-${p.id}`).innerText = Number(total).toFixed(2);
      });
    });

    // order button
    container.querySelector('.order-btn').addEventListener('click', async (ev) => {
      const btn = ev.currentTarget;
      const pollId = btn.dataset.poll;
      const qInputs = container.querySelectorAll('.qty');
      const items = [];
      qInputs.forEach((qi, idx) => {
        const qty = Number(qi.value || 0);
        if (qty > 0) {
          const price = Number(qi.dataset.price || 0);
          items.push({ menu_item_idx: idx, qty, price });
        }
      });
      if (items.length === 0) return alert('Iltimos, kamida bitta mahsulot tanlang.');
      btn.disabled = true;
      btn.innerText = 'Yuborilmoqda...';
      const r = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ poll_id: pollId, items })
      });
      const rr = await r.json();
      if (!r.ok) {
        alert('Xatolik: ' + (rr.error || 'server'));
        btn.disabled = false;
        btn.innerText = 'Buyurtma berish';
        return;
      }
      alert('Buyurtmangiz qabul qilindi!');
      // update balance and orders
      document.getElementById('balance').innerText = (Number(document.getElementById('balance').innerText) - Number(container.querySelector(`#total-${p.id}`).innerText || 0)).toFixed(2);
      await loadOrders();
      btn.innerText = 'Buyurtma berish';
    });
  });
}

async function loadOrders() {
  const el = document.getElementById('orders');
  el.innerHTML = '<p>Yuklanmoqda...</p>';
  const resp = await fetch('/api/orders?limit=50', { credentials: 'include' });
  if (!resp.ok) { el.innerText = 'Tarixni olishda xatolik'; return; }
  const { orders } = await resp.json();
  if (!orders || orders.length === 0) { el.innerHTML = '<p>Buyurtma topilmadi.</p>'; return; }
  const html = orders.map(o => {
    let itemsStr = '';
    try { itemsStr = (typeof o.items === 'string') ? JSON.parse(o.items) : o.items; } catch { itemsStr = o.items; }
    const itemsTxt = (itemsStr || []).map(it => `${it.qty} x idx${it.menu_item_idx} (${Number(it.price).toFixed(2)})`).join(', ');
    return `<div class="card small">#${o.id} — ${new Date(o.created_at).toLocaleString()} — ${o.status} — ${Number(o.total).toFixed(2)}<div class="small">Items: ${escapeHtml(itemsTxt)}</div></div>`;
  }).join('');
  el.innerHTML = html;
}
