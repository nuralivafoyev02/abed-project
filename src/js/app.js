// app.js
import { initUser, renderUserUI, renderAdminUI } from './auth.js';

async function main() {
  // If URL has t= token, exchange
  const urlParams = new URLSearchParams(location.search);
  const t = urlParams.get('t');
  if (t) {
    // POST /api/auth-exchange
    const resp = await fetch('/api/auth-exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: t }),
      credentials: 'include' // so cookie set
    });
    const r = await resp.json();
    if (!resp.ok) {
      document.getElementById('main').innerText = 'Login failed: ' + (r.error || 'unknown');
      return;
    }
    // reload without token in url
    history.replaceState({}, '', '/');
  }

  const user = await initUser(); // returns {uid, role_id}
  if (!user) {
    document.getElementById('main').innerHTML = '<p>Not logged in. Open via Telegram bot.</p>';
    return;
  }

  if (user.role_id === 1) {
    renderUserUI(user);
  } else {
    renderAdminUI(user);
  }
}

main();
