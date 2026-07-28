import { describe, expect, it } from "vitest";
import { createInitialGame, createWorldActorEvent, generateRoutePlans, acceptContract, chooseRoute, currentRouteDanger, resolveEvent } from "../src/core/game";
import { frontlineSituation } from "../src/core/frontlineContent";
import { advanceWorldActors, createInitialWorldActors, normalizeWorldActors, worldActorEffectLabel } from "../src/core/worldActorContent";
import type { GameState, WorldActor } from "../src/core/types";

function travelingGame(): GameState {
  let game = createInitialGame(1208);
  game = acceptContract(game, game.contracts[0].id);
  return chooseRoute(game, generateRoutePlans(game.journey!.contract.from, game.journey!.contract.to, game)[0]);
}

describe("天下行营与前线军势", () => {
  it("开局行营位于真实道路，旧存档会补入缺失的宋金两军", () => {
    const actors = createInitialWorldActors();
    const armies = actors.filter((actor) => actor.kind === "army");
    expect(armies.map((actor) => actor.id)).toEqual(["song-jinghu-relief", "jin-southern-camp"]);
    expect(armies.map((actor) => actor.routeId)).toEqual(["xiangyang-ezhou", "kaifeng-xiangyang"]);

    const legacyActors = actors.filter((actor) => actor.kind !== "army");
    const normalized = normalizeWorldActors(legacyActors);
    expect(normalized.filter((actor) => actor.kind === "army")).toHaveLength(2);
    expect(normalized.slice(0, legacyActors.length)).toEqual(legacyActors);
  });

  it("军队抵达敌城后会沿原路折返，不会随机穿入敌国腹地", () => {
    const game = createInitialGame(1208);
    const source = game.worldActors.find((actor) => actor.id === "jin-southern-camp")!;
    const army: WorldActor = { ...source, progress: .99 };
    const first = advanceWorldActors([army], 1, 9081, game.cities);
    const second = advanceWorldActors([army], 1, 9081, game.cities);
    expect(first).toEqual(second);
    expect(first.actors[0]).toMatchObject({ routeId: "kaifeng-xiangyang", fromCityId: "xiangyang", toCityId: "kaifeng" });
    expect(first.actors[0].progress).toBeGreaterThan(0);
  });

  it("敌军趋城增加兵压，援军趋城增加守势，并写入可读军情", () => {
    const game = createInitialGame(1208);
    const jinArmy = game.worldActors.find((actor) => actor.id === "jin-southern-camp")!;
    const songArmy = game.worldActors.find((actor) => actor.id === "song-jinghu-relief")!;
    const empty = frontlineSituation(game.cities, "xiangyang", game.day, []);
    const attacked = frontlineSituation(game.cities, "xiangyang", game.day, [jinArmy]);
    const reinforced = frontlineSituation(game.cities, "xiangyang", game.day, [jinArmy, songArmy]);
    expect(attacked.pressure).toBeGreaterThan(empty.pressure);
    expect(reinforced.defense).toBeGreaterThan(attacked.defense);
    expect(reinforced.attackingArmies.map((actor) => actor.id)).toEqual([jinArmy.id]);
    expect(reinforced.reliefArmies.map((actor) => actor.id)).toEqual([songArmy.id]);
    expect(reinforced.detail).toContain(jinArmy.name);
    expect(reinforced.detail).toContain(songArmy.name);
  });

  it("行营对同路风险的影响强于普通巡骑", () => {
    const game = createInitialGame(1208);
    const routeId = "linan-jiankang";
    const hostile = { ...game.worldActors.find((actor) => actor.id === "jin-southern-camp")!, routeId, fromCityId: "linan", toCityId: "jiankang", progress: .5 };
    const empty = { ...game, worldActors: [] };
    const withArmy = { ...game, worldActors: [hostile] };
    expect(currentRouteDanger(withArmy, routeId)).toBe(currentRouteDanger(empty, routeId) + 18);
    expect(worldActorEffectLabel(hostile, -1)).toContain("敌军压境");
  });

  it("敌军行营提供受验、绕营和突围，友军行营可开军前便牒", () => {
    const game = travelingGame();
    const routeId = game.journey!.plan.routeIds[0];
    const hostile = { ...game.worldActors.find((actor) => actor.id === "jin-southern-camp")!, routeId };
    const hostileEvent = createWorldActorEvent(game, routeId, hostile);
    expect(hostileEvent.choices.map((item) => item.id)).toEqual(["army-comply", "army-detour", "fight"]);
    const paid = resolveEvent({ ...game, phase: "event", currentEvent: hostileEvent, worldActors: [hostile] }, "army-comply");
    expect(paid.silver).toBe(game.silver - 18);
    expect(paid.relations.jin).toBe(game.relations.jin + 1);

    const ally = { ...game.worldActors.find((actor) => actor.id === "song-jinghu-relief")!, routeId };
    const allyEvent = createWorldActorEvent(game, routeId, ally);
    expect(allyEvent.choices.map((item) => item.id)).toEqual(["army-banner", "traveler-pass"]);
    const escorted = resolveEvent({ ...game, phase: "event", currentEvent: allyEvent, worldActors: [ally] }, "army-banner");
    expect(escorted.travelPermits.song).toBeGreaterThanOrEqual(game.day + 4);
    expect(escorted.relations.song).toBe(game.relations.song + 2);
    expect(escorted.convoy.morale).toBe(game.convoy.morale + 6);
  });
});
