// Demo mode + failure simulation.
// Demo mode lets the app run with no API key. Simulations reproduce the ways a real
// model misbehaves (bad JSON, wrong shape, stalls, outages) so the UI's handling can be shown on demand.
import { UpstreamError } from './llm.js';

export const SIMULATIONS = [
  'malformed-once', // truncated JSON on the first attempt; the repair attempt succeeds
  'malformed', // truncated JSON on every attempt
  'wrong-shape',
  'empty',
  'partial', // messy-but-salvageable data → renders with warnings
  'not-a-trip',
  'slow', // 12 s before the first token, then succeeds
  'stall', // never sends anything → client idle timeout
  'error', // provider 503
  'rate-limit', // provider 429
];

export function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('aborted'));
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error('aborted'));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

async function* chunked(text, signal, size = 18, delay = 14) {
  for (let i = 0; i < text.length; i += size) {
    await sleep(delay, signal);
    yield text.slice(i, i + size);
  }
}

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const WORD_NUMBERS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7 };

function parseDays(prompt) {
  const digits = prompt.match(/(\d{1,2})\s*-?\s*(day|night)/i);
  if (digits) return clamp(Number(digits[1]), 1, 7);
  const words = prompt.match(/\b(one|two|three|four|five|six|seven)\s*-?\s*(day|night)/i);
  if (words) return WORD_NUMBERS[words[1].toLowerCase()];
  if (/\bweekend\b/i.test(prompt)) return 2;
  if (/\b(a|one)\s+week\b/i.test(prompt)) return 7;
  return 3;
}

function parseDestination(prompt) {
  const match = prompt.match(
    /\b(?:to|in|around|across|visit(?:ing)?|explor(?:e|ing))\s+((?:[A-Z][\p{L}'’.-]*)(?:\s+(?:[A-Z][\p{L}'’.-]*|de|del|la|di|da))*)/u,
  );
  return match ? match[1] : 'Your Destination';
}

const DAY_PLANS = [
  ['Arrival & first impressions', [
    ['14:00', 'Check in near the old town', 'lodging', 'Drop your bags and get your bearings in a central, walkable neighbourhood.', 45, 0, 'Ask the front desk for their favourite cheap lunch spot.'],
    ['15:30', 'Old town orientation walk', 'sight', 'An unhurried loop through the historic centre to see how the city fits together.', 90, 0, 'Free walking tours usually leave from the main square at 15:00 and 17:00.'],
    ['17:30', 'Sunset viewpoint', 'nature', 'Catch golden hour over the rooftops from the best-known lookout.', 60, 0, 'Arrive 20 minutes early to get a spot on the wall.'],
    ['19:30', 'Dinner at a neighbourhood bistro', 'food', 'Ease into the local cuisine somewhere small and family-run.', 90, 30, 'Order the daily special; it is what the kitchen is proudest of.'],
  ]],
  ['Landmarks & local history', [
    ['09:00', 'Breakfast at a corner café', 'food', 'Coffee and a pastry standing at the bar, the way locals do it.', 30, 6, ''],
    ['09:45', 'City history museum', 'sight', 'A compact museum that gives context for everything else you will see.', 120, 15, 'The top floor has a scale model of the old city.'],
    ['12:30', 'Lunch at the covered market', 'food', 'Graze between stalls: cheeses, cured meats, and whatever is in season.', 75, 18, 'Most stalls close by 15:00.'],
    ['14:30', 'Cathedral & bell tower', 'sight', 'Climb the tower for a 360° view of the city.', 75, 8, 'Cover shoulders and knees to enter.'],
    ['20:00', 'Live music bar', 'nightlife', 'End the day with local music in a low-key bar.', 120, 15, ''],
  ]],
  ['Markets, food & neighbourhoods', [
    ['10:00', 'Morning food walking tour', 'activity', 'A guided tasting walk through two contrasting neighbourhoods.', 180, 65, 'Skip breakfast. Seriously.'],
    ['14:00', 'Independent design shops', 'shopping', 'Browse small studios and makers along the creative quarter’s main street.', 90, 0, ''],
    ['16:00', 'Riverside park', 'nature', 'Rent a bike or just find a bench by the water.', 75, 10, ''],
    ['19:30', 'Tasting-menu dinner', 'food', 'A splurge dinner showcasing modern regional cooking.', 150, 70, 'Book a few days ahead for the counter seats.'],
  ]],
  ['Day trip into nature', [
    ['08:00', 'Regional train out of the city', 'transport', 'A scenic hour-long ride to the countryside.', 70, 12, 'Sit on the right-hand side for the views.'],
    ['09:30', 'Ridge hike', 'nature', 'A moderate trail with big views and a picnic spot at the top.', 210, 0, 'Bring water; there is nowhere to refill on the trail.'],
    ['14:00', 'Village lunch', 'food', 'Long lunch at a village tavern near the trailhead.', 90, 22, ''],
    ['17:00', 'Train back to the city', 'transport', 'Doze on the way back.', 70, 12, ''],
  ]],
  ['Art, design & hidden corners', [
    ['10:00', 'Contemporary art museum', 'sight', 'Rotating exhibitions in a striking modern building.', 120, 14, 'Free entry on the first Sunday of the month.'],
    ['12:30', 'Street-food lunch', 'food', 'The city’s signature snack from the most famous hole-in-the-wall.', 30, 8, ''],
    ['13:30', 'Street-art neighbourhood walk', 'activity', 'Self-guided loop past murals and tucked-away courtyards.', 90, 0, ''],
    ['16:00', 'Rooftop bar', 'nightlife', 'Early drinks with a view as the city lights come on.', 90, 18, ''],
  ]],
  ['Slow morning, scenic evening', [
    ['10:30', 'Long brunch', 'food', 'A lazy brunch at a café locals queue for.', 75, 20, ''],
    ['12:30', 'Botanical garden', 'nature', 'Shady paths, glasshouses and a quiet pond.', 90, 6, ''],
    ['15:00', 'Spa or hammam', 'activity', 'Recharge before the last big evening.', 120, 40, 'Weekday afternoons are the quietest.'],
    ['19:00', 'Sunset boat cruise', 'activity', 'See the skyline from the water at dusk.', 90, 30, ''],
  ]],
  ['Last bites & departure', [
    ['09:00', 'Farewell breakfast', 'food', 'Return to your favourite café from earlier in the trip.', 45, 8, ''],
    ['10:00', 'Souvenir shopping', 'shopping', 'Pick up edible gifts from the market and a local deli.', 60, 25, 'Vacuum-packed cheese travels well.'],
    ['12:00', 'Transfer to the airport', 'transport', 'Allow plenty of time for the trip out.', 60, 10, ''],
  ]],
];

export function buildMockTrip(prompt) {
  const dayCount = parseDays(prompt);
  const destination = parseDestination(prompt);
  const days = Array.from({ length: dayCount }, (_, i) => {
    // First day is always arrival, last (if > 1) always departure.
    const plan = i === 0 ? DAY_PLANS[0] : i === dayCount - 1 ? DAY_PLANS[6] : DAY_PLANS[1 + ((i - 1) % 5)];
    const [title, stops] = plan;
    return {
      title,
      stops: stops.map(([time, name, category, description, durationMinutes, cost, tip]) => ({
        time, name, category, description, durationMinutes, cost, tip,
        location: `${destination}`,
      })),
    };
  });
  return {
    title: `${dayCount} ${dayCount === 1 ? 'Day' : 'Days'} in ${destination}`,
    destination,
    summary:
      'Demo itinerary generated without an AI model. Add an LLM_API_KEY to .env for real, tailored plans.',
    currency: 'EUR',
    days,
    packingList: ['Comfortable walking shoes', 'Refillable water bottle', 'Light rain jacket', 'Power adapter', 'Day backpack', 'Sunscreen'],
    budget: [
      { category: 'Accommodation', amount: 110 * dayCount },
      { category: 'Food & drink', amount: 65 * dayCount },
      { category: 'Activities', amount: 35 * dayCount },
      { category: 'Local transport', amount: 12 * dayCount },
    ],
  };
}

function mockRefine(current, instruction) {
  const summary = String(current.summary || '').replace(/\s*\(Demo mode:.*\)$/, '');
  return {
    ...current,
    summary: `${summary} (Demo mode: a real model would apply “${instruction.slice(0, 80)}”.)`,
  };
}

export async function* mockStream(input, signal) {
  await sleep(500, signal);
  const trip = input.current ? mockRefine(input.current, input.prompt) : buildMockTrip(input.prompt);
  yield* chunked(JSON.stringify(trip, null, 1), signal);
}

export async function* simulatedStream(input, signal) {
  const base = input.current ? input.current : buildMockTrip(input.prompt);
  const full = JSON.stringify(base, null, 1);

  switch (input.simulate) {
    case 'malformed-once':
    case 'malformed':
      // Chatty preamble + code fence + JSON that is cut off mid-way.
      yield* chunked("Sure! Here's your itinerary:\n```json\n" + full.slice(0, Math.floor(full.length * 0.55)), signal);
      return;
    case 'wrong-shape':
      yield* chunked(
        JSON.stringify({
          trip: base.destination,
          plan: 'Day 1: Arrive and explore the old town. Day 2: Museums and markets. Day 3: Depart.',
        }),
        signal,
      );
      return;
    case 'empty':
      await sleep(900, signal);
      return;
    case 'partial': {
      const messy = structuredClone(base);
      messy.days[0].stops[1] = { time: '3:30 pm', description: 'A stop the model forgot to name.' };
      messy.days[0].stops.push('Gelato on the way home');
      if (messy.days[1]) {
        messy.days[1].activities = messy.days[1].stops.map((s) => ({
          ...s,
          title: s.name,
          name: undefined,
          duration: `${Math.round(s.durationMinutes / 60) || 1} hours`,
          cost: `€${s.cost}`,
          category: 'Restaurant',
        }));
        delete messy.days[1].stops;
      }
      messy.budget = 'about 900 euros';
      yield* chunked('```json\n' + JSON.stringify(messy, null, 1) + '\n```\nEnjoy your trip!', signal);
      return;
    }
    case 'not-a-trip':
      yield* chunked(
        JSON.stringify({
          error: 'not_a_trip',
          message: "I can only plan trips. Tell me where you'd like to go, for how long, and what you enjoy.",
        }),
        signal,
      );
      return;
    case 'slow':
      await sleep(12_000, signal);
      yield* chunked(full, signal);
      return;
    case 'stall':
      await sleep(10 * 60_000, signal);
      return;
    case 'error':
      throw new UpstreamError(503, 'Simulated provider outage (503 Service Unavailable).');
    case 'rate-limit':
      throw new UpstreamError(429, 'Simulated rate limit.');
    default:
      yield* chunked(full, signal);
  }
}
