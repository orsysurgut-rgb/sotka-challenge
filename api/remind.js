const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;
const BOT_TOKEN = process.env.BOT_TOKEN;

const REMIND_PHRASES = [
  'День 1. Время ещё есть — добей сотку сегодня.',
  'День 2. Не дай серии оборваться — добей сотку.',
  'День 3. Не сдавайся, время ещё есть — добей сотку.',
  'День 4. Четыре дня подряд — не останавливайся сейчас. Сделай сотку.',
  'День 5. Пять дней без пропусков — сегодня не исключение. Сотка ждёт.',
  'День 6. Не ложись спать без тренировки — время ещё есть. Внеси тренировку.',
  'День 7. Неделя на кону — закрой её чисто. Внеси тренировку.',
  'День 8. Восемь дней дисциплины — добей сотку сегодня.',
  'День 9. Завтра будет 10 — не испорти её сегодня. Внеси тренировку.',
  'День 10. Треть пути — не ложись спать пока не закроешь день.',
  'День 11. Не сдавайся — время ещё есть, добей сотку.',
  'День 12. До половины три дня — не сбавляй темп. Выполни сотку.',
  'День 13. Сегодня твой день — добей сотку.',
  'День 14. Две недели — не ложись спать без тренировки. Сотка ждёт.',
  'День 15. Половина пути — время ещё есть, добей сотку.',
  'День 16. За экватором — каждый день на счету. Сотка почти в кармане.',
  'День 17. Не сдавайся — добей сотку прямо сейчас.',
  'День 18. До финиша меньше двух недель — не дай серии оборваться. Доделай тренировку.',
  'День 19. Осталось 11 дней — не ложись спать без сотки.',
  'День 20. Двадцать дней — не останавливайся сейчас. Сделай тренировку.',
  'День 21. Три недели — не ломай привычку сегодня. Тренировка ждёт.',
  'День 22. Восемь дней до финиша — добей сотку.',
  'День 23. Последняя неделя — не ложись спать без тренировки.',
  'День 24. Шесть дней — ты слишком далеко зашёл чтобы останавливаться. Доделай сотку.',
  'День 25. Пять дней до финиша — время ещё есть. Внеси тренировку.',
  'День 26. Четыре дня — ляг спать победителем. Добей сотку.',
  'День 27. Три дня — добей сотку сегодня.',
  'День 28. Два дня — не ложись спать пока не закроешь день. Внеси тренировку.',
  'День 29. Предпоследний — завтра финиш, не испорти его сегодня. Сотка ждёт.',
  'День 30. Последний день — не ложись спать пока не добьёшь финальную сотку.',
];

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const now = new Date();
    const moscowTime = new Date(now.getTime() + 3 * 60 * 60000);
    const today = moscowTime.toISOString().slice(0, 10);

    const startDate = new Date('2026-04-01');
    const todayDate = new Date(today);
    const dayIndex = Math.max(0, Math.min(29, Math.floor((todayDate - startDate) / 86400000)));
    const dayPhrase = REMIND_PHRASES[dayIndex];

    const response = await fetch(`${SUPABASE_URL}/rest/v1/participants?select=tg_user_id,tg_first_name,log,challenge_type,last_reminder_msg_id`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });

    const participants = await response.json();
    let sent = 0;
    let skipped = 0;

    for (const p of participants) {
      if (!p.tg_user_id || p.tg_user_id.startsWith('browser_')) {
        skipped++;
        continue;
      }

      const todayLog = p.log && p.log[today];
      const totalToday = todayLog ? Object.values(todayLog).reduce((s, v) => s + v, 0) : 0;
      const isDone = p.challenge_type === 'sotka' ? totalToday >= 100 : totalToday >= 34;

      if (!isDone) {
        const name = p.tg_first_name || 'участник';

        const text = totalToday > 0
          ? `⚡ ${name}, уже ${totalToday} повторений!\n\n${dayPhrase}\n\nДобей сотку — совсем немного осталось! 💪`
          : `⏰ ${name}!\n\n${dayPhrase} 💪`;

        if (p.last_reminder_msg_id) {
          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: p.tg_user_id, message_id: p.last_reminder_msg_id })
          });
        }

        const msgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: p.tg_user_id,
            text,
            reply_markup: {
              inline_keyboard: [[
                { text: '💪 Отметить тренировку', web_app: { url: 'https://sotka-challenge.vercel.app' } }
              ]]
            }
          })
        });

        const msgData = await msgRes.json();

        if (msgData.ok && msgData.result) {
          await fetch(`${SUPABASE_URL}/rest/v1/participants?tg_user_id=eq.${p.tg_user_id}`, {
            method: 'PATCH',
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ last_reminder_msg_id: msgData.result.message_id })
          });
        }

        sent++;
        await new Promise(r => setTimeout(r, 50));
      }
    }

    return res.status(200).json({ ok: true, date: today, day: dayIndex + 1, sent, skipped, total: participants.length });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
