import { useState } from 'react';

// Synthetic example sessions — invented, no real patient data.
const EXAMPLES = [
  {
    label: 'Depression · session 6',
    meta: { patient: 'Patient A.', session: '6', setting: 'Outpatient, individual' },
    keywords: `mood slightly better than last wk, sleep still 4-5h, early waking
BDI-II 24 (prev 29)
work conflict w/ supervisor, rumination evenings
behavioural activation: walked 3x, cooked 2x -> felt "a bit lighter"
SI neg, no plans, protective: daughter
HW: activity diary + 1 pleasant activity/day
next appt 2 wks, discuss sleep hygiene`,
  },
  {
    label: 'Anxiety · first contact',
    meta: { patient: 'Patient B.', session: '1', setting: 'Consultation, inpatient (internal med.)' },
    keywords: `referred by cardiology after neg cardiac workup
panic attacks ~3x/wk since 4 months, palpitations, fear of dying
avoids driving on motorway, stopped gym
no prior psych tx, alcohol occasional
psychoeducation panic cycle, pt receptive
SI neg
recommend outpatient CBT, list of practices handed out`,
  },
  {
    label: 'Crisis · short contact',
    meta: { patient: 'Patient C.', session: '3', setting: 'Psycho-oncology liaison' },
    keywords: `new dx progression, pt tearful, overwhelmed
fears for children, partner supportive
passive death wishes, no active SI, distanced credibly
stabilisation, resource activation
informed ward physician
follow-up tomorrow`,
  },
];

const today = () => new Date().toISOString().slice(0, 10);

export default function App() {
  const [meta, setMeta] = useState({ patient: '', date: today(), session: '', setting: '' });
  const [keywords, setKeywords] = useState('');
  const [language, setLanguage] = useState('de');
  const [style, setStyle] = useState('note');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [seconds, setSeconds] = useState(null);

  function loadExample(ex) {
    setMeta({ ...ex.meta, date: today() });
    setKeywords(ex.keywords);
    setResult(null);
    setError('');
  }

  async function generate() {
    if (!keywords.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    const t0 = performance.now();
    try {
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords, meta, language, style }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error');
      setResult(data);
      setSeconds(((performance.now() - t0) / 1000).toFixed(0));
    } catch (e) {
      setError('The summary could not be generated. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function updateSection(i, text) {
    setResult((r) => ({ ...r, sections: r.sections.map((s, j) => (j === i ? { ...s, text } : s)) }));
  }

  function copyAll() {
    const head = [meta.patient, meta.date, meta.session && `#${meta.session}`, meta.setting].filter(Boolean).join(' · ');
    const body = result.sections.map((s) => `${s.title}\n${s.text}`).join('\n\n');
    navigator.clipboard.writeText(`${head}\n\n${body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  const words = keywords.trim() ? keywords.trim().split(/\s+/).length : 0;

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">
          <span className="dot" />
          Session Notes Assistant
          <span className="sub">Clinical Psychology</span>
        </div>
        <span className="pill">Demo · synthetic data only</span>
      </header>

      <main className="layout">
        {/* ---------- Input ---------- */}
        <section className="card">
          <div className="card-head">
            <h2>1 · Your keywords</h2>
            <div className="examples">
              {EXAMPLES.map((ex) => (
                <button key={ex.label} className="chip" onClick={() => loadExample(ex)}>
                  {ex.label}
                </button>
              ))}
            </div>
          </div>

          <div className="meta-grid">
            <label>Patient (pseudonym)<input value={meta.patient} maxLength={60} onChange={(e) => setMeta({ ...meta, patient: e.target.value })} placeholder="e.g. Patient A." /></label>
            <label>Date<input type="date" value={meta.date} onChange={(e) => setMeta({ ...meta, date: e.target.value })} /></label>
            <label>Session no.<input value={meta.session} maxLength={6} onChange={(e) => setMeta({ ...meta, session: e.target.value })} placeholder="e.g. 4" /></label>
            <label>Setting<input value={meta.setting} maxLength={80} onChange={(e) => setMeta({ ...meta, setting: e.target.value })} placeholder="e.g. Outpatient, individual" /></label>
          </div>

          <textarea
            className="keywords"
            value={keywords}
            maxLength={4000}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder={'Jot down what happened, as short as you like…\n\nmood better, sleep 5h\nBDI 24\nSI neg\nHW: activity diary'}
          />
          <div className="hint">{words} words</div>

          <div className="controls">
            <div className="seg">
              <span>Format</span>
              <button className={style === 'note' ? 'on' : ''} onClick={() => setStyle('note')}>Session note</button>
              <button className={style === 'letter' ? 'on' : ''} onClick={() => setStyle('letter')}>Report letter</button>
            </div>
            <div className="seg">
              <span>Language</span>
              <button className={language === 'de' ? 'on' : ''} onClick={() => setLanguage('de')}>Deutsch</button>
              <button className={language === 'en' ? 'on' : ''} onClick={() => setLanguage('en')}>English</button>
            </div>
          </div>

          <button className="primary" disabled={loading || !keywords.trim()} onClick={generate}>
            {loading ? 'Writing summary…' : 'Generate summary'}
          </button>
        </section>

        {/* ---------- Output ---------- */}
        <section className="card output">
          <div className="card-head">
            <h2>2 · Draft summary</h2>
            {result && (
              <button className="ghost" onClick={copyAll}>{copied ? '✓ Copied' : 'Copy to record'}</button>
            )}
          </div>

          {!result && !loading && !error && (
            <div className="empty">
              <div className="empty-icon">✎</div>
              Enter a few keywords on the left — the structured draft appears here.<br />
              You review, edit and sign off. Nothing is saved.
            </div>
          )}
          {loading && (
            <div className="skeleton">
              {[1, 2, 3, 4].map((i) => <div key={i}><span className="bar short" /><span className="bar" /><span className="bar mid" /></div>)}
            </div>
          )}
          {error && <div className="error">{error}</div>}

          {result && (
            <>
              <div className="doc-head">
                <strong>{meta.patient || 'Patient'}</strong>
                <span>{[meta.date, meta.session && `Session ${meta.session}`, meta.setting].filter(Boolean).join(' · ')}</span>
              </div>
              {result.sections.map((s, i) => (
                <div key={i} className="section">
                  <h3>{s.title}</h3>
                  <textarea value={s.text} onChange={(e) => updateSection(i, e.target.value)} rows={Math.max(2, Math.ceil(s.text.length / 80))} />
                </div>
              ))}
              {result.openPoints?.length > 0 && (
                <div className="open">
                  <h3>⚠ Please check</h3>
                  <ul>{result.openPoints.map((p, i) => <li key={i}>{p}</li>)}</ul>
                </div>
              )}
              <div className="foot">
                Draft generated in {seconds}s from {words} words · AI draft — review before signing.
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
