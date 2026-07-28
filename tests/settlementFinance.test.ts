import { describe, expect, it } from "vitest";
import { calculateSettlementFinance } from "../src/core/settlementFinance";

describe("镖行实际收支簿", () => {
  it("把途中盘缠、脚钱、副货与赔付还原成最终净收支", () => {
    expect(calculateSettlementFinance({
      openingSilver: 120,
      currentSilver: 92,
      grossReward: 100,
      crewWages: 27,
      tradeRevenue: 40,
      compensation: 10,
    })).toEqual({
      openingSilver: 120,
      enRouteCashChange: -28,
      grossReward: 100,
      crewWages: 27,
      contractReward: 73,
      tradeRevenue: 40,
      compensation: 10,
      closingSilver: 195,
      netChange: 75,
    });
  });

  it("失约赔付不会把现银扣成负数，账面净减与真实余额一致", () => {
    expect(calculateSettlementFinance({
      openingSilver: 38,
      currentSilver: 9,
      grossReward: 0,
      crewWages: 0,
      compensation: 30,
    })).toMatchObject({ closingSilver: 0, netChange: -38, enRouteCashChange: -29 });
  });
});
