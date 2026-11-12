const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
//  .env aus dem Projektordner laden (MGA-Key) — ohne zusaetzliche Dependency
// ---------------------------------------------------------------------------
try {
  const envFile = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
  envFile.split(/\r?\n/).forEach((line) => {
    const m = line.match(/^(\w+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  });
} catch {
  console.warn('Keine .env gefunden – KI-Aufrufe schlagen fehl.');
}

const MGA_BASE = process.env.MGA_BASE_URL || 'https://chat.int.bayer.com/api/v2';
const MGA_MODEL = process.env.MGA_MODEL || 'claude-opus-5';

const app = express();

// ---------------------------------------------------------------------------
//  Sicherheits-Basis (siehe .clinerules/18-security.md)
// ---------------------------------------------------------------------------
app.use(cors());
app.use(express.json({ limit: '200kb' }));

// Passwortschutz fuer den Cloud-Betrieb (nur aktiv, wenn APP_PASSWORD gesetzt ist)
const crypto = require('crypto');
app.use((req, res, next) => {
  const pw = process.env.APP_PASSWORD;
  if (!pw) return next();
  const header = req.headers.authorization || '';
  const given = Buffer.from(header.replace(/^Basic /, ''), 'base64').toString().split(':').slice(1).join(':');
  const a = crypto.createHash('sha256').update(given).digest();
  const b = crypto.createHash('sha256').update(pw).digest();
  if (header.startsWith('Basic ') && crypto.timingSafeEqual(a, b)) return next();
  res.set('WWW-Authenticate', 'Basic realm="Session Notes Assistant"').status(401).send('Login required');
});

// /api-Praefix strippen — bildet den Vite-Proxy im Ein-Dienst-Betrieb nach
app.use((req, res, next) => {
  if (req.url.startsWith('/api/')) req.url = req.url.slice(4) || '/';
  next();
});

const isText = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const LANGS = { de: 'German', en: 'English' };
const STYLES = {
  note: 'a structured clinical session note for the patient record',
  letter: 'a concise report letter to the referring physician (Arztbrief style, flowing prose)',
};

async function chat(messages) {
  const res = await fetch(`${MGA_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.MGA_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: MGA_MODEL, messages, max_tokens: 2000, temperature: 0.2 }),
  });
  if (!res.ok) {
    const err = new Error('LLM request failed');
    err.code = 'LLM_ERROR';
    err.statusCode = 502;
    console.error('MGA status', res.status);
    throw err;
  }
  const data = await res.json();
  if (data.model !== MGA_MODEL) console.warn(`MGA: Fallback-Modell ${data.model}`);
  return data.choices[0].message.content;
}

// ---------------------------------------------------------------------------
//  Routen — KEIN /api-Praefix (Proxy strippt es)
// ---------------------------------------------------------------------------
app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.post('/summarize', async (req, res, next) => {
  try {
    const { keywords, meta = {}, language = 'de', style = 'note' } = req.body || {};
    if (!isText(keywords, 4000)) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'Keywords required (max 4000 chars)', statusCode: 400 });
    }
    if (!LANGS[language] || !STYLES[style]) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid language or style', statusCode: 400 });
    }
    const safe = (v) => (typeof v === 'string' ? v.slice(0, 120) : '');

    const system = `You are a documentation assistant for clinical psychologists at a German university hospital.
Turn the psychologist's terse session keywords into ${STYLES[style]}.
Rules:
- Write in ${LANGS[language]}, professional clinical-psychological terminology, third person, past tense.
- Use ONLY information contained in the keywords. Never invent symptoms, diagnoses, scores, quotes or events.
- If a section has no information, write exactly "${language === 'de' ? 'Keine Angaben.' : 'Not documented.'}"
- Expand abbreviations sensibly (e.g. "SI neg" = no suicidal ideation reported).
- Return ONLY valid JSON, no markdown fences, with this shape:
{"sections":[{"title":"...","text":"..."}],"openPoints":["..."]}
For a session note use these sections (translated to the output language): Reason for session / Current presentation, Mental status, Session content, Interventions, Risk assessment, Plan & next steps.
For a letter use a single section titled "${language === 'de' ? 'Bericht' : 'Report'}".
"openPoints" lists things the psychologist should check or complete (missing info, ambiguities). May be empty.`;

    const user = `Session details:
Patient (pseudonym): ${safe(meta.patient)}
Date: ${safe(meta.date)}
Session no.: ${safe(meta.session)}
Setting: ${safe(meta.setting)}

Keywords:
${keywords}`;

    const raw = await chat([
      { role: 'system', content: system },
      { role: 'user', content: user },
    ]);
    let parsed;
    try {
      parsed = JSON.parse(raw.replace(/^```(json)?\s*|\s*```$/g, ''));
    } catch {
      parsed = { sections: [{ title: language === 'de' ? 'Zusammenfassung' : 'Summary', text: raw }], openPoints: [] };
    }
    res.json(parsed);
  } catch (err) {
    next(err);
  }
});

// Gebautes Frontend ausliefern (Cloud-Betrieb) + SPA-Fallback
const DIST = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST));
  app.get('*', (req, res) => res.sendFile(path.join(DIST, 'index.html')));
}

// ---------------------------------------------------------------------------
//  Globaler Fehler-Handler — niemals interne Details nach aussen geben
// ---------------------------------------------------------------------------
app.use((err, req, res, next) => {
  console.error('Server error:', err.code || 'INTERNAL_ERROR');
  const code = err.statusCode || 500;
  res.status(code).json({
    error: err.code || 'INTERNAL_ERROR',
    message: code < 500 ? err.message : 'Ein unerwarteter Fehler ist aufgetreten',
    statusCode: code,
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend läuft auf Port ${PORT}`));
