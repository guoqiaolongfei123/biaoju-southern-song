import { describe, expect, it } from "vitest";
import { contractBoardAssessment, rankContractsForBoard } from "../src/core/contractBoard";
import { createInitialGame } from "../src/core/game";

describe("接镖前成行估算", () => {
  it("用当前车马、路报与天气给出可读的完整预估", () => {
    const game = createInitialGame(1107);
    const contract = game.contracts[0];
    const assessment = contractBoardAssessment(game, contract);

    expect(assessment.plan).not.toBeNull();
    expect(assessment.days).toBeGreaterThan(0);
    expect(assessment.supplyCost).toBeGreaterThan(0);
    expect(assessment.deadlineMargin).toBe(contract.deadline - assessment.days);
    expect(assessment.weatherSummary.length).toBeGreaterThan(0);
    expect(["今报", "旧报", "传闻"]).toContain(assessment.intelLabel);
  });

  it("不会把明显缺粮、缺马且误限的镖单说成从容", () => {
    const base = createInitialGame(1107);
    const contract = { ...base.contracts[0], id: "impossible", deadline: 1 };
    const game = { ...base, supplies: 0, convoy: { ...base.convoy, horseStamina: 4 } };
    const assessment = contractBoardAssessment(game, contract);

    expect(assessment.tone).toBe("danger");
    expect(assessment.deadlineMargin).toBeLessThan(0);
    expect(assessment.supplyBalance).toBeLessThan(0);
    expect(assessment.staminaBalance).toBeLessThan(0);
  });

  it("镖榜排序优先保留真正能成行的委托，而非只看高额酬金", () => {
    const base = createInitialGame(1107);
    const supplied = { ...base, supplies: 120, convoy: { ...base.convoy, horseStamina: 240 } };
    const source = base.contracts[0];
    const safe = { ...source, id: "safe", reward: 120, deadline: 30 };
    const impossible = { ...source, id: "impossible", reward: 900, deadline: 1 };
    const ranked = rankContractsForBoard(supplied, [impossible, safe]);

    expect(ranked[0].contractId).toBe("safe");
    expect(ranked[0].tone).not.toBe("danger");
    expect(ranked[1].tone).toBe("danger");
  });
});
