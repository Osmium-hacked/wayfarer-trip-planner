// Thin client for any OpenAI-compatible /chat/completions endpoint
// (Groq, OpenRouter, OpenAI, Gemini's OpenAI layer, Ollama, ...).
// We use plain fetch instead of an SDK so the streaming logic is visible.

export class UpstreamError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'UpstreamError';
    this.status = status;
  }
}

export function getLlmConfig(env = process.env) {
  const apiKey = env.LLM_API_KEY?.trim() || '';
  return {
    apiKey,
    baseUrl: (env.LLM_BASE_URL || 'https://api.groq.com/openai/v1').trim().replace(/\/+$/, ''),
    model: (env.LLM_MODEL || 'llama-3.3-70b-versatile').trim(),
    // Some providers reject response_format together with stream=true, so it's opt-in.
    jsonMode: env.LLM_JSON_MODE === 'true',
    // No key → demo mode with a built-in generator, so the UI can be explored offline.
    mock: !apiKey || env.LLM_MOCK === 'true',
  };
}

export function providerName(baseUrl) {
  try {
    return new URL(baseUrl).hostname.replace(/^api\./, '');
  } catch {
    return 'custom';
  }
}

function readErrorMessage(body) {
  try {
    const json = JSON.parse(body);
    return json?.error?.message || json?.message || '';
  } catch {
    return body.slice(0, 200);
  }
}

/**
 * Streams the assistant's text content as it is generated.
 * Yields plain string deltas; throws UpstreamError on provider errors.
 */
export async function* streamChatCompletion({ messages, signal, config }) {
  const res = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      stream: true,
      temperature: 0.6,
      max_tokens: 6000,
      ...(config.jsonMode ? { response_format: { type: 'json_object' } } : {}),
    }),
    signal,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const detail = readErrorMessage(body);
    throw new UpstreamError(res.status, detail ? `Provider error ${res.status}: ${detail}` : `Provider error ${res.status}`);
  }
  if (!res.body) throw new UpstreamError(502, 'Provider returned no response body.');

  // Parse Server-Sent Events: lines of `data: {...}` terminated by `data: [DONE]`.
  const decoder = new TextDecoder();
  let buffer = '';
  for await (const chunk of res.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (data === '[DONE]') return;
      let event;
      try {
        event = JSON.parse(data);
      } catch {
        continue; // ignore keep-alives / partial garbage
      }
      if (event.error) {
        throw new UpstreamError(502, event.error.message || 'Provider stream error');
      }
      const delta = event.choices?.[0]?.delta?.content;
      if (typeof delta === 'string' && delta) yield delta;
    }
  }
}
