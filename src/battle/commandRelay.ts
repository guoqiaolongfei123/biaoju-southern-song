import type { BattleStrategy } from "./simulation";

export interface BattleCommandRelayProfile {
  guardCount: number;
  morale: number;
  hasDeputyCommand: boolean;
  responderCount: number;
}

export interface BattleCommandRelayState {
  active: BattleStrategy;
  pending: BattleStrategy | null;
  elapsed: number;
  duration: number;
  serial: number;
}

export interface BattleCommandRelayStep {
  state: BattleCommandRelayState;
  committed: BattleStrategy | null;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

export function battleCommandRelayDuration(profile: BattleCommandRelayProfile): number {
  const formationSpan = Math.max(0, profile.guardCount - 3) * .045;
  const moraleDelay = Math.max(0, 70 - profile.morale) * .004;
  const commandBonus = profile.hasDeputyCommand ? .1 : 0;
  const responderBonus = Math.min(.08, Math.max(0, profile.responderCount) * .04);
  return Math.round(clamp(.58 + formationSpan + moraleDelay - commandBonus - responderBonus, .36, .78) * 100) / 100;
}

export function createBattleCommandRelay(active: BattleStrategy = "balanced"): BattleCommandRelayState {
  return { active, pending: null, elapsed: 0, duration: 0, serial: 0 };
}

export function issueBattleCommand(state: BattleCommandRelayState, strategy: BattleStrategy, duration: number): BattleCommandRelayState {
  if (strategy === state.active) {
    if (!state.pending) return state;
    return { ...state, pending: null, elapsed: 0, duration: 0, serial: state.serial + 1 };
  }
  if (strategy === state.pending) return state;
  return {
    ...state,
    pending: strategy,
    elapsed: 0,
    duration: Math.max(.01, duration),
    serial: state.serial + 1,
  };
}

export function advanceBattleCommand(state: BattleCommandRelayState, deltaSeconds: number): BattleCommandRelayStep {
  if (!state.pending || deltaSeconds <= 0) return { state, committed: null };
  const elapsed = state.elapsed + deltaSeconds;
  if (elapsed < state.duration) return { state: { ...state, elapsed }, committed: null };
  const committed = state.pending;
  return {
    state: { ...state, active: committed, pending: null, elapsed: 0, duration: 0 },
    committed,
  };
}

export function battleCommandRelayProgress(state: BattleCommandRelayState): number {
  if (!state.pending || state.duration <= 0) return 1;
  return clamp(state.elapsed / state.duration, 0, 1);
}

export function battleCommandRelayRemaining(state: BattleCommandRelayState): number {
  return state.pending ? Math.max(0, state.duration - state.elapsed) : 0;
}
