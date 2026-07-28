import { describe, expect, it } from "vitest";
import {
  acceptContract,
  createInitialGame,
  departureReadinessForPlan,
  generateRoutePlans,
  routePlanTravelForecast,
  setTravelStance,
  toggleJourneyCrew,
} from "../src/core/game";

function openingPlanningGame() {
  return acceptContract(createInitialGame(1107), "opening-xiangyang");
}

describe("departure readiness", () => {
  it("turns hidden route arithmetic into explicit deadline, supply and horse balances", () => {
    const base = openingPlanningGame();
    const game = { ...base, supplies: 1, convoy: { ...base.convoy, horseStamina: 1 } };
    const plan = generateRoutePlans("linan", "xiangyang", game)[0];
    const travel = routePlanTravelForecast(game, plan);
    const result = departureReadinessForPlan(game, plan);

    expect(result.deadlineMargin).toBe(game.journey!.contract.deadline - travel.days);
    expect(result.supplyBalance).toBe(game.supplies - travel.supplyCost);
    expect(result.staminaBalance).toBe(game.convoy.horseStamina - travel.staminaCost);
    expect(result.warnings).toContain(`途中至少需补 ${travel.supplyCost - game.supplies} 份粮`);
    expect(result.warnings).toContain(`马力缺口 ${travel.staminaCost - game.convoy.horseStamina}，须在中继歇马`);
    expect(result.combatReady).toBe(true);
  });

  it("recognizes a genuinely provisioned route as ready", () => {
    const base = openingPlanningGame();
    const game = {
      ...base,
      supplies: 99,
      convoy: { ...base.convoy, horseStamina: 999 },
      journey: { ...base.journey!, contract: { ...base.journey!.contract, deadline: 99 } },
    };
    const plan = generateRoutePlans("linan", "xiangyang", game)[0];
    const result = departureReadinessForPlan(game, plan);

    expect(result.tone).toBe("ready");
    expect(result.label).toContain("粮马齐备");
    expect(result.warnings).toEqual([]);
  });

  it("warns when the player removes the deputy from the three-person escort", () => {
    let game = openingPlanningGame();
    game = toggleJourneyCrew(game, "lu-cang");
    game = toggleJourneyCrew(game, "shen-yan");
    const plan = generateRoutePlans("linan", "xiangyang", game)[0];
    const result = departureReadinessForPlan(game, plan);

    expect(result.selectedCrewCount).toBe(3);
    expect(result.combatReady).toBe(false);
    expect(result.warnings).toContain("未带副镖头，主副合击与截锋无法发动");
  });

  it("recalculates the verdict when the player changes travel stance", () => {
    const steady = openingPlanningGame();
    const haste = setTravelStance(steady, "haste");
    const steadyPlan = generateRoutePlans("linan", "xiangyang", steady)[0];
    const hastePlan = generateRoutePlans("linan", "xiangyang", haste)[0];

    const steadyResult = departureReadinessForPlan(steady, steadyPlan);
    const hasteResult = departureReadinessForPlan(haste, hastePlan);
    expect(hasteResult.deadlineMargin).toBeGreaterThanOrEqual(steadyResult.deadlineMargin);
    expect(hasteResult.staminaBalance).toBeLessThan(steadyResult.staminaBalance);
  });
});
