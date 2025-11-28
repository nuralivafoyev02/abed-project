// auth.js
export async function initUser() {
  const resp = await fetch('/api/get-user', { credentials: 'include' });
  if (!resp.ok) return null;
  const { user } = await resp.json();
  return user;
}

// UI render functions exported from other files
export { renderUserUI } from './ui_user.js';
export { renderAdminUI } from './ui_admin.js';
