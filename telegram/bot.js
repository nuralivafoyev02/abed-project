// /telegram/bot.js
import TelegramBot from 'node-telegram-bot-api';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const APP_URL = process.env.APP_URL || 'https://your-app.vercel.app';

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const opts = {
    reply_markup: {
      keyboard: [[{ text: "Share phone", request_contact: true }]],
      one_time_keyboard: true,
      resize_keyboard: true
    }
  };
  await bot.sendMessage(chatId, "Assalomu alaykum! Iltimos telefon raqamingizni ulashing — shunda ish joyingiz uchun ovqat buyurtma tizimiga kirish uchun link yuboraman.", opts);
});

bot.on('contact', async (msg) => {
  const contact = msg.contact;
  const telegram_id = msg.from.id;
  const phone = contact.phone_number;
  const full_name = `${contact.first_name || ''} ${contact.last_name || ''}`.trim();

  // Upsert user
  const { data: user, error } = await supabase
    .from('users')
    .upsert({ telegram_id, phone, full_name }, { onConflict: 'telegram_id' })
    .select()
    .single();

  if (error) {
    console.error('upsert user', error);
    return bot.sendMessage(telegram_id, 'Xatolik yuz berdi. Keyinroq urinib ko‘ring.');
  }

  // create one-time token
  const tokenRaw = crypto.randomBytes(24).toString('hex');
  const expireAt = new Date(Date.now() + 1000 * 60 * 10).toISOString(); // 10 min
  await supabase
    .from('one_time_tokens')
    .insert({ token: tokenRaw, user_id: user.id, expire_at: expireAt });

  const link = `${APP_URL}/?t=${tokenRaw}`;
  const reply = `Siz muvaffaqiyatli ro'yxatdan o'tdingiz. Web App uchun link: ${link}\nLink 10 daqiqa ichida ishlaydi.`;
  await bot.sendMessage(telegram_id, reply);
});
