import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import BusinessLedger from "../src/components/BusinessLedger";
import { createInitialGame } from "../src/core/game";

describe("柜上总账界面", () => {
  it("没有结镖记录时给出明确下一步", () => {
    const html = renderToStaticMarkup(<BusinessLedger game={createInitialGame(1107)} />);
    expect(html).toContain("柜上尚无已结镖程");
    expect(html).toContain("完成第一趟主旗委托后");
  });

  it("直接展示总计、路线、现金变化和货信结果", () => {
    const game = createInitialGame(1107);
    game.businessLedger = [{
      id: "opening-2-delivery", contractId: "opening", title: "账页不能落地", contractKind: "letter",
      fromCityId: "linan", toCityId: "huzhou", startedDay: 1, closedDay: 2, durationDays: 1,
      routeIds: ["huzhou-linan"], grade: "甲", outcome: "delivery", cargoIntegrity: 100, sealIntact: true, battlesWon: 0,
      finance: { openingSilver: 120, enRouteCashChange: -9, grossReward: 132, crewWages: 27, contractReward: 105, tradeRevenue: 0, compensation: 0, closingSilver: 216, netChange: 96 },
    }];
    const html = renderToStaticMarkup(<BusinessLedger game={game} />);
    expect(html).toContain("柜上总账");
    expect(html).toContain("累计净银");
    expect(html).toContain("+96 两");
    expect(html).toContain("临安府");
    expect(html).toContain("湖州");
    expect(html).toContain("武林官道");
    expect(html).toContain("100% · 印全");
  });
});
