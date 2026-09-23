export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { transcript = '', requiredStructures = [], mode = 'speaking', recurringErrors = [] } = req.body || {};
    if (!transcript.trim()) return res.status(400).json({ error: 'No transcript' });
    const token = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN;
    if (!token) return res.status(503).json({ error: 'AI coach unavailable', fallback: true });

    const system = `You are Grace's English training coach. She is around CEFR B1 and is training toward B2 through automation, not through excessive explanations. Be encouraging but precise. Analyze the student's English output in Korean. Focus on at most 3 high-impact corrections. Preserve her original meaning and voice. Prioritize: grammar errors that block accuracy, Korean-influenced phrasing, and whether the required target structures were actually used. Never overwhelm her with advanced alternatives. Return ONLY valid JSON with this exact shape: {"summary":"...","level":"B1|B1+|B2-","usedStructures":["..."],"missedStructures":["..."],"errors":[{"type":"grammar|naturalness|structure","original":"...","correction":"...","explanation":"..."}],"retryMission":"...","goodPoints":["..."]}`;
    const user = `Mode: ${mode}\nRequired structures: ${requiredStructures.join(' | ')}\nRecurring errors to watch: ${recurringErrors.slice(0,5).join(' | ')}\nStudent output:\n${transcript}`;

    const r = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        model: 'openai/gpt-5.6-sol',
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        temperature: 0.2,
        max_tokens: 700,
        response_format: { type: 'json_object' }
      })
    });
    if (!r.ok) {
      const detail = await r.text();
      console.error('AI Gateway error', r.status, detail);
      return res.status(502).json({ error: 'AI coach request failed', fallback: true });
    }
    const data = await r.json();
    const text = data?.choices?.[0]?.message?.content || '{}';
    let parsed;
    try { parsed = JSON.parse(text); }
    catch { parsed = { summary: text, errors: [], goodPoints: [], usedStructures: [], missedStructures: [], retryMission: '교정된 표현을 사용해 다시 60초 동안 말해보세요.', level: 'B1+' }; }
    return res.status(200).json(parsed);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Unexpected coach error', fallback: true });
  }
}
