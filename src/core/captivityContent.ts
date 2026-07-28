import { ROUTES, cityById, routeById } from "./data";
import type { CrewCaptivity, CrewMember, GameState } from "./types";

export interface CaptivityReleaseOffer {
  available: boolean;
  enabled: boolean;
  atNegotiatingCity: boolean;
  routeId: string | null;
  routeName: string;
  captor: string;
  endpointNames: string[];
  cost: number;
  days: number;
  discount: number;
  reason: string;
}

export function normalizeCrewCaptivity(value: unknown): CrewCaptivity | null {
  if (!value || typeof value !== "object") return null;
  const captivity = value as Partial<CrewCaptivity>;
  if (typeof captivity.routeId !== "string" || !ROUTES.some((route) => route.id === captivity.routeId)) return null;
  return {
    routeId: captivity.routeId,
    captor: typeof captivity.captor === "string" && captivity.captor.trim() ? captivity.captor.trim() : "不明寨众",
    sinceDay: Math.max(1, Math.round(typeof captivity.sinceDay === "number" ? captivity.sinceDay : 1)),
    ransom: Math.max(10, Math.round(typeof captivity.ransom === "number" ? captivity.ransom : 28)),
  };
}

export function captivityRansomFor(member: CrewMember, routeDanger: number): number {
  const rankLevel = member.experience >= 14 ? 3 : member.experience >= 7 ? 2 : member.experience >= 3 ? 1 : 0;
  return Math.max(24, Math.min(96, Math.round(18 + rankLevel * 12 + routeDanger * .42 + member.wage * .55)));
}

export function captivityReleaseOffer(game: GameState, crewId: string): CaptivityReleaseOffer {
  const member = game.crew.find((candidate) => candidate.id === crewId);
  const captivity = member?.captivity;
  if (!member || !captivity) return {
    available: false,
    enabled: false,
    atNegotiatingCity: false,
    routeId: null,
    routeName: "",
    captor: "",
    endpointNames: [],
    cost: 0,
    days: 0,
    discount: 0,
    reason: "此人未被扣押",
  };
  const route = routeById(captivity.routeId);
  const atNegotiatingCity = route.from === game.currentCityId || route.to === game.currentCityId;
  const brokerOffice = atNegotiatingCity && Boolean(game.offices[game.currentCityId]?.active);
  const discount = brokerOffice ? .2 : 0;
  const cost = Math.ceil(captivity.ransom * (1 - discount));
  const days = brokerOffice ? 1 : 2;
  const endpointNames = [cityById(route.from).name, cityById(route.to).name];
  const reason = game.phase !== "map"
    ? "须回到天下舆图后处置"
    : !atNegotiatingCity
      ? `须到${endpointNames.join("或")}托人说项`
      : game.silver < cost
        ? `尚缺 ${cost - game.silver} 两赎金`
        : brokerOffice
          ? "本号网点可代为压价接人"
          : "当地行院可代递赎书";
  return {
    available: true,
    enabled: game.phase === "map" && atNegotiatingCity && game.silver >= cost,
    atNegotiatingCity,
    routeId: route.id,
    routeName: route.name,
    captor: captivity.captor,
    endpointNames,
    cost,
    days,
    discount,
    reason,
  };
}
