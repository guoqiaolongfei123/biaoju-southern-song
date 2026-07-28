import { CITIES, cityById } from "./data";
import type { ContactFavorTier, Contract, ContractPatron, LocalContact, OriginId, Settlement } from "./types";

export const MAX_CONTACT_FAVOR = 60;

export interface ContactFavorTierDefinition {
  tier: ContactFavorTier;
  label: string;
  seal: string;
  description: string;
  nextAt: number | null;
}

export interface ContactPatronProfile {
  label: string;
  seal: string;
  actionSeal: string;
  actionLabel: string;
  actionDescription: string;
  cost: number;
}

const FAVOR_TIERS: readonly ContactFavorTierDefinition[] = [
  { tier: "acquainted", label: "初识", seal: "识", description: "记得你的旗号，尚不足以开口托事。", nextAt: 10 },
  { tier: "familiar", label: "熟面", seal: "熟", description: "往来已有凭信，可以支用一份人情。", nextAt: 25 },
  { tier: "trusted", label: "相托", seal: "托", description: "数次交割有信，愿为你动用本地门路。", nextAt: 45 },
  { tier: "sworn", label: "深交", seal: "契", description: "患难与共，已是风云行的长久臂助。", nextAt: null },
];

export const CONTACT_PATRON_PROFILES: Record<ContractPatron, ContactPatronProfile> = {
  merchant: { label: "商帮", seal: "商", actionSeal: "粮", actionLabel: "赊调行粮", actionDescription: "从本地行栈赊调 5 份补给。", cost: 8 },
  official: { label: "官府", seal: "牒", actionSeal: "引", actionLabel: "代验关牒", actionDescription: "将本地掌权势力的路引续期 5 日。", cost: 10 },
  jianghu: { label: "江湖", seal: "义", actionSeal: "哨", actionLabel: "托哨探路", actionDescription: "核实本城全部出城道路的路险与路况。", cost: 8 },
  temple: { label: "寺观", seal: "舍", actionSeal: "歇", actionLabel: "借院调息", actionDescription: "为总镖头与在册同伴恢复气血，并提振士气。", cost: 8 },
  foreign: { label: "异邦", seal: "舶", actionSeal: "帖", actionLabel: "借商队名帖", actionDescription: "补入 3 份行粮，并将本地路引续期 3 日。", cost: 9 },
};

const STARTER_CONTACTS: Record<OriginId, Omit<LocalContact, "id">> = {
  "linan-guild": {
    name: "临安沈氏行栈", patron: "merchant", homeCityId: "linan", favor: 14,
    completedJobs: 0, failedJobs: 0, lastDay: 1, lastCalledDay: -99, lastNote: "承牌开门时替风云行作了第一份保。",
  },
  "xiangyang-veterans": {
    name: "京湖制置司故吏", patron: "official", homeCityId: "xiangyang", favor: 14,
    completedJobs: 0, failedJobs: 0, lastDay: 1, lastCalledDay: -99, lastNote: "解甲旧部仍认得总镖头当年的军牌。",
  },
  "quanzhou-merchants": {
    name: "四海茶行", patron: "merchant", homeCityId: "quanzhou", favor: 14,
    completedJobs: 0, failedJobs: 0, lastDay: 1, lastCalledDay: -99, lastNote: "蕃舶合股之时留下了一纸同行荐书。",
  },
};

const PATRONS = new Set<ContractPatron>(["merchant", "official", "jianghu", "temple", "foreign"]);
const CITY_IDS = new Set(CITIES.map((city) => city.id));

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(min, Math.min(max, Math.round(value)))
    : fallback;
}

export function contactId(homeCityId: string, patron: ContractPatron, name: string): string {
  return `${homeCityId}:${patron}:${name}`;
}

export function contactFavorTier(favor: number): ContactFavorTierDefinition {
  const value = Math.max(0, Math.min(MAX_CONTACT_FAVOR, favor));
  if (value >= 45) return FAVOR_TIERS[3];
  if (value >= 25) return FAVOR_TIERS[2];
  if (value >= 10) return FAVOR_TIERS[1];
  return FAVOR_TIERS[0];
}

export function contactPatronProfile(patron: ContractPatron): ContactPatronProfile {
  return CONTACT_PATRON_PROFILES[patron];
}

export function createInitialContacts(originId: OriginId): LocalContact[] {
  const starter = STARTER_CONTACTS[originId];
  return [{ ...starter, id: contactId(starter.homeCityId, starter.patron, starter.name) }];
}

export function normalizeContacts(value: unknown, originId: OriginId): LocalContact[] {
  if (!Array.isArray(value)) return createInitialContacts(originId);
  const normalized = new Map<string, LocalContact>();
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const raw = entry as Partial<LocalContact>;
    if (typeof raw.name !== "string" || !raw.name.trim()) continue;
    if (typeof raw.homeCityId !== "string" || !CITY_IDS.has(raw.homeCityId)) continue;
    if (typeof raw.patron !== "string" || !PATRONS.has(raw.patron as ContractPatron)) continue;
    const patron = raw.patron as ContractPatron;
    const name = raw.name.trim().slice(0, 32);
    const id = contactId(raw.homeCityId, patron, name);
    normalized.set(id, {
      id,
      name,
      patron,
      homeCityId: raw.homeCityId,
      favor: clampInteger(raw.favor, 0, MAX_CONTACT_FAVOR, 0),
      completedJobs: clampInteger(raw.completedJobs, 0, 999, 0),
      failedJobs: clampInteger(raw.failedJobs, 0, 999, 0),
      lastDay: clampInteger(raw.lastDay, 0, 99999, 1),
      lastCalledDay: clampInteger(raw.lastCalledDay, -99, 99999, -99),
      lastNote: typeof raw.lastNote === "string" ? raw.lastNote.slice(0, 100) : "旧档中留下的一笔往来。",
    });
  }
  return [...normalized.values()];
}

export interface ContactSettlementResult {
  contacts: LocalContact[];
  contact: LocalContact;
  favorDelta: number;
  previousTier: ContactFavorTierDefinition;
  nextTier: ContactFavorTierDefinition;
}

export function settleContractContact(
  contacts: readonly LocalContact[],
  contract: Contract,
  grade: Settlement["grade"],
  day: number,
): ContactSettlementResult {
  const id = contactId(contract.from, contract.patron, contract.client);
  const existing = contacts.find((contact) => contact.id === id);
  const previousFavor = existing?.favor ?? 0;
  const intendedDelta = grade === "甲" ? 12 : grade === "乙" ? 7 : grade === "丙" ? 2 : -8;
  const nextFavor = Math.max(0, Math.min(MAX_CONTACT_FAVOR, previousFavor + intendedDelta));
  const favorDelta = nextFavor - previousFavor;
  const destinationName = cityById(contract.to).name;
  const contact: LocalContact = {
    id,
    name: contract.client,
    patron: contract.patron,
    homeCityId: contract.from,
    favor: nextFavor,
    completedJobs: (existing?.completedJobs ?? 0) + (grade === "失镖" ? 0 : 1),
    failedJobs: (existing?.failedJobs ?? 0) + (grade === "失镖" ? 1 : 0),
    lastDay: day,
    lastCalledDay: existing?.lastCalledDay ?? -99,
    lastNote: `第 ${day} 日向${destinationName}交出${grade}等镖。`,
  };
  return {
    contacts: existing
      ? contacts.map((item) => item.id === id ? contact : item)
      : [...contacts, contact],
    contact,
    favorDelta,
    previousTier: contactFavorTier(previousFavor),
    nextTier: contactFavorTier(nextFavor),
  };
}
