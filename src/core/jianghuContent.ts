export interface JianghuStandingDefinition {
  id: "unknown" | "heard" | "known-road" | "two-circuits" | "realm-known";
  seal: string;
  label: string;
  min: number;
  description: string;
  bluffBonus: number;
  tollMultiplier: number;
  recruitmentDiscount: number;
  contractRewardMultiplier: number;
}

export const JIANGHU_STANDINGS: readonly JianghuStandingDefinition[] = [
  {
    id: "unknown", seal: "生", label: "无名新号", min: 0,
    description: "旗号尚未传开，山寨、武馆与同行只按寻常新号相待。",
    bluffBonus: 0, tollMultiplier: 1, recruitmentDiscount: 0, contractRewardMultiplier: 1,
  },
  {
    id: "heard", seal: "闻", label: "初闻旗号", min: 10,
    description: "沿路脚夫开始认得镖旗，但还不足以只凭字号压住场面。",
    bluffBonus: 0.04, tollMultiplier: 0.96, recruitmentDiscount: 0.03, contractRewardMultiplier: 1.03,
  },
  {
    id: "known-road", seal: "路", label: "一路有名", min: 25,
    description: "一条商路上的寨主与同行都听过你的规矩，肯多让三分。",
    bluffBonus: 0.12, tollMultiplier: 0.84, recruitmentDiscount: 0.08, contractRewardMultiplier: 1.08,
  },
  {
    id: "two-circuits", seal: "望", label: "两路通名", min: 45,
    description: "旗号已经越过数路山河，武人愿来投，绿林也会先问名号。",
    bluffBonus: 0.22, tollMultiplier: 0.72, recruitmentDiscount: 0.13, contractRewardMultiplier: 1.13,
  },
  {
    id: "realm-known", seal: "震", label: "天下识旗", min: 70,
    description: "镖旗所到便是活招牌，江湖人物愿为这个字号卖一份面子。",
    bluffBonus: 0.34, tollMultiplier: 0.6, recruitmentDiscount: 0.18, contractRewardMultiplier: 1.2,
  },
];

export function clampJianghuReputation(value: number): number {
  return Math.max(0, Math.min(100, Math.round(Number.isFinite(value) ? value : 0)));
}

export function jianghuStanding(value: number): JianghuStandingDefinition {
  const reputation = clampJianghuReputation(value);
  return [...JIANGHU_STANDINGS].reverse().find((standing) => reputation >= standing.min) ?? JIANGHU_STANDINGS[0];
}

export function jianghuStandingProgress(value: number): { progress: number; nextMin: number | null; remaining: number } {
  const reputation = clampJianghuReputation(value);
  const standing = jianghuStanding(reputation);
  const index = JIANGHU_STANDINGS.findIndex((item) => item.id === standing.id);
  const next = JIANGHU_STANDINGS[index + 1];
  if (!next) return { progress: 100, nextMin: null, remaining: 0 };
  return {
    progress: Math.max(0, Math.min(100, Math.round(((reputation - standing.min) / (next.min - standing.min)) * 100))),
    nextMin: next.min,
    remaining: Math.max(0, next.min - reputation),
  };
}

export function jianghuRecruitmentCost(baseCost: number, value: number): number {
  const discount = jianghuStanding(value).recruitmentDiscount;
  return Math.max(1, Math.round(baseCost * (1 - discount)));
}
