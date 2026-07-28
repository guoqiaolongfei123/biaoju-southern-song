import { describe, expect, it } from "vitest";
import { cityActionPriority } from "../src/core/cityDashboard";
import { createInitialGame } from "../src/core/game";

describe("city action priority", () => {
  it("prioritizes persistent injuries before routine supplies", () => {
    const game = createInitialGame(1208, "linan-guild");
    game.convoy.leaderHp = 42;
    game.convoy.horseStamina = 12;
    expect(cityActionPriority(game)).toMatchObject({ tab: "prepare", seal: "医", tone: "danger" });
  });

  it("calls out low horse stamina with its exact value", () => {
    const game = createInitialGame(1208, "linan-guild");
    game.convoy.horseStamina = 18;
    const priority = cityActionPriority(game);
    expect(priority).toMatchObject({ tab: "prepare", seal: "马", tone: "danger" });
    expect(priority.detail).toContain("18/100");
  });

  it("moves low supplies ahead of vehicle maintenance", () => {
    const game = createInitialGame(1208, "linan-guild");
    game.supplies = 2;
    game.convoy.cartHp = 32;
    expect(cityActionPriority(game)).toMatchObject({ tab: "prepare", seal: "粮" });
  });

  it("routes an understaffed company to the crew chapter", () => {
    const game = createInitialGame(1208, "linan-guild");
    game.crew = game.crew.slice(0, 2);
    expect(cityActionPriority(game)).toMatchObject({ tab: "crew", seal: "人" });
  });

  it("routes a fit convoy to the contract board", () => {
    const game = createInitialGame(1208, "linan-guild");
    const priority = cityActionPriority(game);
    expect(priority).toMatchObject({ tab: "contracts", seal: "镖", tone: "steady" });
    expect(priority.detail).toContain(`${game.contracts.length} 份委托`);
  });
});
