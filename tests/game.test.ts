import { describe, expect, it } from "vitest";
import { autoBattleInput, battleAttackIntents, battleCoordinationTuning, battleCoreComboTuning, battleCoreCounterTuning, battleGuardAnchor, battleIntentReadiness, battleLeaderAnchor, battleObjectiveMode, battleProgress, battleRepairAvailable, battleResult, battleThreatNotice, battleTimeRemaining, battleVolleyAvailable, battleVolleyTarget, clientThreatened, createBattleSimulation, enemyAttackWindupDuration, pursuitCarrier, stepBattle, type BattleAttackIntent, type BattleCue, type BattleInput, type BattleSimulation } from "../src/battle/simulation";
import { battleInjuryLabel, battleResultPresentation } from "../src/battle/resultPresentation";
import { battleDoctrineMoment, battleMomentFromCue, battleOrderMoment } from "../src/battle/momentPresentation";
import { battleDoctrine } from "../src/battle/doctrineContent";
import { battleDefeatPose, battleHitPose, shouldReduceBattleMotion } from "../src/battle/animationPresentation";
import { BATTLE_PACE_OPTIONS, battlePaceMultiplier, battlePacingState } from "../src/battle/pacing";
import {
  acceptContract,
  acquireFactionPermit,
  advanceTravel,
  applyBattleResult,
  attendFactionAudience,
  banditTollCost,
  borderPassageCost,
  cancelContractPlanning,
  chooseRoute,
  continueAfterSettlement,
  createInitialGame,
  createWorldActorEvent,
  crewBattleGuards,
  cityAidOffer,
  claimCareerObjective,
  contractInvestigationCost,
  convoyUpgradePurchaseCost,
  currentRouteDanger,
  establishOffice,
  evolveCityConditions,
  evolveRouteConditions,
  factionAudienceOffer,
  factionPermitOffer,
  generateContracts,
  generateRoutePlans,
  hasKnownRoute,
  hasActivePermit,
  horseTeamPurchaseCost,
  investigateRoute,
  investigateContract,
  officeActionOffer,
  purchaseService,
  purchaseTradeLot,
  purchaseConvoyUpgrade,
  purchaseHorseTeam,
  purchaseWagon,
  releaseCaptiveCrew,
  recruitCrew,
  crewTrainingCost,
  crewDisciplineChangeCost,
  equipCrewItem,
  equipmentPurchaseCost,
  equipmentTuningCost,
  equipmentRewardForDelivery,
  purchaseEquipment,
  resolveEvent,
  routeInvestigationCost,
  routePlanInsight,
  routePlanTravelForecast,
  segmentTravelForecast,
  serviceCost,
  setTravelStance,
  setMartialArt,
  setCrewDiscipline,
  stopoverOffer,
  stopoverRouteOptions,
  replanJourneyAtStopover,
  supplyPurchaseAmount,
  supportCurrentCity,
  tradeOffer,
  toggleJourneyCrew,
  trainCrew,
  tuneEquipment,
  unequipCrewItem,
  wagonPurchaseCost,
} from "../src/core/game";
import { CREW_CAPACITY, crewRank, generateRecruitPool } from "../src/core/crewContent";
import { cityStanding, contractCountForCity } from "../src/core/cityContent";
import { factionStanding } from "../src/core/factionContent";
import { careerEnding, careerObjectiveProgress } from "../src/core/careerContent";
import { advanceConduct, conductPrinciples, hasPrinciple, principleRewardMultiplier } from "../src/core/conductContent";
import { CITIES, ROUTES } from "../src/core/data";
import { primaryLandmarkForRoute } from "../src/core/routeLandmarkContent";
import { migrateSavedGame } from "../src/core/save";
import { CITY_GLYPH_SCALE, layoutCityLabels, mapDetailForViewportWidth } from "../src/map/cityLabels";
import { localTradeGood, tradeDemandMultiplier } from "../src/core/tradeContent";
import { DEFAULT_MARTIAL_ART, MARTIAL_ARTS } from "../src/core/martialContent";
import { advanceWorldActors, createInitialWorldActors } from "../src/core/worldActorContent";
import { createLegacyState, recordLegacyEnding } from "../src/core/legacyContent";
import { jianghuRecruitmentCost } from "../src/core/jianghuContent";
import { createCrewInjury, injuryForBattleDamage } from "../src/core/injuryContent";
import { crewMasteryForRole } from "../src/core/crewMasteryContent";
import { captivityReleaseOffer } from "../src/core/captivityContent";
import type { CrewRole, EquipmentId, GameState } from "../src/core/types";

const TEST_GUARDS = [
  { id: "guard-a", name: "甲", role: "副镖头" as const, healthRatio: 1, power: 1.2 },
  { id: "guard-b", name: "乙", role: "趟子手" as const, healthRatio: 1, power: 1 },
  { id: "guard-c", name: "丙", role: "车把式" as const, healthRatio: 1, power: .9 },
];

const IDLE_BATTLE_INPUT: BattleInput = { x: 0, y: 0, attack: false, rally: false, retreat: false };

function resolveEnemyAttackWindow(battle: BattleSimulation, input: BattleInput = IDLE_BATTLE_INPUT): void {
  let intentSeen = battleAttackIntents(battle).length > 0;
  for (let tick = 0; tick < 30; tick += 1) {
    stepBattle(battle, input, .05);
    const intents = battleAttackIntents(battle);
    intentSeen ||= intents.length > 0;
    if (intentSeen && intents.length === 0) return;
  }
}

describe("战斗观阵节奏", () => {
  const cartIntent: BattleAttackIntent = {
    enemyId: "archer-a", enemyType: "archer", targetId: "cart", targetLabel: "镖车", actionLabel: "攒弓欲射",
    fromX: 700, fromY: 240, toX: 280, toY: 270, progress: .2, remaining: .72, tone: "cart",
    recommendedStrategy: "guard-cart", advice: "围车可卸去冲力",
  };

  it("提供审势、常阵和疾战三档观阵速度", () => {
    expect(BATTLE_PACE_OPTIONS.map((option) => [option.id, option.multiplier])).toEqual([
      ["deliberate", .72], ["standard", 1], ["rapid", 1.45],
    ]);
    expect(battlePaceMultiplier("rapid")).toBe(1.45);
  });

  it("车马活镖遭锁定时自动进入半速审势，暂停则完全停阵", () => {
    expect(battlePacingState("rapid", cartIntent, false)).toEqual({ timeScale: .5, dangerFocus: true });
    expect(battlePacingState("standard", cartIntent, true)).toEqual({ timeScale: 0, dangerFocus: false });
  });

  it("普通近身威胁不打断玩家选定的观阵节奏", () => {
    const ordinaryIntent = { ...cartIntent, targetId: "leader", targetLabel: "镖头", recommendedStrategy: "breakthrough" as const };
    expect(battlePacingState("deliberate", ordinaryIntent, false)).toEqual({ timeScale: .72, dangerFocus: false });
  });

  it("专手起势给策略玩家留出明确反应窗口", () => {
    expect(enemyAttackWindupDuration("cutter")).toBeGreaterThanOrEqual(.7);
    expect(enemyAttackWindupDuration("archer")).toBeGreaterThanOrEqual(.9);
    expect(enemyAttackWindupDuration("torch")).toBeGreaterThan(1);
  });
});

function passTravelInterruption(game: GameState): GameState {
  if (game.phase !== "event" || !game.currentEvent) return game;
  const choiceId = game.currentEvent.kind === "waystation"
    ? "stop-press"
    : game.currentEvent.choices.find((item) => !item.disabled)?.id;
  return choiceId ? resolveEvent(game, choiceId) : game;
}

function reachOpeningBorder(investigated = false, loadTrade = false) {
  let game = createInitialGame(1107);
  if (investigated) game = investigateContract(game, "opening-xiangyang", "inquire");
  game = acceptContract(game, "opening-xiangyang");
  if (loadTrade) game = purchaseTradeLot(game);
  game = chooseRoute(game, generateRoutePlans("linan", "xiangyang")[0]);
  for (let index = 0; index < 10 && game.currentEvent?.kind !== "border"; index += 1) {
    if (game.phase === "travel") game = advanceTravel(game);
    if (game.phase === "event" && game.currentEvent?.kind !== "border") game = passTravelInterruption(game);
  }
  return game;
}

function reachOpeningStopover() {
  let game = createInitialGame(1107);
  game = acceptContract(game, "opening-xiangyang");
  game = chooseRoute(game, generateRoutePlans("linan", "xiangyang")[0]);
  game = advanceTravel(game);
  if (game.phase === "event" && game.currentEvent?.kind !== "waystation") {
    const choiceId = game.currentEvent?.choices.find((item) => item.id !== "fight" && !item.disabled)?.id;
    if (choiceId) game = resolveEvent(game, choiceId);
  }
  return game;
}

function reachOpeningHandoff(investigated = true) {
  let game = reachOpeningBorder(investigated);
  game = { ...game, supplies: 12 };
  game = resolveEvent(game, investigated ? "conceal" : "detour");
  return game;
}

describe("镖局核心循环", () => {
  it("南宋天下图包含足够的历史城市和跨区域道路", () => {
    const names = new Set(CITIES.map((city) => city.name));
    expect(CITIES.length).toBeGreaterThanOrEqual(70);
    expect(ROUTES.length).toBeGreaterThanOrEqual(90);
    for (const name of ["临安府", "建康府", "襄阳府", "成都府", "泉州", "广州", "静江府"]) {
      expect(names.has(name)).toBe(true);
    }
  });

  it("相同种子生成可复现的开局", () => {
    expect(createInitialGame(1107)).toEqual(createInitialGame(1107));
  });

  it("天下行旅使用真实道路端点，并能随相同签数确定性行进", () => {
    const actors = createInitialWorldActors();
    expect(actors.length).toBeGreaterThanOrEqual(6);
    for (const actor of actors) {
      const route = ROUTES.find((item) => item.id === actor.routeId);
      expect(route).toBeDefined();
      expect(new Set([route!.from, route!.to])).toEqual(new Set([actor.fromCityId, actor.toCityId]));
      expect(actor.progress).toBeGreaterThanOrEqual(0);
      expect(actor.progress).toBeLessThan(1);
    }
    const first = advanceWorldActors(actors, 4, 9081);
    const second = advanceWorldActors(actors, 4, 9081);
    expect(first).toEqual(second);
    expect(first.actors).not.toEqual(actors);
    expect(first.actors).toHaveLength(actors.length);
  });

  it("商旅会压低沿路风险，敌境巡骑会抬高沿路风险", () => {
    const game = createInitialGame(1107);
    const emptyRoads = { ...game, worldActors: [] };
    expect(currentRouteDanger(game, "linan-jiankang")).toBe(currentRouteDanger(emptyRoads, "linan-jiankang") - 4);
    const hostilePatrol = { ...game.worldActors.find((actor) => actor.id === "jin-outriders")!, routeId: "linan-jiankang", fromCityId: "linan", toCityId: "jiankang", progress: 0.5 };
    const hostileRoad = { ...game, worldActors: [hostilePatrol] };
    expect(currentRouteDanger(hostileRoad, "linan-jiankang")).toBe(currentRouteDanger(emptyRoads, "linan-jiankang") + 9);
  });

  it("旧存档会补上天下行旅，现有行旅位置则会原样保存", () => {
    const current = createInitialGame(1107);
    const withoutActors = { ...current, worldActors: undefined, version: 14 } as unknown as Record<string, unknown>;
    expect(migrateSavedGame(withoutActors)?.worldActors).toEqual(createInitialWorldActors());

    const moved = advanceWorldActors(current.worldActors, 2, current.rngState).actors;
    const hydrated = migrateSavedGame({ ...current, worldActors: moved, version: 15 });
    expect(hydrated?.worldActors).toEqual(moved);
  });

  it("同路商队会生成可交互遭遇，并旗后补粮提振士气且核实两程路报", () => {
    let game = createInitialGame(1107);
    game = acceptContract(game, "opening-xiangyang");
    game = chooseRoute(game, generateRoutePlans("linan", "xiangyang")[0]);
    const actor = game.worldActors.find((item) => item.id === "liangzhe-salt")!;
    const routeId = game.journey!.plan.routeIds[0];
    const event = createWorldActorEvent(game, routeId, actor);
    expect(event.kind).toBe("caravan");
    expect(event.actorId).toBe(actor.id);
    expect(event.choices.map((item) => item.id)).toContain("caravan-join");

    const resolved = resolveEvent({ ...game, phase: "event", currentEvent: event }, "caravan-join");
    expect(resolved.supplies).toBe(game.supplies + 2);
    expect(resolved.convoy.morale).toBe(game.convoy.morale + 5);
    for (const id of game.journey!.plan.routeIds.slice(0, 2)) expect(resolved.routeIntel[id].surveyedDay).toBe(game.day);
  });

  it("敌境巡骑允许付费受验、绕行或直接进入以该巡骑为敌的护车战", () => {
    let game = createInitialGame(1107);
    game = acceptContract(game, "opening-xiangyang");
    game = chooseRoute(game, generateRoutePlans("linan", "xiangyang")[0]);
    const actor = game.worldActors.find((item) => item.id === "jin-outriders")!;
    const routeId = game.journey!.plan.routeIds[0];
    const event = createWorldActorEvent(game, routeId, actor);
    expect(event.choices.map((item) => item.id)).toEqual(["patrol-comply", "patrol-detour", "fight"]);

    const eventGame = { ...game, phase: "event" as const, currentEvent: event };
    const inspected = resolveEvent(eventGame, "patrol-comply");
    expect(inspected.silver).toBe(game.silver - 14);
    expect(inspected.relations.jin).toBe(game.relations.jin + 1);
    expect(inspected.convoy.sealIntact).toBe(true);

    const battle = resolveEvent(eventGame, "fight");
    expect(battle.phase).toBe("battle");
    expect(battle.pendingBattle?.enemyFaction).toBe("大金游骑");
  });

  it("友军巡骑可开三日便牒，同行镖队竞速则以车马损耗换取声名", () => {
    let game = createInitialGame(1107);
    game = acceptContract(game, "opening-xiangyang");
    game = chooseRoute(game, generateRoutePlans("linan", "xiangyang")[0]);
    const routeId = game.journey!.plan.routeIds[0];
    const patrol = game.worldActors.find((item) => item.id === "jinghu-patrol")!;
    const patrolEvent = createWorldActorEvent(game, routeId, patrol);
    const escorted = resolveEvent({ ...game, phase: "event", currentEvent: patrolEvent }, "patrol-banner");
    expect(escorted.travelPermits.song).toBeGreaterThanOrEqual(game.day + 3);
    expect(escorted.convoy.morale).toBe(game.convoy.morale + 4);

    const rival = game.worldActors.find((item) => item.id === "shunfeng-escort")!;
    const rivalEvent = createWorldActorEvent(game, routeId, rival);
    const raced = resolveEvent({ ...game, phase: "event", currentEvent: rivalEvent }, "rival-race");
    expect(raced.reputation).toBe(game.reputation);
    expect(raced.jianghuReputation).toBe(game.jianghuReputation + 2);
    expect(raced.convoy.horseStamina).toBe(game.convoy.horseStamina - 14);
    expect(raced.convoy.cartHp).toBe(game.convoy.cartHp - 4);
  });

  it("地图上的同路行旅会按天下签数实际进入旅途事件池", () => {
    let encounter: GameState | null = null;
    for (let seed = 1; seed <= 80 && !encounter; seed += 1) {
      let game = createInitialGame(seed);
      game = acceptContract(game, "opening-xiangyang");
      game = chooseRoute(game, generateRoutePlans("linan", "xiangyang")[0]);
      game = advanceTravel(game);
      if (game.currentEvent?.kind === "caravan") encounter = game;
    }
    expect(encounter?.currentEvent?.actorId).toBeTruthy();
    expect(encounter?.currentEvent?.title).toContain("两浙盐纲");
  });

  it("行前可切换镖头武学，出城后锁定并写入战斗配置", () => {
    let game = createInitialGame(1107);
    expect(game.martialArtId).toBe(DEFAULT_MARTIAL_ART);
    game = acceptContract(game, "opening-xiangyang");
    game = setMartialArt(game, "severing-sabre");
    expect(game.martialArtId).toBe("severing-sabre");
    game = chooseRoute(game, generateRoutePlans("linan", "xiangyang")[0]);
    expect(setMartialArt(game, "binding-hands")).toBe(game);

    for (let index = 0; index < 10 && game.currentEvent?.kind !== "border"; index += 1) {
      if (game.phase === "travel") game = advanceTravel(game);
      if (game.phase === "event" && game.currentEvent?.kind !== "border") game = passTravelInterruption(game);
    }
    expect(game.currentEvent?.kind).toBe("border");
    game = resolveEvent(game, "fight");
    expect(game.pendingBattle?.martialArtId).toBe("severing-sabre");
  });

  it("旧存档会补上默认武学，并保留合法武学与进行中的战斗配置", () => {
    const current = createInitialGame(1107);
    const withoutMartial = { ...current, martialArtId: undefined, version: 14 } as unknown as Record<string, unknown>;
    expect(migrateSavedGame(withoutMartial)?.martialArtId).toBe(DEFAULT_MARTIAL_ART);

    const withMartial = { ...current, martialArtId: "binding-hands", version: 15 };
    expect(migrateSavedGame(withMartial)?.martialArtId).toBe("binding-hands");
  });

  it("三种出身会在不同总号城市以不同车马、资金和人情开局", () => {
    const linan = createInitialGame(202607, "linan-guild");
    const xiangyang = createInitialGame(202607, "xiangyang-veterans");
    const quanzhou = createInitialGame(202607, "quanzhou-merchants");
    expect([linan.currentCityId, xiangyang.currentCityId, quanzhou.currentCityId]).toEqual(["linan", "xiangyang", "quanzhou"]);
    for (const game of [linan, xiangyang, quanzhou]) {
      expect(game.offices[game.currentCityId].tier).toBe("headquarters");
      expect(game.cityReputation[game.currentCityId]).toBe(18);
      expect(game.contracts.every((contract) => contract.from === game.currentCityId)).toBe(true);
      expect(game.activeCrewIds).toHaveLength(3);
      const localRoutes = ROUTES.filter((route) => route.from === game.currentCityId || route.to === game.currentCityId);
      expect(localRoutes.every((route) => game.routeIntel[route.id].surveyedDay === 1)).toBe(true);
      expect(game.contacts).toHaveLength(1);
      expect(game.contacts[0]).toMatchObject({ homeCityId: game.currentCityId, favor: 14, completedJobs: 0, failedJobs: 0 });
    }
    expect(linan.contracts.some((contract) => contract.id === "opening-xiangyang")).toBe(true);
    expect(xiangyang.contracts.some((contract) => contract.id === "opening-xiangyang")).toBe(false);
    expect(xiangyang.convoy).toMatchObject({ wagonId: "armored-cart", horseTeamId: "mountain-mules", upgrades: ["iron-wheels"] });
    expect(xiangyang.silver).toBeLessThan(linan.silver);
    expect(xiangyang.relations.jin).toBe(-12);
    expect(quanzhou.convoy).toMatchObject({ wagonId: "swift-cart", horseTeamId: "post-pair", upgrades: ["hidden-compartment"] });
    expect(quanzhou.silver).toBeGreaterThan(linan.silver);
    expect(quanzhou.activeCrewIds).toContain("shen-yan");
  });

  it("同出身同签数可复现，不同签数会生成另一套镖榜", () => {
    const first = createInitialGame(81021, "quanzhou-merchants");
    const same = createInitialGame(81021, "quanzhou-merchants");
    const other = createInitialGame(81022, "quanzhou-merchants");
    expect(first).toEqual(same);
    expect(first.contracts.map((contract) => contract.id)).not.toEqual(other.contracts.map((contract) => contract.id));
  });

  it("每张新镖榜同时提供货镖、信镖、活镖与特镖", () => {
    const game = createInitialGame(1107);
    expect(new Set(game.contracts.map((contract) => contract.kind))).toEqual(new Set(["cargo", "letter", "escort", "special"]));
    expect(game.contracts.every((contract) => contract.clue && contract.requirement && contract.failurePenalty > 0)).toBe(true);
  });

  it("可花银访查镖单，也可冒信用风险违约私验", () => {
    let game = createInitialGame(1107);
    const cost = contractInvestigationCost(game);
    game = investigateContract(game, "opening-xiangyang", "inquire");
    expect(game.silver).toBe(120 - cost);
    expect(game.reputation).toBe(28);
    expect(game.contracts.find((contract) => contract.id === "opening-xiangyang")?.secretKnown).toBe(true);

    let privateInspection = createInitialGame(1107);
    const rewardBefore = privateInspection.contracts[0].reward;
    privateInspection = investigateContract(privateInspection, "opening-xiangyang", "inspect");
    expect(privateInspection.reputation).toBe(25);
    expect(privateInspection.contracts[0].reward).toBeLessThan(rewardBefore);
    expect(privateInspection.contracts[0].secretKnown).toBe(true);
  });

  it("为临安至襄阳提供速度与风险不同的路线", () => {
    const plans = generateRoutePlans("linan", "xiangyang");
    expect(plans.length).toBeGreaterThanOrEqual(3);
    expect(new Set(plans.map((plan) => plan.days)).size).toBeGreaterThan(1);
    expect(new Set(plans.map((plan) => plan.danger)).size).toBeGreaterThan(1);
  });

  it("历史产地会提供对应副货，目的地城况会改变需求", () => {
    const base = createInitialGame(1107);
    expect(localTradeGood("linan", base.day, base.seed)?.id).toBe("books");
    expect(["tea", "salt", "spice"]).toContain(localTradeGood("quanzhou", base.day, base.seed)?.id);
    expect(localTradeGood("zaoyang", base.day, base.seed)).toBeNull();
    const stable = { ...base.cities.xiangyang, status: "stable" as const };
    const famine = { ...stable, status: "famine" as const };
    const plague = { ...stable, status: "plague" as const };
    expect(tradeDemandMultiplier("grain", "xiangyang", famine, 8)).toBeGreaterThan(tradeDemandMultiplier("grain", "xiangyang", stable, 8));
    expect(tradeDemandMultiplier("medicine", "xiangyang", plague, 8)).toBeGreaterThan(tradeDemandMultiplier("medicine", "xiangyang", stable, 8));
    expect(tradeDemandMultiplier("silk", "pingjiang", stable, 8)).toBeLessThan(tradeDemandMultiplier("silk", "xiangyang", stable, 8));
  });

  it("行前可用闲银搭载本地副货，放回镖榜会全额退票", () => {
    let game = createInitialGame(1107);
    game = acceptContract(game, "opening-xiangyang");
    const offer = tradeOffer(game)!;
    expect(offer.name).toBe("版刻书画");
    expect(offer.expectedRevenueMin).toBeGreaterThan(offer.purchasePrice);
    const silverBefore = game.silver;
    game = purchaseTradeLot(game);
    expect(game.silver).toBe(silverBefore - offer.purchasePrice);
    expect(game.journey?.tradeLot).toEqual({ goodId: "books", originCityId: "linan", purchasePrice: offer.purchasePrice });
    expect(tradeOffer(game)?.purchased).toBe(true);
    game = cancelContractPlanning(game);
    expect(game.phase).toBe("map");
    expect(game.journey).toBeNull();
    expect(game.silver).toBe(silverBefore);
  });

  it("首趟路上襄阳易主，并把国内押镖变成边境事件", () => {
    const game = reachOpeningBorder();

    expect(game.cities.xiangyang.owner).toBe("jin");
    expect(game.phase).toBe("event");
    expect(game.currentEvent?.kind).toBe("border");
    expect(game.news.some((item) => item.includes("襄阳"))).toBe(true);
  });

  it("提前查明敏感镖物会解锁避检方案，未知底细硬闯关牒可能败露", () => {
    let known = reachOpeningBorder(true);
    expect(known.currentEvent?.choices.some((item) => item.id === "conceal")).toBe(true);
    const dayBefore = known.day;
    const suppliesBefore = known.supplies;
    known = resolveEvent(known, "conceal");
    expect(known.phase).toBe("event");
    expect(known.currentEvent?.kind).toBe("handoff");
    expect(known.day).toBe(dayBefore + 1);
    expect(known.supplies).toBe(Math.max(0, suppliesBefore - 2));
    known = resolveEvent(known, "handoff-original");
    expect(known.phase).toBe("settlement");

    let unknown = reachOpeningBorder(false);
    expect(unknown.currentEvent?.choices.some((item) => item.id === "conceal")).toBe(false);
    unknown = resolveEvent({ ...unknown, rngState: 1 }, "papers");
    expect(unknown.phase).toBe("battle");
  });

  it("信镖失去内页与封记时会失镖并按镖单赔付", () => {
    let game = createInitialGame(1107);
    const route = ROUTES.find((item) => item.from === "linan" || item.to === "linan")!;
    const to = route.from === "linan" ? route.to : route.from;
    game = {
      ...game,
      phase: "travel",
      convoy: { ...game.convoy, cargoIntegrity: 0, sealIntact: false },
      journey: {
        contract: {
          id: "lost-letter",
          from: "linan",
          to,
          title: "失信测试",
          cargo: "一封密札",
          client: "枢密院承旨房",
          reward: 120,
          deadline: 20,
          risk: "棘手",
          sealRequired: true,
          kind: "letter",
          patron: "official",
          inspectionAllowed: false,
          allowedLoss: 0,
          confidentiality: "绝密",
          failurePenalty: 35,
          complication: "military",
          clue: "军中封蜡",
          requirement: "内页与封记不得受损",
          secretKnown: true,
          secret: "换防密令",
          brief: "限期送达",
        },
        plan: { id: "lost-letter-route", routeIds: [route.id], cityIds: ["linan", to], days: route.days, danger: route.danger, label: "直行", description: "测试" },
        segmentIndex: 0,
        startedDay: game.day,
        elapsedDays: 0,
        traveledRouteIds: [],
        crewIds: [...game.activeCrewIds],
        stance: "steady",
      },
    };
    game = advanceTravel(game);
    const safeChoice = game.currentEvent!.choices.find((item) => item.id !== "fight")!;
    game = resolveEvent(game, safeChoice.id);
    expect(game.phase).toBe("settlement");
    expect(game.settlement?.grade).toBe("失镖");
    expect(game.settlement?.compensation).toBe(35);
    expect(game.settlement?.notes.some((note) => note.includes("赔付"))).toBe(true);
  });

  it("非战斗选择完成路段并结算报酬", () => {
    let game = reachOpeningBorder();
    const silverBefore = game.silver;
    const linanStandingBefore = game.cityReputation.linan;
    const xiangyangStandingBefore = game.cityReputation.xiangyang;
    game = resolveEvent(game, "detour");
    expect(game.currentEvent?.kind).toBe("handoff");
    game = resolveEvent(game, "handoff-original");

    expect(game.phase).toBe("settlement");
    expect(game.currentCityId).toBe("xiangyang");
    expect(game.settlement?.reward).toBeGreaterThan(0);
    expect(game.silver).toBeGreaterThan(silverBefore);
    expect(game.cityReputation.linan).toBeGreaterThan(linanStandingBefore);
    expect(game.cityReputation.xiangyang).toBeGreaterThan(xiangyangStandingBefore);
    const openingContact = game.contacts.find((contact) => contact.name === "临安广济堂");
    expect(openingContact).toMatchObject({ homeCityId: "linan", patron: "official", completedJobs: 1, failedJobs: 0 });
    expect(openingContact!.favor).toBeGreaterThan(0);
    expect(game.settlement?.notes.some((note) => note.includes("临安广济堂") && note.includes("人情"))).toBe(true);
    expect(game.conduct.intactSealedDeliveries).toBe(1);
  });

  it("目的地易主会在抵城后要求重新选择交割对象", () => {
    const prepared = reachOpeningHandoff(true);
    expect(prepared.phase).toBe("event");
    expect(prepared.currentEvent?.kind).toBe("handoff");
    expect(prepared.currentEvent?.description).toContain("城头已从宋旗换成金旗");
    expect(prepared.currentEvent?.choices.map((item) => item.id)).toEqual(["handoff-original", "handoff-authority", "handoff-covert"]);

    const unprepared = reachOpeningHandoff(false);
    expect(unprepared.currentEvent?.kind).toBe("handoff");
    expect(unprepared.currentEvent?.choices.some((item) => item.id === "handoff-covert")).toBe(false);
  });

  it("守原约、登记新署与秘密交割会产生不同的长期后果", () => {
    const arrived = reachOpeningHandoff(true);
    const original = resolveEvent(arrived, "handoff-original");
    expect(original.phase).toBe("settlement");
    expect(original.day).toBe(arrived.day + 1);
    expect(original.convoy.sealIntact).toBe(true);
    expect(original.relations.jin).toBe(arrived.relations.jin - 2);
    expect(original.relations.song).toBeGreaterThan(arrived.relations.song);
    expect(original.settlement?.summary).toContain("守住原接头之约");

    const authority = resolveEvent(arrived, "handoff-authority");
    expect(authority.phase).toBe("settlement");
    expect(authority.convoy.sealIntact).toBe(false);
    expect(authority.relations.jin).toBe(arrived.relations.jin + 4);
    expect(authority.relations.song).toBe(arrived.relations.song - 4);
    expect(authority.settlement?.summary).toContain("改向新署交割");
    expect(authority.settlement?.notes.some((note) => note.includes("重议交割"))).toBe(true);

    const covert = resolveEvent(arrived, "handoff-covert");
    expect(covert.phase).toBe("settlement");
    expect(covert.day).toBe(arrived.day);
    expect(covert.supplies).toBe(arrived.supplies - 2);
    expect(covert.convoy.sealIntact).toBe(true);
    expect(covert.relations.jin).toBe(arrived.relations.jin - 1);
    expect(covert.conduct.concealedBorders).toBe(arrived.conduct.concealedBorders + 1);
    expect(covert.settlement?.summary).toContain("完成暗门交割");
  });

  it("副货在抵达时按路程、城况和实际货损变现", () => {
    let arrived = reachOpeningBorder(true, true);
    const purchasePrice = arrived.journey!.tradeLot!.purchasePrice;
    arrived = resolveEvent(arrived, "conceal");
    expect(arrived.currentEvent?.kind).toBe("handoff");
    const intact = resolveEvent(arrived, "handoff-original");
    expect(intact.settlement?.tradeRevenue).toBeGreaterThan(purchasePrice);
    expect(intact.settlement?.tradeProfit).toBe((intact.settlement?.tradeRevenue ?? 0) - purchasePrice);
    expect(intact.settlement?.notes.some((note) => note.includes("版刻书画"))).toBe(true);
    expect(intact.silver).toBe(arrived.silver + (intact.settlement?.reward ?? 0) + (intact.settlement?.tradeRevenue ?? 0) - (intact.settlement?.compensation ?? 0));
    expect(intact.settlement?.finance).toMatchObject({
      openingSilver: arrived.journey!.openingSilver,
      contractReward: intact.settlement?.reward,
      tradeRevenue: intact.settlement?.tradeRevenue,
      closingSilver: intact.silver,
      netChange: intact.silver - arrived.journey!.openingSilver!,
    });

    const damaged = resolveEvent({ ...arrived, convoy: { ...arrived.convoy, cargoIntegrity: 50, cartHp: 50 } }, "handoff-original");
    expect(damaged.settlement?.tradeRevenue).toBeLessThan(intact.settlement?.tradeRevenue ?? 0);
    expect(damaged.settlement?.tradeProfit).toBeLessThan(intact.settlement?.tradeProfit ?? 0);
  });

  it("行前必须选三名队员，账房会降低边境通关费用", () => {
    let game = createInitialGame(1107);
    expect(game.crew).toHaveLength(5);
    expect(game.activeCrewIds).toHaveLength(3);
    game = acceptContract(game, "opening-xiangyang");
    game = toggleJourneyCrew(game, "qiao-qing");
    game = toggleJourneyCrew(game, "shen-yan");
    expect(game.activeCrewIds).toContain("shen-yan");
    game = chooseRoute(game, generateRoutePlans("linan", "xiangyang")[0]);
    for (let index = 0; index < 10 && game.currentEvent?.kind !== "border"; index += 1) {
      if (game.phase === "travel") game = advanceTravel(game);
      if (game.phase === "event" && game.currentEvent?.kind !== "border") game = passTravelInterruption(game);
    }
    expect(game.currentEvent?.choices.find((item) => item.id === "papers")?.hint).toContain("19 两");
    expect(game.currentEvent?.choices.find((item) => item.id === "papers")?.hint).toContain("账房识牒");
  });

  it("战斗伤势写回具体队员，并可在城市治疗", () => {
    let game = reachOpeningBorder();
    game = resolveEvent(game, "fight");
    expect(game.pendingBattle?.guards.map((guard) => guard.id)).toEqual(game.journey?.crewIds);
    game = applyBattleResult(game, {
      outcome: "complete",
      elapsedHours: 3,
      leaderDamage: 4,
      guardLoss: 1,
      cartDamage: 3,
      cargoLoss: 2,
      sealBroken: false,
      guardDamage: { "lu-cang": 30, "qiao-qing": 8, "he-sheng": 0 },
      guardInjuries: { "lu-cang": "internal-trauma" },
    });
    expect(game.crew.find((member) => member.id === "lu-cang")?.hp).toBe(70);
    expect(game.crew.find((member) => member.id === "lu-cang")?.injury).toMatchObject({ id: "internal-trauma", remainingDays: 6 });
    expect(game.currentEvent?.kind).toBe("handoff");
    game = resolveEvent(game, "handoff-original");
    game = continueAfterSettlement(game);
    const beforeHeal = game.crew.find((member) => member.id === "lu-cang")!.hp;
    game = purchaseService(game, "heal");
    expect(game.crew.find((member) => member.id === "lu-cang")!.hp).toBeGreaterThan(beforeHeal);
    expect(game.crew.find((member) => member.id === "lu-cang")?.injury?.remainingDays).toBe(2);
  });

  it("重伤会削弱自动作战并让每程赶路多耗一日", () => {
    let healthy = createInitialGame(1107);
    healthy = acceptContract(healthy, "opening-xiangyang");
    const crewId = healthy.activeCrewIds[0];
    const injured: GameState = {
      ...healthy,
      crew: healthy.crew.map((member) => member.id === crewId ? { ...member, injury: createCrewInjury("fracture", healthy.day) } : member),
    };
    const routeId = generateRoutePlans("linan", "xiangyang", healthy)[0].routeIds[0];
    const healthyForecast = segmentTravelForecast(healthy, routeId);
    const injuredForecast = segmentTravelForecast(injured, routeId);
    expect(injuredForecast.days).toBe(healthyForecast.days + 1);
    expect(injuredForecast.modifiers).toContain("重伤拖行");
    const healthyGuard = crewBattleGuards(healthy.crew, [crewId], healthy.crewEquipment)[0];
    const injuredGuard = crewBattleGuards(injured.crew, [crewId], injured.crewEquipment)[0];
    expect(injuredGuard.power).toBeLessThan(healthyGuard.power);
    expect(injuredGuard.movementMultiplier).toBeLessThan(healthyGuard.movementMultiplier!);
    expect(injuredGuard.injuryName).toBe("骨伤难行");
  });

  it("v17 存档会为旧名册补上空伤势与空俘虏状态并升级到 v22", () => {
    const current = createInitialGame(1107);
    const oldCrew = current.crew.map(({ injury: _injury, captivity: _captivity, ...member }) => member);
    const migrated = migrateSavedGame({ ...current, version: 17, crew: oldCrew });
    expect(migrated?.version).toBe(25);
    expect(migrated?.crew.every((member) => member.injury === null)).toBe(true);
    expect(migrated?.crew.every((member) => member.captivity === null)).toBe(true);
  });

  it("败退时只会俘获一名阵中倒地者，并从点将与后续战斗中移除", () => {
    let game = reachOpeningBorder(true);
    game = resolveEvent(game, "fight");
    game = applyBattleResult(game, {
      outcome: "defeat",
      elapsedHours: 5,
      leaderDamage: 18,
      guardLoss: 2,
      cartDamage: 12,
      cargoLoss: 9,
      sealBroken: true,
      guardDamage: { "lu-cang": 140, "qiao-qing": 120, "he-sheng": 4 },
    });
    const captives = game.crew.filter((member) => member.captivity);
    expect(captives).toHaveLength(1);
    expect(captives[0]).toMatchObject({ id: "lu-cang", hp: 1 });
    expect(captives[0].captivity).toMatchObject({ captor: expect.any(String), routeId: expect.any(String), sinceDay: expect.any(Number) });
    expect(captives[0].captivity?.ransom).toBeGreaterThanOrEqual(24);
    expect(game.activeCrewIds).not.toContain(captives[0].id);
    expect(game.journey?.crewIds).not.toContain(captives[0].id);
    expect(crewBattleGuards(game.crew, [captives[0].id], game.crewEquipment)).toHaveLength(0);
    expect(game.news.some((item) => item.includes("队员被俘") && item.includes(captives[0].name))).toBe(true);
  });

  it("胜阵不会误判被俘，抵达失陷道路端点后可付银赎回", () => {
    let victory = reachOpeningBorder(true);
    victory = resolveEvent(victory, "fight");
    victory = applyBattleResult(victory, {
      outcome: "complete", elapsedHours: 3, leaderDamage: 4, guardLoss: 1, cartDamage: 2, cargoLoss: 0, sealBroken: false,
      guardDamage: { "lu-cang": 140 },
    });
    expect(victory.crew.find((member) => member.id === "lu-cang")?.captivity).toBeNull();

    let game = reachOpeningBorder(true);
    game = resolveEvent(game, "fight");
    game = applyBattleResult(game, {
      outcome: "retreat", elapsedHours: 3, leaderDamage: 8, guardLoss: 1, cartDamage: 5, cargoLoss: 2, sealBroken: false,
      guardDamage: { "lu-cang": 140 },
    });
    game = resolveEvent(game, "handoff-original");
    game = continueAfterSettlement(game);
    const offer = captivityReleaseOffer(game, "lu-cang");
    expect(offer).toMatchObject({ available: true, enabled: true, atNegotiatingCity: true });
    const before = { day: game.day, silver: game.silver };
    game = releaseCaptiveCrew(game, "lu-cang");
    expect(game.day).toBe(before.day + offer.days);
    expect(game.silver).toBe(before.silver - offer.cost);
    expect(game.crew.find((member) => member.id === "lu-cang")?.captivity).toBeNull();
    expect(game.crew.find((member) => member.id === "lu-cang")!.hp).toBeGreaterThanOrEqual(22);
  });

  it("只能在失陷路线端点赎人，总号网点会压价并缩短耗时", () => {
    const initial = createInitialGame(1107, "linan-guild");
    const captivity = { routeId: "linan-jiankang", captor: "采石矶水寨", sinceDay: 8, ransom: 52 };
    const away = {
      ...initial,
      currentCityId: "xiangyang",
      selectedCityId: "xiangyang",
      crew: initial.crew.map((member) => member.id === "lu-cang" ? { ...member, captivity } : member),
    };
    expect(captivityReleaseOffer(away, "lu-cang")).toMatchObject({ available: true, enabled: false, atNegotiatingCity: false });
    expect(releaseCaptiveCrew(away, "lu-cang")).toBe(away);

    const atHeadquarters = { ...away, currentCityId: "linan", selectedCityId: "linan" };
    const offer = captivityReleaseOffer(atHeadquarters, "lu-cang");
    expect(offer).toMatchObject({ enabled: true, atNegotiatingCity: true, discount: .2, days: 1, cost: 42 });
  });

  it("v22 存档会保留俘虏并清除失效的点将与战斗引用", () => {
    const current = createInitialGame(1107);
    const captivity = { routeId: ROUTES[0].id, captor: "试刀寨", sinceDay: 4, ransom: 41 };
    const saved = {
      ...current,
      crew: current.crew.map((member) => member.id === "lu-cang" ? { ...member, captivity } : member),
      activeCrewIds: ["lu-cang", "qiao-qing", "he-sheng"],
      pendingBattle: {
        id: "legacy-capture-battle", seed: 2, terrain: "official" as const, danger: 20, objective: "守车", enemyFaction: "试刀寨", routeName: "旧路",
        guards: crewBattleGuards(current.crew, ["lu-cang", "qiao-qing"], current.crewEquipment),
      },
    };
    const migrated = migrateSavedGame(saved)!;
    expect(migrated.version).toBe(25);
    expect(migrated.crew.find((member) => member.id === "lu-cang")?.captivity).toEqual(captivity);
    expect(migrated.activeCrewIds).not.toContain("lu-cang");
    expect(migrated.pendingBattle?.guards.map((guard) => guard.id)).not.toContain("lu-cang");
  });

  it("活镖与货镖会把不同战斗目标写入 Phaser 配置", () => {
    let game = createInitialGame(1107);
    game = acceptContract(game, "opening-xiangyang");
    game = chooseRoute(game, generateRoutePlans("linan", "xiangyang")[0]);
    const currentEvent = {
      id: "test-fight", kind: "bandits" as const, eyebrow: "测试", title: "拦路", description: "测试遭遇",
      choices: [{ id: "fight", label: "列阵", hint: "迎敌", tone: "danger" as const }],
    };
    const fightReady = { ...game, phase: "event" as const, currentEvent };
    const escortBattle = resolveEvent({
      ...fightReady,
      journey: { ...fightReady.journey!, contract: { ...fightReady.journey!.contract, kind: "escort" } },
    }, "fight");
    expect(escortBattle.pendingBattle).toMatchObject({ objectiveMode: "gate-run", objectiveSeconds: 46 });
    expect(escortBattle.pendingBattle?.objectiveNote).toContain("城门");
    expect(escortBattle.pendingBattle?.escortClient).toMatchObject({ name: fightReady.journey?.contract.cargo, healthRatio: 1 });

    const cargoBattle = resolveEvent({
      ...fightReady,
      journey: { ...fightReady.journey!, contract: { ...fightReady.journey!.contract, kind: "cargo" } },
    }, "fight");
    expect(cargoBattle.pendingBattle).toMatchObject({ objectiveMode: "breakthrough", objectiveSeconds: 72 });

    const pursuitBattle = resolveEvent({
      ...fightReady,
      currentEvent: { ...currentEvent, battleMode: "pursuit" as const },
      journey: { ...fightReady.journey!, contract: { ...fightReady.journey!.contract, kind: "letter" } },
    }, "fight");
    expect(pursuitBattle.pendingBattle).toMatchObject({ objectiveMode: "pursuit", objectiveSeconds: 34, recoveryLabel: "密信匣", pursuitCargoLoss: 42 });
    expect(pursuitBattle.pendingBattle?.objectiveNote).toContain("强行开路");
  });

  it("旧版存档会补齐成员与出战名单", () => {
    const current = createInitialGame(1107);
    const legacy = { ...current, version: 2 } as unknown as Record<string, unknown>;
    delete legacy.crew;
    delete legacy.activeCrewIds;
    delete legacy.recruitPool;
    delete legacy.recruitPoolCityId;
    const migrated = migrateSavedGame(legacy);
    expect(migrated?.version).toBe(25);
    expect(migrated?.crew).toHaveLength(5);
    expect(migrated?.activeCrewIds).toHaveLength(3);
    expect(migrated?.recruitPool).toHaveLength(4);
    expect(migrated?.recruitPoolCityId).toBe("linan");
    expect(migrated?.crew.every((member) => typeof member.hiringCost === "number" && Boolean(member.originCityId))).toBe(true);
    expect(migrated?.offices.linan.tier).toBe("headquarters");
    expect(Object.keys(migrated?.routeIntel ?? {})).toHaveLength(ROUTES.length);
  });

  it("v4 旧镖单迁移后会补齐类型、保密与隐藏变数", () => {
    const current = createInitialGame(1107);
    const oldOpening = { ...current.contracts[0] } as unknown as Record<string, unknown>;
    for (const key of ["kind", "patron", "inspectionAllowed", "allowedLoss", "confidentiality", "failurePenalty", "complication", "clue", "requirement", "secretKnown"]) delete oldOpening[key];
    const migrated = migrateSavedGame({ ...current, version: 4, contracts: [oldOpening] });
    expect(migrated?.version).toBe(25);
    expect(migrated?.contracts[0].kind).toBe("cargo");
    expect(migrated?.contracts[0].complication).toBe("military");
    expect(migrated?.contracts[0].confidentiality).toBe("绝密");
  });

  it("v5 存档会补齐招募池与队员籍贯字段", () => {
    const current = createInitialGame(1107);
    const oldCrew = current.crew.map((member) => {
      const old = { ...member } as unknown as Record<string, unknown>;
      delete old.hiringCost;
      delete old.originCityId;
      return old;
    });
    const legacy = { ...current, version: 5, crew: oldCrew } as unknown as Record<string, unknown>;
    delete legacy.recruitPool;
    delete legacy.recruitPoolCityId;
    const migrated = migrateSavedGame(legacy);
    expect(migrated?.version).toBe(25);
    expect(migrated?.crew.every((member) => member.originCityId === "linan")).toBe(true);
    expect(migrated?.recruitPool).toHaveLength(4);
  });

  it("行前路报会过期，并可花银核验为新报", () => {
    let game = createInitialGame(1107);
    game = acceptContract(game, "opening-xiangyang");
    const plan = generateRoutePlans("linan", "xiangyang")[0];
    expect(routePlanInsight(game, plan).fullySurveyed).toBe(false);
    const dayBefore = game.day;
    const silverBefore = game.silver;
    const cost = routeInvestigationCost(game);
    game = investigateRoute(game, plan, "buy");
    expect(game.day).toBe(dayBefore);
    expect(game.silver).toBe(silverBefore - cost);
    expect(routePlanInsight(game, plan).fullySurveyed).toBe(true);
  });

  it("趟子手探路耗时一日，并允许天下局势在等待时变化", () => {
    let game = createInitialGame(1107);
    game = acceptContract(game, "opening-xiangyang");
    const plan = generateRoutePlans("linan", "xiangyang")[0];
    const silverBefore = game.silver;
    game = investigateRoute(game, plan, "scout");
    expect(game.day).toBe(2);
    expect(game.silver).toBe(silverBefore);
    expect(game.cities.xiangyang.owner).toBe("jin");
    expect(routePlanInsight(game, plan).freshness).toBe("fresh");
  });

  it("新旧路报会决定规划时是否避开已知封渡", () => {
    const base = createInitialGame(1107);
    const routeId = "linan-shaoxing";
    const blocked: GameState = {
      ...base,
      routeStates: { ...base.routeStates, [routeId]: { condition: "flooded", sinceDay: 1, clearsDay: 5 } },
      routeIntel: { ...base.routeIntel, [routeId]: { ...base.routeIntel[routeId], knownCondition: "flooded", surveyedDay: base.day } },
    };
    expect(hasKnownRoute(blocked, "linan", "shaoxing")).toBe(false);
    expect(generateRoutePlans("linan", "shaoxing", blocked)).toHaveLength(0);
    const stale: GameState = { ...blocked, day: 9, routeIntel: { ...blocked.routeIntel, [routeId]: { ...blocked.routeIntel[routeId], surveyedDay: 1 } } };
    expect(hasKnownRoute(stale, "linan", "shaoxing")).toBe(true);
    expect(generateRoutePlans("linan", "shaoxing", stale).some((plan) => plan.routeIds.includes(routeId))).toBe(true);
  });

  it("泥泞路报会增加预计天数与马力消耗", () => {
    const base = createInitialGame(1107);
    const routeId = "linan-jiankang";
    const clear = segmentTravelForecast(base, routeId);
    const muddy: GameState = {
      ...base,
      routeStates: { ...base.routeStates, [routeId]: { condition: "muddy", sinceDay: 1, clearsDay: 6 } },
      routeIntel: { ...base.routeIntel, [routeId]: { ...base.routeIntel[routeId], knownCondition: "muddy" } },
    };
    const forecast = segmentTravelForecast(muddy, routeId);
    expect(forecast.days).toBeGreaterThan(clear.days);
    expect(forecast.staminaCost).toBeGreaterThan(clear.staminaCost);
    expect(forecast.modifiers).toContain("雨后泥泞");
  });

  it("车队撞见未知封渡时不会先扣时间补给，并可等待道路恢复", () => {
    const base = createInitialGame(1107);
    const route = ROUTES.find((item) => item.id === "linan-shaoxing")!;
    const plan = { id: "flood-test", routeIds: [route.id], cityIds: [route.from, route.to], days: route.days, danger: route.danger, label: "直行", description: "测试封渡" };
    let game: GameState = {
      ...base,
      completedContracts: 1,
      phase: "travel",
      currentCityId: route.from,
      selectedCityId: route.to,
      routeStates: { ...base.routeStates, [route.id]: { condition: "flooded", sinceDay: base.day, clearsDay: base.day + 2 } },
      routeIntel: { ...base.routeIntel, [route.id]: { ...base.routeIntel[route.id], knownCondition: "clear", surveyedDay: -9 } },
      journey: {
        contract: { ...base.contracts[0], id: "flood-contract", from: route.from, to: route.to, complication: "none" },
        plan,
        segmentIndex: 0,
        startedDay: base.day,
        elapsedDays: 0,
        traveledRouteIds: [],
        crewIds: [...base.activeCrewIds],
        stance: "steady",
      },
    };
    const suppliesBefore = game.supplies;
    game = advanceTravel(game);
    expect(game.phase).toBe("event");
    expect(game.currentEvent?.kind).toBe("roadblock");
    expect(game.day).toBe(base.day);
    expect(game.supplies).toBe(suppliesBefore);
    expect(game.routeIntel[route.id].knownCondition).toBe("flooded");
    game = resolveEvent(game, "wait-road");
    expect(game.phase).toBe("travel");
    expect(game.day).toBe(base.day + 2);
    expect(game.routeStates[route.id].condition).toBe("clear");
  });

  it("军封道路被发现后可以临机改走不含封路的余程", () => {
    const base = createInitialGame(1107);
    const route = ROUTES.find((item) => item.id === "linan-jiankang")!;
    const plan = { id: "blockade-test", routeIds: [route.id], cityIds: [route.from, route.to], days: route.days, danger: route.danger, label: "直行", description: "测试军封" };
    let game: GameState = {
      ...base,
      completedContracts: 1,
      phase: "travel",
      currentCityId: route.from,
      selectedCityId: route.to,
      routeStates: { ...base.routeStates, [route.id]: { condition: "blockaded", sinceDay: 1, clearsDay: 7 } },
      routeIntel: { ...base.routeIntel, [route.id]: { ...base.routeIntel[route.id], knownCondition: "clear", surveyedDay: -9 } },
      journey: {
        contract: { ...base.contracts[0], id: "blockade-contract", from: route.from, to: route.to, complication: "none" },
        plan,
        segmentIndex: 0,
        startedDay: base.day,
        elapsedDays: 0,
        traveledRouteIds: [],
        crewIds: [...base.activeCrewIds],
        stance: "steady",
      },
    };
    game = advanceTravel(game);
    expect(game.currentEvent?.choices.some((item) => item.id === "reroute-road")).toBe(true);
    game = resolveEvent(game, "reroute-road");
    expect(game.phase).toBe("travel");
    expect(game.journey?.plan.routeIds).not.toContain(route.id);
    expect(game.journey?.plan.cityIds[0]).toBe("linan");
    expect(game.journey?.plan.cityIds.at(-1)).toBe("jiankang");
  });

  it("道路状态会随时间确定性出现并在期限后恢复", () => {
    const base = createInitialGame(1107);
    const evolved = evolveRouteConditions(base.routeStates, base.cities, 21, 1, 20);
    expect(evolved.news).toHaveLength(1);
    expect(Object.values(evolved.routeStates).filter((state) => state.condition !== "clear")).toHaveLength(1);
    expect(evolveRouteConditions(base.routeStates, base.cities, 21, 1, 20)).toEqual(evolved);
  });

  it("v8 存档迁移会补齐道路现况与已知路况", () => {
    const current = createInitialGame(1107);
    const oldIntel = Object.fromEntries(Object.entries(current.routeIntel).map(([id, intel]) => {
      const old = { ...intel } as unknown as Record<string, unknown>;
      delete old.knownCondition;
      return [id, old];
    }));
    const legacy = { ...current, version: 8, routeIntel: oldIntel } as unknown as Record<string, unknown>;
    delete legacy.routeStates;
    const migrated = migrateSavedGame(legacy);
    expect(migrated?.version).toBe(25);
    expect(Object.keys(migrated?.routeStates ?? {})).toHaveLength(ROUTES.length);
    expect(Object.values(migrated?.routeIntel ?? {}).every((intel) => Boolean(intel.knownCondition))).toBe(true);
  });

  it("城市暗桩可升级为分号，并带来路报与整备折扣", () => {
    let game = createInitialGame(1107);
    game = { ...game, currentCityId: "jiankang", selectedCityId: "jiankang", silver: 240, reputation: 45, cityReputation: { ...game.cityReputation, jiankang: 25 } };
    expect(officeActionOffer(game).action).toBe("establish");
    game = establishOffice(game);
    expect(game.offices.jiankang.tier).toBe("outpost");
    for (const route of ROUTES.filter((item) => item.from === "jiankang" || item.to === "jiankang")) {
      expect(game.routeIntel[route.id].surveyedDay).toBe(game.day);
    }
    expect(serviceCost(game, "repair")).toBe(15);
    game = establishOffice(game);
    expect(game.offices.jiankang.tier).toBe("branch");
    expect(game.contracts).toHaveLength(5);
    expect(serviceCost(game, "repair")).toBe(14);
  });

  it("城况会改变整备物价和一次能买到的粮草", () => {
    const base = createInitialGame(1107);
    const stable: GameState = { ...base, cities: { ...base.cities, linan: { ...base.cities.linan, status: "stable" } } };
    const famine: GameState = { ...base, cities: { ...base.cities, linan: { ...base.cities.linan, status: "famine" } } };
    expect(serviceCost(base, "supplies")).toBeLessThan(serviceCost(stable, "supplies"));
    expect(serviceCost(famine, "supplies")).toBeGreaterThan(serviceCost(stable, "supplies"));
    expect(supplyPurchaseAmount(base)).toBe(8);
    expect(supplyPurchaseAmount(famine)).toBe(3);
    const bought = purchaseService({ ...famine, silver: 100, supplies: 10 }, "supplies");
    expect(bought.supplies).toBe(13);
  });

  it("危城镖榜数量更少，但同种子下给出更高风险酬金", () => {
    const game = createInitialGame(1107);
    const stableCity = { ...game.cities.jiankang, status: "stable" as const };
    const besiegedCity = { ...game.cities.jiankang, status: "besieged" as const };
    const stable = generateContracts("jiankang", 12, 99, false, 3, stableCity).contracts;
    const besieged = generateContracts("jiankang", 12, 99, false, 3, besiegedCity).contracts;
    const average = (contracts: typeof stable) => contracts.reduce((sum, contract) => sum + contract.reward, 0) / contracts.length;
    expect(average(besieged)).toBeGreaterThan(average(stable));
    expect(new Set(besieged.map((contract) => contract.kind))).toEqual(new Set(["cargo", "letter", "escort"]));
  });

  it("地方援助会消耗镖局资源、改善城况并进入七日冷却", () => {
    const base = createInitialGame(1107);
    let game: GameState = {
      ...base,
      silver: 100,
      supplies: 10,
      cities: { ...base.cities, linan: { ...base.cities.linan, status: "famine", prosperity: 42, security: 46, statusSinceDay: 1 } },
    };
    const offer = cityAidOffer(game);
    expect(offer.enabled).toBe(true);
    game = supportCurrentCity(game);
    expect(game.silver).toBe(82);
    expect(game.supplies).toBe(6);
    expect(game.cities.linan.status).toBe("stable");
    expect(game.cities.linan.prosperity).toBe(56);
    expect(game.cityReputation.linan).toBe(27);
    expect(cityAidOffer({ ...game, cities: { ...game.cities, linan: { ...game.cities.linan, status: "famine" } } }).cooldownDays).toBe(7);
  });

  it("富庶城市提供更多且资历更好的招募人选", () => {
    const ordinary = generateRecruitPool("linan", "capital", 10, 42, [], 0, 3).recruits;
    const prosperous = generateRecruitPool("linan", "capital", 10, 42, [], 2, 4).recruits;
    expect(prosperous).toHaveLength(4);
    expect(prosperous.slice(0, 3).map((member) => member.id)).toEqual(ordinary.map((member) => member.id));
    expect(prosperous.slice(0, 3).every((member, index) => member.experience === ordinary[index].experience + 2)).toBe(true);
  });

  it("时间推进会确定性地产生一则地方城况并写回数值", () => {
    const game = createInitialGame(1107);
    const evolved = evolveCityConditions(game.cities, 21, 1, 20);
    expect(evolved.news).toHaveLength(1);
    expect(Object.values(evolved.cities).some((city) => city.statusSinceDay === 21)).toBe(true);
    expect(evolveCityConditions(game.cities, 21, 1, 20)).toEqual(evolved);
  });

  it("v7 存档迁移会补齐城况起始日与援助记录", () => {
    const current = createInitialGame(1107);
    const oldCities = Object.fromEntries(Object.entries(current.cities).map(([id, city]) => {
      const old = { ...city } as unknown as Record<string, unknown>;
      delete old.statusSinceDay;
      delete old.playerAidDay;
      return [id, old];
    }));
    const migrated = migrateSavedGame({ ...current, version: 7, cities: oldCities });
    expect(migrated?.version).toBe(25);
    expect(migrated?.cities.linan.statusSinceDay).toBe(1);
    expect(migrated?.cities.linan.playerAidDay).toBe(-99);
  });

  it("同一路段走过两趟后会沉淀为节省补给的熟路", () => {
    let game = createInitialGame(1107);
    const route = ROUTES.find((item) => item.from === "linan" || item.to === "linan")!;
    const neighbor = route.from === "linan" ? route.to : route.from;
    for (let trip = 0; trip < 2; trip += 1) {
      const from = trip === 0 ? "linan" : neighbor;
      const to = trip === 0 ? neighbor : "linan";
      const plan = { id: `familiar-${trip}`, routeIds: [route.id], cityIds: [from, to], days: route.days, danger: route.danger, label: "试路", description: "往返验路" };
      game = {
        ...game,
        phase: "travel",
        currentCityId: from,
        selectedCityId: to,
        journey: {
          contract: {
            id: `familiar-contract-${trip}`,
            from,
            to,
            title: "验路镖",
            cargo: "一封路簿",
            client: "总号",
            reward: 80,
            deadline: 20,
            risk: "稳妥",
            sealRequired: false,
            kind: "letter",
            patron: "merchant",
            inspectionAllowed: true,
            allowedLoss: 0,
            confidentiality: "寻常",
            failurePenalty: 20,
            complication: "none",
            clue: "无",
            requirement: "沿途验路",
            secretKnown: true,
            secret: "无",
            brief: "沿途验路",
          },
          plan,
          segmentIndex: 0,
          startedDay: game.day,
          elapsedDays: 0,
          traveledRouteIds: [],
          crewIds: [...game.activeCrewIds],
          stance: "steady",
        },
      };
      game = advanceTravel(game);
      game = resolveEvent(game, game.currentEvent!.choices.find((item) => item.id !== "fight")!.id);
      expect(game.phase).toBe("settlement");
      if (trip === 0) game = continueAfterSettlement(game);
    }
    expect(game.routeIntel[route.id].trips).toBe(2);
    expect(game.news.some((item) => item.includes("熟路成网"))).toBe(true);
  });

  it("富庶都城给出四张可复现的招募名帖，并至少包含一名经营职司", () => {
    const game = createInitialGame(1107);
    expect(game.recruitPool).toHaveLength(4);
    expect(new Set(game.recruitPool.map((member) => member.id)).size).toBe(4);
    expect(game.recruitPool.every((member) => member.originCityId === "linan" && member.hiringCost > 0)).toBe(true);
    expect(game.recruitPool.some((member) => ["向导", "厨子", "医师", "账房"].includes(member.role))).toBe(true);
    expect(createInitialGame(1107).recruitPool).toEqual(game.recruitPool);
  });

  it("延揽队员会扣除身契银并受八人名册上限约束", () => {
    let game = { ...createInitialGame(1107), silver: 500 };
    const candidate = game.recruitPool[0];
    const silverBefore = game.silver;
    game = recruitCrew(game, candidate.id);
    expect(game.crew.some((member) => member.id === candidate.id)).toBe(true);
    expect(game.recruitPool.some((member) => member.id === candidate.id)).toBe(false);
    expect(game.silver).toBe(silverBefore - jianghuRecruitmentCost(candidate.hiringCost, game.jianghuReputation));

    const nextCandidate = game.recruitPool[0];
    const paddedCrew = [...game.crew];
    while (paddedCrew.length < CREW_CAPACITY) paddedCrew.push({ ...game.crew[0], id: `reserve-${paddedCrew.length}` });
    const fullRoster = { ...game, crew: paddedCrew };
    expect(recruitCrew(fullRoster, nextCandidate.id)).toEqual(fullRoster);
  });

  it("厨子节省沿途补给，向导在山路同时节粮并降低伏击强度", () => {
    const route = ROUTES.find((item) => item.terrain === "mountain" && item.to !== "xiangyang")!;
    const base = createInitialGame(1107);
    const contract = { ...base.contracts[0], from: route.from, to: route.to };
    const plan = { id: "utility-route", routeIds: [route.id], cityIds: [route.from, route.to], days: route.days, danger: route.danger, label: "山路试行", description: "验证职司" };
    const prepare = (role?: "厨子" | "向导") => {
      const specialist = role ? {
        ...base.crew[0], id: `test-${role}`, name: role, role, specialty: "测试职司", hiringCost: 0, originCityId: route.from,
      } : null;
      const crew = specialist ? [...base.crew, specialist] : base.crew;
      const crewIds = specialist ? [specialist.id, "qiao-qing", "he-sheng"] : [...base.activeCrewIds];
      return {
        ...base,
        completedContracts: 1,
        phase: "travel" as const,
        currentCityId: route.from,
        selectedCityId: route.to,
        supplies: 20,
        crew,
        activeCrewIds: crewIds,
        journey: { contract, plan, segmentIndex: 0, startedDay: base.day, elapsedDays: 0, traveledRouteIds: [], crewIds, stance: "steady" as const },
      };
    };
    const ordinary = advanceTravel(prepare());
    const withCook = advanceTravel(prepare("厨子"));
    const withGuide = advanceTravel(prepare("向导"));
    expect(withCook.supplies).toBe(ordinary.supplies + 1);
    expect(withGuide.supplies).toBe(ordinary.supplies + 1);
    const ordinaryBattle = resolveEvent(ordinary, "fight");
    const guidedBattle = resolveEvent(withGuide, "fight");
    expect(guidedBattle.pendingBattle!.danger).toBe(ordinaryBattle.pendingBattle!.danger - 8);
  });

  it("随队医师会在每段路后救治伤员", () => {
    const base = createInitialGame(1107);
    const route = ROUTES.find((item) => item.from === "linan")!;
    const doctor = { ...base.crew.find((member) => member.role === "医师")!, hp: 60 };
    const wounded = { ...base.crew[0], hp: 61 };
    const crew = base.crew.map((member) => member.id === doctor.id ? doctor : member.id === wounded.id ? wounded : member);
    const to = route.to;
    let game: GameState = {
      ...base,
      phase: "event" as const,
      crew,
      journey: {
        contract: { ...base.contracts[0], from: "linan", to },
        plan: { id: "doctor-route", routeIds: [route.id], cityIds: ["linan", to], days: route.days, danger: route.danger, label: "医行", description: "测试" },
        segmentIndex: 0,
        startedDay: base.day,
        elapsedDays: 0,
        traveledRouteIds: [],
        crewIds: [doctor.id, wounded.id, "qiao-qing"],
        stance: "steady",
      },
      currentEvent: { id: "doctor-rest", kind: "storm" as const, eyebrow: "歇脚", title: "包扎", description: "途中整顿", choices: [{ id: "shelter", label: "歇息", hint: "平安" }] },
    };
    game = resolveEvent(game, "shelter");
    expect(game.crew.find((member) => member.id === doctor.id)?.hp).toBe(64);
    expect(game.crew.find((member) => member.id === wounded.id)?.hp).toBe(65);
    expect(game.news.some((item) => item.includes("途中诊治"))).toBe(true);
  });

  it("队员阅历会形成阶位并小幅提高护车能力", () => {
    const novice = createInitialGame(1107).crew[0];
    const veteran = { ...novice, experience: 12 };
    expect(crewRank(0).label).toBe("新手");
    expect(crewRank(3).label).toBe("熟手");
    expect(crewRank(7).label).toBe("老手");
    expect(crewRank(12).label).toBe("名手");
    expect(crewBattleGuards([veteran], [veteran.id])[0].power).toBeGreaterThan(crewBattleGuards([novice], [novice.id])[0].power);
  });

  it("演武会消耗银钱增加阅历，装备可购入、调配并提高护车战力", () => {
    let game = { ...createInitialGame(1107), silver: 500 };
    const crewId = "qiao-qing";
    const trainingCost = crewTrainingCost(game, crewId);
    game = trainCrew(game, crewId);
    expect(game.silver).toBe(500 - trainingCost);
    expect(game.crew.find((member) => member.id === crewId)?.experience).toBe(1);

    const price = equipmentPurchaseCost(game, "yanling-sabre");
    game = purchaseEquipment(game, "yanling-sabre");
    expect(game.silver).toBe(500 - trainingCost - price);
    expect(game.equipmentStock["yanling-sabre"]).toBe(1);
    const locked = equipCrewItem(game, crewId, "yanling-sabre");
    expect(locked.crewEquipment[crewId]?.weapon).toBeUndefined();

    game = { ...game, crew: game.crew.map((member) => member.id === crewId ? { ...member, experience: 3 } : member) };
    const before = crewBattleGuards(game.crew, [crewId], game.crewEquipment)[0].power;
    game = equipCrewItem(game, crewId, "yanling-sabre");
    expect(game.crewEquipment[crewId].weapon).toBe("yanling-sabre");
    expect(crewBattleGuards(game.crew, [crewId], game.crewEquipment)[0].power).toBeGreaterThan(before);
    expect(crewBattleGuards(game.crew, [crewId], game.crewEquipment)[0].equipmentIds).toContain("yanling-sabre");
    game = unequipCrewItem(game, crewId, "weapon");
    expect(game.crewEquipment[crewId].weapon).toBeUndefined();
  });

  it("器械谱样可精校三阶，并把成长写入同式装备与自动战斗参数", () => {
    let game = { ...createInitialGame(1107), silver: 800 };
    const crewId = "lu-cang";
    const before = crewBattleGuards(game.crew, [crewId], game.crewEquipment, game.equipmentTuning)[0];
    const firstCost = equipmentTuningCost(game, "jujube-spear");
    game = tuneEquipment(game, "jujube-spear");
    const repaired = crewBattleGuards(game.crew, [crewId], game.crewEquipment, game.equipmentTuning)[0];

    expect(game.silver).toBe(800 - firstCost);
    expect(game.equipmentTuning["jujube-spear"]).toBe(1);
    expect(repaired.power).toBeGreaterThan(before.power);
    expect(repaired.equipmentNames).toContain("枣木长枪〔修整〕");
    expect(repaired.equipmentTuning).toMatchObject({ "jujube-spear": 1 });
    expect(game.news[0]).toContain("器械精校");

    game = tuneEquipment(tuneEquipment(game, "jujube-spear"), "jujube-spear");
    expect(game.equipmentTuning["jujube-spear"]).toBe(3);
    expect(crewBattleGuards(game.crew, [crewId], game.crewEquipment, game.equipmentTuning)[0].equipmentNames).toContain("枣木长枪〔名匠〕");
    expect(equipmentTuningCost(game, "jujube-spear")).toBe(0);
    expect(tuneEquipment(game, "jujube-spear")).toBe(game);
    expect(tuneEquipment(game, "watch-crossbow")).toBe(game);
  });

  it("精品战利器不能在器械铺购买，只由凶险胜阵后的甲乙交割发放", () => {
    const base = { ...createInitialGame(1107), silver: 500 };
    const contract = base.contracts.find((item) => item.risk === "凶险")!;
    expect(equipmentRewardForDelivery({ ...contract, kind: "cargo" }, "甲", 1, 0)).toBe("frontier-hook-spear");
    expect(equipmentRewardForDelivery({ ...contract, kind: "letter" }, "乙", 1, 0)).toBe("watch-crossbow");
    expect(equipmentRewardForDelivery({ ...contract, kind: "escort" }, "甲", 1, 0)).toBe("field-medicine-chest");
    expect(equipmentRewardForDelivery({ ...contract, risk: "棘手" }, "甲", 1, 0)).toBeUndefined();
    expect(equipmentRewardForDelivery(contract, "甲", 0, 0)).toBeUndefined();
    expect(equipmentRewardForDelivery(contract, "丙", 1, 0)).toBeUndefined();
    expect(purchaseEquipment(base, "watch-crossbow")).toBe(base);
  });

  it("胜战次数会写入旅程，并在成功交割时把战利器收入器械架", () => {
    let game = reachOpeningBorder();
    game = resolveEvent(game, "fight");
    game = applyBattleResult(game, {
      outcome: "complete", elapsedHours: 3, leaderDamage: 0, guardLoss: 0, cartDamage: 0, cargoLoss: 0, sealBroken: false,
      guardDamage: {}, horseDamage: 0,
    });
    expect(game.journey?.battleVictories).toBe(1);
    game = resolveEvent(game, "handoff-original");
    expect(game.phase).toBe("settlement");
    expect(game.settlement?.equipmentReward).toBe("frontier-hook-spear");
    expect(game.equipmentStock["frontier-hook-spear"]).toBe(1);
    expect(game.settlement?.notes.some((note) => note.includes("朔边钩镰枪"))).toBe(true);
  });

  it("熟手可免费初定战职，改习会付银且三职生成不同自动战斗参数", () => {
    let game = { ...createInitialGame(1107), silver: 500 };
    const crewId = "qiao-qing";
    expect(setCrewDiscipline(game, crewId, "vanguard")).toBe(game);
    game = { ...game, crew: game.crew.map((member) => member.id === crewId ? { ...member, experience: 3 } : member) };
    expect(crewDisciplineChangeCost(game, crewId)).toBe(0);
    game = setCrewDiscipline(game, crewId, "vanguard");
    expect(game.crew.find((member) => member.id === crewId)?.disciplineId).toBe("vanguard");
    expect(game.silver).toBe(500);
    const vanguard = crewBattleGuards(game.crew, [crewId], game.crewEquipment)[0];
    expect(vanguard.disciplineName).toBe("踏阵先锋");
    expect(vanguard.engageRangeBonus).toBe(55);

    const changeCost = crewDisciplineChangeCost(game, crewId);
    game = setCrewDiscipline(game, crewId, "bulwark");
    const bulwark = crewBattleGuards(game.crew, [crewId], game.crewEquipment)[0];
    expect(game.silver).toBe(500 - changeCost);
    expect(bulwark.maxHpBonus).toBeGreaterThan(vanguard.maxHpBonus ?? 0);
    expect(bulwark.convoyProtection).toBeLessThan(1);
  });

  it("v16 存档会把未定职旧队员迁移为可继续培养的 v22 名册", () => {
    const current = createInitialGame(1107);
    const oldCrew = current.crew.map(({ disciplineId: _disciplineId, ...member }) => member);
    const migrated = migrateSavedGame({ ...current, version: 16, crew: oldCrew });
    expect(migrated?.version).toBe(25);
    expect(migrated?.crew.every((member) => member.disciplineId === null)).toBe(true);
  });

  it("旧存档会自动补齐器械库存与镖师配装", () => {
    const current = createInitialGame(1107);
    const legacy = { ...current } as unknown as Record<string, unknown>;
    delete legacy.equipmentStock;
    delete legacy.crewEquipment;
    const migrated = migrateSavedGame(legacy)!;
    expect(migrated.equipmentStock["jujube-spear"]).toBe(2);
    expect(migrated.equipmentStock["watch-crossbow"]).toBe(0);
    expect(migrated.crewEquipment["lu-cang"].weapon).toBe("jujube-spear");
    expect(migrated.crewEquipment["player-leader"].weapon).toBe("jujube-spear");
  });

  it("v18 存档会补齐原制器械谱样并升级到 v22", () => {
    const current = createInitialGame(1107);
    const legacy = { ...current, version: 18 } as unknown as Record<string, unknown>;
    delete legacy.equipmentTuning;
    const migrated = migrateSavedGame(legacy)!;
    expect(migrated.version).toBe(25);
    expect(Object.values(migrated.equipmentTuning).every((level) => level === 0)).toBe(true);
  });

  it("v6 存档会补齐车、马、马力与改装字段", () => {
    const current = createInitialGame(1107);
    const oldConvoy = { ...current.convoy } as unknown as Record<string, unknown>;
    for (const key of ["wagonId", "horseTeamId", "horseHp", "horseStamina", "upgrades"]) delete oldConvoy[key];
    const migrated = migrateSavedGame({ ...current, version: 6, convoy: oldConvoy });
    expect(migrated?.version).toBe(25);
    expect(migrated?.convoy.wagonId).toBe("covered-cart");
    expect(migrated?.convoy.horseTeamId).toBe("draft-pair");
    expect(migrated?.convoy.horseHp).toBe(100);
    expect(migrated?.convoy.horseStamina).toBe(100);
    expect(migrated?.convoy.upgrades).toEqual([]);
  });

  it("车马铺购买会按总号折扣扣银，并保留为长期资产", () => {
    let game = { ...createInitialGame(1107), silver: 500, reputation: 50 };
    const wagonCost = wagonPurchaseCost(game, "armored-cart");
    game = purchaseWagon(game, "armored-cart");
    expect(game.convoy.wagonId).toBe("armored-cart");
    expect(game.silver).toBe(500 - wagonCost);
    const horseCost = horseTeamPurchaseCost(game, "mountain-mules");
    game = purchaseHorseTeam(game, "mountain-mules");
    expect(game.convoy.horseTeamId).toBe("mountain-mules");
    expect(game.convoy.horseHp).toBe(100);
    const upgradeCost = convoyUpgradePurchaseCost(game, "iron-wheels");
    const silverBeforeUpgrade = game.silver;
    game = purchaseConvoyUpgrade(game, "iron-wheels");
    expect(game.convoy.upgrades).toContain("iron-wheels");
    expect(game.silver).toBe(silverBeforeUpgrade - upgradeCost);
  });

  it("轻车与健马缩短官道路程，骡队降低山路马力损耗", () => {
    const base = createInitialGame(1107);
    const official = ROUTES.find((route) => route.terrain === "official" && route.days >= 3)!;
    const mountain = ROUTES.find((route) => route.terrain === "mountain" && route.days >= 3)!;
    const ordinaryRoad = segmentTravelForecast(base, official.id);
    const fastRoad = segmentTravelForecast({ ...base, convoy: { ...base.convoy, wagonId: "swift-cart", horseTeamId: "post-pair" } }, official.id);
    expect(fastRoad.days).toBeLessThan(ordinaryRoad.days);
    const ordinaryMountain = segmentTravelForecast(base, mountain.id);
    const muleMountain = segmentTravelForecast({ ...base, convoy: { ...base.convoy, horseTeamId: "mountain-mules" } }, mountain.id);
    expect(muleMountain.days).toBeLessThan(ordinaryMountain.days);
    expect(muleMountain.staminaCost).toBeLessThan(ordinaryMountain.staminaCost);
  });

  it("稳行、疾驱与潜行会真实改变时日、口粮、马力和路险", () => {
    let planning = createInitialGame(1107);
    const contract = planning.contracts[0];
    planning = acceptContract(planning, contract.id);
    const plan = generateRoutePlans(contract.from, contract.to, planning)[0];
    const steady = routePlanTravelForecast(planning, plan);
    const hasteGame = setTravelStance(planning, "haste");
    const haste = routePlanTravelForecast(hasteGame, plan);
    const covertGame = setTravelStance(planning, "covert");
    const covert = routePlanTravelForecast(covertGame, plan);

    expect(hasteGame.journey?.stance).toBe("haste");
    expect(haste.days).toBeLessThanOrEqual(steady.days);
    expect(haste.staminaCost).toBeGreaterThan(steady.staminaCost);
    expect(haste.dangerModifier).toBe(9);
    expect(covert.days).toBeGreaterThan(steady.days);
    expect(covert.supplyCost).toBeGreaterThan(steady.supplyCost);
    expect(covert.staminaCost).toBeLessThan(steady.staminaCost);
    expect(covert.dangerModifier).toBe(-8);
    expect(setTravelStance({ ...covertGame, phase: "travel" }, "haste").journey?.stance).toBe("covert");
  });

  it("行程方略会改变边关绕行代价与护车战压力", () => {
    const border = reachOpeningBorder();
    const steadyDetour = resolveEvent({ ...border, supplies: 10, convoy: { ...border.convoy, cartHp: 100 } }, "detour");
    const covertBorder: GameState = { ...border, supplies: 10, convoy: { ...border.convoy, cartHp: 100 }, journey: { ...border.journey!, stance: "covert" } };
    const covertDetour = resolveEvent(covertBorder, "detour");
    expect(covertDetour.supplies).toBeGreaterThan(steadyDetour.supplies);
    expect(covertDetour.convoy.cartHp).toBeGreaterThan(steadyDetour.convoy.cartHp);

    const steadyBattle = resolveEvent(border, "fight");
    const hasteBattle = resolveEvent({ ...border, journey: { ...border.journey!, stance: "haste" } }, "fight");
    const covertBattle = resolveEvent({ ...border, journey: { ...border.journey!, stance: "covert" } }, "fight");
    expect(hasteBattle.pendingBattle!.danger - steadyBattle.pendingBattle!.danger).toBe(9);
    expect(covertBattle.pendingBattle!.danger - steadyBattle.pendingBattle!.danger).toBe(-8);
  });

  it("多段路线会在中继城外生成驿亭落脚点，并允许临时改换行策", () => {
    let stopover = reachOpeningStopover();
    expect(stopover.phase).toBe("event");
    expect(stopover.currentEvent?.kind).toBe("waystation");
    expect(stopover.currentEvent?.choices.map((item) => item.id)).toEqual(["stop-rest", "stop-stock", "stop-intel", "stop-press"]);
    const offer = stopoverOffer(stopover)!;
    expect(offer.cityId).toBe(stopover.journey?.plan.cityIds[stopover.journey!.segmentIndex]);
    expect(offer.routeId).toBe(stopover.journey?.plan.routeIds[stopover.journey!.segmentIndex]);
    const landmark = primaryLandmarkForRoute(offer.routeId);
    expect(landmark).not.toBeNull();
    expect(stopover.currentEvent?.description).toContain(landmark!.name);

    const steady = segmentTravelForecast(stopover, offer.routeId);
    stopover = setTravelStance(stopover, "covert");
    const covert = segmentTravelForecast(stopover, offer.routeId);
    expect(stopover.currentEvent?.kind).toBe("waystation");
    expect(stopover.journey?.stance).toBe("covert");
    expect(covert.days).toBeGreaterThan(steady.days);
    expect(covert.dangerModifier).toBe(-8);
  });

  it("驿亭会用最新路报重绘余程，并完整保留已经走过的路与押镖损伤", () => {
    const stopover = reachOpeningStopover();
    const options = stopoverRouteOptions(stopover);
    expect(options.length).toBeGreaterThan(1);
    expect(options[0].current).toBe(true);
    expect(options[0].plan.cityIds[0]).toBe(stopover.journey?.plan.cityIds[stopover.journey!.segmentIndex]);
    expect(options.every((option) => option.plan.cityIds.at(-1) === stopover.journey?.contract.to)).toBe(true);
    expect(options.every((option) => option.travel.days > 0 && option.pathLabel.includes("—"))).toBe(true);

    const alternate = options.find((option) => !option.current)!;
    const scarred: GameState = {
      ...stopover,
      convoy: { ...stopover.convoy, cartHp: 71, cargoIntegrity: 83, sealIntact: false },
      journey: { ...stopover.journey!, battleVictories: 2 },
    };
    const prefixRoutes = scarred.journey!.plan.routeIds.slice(0, scarred.journey!.segmentIndex);
    const traveled = [...scarred.journey!.traveledRouteIds];
    const replanned = replanJourneyAtStopover(scarred, alternate.plan.id);
    expect(replanned.phase).toBe("event");
    expect(replanned.currentEvent?.kind).toBe("waystation");
    expect(replanned.journey?.segmentIndex).toBe(scarred.journey?.segmentIndex);
    expect(replanned.journey?.plan.routeIds.slice(0, prefixRoutes.length)).toEqual(prefixRoutes);
    expect(replanned.journey?.plan.routeIds.slice(replanned.journey.segmentIndex)).toEqual(alternate.plan.routeIds);
    expect(replanned.journey?.traveledRouteIds).toEqual(traveled);
    expect(replanned.journey?.battleVictories).toBe(2);
    expect(replanned.convoy).toMatchObject({ cartHp: 71, cargoIntegrity: 83, sealIntact: false });
    expect(replanned.news[0]).toContain("中途重绘");
  });

  it("中途改道只在驿亭开放，当前路线与无效路签不会改变旅程", () => {
    const stopover = reachOpeningStopover();
    const current = stopoverRouteOptions(stopover)[0];
    expect(replanJourneyAtStopover(stopover, current.plan.id)).toBe(stopover);
    expect(replanJourneyAtStopover(stopover, "missing-plan")).toBe(stopover);
    expect(replanJourneyAtStopover({ ...stopover, phase: "travel", currentEvent: null }, current.plan.id).journey?.plan).toEqual(stopover.journey?.plan);
  });

  it("落脚点可补粮或核验下一程路报，费用会写回旅程", () => {
    const supplyStop = reachOpeningStopover();
    const supplyOffer = stopoverOffer(supplyStop)!;
    const supplied = resolveEvent(supplyStop, "stop-stock");
    expect(supplied.phase).toBe("travel");
    expect(supplied.silver).toBe(supplyStop.silver - supplyOffer.supplyCost);
    expect(supplied.supplies).toBe(Math.min(24, supplyStop.supplies + supplyOffer.supplyGain));

    const intelStop = reachOpeningStopover();
    const intelOffer = stopoverOffer(intelStop)!;
    const surveyed = resolveEvent(intelStop, "stop-intel");
    expect(surveyed.phase).toBe("travel");
    expect(surveyed.silver).toBe(intelStop.silver - intelOffer.intelCost);
    expect(surveyed.routeIntel[intelOffer.routeId].surveyedDay).toBe(surveyed.day);
  });

  it("落脚整顿耗时耗粮，并恢复人手、马力与士气", () => {
    const stopover = reachOpeningStopover();
    const crewId = stopover.journey!.crewIds[0];
    const tired: GameState = {
      ...stopover,
      supplies: 5,
      crew: stopover.crew.map((member) => member.id === crewId ? {
        ...member,
        hp: member.hp - 20,
        injury: createCrewInjury("fracture", stopover.day),
      } : member),
      convoy: { ...stopover.convoy, leaderHp: 70, horseHp: 68, horseStamina: 18, morale: 42 },
    };
    const rested = resolveEvent(tired, "stop-rest");
    expect(rested.phase).toBe("travel");
    expect(rested.day).toBe(tired.day + 1);
    expect(rested.supplies).toBe(4);
    expect(rested.convoy.horseStamina).toBe(52);
    expect(rested.convoy.morale).toBe(50);
    expect(rested.crew.find((member) => member.id === crewId)!.hp).toBeGreaterThan(tired.crew.find((member) => member.id === crewId)!.hp);
    expect(rested.crew.find((member) => member.id === crewId)!.injury?.remainingDays).toBe(6);
  });

  it("路段推进持续消耗马力，入城投宿马院才能恢复", () => {
    const base = createInitialGame(1107);
    const route = ROUTES.find((item) => item.terrain === "official" && base.cities[item.from].owner === "song" && base.cities[item.to].owner === "song")!;
    const forecast = segmentTravelForecast(base, route.id);
    const contract = { ...base.contracts[0], id: "horse-test", from: route.from, to: route.to, complication: "none" as const, sealRequired: false };
    let game: GameState = {
      ...base,
      completedContracts: 1,
      phase: "travel",
      currentCityId: route.from,
      selectedCityId: route.to,
      journey: {
        contract,
        plan: { id: "horse-route", routeIds: [route.id], cityIds: [route.from, route.to], days: route.days, danger: route.danger, label: "试马", description: "测试" },
        segmentIndex: 0,
        startedDay: base.day,
        elapsedDays: 0,
        traveledRouteIds: [],
        crewIds: [...base.activeCrewIds],
        stance: "steady",
      },
    };
    game = advanceTravel(game);
    expect(game.day).toBe(base.day + forecast.days);
    expect(game.convoy.horseStamina).toBe(100 - forecast.staminaCost);
    game = { ...game, phase: "map", journey: null, currentEvent: null, silver: 100, convoy: { ...game.convoy, horseHp: 45, horseStamina: 12 } };
    game = purchaseService(game, "stable");
    expect(game.convoy.horseHp).toBe(71);
    expect(game.convoy.horseStamina).toBe(60);
  });

  it("重车铁轮减少绕关车损，护车战会把马伤写回地图", () => {
    const border = reachOpeningBorder();
    const plain = resolveEvent(border, "detour");
    const protectedConvoy = { ...border.convoy, wagonId: "armored-cart" as const, upgrades: ["iron-wheels" as const] };
    const protectedResult = resolveEvent({ ...border, convoy: protectedConvoy }, "detour");
    expect(protectedResult.convoy.cartHp).toBeGreaterThan(plain.convoy.cartHp);

    let battle = resolveEvent({ ...border, convoy: protectedConvoy }, "fight");
    expect(battle.pendingBattle?.vehicleName).toBe("铁叶重车");
    expect(battle.pendingBattle?.cartArmor).toBeLessThan(1);
    const horseHpBeforeBattle = battle.convoy.horseHp;
    battle = applyBattleResult(battle, {
      outcome: "complete", elapsedHours: 3, leaderDamage: 0, guardLoss: 0, cartDamage: 2, cargoLoss: 0, sealBroken: false,
      guardDamage: {}, horseDamage: 13,
    });
    expect(battle.convoy.horseHp).toBe(horseHpBeforeBattle - 13);
  });

  it("v9 存档迁移会为所有城市补齐独立声望", () => {
    const current = createInitialGame(1107);
    const legacy = { ...current, version: 9 } as unknown as Record<string, unknown>;
    delete legacy.cityReputation;
    const migrated = migrateSavedGame(legacy);
    expect(migrated?.version).toBe(25);
    expect(Object.keys(migrated?.cityReputation ?? {})).toHaveLength(CITIES.length);
    expect(migrated?.cityReputation.linan).toBe(18);
    expect(migrated?.cityReputation.jiankang).toBe(0);
  });

  it("本地声望会解锁更丰镖榜并降低本城整备价格", () => {
    const base = createInitialGame(1107);
    const local: GameState = { ...base, currentCityId: "jiankang", selectedCityId: "jiankang", silver: 500 };
    const trusted: GameState = { ...local, cityReputation: { ...local.cityReputation, jiankang: 50 } };
    expect(cityStanding(0).label).toBe("初来乍到");
    expect(cityStanding(50).label).toBe("一方柱石");
    expect(serviceCost(trusted, "repair")).toBeLessThan(serviceCost(local, "repair"));
    expect(contractCountForCity(local.cities.jiankang, false, 25)).toBeGreaterThan(contractCountForCity(local.cities.jiankang, false, 0));
    const ordinary = generateContracts("jiankang", 14, 99, false, 3, local.cities.jiankang, 0).contracts;
    const renowned = generateContracts("jiankang", 14, 99, false, 3, local.cities.jiankang, 50).contracts;
    expect(renowned.reduce((sum, item) => sum + item.reward, 0)).toBeGreaterThan(ordinary.reduce((sum, item) => sum + item.reward, 0));
  });

  it("v10 存档迁移会补齐行院拜会日与各政权限期路引", () => {
    const current = createInitialGame(1107);
    const legacy = { ...current, version: 10 } as unknown as Record<string, unknown>;
    delete legacy.factionAudienceDay;
    delete legacy.travelPermits;
    const migrated = migrateSavedGame(legacy);
    expect(migrated?.version).toBe(25);
    expect(Object.keys(migrated?.factionAudienceDay ?? {})).toHaveLength(7);
    expect(Object.keys(migrated?.travelPermits ?? {})).toHaveLength(7);
    expect(migrated?.factionAudienceDay.song).toBe(-99);
    expect(migrated?.travelPermits.jin).toBe(0);
  });

  it("府城拜会可提升政权往来并解锁有期限的路引", () => {
    const base = createInitialGame(1107);
    const audience = factionAudienceOffer(base);
    expect(audience.factionId).toBe("song");
    expect(audience.enabled).toBe(true);
    const received = attendFactionAudience(base);
    expect(received.relations.song).toBe(18);
    expect(received.silver).toBe(base.silver - audience.cost);
    expect(factionAudienceOffer(received).cooldownDays).toBe(7);
    expect(factionStanding(received.relations.song).tier).toBe("recognized");
    const permit = factionPermitOffer(received);
    expect(permit.enabled).toBe(true);
    const licensed = acquireFactionPermit(received);
    expect(hasActivePermit(licensed, "song")).toBe(true);
    expect(licensed.travelPermits.song).toBe(licensed.day + permit.duration);
  });

  it("政权往来降低整备与通关成本，提高本地镖榜酬金", () => {
    const base = createInitialGame(1107);
    const hostile: GameState = { ...base, relations: { ...base.relations, song: -20, jin: -20 } };
    const honored: GameState = { ...base, relations: { ...base.relations, song: 40, jin: 40 } };
    expect(serviceCost(honored, "repair")).toBeLessThan(serviceCost(hostile, "repair"));
    expect(borderPassageCost(honored, "jin", true)).toBeLessThan(borderPassageCost(hostile, "jin", true));
    const ordinary = generateContracts("jiankang", 16, 101, false, 3, base.cities.jiankang, 0, 0).contracts;
    const favored = generateContracts("jiankang", 16, 101, false, 3, base.cities.jiankang, 0, 40).contracts;
    expect(favored.reduce((sum, item) => sum + item.reward, 0)).toBeGreaterThan(ordinary.reduce((sum, item) => sum + item.reward, 0));
  });

  it("有效路引会在跨境事件中提供免税验牒选项", () => {
    let game = createInitialGame(1107);
    game = { ...game, travelPermits: { ...game.travelPermits, jin: 99 } };
    game = acceptContract(game, "opening-xiangyang");
    game = chooseRoute(game, generateRoutePlans("linan", "xiangyang")[0]);
    for (let index = 0; index < 10 && game.currentEvent?.kind !== "border"; index += 1) {
      if (game.phase === "travel") game = advanceTravel(game);
      if (game.phase === "event" && game.currentEvent?.kind !== "border") game = passTravelInterruption(game);
    }
    expect(game.currentEvent?.choices.some((item) => item.id === "permit")).toBe(true);
    const silverBefore = game.silver;
    game = { ...game, journey: game.journey ? { ...game.journey, contract: { ...game.journey.contract, complication: "none" } } : null };
    game = resolveEvent(game, "permit");
    expect(game.phase).not.toBe("battle");
    expect(game.silver).toBe(silverBefore + (game.settlement?.reward ?? 0) - (game.settlement?.compensation ?? 0));
  });

  it("v11 存档迁移会补齐未领奖的生涯志业", () => {
    const current = createInitialGame(1107);
    const legacy = { ...current, version: 11 } as unknown as Record<string, unknown>;
    delete legacy.career;
    const migrated = migrateSavedGame(legacy);
    expect(migrated?.version).toBe(25);
    expect(migrated?.career).toEqual({ claimedObjectiveIds: [], endingId: null });
  });

  it("三阶志业按顺序解锁、只可领奖一次并在终印后通关", () => {
    let game: GameState = { ...createInitialGame(1107), completedContracts: 2, reputation: 35 };
    expect(careerObjectiveProgress(game)[0].status).toBe("ready");
    expect(careerObjectiveProgress(game)[1].status).toBe("locked");
    const silverBefore = game.silver;
    game = claimCareerObjective(game, "jiangnan-foundation");
    expect(game.silver).toBe(silverBefore + 45);
    expect(game.career.claimedObjectiveIds).toEqual(["jiangnan-foundation"]);
    expect(claimCareerObjective(game, "jiangnan-foundation")).toEqual(game);

    const routeIntel = { ...game.routeIntel };
    for (const routeId of Object.keys(routeIntel).slice(0, 3)) routeIntel[routeId] = { ...routeIntel[routeId], trips: 2 };
    game = {
      ...game,
      completedContracts: 4,
      routeIntel,
      offices: { ...game.offices, jiankang: { cityId: "jiankang", tier: "branch", openedDay: 9, ownerAtOpening: "song", active: true } },
    };
    expect(careerObjectiveProgress(game)[1].status).toBe("ready");
    game = claimCareerObjective(game, "trade-network");

    game = {
      ...game,
      completedContracts: 7,
      cityReputation: { ...game.cityReputation, linan: 30, jiankang: 27 },
      relations: { ...game.relations, jin: 15 },
      offices: { ...game.offices, xiangyang: { cityId: "xiangyang", tier: "branch", openedDay: 18, ownerAtOpening: "song", active: true } },
    };
    expect(careerObjectiveProgress(game)[2].status).toBe("ready");
    game = claimCareerObjective(game, "renowned-escort");
    expect(game.phase).toBe("gameover");
    expect(game.career.endingId).toBe("great-escort");
    expect(careerEnding(game)?.outcome).toBe("victory");
  });

  it("结算后才判定信用、队伍与家底败局", () => {
    const base = createInitialGame(1107);
    const collapsed = continueAfterSettlement({ ...base, phase: "settlement", reputation: 0 });
    expect(collapsed.phase).toBe("gameover");
    expect(collapsed.career.endingId).toBe("credit-collapse");

    const brokenCrew = base.crew.map((member, index) => ({ ...member, hp: index < 2 ? 30 : 0 }));
    const ruined = continueAfterSettlement({ ...base, phase: "settlement", convoy: { ...base.convoy, leaderHp: 1 }, crew: brokenCrew });
    expect(ruined.career.endingId).toBe("convoy-ruin");

    const insolvent = continueAfterSettlement({ ...base, phase: "settlement", silver: 0, supplies: 0, convoy: { ...base.convoy, cartHp: 12 } });
    expect(insolvent.career.endingId).toBe("insolvent");
    expect(continueAfterSettlement({ ...base, phase: "settlement", silver: 0, supplies: 4, convoy: { ...base.convoy, cartHp: 12 } }).phase).toBe("map");
  });

  it("四类生涯结局各自收录一件祖业传承且同局不会重复记谱", () => {
    const base = createInitialGame(1107);
    const endings = ["credit-collapse", "convoy-ruin", "insolvent", "great-escort"] as const;
    let lineage = createLegacyState();
    let finalGame = base;
    for (const [index, endingId] of endings.entries()) {
      finalGame = {
        ...base,
        phase: "gameover",
        day: 18 + index,
        completedContracts: index + 1,
        career: { claimedObjectiveIds: [], endingId },
      };
      lineage = recordLegacyEnding(lineage, finalGame);
    }
    expect(lineage.completedRuns).toBe(4);
    expect(lineage.victories).toBe(1);
    expect(lineage.bestCompletedContracts).toBe(4);
    expect(new Set(lineage.unlockedIds)).toEqual(new Set(["guarantor-letter", "veteran-token", "merchant-credit", "route-ledger"]));
    expect(recordLegacyEnding(lineage, finalGame)).toBe(lineage);
  });

  it("新局只携带所选的一项祖业效果", () => {
    const ordinary = createInitialGame(5521, "linan-guild");
    const guaranteed = createInitialGame(5521, "linan-guild", "guarantor-letter");
    const veterans = createInitialGame(5521, "linan-guild", "veteran-token");
    const funded = createInitialGame(5521, "linan-guild", "merchant-credit");
    const routed = createInitialGame(5521, "linan-guild", "route-ledger");

    expect(guaranteed.reputation).toBe(ordinary.reputation + 5);
    expect(veterans.convoy.morale).toBe(ordinary.convoy.morale + 5);
    expect(veterans.jianghuReputation).toBe(ordinary.jianghuReputation + 5);
    expect(veterans.crew.map((member) => member.experience)).toEqual(ordinary.crew.map((member) => member.experience + 35));
    expect(funded.silver).toBe(ordinary.silver + 45);
    expect(funded.supplies).toBe(ordinary.supplies + 3);

    const localRoutes = ROUTES.filter((route) => route.from === routed.currentCityId || route.to === routed.currentCityId);
    const distantRoutes = ROUTES.filter((route) => route.from !== routed.currentCityId && route.to !== routed.currentCityId);
    expect(localRoutes.every((route) => routed.routeIntel[route.id].trips >= 1 && routed.routeIntel[route.id].surveyedDay === 1)).toBe(true);
    expect(distantRoutes.some((route) => routed.routeIntel[route.id].trips === ordinary.routeIntel[route.id].trips)).toBe(true);
    expect(routed.legacyId).toBe("route-ledger");
    expect(routed.news[0]).toContain("天下旧路谱");
  });

  it("v15 存档迁移会补为未携带祖业并升级到 v22", () => {
    const current = createInitialGame(1107);
    const oldSave = { ...current, version: 15 } as unknown as Record<string, unknown>;
    delete oldSave.legacyId;
    const migrated = migrateSavedGame(oldSave);
    expect(migrated?.version).toBe(25);
    expect(migrated?.legacyId).toBeNull();
  });

  it("v12 存档迁移会补齐五类行号履历", () => {
    const current = createInitialGame(1107);
    const legacy = { ...current, version: 12 } as unknown as Record<string, unknown>;
    delete legacy.conduct;
    const migrated = migrateSavedGame(legacy);
    expect(migrated?.version).toBe(25);
    expect(migrated?.conduct).toEqual({ investigations: 0, intactSealedDeliveries: 0, escortDeliveries: 0, concealedBorders: 0, peacefulPassages: 0 });
  });

  it("v13 存档迁移会保留旧局为临安行在出身", () => {
    const current = createInitialGame(1107);
    const legacy = { ...current, version: 13 } as unknown as Record<string, unknown>;
    delete legacy.originId;
    const migrated = migrateSavedGame(legacy);
    expect(migrated?.version).toBe(25);
    expect(migrated?.originId).toBe("linan-guild");
  });

  it("v14 途中存档迁移会补为按旗稳行", () => {
    let current = createInitialGame(1107);
    current = acceptContract(current, current.contracts[0].id);
    current = purchaseTradeLot(current);
    const legacyJourney = { ...current.journey } as unknown as Record<string, unknown>;
    delete legacyJourney.stance;
    delete legacyJourney.issuerFaction;
    delete legacyJourney.expectedDestinationOwner;
    const legacy = { ...current, version: 14, journey: legacyJourney } as unknown as Record<string, unknown>;
    const migrated = migrateSavedGame(legacy);
    expect(migrated?.version).toBe(25);
    expect(migrated?.journey?.stance).toBe("steady");
    expect(migrated?.journey?.issuerFaction).toBe("song");
    expect(migrated?.journey?.expectedDestinationOwner).toBe("song");
    expect(migrated?.journey?.tradeLot).toEqual(current.journey?.tradeLot);
  });

  it("连续查明三张镖单会形成明察慎接并降低后续访查价", () => {
    let game = createInitialGame(1107);
    const initialCost = contractInvestigationCost(game);
    for (const contract of game.contracts.slice(0, 3)) game = investigateContract(game, contract.id, "inquire");
    expect(game.conduct.investigations).toBe(3);
    expect(hasPrinciple(game, "clear-eyed")).toBe(true);
    expect(contractInvestigationCost(game)).toBe(initialCost - 2);
    expect(game.news[0]).toContain("明察慎接");
  });

  it("守印与活镖风骨会改变对应酬金和后续镖榜类型", () => {
    const base = createInitialGame(1107);
    const sealed = advanceConduct(base, { intactSealedDeliveries: 2 });
    const living = advanceConduct(base, { escortDeliveries: 2 });
    const sealedContract = base.contracts.find((contract) => contract.sealRequired)!;
    const escortContract = base.contracts.find((contract) => contract.kind === "escort")!;
    expect(principleRewardMultiplier(sealed, sealedContract).multiplier).toBe(1.08);
    expect(principleRewardMultiplier(living, escortContract).multiplier).toBe(1.1);
    const ordinary = generateContracts("linan", 20, 321, false, 5, base.cities.linan, 0, 0, base.conduct).contracts;
    const renowned = generateContracts("linan", 20, 321, false, 5, base.cities.linan, 0, 0, living.conduct).contracts;
    expect(renowned.filter((contract) => contract.kind === "escort").length).toBeGreaterThan(ordinary.filter((contract) => contract.kind === "escort").length);
  });

  it("暗渡关山减少偷越耗粮，以和开路降低关费与买路银", () => {
    let border = reachOpeningBorder(true);
    border = { ...border, supplies: 10, conduct: { ...border.conduct, concealedBorders: 2 } };
    const suppliesBefore = border.supplies;
    const withoutRenown = resolveEvent({ ...border, conduct: { ...border.conduct, concealedBorders: 0 } }, "conceal");
    border = resolveEvent(border, "conceal");
    expect(border.supplies).toBe(suppliesBefore - 1);
    expect(border.relations.jin).toBe(withoutRenown.relations.jin + 1);
    expect(border.conduct.concealedBorders).toBe(3);

    const peaceful = advanceConduct(createInitialGame(1107), { peacefulPassages: 3 });
    expect(borderPassageCost(peaceful, "jin", true)).toBeLessThan(borderPassageCost(createInitialGame(1107), "jin", true));
    expect(banditTollCost(peaceful)).toBe(18);
    expect(conductPrinciples(peaceful).filter((principle) => principle.unlocked).map((principle) => principle.title)).toContain("以和开路");
  });

  it("天下视图压缩城标，密集城市标签会确定性避让", () => {
    expect(CITY_GLYPH_SCALE.close.major).toBeLessThan(CITY_GLYPH_SCALE.wide.major);
    expect(mapDetailForViewportWidth(1020)).toBe("wide");
    expect(mapDetailForViewportWidth(444)).toBe("mid");
    expect(mapDetailForViewportWidth(320)).toBe("close");
    const wide = layoutCityLabels(CITIES, { x: 90, y: 95, width: 1020, height: 573.75 }, "wide", new Set(["linan"]));
    expect(wide.linan.visible).toBe(true);
    expect(CITIES.filter((city) => city.tier === "station" && wide[city.id].visible)).toHaveLength(0);
    const tightCities = Array.from({ length: 12 }, (_, index) => ({
      ...CITIES[index % CITIES.length],
      id: `tight-${index}`,
      name: `${String.fromCharCode(30002 + index)}州府`,
      x: 500 + (index % 2),
      y: 400 + (index % 3),
      tier: "major" as const,
    }));
    const tight = layoutCityLabels(tightCities, { x: 450, y: 350, width: 100, height: 100 }, "close", new Set());
    expect(Object.values(tight).filter((item) => item.visible).length).toBeLessThan(tightCities.length);
    expect(layoutCityLabels(tightCities, { x: 450, y: 350, width: 100, height: 100 }, "close", new Set())).toEqual(tight);
    const pinned = layoutCityLabels(tightCities, { x: 450, y: 350, width: 100, height: 100 }, "close", new Set(["tight-11"]));
    expect(pinned["tight-11"].visible).toBe(true);
  });
});

describe("护车战规则", () => {
  it("受击与败倒姿态由模拟时间稳定派生并在终点收敛", () => {
    expect(battleHitPose(0, 1)).toMatchObject({ strength: 0, offsetX: 0, angle: 0, scaleX: 1, scaleY: 1 });
    expect(battleHitPose(.12, 1)).toMatchObject({ strength: 1, offsetX: -6, angle: -4.5 });
    expect(battleHitPose(.12, -1).offsetX).toBe(6);

    const start = battleDefeatPose(0, 1, "raider");
    const middle = battleDefeatPose(.2, 1, "raider");
    const finish = battleDefeatPose(4, 1, "raider");
    expect(start).toMatchObject({ progress: 0, angle: 0, alpha: 1 });
    expect(middle.progress).toBeCloseTo(.5);
    expect(middle.angle).toBeGreaterThan(60);
    expect(finish).toMatchObject({ progress: 1, angle: 80, alpha: .22 });
    expect(battleDefeatPose(.2, -1, "guard").angle).toBeLessThan(0);
    expect(battleDefeatPose(.4, 1, "leader").progress).toBeLessThan(1);
  });

  it("战斗动画同时尊重系统偏好与可复现的减弱动态预览参数", () => {
    expect(shouldReduceBattleMotion("", false)).toBe(false);
    expect(shouldReduceBattleMotion("", true)).toBe(true);
    expect(shouldReduceBattleMotion("?battle-preview=leader&reduced-motion=1", false)).toBe(true);
  });

  it("阵令、预案与关键自动行动会生成可读的战阵记功签", () => {
    const config = {
      id: "moment-feed", seed: 12, terrain: "official" as const, danger: 62, objective: "护车", enemyFaction: "测试", routeName: "官道",
      guards: [{ ...TEST_GUARDS[0], name: "鲁沧", masteryName: "镇场传令", masterySeal: "令", equipmentIds: ["watch-crossbow" as const] }],
    };
    expect(battleDoctrineMoment(battleDoctrine("iron-ring")!).title).toBe("铁桶护镖");
    expect(battleOrderMoment("guard-cart", 100001)).toMatchObject({ id: 100001, seal: "车", title: "围车固守", tone: "jade" });

    const bolt: BattleCue = { id: 3, kind: "bolt", sourceId: TEST_GUARDS[0].id, targetId: "enemy-1", fromX: 1, fromY: 2, toX: 3, toY: 4, amount: 31.4, label: "神臂样弩", ttl: .4, duration: .4 };
    expect(battleMomentFromCue(bolt, config, "advance")).toMatchObject({ seal: "弩", eyebrow: "鲁沧 · 器械自动响应", title: "神臂样弩", detail: "点杀高危敌手 · 破敌 31" });
    expect(battleMomentFromCue({ ...bolt, id: 4, label: "神臂样弩齐射" }, config, "advance")).toBeNull();
    expect(battleMomentFromCue({ ...bolt, id: 5, kind: "mastery", label: "镇场传令" }, config, "hold")).toMatchObject({ seal: "令", title: "镇场传令" });
    expect(battleMomentFromCue({ ...bolt, id: 6, kind: "banner-lost", label: undefined }, config, "hold")).toMatchObject({ tone: "danger", seal: "失", title: "风云行旗失守" });
  });

  it("老手会按岗位领悟绝活并写入自动战斗配置", () => {
    const base = createInitialGame(1107);
    const veteranCrew = base.crew.map((member) => ({ ...member, experience: 7 }));
    const guards = crewBattleGuards(veteranCrew, veteranCrew.slice(0, 3).map((member) => member.id), base.crewEquipment);
    expect(crewMasteryForRole("副镖头", 1)).toBeNull();
    expect(crewMasteryForRole("副镖头", 2)?.name).toBe("镇场传令");
    expect(guards.map((guard) => guard.masteryId)).toEqual(["deputy-command", "runner-pursuit", "driver-warden"]);
    expect(guards[2].convoyProtection).toBeLessThan(1);
    expect(guards[1].movementMultiplier).toBeGreaterThan(1);
  });

  it("镇场传令会延长换阵振奋并留下可播放的绝活提示", () => {
    const battle = createBattleSimulation({
      id: "mastery-command", seed: 8, terrain: "official", danger: 38, objective: "护车", enemyFaction: "测试", routeName: "官道",
      guards: [{ ...TEST_GUARDS[0], masteryId: "deputy-command", masteryName: "镇场传令", masterySeal: "令" }],
    });
    stepBattle(battle, { x: 0, y: 0, attack: false, rally: false, retreat: false, formation: "hold" }, .05);
    expect(battle.rally).toBeGreaterThan(5.9);
    expect(battle.guards[0].masteryPulse).toBeGreaterThan(0);
    expect(battle.cues.some((cue) => cue.kind === "mastery" && cue.label === "镇场传令")).toBe(true);
  });

  it("穿阵飞脚会自行加速追截夺镖者", () => {
    const config = { id: "mastery-pursuit", seed: 11, terrain: "official" as const, danger: 42, objective: "追镖", objectiveMode: "pursuit" as const, enemyFaction: "测试", routeName: "官道", guards: [TEST_GUARDS[0]] };
    const plain = createBattleSimulation(config);
    const runner = createBattleSimulation({ ...config, id: "mastery-pursuit-runner", guards: [{ ...TEST_GUARDS[0], masteryId: "runner-pursuit", masteryName: "穿阵飞脚", masterySeal: "疾" }] });
    for (const battle of [plain, runner]) {
      const carrier = battle.enemies[0];
      for (const enemy of battle.enemies) enemy.hp = enemy === carrier ? enemy.maxHp : 0;
      carrier.carrier = true;
      carrier.x = 490;
      carrier.y = battle.guards[0].y;
      battle.guards[0].x = 150;
    }
    stepBattle(plain, { x: 0, y: 0, attack: false, rally: false, retreat: false, formation: "advance" }, .05);
    stepBattle(runner, { x: 0, y: 0, attack: false, rally: false, retreat: false, formation: "advance" }, .05);
    expect(runner.guards[0].x).toBeGreaterThan(plain.guards[0].x);
  });

  it("阵前回生每场会自动救回一名倒地同伴", () => {
    const battle = createBattleSimulation({
      id: "mastery-revival", seed: 17, terrain: "official", danger: 42, objective: "护车", enemyFaction: "测试", routeName: "官道",
      guards: [
        { ...TEST_GUARDS[0], masteryId: "medic-revival", masteryName: "阵前回生", masterySeal: "生" },
        TEST_GUARDS[1],
      ],
    });
    battle.elapsed = 3;
    battle.guards[1].hp = 0;
    stepBattle(battle, { x: 0, y: 0, attack: false, rally: false, retreat: false }, .05);
    expect(battle.guards[1].hp).toBeGreaterThan(0);
    expect(battle.guards[0].masteryResolved).toBe(true);
    expect(battle.cues.some((cue) => cue.kind === "revive" && cue.targetId === "guard-b")).toBe(true);
  });

  it("重度承伤会确定性生成可写回名册的具体伤势", () => {
    expect(injuryForBattleDamage(17, 9, "guard-a")).toBeNull();
    expect(injuryForBattleDamage(20, 9, "guard-a")).toBe("blade-wound");

    const battle = createBattleSimulation({
      id: "injury-roll",
      seed: 9,
      terrain: "official",
      danger: 45,
      objective: "护车",
      enemyFaction: "测试山寨",
      routeName: "测试官道",
      guards: [TEST_GUARDS[0]],
    });
    battle.guards[0].hp = 0;
    const first = battleResult(battle).guardInjuries?.["guard-a"];
    const second = battleResult(battle).guardInjuries?.["guard-a"];
    expect(first).toBeTruthy();
    expect(first).toBe(second);
  });

  it("战后结算会区分无损甲等、带伤胜利与破封警告", () => {
    const config = { id: "result-card", seed: 7, terrain: "official" as const, danger: 40, objective: "护车出关", enemyFaction: "测试山寨", routeName: "测试官道", guards: TEST_GUARDS };
    const pristine = battleResultPresentation({
      outcome: "complete", elapsedHours: 3, leaderDamage: 0, guardLoss: 0, cartDamage: 1, cargoLoss: 0, sealBroken: false, guardDamage: {}, horseDamage: 0,
    }, config);
    expect(pristine).toMatchObject({ grade: "甲", tone: "victory", title: "全阵得脱" });
    const woundedGuard = battleResultPresentation({
      outcome: "complete", elapsedHours: 3, leaderDamage: 0, guardLoss: 0, cartDamage: 1, cargoLoss: 0, sealBroken: false, guardDamage: { "guard-a": 13 }, horseDamage: 0,
    }, config);
    expect(woundedGuard).toMatchObject({ grade: "乙", title: "护镖得胜" });
    const costly = battleResultPresentation({
      outcome: "complete", elapsedHours: 5, leaderDamage: 8, guardLoss: 0, cartDamage: 11, cargoLoss: 9, sealBroken: true, guardDamage: { "guard-a": 12 }, horseDamage: 4,
    }, config);
    expect(costly.grade).toBe("乙");
    expect(costly.advice).toContain("封条已经破损");
    expect(battleInjuryLabel(0)).toBe("无伤");
    expect(battleInjuryLabel(24)).toBe("负伤");
    expect(battleInjuryLabel(25)).toBe("重伤");
  });

  it("高危伏击会派夺旗手，围车令能显著压慢拔旗", () => {
    const config = {
      id: "banner-pressure", seed: 91, terrain: "official" as const, danger: 70, objective: "护住行旗",
      enemyFaction: "测试山寨", routeName: "测试官道", guards: [], morale: 76,
    };
    const advance = createBattleSimulation(config);
    const hold = createBattleSimulation({ ...config, id: "banner-pressure-hold" });
    for (const battle of [advance, hold]) {
      const raider = battle.enemies.find((enemy) => enemy.type === "banner")!;
      expect(raider).toBeTruthy();
      for (const enemy of battle.enemies) enemy.hp = enemy === raider ? enemy.maxHp : 0;
      battle.player.x = 900; battle.player.y = 50;
      raider.x = battle.banner.x;
      raider.y = battle.banner.y + 28;
    }
    for (let tick = 0; tick < 20; tick += 1) {
      stepBattle(advance, { x: 0, y: 0, attack: false, rally: false, retreat: false, formation: "advance" }, .05);
      stepBattle(hold, { x: 0, y: 0, attack: false, rally: false, retreat: false, formation: "hold" }, .05);
    }
    expect(advance.banner.captureProgress).toBeGreaterThan(hold.banner.captureProgress * 1.7);
    expect(battleThreatNotice(hold)).toMatchObject({ tone: "command", advice: "停阵正在压住夺旗手" });
  });

  it("夺旗会削弱士气，追倒夺旗手后自动复立行旗", () => {
    const battle = createBattleSimulation({
      id: "banner-recovery", seed: 92, terrain: "official", danger: 70, objective: "护住行旗",
      enemyFaction: "测试山寨", routeName: "测试官道", guards: [], morale: 76,
    });
    const raider = battle.enemies.find((enemy) => enemy.type === "banner")!;
    for (const enemy of battle.enemies) enemy.hp = enemy === raider ? enemy.maxHp : 0;
    battle.player.x = 900; battle.player.y = 50;
    raider.x = battle.banner.x;
    raider.y = battle.banner.y + 28;
    for (let tick = 0; tick < 70 && !battle.banner.stolen; tick += 1) {
      stepBattle(battle, { x: 0, y: 0, attack: false, rally: false, retreat: false, formation: "advance" }, .05);
    }
    expect(battle.banner.stolen).toBe(true);
    expect(battle.morale).toBe(54);
    expect(battleThreatNotice(battle).label).toContain("夺旗手约");
    battle.outcome = "complete";
    const lostResult = battleResult(battle);
    expect(lostResult).toMatchObject({ outcome: "partial", bannerLost: true, moraleDamage: 22 });
    expect(battleResultPresentation(lostResult, battle.config)).toMatchObject({ grade: "丙", title: "镖旗被夺" });

    battle.outcome = null;
    raider.hp = 0;
    stepBattle(battle, { x: 0, y: 0, attack: false, rally: false, retreat: false, formation: "advance" }, .05);
    expect(battle.banner).toMatchObject({ stolen: false, recovered: true, carrierId: null });
    expect(battle.morale).toBe(66);
    expect(battle.cues.some((cue) => cue.kind === "banner-recover")).toBe(true);
    expect(battleResult(battle)).toMatchObject({ bannerLost: false, bannerRecovered: true, moraleDamage: 10 });
  });

  it("镖旗失守会分别伤及商业信用、江湖声望与士气", () => {
    let game = reachOpeningBorder();
    game = resolveEvent(game, "fight");
    const moraleBefore = game.convoy.morale;
    const reputationBefore = game.reputation;
    const jianghuBefore = game.jianghuReputation;
    game = applyBattleResult(game, {
      outcome: "partial", elapsedHours: 3, leaderDamage: 0, guardLoss: 0, cartDamage: 0, cargoLoss: 0, sealBroken: false,
      guardDamage: {}, horseDamage: 0, bannerLost: true, moraleDamage: 22,
    });
    expect(game.convoy.morale).toBe(Math.max(0, moraleBefore - 32));
    expect(game.reputation).toBe(reputationBefore - 2);
    expect(game.jianghuReputation).toBe(jianghuBefore - 5);
    expect(game.news[0]).toContain("镖旗失守");
  });

  it("阵斩匪首会提升江湖声望但不混入商业信用", () => {
    let game = reachOpeningBorder();
    game = resolveEvent(game, "fight");
    const reputationBefore = game.reputation;
    const jianghuBefore = game.jianghuReputation;
    game = applyBattleResult(game, {
      outcome: "complete", elapsedHours: 3, leaderDamage: 6, guardLoss: 0, cartDamage: 1, cargoLoss: 0, sealBroken: false,
      guardDamage: {}, horseDamage: 0, enemyLeaderDefeated: true, leaderChallenges: 1,
    });
    expect(game.reputation).toBe(reputationBefore);
    expect(game.jianghuReputation).toBe(jianghuBefore + 2);
    expect(game.news[0]).toContain("阵斩匪首");
    expect(game.news[0]).toContain("声望 +2");
  });

  it("倒地后会出现收阵救人令，并由最近镖师自动拖回同伴", () => {
    const battle = createBattleSimulation({
      id: "rescue-order", seed: 93, terrain: "official", danger: 44, objective: "守住车阵",
      enemyFaction: "测试山寨", routeName: "测试官道", guards: TEST_GUARDS,
    });
    for (const enemy of battle.enemies) enemy.hp = 0;
    const fallen = battle.guards[0];
    const rescuer = battle.guards[1];
    fallen.hp = 0; fallen.x = 230; fallen.y = 250;
    rescuer.x = 252; rescuer.y = 250;
    battle.guards[2].x = 720; battle.guards[2].y = 430;
    expect(battleThreatNotice(battle)).toMatchObject({ tone: "command", advice: "可下收阵救人令" });
    const firstOrder = autoBattleInput(battle, "rescue", "reserve");
    expect(firstOrder).toMatchObject({ formation: "hold", rescue: true });
    for (let tick = 0; tick < 140 && fallen.hp <= 0; tick += 1) stepBattle(battle, autoBattleInput(battle, "rescue", "reserve"), .05);
    expect(fallen.hp).toBeGreaterThan(0);
    expect(battle.rescuedGuardIds).toContain(fallen.id);
    expect(battle.cues.some((cue) => cue.kind === "rescue" && cue.sourceId === rescuer.id && cue.targetId === fallen.id)).toBe(true);
    expect(battle.message).toContain("重新结阵");
  });

  it("医师与金疮药囊会加快自动救援并提高起身气血", () => {
    const createRescueCase = (id: string, rescuer: { id: string; name: string; role: CrewRole; healthRatio: number; power: number; equipmentIds?: EquipmentId[] }) => {
      const battle = createBattleSimulation({
        id, seed: 94, terrain: "official", danger: 44, objective: "守住车阵", enemyFaction: "测试山寨", routeName: "测试官道",
        guards: [TEST_GUARDS[0], { ...rescuer, equipmentIds: rescuer.equipmentIds ? [...rescuer.equipmentIds] : undefined }],
      });
      for (const enemy of battle.enemies) enemy.hp = 0;
      battle.guards[0].hp = 0; battle.guards[0].x = 230; battle.guards[0].y = 250;
      battle.guards[1].x = 250; battle.guards[1].y = 250;
      return battle;
    };
    const plain = createRescueCase("rescue-plain", TEST_GUARDS[1]);
    const equipped = createRescueCase("rescue-medicine", { ...TEST_GUARDS[1], equipmentIds: ["medicine-kit"] });
    const medic = createRescueCase("rescue-medic", { ...TEST_GUARDS[1], role: "医师" });
    for (let tick = 0; tick < 50; tick += 1) {
      for (const battle of [plain, equipped, medic]) stepBattle(battle, autoBattleInput(battle, "rescue", "reserve"), .05);
    }
    expect(equipped.rescueProgress).toBeGreaterThan(plain.rescueProgress);
    expect(medic.rescueProgress).toBeGreaterThan(equipped.rescueProgress);
    for (const battle of [plain, equipped, medic]) {
      for (let tick = 0; tick < 120 && battle.guards[0].hp <= 0; tick += 1) stepBattle(battle, autoBattleInput(battle, "rescue", "reserve"), .05);
    }
    expect(equipped.guards[0].hp).toBeGreaterThan(plain.guards[0].hp);
    expect(medic.guards[0].hp).toBeGreaterThan(plain.guards[0].hp);
  });

  it("活镖会作为独立单位入阵，劫人者逼近时可下自动护人令", () => {
    const battle = createBattleSimulation({
      id: "living-escort", seed: 125, terrain: "official", danger: 72, objective: "护人入城", objectiveMode: "gate-run",
      enemyFaction: "测试山寨", routeName: "测试官道", escortClient: { name: "一位沉默医师", healthRatio: .82 }, guards: TEST_GUARDS,
    });
    expect(battle.client).toMatchObject({ name: "一位沉默医师", hp: 82 });
    const hunter = battle.enemies.find((enemy) => enemy.clientHunter)!;
    expect(hunter).toBeTruthy();
    hunter.x = battle.client!.x + 72;
    hunter.y = battle.client!.y;
    expect(clientThreatened(battle)).toBe(true);
    expect(battleThreatNotice(battle)).toMatchObject({ tone: "command", advice: "可下护住活镖令" });
    expect(autoBattleInput(battle, "guard-client", "reserve")).toMatchObject({ formation: "hold", guardClient: true });
  });

  it("护住活镖令会显著降低劫人者造成的人身伤害", () => {
    const createCase = (id: string) => {
      const battle = createBattleSimulation({
        id, seed: 126, terrain: "official", danger: 72, objective: "护人入城", objectiveMode: "gate-run",
        enemyFaction: "测试山寨", routeName: "测试官道", escortClient: { name: "一名军器匠人", healthRatio: 1 }, guards: [],
      });
      const hunter = battle.enemies.find((enemy) => enemy.clientHunter)!;
      hunter.type = "archer";
      for (const enemy of battle.enemies) enemy.hp = enemy === hunter ? 999 : 0;
      hunter.maxHp = 999;
      hunter.x = battle.client!.x + 150;
      hunter.y = battle.client!.y;
      hunter.cooldown = 0;
      battle.elapsed = 3;
      return battle;
    };
    const exposed = createCase("client-exposed");
    const protectedClient = createCase("client-protected");
    resolveEnemyAttackWindow(exposed, { ...IDLE_BATTLE_INPUT, formation: "hold" });
    resolveEnemyAttackWindow(protectedClient, { x: 0, y: 0, attack: false, rally: false, guardClient: true, retreat: false, formation: "hold" });
    expect(protectedClient.client!.hp).toBeGreaterThan(exposed.client!.hp);
    expect(battleResult(exposed).clientDamage).toBeGreaterThan(battleResult(protectedClient).clientDamage ?? 0);
  });

  it("活镖战伤会写回人身状态，交出护送对象则按失镖结算", () => {
    let game = createInitialGame(1107);
    const escort = game.contracts.find((contract) => contract.kind === "escort")!;
    game = acceptContract(game, escort.id);
    game = chooseRoute(game, generateRoutePlans(escort.from, escort.to, game)[0]);
    const event = {
      id: "escort-fight", kind: "bandits" as const, eyebrow: "测试", title: "劫人", description: "测试活镖",
      choices: [{ id: "fight", label: "列阵", hint: "迎敌", tone: "danger" as const }],
    };
    game = resolveEvent({ ...game, phase: "event", currentEvent: event }, "fight");
    game = applyBattleResult(game, {
      outcome: "partial", elapsedHours: 3, leaderDamage: 0, guardLoss: 0, cartDamage: 0, cargoLoss: 0, sealBroken: false,
      guardDamage: {}, clientDamage: 28,
    });
    expect(game.journey?.escortHealth).toBe(72);
    expect(game.news.some((item) => item.includes("活镖负伤"))).toBe(true);

    const route = ROUTES.find((item) => item.from === "linan" || item.to === "linan")!;
    const to = route.from === "linan" ? route.to : route.from;
    const base = createInitialGame(1107);
    const surrender: GameState = {
      ...base,
      phase: "event",
      currentEvent: { ...event, id: "escort-surrender", choices: [{ id: "sacrifice", label: "交人", hint: "失镖" }] },
      journey: {
        contract: { ...base.contracts[0], id: "escort-loss", kind: "escort", cargo: "一名蒙面证人", from: "linan", to, allowedLoss: 0, sealRequired: false },
        plan: { id: "escort-loss-route", routeIds: [route.id], cityIds: ["linan", to], days: route.days, danger: route.danger, label: "直行", description: "测试" },
        segmentIndex: 0, startedDay: base.day, elapsedDays: 0, traveledRouteIds: [], crewIds: [...base.activeCrewIds], stance: "steady", escortHealth: 100,
      },
    };
    const lost = resolveEvent(surrender, "sacrifice");
    expect(lost.phase).toBe("settlement");
    expect(lost.journey?.escortHealth).toBe(0);
    expect(lost.settlement?.grade).toBe("失镖");
  });

  it("受损镖车会按真实车况入阵，并出现停阵抢修令", () => {
    const battle = createBattleSimulation({
      id: "damaged-cart", seed: 181, terrain: "official", danger: 48, objective: "守住断轴车", objectiveMode: "holdout", objectiveSeconds: 44,
      enemyFaction: "测试山寨", routeName: "测试官道", cartHealthRatio: .38, spareAxle: true, guards: TEST_GUARDS,
    });
    expect(Math.round(battle.cart.hp / battle.cart.maxHp * 100)).toBe(38);
    expect(battle.initialCartHp).toBe(battle.cart.hp);
    expect(battleRepairAvailable(battle)).toBe(true);
    expect(battleThreatNotice(battle)).toMatchObject({ tone: "command", advice: "可下停阵抢修令" });
    expect(autoBattleInput(battle, "repair-cart", "reserve")).toMatchObject({ formation: "hold", repair: true });
  });

  it("车把式、固轮挠钩与备用车轴会自动加快抢修并提高恢复量", () => {
    const createRepairCase = (id: string, specialist: boolean) => {
      const guard = specialist
        ? { ...TEST_GUARDS[2], equipmentIds: ["wheel-hook" as EquipmentId], masteryId: "driver-warden" as const }
        : { ...TEST_GUARDS[1] };
      const battle = createBattleSimulation({
        id, seed: 182, terrain: "official", danger: 48, objective: "守住断轴车", objectiveMode: "holdout", objectiveSeconds: 44,
        enemyFaction: "测试山寨", routeName: "测试官道", cartHealthRatio: .38, spareAxle: specialist, guards: [guard],
      });
      for (const enemy of battle.enemies) enemy.hp = 0;
      battle.guards[0].x = battle.cart.x - 22;
      battle.guards[0].y = battle.cart.y + 54;
      return battle;
    };
    const plain = createRepairCase("repair-plain", false);
    const specialist = createRepairCase("repair-specialist", true);
    for (let tick = 0; tick < 20; tick += 1) {
      stepBattle(plain, autoBattleInput(plain, "repair-cart", "reserve"), .05);
      stepBattle(specialist, autoBattleInput(specialist, "repair-cart", "reserve"), .05);
    }
    expect(specialist.repairProgress).toBeGreaterThan(plain.repairProgress * 2);
    expect(specialist.repairerId).toBe(specialist.guards[0].id);
    expect(specialist.guards[0].supportKind).toBe("repair");

    for (let tick = 0; tick < 80 && specialist.repairCount === 0; tick += 1) {
      stepBattle(specialist, autoBattleInput(specialist, "repair-cart", "reserve"), .05);
    }
    expect(specialist.repairCount).toBe(1);
    expect(specialist.cartRepairTotal).toBeGreaterThan(plain.cartRepairTotal);
    expect(specialist.cues.some((cue) => cue.kind === "repair" && cue.sourceId === specialist.guards[0].id)).toBe(true);
    const repairResult = battleResult(specialist);
    expect(repairResult).toMatchObject({ cartDamage: 0 });
    expect(repairResult.cartRepair).toBe(Math.round((specialist.cart.hp - specialist.initialCartHp) / specialist.cart.maxHp * 100));
    expect(repairResult.guardContributions?.[specialist.guards[0].id]).toMatchObject({ title: "救危护阵" });
    expect(repairResult.guardContributions?.[specialist.guards[0].id].support).toBeGreaterThan(40);
  });

  it("阵前净修复会写回持久车况，并进入沿途消息", () => {
    let game = reachOpeningBorder();
    game = { ...game, convoy: { ...game.convoy, cartHp: 38, upgrades: [...game.convoy.upgrades, "spare-axle"] } };
    game = resolveEvent(game, "fight");
    expect(game.pendingBattle).toMatchObject({ cartHealthRatio: .38, spareAxle: true });
    game = applyBattleResult(game, {
      outcome: "complete", elapsedHours: 3, leaderDamage: 0, guardLoss: 0, cartDamage: 0, cartRepair: 21, cargoLoss: 0, sealBroken: false,
      guardDamage: {}, horseDamage: 0,
    });
    expect(game.convoy.cartHp).toBe(59);
    expect(game.news.some((item) => item.includes("阵前抢修") && item.includes("21"))).toBe(true);
  });

  it("匪首或成排弓手进入弩程时会出现集中齐射令", () => {
    const guards = TEST_GUARDS.slice(0, 2).map((guard) => ({ ...guard, equipmentIds: ["arm-crossbow" as EquipmentId] }));
    const battle = createBattleSimulation({
      id: "volley-order", seed: 191, terrain: "official", danger: 72, objective: "压住弓阵", objectiveMode: "holdout", objectiveSeconds: 46,
      enemyFaction: "测试山寨", enemyLeaderName: "黑风寨二当家", routeName: "测试官道", guards,
    });
    const leader = battle.enemies.find((enemy) => enemy.type === "leader")!;
    for (const enemy of battle.enemies) enemy.hp = enemy === leader ? enemy.maxHp : 0;
    leader.x = battle.guards[0].x + 280;
    leader.y = battle.guards[0].y;
    leader.stunned = 99;
    expect(battleVolleyTarget(battle)).toBe(leader);
    expect(battleVolleyAvailable(battle)).toBe(true);
    expect(battleThreatNotice(battle)).toMatchObject({ tone: "command", advice: "可下集中齐射令" });
    expect(autoBattleInput(battle, "focus-fire", "reserve")).toMatchObject({ formation: "hold", focusFire: true });
  });

  it("集中齐射令会让持弩队员自动取准、同步发射并进入冷却", () => {
    const guards = TEST_GUARDS.slice(0, 2).map((guard) => ({ ...guard, equipmentIds: ["arm-crossbow" as EquipmentId] }));
    const battle = createBattleSimulation({
      id: "volley-execution", seed: 192, terrain: "official", danger: 72, objective: "压住弓阵", objectiveMode: "holdout", objectiveSeconds: 46,
      enemyFaction: "测试山寨", enemyLeaderName: "黑风寨二当家", routeName: "测试官道", guards,
    });
    const leader = battle.enemies.find((enemy) => enemy.type === "leader")!;
    for (const enemy of battle.enemies) enemy.hp = enemy === leader ? enemy.maxHp : 0;
    leader.x = battle.guards[0].x + 260;
    leader.y = battle.guards[0].y;
    leader.stunned = 99;
    const hpBefore = leader.hp;
    stepBattle(battle, autoBattleInput(battle, "focus-fire", "reserve"), .05);
    expect(battle.volleyTargetId).toBe(leader.id);
    expect(battle.volleyProgress).toBeGreaterThan(0);
    expect(battle.guards.every((guard) => guard.supportKind === "volley")).toBe(true);
    for (let tick = 0; tick < 120 && battle.volleyCount === 0; tick += 1) {
      stepBattle(battle, autoBattleInput(battle, "focus-fire", "reserve"), .05);
    }
    expect(battle.volleyCount).toBe(1);
    expect(leader.hp).toBeLessThan(hpBefore - 40);
    expect(leader.stunned).toBeGreaterThan(0);
    expect(battle.volleyCooldown).toBeGreaterThan(8);
    expect(battle.cues.some((cue) => cue.kind === "volley" && cue.targetId === leader.id)).toBe(true);
    expect(battle.cues.filter((cue) => cue.kind === "bolt" && cue.label === "踏张弩齐射")).toHaveLength(2);
    const result = battleResult(battle);
    expect(result.guardContributions?.[guards[0].id].damage).toBeGreaterThan(20);
    expect(result.guardContributions?.[guards[1].id].damage).toBeGreaterThan(20);
    expect(result.guardExperience?.[guards[0].id]).toBeGreaterThanOrEqual(2);
    expect(battleVolleyAvailable(battle)).toBe(false);
  });

  it("阵中记功会立即写回人物阅历，并在跨过门槛时生成晋阶消息", () => {
    let game = reachOpeningBorder();
    game = {
      ...game,
      crew: game.crew.map((member) => member.id === "lu-cang" ? { ...member, experience: 2 } : member),
    };
    game = resolveEvent(game, "fight");
    game = applyBattleResult(game, {
      outcome: "complete", elapsedHours: 3, leaderDamage: 0, guardLoss: 0, cartDamage: 0, cargoLoss: 0, sealBroken: false,
      guardDamage: {}, guardExperience: { "lu-cang": 1 },
      guardContributions: { "lu-cang": { damage: 46, support: 0, defeats: 1, title: "随阵迎敌", experience: 1 } },
    });
    expect(game.crew.find((member) => member.id === "lu-cang")?.experience).toBe(3);
    expect(crewRank(game.crew.find((member) => member.id === "lu-cang")!.experience).label).toBe("熟手");
    expect(game.news.some((item) => item.includes("战后记功") && item.includes("阅历 +1"))).toBe(true);
    expect(game.news.some((item) => item.includes("人物晋阶") && item.includes("熟手"))).toBe(true);
  });

  it("没有踏张弩时不会凭空获得齐射阵令", () => {
    const battle = createBattleSimulation({
      id: "volley-locked", seed: 193, terrain: "official", danger: 72, objective: "压住弓阵", enemyFaction: "测试山寨", enemyLeaderName: "黑风寨二当家", routeName: "测试官道", guards: TEST_GUARDS,
    });
    const leader = battle.enemies.find((enemy) => enemy.type === "leader")!;
    leader.x = battle.guards[0].x + 240;
    leader.y = battle.guards[0].y;
    expect(battleVolleyTarget(battle)).toBeUndefined();
    expect(battleVolleyAvailable(battle)).toBe(false);
  });

  it("策略指令会让镖头自动寻敌，并直接切换全队阵形", () => {
    const battle = createBattleSimulation({
      id: "auto-orders", seed: 5, terrain: "official", danger: 45, objective: "护车", enemyFaction: "测试山寨", routeName: "测试官道", guards: TEST_GUARDS,
    });
    const cutter = battle.enemies.find((enemy) => enemy.type === "cutter")!;
    const torch = battle.enemies.find((enemy) => enemy.type === "torch")!;
    for (const enemy of battle.enemies) enemy.hp = enemy === cutter || enemy === torch ? enemy.maxHp : 0;
    cutter.x = battle.player.x + 120; cutter.y = battle.player.y;
    torch.x = battle.player.x; torch.y = battle.player.y + 120;
    const horseOrder = autoBattleInput(battle, "guard-horses", "auto");
    expect(horseOrder.x).toBeGreaterThan(0);
    expect(horseOrder.formation).toBe("horses");
    stepBattle(battle, horseOrder, .05);
    expect(battle.formation).toBe("horses");
    const cartOrder = autoBattleInput(battle, "guard-cart", "reserve");
    expect(cartOrder.x).toBeLessThan(0);
    expect(cartOrder.technique).toBe(false);
    expect(cartOrder.formation).toBe("hold");
  });

  it("三种阵令拥有清晰且互不重叠的护卫阵位", () => {
    const battle = createBattleSimulation({
      id: "formation-posts", seed: 13, terrain: "official", danger: 45, objective: "护车", enemyFaction: "测试山寨", routeName: "测试官道", guards: TEST_GUARDS,
    });
    const advance = battle.guards.map((_, index) => battleGuardAnchor(battle, index, "advance"));
    const hold = battle.guards.map((_, index) => battleGuardAnchor(battle, index, "hold"));
    const horses = battle.guards.map((_, index) => battleGuardAnchor(battle, index, "horses"));
    for (const positions of [advance, hold, horses]) {
      expect(new Set(positions.map((point) => `${point.x},${point.y}`)).size).toBe(TEST_GUARDS.length);
      expect(Math.max(...positions.map((point) => point.y)) - Math.min(...positions.map((point) => point.y))).toBeGreaterThan(150);
    }
    expect(advance[1].x).toBeGreaterThan(battle.cart.x);
    expect(hold[1].x).toBeLessThan(battle.cart.x);
    expect(horses[1].x).toBeGreaterThan(battle.horse.x);
  });

  it("三套战术预案会展开不同阵位并真实改变攻防、控制与推进节奏", () => {
    const config = {
      id: "doctrine-effects", seed: 81, terrain: "official" as const, danger: 45, objective: "护车",
      martialArtId: "guard-spear" as const, enemyFaction: "测试山寨", routeName: "测试官道", guards: TEST_GUARDS,
    };
    const vanguard = createBattleSimulation(config, "goose-vanguard");
    const ironRing = createBattleSimulation(config, "iron-ring");
    const crescent = createBattleSimulation(config, "crescent-snare");

    const vanguardPosts = vanguard.guards.map((_, index) => battleGuardAnchor(vanguard, index, "advance"));
    const ironPosts = ironRing.guards.map((_, index) => battleGuardAnchor(ironRing, index, "advance"));
    const crescentPosts = crescent.guards.map((_, index) => battleGuardAnchor(crescent, index, "advance"));
    expect(vanguardPosts[0].x).toBeGreaterThan(ironPosts[0].x);
    expect(Math.max(...crescentPosts.map((point) => point.y)) - Math.min(...crescentPosts.map((point) => point.y))).toBeGreaterThan(Math.max(...ironPosts.map((point) => point.y)) - Math.min(...ironPosts.map((point) => point.y)));

    for (const battle of [vanguard, ironRing]) {
      const cutter = battle.enemies.find((enemy) => enemy.type === "cutter")!;
      for (const enemy of battle.enemies) enemy.hp = enemy === cutter ? enemy.maxHp : 0;
      battle.elapsed = 3;
      battle.player.x = 900; battle.player.y = 60;
      for (const guard of battle.guards) { guard.x = 860; guard.y = 470; }
      cutter.x = battle.horse.x + 8; cutter.y = battle.horse.y; cutter.cooldown = 0;
    }
    resolveEnemyAttackWindow(vanguard);
    resolveEnemyAttackWindow(ironRing);
    expect(ironRing.horse.hp).toBeGreaterThan(vanguard.horse.hp);

    const prepareGuardStrike = (battle: ReturnType<typeof createBattleSimulation>) => {
      const raider = battle.enemies.find((enemy) => enemy.type === "raider")!;
      for (const enemy of battle.enemies) enemy.hp = enemy === raider ? enemy.maxHp : 0;
      battle.player.x = 900; battle.player.y = 60;
      battle.guards[0].x = battle.cart.x + 30; battle.guards[0].y = battle.cart.y;
      battle.guards.slice(1).forEach((guard) => { guard.cooldown = 5; });
      raider.x = battle.guards[0].x + 20; raider.y = battle.guards[0].y;
      battle.guards[0].cooldown = 0;
      return raider;
    };
    const vanguardRaider = prepareGuardStrike(vanguard);
    const crescentRaider = prepareGuardStrike(crescent);
    const vanguardHp = vanguardRaider.hp;
    const crescentHp = crescentRaider.hp;
    stepBattle(vanguard, { x: 0, y: 0, attack: false, rally: false, retreat: false }, .05);
    stepBattle(crescent, { x: 0, y: 0, attack: false, rally: false, retreat: false }, .05);
    expect(vanguardHp - vanguardRaider.hp).toBeGreaterThan(crescentHp - crescentRaider.hp);
    expect(crescentRaider.stunned).toBeGreaterThan(.2);

    for (const battle of [vanguard, ironRing]) {
      for (const enemy of battle.enemies) enemy.hp = 0;
      battle.outcome = null;
      battle.cart.x = 145;
    }
    stepBattle(vanguard, { x: 0, y: 0, attack: false, rally: false, retreat: false, formation: "advance" }, .05);
    stepBattle(ironRing, { x: 0, y: 0, attack: false, rally: false, retreat: false, formation: "advance" }, .05);
    expect(vanguard.cart.x).toBeGreaterThan(ironRing.cart.x);
  });

  it("偃月钩连会缩短自动绝技回转时间", () => {
    const config = {
      id: "doctrine-technique", seed: 82, terrain: "official" as const, danger: 45, objective: "护车",
      martialArtId: "guard-spear" as const, enemyFaction: "测试山寨", routeName: "测试官道", guards: TEST_GUARDS,
    };
    const ordinary = createBattleSimulation(config, "goose-vanguard");
    const crescent = createBattleSimulation(config, "crescent-snare");
    for (const battle of [ordinary, crescent]) {
      const targets = battle.enemies.slice(0, 2);
      for (const enemy of battle.enemies) enemy.hp = targets.includes(enemy) ? enemy.maxHp : 0;
      targets.forEach((enemy, index) => { enemy.x = battle.player.x + 58 + index * 12; enemy.y = battle.player.y + index * 7; });
      stepBattle(battle, { x: 0, y: 0, attack: false, technique: true, rally: false, retreat: false }, .05);
    }
    expect(crescent.techniqueCooldown).toBeLessThan(ordinary.techniqueCooldown);
    expect(crescent.techniqueCooldown).toBeCloseTo(MARTIAL_ARTS["guard-spear"].techniqueCooldown * .8, 4);
  });

  it("守车与护马阵会约束镖头，不再追逐阵外远敌", () => {
    const battle = createBattleSimulation({
      id: "formation-leash", seed: 17, terrain: "official", danger: 45, objective: "护车", enemyFaction: "测试山寨", routeName: "测试官道", guards: TEST_GUARDS,
    });
    const farEnemy = battle.enemies.find((enemy) => enemy.type === "hooker")!;
    for (const enemy of battle.enemies) enemy.hp = enemy === farEnemy ? enemy.maxHp : 0;
    farEnemy.x = 830;
    farEnemy.y = 420;
    battle.player.x = 360;
    battle.player.y = 330;
    const holdAnchor = battleLeaderAnchor(battle, "hold");
    const holdOrder = autoBattleInput(battle, "guard-cart", "auto");
    expect(holdOrder.formation).toBe("hold");
    expect(holdOrder.x).toBe(holdAnchor.x - battle.player.x);
    expect(holdOrder.y).toBe(holdAnchor.y - battle.player.y);
    expect(holdOrder.attack).toBe(false);
    const advanceOrder = autoBattleInput(battle, "breakthrough", "auto");
    expect(advanceOrder.x).toBeGreaterThan(0);
  });

  it("追逐战会生成唯一夺镖者，追击令优先追人而停阵令守在车旁", () => {
    const battle = createBattleSimulation({
      id: "pursuit-orders", seed: 61, terrain: "official", danger: 52, objective: "追回镖匣", objectiveMode: "pursuit", objectiveSeconds: 34,
      recoveryLabel: "红封镖匣", pursuitCargoLoss: 28, enemyFaction: "测试山寨", routeName: "测试官道", guards: TEST_GUARDS,
    });
    const carrier = pursuitCarrier(battle)!;
    expect(battle.enemies.filter((enemy) => enemy.carrier)).toHaveLength(1);
    for (const enemy of battle.enemies) enemy.hp = enemy === carrier ? enemy.maxHp : 0;
    carrier.x = 700; carrier.y = 270;
    const holdAnchor = battleLeaderAnchor(battle, "hold");
    battle.player.x = holdAnchor.x; battle.player.y = holdAnchor.y;
    const pursuitOrder = autoBattleInput(battle, "breakthrough", "auto");
    const holdOrder = autoBattleInput(battle, "guard-cart", "auto");
    expect(pursuitOrder).toMatchObject({ formation: "advance" });
    expect(pursuitOrder.x).toBeGreaterThan(0);
    expect(holdOrder).toMatchObject({ formation: "hold", x: 0, y: 0, attack: false });
    expect(battleThreatNotice(battle).label).toContain("脱逃");
  });

  it("截倒夺镖者会立刻追回镖匣且不追加失镖损失", () => {
    const battle = createBattleSimulation({
      id: "pursuit-recover", seed: 62, terrain: "mountain", danger: 48, objective: "追回镖匣", objectiveMode: "pursuit", objectiveSeconds: 34,
      recoveryLabel: "红封镖匣", pursuitCargoLoss: 28, enemyFaction: "测试山寨", routeName: "测试山路", guards: TEST_GUARDS,
    });
    const carrier = pursuitCarrier(battle)!;
    for (const enemy of battle.enemies) enemy.hp = enemy === carrier ? 10 : 0;
    carrier.x = battle.player.x + 44; carrier.y = battle.player.y; carrier.stunned = 1;
    stepBattle(battle, autoBattleInput(battle, "breakthrough", "auto"), .05);
    expect(battle).toMatchObject({ outcome: "complete", pursuitResolved: "recovered" });
    expect(battleProgress(battle)).toBe(100);
    expect(battleResult(battle).cargoLoss).toBeLessThan(28);
    expect(battleResultPresentation(battleResult(battle), battle.config).title).toContain("已追回");
  });

  it("夺镖者越过逃口会按镖种追加损失并以部分完成结算", () => {
    const config = {
      id: "pursuit-escape", seed: 63, terrain: "official", danger: 48, objective: "追回密信", objectiveMode: "pursuit", objectiveSeconds: 34,
      recoveryLabel: "密信匣", pursuitCargoLoss: 42, enemyFaction: "测试山寨", routeName: "测试官道", guards: TEST_GUARDS,
    } as const;
    const battle = createBattleSimulation(config);
    const carrier = pursuitCarrier(battle)!;
    for (const enemy of battle.enemies) enemy.hp = enemy === carrier ? enemy.maxHp : 0;
    carrier.x = 924.5; carrier.y = 270;
    stepBattle(battle, autoBattleInput(battle, "guard-cart", "reserve"), .05);
    const result = battleResult(battle);
    expect(battle).toMatchObject({ outcome: "partial", pursuitResolved: "escaped" });
    expect(result.cargoLoss).toBeGreaterThanOrEqual(42);
    expect(battleTimeRemaining(battle)).toBe(0);
    expect(battleResultPresentation(result, battle.config).title).toBe("夺镖者逃脱");
    const retreated = createBattleSimulation({ ...config, id: "pursuit-retreat" });
    stepBattle(retreated, { x: 0, y: 0, attack: false, rally: false, retreat: true }, .05);
    expect(battleResult(retreated).cargoLoss).toBeGreaterThanOrEqual(42);
  });

  it("自动绝技只在高威胁目标进入招式范围后施展", () => {
    const battle = createBattleSimulation({
      id: "auto-technique", seed: 8, terrain: "official", danger: 45, objective: "护车", martialArtId: "severing-sabre", enemyFaction: "测试山寨", routeName: "测试官道", guards: TEST_GUARDS,
    });
    const cutter = battle.enemies.find((enemy) => enemy.type === "cutter")!;
    for (const enemy of battle.enemies) enemy.hp = enemy === cutter ? enemy.maxHp : 0;
    cutter.x = battle.player.x + 160; cutter.y = battle.player.y;
    expect(autoBattleInput(battle, "balanced", "auto").technique).toBe(true);
    expect(autoBattleInput(battle, "balanced", "reserve").technique).toBe(false);
  });

  it("不提供任何人物操作时，自动镖队也会在时限内结束战斗", () => {
    const battle = createBattleSimulation({
      id: "fully-automatic", seed: 19, terrain: "river", danger: 48, objective: "守到船来", objectiveMode: "holdout", objectiveSeconds: 18,
      enemyFaction: "测试追兵", routeName: "测试渡口", guards: TEST_GUARDS,
    });
    for (let tick = 0; tick < 500 && !battle.outcome; tick += 1) stepBattle(battle, autoBattleInput(battle, "balanced", "auto"), .05);
    expect(battle.outcome).not.toBeNull();
    expect(battle.elapsed).toBeLessThanOrEqual(18.1);
    expect(battle.defeatedEnemies).toBeGreaterThan(0);
  });

  it("两名镖师同击一敌时会自动形成阵形连携", () => {
    const battle = createBattleSimulation({
      id: "guard-coordination", seed: 902, terrain: "official", danger: 45, objective: "护车", enemyFaction: "测试山寨", routeName: "测试官道",
      guards: TEST_GUARDS.slice(0, 2),
    });
    const target = battle.enemies.find((enemy) => enemy.type === "raider")!;
    for (const enemy of battle.enemies) enemy.hp = enemy === target ? enemy.maxHp : 0;
    battle.elapsed = 3;
    battle.guards[0].x = 230; battle.guards[0].y = 250; battle.guards[0].cooldown = 0;
    battle.guards[1].x = 230; battle.guards[1].y = 290; battle.guards[1].cooldown = 0;
    target.x = 260; target.y = 270; target.hp = 120; target.maxHp = 120;
    stepBattle(battle, IDLE_BATTLE_INPUT, .05);
    const coordination = battle.cues.find((cue) => cue.kind === "coordination");
    expect(battle.coordinationCount).toBe(1);
    expect(coordination).toMatchObject({ sourceId: "guard-a", assistSourceId: "guard-b", targetId: target.id, label: "雁行夹击" });
    expect(battle.guards.every((guard) => guard.supportKind === "coordination")).toBe(true);
    expect(battleMomentFromCue(coordination!, battle.config, battle.formation)).toMatchObject({ seal: "合", title: "雁行夹击", tone: "gold" });
  });

  it("首击已经斩倒目标时仍会保留合力击破演出且不会重复扣血", () => {
    const battle = createBattleSimulation({
      id: "coordination-finisher", seed: 903, terrain: "official", danger: 45, objective: "护车", enemyFaction: "测试山寨", routeName: "测试官道",
      guards: TEST_GUARDS.slice(0, 2),
    });
    const target = battle.enemies.find((enemy) => enemy.type === "raider")!;
    for (const enemy of battle.enemies) enemy.hp = enemy === target ? 12 : 0;
    battle.elapsed = 3;
    battle.guards[0].x = 230; battle.guards[0].y = 250; battle.guards[0].cooldown = 0;
    battle.guards[1].x = 230; battle.guards[1].y = 290; battle.guards[1].cooldown = 0;
    target.x = 260; target.y = 270;
    stepBattle(battle, IDLE_BATTLE_INPUT, .05);
    expect(target.hp).toBe(0);
    expect(battle.coordinationCount).toBe(1);
    expect(battle.cues.some((cue) => cue.kind === "coordination" && cue.amount > 0)).toBe(true);
    expect(battle.guardContributions["guard-a"].damage).toBeLessThanOrEqual(12);
  });

  it("人物阅历会扩大接势窗口、缩短连携回转并提高追加伤害", () => {
    const novice = battleCoordinationTuning(0, 0);
    const veterans = battleCoordinationTuning(12, 12);
    expect(veterans.windowSeconds).toBeGreaterThan(novice.windowSeconds);
    expect(veterans.cooldownSeconds).toBeLessThan(novice.cooldownSeconds);
    expect(veterans.damageMultiplier).toBeGreaterThan(novice.damageMultiplier);
  });

  it("总镖头创造战机时副镖头会自动接势形成主副合击", () => {
    const battle = createBattleSimulation({
      id: "leader-deputy-combo", seed: 904, terrain: "official", danger: 45, objective: "护车", martialArtId: "guard-spear",
      enemyFaction: "测试山寨", routeName: "测试官道", guards: [TEST_GUARDS[0]],
      leader: { name: "沈砺", experience: 8, healthRatio: 1, power: 1.2, maxHpBonus: 0, armorMultiplier: 1, formationExperience: { advance: 0, hold: 0, horses: 0 }, equipmentIds: [], equipmentNames: [], equipmentTuning: {} },
    });
    const target = battle.enemies.find((enemy) => enemy.type === "raider")!;
    for (const enemy of battle.enemies) enemy.hp = enemy === target ? 180 : 0;
    battle.player.x = 220; battle.player.y = 270; battle.player.facingX = 1; battle.player.facingY = 0; battle.player.cooldown = 0;
    battle.guards[0].x = 225; battle.guards[0].y = 300; battle.guards[0].cooldown = 0;
    target.x = 260; target.y = 270; target.maxHp = 180;

    stepBattle(battle, { ...IDLE_BATTLE_INPUT, attack: true }, .05);

    const combo = battle.cues.find((cue) => cue.kind === "core-combo");
    expect(battle.coreComboCount).toBe(1);
    expect(battle.coreComboCooldown).toBeGreaterThan(0);
    expect(combo).toMatchObject({ sourceId: "player", assistSourceId: "guard-a", targetId: target.id, label: "双锋贯阵" });
    expect(battle.guards[0].supportKind).toBe("core-combo");
    expect(battle.guardContributions["guard-a"].damage).toBeGreaterThan(0);
    expect(battleMomentFromCue(combo!, battle.config, battle.formation)).toMatchObject({ seal: "破", title: "双锋贯阵", tone: "gold" });
    expect(battleResult(battle).leaderDeputyCombos).toBe(1);
  });

  it("主副阅历会缩短合击回转并提高副镖头接势伤害", () => {
    const novice = battleCoreComboTuning(0, 0);
    const veterans = battleCoreComboTuning(12, 12);
    expect(veterans.cooldownSeconds).toBeLessThan(novice.cooldownSeconds);
    expect(veterans.damageMultiplier).toBeGreaterThan(novice.damageMultiplier);
  });

  it("护具会增加镖师体魄并减少实际受伤", () => {
    const ordinary = createBattleSimulation({ id: "plain-armor", seed: 3, terrain: "official", danger: 40, objective: "护车", enemyFaction: "测试", routeName: "官道", guards: [TEST_GUARDS[0]] });
    const armored = createBattleSimulation({ id: "iron-armor", seed: 3, terrain: "official", danger: 40, objective: "护车", enemyFaction: "测试", routeName: "官道", guards: [{ ...TEST_GUARDS[0], maxHpBonus: 18, armorMultiplier: .5 }] });
    const prepareHit = (battle: ReturnType<typeof createBattleSimulation>) => {
      const raider = battle.enemies.find((enemy) => enemy.type === "raider")!;
      for (const enemy of battle.enemies) enemy.hp = enemy === raider ? enemy.maxHp : 0;
      battle.elapsed = 3;
      battle.player.x = 900; battle.player.y = 50;
      raider.x = battle.guards[0].x + 8; raider.y = battle.guards[0].y; raider.cooldown = 0;
    };
    prepareHit(ordinary); prepareHit(armored);
    const ordinaryBefore = ordinary.guards[0].hp;
    const armoredBefore = armored.guards[0].hp;
    resolveEnemyAttackWindow(ordinary);
    resolveEnemyAttackWindow(armored);
    expect(armored.guards[0].maxHp).toBeGreaterThan(ordinary.guards[0].maxHp);
    expect(armoredBefore - armored.guards[0].hp).toBeLessThan(ordinaryBefore - ordinary.guards[0].hp);
  });

  it("踏张弩会由自动镖师远程点杀高危目标并发出装备动画事件", () => {
    const battle = createBattleSimulation({
      id: "crossbow-support", seed: 84, terrain: "official", danger: 45, objective: "护车", enemyFaction: "测试山寨", routeName: "测试官道",
      guards: [{ ...TEST_GUARDS[0], equipmentIds: ["arm-crossbow"], equipmentNames: ["踏张弩"] }],
    });
    const cutter = battle.enemies.find((enemy) => enemy.type === "cutter")!;
    for (const enemy of battle.enemies) enemy.hp = enemy === cutter ? enemy.maxHp : 0;
    cutter.x = battle.guards[0].x + 280;
    cutter.y = battle.guards[0].y;
    battle.guards[0].supportCooldown = 0;
    const hpBefore = cutter.hp;
    stepBattle(battle, { x: 0, y: 0, attack: false, rally: false, retreat: false }, .05);
    expect(cutter.hp).toBeLessThan(hpBefore);
    expect(battle.guards[0].supportKind).toBe("crossbow");
    expect(battle.cues.some((cue) => cue.kind === "bolt" && cue.label === "踏张弩" && cue.targetId === cutter.id)).toBe(true);
    expect(battle.message).toContain("踏弩点杀");
  });

  it("精校强弩会提高自动点杀伤害、缩短回转并在战场显示谱样阶位", () => {
    const createCase = (level: number) => {
      const battle = createBattleSimulation({
        id: `crossbow-tuning-${level}`, seed: 184, terrain: "official", danger: 45, objective: "护车", enemyFaction: "测试山寨", routeName: "测试官道",
        guards: [{ ...TEST_GUARDS[0], equipmentIds: ["arm-crossbow"], equipmentNames: ["踏张弩"], equipmentTuning: { "arm-crossbow": level } }],
      });
      const cutter = battle.enemies.find((enemy) => enemy.type === "cutter")!;
      for (const enemy of battle.enemies) enemy.hp = enemy === cutter ? enemy.maxHp : 0;
      cutter.x = battle.guards[0].x + 280;
      cutter.y = battle.guards[0].y;
      battle.guards[0].supportCooldown = 0;
      stepBattle(battle, IDLE_BATTLE_INPUT, .05);
      return { battle, cue: battle.cues.find((cue) => cue.kind === "bolt")! };
    };

    const original = createCase(0);
    const masterwork = createCase(3);
    expect(masterwork.cue.amount).toBeGreaterThan(original.cue.amount);
    expect(masterwork.battle.guards[0].supportCooldown).toBeLessThan(original.battle.guards[0].supportCooldown);
    expect(masterwork.cue.label).toBe("踏张弩〔名匠〕");
  });

  it("胜阵所得神臂样弩会继承强弩点杀与集中齐射动作", () => {
    const battle = createBattleSimulation({
      id: "reward-crossbow", seed: 222, terrain: "official", danger: 72, objective: "试弩", objectiveMode: "holdout", objectiveSeconds: 40,
      enemyFaction: "测试山寨", enemyLeaderName: "寨主", routeName: "测试官道",
      guards: [{ ...TEST_GUARDS[0], equipmentIds: ["watch-crossbow"], equipmentNames: ["神臂样弩"] }],
    });
    const leader = battle.enemies.find((enemy) => enemy.type === "leader")!;
    for (const enemy of battle.enemies) enemy.hp = enemy === leader ? enemy.maxHp : 0;
    leader.x = battle.guards[0].x + 250;
    leader.y = battle.guards[0].y;
    leader.stunned = 99;
    expect(battleVolleyTarget(battle)).toBe(leader);
    expect(battleVolleyAvailable(battle)).toBe(true);
    for (let tick = 0; tick < 120 && battle.volleyCount === 0; tick += 1) {
      stepBattle(battle, autoBattleInput(battle, "focus-fire", "reserve"), .05);
    }
    expect(battle.volleyCount).toBe(1);
    expect(battle.cues.some((cue) => cue.kind === "bolt" && cue.label === "神臂样弩齐射")).toBe(true);
  });

  it("金疮药囊会自动救治阵中伤势最重者", () => {
    const battle = createBattleSimulation({
      id: "medicine-support", seed: 85, terrain: "official", danger: 45, objective: "护车", enemyFaction: "测试山寨", routeName: "测试官道",
      guards: [{ ...TEST_GUARDS[0], equipmentIds: ["medicine-kit"], equipmentNames: ["金疮药囊"] }],
    });
    for (const enemy of battle.enemies) enemy.hp = 0;
    battle.elapsed = 3.2;
    battle.player.hp = 46;
    battle.guards[0].supportCooldown = 0;
    stepBattle(battle, { x: 0, y: 0, attack: false, rally: false, retreat: false }, .05);
    expect(battle.player.hp).toBe(58);
    expect(battle.guards[0].supportKind).toBe("medicine");
    expect(battle.cues.some((cue) => cue.kind === "heal" && cue.label === "金疮药囊" && cue.targetId === "player")).toBe(true);
    expect(battle.message).toContain("稳住伤势");
  });

  it("先锋、镇车与机变战职会改变站位、护车承伤和器械回转", () => {
    const baseConfig = { id: "discipline-test", seed: 97, terrain: "official" as const, danger: 45, objective: "护车", enemyFaction: "测试山寨", routeName: "测试官道" };
    const vanguard = createBattleSimulation({ ...baseConfig, guards: [{ ...TEST_GUARDS[0], disciplineId: "vanguard", disciplineName: "踏阵先锋", movementMultiplier: 1.06, engageRangeBonus: 55 }] });
    const bulwark = createBattleSimulation({ ...baseConfig, guards: [{ ...TEST_GUARDS[0], disciplineId: "bulwark", disciplineName: "镇车执旗", movementMultiplier: .94, engageRangeBonus: -18, convoyProtection: .88 }] });
    expect(battleGuardAnchor(vanguard, 0).x).toBeGreaterThan(battleGuardAnchor(bulwark, 0).x);

    const plain = createBattleSimulation({ ...baseConfig, guards: [{ ...TEST_GUARDS[0] }] });
    const prepareCartHit = (battle: ReturnType<typeof createBattleSimulation>) => {
      const hooker = battle.enemies.find((enemy) => enemy.type === "hooker")!;
      for (const enemy of battle.enemies) enemy.hp = enemy === hooker ? enemy.maxHp : 0;
      battle.elapsed = 3;
      battle.guards[0].x = battle.cart.x;
      battle.guards[0].y = battle.cart.y + 55;
      battle.guards[0].cooldown = 10;
      hooker.x = battle.cart.x + 40;
      hooker.y = battle.cart.y;
      hooker.cooldown = 0;
    };
    prepareCartHit(plain);
    prepareCartHit(bulwark);
    resolveEnemyAttackWindow(plain);
    resolveEnemyAttackWindow(bulwark);
    expect(220 - bulwark.cart.hp).toBeLessThan(220 - plain.cart.hp);

    const responder = createBattleSimulation({
      ...baseConfig,
      guards: [{ ...TEST_GUARDS[0], disciplineId: "responder", disciplineName: "游阵策应", equipmentIds: ["arm-crossbow"], supportCooldownMultiplier: .72 }],
    });
    const target = responder.enemies.find((enemy) => enemy.type === "cutter")!;
    for (const enemy of responder.enemies) enemy.hp = enemy === target ? enemy.maxHp : 0;
    target.x = responder.guards[0].x + 280;
    target.y = responder.guards[0].y;
    responder.guards[0].supportCooldown = 0;
    stepBattle(responder, { x: 0, y: 0, attack: false, rally: false, retreat: false }, .05);
    expect(responder.guards[0].supportCooldown).toBeCloseTo(5.4 * .72, 3);
  });

  it("护马短钩与固轮挠钩会在对应阵令中打断专门威胁", () => {
    const cases = [
      { id: "horse-tool", equipmentId: "horse-tackle" as const, enemyType: "cutter" as const, formation: "horses" as const, label: "护马短钩" },
      { id: "wheel-tool", equipmentId: "wheel-hook" as const, enemyType: "hooker" as const, formation: "hold" as const, label: "固轮挠钩" },
    ];
    for (const item of cases) {
      const battle = createBattleSimulation({
        id: item.id, seed: 86, terrain: "official", danger: 45, objective: "护车", enemyFaction: "测试山寨", routeName: "测试官道",
        guards: [{ ...TEST_GUARDS[0], equipmentIds: [item.equipmentId], equipmentNames: [item.label] }],
      });
      const threat = battle.enemies.find((enemy) => enemy.type === item.enemyType)!;
      for (const enemy of battle.enemies) enemy.hp = enemy === threat ? enemy.maxHp : 0;
      battle.elapsed = 3;
      const focus = item.formation === "horses" ? battle.horse : battle.cart;
      battle.guards[0].x = focus.x + 22;
      battle.guards[0].y = focus.y;
      battle.guards[0].cooldown = 0;
      threat.x = battle.guards[0].x + 18;
      threat.y = battle.guards[0].y;
      stepBattle(battle, { x: 0, y: 0, attack: false, rally: false, retreat: false, formation: item.formation }, .05);
      expect(threat.stunned).toBeGreaterThan(.2);
      expect(battle.cues.some((cue) => cue.kind === "brace" && cue.label === item.label)).toBe(true);
    }
  });

  it("镖车抵达关口时产出成功结果", () => {
    const battle = createBattleSimulation({
      id: "test",
      seed: 9,
      terrain: "official",
      danger: 40,
      objective: "抵达关口",
      enemyFaction: "测试山寨",
      routeName: "测试官道",
      guards: TEST_GUARDS,
    });
    battle.cart.x = 841.9;
    stepBattle(battle, { x: 0, y: 0, attack: false, rally: false, retreat: false }, 0.05);
    expect(battle.outcome).toBe("complete");
  });

  it("停阵命令会让车队停止，再次发令才继续起行", () => {
    const battle = createBattleSimulation({
      id: "test-rally",
      seed: 12,
      terrain: "mountain",
      danger: 60,
      objective: "护车",
      enemyFaction: "测试山寨",
      routeName: "测试山路",
      guards: TEST_GUARDS,
    });
    const startX = battle.cart.x;
    stepBattle(battle, { x: 0, y: 0, attack: false, rally: true, retreat: false }, 0.05);
    expect(battle.rally).toBeGreaterThan(3.8);
    expect(battle.formation).toBe("hold");
    expect(battle.cart.x).toBe(startX);
    stepBattle(battle, { x: 0, y: 0, attack: false, rally: true, retreat: false }, 0.05);
    expect(battle.formation).toBe("advance");
    expect(battle.cart.x).toBeGreaterThan(startX);
  });

  it("每场战斗都会出现斩缰手，并直接攻击可见马匹", () => {
    const battle = createBattleSimulation({
      id: "cutter-test", seed: 18, terrain: "official", danger: 45, objective: "护车", enemyFaction: "测试山寨", routeName: "测试官道", guards: TEST_GUARDS,
    });
    const cutter = battle.enemies.find((enemy) => enemy.type === "cutter")!;
    for (const enemy of battle.enemies) if (enemy !== cutter) enemy.hp = 0;
    for (const guard of battle.guards) guard.hp = 0;
    battle.elapsed = 3;
    battle.player.x = 900;
    cutter.x = battle.horse.x + 8;
    cutter.y = battle.horse.y;
    cutter.cooldown = 0;
    const horseHpBefore = battle.horse.hp;
    stepBattle(battle, IDLE_BATTLE_INPUT, 0.05);
    expect(battle.horse.hp).toBe(horseHpBefore);
    expect(battleAttackIntents(battle)[0]).toMatchObject({ enemyId: cutter.id, targetId: "horse-team", actionLabel: "伏身斩缰", recommendedStrategy: "guard-horses" });
    resolveEnemyAttackWindow(battle);
    expect(battle.horse.hp).toBeLessThan(horseHpBefore);
    expect(battle.horse.tetherCut).toBe(true);
    expect(battle.message).toContain("斩缰手");
  });

  it("敌人危险起手会锁定真实目标，受控时可在命中前被自动打断", () => {
    const battle = createBattleSimulation({
      id: "attack-intent-interrupt", seed: 181, terrain: "official", danger: 48, objective: "护住马匹", enemyFaction: "测试山寨", routeName: "测试官道", guards: [],
    });
    const cutter = battle.enemies.find((enemy) => enemy.type === "cutter")!;
    for (const enemy of battle.enemies) enemy.hp = enemy === cutter ? enemy.maxHp : 0;
    battle.elapsed = 3;
    battle.player.x = 900;
    cutter.x = battle.horse.x + 8;
    cutter.y = battle.horse.y;
    cutter.cooldown = 0;
    const horseHp = battle.horse.hp;
    stepBattle(battle, IDLE_BATTLE_INPUT, .05);
    expect(battleAttackIntents(battle)[0]).toMatchObject({ targetLabel: "马匹", tone: "horse", recommendedStrategy: "guard-horses" });
    cutter.stunned = 1;
    stepBattle(battle, IDLE_BATTLE_INPUT, .05);
    expect(battleAttackIntents(battle)).toHaveLength(0);
    expect(battle.horse.hp).toBe(horseHp);
    expect(battle.horse.tetherCut).toBe(false);
  });

  it("敌招队列会区分当前已应、阵令传达中与尚未应对", () => {
    const battle = createBattleSimulation({
      id: "intent-readiness", seed: 183, terrain: "official", danger: 48, objective: "护住车马", enemyFaction: "测试山寨", routeName: "测试官道", guards: [],
    });
    const cartIntent: BattleAttackIntent = {
      enemyId: "archer-a", enemyType: "archer", targetId: "cart", targetLabel: "镖车", actionLabel: "攒弓欲射",
      fromX: 400, fromY: 200, toX: battle.cart.x, toY: battle.cart.y, progress: .4, remaining: .5, tone: "cart",
      recommendedStrategy: "guard-cart", advice: "围车可卸去冲力",
    };
    battle.formation = "advance";
    expect(battleIntentReadiness(battle, cartIntent, "balanced")).toBe("uncovered");
    expect(battleIntentReadiness(battle, cartIntent, "balanced", "guard-cart")).toBe("relaying");
    battle.formation = "hold";
    expect(battleIntentReadiness(battle, cartIntent, "guard-cart")).toBe("covered");

    const horseIntent: BattleAttackIntent = { ...cartIntent, enemyId: "cutter-a", enemyType: "cutter", targetId: battle.horse.id, targetLabel: "马匹", recommendedStrategy: "guard-horses" };
    expect(battleIntentReadiness(battle, horseIntent, "guard-cart")).toBe("uncovered");
    battle.formation = "horses";
    expect(battleIntentReadiness(battle, horseIntent, "guard-horses")).toBe("covered");
  });

  it("危险起手命中车马后会把阵令结算为应对得当或阵线失位", () => {
    const prepare = () => {
      const battle = createBattleSimulation({
        id: "defense-response", seed: 182, terrain: "official", danger: 48, objective: "护住马匹", enemyFaction: "测试山寨", routeName: "测试官道", guards: [],
      });
      const cutter = battle.enemies.find((enemy) => enemy.type === "cutter")!;
      for (const enemy of battle.enemies) enemy.hp = enemy === cutter ? enemy.maxHp : 0;
      battle.elapsed = 3;
      battle.player.x = 900;
      cutter.x = battle.horse.x + 8;
      cutter.y = battle.horse.y;
      cutter.cooldown = 0;
      return { battle, cutter };
    };
    const guarded = prepare();
    resolveEnemyAttackWindow(guarded.battle, { ...IDLE_BATTLE_INPUT, formation: "horses" });
    const counterCue = guarded.battle.cues.find((cue) => cue.kind === "counter");
    expect(guarded.battle.defenseCounters).toBe(1);
    expect(guarded.battle.defenseBreaches).toBe(0);
    expect(counterCue).toMatchObject({ sourceId: guarded.cutter.id, targetId: "horse-team", targetLabel: "马匹", actionLabel: "伏身斩缰", label: "护马卸刀" });
    expect(battleMomentFromCue(counterCue!, guarded.battle.config, guarded.battle.formation)).toMatchObject({ seal: "应", tone: "jade", title: "护马卸刀" });
    expect(battleResult(guarded.battle)).toMatchObject({ defenseCounters: 1, defenseBreaches: 0 });

    const exposed = prepare();
    resolveEnemyAttackWindow(exposed.battle, { ...IDLE_BATTLE_INPUT, formation: "advance" });
    const breachCue = exposed.battle.cues.find((cue) => cue.kind === "breach");
    expect(exposed.battle.defenseCounters).toBe(0);
    expect(exposed.battle.defenseBreaches).toBe(1);
    expect(breachCue).toMatchObject({ targetLabel: "马匹", label: "马前失位" });
    expect(battleMomentFromCue(breachCue!, exposed.battle.config, exposed.battle.formation)).toMatchObject({ seal: "破", tone: "danger", title: "马前失位" });
  });

  it("护马阵会让队员优先回援并显著降低割缰伤害", () => {
    const config = { id: "horse-guard", seed: 21, terrain: "mountain" as const, danger: 55, objective: "护马", enemyFaction: "测试山寨", routeName: "测试山路", guards: TEST_GUARDS };
    const prepare = () => {
      const battle = createBattleSimulation(config);
      const cutter = battle.enemies.find((enemy) => enemy.type === "cutter")!;
      for (const enemy of battle.enemies) if (enemy !== cutter) enemy.hp = 0;
      for (const guard of battle.guards) guard.hp = 0;
      battle.elapsed = 3;
      battle.player.x = 900;
      cutter.x = battle.horse.x + 8;
      cutter.y = battle.horse.y;
      cutter.cooldown = 0;
      return battle;
    };
    const exposed = prepare();
    resolveEnemyAttackWindow(exposed);
    const guarded = prepare();
    resolveEnemyAttackWindow(guarded, { ...IDLE_BATTLE_INPUT, formation: "horses" });
    expect(guarded.formation).toBe("horses");
    expect(guarded.horse.hp).toBeGreaterThan(exposed.horse.hp);
  });

  it("渡口战固定停阵，以等待渡船的时间作为进度与胜利条件", () => {
    const battle = createBattleSimulation({
      id: "ferry-test", seed: 24, terrain: "river", danger: 35, objective: "守到船来", enemyFaction: "测试追兵", routeName: "测试渡口", guards: TEST_GUARDS,
    });
    for (const enemy of battle.enemies) enemy.hp = 0;
    expect(battle.formation).toBe("hold");
    const startX = battle.cart.x;
    battle.elapsed = 41.98;
    stepBattle(battle, { x: 0, y: 0, attack: false, rally: false, retreat: false }, 0.05);
    expect(battle.cart.x).toBe(startX);
    expect(battleProgress(battle)).toBe(100);
    expect(battle.outcome).toBe("complete");
    expect(battleResult(battle).horseDamage).toBe(0);
  });

  it("渡口战来敌只会从岸边滩地入场，不会生成在江面上", () => {
    const battle = createBattleSimulation({
      id: "ferry-spawn", seed: 25, terrain: "river", danger: 48, objective: "守到船来", enemyFaction: "测试追兵", routeName: "测试渡口", guards: TEST_GUARDS,
    });
    expect(Math.min(...battle.enemies.map((enemy) => enemy.y))).toBeGreaterThanOrEqual(228);
    expect(Math.max(...battle.enemies.map((enemy) => enemy.y))).toBeLessThanOrEqual(474);
  });

  it("固守战会分拨增援，避免清场后空等到时限结束", () => {
    const battle = createBattleSimulation({
      id: "ferry-waves", seed: 26, terrain: "river", danger: 48, objective: "守到船来", objectiveMode: "holdout", objectiveSeconds: 20,
      enemyFaction: "测试追兵", routeName: "测试渡口", guards: TEST_GUARDS,
    });
    const initialCount = battle.enemies.length;
    for (const enemy of battle.enemies) enemy.hp = 0;
    battle.elapsed = 3.59;
    stepBattle(battle, { x: 0, y: 0, attack: false, rally: false, retreat: false }, .05);
    expect(battle.reinforcementWave).toBe(1);
    expect(battle.enemies.length).toBeGreaterThan(initialCount);
    expect(battle.enemies.slice(initialCount).every((enemy) => enemy.x >= 690 && enemy.y >= 228 && enemy.y <= 474)).toBe(true);
    expect(battle.wavePulse).toBeGreaterThan(0);
  });

  it("远程命中会留下可供渲染的箭矢事件与车身受击脉冲", () => {
    const battle = createBattleSimulation({
      id: "arrow-cue", seed: 28, terrain: "official", danger: 45, objective: "护车", enemyFaction: "测试追兵", routeName: "测试官道", guards: TEST_GUARDS,
    });
    const archer = battle.enemies.find((enemy) => enemy.type === "archer")!;
    for (const enemy of battle.enemies) enemy.hp = enemy === archer ? enemy.maxHp : 0;
    battle.elapsed = 3;
    battle.player.x = 900; battle.player.y = 60;
    for (const guard of battle.guards) { guard.x = 900; guard.y = 480; }
    archer.x = battle.cart.x + 180; archer.y = battle.cart.y; archer.cooldown = 0;
    stepBattle(battle, IDLE_BATTLE_INPUT, .05);
    expect(battleAttackIntents(battle)[0]).toMatchObject({ enemyId: archer.id, targetId: "cart", actionLabel: "攒弓欲射" });
    expect(battle.cues.some((cue) => cue.kind === "arrow")).toBe(false);
    resolveEnemyAttackWindow(battle);
    expect(battle.cues.some((cue) => cue.kind === "arrow" && cue.targetId === "cart")).toBe(true);
    expect(battle.cart.flash).toBeGreaterThan(0);
  });

  it("战场急报会优先指出斩缰手与贴车火手，供玩家换阵", () => {
    const battle = createBattleSimulation({
      id: "threat-notice", seed: 29, terrain: "official", danger: 45, objective: "护车", enemyFaction: "测试追兵", routeName: "测试官道", guards: TEST_GUARDS,
    });
    const cutter = battle.enemies.find((enemy) => enemy.type === "cutter")!;
    const torch = battle.enemies.find((enemy) => enemy.type === "torch")!;
    for (const enemy of battle.enemies) enemy.hp = enemy === cutter || enemy === torch ? enemy.maxHp : 0;
    cutter.x = battle.horse.x + 30; cutter.y = battle.horse.y;
    torch.x = battle.cart.x + 70; torch.y = battle.cart.y;
    expect(battleThreatNotice(battle).tone).toBe("horse");
    cutter.x = 800;
    expect(battleThreatNotice(battle)).toMatchObject({ tone: "cart", advice: "宜围车固守" });
  });

  it("只有明确的山寨伏击会出现唯一匪首，不会把高危巡骑误画成匪首", () => {
    const ordinary = createBattleSimulation({
      id: "no-leader", seed: 71, terrain: "official", danger: 72, objective: "护车", enemyFaction: "测试巡骑", routeName: "测试官道", guards: TEST_GUARDS,
    });
    const dangerous = createBattleSimulation({
      id: "with-leader", seed: 71, terrain: "official", danger: 60, objective: "护车", enemyFaction: "测试山寨", enemyLeaderName: "山寨匪首", routeName: "测试官道", guards: TEST_GUARDS,
    });
    expect(ordinary.enemies.some((enemy) => enemy.type === "leader")).toBe(false);
    expect(dangerous.enemies.filter((enemy) => enemy.type === "leader")).toHaveLength(1);
    const leader = dangerous.enemies.find((enemy) => enemy.type === "leader")!;
    expect(leader.maxHp).toBeGreaterThan(Math.max(...dangerous.enemies.filter((enemy) => enemy !== leader).map((enemy) => enemy.maxHp)));
  });

  it("匪首会挥旗强化群匪，强行开路则自动越过近兵执行斩首", () => {
    const battle = createBattleSimulation({
      id: "leader-command", seed: 72, terrain: "mountain", danger: 72, objective: "护车", enemyFaction: "测试山寨", enemyLeaderName: "山寨匪首", routeName: "测试山路", guards: TEST_GUARDS,
    });
    const leader = battle.enemies.find((enemy) => enemy.type === "leader")!;
    const raider = battle.enemies.find((enemy) => enemy.type === "raider")!;
    for (const enemy of battle.enemies) enemy.hp = enemy === leader || enemy === raider ? enemy.maxHp : 0;
    leader.x = 700; leader.y = 300; leader.cooldown = 0;
    raider.x = 610; raider.y = 290; raider.cooldown = 8;
    battle.elapsed = 3;
    stepBattle(battle, { x: 0, y: 0, attack: false, rally: false, retreat: false }, .05);
    expect(battle.leaderCommandCount).toBe(1);
    expect(battle.enemyCommandPulse).toBeGreaterThan(.9);
    expect(raider.rallied).toBeGreaterThan(4);
    expect(raider.cooldown).toBeLessThan(.2);
    expect(battleThreatNotice(battle)).toMatchObject({ tone: "command", advice: "可强行开路斩首" });

    leader.x = battle.player.x + 150; leader.y = battle.player.y + 95;
    raider.x = battle.player.x + 42; raider.y = battle.player.y;
    const order = autoBattleInput(battle, "breakthrough", "reserve");
    expect(order.formation).toBe("advance");
    expect(order.x).toBeGreaterThan(100);
    expect(order.y).toBeGreaterThan(60);
    expect(order.attack).toBe(false);

    leader.hp = 0;
    raider.rallied = 4;
    stepBattle(battle, { x: 0, y: 0, attack: false, rally: false, retreat: false }, .05);
    expect(battle.leaderDefeated).toBe(true);
    expect(raider.rallied).toBe(0);
    expect(raider.stunned).toBeGreaterThan(1);
    expect(battle.message).toContain("匪首旗倒");
  });

  it("匪首在局势恶化后会弃旗逼战，并以长蓄力重招锁定总镖头", () => {
    const battle = createBattleSimulation({
      id: "leader-challenge", seed: 73, terrain: "mountain", danger: 72, objective: "护车", enemyFaction: "测试山寨", enemyLeaderName: "黑风寨主", routeName: "测试山路", guards: TEST_GUARDS,
      leader: { name: "沈砚", power: 1, armorMultiplier: 1, experience: 0, formationExperience: {}, equipmentIds: [], equipmentTuning: {}, healthRatio: 1 },
    });
    const leader = battle.enemies.find((enemy) => enemy.type === "leader")!;
    const follower = battle.enemies.find((enemy) => enemy.type !== "leader")!;
    for (const enemy of battle.enemies) enemy.hp = enemy === leader || enemy === follower ? enemy.maxHp : 0;
    battle.elapsed = 9;
    battle.leaderCommandCount = 1;
    leader.hp = leader.maxHp * .6;
    leader.x = battle.player.x + 180;
    leader.y = battle.player.y;
    stepBattle(battle, IDLE_BATTLE_INPUT, .05);

    expect(battle.leaderPhase).toBe("challenge");
    expect(battle.leaderChallengeCount).toBe(1);
    expect(battle.leaderChallengePulse).toBeGreaterThan(.9);
    const challengeCue = battle.cues.find((cue) => cue.kind === "leader-challenge")!;
    expect(challengeCue).toMatchObject({ targetId: battle.player.id, label: "弃旗逼战", actionLabel: "踏阵挑战" });
    expect(battleMomentFromCue(challengeCue, battle.config, battle.formation)).toMatchObject({ tone: "danger", seal: "战", title: "弃旗逼战" });
    expect(battleThreatNotice(battle)).toMatchObject({ label: "匪首弃旗逼战", advice: "宜强行开路接战" });

    leader.x = battle.player.x + 66;
    leader.y = battle.player.y;
    leader.cooldown = 0;
    stepBattle(battle, IDLE_BATTLE_INPUT, .05);
    expect(battleAttackIntents(battle)[0]).toMatchObject({
      enemyId: leader.id,
      targetId: battle.player.id,
      targetLabel: "沈砚",
      actionLabel: "踏阵挑战",
      recommendedStrategy: "breakthrough",
    });
    expect(leader.attackWindupDuration).toBeGreaterThanOrEqual(1.15);
  });

  it("遭遇配置可以在首轮号令后提前触发匪首逼战", () => {
    const battle = createBattleSimulation({
      id: "leader-challenge-timing", seed: 731, terrain: "mountain", danger: 72, objective: "护车", enemyFaction: "测试山寨", enemyLeaderName: "黑风寨主", routeName: "测试山路", guards: TEST_GUARDS,
      enemyLeaderChallengeSeconds: 2.3,
      enemyLeaderHealthMultiplier: 1.5,
    });
    const leader = battle.enemies.find((enemy) => enemy.type === "leader")!;
    const follower = battle.enemies.find((enemy) => enemy.type !== "leader")!;
    expect(leader.maxHp).toBe(252);
    for (const enemy of battle.enemies) enemy.hp = enemy === leader || enemy === follower ? enemy.maxHp : 0;
    battle.elapsed = 2.31;
    battle.leaderCommandCount = 1;
    leader.x = battle.player.x + 190;
    leader.y = battle.player.y;

    stepBattle(battle, IDLE_BATTLE_INPUT, .05);

    expect(battle.leaderPhase).toBe("challenge");
    expect(battle.leaderChallengeCount).toBe(1);
    expect(battle.cues.some((cue) => cue.kind === "leader-challenge" && cue.label === "弃旗逼战")).toBe(true);
  });

  it("强行开路会自动迎锋化解匪首重招，失应时则按逼战破阵结算", () => {
    const battle = createBattleSimulation({
      id: "leader-counter", seed: 74, terrain: "mountain", danger: 72, objective: "护车", enemyFaction: "测试山寨", enemyLeaderName: "黑风寨主", routeName: "测试山路", guards: TEST_GUARDS,
    });
    const leader = battle.enemies.find((enemy) => enemy.type === "leader")!;
    for (const enemy of battle.enemies) enemy.hp = enemy === leader ? enemy.maxHp : 0;
    battle.elapsed = 9;
    battle.leaderPhase = "challenge";
    for (const guard of battle.guards) { guard.x = 900; guard.y = 470; guard.cooldown = 8; }
    leader.x = battle.player.x + 64;
    leader.y = battle.player.y;
    leader.cooldown = 0;

    stepBattle(battle, { ...IDLE_BATTLE_INPUT, strategy: "balanced" }, .05);
    const hpBeforeBreach = battle.player.hp;
    resolveEnemyAttackWindow(battle, { ...IDLE_BATTLE_INPUT, strategy: "balanced" });
    const breachDamage = hpBeforeBreach - battle.player.hp;
    expect(battle.defenseBreaches).toBe(1);
    expect(battle.cues.some((cue) => cue.kind === "breach" && cue.label === "逼战失应")).toBe(true);

    leader.cooldown = 0;
    leader.stunned = 0;
    stepBattle(battle, { ...IDLE_BATTLE_INPUT, strategy: "breakthrough", formation: "advance" }, .05);
    const hpBeforeCounter = battle.player.hp;
    resolveEnemyAttackWindow(battle, { ...IDLE_BATTLE_INPUT, strategy: "breakthrough", formation: "advance" });
    const counterDamage = hpBeforeCounter - battle.player.hp;
    expect(battle.defenseCounters).toBe(1);
    expect(counterDamage).toBeLessThan(breachDamage * .5);
    expect(leader.stunned).toBeGreaterThan(.8);
    expect(battle.cues.some((cue) => cue.kind === "counter" && cue.label === "迎锋破势")).toBe(true);

    leader.hp = 0;
    stepBattle(battle, IDLE_BATTLE_INPUT, .05);
    expect(battle.leaderPhase).toBe("defeated");
    expect(battleResult(battle)).toMatchObject({ enemyLeaderDefeated: true, leaderChallenges: 0 });
  });

  it("副镖头在阵时会与总镖头自动交叉截锋，并将反击与默契写入结算", () => {
    const battle = createBattleSimulation({
      id: "leader-deputy-counter", seed: 741, terrain: "mountain", danger: 72, objective: "护车", enemyFaction: "测试山寨", enemyLeaderName: "黑风寨主", routeName: "测试山路", guards: TEST_GUARDS,
      leader: { name: "沈砚", power: 1.18, armorMultiplier: 1, experience: 9, deputyBond: 7, formationExperience: {}, equipmentIds: [], equipmentTuning: {}, healthRatio: 1 },
    });
    const leader = battle.enemies.find((enemy) => enemy.type === "leader")!;
    const deputy = battle.guards.find((guard) => guard.role === "副镖头")!;
    for (const enemy of battle.enemies) enemy.hp = enemy === leader ? 300 : 0;
    leader.maxHp = 300;
    battle.elapsed = 9;
    battle.leaderPhase = "challenge";
    leader.x = battle.player.x + 64;
    leader.y = battle.player.y;
    leader.cooldown = 0;
    deputy.x = battle.player.x - 54;
    deputy.y = battle.player.y + 12;
    deputy.cooldown = 8;
    for (const guard of battle.guards) if (guard !== deputy) { guard.x = 900; guard.y = 470; guard.cooldown = 8; }

    const veteranTuning = battleCoreCounterTuning(9, 0, 7);
    expect(veteranTuning.incomingMultiplier).toBeLessThan(.34);
    expect(veteranTuning.damageMultiplier).toBeGreaterThan(.7);
    stepBattle(battle, { ...IDLE_BATTLE_INPUT, strategy: "breakthrough", formation: "advance" }, .05);
    const playerHpBefore = battle.player.hp;
    const leaderHpBefore = leader.hp;
    resolveEnemyAttackWindow(battle, { ...IDLE_BATTLE_INPUT, strategy: "breakthrough", formation: "advance" });

    const cue = battle.cues.find((item) => item.kind === "counter" && item.label === "主副截锋")!;
    expect(battle.player.hp).toBeGreaterThan(playerHpBefore - 6);
    expect(leader.hp).toBeLessThan(leaderHpBefore);
    expect(battle.coreCounterCount).toBe(1);
    expect(battle.coreCounterPulse).toBeGreaterThan(0);
    expect(deputy.supportKind).toBe("core-counter");
    expect(cue).toMatchObject({ targetId: battle.player.id, assistSourceId: deputy.id, actionLabel: "踏阵挑战" });
    expect(cue.counterAmount).toBeGreaterThan(0);
    expect(battleMomentFromCue(cue, battle.config, battle.formation)).toMatchObject({ seal: "破", title: "主副截锋", tone: "gold" });
    expect(battleResult(battle)).toMatchObject({ leaderDeputyCombos: 0, leaderDeputyCounters: 1, leaderDeputyBondGain: 2 });
  });

  it("固守战可在任何地形停阵，并以配置时限作为胜利条件", () => {
    const battle = createBattleSimulation({
      id: "holdout-test", seed: 31, terrain: "official", danger: 42, objective: "据车待援", objectiveMode: "holdout", objectiveSeconds: 18,
      enemyFaction: "测试追兵", routeName: "测试驿道", guards: TEST_GUARDS,
    });
    for (const enemy of battle.enemies) enemy.hp = 0;
    const startX = battle.cart.x;
    battle.elapsed = 17.98;
    stepBattle(battle, { x: 0, y: 0, attack: false, rally: false, retreat: false }, 0.05);
    expect(battleObjectiveMode(battle.config)).toBe("holdout");
    expect(battle.cart.x).toBe(startX);
    expect(battleProgress(battle)).toBe(100);
    expect(battleTimeRemaining(battle)).toBe(0);
    expect(battle.outcome).toBe("complete");
  });

  it("抢时入城战在城门落锁时按部分完成结算", () => {
    const battle = createBattleSimulation({
      id: "gate-run-test", seed: 37, terrain: "official", danger: 48, objective: "抢时入城", objectiveMode: "gate-run", objectiveSeconds: 12,
      enemyFaction: "测试追兵", routeName: "测试官道", guards: TEST_GUARDS,
    });
    for (const enemy of battle.enemies) enemy.hp = 0;
    battle.elapsed = 11.98;
    stepBattle(battle, { x: 0, y: 0, attack: false, rally: false, retreat: false }, 0.05);
    expect(battle.cart.x).toBeLessThan(842);
    expect(battleTimeRemaining(battle)).toBe(0);
    expect(battle.outcome).toBe("partial");
  });

  it("拒马枪绝技会一次震退车前群敌并进入冷却", () => {
    const battle = createBattleSimulation({
      id: "spear-technique", seed: 51, terrain: "official", danger: 45, objective: "护车", martialArtId: "guard-spear",
      enemyFaction: "测试山寨", routeName: "测试官道", guards: TEST_GUARDS,
    });
    const targets = battle.enemies.slice(0, 2);
    for (const enemy of battle.enemies) enemy.hp = targets.includes(enemy) ? enemy.maxHp : 0;
    targets.forEach((enemy, index) => { enemy.x = battle.player.x + 58 + index * 14; enemy.y = battle.player.y + index * 8; });
    const before = targets.map((enemy) => ({ hp: enemy.hp, x: enemy.x }));
    stepBattle(battle, { x: 0, y: 0, attack: false, technique: true, rally: false, retreat: false }, 0.05);
    expect(targets.every((enemy, index) => enemy.hp < before[index].hp && enemy.x > before[index].x)).toBe(true);
    expect(battle.techniqueCooldown).toBeGreaterThan(MARTIAL_ARTS["guard-spear"].techniqueCooldown - 0.1);
    expect(battle.message).toContain("震开 2 名");
  });

  it("断索快刀会越过近处杂兵追斩劫车能手", () => {
    const battle = createBattleSimulation({
      id: "sabre-technique", seed: 52, terrain: "mountain", danger: 55, objective: "护车", martialArtId: "severing-sabre",
      enemyFaction: "测试山寨", routeName: "测试山路", guards: TEST_GUARDS,
    });
    const cutter = battle.enemies.find((enemy) => enemy.type === "cutter")!;
    const raider = battle.enemies.find((enemy) => enemy.type === "raider")!;
    for (const enemy of battle.enemies) enemy.hp = enemy === cutter || enemy === raider ? enemy.maxHp : 0;
    cutter.x = battle.player.x + 176; cutter.y = battle.player.y;
    raider.x = battle.player.x + 48; raider.y = battle.player.y + 5;
    const playerX = battle.player.x;
    stepBattle(battle, { x: 0, y: 0, attack: false, technique: true, rally: false, retreat: false }, 0.05);
    expect(cutter.hp).toBe(0);
    expect(raider.hp).toBe(raider.maxHp);
    expect(battle.player.x).toBeGreaterThan(playerX);
    expect(battle.message).toContain("劫车能手");
  });

  it("缠拿短手会使近敌停手四息，冷却中不能连续施放", () => {
    const battle = createBattleSimulation({
      id: "binding-technique", seed: 53, terrain: "official", danger: 45, objective: "护车", martialArtId: "binding-hands",
      enemyFaction: "测试山寨", routeName: "测试官道", guards: TEST_GUARDS,
    });
    const target = battle.enemies[0];
    for (const enemy of battle.enemies) enemy.hp = enemy === target ? enemy.maxHp : 0;
    target.x = battle.player.x + 46; target.y = battle.player.y;
    const hpBefore = target.hp;
    stepBattle(battle, { x: 0, y: 0, attack: false, technique: true, rally: false, retreat: false }, 0.05);
    expect(target.stunned).toBeGreaterThan(4);
    const hpAfterTechnique = target.hp;
    expect(hpAfterTechnique).toBeLessThan(hpBefore);
    const positionAfterTechnique = { x: target.x, y: target.y };
    stepBattle(battle, { x: 0, y: 0, attack: false, technique: true, rally: false, retreat: false }, 0.05);
    expect(target.hp).toBe(hpAfterTechnique);
    expect({ x: target.x, y: target.y }).toEqual(positionAfterTechnique);
  });

  it("火手会绕开镖师直取车篷与镖物", () => {
    const battle = createBattleSimulation({
      id: "torch-test", seed: 41, terrain: "mountain", danger: 55, objective: "护车", objectiveMode: "breakthrough",
      enemyFaction: "测试山寨", routeName: "测试山路", guards: TEST_GUARDS,
    });
    const torch = battle.enemies.find((enemy) => enemy.type === "torch")!;
    for (const enemy of battle.enemies) if (enemy !== torch) enemy.hp = 0;
    for (const guard of battle.guards) guard.hp = 0;
    battle.elapsed = 3;
    torch.x = battle.cart.x + 8;
    torch.y = battle.cart.y;
    torch.cooldown = 0;
    const cargoBefore = battle.cart.cargo;
    stepBattle(battle, IDLE_BATTLE_INPUT, 0.05);
    expect(battle.cart.cargo).toBe(cargoBefore);
    expect(battleAttackIntents(battle)[0]).toMatchObject({ enemyId: torch.id, targetId: "cart", actionLabel: "引火掷车", recommendedStrategy: "guard-cart" });
    resolveEnemyAttackWindow(battle);
    expect(battle.cart.cargo).toBeLessThan(cargoBefore);
    expect(battle.message).toContain("火手");
  });
});
