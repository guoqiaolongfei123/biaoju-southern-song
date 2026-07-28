import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import SettlementFinanceLedger from "../src/components/SettlementFinanceLedger";
import type { Settlement } from "../src/core/types";

describe("收队卷实际收支界面", () => {
  it("不隐藏途中盘缠、脚钱、副货、赔付和净收支", () => {
    const settlement: Settlement = {
      grade: "丙",
      title: "残镖抵城",
      summary: "测试",
      reward: 73,
      compensation: 10,
      reputationChange: -2,
      notes: [],
      finance: { openingSilver: 120, enRouteCashChange: -28, grossReward: 100, crewWages: 27, contractReward: 73, tradeRevenue: 40, compensation: 10, closingSilver: 195, netChange: 75 },
    };
    const html = renderToStaticMarkup(<SettlementFinanceLedger settlement={settlement} />);
    expect(html).toContain("本趟收支簿");
    expect(html).toContain("核定镖酬");
    expect(html).toContain("途中盘缠");
    expect(html).toContain("随行脚钱");
    expect(html).toContain("副货回银");
    expect(html).toContain("失约赔付");
    expect(html).toContain("净增");
    expect(html).toContain("收队现银");
  });

  it("旧结算没有账簿时保持安静兼容", () => {
    const settlement: Settlement = { grade: "甲", title: "镖到货安", summary: "旧档", reward: 80, compensation: 0, reputationChange: 6, notes: [] };
    expect(renderToStaticMarkup(<SettlementFinanceLedger settlement={settlement} />)).toBe("");
  });
});
