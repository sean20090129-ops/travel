export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    res.status(200).json({ summary: null }); // 沒 key 就安靜失敗，前端用預設摘要
    return;
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const {
      days, people, transport, cities = [], theme = '', kws = [], extra = '', spotsText = ''
    } = body;

    const prompt =
      `你是台灣旅遊摘要助手，只用繁體中文。` +
      `景點已由系統決定，你不能新增或刪改景點。` +
      `只輸出 JSON：{"summary":"40字內摘要"}。\n` +
      `需求：${days}天、${people}人、${transport}、縣市：${cities.join('、') || '未指定'}、` +
      `主題：${theme || '未指定'}、關鍵字：${(kws || []).join('、') || '無'}、補充：${extra || '無'}\n` +
      `景點：\n${spotsText}`;

    // 模型名稱若失效，到 AI Studio 換成目前可用的 Flash
    const model = 'gemini-2.0-flash';
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2 }
      })
    });

    if (!r.ok) {
      const t = await r.text();
      console.error('Gemini error', t);
      res.status(200).json({ summary: null });
      return;
    }

    const data = await r.json();
    let raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    raw = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
    const m = raw.match(/\{[\s\S]*\}/);
    let summary = null;
    if (m) {
      try {
        const j = JSON.parse(m[0]);
        if (j.summary) summary = String(j.summary).trim().slice(0, 80);
      } catch (_) {}
    }

    res.status(200).json({ summary });
  } catch (e) {
    console.error(e);
    res.status(200).json({ summary: null });
  }
}
