import type { CareerEndingId, CareerObjectiveId, GameState } from "./types";

export interface CareerRequirement {
  label: string;
  current: number;
  target: number;
  complete: boolean;
}

export interface CareerObjectiveView {
  id: CareerObjectiveId;
  order: number;
  seal: string;
  title: string;
  subtitle: string;
  description: string;
  reward: { silver: number; reputation: number };
  status: "locked" | "active" | "ready" | "claimed";
  requirements: CareerRequirement[];
  progress: number;
}

export interface CareerEndingView {
  id: CareerEndingId;
  outcome: "victory" | "defeat";
  seal: string;
  eyebrow: string;
  title: string;
  summary: string;
  verse: string;
}

const OBJECTIVE_META: Array<Omit<CareerObjectiveView, "status" | "requirements" | "progress">> = [
  {
    id: "jiangnan-foundation",
    order: 1,
    seal: "立",
    title: "江南立足",
    subtitle: "先让一面镖旗在行在站稳",
    description: "连续办妥几趟差事，让总号所在的市井真正记住风云行的字号。",
    reward: { silver: 45, reputation: 3 },
  },
  {
    id: "trade-network",
    order: 2,
    seal: "通",
    title: "商路成网",
    subtitle: "把脚程变成可以倚仗的家业",
    description: "经营异地网点，反复踏勘旧途，让镖局不再只靠一城一车。",
    reward: { silver: 70, reputation: 5 },
  },
  {
    id: "renowned-escort",
    order: 3,
    seal: "名",
    title: "名镖天下",
    subtitle: "城门换旗，风云行的镖旗不倒",
    description: "在多城立信、跨境结交并建成三处网点，奠定天下行号之名。",
    reward: { silver: 100, reputation: 8 },
  },
];

function requirement(label: string, current: number, target: number): CareerRequirement {
  return { label, current, target, complete: current >= target };
}

function objectiveRequirements(game: GameState, id: CareerObjectiveId): CareerRequirement[] {
  const activeOffices = Object.values(game.offices).filter((office) => office.active).length;
  const masteredRoutes = Object.values(game.routeIntel).filter((intel) => intel.trips >= 2).length;
  const trustedCities = Object.values(game.cityReputation ?? {}).filter((score) => score >= 25).length;
  const foreignRelations = (["jin", "xixia", "dali", "tibetan", "mongol"] as const)
    .map((factionId) => game.relations[factionId] ?? 0);
  const bestForeignRelation = Math.max(...foreignRelations);

  if (id === "jiangnan-foundation") return [
    requirement("办妥镖单", game.completedContracts, 2),
    requirement("总号信用", game.reputation, 35),
  ];
  if (id === "trade-network") return [
    requirement("办妥镖单", game.completedContracts, 4),
    requirement("在营网点", activeOffices, 2),
    requirement("走成熟路", masteredRoutes, 3),
  ];
  return [
    requirement("办妥镖单", game.completedContracts, 7),
    requirement("在营网点", activeOffices, 3),
    requirement("信重城市", trustedCities, 2),
    requirement("异境往来", bestForeignRelation, 15),
  ];
}

export function careerObjectiveProgress(game: GameState): CareerObjectiveView[] {
  const claimed = game.career?.claimedObjectiveIds ?? [];
  return OBJECTIVE_META.map((meta, index) => {
    const requirements = objectiveRequirements(game, meta.id);
    const previousClaimed = index === 0 || claimed.includes(OBJECTIVE_META[index - 1].id);
    const complete = requirements.every((item) => item.complete);
    const status: CareerObjectiveView["status"] = claimed.includes(meta.id)
      ? "claimed"
      : !previousClaimed
        ? "locked"
        : complete
          ? "ready"
          : "active";
    const progress = Math.round(requirements.reduce((sum, item) => sum + Math.max(0, Math.min(1, item.current / item.target)), 0) / requirements.length * 100);
    return { ...meta, requirements, status, progress };
  });
}

export const CAREER_ENDINGS: Record<CareerEndingId, CareerEndingView> = {
  "great-escort": {
    id: "great-escort", outcome: "victory", seal: "成", eyebrow: "阶段志业 · 功成",
    title: "一旗行天下", summary: "风云行已从一间初立总号，长成跨越城关与政权的镖业网络。",
    verse: "山河多故，信义有归；此卷虽合，镖旗仍在风中。",
  },
  "credit-collapse": {
    id: "credit-collapse", outcome: "defeat", seal: "失", eyebrow: "行号歇业 · 信用尽失",
    title: "无人再托镖", summary: "接连的失约耗尽了最后一点信用，牙行与商户都从风云行门前绕道。",
    verse: "银钱可再聚，失信最难赎。掌柜只得收起旧旗，来日重开。",
  },
  "convoy-ruin": {
    id: "convoy-ruin", outcome: "defeat", seal: "殁", eyebrow: "行号歇业 · 镖队离散",
    title: "无人能够出镖", summary: "镖头重伤，能站进镖阵的人手已不足三名，总号再也凑不出一支队伍。",
    verse: "车辙断在旧途，幸存者各自养伤；若再举旗，须从头点将。",
  },
  insolvent: {
    id: "insolvent", outcome: "defeat", seal: "尽", eyebrow: "行号歇业 · 家底告罄",
    title: "车粮俱尽", summary: "库中无银、车上无粮，残破的镖车也撑不到下一座驿站。",
    verse: "不是每一间行号都败在刀下；有时，最后一根车轴就是结局。",
  },
};

export function careerEnding(game: GameState): CareerEndingView | null {
  const endingId = game.career?.endingId;
  return endingId ? CAREER_ENDINGS[endingId] : null;
}

export function careerDefeat(game: GameState): CareerEndingId | null {
  const fitCrew = game.crew.filter((member) => member.hp >= 20).length;
  if (game.reputation <= 0) return "credit-collapse";
  if (game.convoy.leaderHp <= 1 && fitCrew < 3) return "convoy-ruin";
  if (game.silver <= 0 && game.supplies <= 0 && game.convoy.cartHp <= 15) return "insolvent";
  return null;
}
