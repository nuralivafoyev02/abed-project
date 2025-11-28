// /src/js/ui_admin.js
export async function renderAdminUI(user) {
  const main = document.getElementById('main');
  main.innerHTML = `
    <div class="card">
      <div class="flex">
        <h2>Admin panel — ${escapeHtml(user.full_name || user.phone)}</h2>
        <div class="right small">Siz: ${roleName(user.role_id)}</div>
      </div>

      <section id="menu-builder" class="card" style="margin-top:12px">
        <h3>Menyu yaratish</h3>
        <label>Sanasi: <input type="date" id="menu-date"/></label>
        <div id="items-list"></div>
        <button id="add-item" class="button">Item qo'shish</button>
        <button id="create-menu" class="button" style="margin-left:8px">Menyu va poll yaratish</button>
        <div class="small">Open/Close vaqtini yozing (ISO format yoki datetime-local)</div>
        <label>Open at: <input type="datetime-local" id="open-at"/></label>
        <label>Close at: <input type="datetime-local" id="close-at"/></label>
      </section>

      <section id="users-section" class="card" style="margin-top:12px">
        <h3>Foydalanuvchilar</h3>
        <div id="users-list">Yuklanmoqda...</div>
      </section>
    </div>
  `;

  document.getElementById('add-item').addEventListener('click', () => {
    const list = document.getElementById('items-list');
    const idx = list.children.length;
    const div = document.createElement('div');
    div.innerHTML = `<input placeholder="Nomi" class="item-name"/> <input placeholder="Narx" class="item-price" type="number" step="0.01"/> <button class="remove">X</button>`;
    div.querySelector('.remove').addEventListener('click', ()=> div.remove());
    list.appendChild(div);
  });

  document.getElementById('create-menu').addEventListener('click', async () => {
    const date = document.getElementById('menu-date').value;
    const openAt = document.getElementById('open-at').value;
    const closeAt = document.getElementById('close-at').value;
    if (!date || !openAt || !closeAt) return alert('Sanani va vaqtlarni to‘ldiring');
    const items = Array.from(document.querySelectorAll('#items-list > div')).map(d => {
      const name = d.querySelector('.item-name').value;
      const price = Number(d.querySelector('.item-price').value || 0);
      return { name, price };
    }).filter(i => i.name && !isNaN(i.price));
    if (items.length === 0) return alert('Hech narsa qo‘shilmadi');
    const r = await fetch('/api/polls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ date, items, open_at: new Date(openAt).toISOString(), close_at: new Date(closeAt).toISOString() })
    });
    const rr = await r.json();
    if (!r.ok) return alert('Xatolik: ' + (rr.error||'server'));
    alert('Menyu va poll yaratildi');
    // clear inputs
    document.getElementById('items-list').innerHTML = '';
    await loadUsers();
  });

  await loadUsers();
}

function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function roleName(id){ return id===3? 'Boss' : id===2? 'Admin' : 'User'; }

async function loadUsers() {
  const ul = document.getElementById('users-list');
  ul.innerHTML = 'Yuklanmoqda...';
  // NOTE: we assume an endpoint exists to fetch users list: /api/admin-users (create separately).
  const resp = await fetch('/api/admin-users', { credentials: 'include' });
  if (!resp.ok) { ul.innerText = 'Foydalanuvchilarni olishda xatolik'; return; }
  const { users } = await resp.json();
  ul.innerHTML = users.map(u => `
    <div class="card small">
      ${escapeHtml(u.full_name || u.phone)} — ${roleName(u.role_id)} — Balans: ${Number(u.balance||0).toFixed(2)}
      <div style="margin-top:6px">
        ${/* boss can promote */''}
        ${/* show promote button only if current user is boss; but we don't know here; we can rely server to enforce */''}
        <button class="btn-credit" data-id="${u.id}">Pul qo'shish</button>
        <button class="btn-promote" data-id="${u.id}">Make Admin</button>
      </div>
    </div>
  `).join('');

  // attach listeners
  document.querySelectorAll('.btn-credit').forEach(b => b.addEventListener('click', async (ev) => {
    const target = ev.currentTarget.dataset.id;
    const amt = prompt('Miqdor kiriting:');
    if (!amt) return;
    const r = await fetch('/api/admin-actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ action: 'credit', target_user_id: target, amount: Number(amt) })
    });
    const rr = await r.json();
    if (!r.ok) return alert('Xatolik: ' + (rr.error || 'server'));
    alert('Balans kreditlandi');
    await loadUsers();
  }));

  document.querySelectorAll('.btn-promote').forEach(b => b.addEventListener('click', async (ev) => {
    const target = ev.currentTarget.dataset.id;
    if (!confirm('Haqiqatan ham admin qilasizmi?')) return;
    const r = await fetch('/api/admin-actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ action: 'promote', target_user_id: target })
    });
    const rr = await r.json();
    if (!r.ok) return alert('Xatolik: ' + (rr.error || 'server'));
    alert('Foydalanuvchi admin qilindi');
    await loadUsers();
  }));
}
