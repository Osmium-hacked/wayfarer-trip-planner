export const SYSTEM_PROMPT = `You are a travel-planning engine. You turn a traveller's free-form description into a structured, realistic day-by-day itinerary.

Respond with ONE JSON object and nothing else: no markdown, no code fences, no commentary.

Schema:
{
  "title": string,            // short evocative trip name, e.g. "Four Slow Days in Lisbon"
  "destination": string,      // "City, Country" or region
  "summary": string,          // 1-2 sentences describing the trip's feel
  "currency": string,         // ISO 4217 code used for every cost, e.g. "EUR"
  "days": [
    {
      "title": string,        // theme of the day, e.g. "Alfama & the river"
      "stops": [
        {
          "time": string,             // 24h "HH:MM" start time
          "name": string,             // specific place or activity
          "category": "sight" | "food" | "activity" | "nature" | "shopping" | "nightlife" | "transport" | "lodging" | "other",
          "description": string,      // 1-2 sentences: what to do there and why
          "durationMinutes": number,
          "cost": number,             // estimated cost per person in "currency"; 0 if free
          "tip": string,              // short insider tip, or ""
          "location": string          // address or neighbourhood + city, used for a map search
        }
      ]
    }
  ],
  "packingList": string[],    // 5-10 items specific to this trip, season and activities
  "budget": [ { "category": string, "amount": number } ]   // per-person estimate for the whole trip, 3-6 categories
}

Rules:
- If the traveller gives a trip length, produce exactly that many days (maximum 14). Otherwise plan 3 days.
- 3-6 stops per day in chronological order, leaving realistic travel time between them.
- Respect stated interests, pace, budget, season, and constraints (diet, mobility, kids, etc.).
- Prefer real, specific places you are confident exist.
- If the input is not a request to plan a trip, respond with exactly:
  {"error": "not_a_trip", "message": "<one friendly sentence saying what you need from them>"}`;

/** Builds the chat messages for a create, refine, or repair request. */
export function buildMessages({ prompt, current, repair, originalPrompt }) {
  const messages = [{ role: 'system', content: SYSTEM_PROMPT }];

  if (current) {
    const context = originalPrompt ? `Original trip request: ${originalPrompt}\n\n` : '';
    messages.push({
      role: 'user',
      content:
        `${context}Current itinerary JSON:\n${JSON.stringify(current)}\n\n` +
        'Apply the change below and return the COMPLETE updated itinerary using the same schema. ' +
        "Keep everything the change doesn't affect exactly as it is.\n\n" +
        `Change: ${prompt}`,
    });
  } else {
    messages.push({ role: 'user', content: prompt });
  }

  // Repair loop: show the model its own bad output and what was wrong with it.
  if (repair) {
    messages.push({ role: 'assistant', content: repair.raw || '(empty response)' });
    messages.push({
      role: 'user',
      content: `Your previous reply could not be used: ${repair.error} Reply again with ONLY the corrected JSON object, following the schema exactly.`,
    });
  }

  return messages;
}
