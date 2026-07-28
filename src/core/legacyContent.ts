import type { CareerEndingId, GameState, LegacyId, LegacyState } from "./types";

export interface LegacyBoon {
  id: LegacyId;
  seal: string;
  title: string;
  subtitle: string;
  description: string;
  effect: string;
  unlockEnding: CareerEndingId;
  unlockLabel: string;
}

export interface LegacyStartingModifiers {
  silver: number;
  supplies: number;
  reputation: number;
  jianghuReputation: number;
  morale: number;
  crewExperience: number;
  localRouteMastery: number;
}

export const LEGACY_BOONS: Record<LegacyId, LegacyBoon> = {
  "guarantor-letter": {
    id: "guarantor-letter", seal: "信", title: "旧客保状", subtitle: "失信歇业后的最后一封荐书",
    description: "旧主顾仍愿替新号说一句公道话，让下一面镖旗不必从无人问津开始。",
    effect: "新局信用 +5",
    unlockEnding: "credit-collapse", unlockLabel: "达成结局「无人再托镖」",
  },
  "veteran-token": {
    id: "veteran-token", seal: "人", title: "旧部腰牌", subtitle: "离散镖队留下的点将凭信",
    description: "旧部的招式与规矩写进腰牌，新局最初三人带着更多阅历与更稳的军心归队。",
    effect: "初始队员阅历 +35、士气 +5、江湖声望 +5",
    unlockEnding: "convoy-ruin", unlockLabel: "达成结局「无人能够出镖」",
  },
  "merchant-credit": {
    id: "merchant-credit", seal: "资", title: "牙行赊帖", subtitle: "家底告罄后留下的同行周转",
    description: "牙行肯为重开的字号赊出第一批粮银，至少让新车能走到下一处驿站。",
    effect: "新局现银 +45、补给 +3",
    unlockEnding: "insolvent", unlockLabel: "达成结局「车粮俱尽」",
  },
  "route-ledger": {
    id: "route-ledger", seal: "路", title: "天下旧路谱", subtitle: "一旗行天下后誊下的总号路簿",
    description: "旧局趟出的里程没有随卷宗合上；新总号周边道路从开门起便按熟路计算。",
    effect: "总号相邻道路获得一层熟路",
    unlockEnding: "great-escort", unlockLabel: "达成结局「一旗行天下」",
  },
};

export const LEGACY_BOON_LIST = Object.values(LEGACY_BOONS);

export function createLegacyState(): LegacyState {
  return { version: 1, completedRuns: 0, victories: 0, bestCompletedContracts: 0, unlockedIds: [], recordedRunKeys: [] };
}

export function normalizeLegacyState(value: unknown): LegacyState {
  if (!value || typeof value !== "object") return createLegacyState();
  const raw = value as Partial<LegacyState>;
  const unlockedIds = Array.isArray(raw.unlockedIds)
    ? raw.unlockedIds.filter((id): id is LegacyId => typeof id === "string" && id in LEGACY_BOONS)
    : [];
  const recordedRunKeys = Array.isArray(raw.recordedRunKeys) ? raw.recordedRunKeys.filter((key): key is string => typeof key === "string").slice(-24) : [];
  return {
    version: 1,
    completedRuns: Math.max(0, Math.floor(Number(raw.completedRuns) || 0)),
    victories: Math.max(0, Math.floor(Number(raw.victories) || 0)),
    bestCompletedContracts: Math.max(0, Math.floor(Number(raw.bestCompletedContracts) || 0)),
    unlockedIds: [...new Set(unlockedIds)],
    recordedRunKeys,
  };
}

export function legacyRunKey(game: GameState): string {
  return `${game.seed}:${game.originId}:${game.day}:${game.career.endingId ?? "open"}:${game.completedContracts}`;
}

export function recordLegacyEnding(legacy: LegacyState, game: GameState): LegacyState {
  const endingId = game.career.endingId;
  if (game.phase !== "gameover" || !endingId) return legacy;
  const key = legacyRunKey(game);
  if (legacy.recordedRunKeys.includes(key)) return legacy;
  const boon = LEGACY_BOON_LIST.find((item) => item.unlockEnding === endingId);
  return {
    ...legacy,
    completedRuns: legacy.completedRuns + 1,
    victories: legacy.victories + (endingId === "great-escort" ? 1 : 0),
    bestCompletedContracts: Math.max(legacy.bestCompletedContracts, game.completedContracts),
    unlockedIds: boon && !legacy.unlockedIds.includes(boon.id) ? [...legacy.unlockedIds, boon.id] : legacy.unlockedIds,
    recordedRunKeys: [...legacy.recordedRunKeys, key].slice(-24),
  };
}

export function legacyStartingModifiers(id: LegacyId | null | undefined): LegacyStartingModifiers {
  if (id === "guarantor-letter") return { silver: 0, supplies: 0, reputation: 5, jianghuReputation: 0, morale: 0, crewExperience: 0, localRouteMastery: 0 };
  if (id === "veteran-token") return { silver: 0, supplies: 0, reputation: 0, jianghuReputation: 5, morale: 5, crewExperience: 35, localRouteMastery: 0 };
  if (id === "merchant-credit") return { silver: 45, supplies: 3, reputation: 0, jianghuReputation: 0, morale: 0, crewExperience: 0, localRouteMastery: 0 };
  if (id === "route-ledger") return { silver: 0, supplies: 0, reputation: 0, jianghuReputation: 0, morale: 0, crewExperience: 0, localRouteMastery: 1 };
  return { silver: 0, supplies: 0, reputation: 0, jianghuReputation: 0, morale: 0, crewExperience: 0, localRouteMastery: 0 };
}
