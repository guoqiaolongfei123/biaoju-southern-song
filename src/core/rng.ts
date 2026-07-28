export interface RandomStep {
  value: number;
  state: number;
}

export function randomStep(state: number): RandomStep {
  let next = (state + 0x6d2b79f5) | 0;
  let value = next;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return { value: ((value ^ (value >>> 14)) >>> 0) / 4294967296, state: next };
}

export function randomInt(state: number, min: number, max: number): { value: number; state: number } {
  const step = randomStep(state);
  return { value: Math.floor(step.value * (max - min + 1)) + min, state: step.state };
}

export function pickRandom<T>(state: number, items: readonly T[]): { value: T; state: number } {
  const step = randomInt(state, 0, items.length - 1);
  return { value: items[step.value], state: step.state };
}
