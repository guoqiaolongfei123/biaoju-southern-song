import type { RouteCondition, RouteState } from "./types";

export interface RouteConditionEffect {
  label: string;
  seal: string;
  description: string;
  dayModifier: number;
  dangerModifier: number;
  staminaMultiplier: number;
  passable: boolean;
}

export const ROUTE_CONDITION_EFFECTS: Record<RouteCondition, RouteConditionEffect> = {
  clear: { label: "道路通行", seal: "通", description: "路况与驿报相符，可照常赶路。", dayModifier: 0, dangerModifier: 0, staminaMultiplier: 1, passable: true },
  muddy: { label: "雨后泥泞", seal: "泥", description: "车辙深陷，车马都要多耗一分力气。", dayModifier: 1, dangerModifier: 4, staminaMultiplier: 1.18, passable: true },
  flooded: { label: "涨水封渡", seal: "水", description: "渡船停航，强渡或等候都要付出代价。", dayModifier: 2, dangerModifier: 8, staminaMultiplier: 1.12, passable: false },
  blockaded: { label: "军府封道", seal: "禁", description: "军卒设栅封路，旧关牒不再保证通行。", dayModifier: 1, dangerModifier: 13, staminaMultiplier: 1.08, passable: false },
  banditry: { label: "匪踪频现", seal: "匪", description: "路上唿哨与暗记增多，山寨正在盯梢商旅。", dayModifier: 0, dangerModifier: 16, staminaMultiplier: 1.04, passable: true },
};

export function effectiveRouteCondition(state: RouteState | undefined, day: number): RouteCondition {
  if (!state || (state.clearsDay !== null && state.clearsDay <= day)) return "clear";
  return state.condition;
}

export function routeIsPassable(condition: RouteCondition): boolean {
  return ROUTE_CONDITION_EFFECTS[condition].passable;
}
