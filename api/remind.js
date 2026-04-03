const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;
const BOT_TOKEN = process.env.BOT_TOKEN;

export default async function handler(req, res) {
  // Allow manual trigger via POST, or cron via GET
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get today's date in Moscow time (UTC+3)
    const now = new Date();
    const moscowOffset = 3 * 60;
    const moscowTime = new Date(now.getTime() + moscowOffset * 60000);
    const today = moscowTime.toISOString().slice(0, 10);

    // Fetch all participants from Supabase
    const response = await fetch(`${SUPABASE_URL}/rest/v1/participants?select=tg_user_id,tg_first_name,log,challenge_type`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });

    const participants = await response.json();

    let sent = 0;
    let skipped = 0;

    for (const p of participants) {
      // Skip browser users without tg_user_id
      if (!p.tg_user_id || p.tg_user_id.startsWith('browser_')) {
        skipped++;
        continue;
      }

      // Check if user logged today
      const todayLog = p.log && p.log[today];
      const totalToday = todayLog
        ? Object.values(todayLog).reduce((s, v) => s + v, 0)
        : 0;

      const isDone = p.challenge_type === 'sotka'
        ? totalToday >= 100
        : totalToday >= 34;

      if (!isDone) {
        // Send reminder
        const name = p.tg_first_name || 'участник';
        const done = totalToday > 0
          ? `Уже сделано ${totalToday} повторений — осталось совсем немного!`
          : 'Ещё ни одного повторения сегодня.';

        const text = `💪 ${name}, не забудь про челлендж!\n\n${done}\n\nСделай свои 100 прямо сейчас — ты знаешь что надо. Не ложись спать без тренировки!\n\n👉 Открыть приложение`;

        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
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

        sent++;
        // Small delay to avoid Telegram rate limit
        await new Promise(r => setTimeout(r, 50));
      }
    }

    return res.status(200).json({
      ok: true,
      date: today,
      sent,
      skipped,
      total: participants.length
    });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
