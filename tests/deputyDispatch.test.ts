import { describe, expect, it } from "vitest";
import {
  acceptContract,
  crewIsOnDeputyDispatch,
  createInitialGame,
  deputyDispatchBoard,
  equipCrewItem,
  generateRoutePlans,
  investigateRoute,
  purchaseService,
  recruitCrew,
  routePlanInsight,
  startDeputyDispatch,
  trainCrew,
} from "../src/core/game";
import { migrateSavedGame } from "../src/core/save";
import type { EquipmentId, GameState } from "../src/core/types";

function gameWithSixCrew(seed = 1107): GameState {
  let game = { ...createInitialGame(seed, "linan-guild"), silver: 1_000 };
  const candidate = game.recruitPool[0];
  if (!candidate) throw new Error("测试开局应有一名本地可招人手");
  game = recruitCrew(game, candidate.id);
  expect(game.crew).toHaveLength(6);
  return game;
}

function advanceOneDayByScouting(game: GameState): GameState {
  const contract = game.contracts[0];
  if (!contract) throw new Error("测试开局应有可接委托");
  const planning = acceptContract(game, contract.id);
  const plan = generateRoutePlans(contract.from, contract.to, planning).find((candidate) => !routePlanInsight(planning, candidate).fullySurveyed);
  if (!plan) throw new Error("测试委托应有尚未查明的长路");
  const advanced = investigateRoute(planning, plan, "scout");
  expect(advanced.day).toBe(game.day + 1);
  return advanced;
}

describe("副镖头分队短镖", () => {
  it("只有总号或分号且留足主队三人时开放，并预先列明队伍、风险、收益和归期", () => {
    const shortRoster = createInitialGame(1107, "linan-guild");
    expect(deputyDispatchBoard(shortRoster)).toMatchObject({ available: false });

    const game = gameWithSixCrew();
    const board = deputyDispatchBoard(game);
    expect(board.available).toBe(true);
    expect(board.offers.length).toBeGreaterThan(0);
    expect(board.offers.length).toBeLessThanOrEqual(3);
    for (const offer of board.offers) {
      expect(offer.crewIds).toHaveLength(3);
      expect(new Set(offer.crewIds).size).toBe(3);
      expect(game.crew.find((member) => member.id === offer.crewIds[0])?.role).toBe("副镖头");
      expect(offer.days).toBeGreaterThanOrEqual(3);
      expect(offer.successChance).toBeGreaterThanOrEqual(38);
      expect(offer.successReward).toBeGreaterThan(0);
      expect(offer.wageCost).toBeGreaterThan(0);
    }
  });

  it("落副旗后固定三人和结算骰，移出主队且不能重复派遣或在城内养成换装", () => {
    const game = gameWithSixCrew();
    const offer = deputyDispatchBoard(game).offers[0];
    const started = startDeputyDispatch(game, offer.routeId);
    const dispatch = started.deputyDispatches[0];
    expect(dispatch).toMatchObject({ routeId: offer.routeId, crewIds: offer.crewIds, successChance: offer.successChance });
    expect(dispatch.resolutionRoll).toBeGreaterThanOrEqual(0);
    expect(dispatch.resolutionRoll).toBeLessThanOrEqual(1);
    expect(started.activeCrewIds.every((id) => !dispatch.crewIds.includes(id))).toBe(true);
    expect(deputyDispatchBoard(started).reason).toContain("已有一支副队");
    expect(startDeputyDispatch(started, offer.routeId)).toEqual(started);

    const awayId = dispatch.crewIds[0];
    expect(crewIsOnDeputyDispatch(started, awayId)).toBe(true);
    expect(trainCrew(started, awayId)).toEqual(started);
    const stockItem = Object.entries(started.equipmentStock).find(([, count]) => count > 0)?.[0] as EquipmentId | undefined;
    if (stockItem) expect(equipCrewItem(started, awayId, stockItem)).toEqual(started);

    const hurtAway = { ...started, crew: started.crew.map((member) => dispatch.crewIds.includes(member.id) ? { ...member, hp: Math.max(1, member.hp - 30) } : member) };
    const treated = purchaseService(hurtAway, "heal");
    for (const id of dispatch.crewIds) expect(treated.crew.find((member) => member.id === id)?.hp).toBe(hurtAway.crew.find((member) => member.id === id)?.hp);
  });

  it("到期后按预存结果归报，增加银钱、阅历、目的地口碑和真实路线情报", () => {
    const game = gameWithSixCrew(1208);
    const offer = deputyDispatchBoard(game).offers[0];
    const started = startDeputyDispatch(game, offer.routeId);
    const dispatch = started.deputyDispatches[0];
    const beforeExperience = Object.fromEntries(started.crew.map((member) => [member.id, member.experience]));
    const beforeStanding = started.cityReputation[dispatch.toCityId];
    const due: GameState = {
      ...started,
      deputyDispatches: [{ ...dispatch, returnsDay: started.day + 1, resolutionRoll: 0 }],
    };

    const settled = advanceOneDayByScouting(due);
    expect(settled.deputyDispatches).toHaveLength(0);
    expect(settled.deputyDispatchReports[0]).toMatchObject({ id: dispatch.id, outcome: "success", routeId: dispatch.routeId });
    expect(settled.deputyDispatchReports[0].silverChange).toBe(dispatch.successReward);
    expect(settled.cityReputation[dispatch.toCityId]).toBe(beforeStanding + 3);
    expect(settled.routeIntel[dispatch.routeId].trips).toBeGreaterThan(started.routeIntel[dispatch.routeId]?.trips ?? 0);
    for (const id of dispatch.crewIds) expect(settled.crew.find((member) => member.id === id)!.experience).toBeGreaterThan(beforeExperience[id]);
    expect(settled.news.some((item) => item.includes("副旗归报"))).toBe(true);
  });

  it("v24旧档补空分队字段，v25存档保留有效分队并排除重复上阵", () => {
    const base = gameWithSixCrew(1209);
    const oldSave = { ...base, version: 24, deputyDispatches: undefined, deputyDispatchReports: undefined };
    const migratedOld = migrateSavedGame(oldSave);
    expect(migratedOld?.version).toBe(25);
    expect(migratedOld?.deputyDispatches).toEqual([]);
    expect(migratedOld?.deputyDispatchReports).toEqual([]);

    const offer = deputyDispatchBoard(base).offers[0];
    const started = startDeputyDispatch(base, offer.routeId);
    const migrated = migrateSavedGame({ ...started, activeCrewIds: [...started.deputyDispatches[0].crewIds] });
    expect(migrated?.deputyDispatches).toEqual(started.deputyDispatches);
    expect(migrated?.activeCrewIds).toEqual([]);
  });
});
