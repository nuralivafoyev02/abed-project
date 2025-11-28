// /api/admin-actions.js (POST with action: 'promote'|'credit')
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const JWT_SECRET = process.env.JWT_SECRET;

function verify(req) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(auth.split(' ')[1], JWT_SECRET);
  } catch { return null; }
}

export default async function handler(req, res) {
  const user = verify(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const body = req.body;
  if (body.action === 'promote') {
    // only boss (role_id==3) can promote
    if (user.role_id !== 3) return res.status(403).json({ error: 'Forbidden' });
    const { target_user_id } = body;
    // set role_id = 2 (admin)
    const { error } = await supabase.from('users').update({ role_id: 2 }).eq('id', target_user_id);
    if (error) return res.status(500).json({ error: error.message });
    await supabase.from('audit_logs').insert({ actor: user.uid, action: 'promote', payload: { target_user_id } });
    return res.json({ ok: true });
  } else if (body.action === 'credit') {
    if (![2,3].includes(user.role_id)) return res.status(403).json({ error: 'Forbidden' });
    const { target_user_id, amount } = body;
    // add to balances (simple approach)
    const { data } = await supabase.rpc('credit_balance', { uid_param: target_user_id, amt: amount });
    await supabase.from('audit_logs').insert({ actor: user.uid, action: 'credit', payload: { target_user_id, amount } });
    return res.json({ ok: true });
  }
  return res.status(400).json({ error: 'Unknown action' });
}
