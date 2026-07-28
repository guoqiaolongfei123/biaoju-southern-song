import type { BusinessRecord, RouteDefinition, RouteIntelState, RoutePlan } from "./types";

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

export type RoutePlanBusinessTone = "new" | "known" | "profit" | "even" | "loss" | "mixed";

/**
 * A route-choice level reading of the road ledger. `apportionedNet` is only a
 * historical reference: it adds the per-segment averages that are actually
 * present in the last twelve completed trip records and never fills missing
 * segments with invented income.
 */
export interface RoutePlanBusinessInsight {
  segmentCount: number;
  familiarSegments: number;
  ledgerSegments: number;
  profitableSegments: number;
  evenSegments: number;
  lossSegments: number;
  apportionedNet: number;
  tone: RoutePlanBusinessTone;
  seal: string;
  label: string;
  coverageLabel: string;
  summary: string;
  latestTitle: string | null;
  latestClosedDay: number | null;
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
    const averageAllocatedNet = item.ledgerTrips ? item.allocatedNet / item.ledgerTrips : 0;
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

function planTone(
  familiarSegments: number,
  ledgerSegments: number,
  profitableSegments: number,
  lossSegments: number,
  apportionedNet: number,
): RoutePlanBusinessTone {
  if (familiarSegments === 0) return "new";
  if (ledgerSegments === 0) return "known";
  if (profitableSegments > 0 && lossSegments > 0) return "mixed";
  if (apportionedNet > 2) return "profit";
  if (apportionedNet < -2) return "loss";
  return "even";
}

function planSeal(tone: RoutePlanBusinessTone): string {
  if (tone === "profit") return "盈";
  if (tone === "loss") return "亏";
  if (tone === "even") return "平";
  if (tone === "mixed") return "参";
  if (tone === "known") return "熟";
  return "新";
}

/**
 * Condense the per-road business ledger into an honest comparison slip for a
 * candidate route. Missing pages stay visibly missing, so a profitable road
 * fragment is never presented as a guaranteed whole-trip result.
 */
export function routePlanBusinessInsight(
  plan: Pick<RoutePlan, "routeIds">,
  routeInsights: Record<string, RouteBusinessInsight>,
): RoutePlanBusinessInsight {
  const routeIds = [...new Set(plan.routeIds)];
  const insights = routeIds.flatMap((routeId) => routeInsights[routeId] ? [routeInsights[routeId]] : []);
  const segmentCount = routeIds.length;
  const familiarSegments = insights.filter((insight) => insight.trips > 0 || insight.ledgerTrips > 0).length;
  const ledger = insights.filter((insight) => insight.ledgerTrips > 0);
  const ledgerSegments = ledger.length;
  const profitableSegments = ledger.filter((insight) => insight.tone === "profit").length;
  const evenSegments = ledger.filter((insight) => insight.tone === "even").length;
  const lossSegments = ledger.filter((insight) => insight.tone === "loss").length;
  const apportionedNet = Math.round(ledger.reduce((sum, insight) => sum + insight.averageAllocatedNet, 0));
  const tone = planTone(familiarSegments, ledgerSegments, profitableSegments, lossSegments, apportionedNet);
  const latest = ledger.reduce<RouteBusinessInsight | null>((result, insight) => (
    insight.lastClosedDay !== null && (result?.lastClosedDay === null || result?.lastClosedDay === undefined || insight.lastClosedDay > result.lastClosedDay)
      ? insight
      : result
  ), null);
  const coverageLabel = ledgerSegments === 0
    ? familiarSegments > 0 ? `熟路 ${familiarSegments}/${segmentCount}` : "全程新路"
    : ledgerSegments === segmentCount ? `全程有账 ${ledgerSegments}/${segmentCount}` : `部分有账 ${ledgerSegments}/${segmentCount}`;
  const label = tone === "new"
    ? "新路无旧账"
    : tone === "known"
      ? "熟路尚待收卷"
      : tone === "mixed"
        ? "旧账有盈有亏"
        : tone === "profit"
          ? ledgerSegments === segmentCount ? "全程旧账偏盈" : "部分旧账偏盈"
          : tone === "loss"
            ? ledgerSegments === segmentCount ? "全程旧账偏亏" : "部分旧账偏亏"
            : "旧账收支相抵";
  const summary = tone === "new"
    ? "本号尚未亲走这条行程；时日、路险与天候判断仍可用，但没有旧账可替你担保。"
    : tone === "known"
      ? `本号走过 ${familiarSegments}/${segmentCount} 段，但尚无完成镖程的账页可核对盈亏。`
      : `最近十二趟账页覆盖 ${ledgerSegments}/${segmentCount} 段；已入账路段按各自历史均账合计 ${apportionedNet >= 0 ? "+" : ""}${apportionedNet} 两。`;

  return {
    segmentCount,
    familiarSegments,
    ledgerSegments,
    profitableSegments,
    evenSegments,
    lossSegments,
    apportionedNet,
    tone,
    seal: planSeal(tone),
    label,
    coverageLabel,
    summary,
    latestTitle: latest?.lastTitle ?? null,
    latestClosedDay: latest?.lastClosedDay ?? null,
  };
}
