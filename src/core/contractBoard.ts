import { generateRoutePlans, routePlanInsight, routePlanTravelForecast } from "./game";
import type { Contract, GameState, RoutePlan } from "./types";

export type ContractBoardTone = "ready" | "caution" | "danger";

export interface ContractBoardAssessment {
  contractId: string;
  plan: RoutePlan | null;
  tone: ContractBoardTone;
  seal: "宜" | "慎" | "险" | "断";
  title: string;
  summary: string;
  days: number;
  deadlineMargin: number;
  supplyCost: number;
  supplyBalance: number;
  staminaBalance: number;
  borderSegments: number;
  knownDanger: number;
  rewardPerDay: number;
  weatherSummary: string;
  intelLabel: string;
  score: number;
}

function clampDanger(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function routePressure(game: GameState, contract: Contract, plan: RoutePlan) {
  const travel = routePlanTravelForecast(game, plan);
  const insight = routePlanInsight(game, plan);
  const deadlineMargin = contract.deadline - travel.days;
  const supplyBalance = game.supplies - travel.supplyCost;
  const staminaBalance = game.convoy.horseStamina - travel.staminaCost;
  const knownDanger = clampDanger(insight.knownDanger + travel.totalDangerModifier);
  const pressure = travel.days * 4
    + knownDanger * .55
    + insight.borderSegments * 9
    + Math.max(0, -deadlineMargin) * 24
    + Math.max(0, -supplyBalance) * 8
    + Math.max(0, -staminaBalance) * 1.8
    + insight.blockedSegments * 80;
  return { travel, insight, deadlineMargin, supplyBalance, staminaBalance, knownDanger, pressure };
}

/**
 * Gives the contract board an honest, pre-acceptance estimate using only the
 * player's current cart, horses, active roster, known roads and weather. It
 * deliberately does not reveal hidden cargo information or actual road state.
 */
export function contractBoardAssessment(game: GameState, contract: Contract): ContractBoardAssessment {
  const plans = generateRoutePlans(contract.from, contract.to, game);
  if (!plans.length) return {
    contractId: contract.id,
    plan: null,
    tone: "danger",
    seal: "断",
    title: "已知道路暂断",
    summary: "现有路报找不到可通行的完整路线，先核验道路或等待局势变化。",
    days: 0,
    deadlineMargin: -contract.deadline,
    supplyCost: 0,
    supplyBalance: game.supplies,
    staminaBalance: game.convoy.horseStamina,
    borderSegments: 0,
    knownDanger: 100,
    rewardPerDay: 0,
    weatherSummary: "无可用行程",
    intelLabel: "路断",
    score: -10_000,
  };

  const ranked = plans
    .map((plan) => ({ plan, ...routePressure(game, contract, plan) }))
    .sort((a, b) => a.pressure - b.pressure || a.travel.days - b.travel.days || a.plan.id.localeCompare(b.plan.id));
  const best = ranked[0];
  const { travel, insight, deadlineMargin, supplyBalance, staminaBalance, knownDanger } = best;
  const hardPressure = deadlineMargin < 0 || supplyBalance < -3 || staminaBalance < -25 || insight.blockedSegments > 0;
  const tightPressure = deadlineMargin <= 2 || supplyBalance < 0 || staminaBalance < 0 || knownDanger >= 66 || insight.borderSegments > 0 || insight.freshness !== "fresh";
  const tone: ContractBoardTone = hardPressure ? "danger" : tightPressure ? "caution" : "ready";
  const rewardPerDay = Math.max(1, Math.round(contract.reward / Math.max(1, travel.days)));
  const score = Math.round(
    rewardPerDay * 2.6
      + Math.min(5, deadlineMargin) * 4
      + Math.min(8, supplyBalance) * 1.5
      + Math.min(24, staminaBalance) * .45
      - knownDanger * .5
      - insight.borderSegments * 9
      - Math.max(0, -deadlineMargin) * 28
      - Math.max(0, -supplyBalance) * 10
      - Math.max(0, -staminaBalance) * 2,
  );
  const title = tone === "ready"
    ? "车马从容，可作首选"
    : tone === "danger"
      ? deadlineMargin < 0 ? "照今报难守原限" : supplyBalance < -3 ? "余粮缺口过大" : staminaBalance < -25 ? "马力难撑全程" : "今报有断路"
      : deadlineMargin <= 2 ? "能走，期限很紧" : supplyBalance < 0 || staminaBalance < 0 ? "能走，途中须整顿" : insight.borderSegments > 0 ? "能走，须过边关" : knownDanger >= 66 ? "能走，路险偏高" : "能走，旧报需核";
  const summary = tone === "ready"
    ? `按「${best.plan.label}」估算，粮马和期限都留有余地。`
    : tone === "danger"
      ? "先补足粮马、核验道路或另看一张镖单，再决定是否冒险。"
      : `按「${best.plan.label}」可以成行，但至少有一项余量偏紧。`;
  const intelLabel = insight.freshness === "fresh" ? "今报" : insight.freshness === "aging" ? "旧报" : "传闻";

  return {
    contractId: contract.id,
    plan: best.plan,
    tone,
    seal: tone === "ready" ? "宜" : tone === "caution" ? "慎" : "险",
    title,
    summary,
    days: travel.days,
    deadlineMargin,
    supplyCost: travel.supplyCost,
    supplyBalance,
    staminaBalance,
    borderSegments: insight.borderSegments,
    knownDanger,
    rewardPerDay,
    weatherSummary: travel.weatherSummary,
    intelLabel,
    score,
  };
}

export function rankContractsForBoard(game: GameState, contracts: readonly Contract[]): ContractBoardAssessment[] {
  return contracts
    .map((contract) => contractBoardAssessment(game, contract))
    .sort((a, b) => b.score - a.score || a.contractId.localeCompare(b.contractId));
}
