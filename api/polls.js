// /api/polls.js
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
  // GET: list active polls (join with menus)
  if (req.method === 'GET') {
    const { date } = req.query; // optional date=YYYY-MM-DD
    let q = supabase.from('polls')
      .select('id,menu_id,open_at,close_at,is_closed,created_at,menus!inner(items,date)')
      .order('open_at', { ascending: true });
    if (date) q = q.eq('menus.date', date);
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    // parse menu items json
    const out = (data || []).map(p => {
      let items = p.menus.items;
      try { items = typeof items === 'string' ? JSON.parse(items) : items; } catch {}
      return { id: p.id, menu_id: p.menu_id, open_at: p.open_at, close_at: p.close_at, is_closed: p.is_closed, date: p.menus.date, items };
    });
    return res.json({ polls: out });
  }

  // POST: create menu + poll (admin/boss)
  if (req.method === 'POST') {
    const token = getTokenFromReq(req);
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    let payload;
    try { payload = jwt.verify(token, JWT_SECRET); } catch { return res.status(401).json({ error: 'Invalid token' }); }
    const role = payload.role_id;
    if (![2,3].includes(role)) return res.status(403).json({ error: 'Forbidden' });

    const { date, items, open_at, close_at } = req.body;
    if (!date || !Array.isArray(items) || !open_at || !close_at) return res.status(400).json({ error: 'Invalid payload' });

    // insert menu and poll in transaction-ish sequence
    try {
      const { data: menu, error: menuErr } = await supabase.from('menus').insert([{ date, items: JSON.stringify(items), created_by: payload.uid }]).select().single();
      if (menuErr) return res.status(500).json({ error: menuErr.message });
      const { data: poll, error: pollErr } = await supabase.from('polls').insert([{ menu_id: menu.id, open_at, close_at, created_by: payload.uid }]).select().single();
      if (pollErr) return res.status(500).json({ error: pollErr.message });
      return res.json({ ok: true, poll: { ...poll, items } });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  res.status(405).json({ error: 'Method not allowed' });
}
