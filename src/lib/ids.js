// crypto.randomUUID is only available in secure contexts, and it breaks when testing on a
// phone over http://192.168.x.x, so we use a small random id instead.
let counter = 0;
export function createId(prefix = 'id') {
  counter = (counter + 1) % 1e6;
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}${counter.toString(36)}`;
}
