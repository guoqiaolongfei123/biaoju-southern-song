import { describe, expect, it } from "vitest";
import { createInitialGame, createWorldActorEvent, resolveEvent } from "../src/core/game";
import { routeById } from "../src/core/data";
import { migrateSavedGame } from "../src/core/save";
import {
  advanceRivalBureaus,
  createInitialRivalBureaus,
  rivalBureauViews,
  rivalRank,
  rivalRelation,
} from "../src/core/rivalContent";
import { advanceWorldActors, createInitialWorldActors } from "../src/core/worldActorContent";
import type { GameState } from "../src/core/types";

describe("天下同行镖局", () => {
  it("三家同行都有真实地图行旅、独立专长和可成长名帖", () => {
    const game = createInitialGame(7319);
    expect(game.rivalBureaus).toHaveLength(3);
    expect(new Set(game.rivalBureaus.map((bureau) => bureau.actorId)).size).toBe(3);
    for (const bureau of game.rivalBureaus) {
      const actor = game.worldActors.find((item) => item.id === bureau.actorId);
      expect(actor?.kind).toBe("rival");
      expect(actor && routeById(actor.routeId)).toBeTruthy();
      expect(bureau.specialty.length).toBeGreaterThan(4);
      expect(bureau.lastReportDay).toBe(1);
    }
  });

  it("同行只有沿真实道路抵站后才结算成镖或失期", () => {
    const actor = createInitialWorldActors().find((item) => item.id === "shunfeng-escort")!;
    const poised = { ...actor, progress: .99 };
    const travel = advanceWorldActors([poised], 1, 9081);
    expect(travel.arrivals).toEqual(expect.arrayContaining([
      expect.objectContaining({ actorId: actor.id, cityId: actor.toCityId, routeId: actor.routeId }),
    ]));

    const before = createInitialRivalBureaus();
    const result = advanceRivalBureaus(before, travel.arrivals, 6);
    const oldBureau = before.find((item) => item.actorId === actor.id)!;
    const bureau = result.bureaus.find((item) => item.actorId === actor.id)!;
    expect((bureau.completedContracts - oldBureau.completedContracts) + (bureau.setbacks - oldBureau.setbacks)).toBeGreaterThanOrEqual(1);
    expect(bureau.lastReportDay).toBe(6);
    expect(bureau.lastReport).toMatch(/护送.+(交割|误了交割)/);

    const idle = advanceRivalBureaus(before, [], 6);
    expect(idle.bureaus).toEqual(before);
  });

  it("合旗与争先会把选择永久写回同行关系", () => {
    const base = createInitialGame(7713);
    const actor = base.worldActors.find((item) => item.id === "shunfeng-escort")!;
    const route = routeById(actor.routeId);
    const contract = { ...base.contracts[0], from: actor.fromCityId, to: actor.toCityId, deadline: 20 };
    const journey: NonNullable<GameState["journey"]> = {
      contract,
      plan: { id: route.id, routeIds: [route.id], cityIds: [actor.fromCityId, actor.toCityId], days: route.days, danger: route.danger, label: route.name, description: route.note },
      segmentIndex: 0,
      startedDay: base.day,
      elapsedDays: 0,
      traveledRouteIds: [],
      crewIds: base.activeCrewIds,
      stance: "steady",
    };
    const event = createWorldActorEvent({ ...base, journey }, route.id, actor);
    const staged: GameState = { ...base, currentCityId: actor.fromCityId, selectedCityId: actor.fromCityId, phase: "event", journey, currentEvent: event };
    const oldRelation = staged.rivalBureaus.find((item) => item.actorId === actor.id)!.relation;

    const teamed = resolveEvent(staged, "rival-team");
    expect(teamed.rivalBureaus.find((item) => item.actorId === actor.id)!.relation).toBe(oldRelation + 8);
    expect(teamed.news.some((item) => item.includes("同行关系 +8"))).toBe(true);

    const raced = resolveEvent(staged, "rival-race");
    expect(raced.rivalBureaus.find((item) => item.actorId === actor.id)!.relation).toBe(oldRelation - 6);
    expect(raced.convoy.horseStamina).toBe(staged.convoy.horseStamina - 14);
  });

  it("行榜按名望排序并公开路线进度、关系和预计到站日", () => {
    const game = createInitialGame(8127);
    const views = rivalBureauViews(game);
    expect(views.map((item) => item.bureau.reputation)).toEqual([...views.map((item) => item.bureau.reputation)].sort((a, b) => b - a));
    expect(views.every((item) => item.pathLabel.includes("→") && item.progress > 0 && item.etaDays > 0)).toBe(true);
    expect(rivalRank(72).label).toBe("一方雄行");
    expect(rivalRelation(-25).label).toBe("争道旧怨");
    expect(rivalRelation(30).label).toBe("可托后背");
  });

  it("旧存档会补齐同行名帖和缺失的同行地图旗号", () => {
    const current = createInitialGame(9017);
    const old = structuredClone(current) as unknown as Record<string, unknown>;
    old.version = 20;
    delete old.rivalBureaus;
    old.worldActors = current.worldActors.filter((actor) => actor.kind !== "rival");
    const migrated = migrateSavedGame(old)!;
    expect(migrated.version).toBe(23);
    expect(migrated.rivalBureaus).toHaveLength(3);
    expect(migrated.worldActors.filter((actor) => actor.kind === "rival")).toHaveLength(3);
  });
});
