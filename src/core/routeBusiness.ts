import type { BusinessRecord, RouteDefinition, RouteIntelState } from "./types";

export type RouteBusinessTone = "untraveled" | "known" | "profit" | "even" | "loss";

export interface RouteBusinessInsight {
  routeId: string;
  trips: number;
  ledgerTrips: number;
  deliveredTrips: number;
  allocatedNet: number;
  averageAllocatedNet: number;
  lastClosedDay: number | null;
  lastTitle: string | null;
  tone: RouteBusinessTone;
  seal: string;
  masteryLabel: string;
  summary: string;
}

function masteryLabel(trips: number): string {
  if (trips >= 4) return "老路成谱";
  if (trips >= 2) return "熟路可凭";
  if (trips >= 1) return "本号走过";
  return "尚未亲走";
}

function toneFor(trips: number, ledgerTrips: number, allocatedNet: number): RouteBusinessTone {
  if (ledgerTrips > 0) return allocatedNet > 2 ? "profit" : allocatedNet < -2 ? "loss" : "even";
  return trips > 0 ? "known" : "untraveled";
}

function sealFor(tone: RouteBusinessTone): string {
  if (tone === "profit") return "盈";
  if (tone === "loss") return "亏";
  if (tone === "even") return "平";
  if (tone === "known") return "熟";
  return "未";
}

/**
 * Attributes a completed trip's actual net cash across the distinct road
 * segments it used. This is intentionally an accounting estimate rather than
 * a new hidden economy: the road book always labels the number as apportioned.
 */
export function routeBusinessInsights(
  routes: RouteDefinition[],
  routeIntel: Record<string, RouteIntelState>,
  records: BusinessRecord[] | undefined,
): Record<string, RouteBusinessInsight> {
  const validRouteIds = new Set(routes.map((route) => route.id));
  const working = new Map(routes.map((route) => [route.id, {
    ledgerTrips: 0,
    deliveredTrips: 0,
    allocatedNet: 0,
    lastClosedDay: null as number | null,
    lastTitle: null as string | null,
  }]));

  for (const record of records ?? []) {
    const routeIds = [...new Set(record.routeIds)].filter((routeId) => validRouteIds.has(routeId));
    if (!routeIds.length) continue;
    const netShare = record.finance.netChange / routeIds.length;
    for (const routeId of routeIds) {
      const item = working.get(routeId)!;
      item.ledgerTrips += 1;
      item.deliveredTrips += record.outcome === "delivery" ? 1 : 0;
      item.allocatedNet += netShare;
      if (item.lastClosedDay === null || record.closedDay > item.lastClosedDay) {
        item.lastClosedDay = record.closedDay;
        item.lastTitle = record.title;
      }
    }
  }

  return Object.fromEntries(routes.map((route) => {
    const item = working.get(route.id)!;
    const trips = Math.max(0, Math.round(routeIntel[route.id]?.trips ?? 0));
    const allocatedNet = Math.round(item.allocatedNet);
    const averageAllocatedNet = item.ledgerTrips ? Math.round(item.allocatedNet / item.ledgerTrips) : 0;
    const tone = toneFor(trips, item.ledgerTrips, allocatedNet);
    const summary = item.ledgerTrips
      ? `近账 ${item.ledgerTrips} 趟经过，分摊净银 ${allocatedNet >= 0 ? "+" : ""}${allocatedNet} 两，照约 ${item.deliveredTrips}/${item.ledgerTrips}。`
      : trips > 0
        ? `本号已经走过 ${trips} 趟，尚无完成结算的账页可分摊盈亏。`
        : "本号尚未亲走；完成途经此路的镖程后，账房会把实际净银分摊到路簿。";
    return [route.id, {
      routeId: route.id,
      trips,
      ledgerTrips: item.ledgerTrips,
      deliveredTrips: item.deliveredTrips,
      allocatedNet,
      averageAllocatedNet,
      lastClosedDay: item.lastClosedDay,
      lastTitle: item.lastTitle,
      tone,
      seal: sealFor(tone),
      masteryLabel: masteryLabel(trips),
      summary,
    } satisfies RouteBusinessInsight];
  }));
}
