const express = require('express');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── PROXY ROUTE ────────────────────────────────────────
app.post('/proxy/add_uid', async (req, res) => {
  const TARGET = 'http://cloud.obsidianhosting.xyz:2091/api/free/add_uid';
  try {
    const response = await fetch(TARGET, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(req.body)
    });
    const text = await response.text();
    res.status(response.status).send(text);
  } catch (err) {
    console.error('Proxy error:', err.message);
    res.status(502).send('Proxy error: ' + err.message);
  }
});

// ── SELF PING HEALTH CHECK ─────────────────────────────
app.get('/ping', (req, res) => {
  res.status(200).send('pong');
});

// ── SELF PING LOOP ─────────────────────────────────────
// Render free tier sleeps after 15 min inactivity
// Ping every 10 min to keep it awake
const RENDER_URL = process.env.RENDER_EXTERNAL_URL || null;

function selfPing() {
  if (!RENDER_URL) {
    console.log('[ping] RENDER_EXTERNAL_URL not set, skipping self-ping.');
    return;
  }
  const url = `${RENDER_URL}/ping`;
  fetch(url)
    .then(r => console.log(`[ping] ${new Date().toISOString()} → ${r.status}`))
    .catch(e => console.error('[ping] error:', e.message));
}

// Start pinging after 1 min delay, then every 10 min
setTimeout(() => {
  selfPing();
  setInterval(selfPing, 10 * 60 * 1000);
}, 60 * 1000);

// Catch-all
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`UID Portal running on port ${PORT}`);
  console.log(`Self-ping URL: ${RENDER_URL || '(set RENDER_EXTERNAL_URL)'}/ping`);
});const WEBSITE_URL = process.env.WEBSITE_URL || 'http://localhost:3000';
exports.WEBSITE_URL = WEBSITE_URL;

