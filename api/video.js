export default async function handler(req, res) {
  const { id } = req.query;

  const videos = {
    pushups:   'BAACAgIAAxkBAAN7adLLO_NnQHxKK4aGNvlTjmE1sWkAAtSmAAJt75hK29jlBJenGxM7BA',
    pullups:   'BAACAgIAAxkBAAN8adLMW_w0JFMgWwr_8w5c9DKxtOUAAtimAAJt75hKrZ4S6sSTeZs7BA',
    squats:    'BAACAgIAAxkBAAN9adLMq5v8H2Ufuq3ALaFlZ8INghEAAtmmAAJt75hK0qwgZQ4Zr6M7BA',
    dips:      'BAACAgIAAxkBAAN-adLM0AvJmb80OxJ4PWhaUys0h1EAAtqmAAJt75hKWoO1hvgOQmk7BA',
    crunches:  'BAACAgIAAxkBAAN_adLNCiGXxQvcyvi7meqSGqL8ljAAAtumAAJt75hKegzVHDLyIl87BA',
    kneeraise: 'BAACAgIAAxkBAAOAadLNQdivWlm-Oaf67iJn52-MrC4AAtymAAJt75hK81h0fPVn0po7BA',
    lunges:    'BAACAgIAAxkBAAOBadLNlBlR5xJbxP2T51AuQZxlrZQAAt2mAAJt75hKXKIGQreN77c7BA',
  };

  const fileId = videos[id];
  if (!fileId) return res.status(404).json({ error: 'not found' });

  const TOKEN = process.env.BOT_TOKEN;

  try {
    // Получаем путь к файлу
    const infoRes = await fetch(`https://api.telegram.org/bot${TOKEN}/getFile?file_id=${fileId}`);
    const info = await infoRes.json();

    if (!info.ok) return res.status(500).json({ error: 'telegram error' });

    const filePath = info.result.file_path;
    const videoRes = await fetch(`https://api.telegram.org/file/bot${TOKEN}/${filePath}`);

    if (!videoRes.ok) return res.status(500).json({ error: 'fetch error' });

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Cache-Control', 'public, max-age=86400');

    const buffer = await videoRes.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
