// /api/auth-exchange.js
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const JWT_SECRET = process.env.JWT_SECRET || 'replace_me';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Token required' });

  // Look up token
  const { data: tdata, error: terr } = await supabase
    .from('one_time_tokens')
    .select('token,user_id,expire_at,used')
    .eq('token', token)
    .single();

  if (terr || !tdata) return res.status(401).json({ error: 'Invalid token' });
  if (tdata.used) return res.status(401).json({ error: 'Token already used' });
  if (new Date(tdata.expire_at) < new Date()) return res.status(401).json({ error: 'Token expired' });

  // mark used & create jwt
  const { error: updErr } = await supabase
    .from('one_time_tokens')
    .update({ used: true })
    .eq('token', token);

  if (updErr) console.error('Failed to mark token used', updErr.message);

  // Load user
  const { data: user, error: userErr } = await supabase
    .from('users')
    .select('id,telegram_id,phone,full_name,role_id')
    .eq('id', tdata.user_id)
    .single();

  if (userErr || !user) return res.status(500).json({ error: 'User not found' });

  const payload = { uid: user.id, role_id: user.role_id };
  const tokenJwt = jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });

  // Return token as httpOnly cookie alternative: send in body and frontend stores in httpOnly via server set-cookie (Vercel supports)
  res.setHeader('Set-Cookie', `session=${tokenJwt}; HttpOnly; Path=/; Secure; SameSite=Strict; Max-Age=${12*3600}`);
  return res.json({ ok: true, role_id: user.role_id, uid: user.id });
}
