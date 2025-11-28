// /api/orders.js
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
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const uid = payload.uid;

  if (req.method === 'POST') {
    // place order
    const { poll_id, items } = req.body;
    if (!poll_id || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Invalid payload' });
    }
    // compute total (server-side authoritative)
    let total = 0;
    for (const it of items) {
      const price = Number(it.price || 0);
      const qty = Number(it.qty || 1);
      if (price < 0 || qty <= 0) return res.status(400).json({ error: 'Invalid item' });
      total += price * qty;
    }
    total = Number(total.toFixed(2));

    // call RPC place_order
    try {
      const { data, error } = await supabase.rpc('place_order', { uid_param: uid, poll_id_param: poll_id, items_param: JSON.stringify(items), total_param: total });
      if (error) {
        // handle custom RPC exception (e.g. INSUFFICIENT_BALANCE)
        return res.status(400).json({ error: error.message || 'RPC error' });
      }
      return res.json({ ok: true });
    } catch (e) {
      console.error('place_order error', e);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  if (req.method === 'GET') {
    // get order history for this user, optional ?month=YYYY-MM
    const { month } = req.query;
    let q = supabase.from('orders').select('id,poll_id,items,total,status,created_at').eq('user_id', uid).order('created_at', { ascending: false });
    if (month) {
      // basic month filter: YYYY-MM
      const [y, m] = month.split('-').map(Number);
      if (y && m) {
        const from = new Date(Date.UTC(y, m - 1, 1)).toISOString();
        const to = new Date(Date.UTC(y, m, 1)).toISOString();
        q = q.gte('created_at', from).lt('created_at', to);
      }
    }
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ orders: data || [] });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
