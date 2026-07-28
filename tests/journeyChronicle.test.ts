import { describe, expect, it } from "vitest";
import { acceptContract, advanceTravel, applyBattleResult, chooseRoute, createInitialGame, generateRoutePlans, resolveEvent } from "../src/core/game";
import { JOURNEY_CHRONICLE_LIMIT, appendJourneyChronicle, normalizeJourneyChronicle } from "../src/core/journeyChronicle";
import { migrateSavedGame } from "../src/core/save";
import type { BattleConfig, BattleResult, JourneyState } from "../src/core/types";

describe("镖行纪", () => {
  it("keeps a bounded, normalized sequence and never overwrites a repeated action", () => {
    const game = createInitialGame(1208);
    const contract = game.contracts[0];
    let journey = acceptContract(game, contract.id).journey!;
    for (let index = 0; index < JOURNEY_CHRONICLE_LIMIT + 4; index += 1) {
      journey = appendJourneyChronicle(journey, {
        id: "same-action",
        day: index + 1,
        kind: "event",
        tone: "ink",
        seal: "记",
        title: `途中第${index + 1}记`,
        detail: "同一处驿亭也可以留下多次真实处置。",
      });
    }
    const entries = normalizeJourneyChronicle(journey.chronicle);
    expect(entries).toHaveLength(JOURNEY_CHRONICLE_LIMIT);
    expect(new Set(entries.map((entry) => entry.id)).size).toBe(JOURNEY_CHRONICLE_LIMIT);
    expect(entries.at(-1)?.title).toBe(`途中第${JOURNEY_CHRONICLE_LIMIT + 4}记`);
  });

  it("records contract, departure, road and event decisions in the playable travel flow", () => {
    let game = createInitialGame(1208);
    const contract = game.contracts[0];
    game = acceptContract(game, contract.id);
    expect(game.journey?.chronicle?.map((entry) => entry.kind)).toEqual(["contract"]);

    const plan = generateRoutePlans(contract.from, contract.to, game)[0];
    game = chooseRoute(game, plan);
    expect(game.journey?.chronicle?.some((entry) => entry.kind === "departure" && entry.title.includes(plan.label))).toBe(true);

    game = advanceTravel(game);
    expect(game.journey?.chronicle?.some((entry) => entry.kind === "road" && entry.routeId === plan.routeIds[0])).toBe(true);
    const decision = game.currentEvent?.choices.find((choice) => !choice.disabled && choice.id !== "fight");
    expect(decision).toBeTruthy();
    game = resolveEvent(game, decision!.id);
    expect(game.journey?.chronicle?.some((entry) => entry.kind === "event" && entry.title === decision!.label)).toBe(true);
  });

  it("records actual battle losses and the final delivery grade", () => {
    let game = createInitialGame(1208);
    const contract = game.contracts[0];
    game = acceptContract(game, contract.id);
    const plan = generateRoutePlans(contract.from, contract.to, game)[0];
    game = chooseRoute(game, plan);
    const battle: BattleConfig = {
      id: "chronicle-battle",
      seed: game.seed,
      terrain: "official",
      danger: 42,
      objective: "护车通路",
      enemyFaction: "剪径客",
      routeName: "行在江淮驿路",
      guards: [],
    };
    const result: BattleResult = {
      outcome: "complete",
      elapsedHours: 3,
      leaderDamage: 4,
      guardLoss: 0,
      cartDamage: 3,
      cargoLoss: 2,
      sealBroken: false,
      guardDamage: {},
    };
    game = applyBattleResult({ ...game, phase: "battle", pendingBattle: battle }, result);
    const entries = normalizeJourneyChronicle(game.journey?.chronicle);
    expect(entries.find((entry) => entry.kind === "battle")).toMatchObject({ seal: "胜", tone: "risk" });
    expect(entries.find((entry) => entry.kind === "battle")?.detail).toContain("车况");
    if (game.phase === "settlement") expect(entries.at(-1)).toMatchObject({ kind: "arrival", cityId: contract.to });
  });

  it("hydrates an in-progress legacy journey with a visible continuation note", () => {
    const initial = createInitialGame(1208);
    const planning = acceptContract(initial, initial.contracts[0].id);
    const legacyJourney = { ...planning.journey } as JourneyState;
    delete legacyJourney.chronicle;
    const migrated = migrateSavedGame({ ...planning, journey: legacyJourney });
    expect(migrated?.journey?.chronicle).toHaveLength(1);
    expect(migrated?.journey?.chronicle?.[0]).toMatchObject({ seal: "续", kind: "contract" });
  });
});
