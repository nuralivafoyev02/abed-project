// /api/get-user.js
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const JWT_SECRET = process.env.JWT_SECRET;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// helper: read token from Authorization or cookie
function getTokenFromReq(req) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.split(' ')[1];
  const cookie = req.headers.cookie || '';
  // naive cookie parse
  const m = cookie.split(';').map(s => s.trim()).find(s => s.startsWith('session='));
  if (m) return m.split('=')[1];
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const token = getTokenFromReq(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const { uid } = payload;
  const { data: user, error } = await supabase
    .from('users')
    .select('id,telegram_id,phone,full_name,role_id,created_at')
    .eq('id', uid)
    .single();

  if (error || !user) return res.status(500).json({ error: 'User not found' });

  // fetch balance
  const { data: balData } = await supabase.from('balances').select('amount').eq('user_id', uid).single();
  const balance = balData ? parseFloat(balData.amount) : 0;

  return res.json({ user: { ...user, balance } });
}
