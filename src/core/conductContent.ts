import type { ConductState, Contract, GameState, PrincipleId } from "./types";

export type ConductCounter = keyof ConductState;

export interface PrincipleView {
  id: PrincipleId;
  seal: string;
  title: string;
  proverb: string;
  description: string;
  effect: string;
  counter: ConductCounter;
  current: number;
  threshold: number;
  unlocked: boolean;
  progress: number;
}

const PRINCIPLE_META: Array<Omit<PrincipleView, "current" | "unlocked" | "progress">> = [
  {
    id: "clear-eyed", seal: "察", title: "明察慎接", proverb: "先问其来路，再接其干系",
    description: "风云行愿意在落笔前花工夫查清镖底，牙人与脚店知道该把真消息先送来。",
    effect: "访查镖单少花 2 两",
    counter: "investigations", threshold: 3,
  },
  {
    id: "sealed-oath", seal: "印", title: "守印如山", proverb: "宁折车轴，不损一印",
    description: "委托人逐渐相信，只要封签交到风云行手里，抵城时便仍是原样。",
    effect: "封签镖结算酬金 +8%",
    counter: "intactSealedDeliveries", threshold: 2,
  },
  {
    id: "living-promise", seal: "生", title: "活镖不弃", proverb: "人既入车，便送到门前",
    description: "携家带口者都听过风云行的规矩：一旦接下活镖，便不会拿人换路。",
    effect: "活镖结算酬金 +10%，镖榜更常见活镖",
    counter: "escortDeliveries", threshold: 2,
  },
  {
    id: "shadow-pass", seal: "隐", title: "暗渡关山", proverb: "旗可不亮，镖须过关",
    description: "沿边脚夫熟悉风云行换票、分装与改名的手法，愿意提前备好藏路。",
    effect: "隐蔽越境少耗 1 份补给且不减往来",
    counter: "concealedBorders", threshold: 2,
  },
  {
    id: "peaceful-road", seal: "和", title: "以和开路", proverb: "银钱能解的关，不必拿命硬闯",
    description: "关吏、寨丁都知道风云行按规矩给钱，不拖、不欠，也不在路边拔刀。",
    effect: "关费与山寨买路银降低 15%",
    counter: "peacefulPassages", threshold: 3,
  },
];

export function createConductState(): ConductState {
  return { investigations: 0, intactSealedDeliveries: 0, escortDeliveries: 0, concealedBorders: 0, peacefulPassages: 0 };
}

export function conductPrinciples(game: Pick<GameState, "conduct">): PrincipleView[] {
  const conduct = game.conduct ?? createConductState();
  return PRINCIPLE_META.map((principle) => {
    const current = conduct[principle.counter] ?? 0;
    return {
      ...principle,
      current,
      unlocked: current >= principle.threshold,
      progress: Math.round(Math.min(1, current / principle.threshold) * 100),
    };
  });
}

export function hasPrinciple(game: Pick<GameState, "conduct">, principleId: PrincipleId): boolean {
  return conductPrinciples(game).some((principle) => principle.id === principleId && principle.unlocked);
}

export function advanceConduct(game: GameState, increments: Partial<ConductState>): GameState {
  const before = conductPrinciples(game);
  const previous = game.conduct ?? createConductState();
  const conduct = { ...previous };
  for (const counter of Object.keys(increments) as ConductCounter[]) {
    conduct[counter] = Math.max(0, conduct[counter] + (increments[counter] ?? 0));
  }
  const next = { ...game, conduct };
  const newlyUnlocked = conductPrinciples(next).filter((principle) => principle.unlocked && !before.find((item) => item.id === principle.id)?.unlocked);
  if (!newlyUnlocked.length) return next;
  return {
    ...next,
    news: [
      ...newlyUnlocked.map((principle) => `【行号风骨】江湖为风云行添了「${principle.title}」之名：${principle.effect}。`),
      ...next.news,
    ].slice(0, 6),
  };
}

export function principleInvestigationDiscount(game: Pick<GameState, "conduct">): number {
  return hasPrinciple(game, "clear-eyed") ? 2 : 0;
}

export function principleRewardMultiplier(game: Pick<GameState, "conduct">, contract: Contract): { multiplier: number; label: string | null } {
  if (contract.kind === "escort" && hasPrinciple(game, "living-promise")) return { multiplier: 1.1, label: "活镖不弃" };
  if (contract.sealRequired && hasPrinciple(game, "sealed-oath")) return { multiplier: 1.08, label: "守印如山" };
  return { multiplier: 1, label: null };
}

export function principlePassageMultiplier(game: Pick<GameState, "conduct">): number {
  return hasPrinciple(game, "peaceful-road") ? .85 : 1;
}

export function principleConcealSaving(game: Pick<GameState, "conduct">): number {
  return hasPrinciple(game, "shadow-pass") ? 1 : 0;
}
