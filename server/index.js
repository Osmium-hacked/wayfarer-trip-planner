import dotenv from 'dotenv';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getLlmConfig, providerName, streamChatCompletion, UpstreamError } from './llm.js';
import { buildMessages } from './prompts.js';
import { mockStream, simulatedStream, SIMULATIONS } from './mock.js';

dotenv.config({ quiet: true });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IS_PRODUCTION = process.argv.includes('--production');
// In dev the API needs its own port (Vite owns PORT); hosting platforms set PORT for production.
const PORT = Number(process.env.API_PORT || (IS_PRODUCTION ? process.env.PORT : '')) || 8787;
const UPSTREAM_TIMEOUT_MS = 90_000;
const MAX_PROMPT_LENGTH = 2000;
const config = getLlmConfig();
const allowSimulate = process.env.ALLOW_SIMULATE !== 'false';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    mode: config.mock ? 'demo' : 'live',
    provider: config.mock ? null : providerName(config.baseUrl),
    model: config.mock ? null : config.model,
    simulations: allowSimulate ? SIMULATIONS : [],
  });
});

function validateBody(body) {
  if (!body || typeof body !== 'object') return { error: 'Request body must be a JSON object.' };
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt) return { error: 'Please describe your trip.' };
  if (prompt.length > MAX_PROMPT_LENGTH) return { error: `Please keep it under ${MAX_PROMPT_LENGTH} characters.` };

  const current = body.current && typeof body.current === 'object' && !Array.isArray(body.current) ? body.current : null;
  const repair =
    body.repair && typeof body.repair === 'object'
      ? { raw: String(body.repair.raw ?? '').slice(0, 8000), error: String(body.repair.error ?? '').slice(0, 300) }
      : null;
  const originalPrompt = typeof body.originalPrompt === 'string' ? body.originalPrompt.slice(0, MAX_PROMPT_LENGTH) : '';
  const simulate = allowSimulate && SIMULATIONS.includes(body.simulate) ? body.simulate : null;
  return { prompt, current, repair, originalPrompt, simulate };
}

function toFailure(err, timedOut) {
  if (timedOut) return { status: 504, code: 'timeout', message: 'The AI provider took too long to respond.' };
  if (err instanceof UpstreamError) {
    if (err.status === 401 || err.status === 403) {
      return { status: 502, code: 'auth', message: 'The AI provider rejected the API key. Check LLM_API_KEY in .env.' };
    }
    if (err.status === 429) {
      return { status: 429, code: 'rate_limit', message: 'The AI provider is rate-limiting requests.' };
    }
    return { status: 502, code: 'upstream', message: err.message };
  }
  return { status: 502, code: 'network', message: "The server couldn't reach the AI provider." };
}

/**
 * POST /api/itinerary  →  application/x-ndjson stream of
 *   {"type":"delta","text":"..."}  …  {"type":"done"}   or   {"type":"error","code","message"}
 * Errors that happen before the first token are returned as a normal HTTP error with JSON body.
 */
app.post('/api/itinerary', async (req, res) => {
  const input = validateBody(req.body);
  if (input.error) return res.status(400).json({ error: { code: 'bad_request', message: input.error } });

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, UPSTREAM_TIMEOUT_MS);
  // If the browser goes away (user cancelled / started a new request), stop paying for tokens.
  res.on('close', () => {
    if (!res.writableEnded) controller.abort();
  });

  let started = false;
  const send = (event) => {
    if (!started) {
      started = true;
      res.status(200);
      res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('X-Accel-Buffering', 'no');
    }
    res.write(`${JSON.stringify(event)}\n`);
  };

  try {
    const source = input.simulate
      ? simulatedStream(input, controller.signal)
      : config.mock
        ? mockStream(input, controller.signal)
        : streamChatCompletion({ messages: buildMessages(input), signal: controller.signal, config });

    for await (const text of source) send({ type: 'delta', text });
    send({ type: 'done' });
    res.end();
  } catch (err) {
    if (res.destroyed || (controller.signal.aborted && !timedOut)) return; // client disconnected
    const { status, ...failure } = toFailure(err, timedOut);
    console.error(`[itinerary] ${failure.code}: ${err?.message ?? err}`);
    if (started) {
      send({ type: 'error', ...failure });
      res.end();
    } else {
      res.status(status).json({ error: failure });
    }
  } finally {
    clearTimeout(timer);
  }
});

app.use('/api', (_req, res) => res.status(404).json({ error: { code: 'not_found', message: 'Unknown API route.' } }));

// In production (`npm run build && npm run serve`) the same server hosts the built frontend.
const dist = path.resolve(__dirname, '../dist');
if (IS_PRODUCTION && fs.existsSync(path.join(dist, 'index.html'))) {
  app.use(express.static(dist));
  app.use((req, res, next) => (req.method === 'GET' ? res.sendFile(path.join(dist, 'index.html')) : next()));
}

app.listen(PORT, () => {
  const mode = config.mock
    ? 'DEMO mode (no LLM_API_KEY set; using the built-in sample generator)'
    : `LIVE mode → ${providerName(config.baseUrl)} / ${config.model}`;
  console.log(`API listening on http://localhost:${PORT}  ·  ${mode}`);
});
