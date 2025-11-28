// /api/menus.js
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const JWT_SECRET = process.env.JWT_SECRET;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function verifyJWTFromReq(req) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return null;
  const token = auth.split(' ')[1];
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
}

export default async function handler(req, res) {
  const user = verifyJWTFromReq(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'GET') {
    const { date } = req.query; // optional date=YYYY-MM-DD
    let q = supabase.from('menus').select('*');
    if (date) q = q.eq('date', date);
    const { data, error } = await q.order('date', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ data });
  }

  if (req.method === 'POST') {
    // only admin/boss
    if (![2,3].includes(user.role_id)) return res.status(403).json({ error: 'Forbidden' });
    const body = req.body;
    // validate body.date, body.items
    if (!body.date || !Array.isArray(body.items)) return res.status(400).json({ error: 'Invalid payload' });

    const { data, error } = await supabase
      .from('menus')
      .insert([{ date: body.date, items: JSON.stringify(body.items), created_by: user.uid }])
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true, menu: data });
  }

  res.status(405).json({ error: 'Method not allowed' });
}

