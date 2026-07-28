import type { BusinessRecord, JourneyState, Settlement, SettlementFinance } from "./types";

export const BUSINESS_LEDGER_LIMIT = 12;

const OUTCOMES = new Set<NonNullable<Settlement["outcome"]>>(["delivery", "transfer", "return", "abandon"]);
const GRADES = new Set<Settlement["grade"]>(["甲", "乙", "丙", "转", "退", "失镖"]);
const CONTRACT_KINDS = new Set<BusinessRecord["contractKind"]>(["cargo", "letter", "escort", "special"]);

function unsigned(value: unknown): number {
  return Math.max(0, Math.round(typeof value === "number" && Number.isFinite(value) ? value : 0));
}

function signed(value: unknown): number {
  return Math.round(typeof value === "number" && Number.isFinite(value) ? value : 0);
}

function normalizeFinance(value: unknown): SettlementFinance | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Partial<Record<keyof SettlementFinance, unknown>>;
  const openingSilver = unsigned(source.openingSilver);
  const closingSilver = unsigned(source.closingSilver);
  return {
    openingSilver,
    enRouteCashChange: signed(source.enRouteCashChange),
    grossReward: unsigned(source.grossReward),
    crewWages: unsigned(source.crewWages),
    contractReward: unsigned(source.contractReward),
    tradeRevenue: unsigned(source.tradeRevenue),
    compensation: unsigned(source.compensation),
    closingSilver,
    netChange: closingSilver - openingSilver,
  };
}

export function createBusinessRecord(journey: JourneyState, settlement: Settlement, closedDay: number, cargoIntegrity: number, sealIntact: boolean): BusinessRecord | null {
  if (!settlement.finance) return null;
  const close = Math.max(journey.startedDay, Math.round(closedDay));
  return {
    id: `${journey.contract.id}-${close}-${settlement.outcome ?? "delivery"}`,
    contractId: journey.contract.id,
    title: journey.contract.title,
    contractKind: journey.contract.kind,
    fromCityId: journey.contract.from,
    toCityId: journey.contract.to,
    startedDay: journey.startedDay,
    closedDay: close,
    durationDays: Math.max(1, close - journey.startedDay),
    routeIds: [...journey.traveledRouteIds],
    grade: settlement.grade,
    outcome: settlement.outcome ?? "delivery",
    cargoIntegrity: Math.max(0, Math.min(100, Math.round(cargoIntegrity))),
    sealIntact,
    battlesWon: Math.max(0, Math.round(journey.battleVictories ?? 0)),
    finance: { ...settlement.finance },
  };
}

export function appendBusinessRecord(records: BusinessRecord[] | undefined, record: BusinessRecord | null): BusinessRecord[] {
  if (!record) return records ?? [];
  return [record, ...(records ?? []).filter((item) => item.id !== record.id)].slice(0, BUSINESS_LEDGER_LIMIT);
}

export function normalizeBusinessLedger(value: unknown, validCityIds: Set<string>, validRouteIds: Set<string>): BusinessRecord[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): BusinessRecord[] => {
    if (!item || typeof item !== "object") return [];
    const source = item as Record<string, unknown>;
    const finance = normalizeFinance(source.finance);
    if (!finance || typeof source.id !== "string" || typeof source.contractId !== "string" || typeof source.title !== "string") return [];
    if (typeof source.fromCityId !== "string" || typeof source.toCityId !== "string" || !validCityIds.has(source.fromCityId) || !validCityIds.has(source.toCityId)) return [];
    if (typeof source.contractKind !== "string" || !CONTRACT_KINDS.has(source.contractKind as BusinessRecord["contractKind"])) return [];
    if (typeof source.grade !== "string" || !GRADES.has(source.grade as Settlement["grade"])) return [];
    if (typeof source.outcome !== "string" || !OUTCOMES.has(source.outcome as NonNullable<Settlement["outcome"]>)) return [];
    const startedDay = Math.max(1, unsigned(source.startedDay));
    const closedDay = Math.max(startedDay, unsigned(source.closedDay));
    return [{
      id: source.id,
      contractId: source.contractId,
      title: source.title,
      contractKind: source.contractKind as BusinessRecord["contractKind"],
      fromCityId: source.fromCityId,
      toCityId: source.toCityId,
      startedDay,
      closedDay,
      durationDays: Math.max(1, unsigned(source.durationDays) || closedDay - startedDay),
      routeIds: Array.isArray(source.routeIds) ? source.routeIds.filter((id): id is string => typeof id === "string" && validRouteIds.has(id)) : [],
      grade: source.grade as Settlement["grade"],
      outcome: source.outcome as NonNullable<Settlement["outcome"]>,
      cargoIntegrity: Math.min(100, unsigned(source.cargoIntegrity)),
      sealIntact: source.sealIntact === true,
      battlesWon: unsigned(source.battlesWon),
      finance,
    }];
  }).slice(0, BUSINESS_LEDGER_LIMIT);
}

export interface BusinessLedgerSummary {
  completed: number;
  delivered: number;
  profitable: number;
  totalNet: number;
  averageNet: number;
  totalDays: number;
  bestRecord: BusinessRecord | null;
}

export function businessLedgerSummary(records: BusinessRecord[] | undefined): BusinessLedgerSummary {
  const entries = records ?? [];
  const totalNet = entries.reduce((sum, record) => sum + record.finance.netChange, 0);
  return {
    completed: entries.length,
    delivered: entries.filter((record) => record.outcome === "delivery").length,
    profitable: entries.filter((record) => record.finance.netChange > 0).length,
    totalNet,
    averageNet: entries.length ? Math.round(totalNet / entries.length) : 0,
    totalDays: entries.reduce((sum, record) => sum + record.durationDays, 0),
    bestRecord: entries.reduce<BusinessRecord | null>((best, record) => !best || record.finance.netChange > best.finance.netChange ? record : best, null),
  };
}
