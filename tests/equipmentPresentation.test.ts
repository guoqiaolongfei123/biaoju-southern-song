import { describe, expect, it } from "vitest";
import { battleGearBadges, battleGearRespondsToStrategy, battleGearSupportsAction } from "../src/battle/equipmentPresentation";

describe("battle equipment presentation", () => {
  it("keeps the equipped item's own seal while ordering the most tactical gear first", () => {
    const badges = battleGearBadges(["medicine-kit", "rattan-shield", "arm-crossbow"]);
    expect(badges.map((badge) => [badge.seal, badge.name])).toEqual([
      ["弩", "踏张弩"],
      ["牌", "浸油藤牌"],
    ]);
  });

  it("deduplicates gear that serves the same battlefield role", () => {
    const badges = battleGearBadges(["arm-crossbow", "watch-crossbow", "wheel-hook"], 3);
    expect(badges.map((badge) => badge.trait)).toEqual(["crossbow", "wheel-hook"]);
  });

  it("highlights gear when its automatic support action is executing", () => {
    const [crossbow] = battleGearBadges(["watch-crossbow"]);
    expect(battleGearSupportsAction(crossbow, "crossbow")).toBe(true);
    expect(battleGearSupportsAction(crossbow, "volley")).toBe(true);
    expect(battleGearSupportsAction(crossbow, "medicine")).toBe(false);
    const [shield] = battleGearBadges(["black-lacquer-shield"]);
    expect(battleGearSupportsAction(shield, "core-counter")).toBe(true);
  });

  it("connects player strategy to the equipment that will answer the order", () => {
    const badges = battleGearBadges(["rattan-shield", "wheel-hook", "horse-tackle"], 3);
    expect(badges.filter((badge) => battleGearRespondsToStrategy(badge, "guard-cart")).map((badge) => badge.trait)).toEqual(["shield", "wheel-hook"]);
    expect(badges.filter((badge) => battleGearRespondsToStrategy(badge, "guard-horses")).map((badge) => badge.trait)).toEqual(["horse-hook"]);
  });

  it("carries refinement grade into the battlefield gear badge", () => {
    const [badge] = battleGearBadges(["watch-crossbow"], 2, { "watch-crossbow": 3 });
    expect(badge).toMatchObject({ name: "神臂样弩〔名匠〕", tuningLevel: 3 });
  });
});
