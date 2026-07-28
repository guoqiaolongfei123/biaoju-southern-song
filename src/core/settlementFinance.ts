import type { SettlementFinance } from "./types";

export interface SettlementFinanceInput {
  openingSilver: number;
  currentSilver: number;
  grossReward: number;
  crewWages: number;
  tradeRevenue?: number;
  compensation?: number;
}

function wholeSilver(value: number): number {
  return Math.max(0, Math.round(Number.isFinite(value) ? value : 0));
}

/** Build a cash ledger from actual game balances instead of estimated costs. */
export function calculateSettlementFinance(input: SettlementFinanceInput): SettlementFinance {
  const openingSilver = wholeSilver(input.openingSilver);
  const currentSilver = wholeSilver(input.currentSilver);
  const grossReward = wholeSilver(input.grossReward);
  const crewWages = Math.min(grossReward, wholeSilver(input.crewWages));
  const contractReward = Math.max(0, grossReward - crewWages);
  const tradeRevenue = wholeSilver(input.tradeRevenue ?? 0);
  const compensation = wholeSilver(input.compensation ?? 0);
  const closingSilver = Math.max(0, currentSilver + contractReward + tradeRevenue - compensation);
  return {
    openingSilver,
    enRouteCashChange: currentSilver - openingSilver,
    grossReward,
    crewWages,
    contractReward,
    tradeRevenue,
    compensation,
    closingSilver,
    netChange: closingSilver - openingSilver,
  };
}
