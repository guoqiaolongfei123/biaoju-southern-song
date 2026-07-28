import { describe, expect, it } from "vitest";
import {
  acceptContract,
  chooseRoute,
  continueAfterSettlement,
  createInitialGame,
  generateRoutePlans,
  journeyDispositionOptions,
  purchaseTradeLot,
  resolveJourneyDisposition,
} from "../src/core/game";
import { cityById, routeById } from "../src/core/data";
import type { GameState, TravelEvent } from "../src/core/types";

function stagedStopover(withTrade = false): GameState {
  let game = createInitialGame(1107);
  game = acceptContract(game, "opening-xiangyang");
  if (withTrade) game = purchaseTradeLot(game);
  game = chooseRoute(game, generateRoutePlans("linan", "xiangyang", game)[0]);
  const journey = game.journey!;
  expect(journey.plan.routeIds.length).toBeGreaterThan(1);
  const firstRoute = routeById(journey.plan.routeIds[0]);
  const segmentIndex = 1;
  const cityId = journey.plan.cityIds[segmentIndex];
  const event: TravelEvent = {
    id: "waystation-disposition-test",
    kind: "waystation",
    eyebrow: "测试驿亭",
    title: `${cityById(cityId).name}城外议约`,
    description: "重看余程。",
    choices: [],
  };
  return {
    ...game,
    day: game.day + firstRoute.days,
    phase: "event",
    journey: {
      ...journey,
      segmentIndex,
      elapsedDays: firstRoute.days,
      traveledRouteIds: [firstRoute.id],
    },
    currentEvent: event,
  };
}

describe("驿亭收旗议约", () => {
  it("只在已抵达的驿亭公开三种中止方案，并把代价写成精确预报", () => {
    const stopover = stagedStopover();
    const options = journeyDispositionOptions(stopover);
    expect(options.map((option) => option.id)).toEqual(["transfer", "return", "abandon"]);
    expect(options.every((option) => option.compensation > 0 && option.reputationChange < 0)).toBe(true);
    expect(options.find((option) => option.id === "return")).toMatchObject({
      destinationCityId: stopover.journey!.contract.from,
      available: true,
    });
    expect(options.find((option) => option.id === "return")!.delayDays).toBeGreaterThan(0);
    expect(options.find((option) => option.id === "transfer")!.rivalName).toBeTruthy();
    expect(options.find((option) => option.id === "transfer")!.delayDays).toBeGreaterThan(0);
    expect(journeyDispositionOptions({ ...stopover, phase: "travel", currentEvent: null })).toEqual([]);
  });

  it("转托同行不冒充成镖，并永久改善接旗同行的关系", () => {
    const stopover = { ...stagedStopover(), silver: 300 };
    const option = journeyDispositionOptions(stopover).find((item) => item.id === "transfer")!;
    const oldRival = stopover.rivalBureaus.find((bureau) => bureau.id === option.rivalId)!;
    const settled = resolveJourneyDisposition(stopover, "transfer");
    const newRival = settled.rivalBureaus.find((bureau) => bureau.id === option.rivalId)!;
    expect(settled.phase).toBe("settlement");
    expect(settled.settlement).toMatchObject({ outcome: "transfer", grade: "转", reward: 0, compensation: option.compensation });
    expect(settled.settlement?.finance).toMatchObject({
      openingSilver: stopover.journey!.openingSilver,
      contractReward: 0,
      tradeRevenue: option.tradeRevenue,
      compensation: option.compensation,
      closingSilver: settled.silver,
      netChange: settled.silver - stopover.journey!.openingSilver!,
    });
    expect(settled.businessLedger[0]).toMatchObject({
      contractId: stopover.journey!.contract.id,
      outcome: "transfer",
      grade: "转",
      finance: settled.settlement?.finance,
    });
    expect(settled.completedContracts).toBe(stopover.completedContracts);
    expect(settled.silver).toBe(stopover.silver + option.tradeRevenue - option.compensation);
    expect(settled.day).toBe(stopover.day + option.delayDays);
    expect(settled.reputation).toBe(stopover.reputation - 2);
    expect(settled.jianghuReputation).toBe(stopover.jianghuReputation + 1);
    expect(newRival.relation).toBe(oldRival.relation + 7);
    expect(newRival.lastReport).toContain(stopover.journey!.contract.cargo);

    const continued = continueAfterSettlement(settled);
    expect(continued.phase).toBe("map");
    expect(continued.journey).toBeNull();
    expect(continued.currentCityId).toBe(option.destinationCityId);
  });

  it("退回原城会真实推进天下、消耗回程粮草并承担部分违约", () => {
    const stopover = { ...stagedStopover(), silver: 300, supplies: 24 };
    const option = journeyDispositionOptions(stopover).find((item) => item.id === "return")!;
    const issuer = stopover.journey!.issuerFaction!;
    const settled = resolveJourneyDisposition(stopover, "return");
    expect(settled.day).toBe(stopover.day + option.delayDays);
    expect(settled.supplies).toBe(stopover.supplies - option.supplyCost);
    expect(settled.currentCityId).toBe(stopover.journey!.contract.from);
    expect(settled.settlement).toMatchObject({ outcome: "return", grade: "退", compensation: option.compensation });
    expect(settled.relations[issuer]).toBe(stopover.relations[issuer] - 1);
    expect(settled.completedContracts).toBe(stopover.completedContracts);
  });

  it("弃镖立即落脚但清空主镖状态，并施加最重的信用与江湖代价", () => {
    const stopover = { ...stagedStopover(), silver: 300 };
    const option = journeyDispositionOptions(stopover).find((item) => item.id === "abandon")!;
    const localCityId = stopover.journey!.plan.cityIds[stopover.journey!.segmentIndex];
    const settled = resolveJourneyDisposition(stopover, "abandon");
    expect(settled.day).toBe(stopover.day);
    expect(settled.currentCityId).toBe(localCityId);
    expect(settled.convoy.cargoIntegrity).toBe(0);
    expect(settled.convoy.sealIntact).toBe(false);
    expect(settled.reputation).toBe(stopover.reputation + option.reputationChange);
    expect(settled.jianghuReputation).toBe(stopover.jianghuReputation + option.jianghuReputationChange);
    expect(settled.settlement?.outcome).toBe("abandon");
    expect(settled.completedContracts).toBe(stopover.completedContracts);
  });

  it("中途收队会按落脚城行情结清随车副货，不会让已买货物凭空消失", () => {
    const stopover = { ...stagedStopover(true), silver: 300 };
    expect(stopover.journey?.tradeLot).toBeTruthy();
    const option = journeyDispositionOptions(stopover).find((item) => item.id === "abandon")!;
    expect(option.tradeRevenue).toBeGreaterThan(0);
    const settled = resolveJourneyDisposition(stopover, "abandon");
    expect(settled.silver).toBe(stopover.silver + option.tradeRevenue - option.compensation);
    expect(settled.settlement?.tradeRevenue).toBe(option.tradeRevenue);
    expect(settled.settlement?.notes.some((note) => note.includes("随车副货"))).toBe(true);
  });

  it("同行不肯接旗或接手费不足时不能绕过预报强行转托", () => {
    const hostile: GameState = {
      ...stagedStopover(),
      silver: 0,
      rivalBureaus: stagedStopover().rivalBureaus.map((bureau) => ({ ...bureau, relation: -30 })),
    };
    const option = journeyDispositionOptions(hostile).find((item) => item.id === "transfer")!;
    expect(option.available).toBe(false);
    expect(option.unavailableReason).toContain("同行");
    expect(resolveJourneyDisposition(hostile, "transfer")).toBe(hostile);
  });
});
