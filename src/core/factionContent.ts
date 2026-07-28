import type { FactionId, FactionStandingTier } from "./types";

export interface FactionStandingEffect {
  tier: FactionStandingTier;
  label: string;
  seal: string;
  description: string;
  priceMultiplier: number;
  passageMultiplier: number;
  rewardMultiplier: number;
  inspectionCover: number;
  nextAt: number | null;
}

export const FACTION_STANDING_EFFECTS: Record<FactionStandingTier, FactionStandingEffect> = {
  hostile: {
    tier: "hostile", label: "缉拿在册", seal: "仇",
    description: "官驿与关吏已把风云行列入黑册，入境、整备与验牒都会格外艰难。",
    priceMultiplier: 1.18, passageMultiplier: 1.42, rewardMultiplier: .9, inspectionCover: -.06, nextAt: -10,
  },
  watched: {
    tier: "watched", label: "严加盘诘", seal: "疑",
    description: "当地衙门对镖局心存疑虑，行院只肯做现银买卖，边关也会多问几句。",
    priceMultiplier: 1.08, passageMultiplier: 1.18, rewardMultiplier: .96, inspectionCover: 0, nextAt: 0,
  },
  neutral: {
    tier: "neutral", label: "素无往来", seal: "生",
    description: "风云行在此政权治下尚无深交，照章纳税、按例验牒便可行走。",
    priceMultiplier: 1, passageMultiplier: 1, rewardMultiplier: 1, inspectionCover: .04, nextAt: 15,
  },
  recognized: {
    tier: "recognized", label: "行院相识", seal: "识",
    description: "官牙与驿站认得风云行的旗号，整备、关税和镖榜都会多给一分方便。",
    priceMultiplier: .96, passageMultiplier: .82, rewardMultiplier: 1.05, inspectionCover: .12, nextAt: 35,
  },
  honored: {
    tier: "honored", label: "持牒通行", seal: "信",
    description: "镖局在此政权治下已有信誉，行院肯出具路引，边吏也不愿轻易刁难。",
    priceMultiplier: .91, passageMultiplier: .65, rewardMultiplier: 1.1, inspectionCover: .2, nextAt: null,
  },
};

export function clampFactionRelation(score: number): number {
  return Math.max(-50, Math.min(50, Math.round(score)));
}

export function factionStanding(score: number): FactionStandingEffect {
  if (score < -10) return FACTION_STANDING_EFFECTS.hostile;
  if (score < 0) return FACTION_STANDING_EFFECTS.watched;
  if (score < 15) return FACTION_STANDING_EFFECTS.neutral;
  if (score < 35) return FACTION_STANDING_EFFECTS.recognized;
  return FACTION_STANDING_EFFECTS.honored;
}

export function factionStandingProgress(score: number): { min: number; max: number; value: number } {
  const standing = factionStanding(score);
  const bounds: Record<FactionStandingTier, [number, number]> = {
    hostile: [-50, -10], watched: [-10, 0], neutral: [0, 15], recognized: [15, 35], honored: [35, 50],
  };
  const [min, max] = bounds[standing.tier];
  return { min, max, value: Math.max(0, Math.min(100, ((score - min) / Math.max(1, max - min)) * 100)) };
}

export function createFactionRecord(value: number): Record<FactionId, number> {
  return { song: value, jin: value, xixia: value, dali: value, tibetan: value, mongol: value, neutral: value };
}
