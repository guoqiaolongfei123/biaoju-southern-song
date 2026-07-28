import { describe, expect, it } from "vitest";
import { applyBattleResult, banditTollCost, createInitialGame, createTravelEvent, crewBattleGuards, currentRouteDanger, resolveEvent } from "../src/core/game";
import { routeById } from "../src/core/data";
import { migrateSavedGame } from "../src/core/save";
import { normalizeRouteInfluence, roadInfluenceSnapshot, roadPowerForRoute, updateRouteInfluence } from "../src/core/roadPowerContent";
import type { GameState } from "../src/core/types";

const ROUTE_ID = "linan-jiankang";
const SECOND_ROUTE_ID = "jiankang-pingjiang";

function roadJourney(phase: "event" | "battle", pressure = 58): GameState {
  const base = createInitialGame(1107);
  const route = routeById(ROUTE_ID);
  const secondRoute = routeById(SECOND_ROUTE_ID);
  const contract = { ...base.contracts[0], from: route.from, to: secondRoute.to, deadline: 20 };
  const journey = {
    contract,
    plan: { id: "road-influence-test", routeIds: [route.id, secondRoute.id], cityIds: [route.from, route.to, secondRoute.to], days: route.days + secondRoute.days, danger: Math.round((route.danger + secondRoute.danger) / 2), label: "试路", description: "验证驿路旧账" },
    segmentIndex: 0,
    startedDay: base.day,
    elapsedDays: 0,
    traveledRouteIds: [],
    crewIds: [...base.activeCrewIds],
    stance: "steady" as const,
  };
  const routeStates = {
    ...base.routeStates,
    [route.id]: { ...base.routeStates[route.id], condition: "banditry" as const, banditPressure: pressure, clearsDay: base.day + 6 },
  };
  if (phase === "event") return {
    ...base,
    phase,
    currentCityId: route.from,
    selectedCityId: route.to,
    silver: 300,
    journey,
    routeStates,
    currentEvent: {
      id: "road-toll-test",
      kind: "bandits",
      eyebrow: "山寨拦路",
      title: "留下买路银",
      description: "测试寨契",
      choices: [{ id: "toll", label: "付银", hint: "立契" }],
    },
  };
  return {
    ...base,
    phase,
    currentCityId: route.from,
    selectedCityId: route.to,
    journey,
    routeStates,
    currentEvent: null,
    pendingBattle: {
      id: "road-battle-test",
      seed: 7,
      terrain: route.terrain,
      danger: route.danger,
      objective: "护车清路",
      enemyFaction: roadPowerForRoute(route.id).name,
      enemyLeaderName: "寨主",
      routeName: route.name,
      roadPowerRouteId: route.id,
      guards: crewBattleGuards(base.crew, base.activeCrewIds, base.crewEquipment),
    },
  };
}

describe("道路匪势与寨契", () => {
  it("为真实路线稳定分配地方势力，并把匪势转成可解释的路险", () => {
    const base = createInitialGame(1107);
    const power = roadPowerForRoute(ROUTE_ID);
    expect(power.name).toBe("天目青竹社");
    expect(roadPowerForRoute(ROUTE_ID)).toEqual(power);
    const watched = roadInfluenceSnapshot(ROUTE_ID, { ...base.routeStates[ROUTE_ID], banditPressure: 58 }, base.day);
    const pact = roadInfluenceSnapshot(ROUTE_ID, { ...base.routeStates[ROUTE_ID], banditPressure: 58, passageUntilDay: base.day + 7 }, base.day);
    const suppressed = roadInfluenceSnapshot(ROUTE_ID, { ...base.routeStates[ROUTE_ID], banditPressure: 58, suppressedUntilDay: base.day + 6 }, base.day);
    expect(watched).toMatchObject({ label: "暗哨盯路", tone: "watched", dangerModifier: 5 });
    expect(pact).toMatchObject({ label: "寨契通行", tone: "pact", dangerModifier: -12 });
    expect(suppressed).toMatchObject({ label: "余众蛰伏", tone: "suppressed", dangerModifier: -18 });
  });

  it("付买路银会留下七日寨契，降低匪势与该路实际危险", () => {
    const before = roadJourney("event");
    const cost = banditTollCost(before);
    const dangerBefore = currentRouteDanger(before, ROUTE_ID);
    const after = resolveEvent(before, "toll");
    const influence = roadInfluenceSnapshot(ROUTE_ID, after.routeStates[ROUTE_ID], after.day);
    expect(after.silver).toBe(before.silver - cost);
    expect(influence).toMatchObject({ passageActive: true, lastOutcome: "toll" });
    expect(influence.passageUntilDay).toBe(before.day + 7);
    expect(influence.pressure).toBe(54);
    expect(currentRouteDanger(after, ROUTE_ID)).toBeLessThan(dangerBefore);
    expect(after.news.some((item) => item.includes("寨契落印") && item.includes("天目青竹社"))).toBe(true);
  });

  it("重走持契道路时会生成免银放行事件，并允许续契", () => {
    const base = roadJourney("event");
    const protectedRoad = {
      ...base,
      phase: "travel" as const,
      currentEvent: null,
      routeStates: {
        ...base.routeStates,
        [ROUTE_ID]: updateRouteInfluence(ROUTE_ID, base.routeStates[ROUTE_ID], base.day, {
          pressureDelta: -4,
          passageUntilDay: base.day + 7,
          outcome: "toll",
        }),
      },
    };
    const generated = Array.from({ length: 80 }, (_, index) => createTravelEvent({ ...protectedRoad, rngState: index + 1 }, ROUTE_ID).event)
      .find((event) => event.choices.some((choice) => choice.id === "road-pass"));
    expect(generated).toBeDefined();
    expect(generated?.title).toContain("撤开路障");
    expect(generated?.choices.map((choice) => choice.id)).toEqual(["road-pass", "road-strengthen"]);
  });

  it("胜阵会清除匪患并形成肃清期，败退则抬高匪势并废除旧契", () => {
    const victoryBefore = roadJourney("battle", 72);
    const victory = applyBattleResult(victoryBefore, {
      outcome: "complete", elapsedHours: 4, leaderDamage: 3, guardLoss: 0, cartDamage: 1, cargoLoss: 0, sealBroken: false,
      guardDamage: {}, enemyLeaderDefeated: true,
    });
    const cleared = roadInfluenceSnapshot(ROUTE_ID, victory.routeStates[ROUTE_ID], victory.day);
    expect(victory.routeStates[ROUTE_ID].condition).toBe("clear");
    expect(cleared).toMatchObject({ suppressedActive: true, lastOutcome: "victory", pressure: 48 });
    expect(cleared.suppressedUntilDay).toBe(victoryBefore.day + 12);
    expect(victory.news.some((item) => item.includes("驿路余波") && item.includes("肃清"))).toBe(true);

    const defeatBefore = roadJourney("battle", 58);
    defeatBefore.routeStates[ROUTE_ID] = updateRouteInfluence(ROUTE_ID, defeatBefore.routeStates[ROUTE_ID], defeatBefore.day, {
      passageUntilDay: defeatBefore.day + 5,
      outcome: "toll",
    });
    const defeat = applyBattleResult(defeatBefore, {
      outcome: "defeat", elapsedHours: 4, leaderDamage: 8, guardLoss: 0, cartDamage: 5, cargoLoss: 3, sealBroken: false,
      guardDamage: {},
    });
    const emboldened = roadInfluenceSnapshot(ROUTE_ID, defeat.routeStates[ROUTE_ID], defeat.day);
    expect(emboldened).toMatchObject({ passageActive: false, suppressedActive: false, lastOutcome: "defeat", pressure: 73 });
  });

  it("旧存档会补齐全部路线的匪势与期限字段", () => {
    const current = createInitialGame(1107);
    const legacyRouteStates = Object.fromEntries(Object.entries(current.routeStates).map(([routeId, state]) => {
      const { banditPressure: _pressure, passageUntilDay: _passage, suppressedUntilDay: _suppressed, lastBanditOutcome: _outcome, lastBanditDay: _day, ...legacy } = state;
      return [routeId, legacy];
    }));
    const migrated = migrateSavedGame({ ...current, routeStates: legacyRouteStates })!;
    const influence = normalizeRouteInfluence(ROUTE_ID, migrated.routeStates[ROUTE_ID]);
    expect(influence.pressure).toBeGreaterThan(0);
    expect(influence).toMatchObject({ passageUntilDay: 0, suppressedUntilDay: 0, lastOutcome: null, lastDay: 0 });
  });
});
