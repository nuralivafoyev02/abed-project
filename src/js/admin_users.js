// /api/admin-users.js
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const JWT_SECRET = process.env.JWT_SECRET;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function getTokenFromReq(req) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.split(' ')[1];
  const cookie = req.headers.cookie || '';
  const m = cookie.split(';').map(s => s.trim()).find(s => s.startsWith('session='));
  if (m) return m.split('=')[1];
  return null;
}

export default async function handler(req, res) {
  const token = getTokenFromReq(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  let payload;
  try { payload = jwt.verify(token, JWT_SECRET); } catch { return res.status(401).json({ error: 'Invalid token' }); }
  if (![2,3].includes(payload.role_id)) return res.status(403).json({ error: 'Forbidden' });

  const { data, error } = await supabase.from('users').select('id,full_name,phone,role_id,created_at');
  if (error) return res.status(500).json({ error: error.message });

  // join balances
  const userIds = data.map(u => u.id);
  const { data: bals } = await supabase.from('balances').select('user_id,amount').in('user_id', userIds);
  const balMap = {};
  (bals || []).forEach(b => balMap[b.user_id] = Number(b.amount));

  const users = data.map(u => ({ ...u, balance: balMap[u.id] || 0 }));
  return res.json({ users });
}
