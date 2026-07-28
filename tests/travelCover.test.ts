import { describe, expect, it } from "vitest";
import { ROUTES } from "../src/core/data";
import {
  advanceTravel,
  borderCoverForecast,
  chooseRoute,
  createInitialGame,
  departureReadinessForPlan,
  resolveEvent,
  setTravelCover,
} from "../src/core/game";
import { migrateSavedGame } from "../src/core/save";
import { randomStep } from "../src/core/rng";
import { travelCoverAssessment } from "../src/core/travelCoverContent";
import type { GameState, RoutePlan, TravelCoverId } from "../src/core/types";

function crossBorderPlanningGame(coverId: TravelCoverId = "open-escort") {
  const base = createInitialGame(1107);
  const route = ROUTES.find((candidate) => base.cities[candidate.from].owner !== base.cities[candidate.to].owner)!;
  const from = route.from;
  const to = route.to;
  const plan: RoutePlan = {
    id: `cover-${route.id}`,
    routeIds: [route.id],
    cityIds: [from, to],
    days: route.days,
    danger: route.danger,
    label: "跨境测试路",
    description: "从一面旗号走到另一面旗号。",
  };
  const contract = {
    ...base.contracts[0],
    id: "cover-contract",
    from,
    to,
    kind: "cargo" as const,
    patron: "merchant" as const,
    complication: "contraband" as const,
    secretKnown: true,
    deadline: 99,
  };
  let game: GameState = {
    ...base,
    currentCityId: from,
    selectedCityId: to,
    phase: "planning",
    journey: {
      contract,
      plan,
      segmentIndex: 0,
      startedDay: base.day,
      elapsedDays: 0,
      traveledRouteIds: [],
      crewIds: [...base.activeCrewIds],
      stance: "steady",
      coverId: "open-escort",
      coverBlown: false,
      issuerFaction: base.cities[from].owner,
      expectedDestinationOwner: base.cities[to].owner,
    },
  };
  game = setTravelCover(game, coverId);
  return { game, plan, targetFaction: base.cities[to].owner };
}

function borderEventGame(coverId: TravelCoverId = "merchant-caravan") {
  const setup = crossBorderPlanningGame(coverId);
  let game = chooseRoute(setup.game, setup.plan);
  game = advanceTravel(game);
  expect(game.phase).toBe("event");
  expect(game.currentEvent?.kind).toBe("border");
  return { ...setup, game };
}

function stateForRoll(predicate: (value: number) => boolean) {
  for (let state = -500; state < 500; state += 1) if (predicate(randomStep(state).value)) return state;
  throw new Error("could not find deterministic rng state");
}

describe("cross-border travel covers", () => {
  it("combines contract, crew role, origin and side cargo into a visible fit score", () => {
    const { game, targetFaction } = crossBorderPlanningGame("merchant-caravan");
    const basic = travelCoverAssessment(game, "merchant-caravan", targetFaction);
    const accountantId = game.crew.find((member) => member.role === "账房")!.id;
    const deputyId = game.crew.find((member) => member.role === "副镖头")!.id;
    const withEvidence: GameState = {
      ...game,
      activeCrewIds: [deputyId, accountantId, game.activeCrewIds[1]],
      journey: {
        ...game.journey!,
        crewIds: [deputyId, accountantId, game.activeCrewIds[1]],
        tradeLot: { goodId: "tea", originCityId: game.currentCityId, purchasePrice: 10 },
      },
    };
    const prepared = travelCoverAssessment(withEvidence, "merchant-caravan", targetFaction);
    const wrongCover = travelCoverAssessment(withEvidence, "pilgrim-party", targetFaction);

    expect(prepared.score).toBeGreaterThan(basic.score);
    expect(prepared.inspectionCover).toBeGreaterThan(wrongCover.inspectionCover);
    expect(prepared.strengths.some((note) => note.includes("账房"))).toBe(true);
    expect(prepared.strengths.some((note) => note.includes("副货"))).toBe(true);
  });

  it("charges the preparation cost only when the convoy leaves", () => {
    const { game, plan } = crossBorderPlanningGame("merchant-caravan");
    expect(game.silver).toBe(createInitialGame(1107).silver);
    const traveling = chooseRoute(game, plan);
    expect(traveling.phase).toBe("travel");
    expect(traveling.silver).toBe(game.silver - 8);
    expect(traveling.news[0]).toContain("商旅行票");
  });

  it("adds the prepared identity to route readiness and shows its exact border risk", () => {
    const { game: planning, plan } = crossBorderPlanningGame("merchant-caravan");
    const readiness = departureReadinessForPlan(planning, plan);
    expect([...readiness.strengths, ...readiness.warnings].some((note) => note.includes("商旅行票"))).toBe(true);

    const { game, targetFaction } = borderEventGame("merchant-caravan");
    const forecast = borderCoverForecast(game, targetFaction);
    const coverChoice = game.currentEvent!.choices.find((choice) => choice.id === "cover");
    expect(coverChoice?.label).toContain("商旅行票");
    expect(coverChoice?.hint).toContain(`被识破约 ${Math.round(forecast.exposureRisk * 100)}%`);
  });

  it("lets a sound identity pass, but permanently burns a detected identity and starts combat", () => {
    const successCase = borderEventGame("merchant-caravan");
    const risk = borderCoverForecast(successCase.game, successCase.targetFaction).exposureRisk;
    const successState = stateForRoll((value) => value >= risk);
    const success = resolveEvent({ ...successCase.game, rngState: successState }, "cover");
    expect(success.phase).not.toBe("battle");
    expect(success.news.some((item) => item.includes("借名过关"))).toBe(true);

    const failureCase = borderEventGame("merchant-caravan");
    const failureState = stateForRoll((value) => value < risk);
    const failure = resolveEvent({ ...failureCase.game, rngState: failureState }, "cover");
    expect(failure.phase).toBe("battle");
    expect(failure.journey?.coverBlown).toBe(true);
    expect(failure.news[0]).toContain("假牒败露");
  });

  it("migrates older journeys to an explicit open-escort identity", () => {
    const { game } = crossBorderPlanningGame("merchant-caravan");
    const legacy = structuredClone(game) as unknown as Record<string, unknown>;
    legacy.version = 18;
    const journey = legacy.journey as Record<string, unknown>;
    delete journey.coverId;
    delete journey.coverBlown;
    const migrated = migrateSavedGame(legacy);
    expect(migrated?.journey?.coverId).toBe("open-escort");
    expect(migrated?.journey?.coverBlown).toBe(false);
  });
});
