import { createFormationExperience, normalizeFormationExperience } from "./formationProficiency";
import { normalizeCrewInjury } from "./injuryContent";
import { normalizeDeputyBonds } from "./deputyBondContent";
import type { LeaderProgression } from "./types";
import { CORE_COMBAT_FOCUSES, DEFAULT_CORE_COMBAT_FOCUS, createCoreCombatExperience, normalizeCoreCombatExperience } from "./coreCombatFocusContent";
import { createMartialProficiencyExperience, normalizeMartialProficiencyExperience } from "./martialProficiencyContent";

export const PLAYER_LEADER_ID = "player-leader" as const;

export function createInitialLeader(): LeaderProgression {
  return {
    id: PLAYER_LEADER_ID,
    name: "沈砺",
    courtesy: "持衡",
    title: "总镖头",
    experience: 0,
    martialExperience: createMartialProficiencyExperience(),
    coreCombatFocusId: DEFAULT_CORE_COMBAT_FOCUS,
    coreCombatExperience: createCoreCombatExperience(),
    formationExperience: createFormationExperience(),
    deputyBonds: {},
    injury: null,
  };
}

export function normalizeLeaderProgression(value: unknown): LeaderProgression {
  const fallback = createInitialLeader();
  if (!value || typeof value !== "object") return fallback;
  const source = value as Record<string, unknown>;
  return {
    id: PLAYER_LEADER_ID,
    name: typeof source.name === "string" && source.name.trim() ? source.name : fallback.name,
    courtesy: typeof source.courtesy === "string" && source.courtesy.trim() ? source.courtesy : fallback.courtesy,
    title: "总镖头",
    experience: typeof source.experience === "number" ? Math.max(0, Math.floor(source.experience)) : 0,
    martialExperience: normalizeMartialProficiencyExperience(source.martialExperience),
    coreCombatFocusId: typeof source.coreCombatFocusId === "string" && source.coreCombatFocusId in CORE_COMBAT_FOCUSES
      ? source.coreCombatFocusId as LeaderProgression["coreCombatFocusId"]
      : DEFAULT_CORE_COMBAT_FOCUS,
    coreCombatExperience: normalizeCoreCombatExperience(source.coreCombatExperience),
    formationExperience: normalizeFormationExperience(source.formationExperience),
    deputyBonds: normalizeDeputyBonds(source.deputyBonds),
    injury: normalizeCrewInjury(source.injury),
  };
}
