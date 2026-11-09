# Wayfarer: AI trip planner

Describe a trip in plain words ("4 slow days in Lisbon, seafood and viewpoints, no museums"). An LLM returns a
**structured JSON itinerary**, and the app turns it into an interactive day-by-day plan: expand stops, remove them,
reorder them (drag and drop, buttons, or keyboard, within a day or across days), and refine the plan with follow-up
prompts that edit it in place.

It is not a chatbot. The model's text is never shown to the user directly. It is parsed, validated and normalized
into app state, and every way the model can misbehave has a defined UI outcome.

---

## Quick start

Requires **Node 20.19+**.

```bash
npm install
npm start          # API on :8787 + Vite on :5173
```

Open http://localhost:5173.

**No API key? It still runs.** Without `LLM_API_KEY` the server runs in **demo mode** and generates sample
itineraries locally (the header shows a "Demo mode" badge). To use a real model:

```bash
cp .env.example .env    # then set LLM_API_KEY (and optionally LLM_BASE_URL / LLM_MODEL)
npm start
```

Any OpenAI-compatible chat-completions endpoint works. `.env.example` has ready-made blocks for **Groq** (default,
free tier), **Gemini**, **OpenRouter** and **Ollama** (local, free).

| Command | What it does |
| --- | --- |
| `npm start` | API server + Vite dev server together |
| `npm test` | Unit tests (parsing, normalization, reducer) |
| `npm run build && npm run serve` | Production build served by the Express server (honours `PORT`) |

---

## How it works

```
 Browser (React)                                Node (Express)                 LLM provider
 ───────────────                                ──────────────                 ────────────
 Composer / RefineBar
   │  useItineraryGenerator.run()
   │    POST /api/itinerary  {prompt, current?, repair?}
   │ ─────────────────────────────────────────▶ validate body
   │                                            build messages (system schema) ─▶ /chat/completions stream=true
   │    NDJSON stream: {"type":"delta"} …       ◀── SSE deltas ──────────────────
   │ ◀───────────────────────────────────────── {"type":"done"} | {"type":"error"}
   │  live preview  ← parsePartialJson()   (throttled, best-effort)
   │  on done       ← parseModelJson() → normalizeItinerary()   ← the trust boundary
   │                    ├─ ok → dispatch(load | replace)   (undoable)
   │                    ├─ parse/shape/empty → ONE automatic repair request
   │                    └─ anything else → typed ItineraryError → ErrorPanel
```

- **The API key never reaches the browser.** The React app only talks to `/api/itinerary`; the Express server
  holds the key and calls the provider (`server/llm.js`, plain `fetch`, no SDK, so the SSE parsing is visible).
- **Streaming.** The server re-emits the provider's SSE deltas as NDJSON events. The client renders a live preview by
  parsing the *incomplete* JSON: it scans for safe cut points (after `{`/`[`/`}`/`]`, before `,`) and closes the open
  brackets (`src/lib/parseJson.js`).
- **Normalization is the trust boundary** (`src/lib/normalize.js`). Whatever the model sends, components only ever
  see one shape. Small drift is fixed silently (`activities` instead of `stops`, `"2 hours"` → `120`, `"3:30 pm"` →
  `"15:30"`, `"Restaurant"` → `food`, a stop given as a bare string, `{ "itinerary": {...} }` nesting, a bare array
  of days). Anything thrown away is reported to the user as a warning.
- **State** is a pure reducer wrapped in undo/redo history (`src/state/tripReducer.js`). User edits *and* AI
  refinements go through it, so everything is undoable and one drag = one undo step.

### Handling bad AI output

| What the model / network does | What the user sees |
| --- | --- |
| Prose or ```` ```json ```` fences around the JSON, `<think>` blocks, trailing chatter | Nothing. It's stripped. |
| Trailing commas | Nothing. Fixed in a fallback parse. |
| Truncated / invalid JSON, wrong shape, empty reply | "Fixing a malformed answer…" → **one automatic repair request** (the model is shown its own output and the parse error). If that also fails: an error card with *Try again*, *Edit request*, and the raw output under *Technical details*. |
| Valid but messy data (unnamed stops, unreadable budget, >14 days…) | Itinerary renders; a dismissible banner lists exactly what was skipped or trimmed. |
| Model says the input isn't a trip | A friendly "That doesn't look like a trip yet" with the model's own hint. No retry button, since retrying won't help. |
| Slow first token | "Taking a little longer than usual" after 8 s. |
| Connected but stalled | Client idle timeout after 30 s without bytes → *The AI is taking too long* + retry. Server also has a 90 s hard timeout. |
| Provider 5xx / 429 / bad key / network down / stream dropped mid-way | Specific copy for each (`src/lib/errors.js`), retry where it makes sense. |
| User fires a new request (or cancels, or switches trip) while one is in flight | The old request is **aborted** (the server aborts the upstream call too) and every state update is guarded by a run id, so a stale response can never overwrite a newer one. |
| A **refinement** fails | The current itinerary is untouched; the error appears inline above the refine bar with the instruction kept for retry. |

**Try all of these yourself:** the flask icon in the header opens a *failure simulator* (malformed JSON, wrong
shape, empty, messy data, not-a-trip, slow, stall, 503, 429). It works in demo and live mode. Disable it in production
with `ALLOW_SIMULATE=false`.

---

## Features

**Required**
- React with hooks and function components only
- Free-form text input with examples, character limit, Ctrl/⌘+Enter
- Real LLM through a backend proxy; structured JSON → interactive, stateful UI
- Expand / remove / reorder stops (drag & drop across days, ↑/↓ buttons, *Move to day…*, keyboard)
- Loading (step indicator + skeletons + live preview), error, and empty states
- Works on mobile: thin timeline rail, touch-friendly drag handles, sticky day navigation, safe-area aware refine bar

**Stretch**
- ✅ Different block types: timeline stops, a **budget bar chart**, a **packing checklist**
- ✅ Streaming with a live partial-JSON preview
- ✅ Refinement loop: follow-ups edit the existing itinerary (the current JSON is sent back), undoable
- ✅ Save & reload: trips autosave to `localStorage`, "My trips" drawer, resume from the home screen
- ✅ Polish: light/dark/system theme, animations (respecting `prefers-reduced-motion`), keyboard navigation
  (↑/↓ between stops, Alt+↑/↓ to reorder, Del to remove, Ctrl+Z / Ctrl+Shift+Z), focus management after moves
  and deletes, toast undo for destructive actions

---

## Project structure

```
server/
  index.js        Express app: validation, NDJSON streaming, timeouts, error mapping
  llm.js          OpenAI-compatible streaming client (SSE parsing)
  prompts.js      System prompt (schema) + create / refine / repair message builders
  mock.js         Demo-mode generator + failure simulations
src/
  lib/
    parseJson.js  Extract JSON from model text; full + partial (streaming) parsing
    normalize.js  Validate & coerce model output into the app's trip shape
    errors.js     ItineraryError kinds + user-facing copy
    api.js        fetch + NDJSON reader, idle timeout, abort handling
    storage.js    Guarded localStorage (validated reads, quota-safe writes)
  hooks/
    useItineraryGenerator.js   stream → preview → parse → validate → repair; race-safe
    useTheme.js, useHealth.js, useToasts.jsx
  state/tripReducer.js         Pure trip reducer + undo/redo history
  components/                  Composer, GenerationProgress, ErrorPanel, TripView, DayBoard,
                               StopCard, AddStopForm, SideCards, RefineBar, SavedTrips, Header
tests/                         Vitest: parser, normalizer, reducer (45 tests)
```

---

## Decisions & trade-offs

- **Plain `fetch` instead of an AI SDK** so the streaming and error handling are explicit and easy to explain.
  JSON mode (`response_format`) is opt-in (`LLM_JSON_MODE=true`) because some providers reject it together with
  streaming. The prompt plus the tolerant parser plus the repair loop cover the gap.
- **Hand-written normalizer instead of a schema library.** Rejecting output wasn't the goal; *salvaging* it was, so
  each field has explicit coercion rules and the user gets told what was dropped.
- **One repair attempt, not N.** It fixes most truncation/format slips without doubling latency on every failure.
- **Refine sends the whole itinerary back** and replaces it (ids re-generated, packing ticks carried over). This is
  simpler and more robust than asking the model for a patch/diff format.
- **Undo for removals is targeted** (`restoreStop` puts that exact stop back where it was), so the toast's "Undo"
  stays correct even if you made other edits in between.

## Known limitations

- Refinement regenerates the whole itinerary, so a model may occasionally change things it wasn't asked to change
  (mitigated by the prompt and one-click undo).
- Stops have no real geodata: map links are Google Maps searches, and travel times are the model's estimate.
- Costs/budgets are model estimates in whatever currency it picks; there is no conversion.
- Trips are stored per-browser in `localStorage` (no accounts or sync); oldest trips are dropped past 20 or on quota errors.
- Demo mode's refinement doesn't actually change the plan; it only annotates the summary.
- No rate limiting on the proxy endpoint. Add one before deploying publicly.

## What I'd do next

- Component tests (React Testing Library) for the generator hook's race handling and the error states
- Editable stop fields (time, notes) and a map view
- Rate limiting + request logging on the API; deploy (Render/Fly/Vercel functions)
- Diff view after a refinement ("3 stops changed on day 2")

---

## AI usage note

> ✏️ **Fill this in honestly before submitting.** The assignment says honesty here counts in your favour.

This project was built with help from an AI coding assistant (Claude Code). It was used for:
- _e.g. scaffolding the project and components, drafting the CSS, writing the partial-JSON parser and tests…_

What I did myself / reviewed:
- _e.g. chose the architecture, reviewed and understood every file, tested every failure mode by hand…_

## Time spent

> ✏️ _Fill in: e.g. ~X hours total (breakdown)._
