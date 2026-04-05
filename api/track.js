const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { tg_user_id, tg_username, tg_first_name, challenge_type, selected_exercises, start_date, log } = req.body;

    if (!tg_user_id) return res.status(400).json({ error: 'tg_user_id required' });

    // Подсчёт статистики
    const days_done = Object.keys(log || {}).filter(date => {
      const dayLog = log[date];
      return challenge_type === 'sotka'
        ? Object.values(dayLog).some(v => v >= 100)
        : Object.values(dayLog).reduce((s, v) => s + v, 0) >= 34;
    }).length;

    const total_reps = Object.values(log || {}).reduce((sum, dayLog) => {
      return sum + Object.values(dayLog).reduce((s, v) => s + v, 0);
    }, 0);

    // Серия
    let streak = 0;
    const today = new Date().toISOString().slice(0, 10);
    const sortedDates = Object.keys(log || {}).sort().reverse();
    for (const date of sortedDates) {
      if (date > today) continue;
      const dayLog = log[date];
      const done = challenge_type === 'sotka'
        ? Object.values(dayLog).some(v => v >= 100)
        : Object.values(dayLog).reduce((s, v) => s + v, 0) >= 34;
      if (done) streak++;
      else break;
    }

    const today_iso = new Date().toISOString();

    // Сначала пробуем UPDATE существующей записи
    const updateResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/participants?tg_user_id=eq.${encodeURIComponent(String(tg_user_id))}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          tg_username: tg_username || null,
          tg_first_name: tg_first_name || null,
          challenge_type: challenge_type || 'sotka',
          selected_exercises: selected_exercises || [],
          start_date: start_date || null,
          log: log || {},
          total_reps,
          days_done,
          streak,
          last_active: today,
          updated_at: today_iso
        })
      }
    );

    if (!updateResponse.ok) {
      const err = await updateResponse.text();
      return res.status(500).json({ error: 'PATCH failed: ' + err });
    }

    const updated = await updateResponse.json();

    // Если запись не найдена — создаём новую
    if (!updated || updated.length === 0) {
      const insertResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/participants`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({
            tg_user_id: String(tg_user_id),
            tg_username: tg_username || null,
            tg_first_name: tg_first_name || null,
            challenge_type: challenge_type || 'sotka',
            selected_exercises: selected_exercises || [],
            start_date: start_date || null,
            log: log || {},
            total_reps,
            days_done,
            streak,
            last_active: today,
            updated_at: today_iso
          })
        }
      );

      if (!insertResponse.ok) {
        const err = await insertResponse.text();
        return res.status(500).json({ error: 'INSERT failed: ' + err });
      }
    }

    return res.status(200).json({ ok: true, days_done, total_reps, streak });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
