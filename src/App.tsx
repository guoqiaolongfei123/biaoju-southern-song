import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { CITIES, FACTIONS, ROUTES, TERRAIN_LABEL, cityById, routeById } from "./core/data";
import { CONTRACT_KIND_LABEL, CONTRACT_KIND_SEAL, CONTRACT_PATRON_LABEL } from "./core/content";
import { CONVOY_UPGRADES, HORSE_TEAMS, WAGONS } from "./core/convoyContent";
import {
  acceptContract,
  acquireFactionPermit,
  advanceTravel,
  applyBattleResult,
  attendFactionAudience,
  cancelContractPlanning,
  chooseRoute,
  cityAidOffer,
  callInContactFavor,
  claimCareerObjective,
  continueAfterSettlement,
  createInitialGame,
  createWorldActorEvent,
  departureReadinessForPlan,
  deputyDispatchBoard,
  deputyDispatchCrewIds,
  establishOffice,
  factionAudienceOffer,
  factionPermitOffer,
  generateRoutePlans,
  hasActivePermit,
  horseTeamPurchaseCost,
  contractInvestigationCost,
  contractNegotiationOffer,
  contactFavorOffer,
  investigateContract,
  negotiateContract,
  investigateRoute,
  journeyDispositionOptions,
  localContacts,
  officeActionOffer,
  purchaseService,
  purchaseTradeLot,
  purchaseConvoyUpgrade,
  purchaseHorseTeam,
  purchaseWagon,
  preferredDeparturePlanId,
  recruitCrew,
  resolveEvent,
  routeInvestigationCost,
  routePlanInsight,
  routePlanTravelForecast,
  replanJourneyAtStopover,
  resolveJourneyDisposition,
  segmentTravelForecast,
  serviceCost,
  setTravelCover,
  setTravelStance,
  setMartialArt,
  supplyPurchaseAmount,
  supportCurrentCity,
  startDeputyDispatch,
  stopoverRouteOptions,
  tradeOffer,
  toggleJourneyCrew,
  convoyUpgradePurchaseCost,
  wagonPurchaseCost,
} from "./core/game";
import { rankContractsForBoard, type ContractBoardAssessment } from "./core/contractBoard";
import { CREW_CAPACITY, crewRank } from "./core/crewContent";
import { cityStanding, cityStandingProgress, cityStatusEffect, contractCountForCity } from "./core/cityContent";
import { cityActionPriority, type CityWorkspaceTab } from "./core/cityDashboard";
import { ROUTE_CONDITION_EFFECTS } from "./core/routeContent";
import { landmarksForPlan, primaryLandmarkForRoute, routeLandmarkKind } from "./core/routeLandmarkContent";
import { factionStanding, factionStandingProgress } from "./core/factionContent";
import { careerEnding, careerObjectiveProgress } from "./core/careerContent";
import { conductPrinciples } from "./core/conductContent";
import { ORIGIN_LIST, originById } from "./core/originContent";
import { TRAVEL_STANCE_LIST, travelStanceById } from "./core/travelContent";
import { TRAVEL_COVER_LIST, routeBorderFactions, travelCoverAssessment, travelCoverById } from "./core/travelCoverContent";
import { TRADE_GOODS } from "./core/tradeContent";
import { MARTIAL_ART_LIST, martialArtById } from "./core/martialContent";
import { specialHandlingForContract } from "./core/specialContractContent";
import { contractIncidentEvent } from "./core/contractIncidentContent";
import { LEGACY_BOON_LIST, createLegacyState, recordLegacyEnding } from "./core/legacyContent";
import { CREW_DISCIPLINES } from "./core/crewDisciplineContent";
import { CREW_MASTERIES, crewMasteryForRole } from "./core/crewMasteryContent";
import { createCrewInjury, crewInjuryById } from "./core/injuryContent";
import { EQUIPMENT } from "./core/equipmentContent";
import { deputyBondRank } from "./core/deputyBondContent";
import { frontlineSituation } from "./core/frontlineContent";
import { weatherForCity } from "./core/weatherContent";
import { jianghuRecruitmentCost, jianghuStanding, jianghuStandingProgress } from "./core/jianghuContent";
import { rivalBureauViews, rivalRank } from "./core/rivalContent";
import { updateRouteInfluence } from "./core/roadPowerContent";
import { contactFavorTier, contactId, contactPatronProfile, MAX_CONTACT_FAVOR } from "./core/contactContent";
import { clearSave, loadGame, loadLegacy, saveGame, saveLegacy } from "./core/save";
import type { JourneyDispositionId } from "./core/game";
import type { BattleConfig, CareerEndingId, Contract, ContractNegotiationId, CoreCombatFocusId, CrewDisciplineId, CrewMasteryId, EquipmentId, FactionId, GameState, LegacyId, LegacyState, MartialArtId, OriginId, RoutePlan } from "./core/types";
import { routeCandidateSeal, type MapRouteCandidate } from "./map/routeComparison";
import CrewEquipmentPanel from "./components/CrewEquipmentPanel";
import LeaderProgressionPanel from "./components/LeaderProgressionPanel";
import CoreCombatFocusPicker from "./components/CoreCombatFocusPicker";
import AudioToggle from "./components/AudioToggle";
import JourneyChronicle from "./components/JourneyChronicle";
import { useGameAudio } from "./audio/useGameAudio";

type LaunchState = "loading" | "title" | "setup" | "game";
const CITY_WORKSPACE_TABS: Array<{ id: CityWorkspaceTab; seal: string; label: string; note: string }> = [
  { id: "overview", seal: "城", label: "城情", note: "局势与网点" },
  { id: "contracts", seal: "镖", label: "接镖", note: "委托与查验" },
  { id: "prepare", seal: "备", label: "整备", note: "人车与行装" },
  { id: "crew", seal: "人", label: "人物", note: "养成与招募" },
];
const PhaserBattle = lazy(() => import("./battle/PhaserBattle"));
const WorldMap = lazy(() => import("./components/WorldMap"));

function developmentBattlePreviewId(): string | null {
  if (typeof window === "undefined" || !["localhost", "127.0.0.1"].includes(window.location.hostname)) return null;
  return new URLSearchParams(window.location.search).get("battle-preview");
}

function developmentCoreCombatFocusId(): CoreCombatFocusId | null {
  if (typeof window === "undefined" || !["localhost", "127.0.0.1"].includes(window.location.hostname)) return null;
  const focus = new URLSearchParams(window.location.search).get("core-focus");
  return focus === "paired-assault" || focus === "cross-guard" || focus === "leader-hunt" ? focus : null;
}

function developmentMartialArtId(): MartialArtId | null {
  if (typeof window === "undefined" || !["localhost", "127.0.0.1"].includes(window.location.hostname)) return null;
  const martialArt = new URLSearchParams(window.location.search).get("martial-art");
  return martialArt === "guard-spear" || martialArt === "severing-sabre" || martialArt === "binding-hands" ? martialArt : null;
}

function developmentBattlePreviewGame(game: GameState): GameState {
  if (developmentBattlePreviewId() !== "growth" || game.phase !== "battle" || !game.pendingBattle) return game;
  const experience = [2, 6, 11];
  const battleCrewIds = game.pendingBattle.guards.map((guard) => guard.id);
  return {
    ...game,
    crew: game.crew.map((member) => {
      const index = battleCrewIds.indexOf(member.id);
      return index >= 0 ? { ...member, experience: experience[index] ?? 2 } : member;
    }),
  };
}

function developmentBattlePreview(config: BattleConfig): BattleConfig {
  const preview = developmentBattlePreviewId();
  if (!preview) return config;
  if (preview === "pursuit") return {
      ...config,
      objective: "截住夺镖者，追回红封镖匣",
      objectiveMode: "pursuit",
      objectiveSeconds: 34,
      objectiveNote: "夺镖者正向右侧路口脱逃；分队追镖会自动集中追击，围车则保住余货。",
      recoveryLabel: "红封镖匣",
      pursuitCargoLoss: 28,
    };
  if (preview === "banner") return {
      ...config,
      danger: Math.max(70, config.danger),
      morale: 76,
      objective: "护住车马与风云行旗",
      objectiveMode: "breakthrough",
      objectiveSeconds: 68,
      objectiveNote: "夺旗手会绕过正面直取风云行旗；临机应变会自动护旗，围车能压慢拔旗，若旗已被夺则强行开路会派快手越阵追截。",
    };
  if (preview === "client") return {
      ...config,
      danger: Math.max(68, config.danger),
      objective: "护送一位沉默医师抢时入城",
      objectiveMode: "gate-run",
      objectiveSeconds: 46,
      objectiveNote: "劫人者会绕过车阵直取活镖；危急时临机令会变为「护住活镖」，镖头与趟子手会自动收拢阵形、优先截住劫人者。",
      escortClient: { name: "一位沉默医师", healthRatio: .82 },
    };
  if (preview === "boarder") return {
      ...config,
      danger: 58,
      objective: "识破攀车手，护住车尾货封",
      objectiveMode: "breakthrough",
      objectiveSeconds: 58,
      objectiveNote: "攀车者会先借轮翻上车尾，再以第二招撬封夺货。保持开路可观察完整失守过程；改下围车固守后，车把式与固轮挠钩会自动将他掀落。",
      enemyLeaderName: undefined,
      boarderHealthMultiplier: 3,
      cartHealthRatio: .94,
      cargoProtection: 1,
      leader: { ...(config.leader ?? { name: "沈砺", experience: 9, healthRatio: 1, power: 1 }), power: .16 },
      guards: config.guards.map((guard, index) => index === 0
        ? { ...guard, power: .14, role: "车把式", equipmentIds: [...new Set([...(guard.equipmentIds ?? []), "wheel-hook" as EquipmentId])], equipmentNames: [...new Set([...(guard.equipmentNames ?? []), "固轮挠钩"])] }
        : { ...guard, power: .1 }),
    };
  if (preview === "defense") return {
      ...config,
      danger: 64,
      objective: "识破起手，以阵令护住车马",
      objectiveMode: "holdout",
      objectiveSeconds: 44,
      objectiveNote: "弓手、斩缰手、钩索手与火手会先公开目标；命中时系统将阵令结算为「应」或「破」。围车接车招、护马接割缰，刻意不换阵则可观察失位反馈。",
      cartHealthRatio: .92,
      horseHealthRatio: .92,
      enemyLeaderName: undefined,
    };
  if (preview === "rear") return {
      ...config,
      danger: 72,
      objective: "识破背袭，主副换位脱出合围",
      objectiveMode: "holdout",
      objectiveSeconds: 36,
      objectiveNote: "敌手从总镖头前后同时贴近；人物会判定身后近敌、静止时也持续校正朝向，三面受敌则边迎敌边侧退。副镖头在近侧会自动插入背袭路线。",
      enemyLeaderName: undefined,
      leader: { ...(config.leader ?? { name: "沈砺", experience: 9, healthRatio: 1, power: 1.2 }), power: 1.18 },
      guards: config.guards.map((guard, index) => index === 0
        ? { ...guard, role: "副镖头", power: 1.22, experience: Math.max(9, guard.experience ?? 0) }
        : guard),
    };
  if (preview === "repair") return {
      ...config,
      danger: Math.max(64, config.danger),
      objective: "守住断轴镖车，掩护车把式抢修",
      objectiveMode: "holdout",
      objectiveSeconds: 44,
      objectiveNote: "镖车带伤入阵；车况危急时临机令会变为「停阵抢修」。下令后车把式会自动脱阵修车，固轮挠钩与备用车轴会加快修复并提高恢复量。",
      cartHealthRatio: .38,
      spareAxle: true,
      guards: config.guards.map((guard, index) => index === 0
        ? { ...guard, role: "车把式", equipmentIds: [...new Set([...(guard.equipmentIds ?? []), "wheel-hook" as EquipmentId])], equipmentNames: [...new Set([...(guard.equipmentNames ?? []), "固轮挠钩"])] }
        : guard),
    };
  if (preview === "rescue") return {
      ...config,
      danger: Math.max(72, config.danger),
      objective: "救回倒地同伴",
      objectiveMode: "holdout",
      objectiveSeconds: 48,
      objectiveNote: "前排镖师已在伏击中倒地，临机令会变为「收阵救人」。下令后最近人手会自动脱阵拖回，医师与金疮药囊能更快完成救援。",
      downedGuardIds: config.guards.slice(0, 1).map((guard) => guard.id),
      guards: config.guards.map((guard, index) => index === 0
        ? { ...guard, injuryName: "伏击倒地" }
        : index === 1
          ? { ...guard, role: "医师", equipmentIds: [...new Set([...(guard.equipmentIds ?? []), "medicine-kit" as EquipmentId])], equipmentNames: [...new Set([...(guard.equipmentNames ?? []), "金疮药囊"])] }
        : guard),
    };
  if (preview === "volley") return {
      ...config,
      danger: 64,
      objective: "压住坡上弓阵，截断匪首号令",
      objectiveMode: "holdout",
      objectiveSeconds: 46,
      objectiveNote: "匪首与成排弓手进入弩程时，临机令会变为「集中齐射」。下令后持踏张弩的队员自动停阵取准、同步齐发，其他人仍围车迎敌。",
      enemyLeaderName: "黑风寨二当家",
      guards: config.guards.map((guard, index) => index < 2
        ? { ...guard, equipmentIds: [...new Set([...(guard.equipmentIds ?? []), "arm-crossbow" as EquipmentId])], equipmentNames: [...new Set([...(guard.equipmentNames ?? []), "踏张弩"])] }
        : guard),
    };
  if (preview === "growth") {
    const loadouts: EquipmentId[][] = [["arm-crossbow"], ["medicine-kit"], ["wheel-hook"]];
    const names = [["踏张弩"], ["金疮药囊"], ["固轮挠钩"]];
    const experience = [2, 6, 11];
    return {
      ...config,
      danger: 58,
      objective: "守住车阵，按阵中功劳记名晋阶",
      objectiveMode: "holdout",
      objectiveSeconds: 28,
      objectiveNote: "镖师将自行迎敌、点杀、救治与护车；战后按真实输出、援护和击破记功。此演示中三人都临近晋阶，只需决定阵法与护卫重点。",
      enemyLeaderName: "截道悍匪首领",
      cartHealthRatio: .66,
      guards: config.guards.map((guard, index) => ({
        ...guard,
        experience: experience[index] ?? 2,
        role: index === 2 ? "车把式" : guard.role,
        healthRatio: index === 1 ? Math.min(guard.healthRatio, .68) : guard.healthRatio,
        equipmentIds: loadouts[index] ?? loadouts[2],
        equipmentNames: names[index] ?? names[2],
      })),
    };
  }
  if (preview === "coordination") {
    const weapons: EquipmentId[][] = [["jujube-spear", "leather-jacket"], ["yanling-sabre"], ["jujube-spear"]];
    const names = [["枣木长枪", "皮札护身"], ["雁翎腰刀"], ["枣木长枪"]];
    const experience = [12, 9, 8];
    return {
      ...config,
      danger: 58,
      objective: "护车破阵，检验老手接势",
      objectiveMode: "breakthrough",
      objectiveSeconds: 68,
      objectiveNote: "两名镖师压住同一敌手时，近侧同伴会自行接势，依当前阵形使出夹击、护阵或护马合围；人物阅历越深，连携回转越快、追加攻势越强。",
      enemyLeaderName: "铁尺帮压阵头领",
      martialArtId: "severing-sabre",
      cartHealthRatio: 1,
      horseHealthRatio: 1,
      guards: config.guards.map((guard, index) => ({
        ...guard,
        experience: experience[index] ?? 8,
        equipmentIds: weapons[index] ?? weapons[0],
        equipmentNames: names[index] ?? names[0],
      })),
    };
  }
  if (preview === "bond") return {
      ...config,
      danger: 62,
      objective: "主副并肩，守住江北驿渡",
      objectiveMode: "holdout",
      objectiveSeconds: 16,
      objectiveNote: "总镖头创造战机后，副镖头会自动接势；本场会把主副默契、合击回转、战中蓄势与战后成长完整呈现。玩家只负责阵令策略。",
      leader: { ...(config.leader ?? { name: "沈砺", experience: 9, healthRatio: 1, power: 1.32 }), deputyBond: 7 },
      guards: config.guards.map((guard, index) => index === 0 ? { ...guard, role: "副镖头", experience: 10, healthRatio: 1, power: 1.34 } : guard),
    };
  if (preview === "equipment") {
    const loadouts: EquipmentId[][] = [["arm-crossbow", "rattan-shield"], ["medicine-kit", "horse-tackle"], ["wheel-hook"]];
    const names = [["踏张弩", "浸油藤牌"], ["金疮药囊", "护马短钩"], ["固轮挠钩"]];
    const disciplineIds: CrewDisciplineId[] = ["vanguard", "responder", "bulwark"];
    const masteryIds: CrewMasteryId[] = ["deputy-command", "runner-pursuit", "driver-warden"];
    return {
      ...config,
      danger: Math.max(62, config.danger),
      objective: "护住车阵，检验器械支援",
      objectiveNote: "踏张弩会自动点杀高危目标，药囊会救治重伤同伴；围车与护马阵会分别催动固轮挠钩、藤牌和护马短钩。",
      guards: config.guards.map((guard, index) => {
        const discipline = CREW_DISCIPLINES[disciplineIds[index] ?? "bulwark"];
        const mastery = CREW_MASTERIES[masteryIds[index] ?? "driver-warden"];
        return {
          ...guard,
          healthRatio: index === 0 ? Math.min(guard.healthRatio, .58) : guard.healthRatio,
          equipmentIds: loadouts[index] ?? loadouts[2],
          equipmentNames: names[index] ?? names[2],
          disciplineId: discipline.id,
          disciplineName: discipline.name,
          masteryId: mastery.id,
          masteryName: mastery.name,
          masterySeal: mastery.seal,
          movementMultiplier: discipline.modifiers.speed,
          supportCooldownMultiplier: discipline.modifiers.supportCooldown,
          engageRangeBonus: discipline.modifiers.engageRange,
          convoyProtection: discipline.modifiers.convoyProtection,
        };
      }),
    };
  }
  if (preview === "refinement") {
    const loadouts: EquipmentId[][] = [["watch-crossbow", "black-lacquer-shield"], ["field-medicine-chest"], ["wheel-hook", "frontier-hook-spear"]];
    const names = [["神臂样弩〔名匠〕", "黑漆团牌〔精校〕"], ["行军针药匣〔精校〕"], ["固轮挠钩〔修整〕", "朔边钩镰枪〔修整〕"]];
    const tuning = [
      { "watch-crossbow": 3, "black-lacquer-shield": 2 },
      { "field-medicine-chest": 2 },
      { "wheel-hook": 1, "frontier-hook-spear": 1 },
    ] satisfies Array<Partial<Record<EquipmentId, number>>>;
    return {
      ...config,
      danger: 72,
      objective: "以精校器械守住渡口车阵",
      objectiveMode: "holdout",
      objectiveSeconds: 46,
      objectiveNote: "名匠弩会更快点杀并提高齐射伤害，精校药匣会加强自动救治，修整挠钩则提高护车与抢修效率；玩家仍只需决定围车、护马或强攻。",
      enemyLeaderName: "夺器悍匪首领",
      cartHealthRatio: .58,
      spareAxle: true,
      guards: config.guards.map((guard, index) => ({
        ...guard,
        healthRatio: index === 1 ? Math.min(guard.healthRatio, .54) : guard.healthRatio,
        equipmentIds: loadouts[index] ?? loadouts[2],
        equipmentNames: names[index] ?? names[2],
        equipmentTuning: tuning[index] ?? tuning[2],
      })),
    };
  }
  if (preview === "injury") return {
      ...config,
      danger: 62,
      objective: "带伤护车，撑过江北驿渡",
      objectiveMode: "holdout",
      objectiveSeconds: 42,
      objectiveNote: "总镖头带着内伤出阵，攻势、移速、承伤与绝技回转均会按持续伤势结算；玩家仍只负责阵令策略。",
      leader: {
        name: "沈砺", experience: 8, healthRatio: .54, power: 1.18, maxHpBonus: 8, armorMultiplier: 1.1,
        formationExperience: { advance: 3, hold: 7, horses: 1 }, equipmentIds: ["jujube-spear", "leather-jacket"], equipmentNames: ["枣木长枪", "皮札护身"],
        injuryName: "内伤郁结", movementMultiplier: .9, techniqueCooldownMultiplier: 1.16, deputyBond: 7,
      },
    };
  if (preview === "leader") return {
      ...config,
      danger: Math.max(72, config.danger),
      enemyLeaderName: "山寨匪首",
      objective: "护住车阵，截断匪首号令",
      objectiveMode: "breakthrough",
      objectiveSeconds: 72,
      objectiveNote: "匪首先在后阵挥旗强化群匪；局势不利时会弃旗逼战、直取总镖头。重招提前显形，强行开路会让主副核心自动迎锋破势并优先斩首。",
    };
  if (preview === "leader-counter") return {
      ...config,
      danger: 96,
      enemyLeaderName: "黑风寨主",
      enemyLeaderChallengeSeconds: 2.3,
      enemyLeaderHealthMultiplier: 2.4,
      objective: "诱使匪首逼战，检验主副截锋",
      objectiveMode: "holdout",
      objectiveSeconds: 34,
      objectiveNote: "匪首会尽早弃旗直取总镖头；提前下强行开路令，副镖头将自动插入重招、与主角交叉反击。盾牌精校也会参与卸力。",
      leader: { ...(config.leader ?? { name: "沈砺", experience: 9, healthRatio: 1, power: 1 }), power: .16, deputyBond: 7 },
      guards: config.guards.map((guard, index) => index === 0
        ? { ...guard, role: "副镖头", power: .14, experience: 10, equipmentIds: ["black-lacquer-shield" as EquipmentId], equipmentNames: ["黑漆团牌〔精校〕"], equipmentTuning: { "black-lacquer-shield": 2 } }
        : { ...guard, power: .1 }),
    };
  return config;
}

function developmentBattleFixture(): BattleConfig | null {
  const preview = developmentBattlePreviewId();
  if (!preview) return null;
  const base: BattleConfig = {
    id: `development-battle-${preview}`,
    seed: 1208,
    terrain: preview === "pursuit" || preview === "leader" || preview === "leader-counter" ? "mountain" : preview === "client" ? "official" : "river",
    danger: 68,
    objective: "守住江北驿渡，截断悍匪号令",
    objectiveMode: "holdout",
    objectiveSeconds: 50,
    objectiveNote: "这场开发预览集中展示阵令传递、人物绝活与胜阵精品的自动战斗反馈。玩家只需切换阵策，不直接操控人物出招。",
    enemyFaction: "襄阳道截镖悍匪",
    enemyLeaderName: "铁算盘焦魁",
    routeName: "襄阳北驿",
    vehicleName: "榫甲大车",
    horseName: "川峡健骡",
    cartArmor: .84,
    cartHealthRatio: .72,
    spareAxle: true,
    cargoProtection: .9,
    horseProtection: .9,
    horseHealthRatio: .86,
    morale: 78,
    martialArtId: "guard-spear",
    leader: {
      name: "沈砺", experience: 9, healthRatio: 1, power: 1.32, maxHpBonus: 10, armorMultiplier: .92,
      formationExperience: { advance: 7, hold: 5, horses: 3 }, equipmentIds: ["jujube-spear", "leather-jacket"], equipmentNames: ["枣木长枪", "皮札护身"], deputyBond: 7, martialArtExperience: 15,
    },
    guards: [
      {
        id: "lu-cang", name: "鲁沧", role: "副镖头", experience: 12, healthRatio: .58, power: 1.34,
        maxHpBonus: 16, armorMultiplier: .85, cartGuardBonus: .1, horseGuardBonus: 0,
        equipmentIds: ["watch-crossbow", "black-lacquer-shield"], equipmentNames: ["神臂样弩", "黑漆团牌"],
        disciplineId: "vanguard", disciplineName: "踏阵先锋", masteryId: "deputy-command", masteryName: "镇场传令", masterySeal: "令",
        movementMultiplier: 1.06, supportCooldownMultiplier: 1, engageRangeBonus: 55, convoyProtection: 1,
      },
      {
        id: "qiao-qing", name: "乔青", role: "趟子手", experience: 9, healthRatio: .88, power: 1.12,
        maxHpBonus: 14, armorMultiplier: 1, cartGuardBonus: 0, horseGuardBonus: 0,
        equipmentIds: ["field-medicine-chest"], equipmentNames: ["行军针药匣"],
        disciplineId: "responder", disciplineName: "游阵策应", masteryId: "runner-pursuit", masteryName: "穿阵飞脚", masterySeal: "疾",
        movementMultiplier: 1.12, supportCooldownMultiplier: .72, engageRangeBonus: 20, convoyProtection: 1,
      },
      {
        id: "he-sheng", name: "何胜", role: "车把式", experience: 8, healthRatio: .94, power: 1.2,
        maxHpBonus: 10, armorMultiplier: .9, cartGuardBonus: .24, horseGuardBonus: .19,
        equipmentIds: ["frontier-hook-spear", "wheel-hook"], equipmentNames: ["朔边钩镰枪", "固轮挠钩"],
        disciplineId: "bulwark", disciplineName: "镇车执旗", masteryId: "driver-warden", masteryName: "人车一脉", masterySeal: "辙",
        movementMultiplier: .94, supportCooldownMultiplier: 1, engageRangeBonus: -18, convoyProtection: .88,
      },
    ],
  };
  let previewConfig = developmentBattlePreview(base);
  const martialArtId = developmentMartialArtId();
  if (martialArtId) previewConfig = {
    ...previewConfig,
    martialArtId,
    leader: { ...(previewConfig.leader ?? base.leader!), martialArtExperience: 15 },
  };
  const coreCombatFocusId = developmentCoreCombatFocusId();
  if (!coreCombatFocusId) return previewConfig;
  return {
    ...previewConfig,
    leader: {
      ...(previewConfig.leader ?? base.leader!),
      coreCombatFocusId,
      coreCombatExperience: 18,
    },
  };
}

function developmentCrewPreviewGame(): GameState | null {
  if (typeof window === "undefined" || !["localhost", "127.0.0.1"].includes(window.location.hostname)) return null;
  if (new URLSearchParams(window.location.search).get("crew-preview") !== "discipline") return null;
  const preview = createInitialGame(1107);
  return {
    ...preview,
    silver: 700,
    leader: { ...preview.leader, experience: 8, deputyBonds: { ...preview.leader.deputyBonds, "lu-cang": 7 }, injury: createCrewInjury("internal-trauma", preview.day) },
    convoy: { ...preview.convoy, leaderHp: 54 },
    equipmentStock: {
      ...preview.equipmentStock,
      "arm-crossbow": 1,
      "frontier-hook-spear": 1,
      "watch-crossbow": 1,
      "field-medicine-chest": 1,
      "black-lacquer-shield": 1,
    },
    equipmentTuning: {
      ...preview.equipmentTuning,
      "jujube-spear": 1,
      "arm-crossbow": 2,
      "watch-crossbow": 3,
      "field-medicine-chest": 2,
      "wheel-hook": 1,
    },
    crew: preview.crew.map((member, index) => ({
      ...member,
      experience: Math.max(7, member.experience),
      injury: index === 0 ? createCrewInjury("fracture", preview.day) : index === 1 ? createCrewInjury("blade-wound", preview.day) : null,
    })),
  };
}

function developmentLegacyPreview(legacy: LegacyState): LegacyState {
  if (typeof window === "undefined" || !["localhost", "127.0.0.1"].includes(window.location.hostname)) return legacy;
  if (new URLSearchParams(window.location.search).get("legacy-preview") !== "all") return legacy;
  return {
    ...legacy,
    completedRuns: Math.max(legacy.completedRuns, 4),
    victories: Math.max(legacy.victories, 1),
    unlockedIds: LEGACY_BOON_LIST.map((item) => item.id),
  };
}

function developmentEndingPreviewId(): CareerEndingId | null {
  if (typeof window === "undefined" || !["localhost", "127.0.0.1"].includes(window.location.hostname)) return null;
  const value = new URLSearchParams(window.location.search).get("ending-preview");
  return value === "great-escort" || value === "credit-collapse" || value === "convoy-ruin" || value === "insolvent" ? value : null;
}

function developmentEndingPreview(game: GameState): GameState {
  const endingId = developmentEndingPreviewId();
  return endingId ? { ...game, phase: "gameover", currentEvent: null, pendingBattle: null, career: { ...game.career, endingId } } : game;
}

function developmentSettlementPreviewActive(): boolean {
  if (typeof window === "undefined" || !["localhost", "127.0.0.1"].includes(window.location.hostname)) return false;
  return new URLSearchParams(window.location.search).get("settlement-preview") === "equipment";
}

function developmentSettlementPreview(game: GameState): GameState {
  if (!developmentSettlementPreviewActive()) return game;
  const equipmentReward: EquipmentId = "watch-crossbow";
  return {
    ...game,
    phase: "settlement",
    currentEvent: null,
    pendingBattle: null,
    completedContracts: Math.max(3, game.completedContracts + 1),
    equipmentStock: { ...game.equipmentStock, [equipmentReward]: (game.equipmentStock[equipmentReward] ?? 0) + 1 },
    settlement: {
      grade: "甲",
      title: "镖到信达",
      summary: "风云行护住军铺密函，沿水陆驿道按期送抵。守约之余，行院又将一件封藏强弩相赠。",
      reward: 86,
      compensation: 0,
      reputationChange: 6,
      equipmentReward,
      notes: ["镖封、暗记与内页均完好", "胜阵所得「神臂样弩」一件，已由军铺封藏送入器械架", "随行三人阅历各有增长"],
    },
  };
}

function developmentRivalPreviewActive(): boolean {
  if (typeof window === "undefined" || !["localhost", "127.0.0.1"].includes(window.location.hostname)) return false;
  return new URLSearchParams(window.location.search).get("rival-preview") === "all";
}

function developmentRivalPreviewGame(game: GameState): GameState {
  if (!developmentRivalPreviewActive()) return game;
  const preview = createInitialGame(1208, "linan-guild");
  return {
    ...preview,
    day: 12,
    phase: "map",
    completedContracts: 5,
    jianghuReputation: 34,
    selectedCityId: preview.currentCityId,
    rivalBureaus: preview.rivalBureaus.map((bureau) => bureau.id === "shunfeng-escort"
      ? { ...bureau, reputation: 43, relation: 31, completedContracts: 9, lastReportDay: 11, lastReport: "与风云行合旗走过闽浙海路，昨日已在泉州交清海舶契券。" }
      : bureau.id === "jiangdong-escort"
        ? { ...bureau, reputation: 52, relation: -24, completedContracts: 13, setbacks: 2, lastReportDay: 12, lastReport: "在瓜洲渡与风云行争过一次头筹，今日仍护官仓铜料西上。" }
        : { ...bureau, reputation: 28, relation: 11, completedContracts: 6, setbacks: 1, lastReportDay: 10, lastReport: "护送药商翻过金牛道，已在利州照约交人。" }),
  };
}

function developmentRoutePreviewActive(): boolean {
  if (typeof window === "undefined" || !["localhost", "127.0.0.1"].includes(window.location.hostname)) return false;
  return new URLSearchParams(window.location.search).get("map-preview") === "routes";
}

function developmentCoverPreviewActive(): boolean {
  if (typeof window === "undefined" || !["localhost", "127.0.0.1"].includes(window.location.hostname)) return false;
  return ["border", "event"].includes(new URLSearchParams(window.location.search).get("cover-preview") ?? "");
}

function developmentCoverPreviewGame(game: GameState): GameState {
  if (!developmentCoverPreviewActive()) return game;
  const preview = createInitialGame(1208, "linan-guild");
  const mode = new URLSearchParams(window.location.search).get("cover-preview");
  const source = preview.contracts[0];
  if (!source) return game;
  if (mode === "event") {
    const route = ROUTES.find((item) => {
      const fromOwner = preview.cities[item.from].owner;
      const toOwner = preview.cities[item.to].owner;
      return fromOwner !== toOwner && (fromOwner === "jin" || toOwner === "jin");
    });
    if (!route) return game;
    const from = preview.cities[route.from].owner === "jin" ? route.to : route.from;
    const to = from === route.from ? route.to : route.from;
    const contract: Contract = {
      ...source,
      id: "preview-border-event",
      from,
      to,
      kind: "letter",
      patron: "official",
      complication: "military",
      confidentiality: "绝密",
      secretKnown: true,
      deadline: 20,
      cargo: "边军铺递暗册",
    };
    const plan: RoutePlan = { id: `preview-${route.id}`, routeIds: [route.id], cityIds: [from, to], days: route.days, danger: route.danger, label: "越界官道", description: "关前已换金军旗号。" };
    const planning: GameState = {
      ...preview,
      currentCityId: from,
      selectedCityId: to,
      phase: "planning",
      journey: {
        contract,
        plan,
        segmentIndex: 0,
        startedDay: preview.day,
        elapsedDays: 0,
        traveledRouteIds: [],
        crewIds: [...preview.activeCrewIds],
        stance: "steady",
        coverId: "open-escort",
        coverBlown: false,
        issuerFaction: preview.cities[from].owner,
        expectedDestinationOwner: preview.cities[to].owner,
      },
    };
    return advanceTravel(chooseRoute(setTravelCover(planning, "military-train"), plan));
  }
  const contract: Contract = {
    ...source,
    id: "preview-border-cover",
    to: "kaifeng",
    title: "旧京军铺密册",
    cargo: "襄阳军铺旧册",
    client: "枢密院承旨",
    kind: "letter",
    patron: "official",
    complication: "military",
    confidentiality: "绝密",
    inspectionAllowed: false,
    secretKnown: true,
    secret: "册中记有北地旧军铺暗号，落入金军手中便会牵出沿边接应人。",
    deadline: 32,
    brief: "把旧军铺名册送入金境开封，不能亮出宋廷来路。",
  };
  return acceptContract({ ...preview, contracts: [contract, ...preview.contracts] }, contract.id);
}

function developmentFrontlinePreviewActive(): boolean {
  if (typeof window === "undefined" || !["localhost", "127.0.0.1"].includes(window.location.hostname)) return false;
  return new URLSearchParams(window.location.search).get("map-preview") === "frontline";
}

function developmentCaptivityPreviewActive(): boolean {
  if (typeof window === "undefined" || !["localhost", "127.0.0.1"].includes(window.location.hostname)) return false;
  return new URLSearchParams(window.location.search).get("map-preview") === "captivity";
}

function developmentRoadInfluencePreviewActive(): boolean {
  if (typeof window === "undefined" || !["localhost", "127.0.0.1"].includes(window.location.hostname)) return false;
  return new URLSearchParams(window.location.search).get("map-preview") === "road-influence";
}

function developmentRoadInfluencePreviewGame(game: GameState): GameState {
  if (!developmentRoadInfluencePreviewActive()) return game;
  const preview = createInitialGame(1208, "linan-guild");
  const pactRouteId = "linan-jiankang";
  const clearedRouteId = "jiankang-pingjiang";
  const hotRouteId = "xiangyang-zaoyang";
  const pactState = updateRouteInfluence(pactRouteId, preview.routeStates[pactRouteId], 10, { pressureDelta: -5, passageUntilDay: 18, outcome: "toll" });
  const clearedState = updateRouteInfluence(clearedRouteId, preview.routeStates[clearedRouteId], 9, { pressureDelta: -18, suppressedUntilDay: 16, outcome: "victory" });
  const hotState = updateRouteInfluence(hotRouteId, preview.routeStates[hotRouteId], 11, { pressureDelta: 34, passageUntilDay: 0, suppressedUntilDay: 0, outcome: "defeat" });
  return {
    ...preview,
    day: 12,
    phase: "map",
    selectedCityId: preview.currentCityId,
    routeStates: {
      ...preview.routeStates,
      [pactRouteId]: pactState,
      [clearedRouteId]: clearedState,
      [hotRouteId]: { ...hotState, condition: "banditry", sinceDay: 11, clearsDay: 17 },
    },
    routeIntel: {
      ...preview.routeIntel,
      [pactRouteId]: { ...preview.routeIntel[pactRouteId], surveyedDay: 12, knownDanger: 28 },
      [clearedRouteId]: { ...preview.routeIntel[clearedRouteId], surveyedDay: 12, knownDanger: 18 },
      [hotRouteId]: { ...preview.routeIntel[hotRouteId], surveyedDay: 12, knownDanger: 88, knownCondition: "banditry" },
    },
    news: [
      "【寨契落印】天目青竹社已认临安至建康七日通行封签。",
      "【驿路余波】江南东路余众蛰伏，襄北驿路却因败退匪势骤升。",
      ...preview.news,
    ].slice(0, 6),
  };
}

function developmentCaptivityPreviewGame(game: GameState): GameState {
  if (!developmentCaptivityPreviewActive()) return game;
  const preview = createInitialGame(1208, "linan-guild");
  return {
    ...preview,
    day: 9,
    phase: "map",
    silver: 160,
    selectedCityId: preview.currentCityId,
    activeCrewIds: preview.activeCrewIds.filter((id) => id !== "lu-cang"),
    convoy: { ...preview.convoy, guardsFit: Math.max(0, preview.convoy.guardsFit - 1) },
    crew: preview.crew.map((member) => member.id === "lu-cang" ? {
      ...member,
      hp: 18,
      injury: createCrewInjury("internal-trauma", 8),
      captivity: { routeId: "linan-jiankang", captor: "采石矶水寨", sinceDay: 8, ransom: 52 },
    } : member),
    news: ["【队员被俘】鲁沧在行在江淮驿路断后失陷，被采石矶水寨扣走；须到临安府或建康府设法赎回。", ...preview.news].slice(0, 6),
  };
}

function developmentRoutePreviewGame(game: GameState): GameState {
  if (!developmentRoutePreviewActive()) return game;
  const preview = createInitialGame(1208, "linan-guild");
  const openingContract = preview.contracts[0];
  return openingContract ? acceptContract(preview, openingContract.id) : game;
}

function developmentFrontlinePreviewGame(game: GameState): GameState {
  if (!developmentFrontlinePreviewActive()) return game;
  const preview = createInitialGame(1208, "linan-guild");
  return {
    ...preview,
    day: 18,
    selectedCityId: "xiangyang",
    cities: {
      ...preview.cities,
      xiangyang: { ...preview.cities.xiangyang, status: "contested", security: 27, prosperity: 54, intelDay: 18, statusSinceDay: 15 },
      shouchun: { ...preview.cities.shouchun, status: "besieged", security: 36, prosperity: 58, intelDay: 18, statusSinceDay: 16 },
      zaoyang: { ...preview.cities.zaoyang, status: "martial", security: 44, intelDay: 18, statusSinceDay: 15 },
    },
    news: [
      "【襄阳争城】金军逼近城垣，两军已在关门内外反复争夺；再失城防便可能换旗。",
      "【安丰军围城】淮北兵马沿官道压境，粮路与驿道开始断续。",
      ...preview.news,
    ].slice(0, 6),
  };
}

function developmentArmyEventPreviewActive(): boolean {
  if (typeof window === "undefined" || !["localhost", "127.0.0.1"].includes(window.location.hostname)) return false;
  return new URLSearchParams(window.location.search).get("event-preview") === "army";
}

function developmentArmyEventPreviewGame(game: GameState): GameState {
  if (!developmentArmyEventPreviewActive()) return game;
  const preview = createInitialGame(1208, "linan-guild");
  const sourceContract = preview.contracts[0];
  if (!sourceContract) return game;
  const routeId = "kaifeng-xiangyang";
  const route = routeById(routeId);
  const source = preview.worldActors.find((actor) => actor.id === "jin-southern-camp");
  if (!source) return game;
  const army = { ...source, routeId, fromCityId: "kaifeng", toCityId: "xiangyang", progress: .56 };
  const worldActors = preview.worldActors.map((actor) => actor.id === army.id ? army : actor);
  const staged: GameState = {
    ...preview,
    phase: "travel",
    currentCityId: "xiangyang",
    selectedCityId: "xiangyang",
    worldActors,
    journey: {
      contract: { ...sourceContract, id: "army-preview", from: "xiangyang", to: "kaifeng", title: "军牒北送", brief: "由襄阳北出，在京西北路穿过金军南下行营。" },
      plan: { id: "army-preview-route", routeIds: [route.id], cityIds: ["xiangyang", "kaifeng"], days: route.days, danger: route.danger, label: "京西北路", description: "两军行营相向而行，沿途军检远重于寻常边关。" },
      segmentIndex: 0,
      startedDay: preview.day,
      elapsedDays: 0,
      traveledRouteIds: [],
      crewIds: [...preview.activeCrewIds],
      battleVictories: 0,
      stance: "steady",
      issuerFaction: "song",
      expectedDestinationOwner: preview.cities.kaifeng.owner,
    },
  };
  const event = createWorldActorEvent(staged, routeId, army);
  return { ...staged, phase: "event", currentEvent: event };
}

function developmentContractEventPreviewActive(): boolean {
  if (typeof window === "undefined" || !["localhost", "127.0.0.1"].includes(window.location.hostname)) return false;
  return new URLSearchParams(window.location.search).get("event-preview") === "intrigue";
}

function developmentContractEventPreviewGame(game: GameState): GameState {
  if (!developmentContractEventPreviewActive()) return game;
  const preview = createInitialGame(1208, "linan-guild");
  const sourceContract = preview.contracts.find((contract) => contract.complication !== "none") ?? preview.contracts[0];
  if (!sourceContract) return game;
  const planning = acceptContract(preview, sourceContract.id);
  if (!planning.journey) return game;
  const travel = chooseRoute(planning, planning.journey.plan);
  if (!travel.journey) return game;
  const routeId = travel.journey.plan.routeIds[0];
  const route = routeById(routeId);
  const event = contractIncidentEvent({
    day: travel.day,
    routeId,
    routeName: route.name,
    contract: travel.journey.contract,
    crewRoles: travel.journey.crewIds.flatMap((id) => {
      const member = travel.crew.find((item) => item.id === id && item.hp > 0);
      return member ? [member.role] : [];
    }),
    stance: travel.journey.stance,
    upgrades: travel.convoy.upgrades,
    supplies: travel.supplies,
    silver: travel.silver,
  });
  return event ? { ...travel, phase: "event", currentEvent: event } : game;
}

function developmentStopoverPreviewActive(): boolean {
  if (typeof window === "undefined" || !["localhost", "127.0.0.1"].includes(window.location.hostname)) return false;
  return new URLSearchParams(window.location.search).get("event-preview") === "stopover";
}

function developmentStopoverPreviewGame(game: GameState): GameState {
  if (!developmentStopoverPreviewActive()) return game;
  const preview = createInitialGame(1208, "linan-guild");
  const sourceContract = preview.contracts[0];
  if (!sourceContract) return game;
  const planning = acceptContract(preview, sourceContract.id);
  if (!planning.journey) return game;
  const travel = chooseRoute(planning, planning.journey.plan);
  if (!travel.journey || travel.journey.plan.routeIds.length < 2) return game;
  const firstRoute = routeById(travel.journey.plan.routeIds[0]);
  const segmentIndex = 1;
  const cityId = travel.journey.plan.cityIds[segmentIndex];
  const nextRoute = routeById(travel.journey.plan.routeIds[segmentIndex]);
  return {
    ...travel,
    day: travel.day + firstRoute.days,
    phase: "event",
    journey: {
      ...travel.journey,
      segmentIndex,
      elapsedDays: firstRoute.days,
      traveledRouteIds: [firstRoute.id],
    },
    currentEvent: {
      id: "waystation-preview",
      kind: "waystation",
      eyebrow: "中途驿灯已上，旧路书却未必还作数",
      title: `${cityById(cityId).name}城外，重看余程`,
      description: `镖队刚走完${firstRoute.name}，下一程原定走${nextRoute.name}。天下旗号与沿途天候已经变化，正可在落脚前重新议路。`,
      choices: [
        { id: "stop-rest", label: "住驿整顿一日", hint: "耗 1 份补给；恢复马力、士气与随行伤势", tone: "safe" },
        { id: "stop-stock", label: "托牙人补路粮", hint: "按此地行价添粮，不额外耗时", tone: "safe" },
        { id: "stop-intel", label: "听下一程新路报", hint: "核实旗号、路况与匪情", tone: "safe" },
        { id: "stop-press", label: "不落镖旗，继续赶路", hint: "不耗时、不花银；连日不整顿会轻损士气", tone: "risk" },
      ],
    },
  };
}

function Gauge({ value, label, danger = false }: { value: number; label: string; danger?: boolean }) {
  return (
    <div className="gauge">
      <div className="gauge-label"><span>{label}</span><b>{Math.round(value)}</b></div>
      <div className="gauge-track"><i className={danger ? "danger" : ""} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>
    </div>
  );
}

function TitleScreen({ hasSave, legacy, onNew, onContinue }: { hasSave: boolean; legacy: LegacyState; onNew: () => void; onContinue: () => void }) {
  return (
    <main className="title-screen">
      <div className="title-mountains" aria-hidden="true" />
      <div className="title-seal">風<br />雲</div>
      <div className="title-copy">
        <p className="title-overline">动态天下 · 路线经营 Roguelite</p>
        <h1><span>镖</span><span>局</span></h1>
        <p className="title-subtitle">出发时是一国之内，抵达时已隔两国边关。</p>
        <p className="title-lineage">祖业谱牒 · 已续 {legacy.completedRuns} 局 · 收录 {legacy.unlockedIds.length}/4 件传承</p>
        <div className="title-actions">
          <button className="primary-button large" onClick={onNew}>开张接镖</button>
          {hasSave && <button className="ghost-button large" onClick={onContinue}>继续旧途</button>}
        </div>
        <div className="title-verbs">
          <span><b>择镖</b> 看人，也看货</span>
          <span><b>择路</b> 赌情报与时限</span>
          <span><b>护送</b> 保住不能全保之物</span>
        </div>
      </div>
      <footer>南宋嘉定天下 · 每一签皆有异势</footer>
    </main>
  );
}

function drawWorldSeed(): number {
  return 100000 + Math.floor(Math.random() * 899999);
}

function NewGameScreen({ legacy, onBack, onBegin }: { legacy: LegacyState; onBack: () => void; onBegin: (originId: OriginId, seed: number, legacyId: LegacyId | null) => void }) {
  const [originId, setOriginId] = useState<OriginId>("linan-guild");
  const [legacyId, setLegacyId] = useState<LegacyId | null>(null);
  const [seed, setSeed] = useState(drawWorldSeed);
  const origin = originById(originId);
  const startCity = cityById(origin.startCityId);
  return (
    <main className="origin-screen">
      <div className="origin-clouds" aria-hidden="true" />
      <header className="origin-heading">
        <button className="back-link" onClick={onBack}>← 收卷返题</button>
        <div><span>风云行 · 开张起号</span><h1>择一处根脚</h1><p>出身不是永久加成：它决定第一座总号、手里的车马，以及开门时已经结下的人情与仇怨。</p></div>
      </header>
      <section className="origin-cards" aria-label="选择镖局出身">
        {ORIGIN_LIST.map((item) => (
          <button key={item.id} className={item.id === originId ? "is-selected" : ""} aria-pressed={item.id === originId} onClick={() => setOriginId(item.id)}>
            <span className="origin-seal">{item.seal}</span>
            <span className="origin-card-copy"><small>{item.subtitle}</small><b>{item.title}</b><p>{item.description}</p></span>
            <span className={`origin-risk risk-${item.difficulty}`}>{item.difficulty}</span>
          </button>
        ))}
      </section>
      <section className="origin-deed" aria-live="polite">
        <div className="origin-deed-title"><span>{origin.seal}</span><div><small>{startCity.name}总号</small><b>{origin.title}</b></div></div>
        <div className="origin-terms">
          <p><i>得</i><span><b>根脚</b>{origin.advantage}</span></p>
          <p><i>慎</i><span><b>代价</b>{origin.warning}</span></p>
        </div>
        <div className="origin-assets">
          <span><small>现银</small><b>{origin.silver} 两</b></span>
          <span><small>补给</small><b>{origin.supplies} 份</b></span>
          <span><small>信用</small><b>{origin.reputation}</b></span>
          <span><small>江湖</small><b>{origin.jianghuReputation}</b></span>
          <span><small>镖车</small><b>{WAGONS[origin.wagonId].name}</b></span>
          <span><small>马队</small><b>{HORSE_TEAMS[origin.horseTeamId].name}</b></span>
        </div>
      </section>
      <section className="legacy-picks" aria-label="选择祖业传承">
        <header><span>祖业谱牒</span><b>择一旧物随新号开门</b><small>已续 {legacy.completedRuns} 局 · 每局只承一项</small></header>
        <div>
          <button className={legacyId === null ? "is-selected" : ""} aria-pressed={legacyId === null} onClick={() => setLegacyId(null)}>
            <i>新</i><span><b>白手起家</b><small>不承旧物，按出身原有家底开局</small></span>
          </button>
          {LEGACY_BOON_LIST.map((item) => {
            const unlocked = legacy.unlockedIds.includes(item.id);
            return <button key={item.id} disabled={!unlocked} className={legacyId === item.id ? "is-selected" : ""} aria-pressed={legacyId === item.id} onClick={() => setLegacyId(item.id)}>
              <i>{unlocked ? item.seal : "锁"}</i><span><b>{item.title}</b><small>{unlocked ? item.effect : item.unlockLabel}</small></span>
            </button>;
          })}
        </div>
      </section>
      <footer className="origin-actions">
        <label><span>天下签数</span><input aria-label="天下签数" type="number" min="1" max="2147483647" value={seed} onChange={(event) => setSeed(Math.max(1, Math.min(2147483647, Number(event.target.value) || 1)))} /></label>
        <button className="ghost-button" onClick={() => setSeed(drawWorldSeed())}>另抽一签</button>
        <button className="ghost-button" onClick={() => setSeed(1107)}>演示签 · 1107</button>
        <button className="primary-button large" onClick={() => onBegin(originId, seed, legacyId)}>立契开门</button>
      </footer>
    </main>
  );
}

function ContractCard({
  game,
  contract,
  assessment,
  onAccept,
  onInvestigate,
  onNegotiate,
}: {
  game: GameState;
  contract: Contract;
  assessment: ContractBoardAssessment;
  onAccept: (id: string) => void;
  onInvestigate: (id: string, method: "inquire" | "inspect") => void;
  onNegotiate: (id: string, negotiationId: ContractNegotiationId) => void;
}) {
  const destination = cityById(contract.to);
  const familiarContact = game.contacts.find((contact) => contact.id === contactId(contract.from, contract.patron, contract.client));
  const familiarTier = familiarContact ? contactFavorTier(familiarContact.favor) : null;
  const investigationCost = contractInvestigationCost(game);
  const negotiation = contractNegotiationOffer(game, contract.id);
  const routeAvailable = assessment.plan !== null;
  const inspectVerb = contract.kind === "escort" ? "当面盘问" : contract.kind === "letter" ? "验看信封" : "验看镖物";
  return (
    <article className={`contract-card contract-${contract.kind} ${contract.secretKnown ? "is-investigated" : ""}`}>
      <div className="contract-heading">
        <div><span className={`contract-kind kind-${contract.kind}`}>{CONTRACT_KIND_SEAL[contract.kind]}<i>{CONTRACT_KIND_LABEL[contract.kind]}</i></span><span className={`risk-badge risk-${contract.risk}`}>{contract.risk}</span></div>
        <small>{CONTRACT_PATRON_LABEL[contract.patron]} · {contract.client}{familiarContact && familiarTier && <em className={`contract-contact tier-${familiarTier.tier}`}> · {familiarTier.label} {familiarContact.favor}</em>}</small>
      </div>
      <h4>{contract.title}</h4>
      <p>{contract.cargo} · 至 {destination.name}</p>
      <div className="contract-meta">
        <span><b>{contract.reward}</b> 两</span>
        <span>限 {contract.deadline} 日</span>
        <span>{contract.confidentiality}</span>
        <span>允损 {contract.allowedLoss}%</span>
      </div>
      {negotiation && <section className={`contract-negotiation ${negotiation.completed ? "is-completed" : ""}`} aria-label={`${negotiation.contact.name}熟客改约`}>
        <header>
          <span><small>{negotiation.completed ? `条款已落印 · 余情${negotiation.tierLabel}` : `旧客商议 · ${negotiation.tierLabel}`}</small><b>{negotiation.contact.name}</b></span>
          <em>{negotiation.contact.favor}<small>人情</small></em>
        </header>
        {negotiation.completed && negotiation.result ? <div className="contract-negotiation-result">
          <i>{negotiation.result.seal}</i>
          <span><small>条款已经落印，不可再改</small><b>{negotiation.result.label} · {negotiation.result.summary}</b></span>
          <em>耗 {negotiation.result.cost}</em>
        </div> : <>
          <p>凭往日交情可择一项改约；落印后不可反悔。</p>
          <div className="contract-negotiation-options">
            {negotiation.options.map((option) => <button key={option.id} disabled={!option.enabled} onClick={() => onNegotiate(contract.id, option.id)} title={option.disabledReason ?? option.summary}>
              <i>{option.seal}</i>
              <span><b>{option.label}</b><small>{option.summary}</small></span>
              <em>{option.enabled ? `耗 ${option.cost}` : option.disabledReason}</em>
            </button>)}
          </div>
        </>}
      </section>}
      <section className={`contract-forecast forecast-${assessment.tone}`} aria-label={`${contract.title}接镖前成行估算：${assessment.title}`}>
        <i>{assessment.seal}</i>
        <div className="contract-forecast-verdict">
          <small>账房试算 · {assessment.plan?.label ?? "无路可排"}</small>
          <b>{assessment.title}</b>
          <em>{assessment.summary}</em>
        </div>
        <strong>{assessment.rewardPerDay}<small>两／日</small></strong>
        <dl>
          <div><dt>脚程</dt><dd>{assessment.days ? `${assessment.days} 日` : "—"}</dd></div>
          <div><dt>余限</dt><dd className={assessment.deadlineMargin < 0 ? "is-deficit" : assessment.deadlineMargin <= 2 ? "is-tight" : ""}>{assessment.deadlineMargin >= 0 ? `+${assessment.deadlineMargin}` : assessment.deadlineMargin} 日</dd></div>
          <div><dt>路粮</dt><dd className={assessment.supplyBalance < 0 ? "is-deficit" : ""}>{assessment.supplyCost} 份{assessment.supplyBalance < 0 ? ` · 缺${Math.abs(assessment.supplyBalance)}` : ""}</dd></div>
          <div><dt>边关</dt><dd>{assessment.borderSegments ? `${assessment.borderSegments} 处` : "不跨境"}</dd></div>
        </dl>
        <p><span>{assessment.intelLabel}路险 {assessment.knownDanger}</span><span>{assessment.weatherSummary}</span></p>
      </section>
      {assessment.specialHandling && <section className="special-handling-note" aria-label={`${assessment.specialHandling.name}特殊规程`}>
        <i>{assessment.specialHandling.seal}</i>
        <div><small>特镖规程 · 接镖前可见</small><b>{assessment.specialHandling.name}</b><p>{assessment.specialHandling.note}</p><em>{assessment.specialHandling.counterplay}</em></div>
        {assessment.specialHandling.estimatedCargoLoss > 0 && <strong>预损<br />{assessment.specialHandling.estimatedCargoLoss}%</strong>}
      </section>}
      <p className="contract-brief">{contract.brief}</p>
      <p className="contract-clue"><b>可疑征象</b>{contract.clue}</p>
      {contract.secretKnown && <div className="contract-secret"><span>底细已明</span><p>{contract.secret}</p><small>{contract.requirement}</small></div>}
      {!contract.secretKnown && <div className="contract-investigation">
        <button disabled={game.silver < investigationCost} onClick={() => onInvestigate(contract.id, "inquire")}>访查 · {investigationCost}两</button>
        <button onClick={() => onInvestigate(contract.id, "inspect")}>{inspectVerb} · {contract.inspectionAllowed ? "允" : "违约"}</button>
      </div>}
      <button className="paper-button" disabled={!routeAvailable} onClick={() => onAccept(contract.id)}>{routeAvailable ? contract.secretKnown ? "知情接镖" : "不问底细接镖" : "已知道路暂断"}</button>
    </article>
  );
}

function RouteCard({
  game,
  plan,
  index,
  onChoose,
  onInvestigate,
  highlighted = false,
  onPreview,
  disabled = false,
}: {
  game: GameState;
  plan: RoutePlan;
  index: number;
  onChoose: (plan: RoutePlan) => void;
  onInvestigate: (plan: RoutePlan, method: "buy" | "scout") => void;
  highlighted?: boolean;
  onPreview?: () => void;
  disabled?: boolean;
}) {
  const names = plan.routeIds.map((id) => routeById(id).name).join(" → ");
  const cities = plan.cityIds.map((id) => cityById(id).name).join(" · ");
  const landmarks = landmarksForPlan(plan.routeIds);
  const insight = routePlanInsight(game, plan);
  const travel = routePlanTravelForecast(game, plan);
  const readiness = departureReadinessForPlan(game, plan);
  const routeStance = travelStanceById(game.journey?.stance);
  const routeCover = travelCoverById(game.journey?.coverId);
  const strongestWeather = [...travel.weatherReports].sort((a, b) => b.weather.severity - a.weather.severity)[0];
  const furthestWeather = travel.weatherReports[travel.weatherReports.length - 1];
  const freshnessLabel = insight.freshness === "fresh" ? "今报" : insight.freshness === "aging" ? "旧报" : "传闻";
  const hasScout = game.activeCrewIds.some((id) => game.crew.find((member) => member.id === id)?.role === "趟子手");
  const intelCost = routeInvestigationCost(game);
  const borderFactions = plan.cityIds.slice(1).reduce<FactionId[]>((result, cityId, index) => {
    const previousOwner = game.cities[plan.cityIds[index]].owner;
    const owner = game.cities[cityId].owner;
    if (owner !== previousOwner && !result.includes(owner)) result.push(owner);
    return result;
  }, []);
  const routeCoverAssessment = travelCoverAssessment(game, routeCover.id, borderFactions[0] ?? null);
  return (
    <article
      id={`route-plan-${plan.id}`}
      className={`route-card candidate-tone-${index % 3} intel-${insight.freshness} ${highlighted ? "is-previewed" : ""}`}
      tabIndex={0}
      aria-label={`${routeCandidateSeal(index)}路，${plan.label}，${travel.days}日，路险${travel.dangerLabel}`}
      onMouseEnter={onPreview}
      onFocus={onPreview}
    >
      <div className="route-card-index">{routeCandidateSeal(index)}</div>
      <div className="route-card-body">
        <div className="route-card-heading"><h4>{plan.label}</h4><span>{travel.days} 日 / 路险 {travel.dangerLabel}</span></div>
        <div className="route-intel-tags">
          <span className={`freshness-${insight.freshness}`}>{freshnessLabel}{insight.freshness !== "fresh" ? ` · 最旧${insight.stalestAge}日` : " · 已核"}</span>
          {insight.borderSegments > 0 && <span>跨 {insight.borderSegments} 处边关</span>}
          {borderFactions.map((factionId) => <span key={factionId} className={hasActivePermit(game, factionId) ? "permit-ready" : "permit-missing"}>{FACTIONS[factionId].short}境 · {hasActivePermit(game, factionId) ? `路引至${game.travelPermits?.[factionId] ?? 0}日` : factionStanding(game.relations[factionId] ?? 0).label}</span>)}
          {insight.trips > 0 && <span>走过 {insight.trips} 段次</span>}
          {insight.conditionReports.map((report) => <span key={report.routeId} className={`condition-${report.condition}`}>{ROUTE_CONDITION_EFFECTS[report.condition].seal} · {report.label}{report.stale ? "（旧报）" : ""}</span>)}
          <span>预计耗粮 {travel.supplyCost}</span>
          <span>马力 -{travel.staminaCost}</span>
          <span className={`stance-tag stance-${game.journey?.stance ?? "steady"}`}>{routeStance.title}{routeStance.dangerModifier ? ` · 路险${routeStance.dangerModifier > 0 ? "+" : ""}${routeStance.dangerModifier}` : ""}</span>
          {insight.borderSegments > 0 && <span className={`cover-tag cover-${routeCover.id}`}>{routeCover.seal} · {routeCover.title}{routeCover.cost ? ` · ${routeCover.cost}两` : ""}</span>}
          {strongestWeather && <span className={`weather-tag weather-${strongestWeather.weather.kind}`}>{travel.weatherSummary} · {furthestWeather.confidence.label}</span>}
          {travel.days !== plan.days && <span className="convoy-modifier">车马行策 {travel.days - plan.days > 0 ? "+" : ""}{travel.days - plan.days}日</span>}
        </div>
        {landmarks.length > 0 && (
          <section className="route-landmarks" aria-label={`沿途要点：${landmarks.map((landmark) => landmark.name).join("、")}`}>
            <header><span>沿途要点</span><small>舆图已标</small></header>
            <div>
              {landmarks.slice(0, 3).map((landmark) => {
                const kind = routeLandmarkKind(landmark.kind);
                return <span key={landmark.id} title={landmark.description}><i>{kind.seal}</i><b>{landmark.name}</b><small>{kind.label} · {landmark.service}</small></span>;
              })}
              {landmarks.length > 3 && <em>另 {landmarks.length - 3} 处</em>}
            </div>
          </section>
        )}
        <section className={`route-readiness readiness-${readiness.tone}`} aria-label={`${routeCandidateSeal(index)}路成行判断：${readiness.label}`}>
          <i>{readiness.seal}</i>
          <div className="route-readiness-copy"><small>行前成行判断</small><b>{readiness.label}</b><p>{readiness.summary}</p></div>
          <dl>
            <div className={readiness.deadlineMargin < 0 ? "is-deficit" : readiness.deadlineMargin <= 2 ? "is-tight" : "is-sound"}><dt>期限</dt><dd>{readiness.deadlineMargin < 0 ? `误 ${Math.abs(readiness.deadlineMargin)}日` : `余 ${readiness.deadlineMargin}日`}</dd></div>
            <div className={readiness.supplyBalance < 0 ? "is-deficit" : "is-sound"}><dt>行粮</dt><dd>{readiness.supplyBalance < 0 ? `缺 ${Math.abs(readiness.supplyBalance)}` : `余 ${readiness.supplyBalance}`}</dd></div>
            <div className={readiness.staminaBalance < 0 ? "is-deficit" : "is-sound"}><dt>马力</dt><dd>{readiness.staminaBalance < 0 ? `缺 ${Math.abs(readiness.staminaBalance)}` : `余 ${readiness.staminaBalance}`}</dd></div>
            <div className={readiness.combatReady ? "is-sound" : "is-tight"}><dt>战阵</dt><dd>{readiness.combatReady ? "主副齐" : `${readiness.selectedCrewCount}/3人`}</dd></div>
          </dl>
          <div className="route-readiness-notes">
            {insight.borderSegments > 0 && <span className={`route-readiness-cover fit-${routeCoverAssessment.fit}`}>{routeCover.seal} 身份 · {routeCover.title} · {routeCoverAssessment.fitLabel}</span>}
            {readiness.warnings.slice(0, insight.borderSegments > 0 ? 2 : 3).map((warning) => <span key={warning} className="is-warning">！{warning}</span>)}
            {readiness.strengths.slice(0, Math.max(1, (insight.borderSegments > 0 ? 2 : 3) - readiness.warnings.length)).map((strength) => <span key={strength} className="is-strength">✓ {strength}</span>)}
          </div>
        </section>
        <p className="route-cities">{cities}</p>
        <p>{names}</p>
        <small>{plan.description}</small>
        <div className="route-investigation">
          <button disabled={insight.fullySurveyed || game.silver < intelCost} onClick={() => onInvestigate(plan, "buy")}>{insight.fullySurveyed ? "路报已验" : `买路报 · ${intelCost}两`}</button>
          <button disabled={insight.fullySurveyed || !hasScout} onClick={() => onInvestigate(plan, "scout")}>{hasScout ? "遣趟子手 · 1日" : "需趟子手"}</button>
        </div>
      </div>
      <button className="route-pick" disabled={disabled || game.silver < routeCover.cost} onClick={() => onChoose(plan)}>{disabled ? "先选足三名随行人" : game.silver < routeCover.cost ? `行装尚缺 ${routeCover.cost - game.silver} 两` : readiness.tone === "danger" ? "知险仍按此路出发" : "按此路出发"}</button>
    </article>
  );
}

function App() {
  const [launch, setLaunch] = useState<LaunchState>("loading");
  const [game, setGame] = useState<GameState | null>(null);
  const [savedGame, setSavedGame] = useState<GameState | null>(null);
  const [legacy, setLegacy] = useState<LegacyState>(createLegacyState);
  const [showHelp, setShowHelp] = useState(false);
  const [savePulse, setSavePulse] = useState(false);
  const [previewRoutePlanId, setPreviewRoutePlanId] = useState<string | null>(null);
  const [journeyDispositionConfirm, setJourneyDispositionConfirm] = useState<JourneyDispositionId | null>(null);
  const [cityWorkspace, setCityWorkspace] = useState<CityWorkspaceTab>(() => developmentRivalPreviewActive() ? "overview" : developmentCaptivityPreviewActive() ? "crew" : "contracts");
  const [crewPreviewGame, setCrewPreviewGame] = useState<GameState | null>(developmentCrewPreviewGame);
  const [battlePreviewConfig] = useState<BattleConfig | null>(developmentBattleFixture);
  const sidePanelRef = useRef<HTMLElement>(null);
  const visibleLegacy = developmentLegacyPreview(legacy);
  const gameAudio = useGameAudio({ launch, game, battlePreviewActive: Boolean(battlePreviewConfig) });

  useEffect(() => {
    Promise.all([
      loadGame().catch(() => null),
      loadLegacy().catch(() => createLegacyState()),
    ]).then(([saved, lineage]) => {
      setSavedGame(saved);
      setLegacy(lineage);
      setLaunch("title");
    });
  }, []);

  useEffect(() => {
    if (!game || launch !== "game" || developmentEndingPreviewId() || developmentBattlePreviewId() || developmentSettlementPreviewActive() || developmentRivalPreviewActive() || developmentRoutePreviewActive() || developmentCoverPreviewActive() || developmentFrontlinePreviewActive() || developmentCaptivityPreviewActive() || developmentRoadInfluencePreviewActive() || developmentArmyEventPreviewActive() || developmentContractEventPreviewActive() || developmentStopoverPreviewActive()) return;
    const handle = window.setTimeout(() => {
      saveGame(game).then(() => {
        setSavePulse(true);
        window.setTimeout(() => setSavePulse(false), 900);
      }).catch(() => undefined);
    }, 250);
    return () => window.clearTimeout(handle);
  }, [game, launch]);

  useEffect(() => {
    sidePanelRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [game?.phase]);

  useEffect(() => {
    setJourneyDispositionConfirm(null);
  }, [game?.currentEvent?.id]);

  useEffect(() => {
    if (!game) return;
    setCityWorkspace(developmentRivalPreviewActive() ? "overview" : developmentCaptivityPreviewActive() ? "crew" : game.selectedCityId === game.currentCityId ? "contracts" : "overview");
  }, [game?.selectedCityId, game?.currentCityId]);

  useEffect(() => {
    if (!game || game.phase !== "gameover" || !game.career.endingId || developmentEndingPreviewId()) return;
    setLegacy((current) => {
      const next = recordLegacyEnding(current, game);
      if (next === current) return current;
      void saveLegacy(next).catch(() => undefined);
      return next;
    });
  }, [game?.phase, game?.career.endingId, game?.seed, game?.day, game?.completedContracts]);

  if (battlePreviewConfig) return (
    <main className="game-root battle-root">
      <AudioToggle enabled={gameAudio.enabled} onToggle={gameAudio.toggle} floating />
      <Suspense fallback={<div className="loading-screen"><div className="loading-seal">战</div><p>正在布置山口…</p></div>}>
        <PhaserBattle config={battlePreviewConfig} onComplete={() => undefined} />
      </Suspense>
    </main>
  );

  if (crewPreviewGame) return (
    <main className="crew-preview-root">
      <AudioToggle enabled={gameAudio.enabled} onToggle={gameAudio.toggle} floating />
      <section className="crew-preview-sheet">
        <header><span className="kicker">开发预览 · 点将定职</span><h1>镖师养成、战职与绝活</h1><p>熟手定战职，老手悟绝活；人物会在自动作战中按各自所长执行你的策略。</p></header>
        <LeaderProgressionPanel game={crewPreviewGame} onChange={setCrewPreviewGame} />
        <CrewEquipmentPanel game={crewPreviewGame} onChange={setCrewPreviewGame} />
      </section>
    </main>
  );

  const beginNewGame = async (originId: OriginId, seed: number, legacyId: LegacyId | null = null) => {
    const selectedLegacy = legacyId && visibleLegacy.unlockedIds.includes(legacyId) ? legacyId : null;
    await clearSave().catch(() => undefined);
    const fresh = createInitialGame(seed, originId, selectedLegacy);
    setGame(fresh);
    setSavedGame(fresh);
    setLaunch("game");
    setShowHelp(true);
  };

  const routePlans = useMemo(() => {
    if (!game?.journey) return [];
    return generateRoutePlans(game.journey.contract.from, game.journey.contract.to, game);
  }, [game?.journey?.contract.id, game?.routeIntel, game?.routeStates, game?.day, game?.seed]);

  const contractBoardAssessments = useMemo(
    () => game ? rankContractsForBoard(game, game.contracts) : [],
    [game],
  );

  const mapRouteCandidates = useMemo<MapRouteCandidate[]>(() => {
    if (!game || game.phase !== "planning") return [];
    return routePlans.map((plan) => {
      const travel = routePlanTravelForecast(game, plan);
      const insight = routePlanInsight(game, plan);
      return {
        id: plan.id,
        label: plan.label,
        routeIds: plan.routeIds,
        cityIds: plan.cityIds,
        days: travel.days,
        dangerLabel: travel.dangerLabel,
        borderSegments: insight.borderSegments,
        weatherLabel: travel.weatherSummary,
      };
    });
  }, [game, routePlans]);

  const preferredRoutePreviewId = game?.phase === "planning"
    ? preferredDeparturePlanId(game, routePlans)
    : null;
  const effectiveRoutePreviewId = mapRouteCandidates.some((candidate) => candidate.id === previewRoutePlanId)
    ? previewRoutePlanId
    : preferredRoutePreviewId ?? mapRouteCandidates[0]?.id ?? null;

  useEffect(() => {
    setPreviewRoutePlanId(null);
  }, [game?.journey?.contract.id]);

  if (launch === "loading") return <div className="loading-screen"><div className="loading-seal">镖</div><p>正在展开舆图…</p></div>;
  if (launch === "setup") return <>
    <AudioToggle enabled={gameAudio.enabled} onToggle={gameAudio.toggle} floating />
    <NewGameScreen legacy={visibleLegacy} onBack={() => setLaunch("title")} onBegin={(originId, seed, legacyId) => { void beginNewGame(originId, seed, legacyId); }} />
  </>;
  if (launch === "title" || !game) {
    return (
      <>
      <AudioToggle enabled={gameAudio.enabled} onToggle={gameAudio.toggle} floating />
      <TitleScreen
        hasSave={Boolean(savedGame) || developmentRivalPreviewActive() || developmentRoutePreviewActive() || developmentCoverPreviewActive() || developmentFrontlinePreviewActive() || developmentCaptivityPreviewActive() || developmentRoadInfluencePreviewActive() || developmentArmyEventPreviewActive() || developmentContractEventPreviewActive() || developmentStopoverPreviewActive()}
        legacy={visibleLegacy}
        onNew={() => setLaunch("setup")}
        onContinue={() => {
          const source = savedGame ?? createInitialGame(1208, "linan-guild");
          setGame(developmentRivalPreviewGame(developmentStopoverPreviewGame(developmentContractEventPreviewGame(developmentArmyEventPreviewGame(developmentRoadInfluencePreviewGame(developmentCaptivityPreviewGame(developmentFrontlinePreviewGame(developmentCoverPreviewGame(developmentRoutePreviewGame(developmentSettlementPreview(developmentBattlePreviewGame(developmentEndingPreview(source)))))))))))));
          setLaunch("game");
        }}
      />
      </>
    );
  }

  if (game.phase === "battle" && game.pendingBattle) {
    return (
      <main className="game-root battle-root">
        <AudioToggle enabled={gameAudio.enabled} onToggle={gameAudio.toggle} floating />
        <Suspense fallback={<div className="loading-screen"><div className="loading-seal">战</div><p>正在布置山口…</p></div>}>
          <PhaserBattle config={developmentBattlePreview(game.pendingBattle)} onComplete={(result) => setGame((current) => current ? applyBattleResult(current, result) : current)} />
        </Suspense>
      </main>
    );
  }

  const selectedCity = cityById(game.selectedCityId);
  const selectedWeather = weatherForCity(game.seed, game.day, selectedCity);
  const selectedTomorrowWeather = weatherForCity(game.seed, game.day + 1, selectedCity);
  const selectedWeatherOutlook = selectedTomorrowWeather.kind === selectedWeather.kind
    ? `预计延续至第 ${selectedWeather.endsDay} 日`
    : `明日转${selectedTomorrowWeather.seal} · ${selectedTomorrowWeather.label}`;
  const selectedState = game.cities[selectedCity.id];
  const selectedEffect = cityStatusEffect(selectedState);
  const selectedFrontline = frontlineSituation(game.cities, selectedCity.id, game.day, game.worldActors);
  const selectedLocalReputation = game.cityReputation?.[selectedCity.id] ?? 0;
  const selectedStanding = cityStanding(selectedLocalReputation);
  const selectedStandingProgress = cityStandingProgress(selectedLocalReputation);
  const currentJianghuStanding = jianghuStanding(game.jianghuReputation);
  const currentJianghuProgress = jianghuStandingProgress(game.jianghuReputation);
  const rivalViews = rivalBureauViews(game);
  const playerRivalRank = rivalRank(game.jianghuReputation);
  const playerLeaguePosition = 1 + rivalViews.filter((item) => item.bureau.reputation > game.jianghuReputation).length;
  const selectedFaction = FACTIONS[selectedState.owner];
  const selectedFactionRelation = game.relations[selectedState.owner] ?? 0;
  const selectedFactionStanding = factionStanding(selectedFactionRelation);
  const selectedFactionProgress = factionStandingProgress(selectedFactionRelation);
  const selectedPermitActive = hasActivePermit(game, selectedState.owner);
  const activeRoutes = game.phase === "planning" ? [] : game.journey?.plan.routeIds ?? [];
  const currentCity = cityById(game.currentCityId);
  const dispatchedCrewIds = deputyDispatchCrewIds(game);
  const activeDeputyDispatch = game.deputyDispatches[0] ?? null;
  const dispatchBoard = deputyDispatchBoard(game);
  const activeCrew = game.activeCrewIds.map((id) => game.crew.find((member) => member.id === id)).filter((member) => Boolean(member && !member.captivity && !dispatchedCrewIds.has(member.id)));
  const journeyStance = travelStanceById(game.journey?.stance);
  const previewedRoutePlan = routePlans.find((plan) => plan.id === effectiveRoutePreviewId) ?? routePlans[0] ?? game.journey?.plan;
  const previewedRouteIndex = previewedRoutePlan ? routePlans.findIndex((plan) => plan.id === previewedRoutePlan.id) : -1;
  const previewedRouteForecast = previewedRoutePlan && game.phase === "planning" ? routePlanTravelForecast(game, previewedRoutePlan) : null;
  const previewedRouteReadiness = previewedRoutePlan && game.phase === "planning" ? departureReadinessForPlan(game, previewedRoutePlan) : null;
  const previewedRouteIsPreferred = previewedRoutePlan?.id === preferredRoutePreviewId;
  const planningBorderFactions = previewedRoutePlan ? routeBorderFactions(game, previewedRoutePlan) : [];
  const planningCoverTarget = planningBorderFactions[0] ?? null;
  const journeyCover = travelCoverById(game.journey?.coverId);
  const journeyCoverAssessment = travelCoverAssessment(game, journeyCover.id, planningCoverTarget);
  const currentBorderFaction = game.currentEvent?.kind === "border" && game.journey
    ? game.cities[game.journey.plan.cityIds[game.journey.segmentIndex + 1]]?.owner ?? null
    : null;
  const currentBorderCoverAssessment = currentBorderFaction ? travelCoverAssessment(game, journeyCover.id, currentBorderFaction) : null;
  const stopoverRouteId = game.currentEvent?.kind === "waystation" && game.journey ? game.journey.plan.routeIds[game.journey.segmentIndex] : null;
  const stopoverForecast = stopoverRouteId ? segmentTravelForecast(game, stopoverRouteId) : null;
  const stopoverLandmark = stopoverRouteId ? primaryLandmarkForRoute(stopoverRouteId) : null;
  const stopoverRoutes = game.currentEvent?.kind === "waystation" ? stopoverRouteOptions(game) : [];
  const stopoverDispositions = game.currentEvent?.kind === "waystation" ? journeyDispositionOptions(game) : [];
  const currentOffice = game.offices[game.currentCityId];
  const officeOffer = officeActionOffer(game);
  const currentContacts = localContacts(game);
  const aidOffer = cityAidOffer(game);
  const audienceOffer = factionAudienceOffer(game);
  const permitOffer = factionPermitOffer(game);
  const selectedOffice = game.offices[selectedCity.id];
  const selectedHasMajorOffice = Boolean(selectedOffice?.active && (selectedOffice.tier === "headquarters" || selectedOffice.tier === "branch"));
  const selectedContractCount = contractCountForCity(selectedState, selectedHasMajorOffice, selectedLocalReputation);
  const activeContract = game.journey?.contract;
  const activeSpecialHandling = specialHandlingForContract(activeContract);
  const cargoGaugeLabel = activeContract?.kind === "escort" ? "人身" : activeContract?.kind === "letter" ? "信物" : activeSpecialHandling?.gaugeLabel ?? "货物";
  const activeWagon = WAGONS[game.convoy.wagonId];
  const activeHorses = HORSE_TEAMS[game.convoy.horseTeamId];
  const careerObjectives = careerObjectiveProgress(game);
  const currentCareerObjective = careerObjectives.find((item) => item.status === "ready" || item.status === "active") ?? careerObjectives[careerObjectives.length - 1];
  const ending = careerEnding(game);
  const endingLegacy = ending ? LEGACY_BOON_LIST.find((item) => item.unlockEnding === ending.id) : undefined;
  const settlementEquipment = game.settlement?.equipmentReward ? EQUIPMENT[game.settlement.equipmentReward] : null;
  const principles = conductPrinciples(game);
  const unlockedPrinciples = principles.filter((principle) => principle.unlocked);
  const sideTradeOffer = tradeOffer(game);
  const activeTradeGood = game.journey?.tradeLot ? TRADE_GOODS[game.journey.tradeLot.goodId] : null;
  const activeMartialArt = martialArtById(game.martialArtId);
  const injuredCrewCount = game.crew.filter((member) => member.injury && !member.captivity).length;
  const captiveCrewCount = game.crew.filter((member) => member.captivity).length;
  const planningForecasts = game.phase === "planning" ? routePlans.map((plan) => routePlanTravelForecast(game, plan)) : [];
  const planningMinimumSupply = planningForecasts.length ? Math.min(...planningForecasts.map((forecast) => forecast.supplyCost)) : 0;
  const planningMinimumStamina = planningForecasts.length ? Math.min(...planningForecasts.map((forecast) => forecast.staminaCost)) : 0;
  const planningSupplyShortfall = Math.max(0, planningMinimumSupply - game.supplies);
  const planningNeedsTreatment = game.convoy.leaderHp < 100 || Boolean(game.leader.injury) || game.crew.some((member) => !member.captivity && !dispatchedCrewIds.has(member.id) && (member.hp < member.maxHp || Boolean(member.injury)));
  const isCurrentCity = selectedCity.id === game.currentCityId;
  const cityPriority = cityActionPriority(game);
  const preparationIssueCount = [
    game.convoy.cartHp < 65,
    game.convoy.horseHp < 65,
    game.convoy.horseStamina < 40,
    game.supplies < 4,
    game.convoy.leaderHp < 58 || Boolean(game.leader.injury) || injuredCrewCount > 0,
  ].filter(Boolean).length;
  const chooseCityWorkspace = (tab: CityWorkspaceTab) => {
    setCityWorkspace(tab);
    window.requestAnimationFrame(() => sidePanelRef.current?.scrollTo({ top: 0, behavior: "smooth" }));
  };

  return (
    <main className="game-root">
      <header className="game-header">
        <button className="brand" onClick={() => setGame({ ...game, selectedCityId: game.currentCityId })}>
          <span className="brand-mark">風雲</span>
          <span><b>镖局</b><small>天下行录</small></span>
        </button>
        <div className="world-clock"><span>嘉定元年 · 第</span><b>{game.day}</b><span>日</span></div>
        <div className="resources" aria-label="镖局资源">
          <span><small>银两</small><b>{game.silver}</b></span>
          <span><small>补给</small><b>{game.supplies}</b></span>
          <span title="商业信用：决定高价值委托、车马器械与行栈对你的信任"><small>信用</small><b>{game.reputation}</b></span>
          <span className="resource-jianghu" title={`${currentJianghuStanding.label}：${currentJianghuStanding.description}`}><small>江湖</small><b>{game.jianghuReputation}</b></span>
        </div>
        <div className="header-actions">
          <span className={`save-state ${savePulse ? "is-saving" : ""}`}>{savePulse ? "已落档" : "自动存档"}</span>
          <AudioToggle enabled={gameAudio.enabled} onToggle={gameAudio.toggle} />
          <button className="icon-button" onClick={() => setShowHelp(true)} aria-label="查看玩法说明">?</button>
          <button className="icon-button" onClick={() => setLaunch("title")} aria-label="返回题屏">⌂</button>
        </div>
      </header>

      <div className="game-layout">
        <section className="map-column">
          <Suspense fallback={<div className="map-stage map-loading"><div className="loading-seal">图</div><p>正在铺展天下舆图…</p></div>}>
            <WorldMap
              game={game}
              selectedCityId={game.selectedCityId}
              activeRouteIds={activeRoutes}
              deputyRouteIds={game.deputyDispatches.map((dispatch) => dispatch.routeId)}
              routeCandidates={mapRouteCandidates}
              previewRouteId={effectiveRoutePreviewId}
              onPreviewRoute={setPreviewRoutePlanId}
              onSelectCity={(cityId) => setGame({ ...game, selectedCityId: cityId })}
            />
          </Suspense>
          <div className="news-strip">
            <span className="news-label">驿 报</span>
            <div className="news-items">{game.news.slice(0, 3).map((item, index) => <p key={`${item}-${index}`}>{item}</p>)}</div>
          </div>
        </section>

        <aside className="side-panel" ref={sidePanelRef}>
          {game.phase === "map" && (
            <>
              <div className="panel-heading">
                <div><span className="kicker">{selectedCity.subtitle}</span><h2>{selectedCity.name}</h2><small className="geo-coordinates">东经 {selectedCity.lon.toFixed(2)}° · 北纬 {selectedCity.lat.toFixed(2)}°</small></div>
                <span className="faction-seal" style={{ borderColor: selectedFaction.color, color: selectedFaction.color }}>{selectedFaction.short}</span>
              </div>
              <p className="city-description">{selectedCity.description}</p>
              <div className={`city-weather-note weather-${selectedWeather.kind}`} aria-label={`${selectedCity.name}今日天候：${selectedWeather.label}`}>
                <i>{selectedWeather.seal}</i>
                <span><small>{selectedWeather.region.name} · 今日天象</small><b>{selectedWeather.label}</b><em>{selectedWeather.description}</em></span>
                <strong>{selectedWeatherOutlook}</strong>
              </div>
              {isCurrentCity && <>
                <div className="city-brief-strip" aria-label="本城要况">
                  <span><small>城况</small><b>{selectedEffect.label}</b></span>
                  <span><small>繁荣／治安</small><b>{selectedState.prosperity}／{selectedState.security}</b></span>
                  <span><small>本地声望</small><b>{selectedLocalReputation}</b></span>
                  <span><small>{selectedFaction.short}往来</small><b>{selectedFactionRelation >= 0 ? "+" : ""}{selectedFactionRelation}</b></span>
                </div>
                <section className={`city-action-priority tone-${cityPriority.tone}`} aria-label="今日先办">
                  <i>{cityPriority.seal}</i>
                  <span><small>{cityPriority.eyebrow}</small><b>{cityPriority.title}</b><em>{cityPriority.detail}</em></span>
                  <button onClick={() => chooseCityWorkspace(cityPriority.tab)}>去{CITY_WORKSPACE_TABS.find((tab) => tab.id === cityPriority.tab)?.label ?? "办理"}<strong>→</strong></button>
                </section>
                <nav className="city-workspace-tabs" role="tablist" aria-label="城市事务分章">
                  {CITY_WORKSPACE_TABS.map((tab) => {
                    const badge = tab.id === "overview" ? selectedEffect.seal : tab.id === "contracts" ? `${game.contracts.length}` : tab.id === "prepare" ? `${preparationIssueCount}` : captiveCrewCount ? `${captiveCrewCount}俘` : injuredCrewCount ? `${injuredCrewCount}伤` : `${game.crew.length}`;
                    return <button key={tab.id} id={`city-tab-${tab.id}`} role="tab" aria-selected={cityWorkspace === tab.id} aria-controls={`city-pane-${tab.id}`} className={cityWorkspace === tab.id ? "is-active" : ""} onClick={() => chooseCityWorkspace(tab.id)}>
                      <i>{tab.seal}</i><span><b>{tab.label}</b><small>{tab.note}</small></span><em>{badge}</em>
                    </button>;
                  })}
                </nav>
              </>}
              <section hidden={isCurrentCity && cityWorkspace !== "overview"} className={`city-gazette status-${selectedState.status}`} aria-label={`${selectedCity.name}城志`}> 
                <div className="gazette-heading">
                  <span className="condition-seal">{selectedEffect.seal}</span>
                  <div><small>本城近况 · {game.day - selectedState.intelDay > 2 ? `${game.day - selectedState.intelDay}日前旧闻` : "驿报已核"}</small><b>{selectedEffect.label}</b><p>{selectedEffect.description}</p></div>
                </div>
                <div className="city-vitals">
                  <div><span>繁荣</span><i><em style={{ width: `${selectedState.prosperity}%` }} /></i><b>{selectedState.prosperity}</b></div>
                  <div><span>治安</span><i><em style={{ width: `${selectedState.security}%` }} /></i><b>{selectedState.security}</b></div>
                </div>
                {selectedFrontline.visible && <div className={`frontline-intel risk-${selectedFrontline.risk}`} aria-label={`${selectedCity.name}战线军情 ${selectedFrontline.label}`}>
                  <i>{selectedFrontline.seal}</i>
                  <span><small>战线军情 · 本阶段第 {selectedFrontline.age + 1} 日</small><b>{selectedFrontline.label}</b><em>{selectedFrontline.detail}</em><u>{selectedFrontline.nextWarning}</u></span>
                  <strong><small>守势</small>{selectedFrontline.defense}<em><small>兵压</small>{selectedFrontline.pressure}</em></strong>
                </div>}
                <div className={`city-standing standing-${selectedStanding.tier}`}>
                  <span className="standing-seal">{selectedStanding.seal}</span>
                  <div>
                    <small>风云行在本城 · 声望 {selectedLocalReputation}</small>
                    <b>{selectedStanding.label}</b>
                    <p>{selectedStanding.description}</p>
                    <i><em style={{ width: `${selectedStandingProgress.percent}%` }} /></i>
                  </div>
                  <strong>{selectedStanding.nextAt ? `距下阶 ${Math.max(0, selectedStanding.nextAt - selectedLocalReputation)}` : "名满一方"}</strong>
                </div>
                <div className={`faction-standing faction-standing-${selectedFactionStanding.tier}`}>
                  <span className="faction-standing-seal" style={{ borderColor: selectedFaction.color, color: selectedFaction.color }}>{selectedFactionStanding.seal}</span>
                  <div className="faction-standing-copy">
                    <small>{selectedFaction.name}往来 · {selectedFactionRelation >= 0 ? "+" : ""}{selectedFactionRelation}</small>
                    <b>{selectedFactionStanding.label}</b>
                    <p>{selectedFactionStanding.description}</p>
                    <i><em style={{ width: `${selectedFactionProgress.value}%`, background: selectedFaction.color }} /></i>
                  </div>
                  <div className="faction-standing-effects">
                    <span>关费 {Math.round(selectedFactionStanding.passageMultiplier * 100)}%</span>
                    <span>酬金 {Math.round(selectedFactionStanding.rewardMultiplier * 100)}%</span>
                    <span className={selectedPermitActive ? "has-permit" : ""}>{selectedPermitActive ? `路引至 ${game.travelPermits?.[selectedState.owner] ?? 0} 日` : "尚无路引"}</span>
                  </div>
                  {selectedCity.id === game.currentCityId && (
                    <div className="faction-standing-actions">
                      <button disabled={!audienceOffer.enabled} onClick={() => setGame(attendFactionAudience(game))}>
                        {!audienceOffer.eligibleCity ? "仅府城可拜会" : audienceOffer.cooldownDays ? `${audienceOffer.cooldownDays}日后再会` : selectedFactionRelation >= 50 ? "往来已满" : `拜会行院 · ${audienceOffer.cost}两`}
                      </button>
                      <button disabled={!permitOffer.enabled} onClick={() => setGame(acquireFactionPermit(game))}>
                        {permitOffer.active ? `路引至第 ${permitOffer.expiresDay} 日` : !permitOffer.eligibleCity ? "仅府城受牒" : selectedFactionRelation < permitOffer.relationRequired ? `需往来 ${permitOffer.relationRequired}` : `申领路引 · ${permitOffer.cost}两`}
                      </button>
                    </div>
                  )}
                </div>
                <div className="market-omens">
                  <span><small>行情</small><b>{selectedEffect.priceMultiplier < 1 ? "价低" : selectedEffect.priceMultiplier > 1.12 ? "价昂" : "价稳"} · 综合 {Math.round((1 - selectedStanding.priceMultiplier * selectedFactionStanding.priceMultiplier) * 100)}%</b></span>
                  <span><small>镖榜</small><b>{selectedContractCount} 份 · 酬金 {Math.round(selectedEffect.rewardMultiplier * selectedStanding.rewardMultiplier * selectedFactionStanding.rewardMultiplier * 100)}%</b></span>
                  <span><small>人才</small><b>{selectedEffect.recruitCount} 帖 · {selectedEffect.recruitQuality + selectedStanding.recruitQuality > 0 ? "多有熟手" : selectedEffect.recruitQuality + selectedStanding.recruitQuality < 0 ? "人手凋零" : "寻常"}</b></span>
                </div>
                {selectedCity.id === game.currentCityId && aidOffer.available && (
                  <div className="city-aid">
                    <div><b>地方急务 · {aidOffer.label}</b><small>{aidOffer.detail}</small></div>
                    <button disabled={!aidOffer.enabled} onClick={() => setGame(supportCurrentCity(game))}>{aidOffer.cooldownDays ? `${aidOffer.cooldownDays}日后可再助` : `${aidOffer.silverCost}两${aidOffer.supplyCost ? ` · 补给${aidOffer.supplyCost}` : ""}`}</button>
                  </div>
                )}
              </section>
              <div hidden={isCurrentCity && cityWorkspace !== "overview"} className="specialties">{selectedCity.specialties.map((item) => <span key={item}>{item}</span>)}</div>

              {isCurrentCity && cityWorkspace === "overview" && (
                <section className={`career-ledger career-${currentCareerObjective.status}`} aria-label="总号志业">
                  <div className="career-ledger-heading">
                    <div><small>总号志业 · 阶段 {currentCareerObjective.order}/3</small><b>{currentCareerObjective.title}</b></div>
                    <span>{game.career?.claimedObjectiveIds.length ?? 0} 印已成</span>
                  </div>
                  <div className="career-path" aria-label="志业进度">
                    {careerObjectives.map((objective) => (
                      <div key={objective.id} className={`career-node is-${objective.status}`} title={objective.title}>
                        <i>{objective.status === "claimed" ? "✓" : objective.seal}</i><span>{objective.title}</span>
                      </div>
                    ))}
                  </div>
                  <p>{currentCareerObjective.description}</p>
                  <div className="career-requirements">
                    {currentCareerObjective.requirements.map((item) => (
                      <span key={item.label} className={item.complete ? "is-complete" : ""}><i>{item.complete ? "成" : `${Math.min(item.current, item.target)}/${item.target}`}</i>{item.label}</span>
                    ))}
                  </div>
                  <div className="career-progress"><i style={{ width: `${currentCareerObjective.progress}%` }} /></div>
                  <div className="career-reward">
                    <span>{currentCareerObjective.subtitle}</span>
                    <small>赏银 {currentCareerObjective.reward.silver} · 信用 +{currentCareerObjective.reward.reputation}</small>
                    <button disabled={currentCareerObjective.status !== "ready"} onClick={() => setGame(claimCareerObjective(game, currentCareerObjective.id))}>
                      {currentCareerObjective.status === "ready" ? currentCareerObjective.id === "renowned-escort" ? "落下终印" : "盖印领赏" : "条件未齐"}
                    </button>
                  </div>
                </section>
              )}

              {isCurrentCity && cityWorkspace === "overview" && (
                <section className="rival-league" aria-label="天下镖行榜">
                  <header className="rival-league-heading">
                    <div><small>天下同行 · 随道路真实行进</small><b>天下镖行榜</b><p>别家也在接镖、交割和失期；途中相逢会留下关系与名次。</p></div>
                    <span><i>榜</i><strong>第 {playerLeaguePosition}</strong><small>/ {rivalViews.length + 1} 席</small></span>
                  </header>
                  <article className="rival-player-row">
                    <i>風</i>
                    <div><small>本号 · {playerRivalRank.label}</small><b>风云镖局</b><span>已成交 {game.completedContracts} 镖 · 江湖名望 {game.jianghuReputation}</span></div>
                    <em><span style={{ width: `${Math.max(4, game.jianghuReputation)}%` }} /></em>
                    <strong>当前第 {playerLeaguePosition} 席</strong>
                  </article>
                  <div className="rival-league-list">
                    {rivalViews.map((item) => (
                      <article key={item.bureau.id} className={`rival-league-row relation-${item.relation.tone}`}>
                        <span className="rival-place">{item.position}</span>
                        <i className="rival-seal">{item.bureau.seal}</i>
                        <div className="rival-identity">
                          <small>{item.rank.label} · 名望 {item.bureau.reputation}</small>
                          <b>{item.bureau.name}</b>
                          <em>{item.bureau.specialty}</em>
                        </div>
                        <div className="rival-route-progress">
                          <span><small>{item.routeName}</small><b>{item.pathLabel}</b></span>
                          <i><em style={{ width: `${item.progress}%` }} /></i>
                          <small>{item.actor ? `已行 ${item.progress}% · 约 ${item.etaDays} 日抵站` : "行踪未明"}</small>
                        </div>
                        <div className="rival-record">
                          <span className={`rival-relation relation-${item.relation.tone}`}><i>{item.relation.seal}</i>{item.relation.label}<small>{item.bureau.relation >= 0 ? "+" : ""}{item.bureau.relation}</small></span>
                          <b>{item.bureau.completedContracts} 成 · {item.bureau.setbacks} 失</b>
                        </div>
                        <p><small>第 {item.bureau.lastReportDay} 日行报</small>{item.bureau.lastReport}</p>
                      </article>
                    ))}
                  </div>
                  <footer><span>同行抵站才会结算一趟生意</span><small>合旗增交情 · 争先伤和气 · 放大地图可追看镖旗</small></footer>
                </section>
              )}

              {isCurrentCity && cityWorkspace === "overview" && (
                <details className="principles-ledger">
                  <summary>
                    <span className="principles-title"><i>规</i><b>行号风骨</b><small>所行之事，终成江湖之名</small></span>
                    <span className="principles-count">{unlockedPrinciples.length}<small>/5 成名</small></span>
                  </summary>
                  <div className="principles-grid">
                    {principles.map((principle) => (
                      <article key={principle.id} className={principle.unlocked ? "is-unlocked" : "is-forming"}>
                        <span className="principle-seal">{principle.seal}</span>
                        <div className="principle-copy"><b>{principle.title}</b><small>{principle.unlocked ? principle.proverb : principle.description}</small></div>
                        <div className="principle-state"><span>{principle.unlocked ? principle.effect : `${Math.min(principle.current, principle.threshold)} / ${principle.threshold}`}</span><i><em style={{ width: `${principle.progress}%` }} /></i></div>
                      </article>
                    ))}
                  </div>
                </details>
              )}

              {isCurrentCity ? (
                <>
                  <section id="city-pane-overview" role="tabpanel" aria-labelledby="city-tab-overview" className="city-workspace-pane" hidden={cityWorkspace !== "overview"}>
                    <div className="section-rule"><span>镖局网点</span></div>
                    <div className={`office-card office-${currentOffice?.tier ?? "none"} ${currentOffice && !currentOffice.active ? "is-closed" : ""}`}>
                      <div className="office-seal">{currentOffice?.tier === "headquarters" ? "總" : currentOffice?.tier === "branch" ? "號" : currentOffice?.tier === "outpost" ? "樁" : "未"}</div>
                      <div>
                        <span>{currentOffice?.tier === "headquarters" ? `${currentCity.name}总号` : currentOffice?.tier === "branch" ? "风云行分号" : currentOffice?.tier === "outpost" ? "本地暗桩" : "尚未落脚"}</span>
                        <b>{currentOffice && !currentOffice.active ? "易主后闭门待牌" : currentOffice?.tier === "headquarters" ? "总揽镖榜 · 整备七五折" : currentOffice?.tier === "branch" ? "增开一份镖榜 · 整备八折" : currentOffice?.tier === "outpost" ? "自动核验周边路报 · 整备九折" : "建立网点，把一次行路变成长期资产"}</b>
                        {officeOffer.action !== "none" && <small>需总信用 {officeOffer.reputation} · 本地声望 {officeOffer.localReputation} · 花银 {officeOffer.cost} 两</small>}
                      </div>
                      {officeOffer.action !== "none" && <button disabled={!officeOffer.enabled} onClick={() => setGame(establishOffice(game))}>{officeOffer.label}</button>}
                    </div>
                    <div className="section-rule"><span>本地人情 · {currentContacts.length} 位</span></div>
                    <section className="contact-ledger" aria-label={`${currentCity.name}本地人情`}>
                      <header>
                        <i>情</i>
                        <span><small>往来名帖 · 人情可支用</small><b>{currentContacts.length ? `${currentContacts[0].name}最为相熟` : "尚无可托之人"}</b></span>
                        <em>{currentContacts.reduce((sum, contact) => sum + contact.favor, 0)}<small>总人情</small></em>
                      </header>
                      {currentContacts.length === 0 ? <p className="contact-empty">从本城接镖并完成交割后，托运人会把你的旗号记进人情簿。</p> : <div className="contact-list">
                        {currentContacts.map((contact) => {
                          const tier = contactFavorTier(contact.favor);
                          const patron = contactPatronProfile(contact.patron);
                          const offer = contactFavorOffer(game, contact.id)!;
                          return <article key={contact.id} className={`contact-row tier-${tier.tier}`}>
                            <i className="contact-seal">{patron.seal}</i>
                            <div className="contact-copy">
                              <small>{patron.label} · {tier.label} · 成 {contact.completedJobs}／失 {contact.failedJobs}</small>
                              <b>{contact.name}</b>
                              <em>{contact.lastNote}</em>
                            </div>
                            <div className="contact-favor" aria-label={`人情 ${contact.favor}，${tier.label}`}>
                              <strong>{contact.favor}</strong><small>人情</small>
                              <i><em style={{ width: `${(contact.favor / MAX_CONTACT_FAVOR) * 100}%` }} /></i>
                            </div>
                            <button disabled={!offer.enabled} title={offer.disabledReason ?? patron.actionDescription} onClick={() => setGame(callInContactFavor(game, contact.id))}>
                              <i>{patron.actionSeal}</i><span><b>{patron.actionLabel}</b><small>{offer.enabled ? `耗 ${offer.cost} 人情 · ${patron.actionDescription}` : offer.disabledReason}</small></span>
                            </button>
                          </article>;
                        })}
                      </div>}
                      <footer>甲、乙、丙等交镖会分别积累 12、7、2 点人情；失镖会伤及旧交。请托后需隔七日再开口。</footer>
                    </section>
                  </section>
                  <section id="city-pane-contracts" role="tabpanel" aria-labelledby="city-tab-contracts" className="city-workspace-pane" hidden={cityWorkspace !== "contracts"}>
                    <div className="section-rule"><span>本城镖榜 · {game.contracts.length} 份</span></div>
                    <div className="workspace-intro"><i>择</i><span><b>先看去处，再问信物</b><small>目的地、时限与可疑征象直接列在每张镖单上；访查不会替你接单。</small></span></div>
                    {contractBoardAssessments[0] && (() => {
                      const leading = game.contracts.find((contract) => contract.id === contractBoardAssessments[0].contractId)!;
                      const assessment = contractBoardAssessments[0];
                      return <section className={`contract-board-leading forecast-${assessment.tone}`} aria-label="当前车马最合适的镖单">
                        <i>{assessment.seal}</i><span><small>镖榜校勘 · 相对最合现状</small><b>{leading.title} · 至{cityById(leading.to).name}</b><em>{assessment.title}；预计 {assessment.days} 日，日均镖酬 {assessment.rewardPerDay} 两。</em></span>
                      </section>;
                    })()}
                    <div className="contracts-list">{contractBoardAssessments.map((assessment) => {
                      const contract = game.contracts.find((item) => item.id === assessment.contractId)!;
                      return <ContractCard key={contract.id} game={game} contract={contract} assessment={assessment} onInvestigate={(id, method) => setGame(investigateContract(game, id, method))} onNegotiate={(id, negotiationId) => setGame(negotiateContract(game, id, negotiationId))} onAccept={(id) => setGame(acceptContract(game, id))} />;
                    })}</div>
                  </section>
                  <section id="city-pane-prepare" role="tabpanel" aria-labelledby="city-tab-prepare" className="city-workspace-pane" hidden={cityWorkspace !== "prepare"}>
                    <div className="section-rule"><span>行前整备</span></div>
                    <div className="service-grid">
                    <button disabled={game.silver < serviceCost(game, "supplies")} onClick={() => setGame(purchaseService(game, "supplies"))}><b>添置干粮</b><small>{serviceCost(game, "supplies")} 两 · +{supplyPurchaseAmount(game)} 补给</small></button>
                    <button disabled={game.silver < serviceCost(game, "intel")} onClick={() => setGame(purchaseService(game, "intel"))}><b>购买舆报</b><small>{serviceCost(game, "intel")} 两 · 本地路报</small></button>
                    <button disabled={game.silver < serviceCost(game, "repair")} onClick={() => setGame(purchaseService(game, "repair"))}><b>修整镖车</b><small>{serviceCost(game, "repair")} 两 · +30 车况</small></button>
                    <button disabled={game.silver < serviceCost(game, "heal")} onClick={() => setGame(purchaseService(game, "heal"))}><b>延医问药</b><small>{serviceCost(game, "heal")} 两 · 恢复气血{injuredCrewCount ? ` · 调养 ${injuredCrewCount} 处伤势` : ""}</small></button>
                    <button disabled={game.silver < serviceCost(game, "stable")} onClick={() => setGame(purchaseService(game, "stable"))}><b>投宿马院</b><small>{serviceCost(game, "stable")} 两 · 马力 +48 / 伤势 +26</small></button>
                  </div>
                  <div className="section-rule"><span>车马行装</span></div>
                  <section className="convoy-ledger" aria-label="镖车马匹与改装">
                    <div className={`convoy-portrait wagon-${game.convoy.wagonId}`} aria-hidden="true">
                      <span className="wagon-canopy">風雲</span><i className="wagon-wheel wheel-a" /><i className="wagon-wheel wheel-b" /><em className="horse-pair">驥</em>
                    </div>
                    <div className="convoy-current">
                      <div><small>在用镖车</small><b>{activeWagon.name}</b><span>{activeWagon.description}</span></div>
                      <div><small>套车牲口</small><b>{activeHorses.name}</b><span>{activeHorses.description}</span></div>
                    </div>
                    <div className="convoy-condition">
                      <Gauge label="车况" value={game.convoy.cartHp} danger />
                      <Gauge label="马匹" value={game.convoy.horseHp} danger />
                      <Gauge label="马力" value={game.convoy.horseStamina} />
                    </div>
                    <div className="convoy-slots"><span>改装位 {game.convoy.upgrades.length}/{activeWagon.upgradeSlots}</span>{game.convoy.upgrades.length ? game.convoy.upgrades.map((id) => <b key={id}>{CONVOY_UPGRADES[id].seal} · {CONVOY_UPGRADES[id].name}</b>) : <i>尚未改装</i>}</div>
                    <div className="asset-shop-heading"><span>车马铺</span><small>总号与分号按整备折扣计价</small></div>
                    <div className="asset-shop-row">
                      {Object.values(WAGONS).map((wagon) => {
                        const current = wagon.id === game.convoy.wagonId;
                        const cost = wagonPurchaseCost(game, wagon.id);
                        const tooFewSlots = game.convoy.upgrades.length > wagon.upgradeSlots;
                        return <button key={wagon.id} className={current ? "is-equipped" : ""} title={wagon.description} disabled={current || game.silver < cost || tooFewSlots} onClick={() => setGame(purchaseWagon(game, wagon.id))}><i>{wagon.seal}</i><b>{wagon.name}</b><small>{current ? "在用" : tooFewSlots ? "改装位不足" : `${cost} 两`}</small></button>;
                      })}
                    </div>
                    <div className="asset-shop-row">
                      {Object.values(HORSE_TEAMS).map((horses) => {
                        const current = horses.id === game.convoy.horseTeamId;
                        const cost = horseTeamPurchaseCost(game, horses.id);
                        return <button key={horses.id} className={current ? "is-equipped" : ""} title={horses.description} disabled={current || game.silver < cost} onClick={() => setGame(purchaseHorseTeam(game, horses.id))}><i>{horses.seal}</i><b>{horses.name}</b><small>{current ? "在用" : `${cost} 两`}</small></button>;
                      })}
                    </div>
                    <div className="upgrade-shop">
                      {Object.values(CONVOY_UPGRADES).map((upgrade) => {
                        const installed = game.convoy.upgrades.includes(upgrade.id);
                        const cost = convoyUpgradePurchaseCost(game, upgrade.id);
                        const full = game.convoy.upgrades.length >= activeWagon.upgradeSlots;
                        const locked = game.reputation < upgrade.reputationRequired;
                        return <button key={upgrade.id} className={installed ? "is-equipped" : ""} title={upgrade.description} disabled={installed || full || locked || game.silver < cost} onClick={() => setGame(purchaseConvoyUpgrade(game, upgrade.id))}><i>{upgrade.seal}</i><span><b>{upgrade.name}</b><small>{installed ? "已装" : locked ? `需信用 ${upgrade.reputationRequired}` : full ? "改装位已满" : `${cost} 两`}</small></span></button>;
                      })}
                    </div>
                    </section>
                  </section>
                  <section id="city-pane-crew" role="tabpanel" aria-labelledby="city-tab-crew" className="city-workspace-pane" hidden={cityWorkspace !== "crew"}>
                    <div className="section-rule"><span>镖局名册 · {game.crew.length}/{CREW_CAPACITY}</span></div>
                    <div className="crew-overview">
                    {game.crew.map((member) => {
                      const rank = crewRank(member.experience);
                      const injury = crewInjuryById(member.injury?.id);
                      const mastery = crewMasteryForRole(member.role, rank.level);
                      const dispatch = game.deputyDispatches.find((item) => item.crewIds.includes(member.id));
                      return (
                        <div key={member.id} className={`${member.hp < 20 ? "is-wounded" : ""} ${injury ? `has-injury severity-${injury.severity}` : ""} ${member.captivity ? "is-captive" : ""} ${dispatch ? "is-dispatched" : ""}`} title={member.biography}>
                          <span className="crew-role">{member.role}</span>
                          <b>{member.name}<em>{rank.label}</em></b>
                          <small>字{member.courtesy} · {member.specialty} · 阅历 {member.experience}</small>
                          {mastery && <mark className="crew-mastery-tag">{mastery.seal} · {mastery.name}</mark>}
                          {injury && member.injury && <mark className="crew-injury-tag">{injury.seal} · {injury.name} · 余 {member.injury.remainingDays} 日</mark>}
                          {member.captivity && <mark className="crew-captivity-tag">俘 · {member.captivity.captor} · 第{member.captivity.sinceDay}日</mark>}
                          {dispatch && <mark className="crew-dispatch-tag">副 · 在途 · 第{dispatch.returnsDay}日归</mark>}
                          <i><em style={{ width: `${(member.hp / member.maxHp) * 100}%` }} /></i>
                          <strong>{member.hp}/{member.maxHp}</strong>
                        </div>
                      );
                    })}
                  </div>
                  <section className="deputy-dispatch-board" aria-label="副镖头分队押短镖">
                    <header><i>副</i><span><small>分旗经营 · 副镖头独立带队</small><b>{activeDeputyDispatch ? "副旗在途" : "副队短镖"}</b><p>分队三人承办邻城短镖，主队仍保留三人；结果按真实路险、队伍配置与回程日期结算。</p></span></header>
                    {activeDeputyDispatch ? (() => {
                      const elapsed = Math.max(0, game.day - activeDeputyDispatch.startedDay);
                      const total = Math.max(1, activeDeputyDispatch.returnsDay - activeDeputyDispatch.startedDay);
                      const members = activeDeputyDispatch.crewIds.map((id) => game.crew.find((member) => member.id === id)).filter(Boolean);
                      return <article className="deputy-dispatch-active">
                        <div className="deputy-dispatch-route"><span><small>{cityById(activeDeputyDispatch.fromCityId).name} → {cityById(activeDeputyDispatch.toCityId).name}</small><b>{activeDeputyDispatch.title}</b><em>{routeById(activeDeputyDispatch.routeId).name}</em></span><strong>第 {activeDeputyDispatch.returnsDay} 日归旗</strong></div>
                        <div className="deputy-dispatch-team">{members.map((member) => <span key={member!.id}><small>{member!.role}</small><b>{member!.name}</b></span>)}</div>
                        <div className="deputy-dispatch-metrics"><span><small>成镖把握</small><b>{activeDeputyDispatch.successChance}%</b></span><span><small>成镖净得</small><b>+{activeDeputyDispatch.successReward} 两</b></span><span><small>失手脚钱</small><b>-{activeDeputyDispatch.wageCost} 两</b></span><span><small>余程</small><b>{Math.max(0, activeDeputyDispatch.returnsDay - game.day)} 日</b></span></div>
                        <div className="deputy-dispatch-progress"><i><em style={{ width: `${Math.min(100, elapsed / total * 100)}%` }} /></i><span>{elapsed >= total ? "归报正在送入柜上" : `已行 ${elapsed} / ${total} 日`}</span></div>
                      </article>;
                    })() : dispatchBoard.available ? <div className="deputy-dispatch-offers">
                      {dispatchBoard.offers.map((offer) => <article key={offer.routeId} className={`risk-${offer.risk}`}>
                        <div className="deputy-dispatch-route"><span><small>{cityById(offer.fromCityId).name} → {cityById(offer.toCityId).name} · {offer.risk}险</small><b>{offer.title}</b><em>{offer.routeName} · 往返 {offer.days} 日</em></span><strong>路险 {offer.danger}</strong></div>
                        <p>{offer.roleNote}</p>
                        <div className="deputy-dispatch-team">{offer.crewIds.map((id) => { const member = game.crew.find((item) => item.id === id)!; return <span key={id}><small>{member.role}</small><b>{member.name}</b></span>; })}</div>
                        <div className="deputy-dispatch-metrics"><span><small>成镖把握</small><b>{offer.successChance}%</b></span><span><small>成镖净得</small><b>+{offer.successReward} 两</b></span><span><small>失手脚钱</small><b>-{offer.wageCost} 两</b></span></div>
                        <button onClick={() => setGame(startDeputyDispatch(game, offer.routeId))}>落副旗 · 发往{cityById(offer.toCityId).name}</button>
                      </article>)}
                    </div> : <p className="deputy-dispatch-empty">当前不能分旗：{dispatchBoard.reason}</p>}
                    {game.deputyDispatchReports.length > 0 && <div className="deputy-dispatch-reports"><strong>近日归报</strong>{game.deputyDispatchReports.slice(0, 2).map((report) => <p key={report.id} className={`outcome-${report.outcome}`}><i>{report.outcome === "success" ? "成" : report.outcome === "hard-won" ? "守" : "折"}</i><span><b>{report.title}</b><small>第 {report.resolvedDay} 日 · 银钱 {report.silverChange >= 0 ? "+" : ""}{report.silverChange} 两</small><em>{report.summary}</em></span></p>)}</div>}
                  </section>
                  <LeaderProgressionPanel game={game} onChange={setGame} />
                  <CrewEquipmentPanel game={game} onChange={setGame} />
                  <section className="jianghu-standing-card" aria-label={`江湖声望 ${game.jianghuReputation}，${currentJianghuStanding.label}`}>
                    <i>{currentJianghuStanding.seal}</i>
                    <div className="jianghu-standing-copy">
                      <small>江湖名帖 · 旗号所至</small>
                      <b>{currentJianghuStanding.label}<em>{game.jianghuReputation} / 100</em></b>
                      <p>{currentJianghuStanding.description}</p>
                      <span><i><em style={{ width: `${currentJianghuProgress.progress}%` }} /></i>{currentJianghuProgress.nextMin === null ? "已至最高声名" : `再得 ${currentJianghuProgress.remaining} 声望进下一阶`}</span>
                    </div>
                    <dl>
                      <div><dt>报字号</dt><dd>+{Math.round(currentJianghuStanding.bluffBonus * 100)}%</dd></div>
                      <div><dt>买路银</dt><dd>-{Math.round((1 - currentJianghuStanding.tollMultiplier) * 100)}%</dd></div>
                      <div><dt>延才身契</dt><dd>-{Math.round(currentJianghuStanding.recruitmentDiscount * 100)}%</dd></div>
                      <div><dt>江湖镖赏</dt><dd>+{Math.round((currentJianghuStanding.contractRewardMultiplier - 1) * 100)}%</dd></div>
                    </dl>
                  </section>
                  <div className="section-rule"><span>本地可招 · {cityById(game.recruitPoolCityId).name}</span></div>
                  <div className="recruitment-ledger">
                    {game.recruitPool.length ? game.recruitPool.map((member) => {
                      const rank = crewRank(member.experience);
                      const hiringCost = jianghuRecruitmentCost(member.hiringCost, game.jianghuReputation);
                      const cannotHire = game.crew.length >= CREW_CAPACITY || game.silver < hiringCost;
                      return (
                        <article key={member.id} className={`recruit-card role-${member.role}`}>
                          <span className="recruit-role-seal">{member.role.slice(0, 1)}</span>
                          <div className="recruit-name"><small>{member.role} · {rank.label}</small><b>{member.name}</b><i>字{member.courtesy}</i></div>
                          <p><strong>{member.specialty}</strong>{member.biography}</p>
                          <div className="recruit-terms"><span>体魄 {member.maxHp}</span><span>脚钱 {member.wage}两/镖</span><span>阅历 {member.experience}</span></div>
                          <button disabled={cannotHire} onClick={() => setGame(recruitCrew(game, member.id))}>
                            {game.crew.length >= CREW_CAPACITY ? "名册已满" : game.silver < hiringCost ? `尚缺 ${hiringCost - game.silver} 两` : <>延入镖局 · {hiringCost} 两{hiringCost < member.hiringCost && <del>{member.hiringCost}</del>}</>}
                          </button>
                        </article>
                      );
                    }) : <p className="recruit-empty">本城暂未寻到合适人手；换城行镖后，牙人会送来新的名帖。</p>}
                    </div>
                  </section>
                </>
              ) : (
                <div className="distant-city-note">
                  <span>相距在路上</span>
                  <p>镖队现驻 {currentCity.name}。要去往此城，先在本地镖榜上接取合适的委托。</p>
                  <button className="ghost-button" onClick={() => setGame({ ...game, selectedCityId: game.currentCityId })}>回看本城</button>
                </div>
              )}
            </>
          )}

          {game.phase === "planning" && game.journey && (
            <div className="planning-panel">
              <button className="back-link" onClick={() => setGame(cancelContractPlanning(game))}>← 放回镖榜</button>
              <span className="kicker">行前 · 路线筹划</span>
              <h2>{cityById(game.journey.contract.from).name} <i>至</i> {cityById(game.journey.contract.to).name}</h2>
              <div className="cargo-slip">
                <small>{CONTRACT_KIND_LABEL[game.journey.contract.kind]} · {CONTRACT_PATRON_LABEL[game.journey.contract.patron]} · {game.journey.contract.confidentiality}</small>
                <b>{game.journey.contract.cargo}</b><span>{game.journey.contract.brief}</span>
                {game.journey.contract.secretKnown && <em><strong>已查明</strong>{game.journey.contract.secret}</em>}
              </div>
              {previewedRoutePlan && previewedRouteForecast && previewedRouteReadiness && previewedRouteIndex >= 0 && (
                <section className={`planning-route-command readiness-${previewedRouteReadiness.tone}`} aria-label="当前预览路线与出发判断">
                  <header>
                    <i>{routeCandidateSeal(previewedRouteIndex)}</i>
                    <span>
                      <small>{previewedRouteIsPreferred ? "账房首荐 · 当前舆图预览" : "当前舆图预览 · 即时重算"}</small>
                      <b>{previewedRoutePlan.label}</b>
                    </span>
                    <strong>{previewedRouteReadiness.label}</strong>
                  </header>
                  <dl>
                    <div className={previewedRouteReadiness.deadlineMargin < 0 ? "is-deficit" : previewedRouteReadiness.deadlineMargin <= 2 ? "is-tight" : "is-sound"}><dt>期限</dt><dd>{previewedRouteReadiness.deadlineMargin < 0 ? `误 ${Math.abs(previewedRouteReadiness.deadlineMargin)}日` : `余 ${previewedRouteReadiness.deadlineMargin}日`}</dd></div>
                    <div className={previewedRouteReadiness.supplyBalance < 0 ? "is-deficit" : "is-sound"}><dt>行粮</dt><dd>{previewedRouteReadiness.supplyBalance < 0 ? `缺 ${Math.abs(previewedRouteReadiness.supplyBalance)}` : `余 ${previewedRouteReadiness.supplyBalance}`}</dd></div>
                    <div className={previewedRouteReadiness.staminaBalance < 0 ? "is-deficit" : "is-sound"}><dt>马力</dt><dd>{previewedRouteReadiness.staminaBalance < 0 ? `缺 ${Math.abs(previewedRouteReadiness.staminaBalance)}` : `余 ${previewedRouteReadiness.staminaBalance}`}</dd></div>
                    <div><dt>路险</dt><dd>{previewedRouteForecast.dangerLabel}</dd></div>
                  </dl>
                  <p>{previewedRouteReadiness.warnings[0] ?? previewedRouteReadiness.strengths[0] ?? previewedRouteReadiness.summary}</p>
                  <div className="planning-route-actions">
                    <button
                      className="planning-route-inspect"
                      onClick={() => {
                        const routeCard = document.getElementById(`route-plan-${previewedRoutePlan.id}`);
                        routeCard?.scrollIntoView({ behavior: "smooth", block: "start" });
                        routeCard?.focus({ preventScroll: true });
                      }}
                    >展开{routeCandidateSeal(previewedRouteIndex)}路路簿</button>
                    <button
                      className="primary-button"
                      disabled={game.activeCrewIds.length !== 3 || game.silver < journeyCover.cost}
                      onClick={() => setGame(chooseRoute(game, previewedRoutePlan))}
                    >
                      {game.activeCrewIds.length !== 3
                        ? "先点足三名随行人"
                        : game.silver < journeyCover.cost
                          ? `行装尚缺 ${journeyCover.cost - game.silver} 两`
                          : previewedRouteReadiness.tone === "danger"
                            ? `知险仍从${routeCandidateSeal(previewedRouteIndex)}路出发`
                            : `按${routeCandidateSeal(previewedRouteIndex)}路出发`}
                    </button>
                  </div>
                </section>
              )}
              {activeSpecialHandling && <section className="planning-special-rule" aria-label={`${activeSpecialHandling.name}行前规程`}>
                <i>{activeSpecialHandling.seal}</i><div><small>特镖行规</small><b>{activeSpecialHandling.name}</b><p>{activeSpecialHandling.rule}</p><em>{activeSpecialHandling.counterplay}</em></div>
              </section>}
              {sideTradeOffer && (
                <section className={`side-trade-lot ${sideTradeOffer.purchased ? "is-loaded" : ""}`} aria-label="顺路搭载本地副货">
                  <i>{sideTradeOffer.seal}</i>
                  <div>
                    <small>本地货栈 · 随镖副货</small>
                    <b>{sideTradeOffer.name}</b>
                    <p>{sideTradeOffer.description}</p>
                    <span>{sideTradeOffer.demandLabel}</span>
                  </div>
                  <dl>
                    <div><dt>本钱</dt><dd>{sideTradeOffer.purchasePrice} 两</dd></div>
                    <div><dt>预计回银</dt><dd>{sideTradeOffer.expectedRevenueMin === sideTradeOffer.expectedRevenueMax ? sideTradeOffer.expectedRevenueMin : `${sideTradeOffer.expectedRevenueMin}—${sideTradeOffer.expectedRevenueMax}`} 两</dd></div>
                    <div><dt>预计盈亏</dt><dd className={sideTradeOffer.expectedProfitMin < 0 ? "is-loss" : ""}>{sideTradeOffer.expectedProfitMin >= 0 ? "+" : ""}{sideTradeOffer.expectedProfitMin === sideTradeOffer.expectedProfitMax ? sideTradeOffer.expectedProfitMin : `${sideTradeOffer.expectedProfitMin}—${sideTradeOffer.expectedProfitMax >= 0 ? "+" : ""}${sideTradeOffer.expectedProfitMax}`} 两</dd></div>
                  </dl>
                  <button disabled={sideTradeOffer.purchased || game.silver < sideTradeOffer.purchasePrice} onClick={() => setGame(purchaseTradeLot(game))}>{sideTradeOffer.purchased ? "已随车装载" : game.silver < sideTradeOffer.purchasePrice ? "银钱不足" : `搭载副货 · ${sideTradeOffer.purchasePrice}两`}</button>
                  <em>最终卖价会随目的地城况与货损变化；放回镖榜时退还本钱。</em>
                </section>
              )}
              <section className="martial-planning" aria-label="选择镖头武学">
                <div className="martial-planning-heading"><span>镖头武学 · 临敌绝技</span><b>{activeMartialArt.technique}</b></div>
                <div className="martial-picks">
                  {MARTIAL_ART_LIST.map((martialArt) => (
                    <button
                      key={martialArt.id}
                      className={game.martialArtId === martialArt.id ? "is-selected" : ""}
                      aria-pressed={game.martialArtId === martialArt.id}
                      onClick={() => setGame(setMartialArt(game, martialArt.id))}
                    >
                      <i>{martialArt.seal}</i>
                      <span><small>{martialArt.school}</small><b>{martialArt.name}</b><em>{martialArt.technique}</em></span>
                    </button>
                  ))}
                </div>
                <p><b>{activeMartialArt.seal}</b><span>{activeMartialArt.description}<small>战中自动择机施展：{activeMartialArt.techniqueHint}。</small></span></p>
              </section>
              <CoreCombatFocusPicker game={game} onChange={setGame} compact />
              <p className="planning-note">路险与通断来自现有路报；旧闻可能已经失真。买报不耗时，遣趟子手可省银，但天下会再走一日，原定道路也可能在途中封闭。</p>
              <section className="crew-planning" aria-label="选择随行镖队">
                <div className="crew-planning-heading"><span>点将 · 随行三人</span><b>{game.activeCrewIds.length}/3</b></div>
                <p>职司会改变途中选择；重伤会拖慢赶路并削弱自动作战，气血低于二成或仍被扣押者不能出镖。</p>
                <div className="crew-picks">
                  {game.crew.map((member) => {
                    const selected = game.activeCrewIds.includes(member.id);
                    const wounded = member.hp < 20;
                    const captive = Boolean(member.captivity);
                    const dispatch = game.deputyDispatches.find((item) => item.crewIds.includes(member.id));
                    const injury = crewInjuryById(member.injury?.id);
                    const rank = crewRank(member.experience);
                    const mastery = crewMasteryForRole(member.role, rank.level);
                    const bond = member.role === "副镖头" ? deputyBondRank(game.leader.deputyBonds[member.id] ?? 0) : null;
                    return (
                      <button
                        key={member.id}
                        className={`${selected ? "is-selected" : ""} ${wounded ? "is-wounded" : ""} ${injury ? `has-injury severity-${injury.severity}` : ""} ${captive ? "is-captive" : ""} ${dispatch ? "is-dispatched" : ""}`}
                        aria-pressed={selected}
                        disabled={wounded || captive || Boolean(dispatch)}
                        onClick={() => setGame(toggleJourneyCrew(game, member.id))}
                      >
                        <span>{captive ? "路上失陷 · 暂不可点将" : dispatch ? `副旗在途 · 第${dispatch.returnsDay}日归` : `${member.role} · ${rank.label}${bond ? ` · 主副${bond.label}` : ""}`}</span><b>{member.name}</b><small>{captive ? `被${member.captivity?.captor}扣押 · 前往人物页查看赎回路引` : dispatch ? `随${game.crew.find((item) => item.id === dispatch.crewIds[0])?.name ?? "副镖头"}承办「${dispatch.title}」` : `${member.specialty} · 阅历 ${member.experience}${mastery ? ` · 绝活「${mastery.name}」` : ""}${bond ? ` · 默契 ${game.leader.deputyBonds[member.id] ?? 0}` : ""}${injury ? ` · ${injury.name}` : ""}`}</small>
                        <i><em style={{ width: `${(member.hp / member.maxHp) * 100}%` }} /></i>
                        <strong>{member.hp}</strong>
                      </button>
                    );
                  })}
                </div>
                <div className="crew-effects">
                  {activeCrew.map((member) => {
                    const mastery = crewMasteryForRole(member!.role, crewRank(member!.experience).level);
                    const bond = member!.role === "副镖头" ? deputyBondRank(game.leader.deputyBonds[member!.id] ?? 0) : null;
                    return <span key={member!.id}>{member!.role} · {bond ? `主副「${bond.label}」` : mastery ? `绝活「${mastery.name}」` : member!.specialty}</span>;
                  })}
                </div>
              </section>
              <section className="stance-planning" aria-label="选择行程方略">
                <div className="stance-planning-heading"><span>行策 · 赶路方略</span><b>{journeyStance.title}</b></div>
                <div className="stance-picks">
                  {TRAVEL_STANCE_LIST.map((stance) => (
                    <button
                      key={stance.id}
                      className={`stance-${stance.id} ${game.journey!.stance === stance.id ? "is-selected" : ""}`}
                      aria-pressed={game.journey!.stance === stance.id}
                      onClick={() => setGame(setTravelStance(game, stance.id))}
                    >
                      <i>{stance.seal}</i><span><b>{stance.title}</b><small>{stance.subtitle}</small></span>
                    </button>
                  ))}
                </div>
                <p><b>{journeyStance.seal}</b>{journeyStance.description}</p>
              </section>
              <section className="cover-planning" aria-label="选择跨境过关身份">
                <div className="cover-planning-heading">
                  <span>行装 · 过关身份</span>
                  <b>{planningCoverTarget ? `首入${FACTIONS[planningCoverTarget].short}境` : "本路不跨境"}</b>
                </div>
                <p>身份只在出城时收一次备办费；镖单、随员籍贯与职司越能互相印证，边关越不容易识破。</p>
                <div className="cover-picks">
                  {TRAVEL_COVER_LIST.map((cover) => {
                    const assessment = travelCoverAssessment(game, cover.id, planningCoverTarget);
                    const selected = journeyCover.id === cover.id;
                    const unaffordable = game.silver < cover.cost;
                    const reason = assessment.strengths[0] ?? assessment.warnings[0] ?? cover.description;
                    return (
                      <button
                        key={cover.id}
                        className={`cover-${cover.id} fit-${assessment.fit} ${selected ? "is-selected" : ""}`}
                        aria-pressed={selected}
                        disabled={unaffordable}
                        onClick={() => setGame(setTravelCover(game, cover.id))}
                      >
                        <i>{cover.seal}</i>
                        <span><b>{cover.title}</b><small>{cover.subtitle}</small><em>{reason}</em></span>
                        <strong><small>{cover.cost ? `${cover.cost} 两` : "不费银"}</small><b>{assessment.fitLabel}</b></strong>
                      </button>
                    );
                  })}
                </div>
                <div className={`cover-verdict fit-${journeyCoverAssessment.fit}`}>
                  <i>{journeyCover.seal}</i><span><small>当前身份 · {journeyCoverAssessment.fitLabel}</small><b>{journeyCover.title}</b><em>{journeyCoverAssessment.strengths[0] ?? journeyCoverAssessment.warnings[0] ?? journeyCover.description}</em></span>
                </div>
              </section>
              <section className={`departure-provisions ${planningSupplyShortfall > 0 ? "has-shortfall" : "is-stocked"}`} aria-label="出城前最后整备">
                <header>
                  <i>备</i>
                  <span><small>行前盘缠 · 落印前仍可添置</small><b>出城前最后整备</b></span>
                  <em>{planningSupplyShortfall > 0 ? `最省路线尚缺 ${planningSupplyShortfall} 份粮` : "最省路线粮草已足"}</em>
                </header>
                <dl>
                  <div className={planningSupplyShortfall > 0 ? "is-deficit" : "is-sound"}><dt>车上行粮</dt><dd>{game.supplies}<small>／24</small></dd></div>
                  <div className={game.convoy.horseStamina < 70 ? "is-deficit" : "is-sound"}><dt>当前马力</dt><dd>{game.convoy.horseStamina}<small>／100</small></dd></div>
                  <div><dt>最省全程</dt><dd>{planningMinimumSupply}<small> 粮</small></dd></div>
                  <div><dt>沿途马力</dt><dd>{planningMinimumStamina}<small> 点</small></dd></div>
                </dl>
                <div className="departure-provision-actions">
                  <button
                    disabled={game.supplies >= 24 || game.silver < serviceCost(game, "supplies")}
                    onClick={() => setGame(purchaseService(game, "supplies"))}
                  >
                    <i>粮</i><span><b>{game.supplies >= 24 ? "干粮已满" : "干粮装车"}</b><small>{serviceCost(game, "supplies")} 两 · +{Math.min(24 - game.supplies, supplyPurchaseAmount(game))} 补给</small></span><em>{game.supplies}→{Math.min(24, game.supplies + supplyPurchaseAmount(game))}</em>
                  </button>
                  <button
                    disabled={(game.convoy.horseHp >= 100 && game.convoy.horseStamina >= 100) || game.silver < serviceCost(game, "stable")}
                    onClick={() => setGame(purchaseService(game, "stable"))}
                  >
                    <i>马</i><span><b>{game.convoy.horseStamina >= 100 && game.convoy.horseHp >= 100 ? "马匹已整" : "马院饮秣"}</b><small>{serviceCost(game, "stable")} 两 · 马力 +48</small></span><em>{game.convoy.horseStamina}→{Math.min(100, game.convoy.horseStamina + 48)}</em>
                  </button>
                  {game.convoy.cartHp < 100 && <button
                    disabled={game.silver < serviceCost(game, "repair")}
                    onClick={() => setGame(purchaseService(game, "repair"))}
                  >
                    <i>车</i><span><b>紧固车轴</b><small>{serviceCost(game, "repair")} 两 · 车况 +30</small></span><em>{game.convoy.cartHp}→{Math.min(100, game.convoy.cartHp + 30)}</em>
                  </button>}
                  {planningNeedsTreatment && <button
                    disabled={game.silver < serviceCost(game, "heal")}
                    onClick={() => setGame(purchaseService(game, "heal"))}
                  >
                    <i>药</i><span><b>延医整队</b><small>{serviceCost(game, "heal")} 两 · 治伤复气</small></span><em>{injuredCrewCount ? `${injuredCrewCount}伤` : `镖头${game.convoy.leaderHp}`}</em>
                  </button>}
                </div>
                <footer>马力按整趟累计，超过一百须在沿途驿亭歇马；添粮与饮秣后，下方三路判词会即时重算。</footer>
              </section>
              <div className="route-list">{routePlans.map((plan, index) => <RouteCard key={plan.id} game={game} plan={plan} index={index} highlighted={plan.id === effectiveRoutePreviewId} onPreview={() => setPreviewRoutePlanId(plan.id)} disabled={game.activeCrewIds.length !== 3} onInvestigate={(picked, method) => setGame(investigateRoute(game, picked, method))} onChoose={(picked) => setGame(chooseRoute(game, picked))} />)}</div>
            </div>
          )}

          {game.phase === "travel" && game.journey && (
            <div className="travel-panel">
              <span className="kicker">押运中 · 第 {game.journey.segmentIndex + 1} 程 · {journeyStance.title}</span>
              <h2>镖旗已出城</h2>
              <div className="journey-line">
                {game.journey.plan.cityIds.map((id, index) => (
                  <div key={id} className={index <= game.journey!.segmentIndex ? "passed" : ""}>
                    <i />
                    <span>{cityById(id).name}</span>
                  </div>
                ))}
              </div>
              <div className="journey-details">
                <p className="journey-detail-wide journey-martial"><span>镖头武学</span><b>{activeMartialArt.name} · {activeMartialArt.technique}</b></p>
                {(() => {
                  const routeId = game.journey!.plan.routeIds[game.journey!.segmentIndex];
                  const forecast = segmentTravelForecast(game, routeId);
                  const landmark = primaryLandmarkForRoute(routeId);
                  const landmarkKind = landmark ? routeLandmarkKind(landmark.kind) : null;
                  return <>
                <p><span>当前路段</span><b>{routeById(game.journey.plan.routeIds[game.journey.segmentIndex]).name}</b></p>
                {landmark && landmarkKind && <p className="journey-landmark"><span>沿途要点</span><b><i>{landmarkKind.seal}</i>{landmark.name}<small>{landmarkKind.label} · {landmark.service}</small></b></p>}
                <p><span>预计耗时</span><b>{forecast.days} 日</b></p>
                <p><span>地形</span><b>{TERRAIN_LABEL[routeById(game.journey.plan.routeIds[game.journey.segmentIndex]).terrain]}</b></p>
                <p className="journey-detail-wide journey-weather-row"><span>当前天候</span><b className={`journey-weather weather-${forecast.weather.kind}`}>{forecast.weather.seal} · {forecast.weather.label}<small>{forecast.weatherEffect.note}</small></b></p>
                {activeSpecialHandling && <p className="journey-special-rule"><span>特镖规程</span><b><i>{activeSpecialHandling.seal}</i>{activeSpecialHandling.name}<small>{activeSpecialHandling.rule}</small></b></p>}
                <p><span>行程方略</span><b className={`journey-stance stance-${journeyStance.id}`}>{journeyStance.seal} · {journeyStance.title}</b></p>
                <p><span>过关身份</span><b className={`journey-cover cover-${journeyCover.id}`}>{journeyCover.seal} · {journeyCover.title}{game.journey!.coverBlown ? "（已败露）" : ""}</b></p>
                <p><span>车马耗用</span><b>粮 {forecast.supplyCost} · 马力 {forecast.staminaCost}</b></p>
                {activeTradeGood && <p className="journey-detail-wide"><span>随车副货</span><b>{activeTradeGood.seal} · {activeTradeGood.name}（本钱 {game.journey!.tradeLot!.purchasePrice} 两）</b></p>}
                </>;
                })()}
              </div>
              <div className="journey-march-summary" aria-label="本程出发状态">
                <span><small>随行</small><b>{game.journey.crewIds.length} 人可战</b></span>
                <span className={Math.min(game.convoy.cartHp, game.convoy.horseHp) < 55 ? "is-warning" : ""}><small>车马</small><b>{Math.min(game.convoy.cartHp, game.convoy.horseHp)} 分</b></span>
                <span className={(activeContract?.kind === "escort" ? game.journey.escortHealth ?? 100 : game.convoy.cargoIntegrity) < 55 ? "is-warning" : ""}><small>{cargoGaugeLabel}</small><b>{activeContract?.kind === "escort" ? game.journey.escortHealth ?? 100 : game.convoy.cargoIntegrity} 分</b></span>
                <span className={game.convoy.morale < 45 ? "is-warning" : ""}><small>士气</small><b>{game.convoy.morale}</b></span>
              </div>
              <button className="primary-button journey-button" onClick={() => setGame(advanceTravel(game))}>{journeyStance.advanceVerb} <span>→</span></button>
              <p className="button-footnote">{journeyStance.travelNote}</p>
              <JourneyChronicle journey={game.journey} />
              <div className="journey-crew">
                {game.journey.crewIds.map((id) => {
                  const member = game.crew.find((item) => item.id === id)!;
                  const injury = crewInjuryById(member.injury?.id);
                  const rank = crewRank(member.experience);
                  const mastery = crewMasteryForRole(member.role, rank.level);
                  return <span key={id} className={injury ? "has-injury" : ""}><small>{member.role} · {rank.label}{mastery ? ` · ${mastery.name}` : ""}{injury ? ` · ${injury.name}` : ""}</small><b>{member.name}</b><i>{member.hp}/{member.maxHp}</i></span>;
                })}
              </div>
              <div className="convoy-gauges">
                <Gauge label="镖头" value={game.convoy.leaderHp} />
                <Gauge label="镖车" value={game.convoy.cartHp} danger />
                <Gauge label="马匹" value={game.convoy.horseHp} danger />
                <Gauge label="马力" value={game.convoy.horseStamina} />
                <Gauge label={cargoGaugeLabel} value={activeContract?.kind === "escort" ? game.journey.escortHealth ?? 100 : game.convoy.cargoIntegrity} danger />
                <Gauge label="士气" value={game.convoy.morale} />
              </div>
            </div>
          )}
        </aside>
      </div>

      {game.phase === "event" && game.currentEvent && (
        <div className="modal-layer event-layer" role="dialog" aria-modal="true" aria-labelledby="event-title">
          <section className={`event-card event-card-${game.currentEvent.kind}`}>
            <div className={`event-illustration event-${game.currentEvent.kind}`}><div className="event-moon" /><div className="event-silhouette" /><span>{game.currentEvent.kind === "waystation" ? <>歇<br />脚</> : game.currentEvent.kind === "handoff" ? <>交<br />割</> : game.currentEvent.kind === "caravan" ? <>同<br />道</> : game.currentEvent.kind === "intrigue" ? <>异<br />动</> : <>途<br />中</>}</span></div>
            <div className="event-copy">
              <span className="kicker">{game.currentEvent.eyebrow}</span>
              <h2 id="event-title">{game.currentEvent.title}</h2>
              <p>{game.currentEvent.description}</p>
              <div className="event-context">
                <span>第 {game.day} 日</span><span>余粮 {game.supplies}</span><span>银 {game.silver} 两</span>
              </div>
              {game.currentEvent.kind === "border" && currentBorderCoverAssessment && (
                <div className={`border-cover-slip fit-${currentBorderCoverAssessment.fit}`}>
                  <i>{journeyCover.seal}</i>
                  <span><small>关前口供 · {currentBorderCoverAssessment.fitLabel}</small><b>{journeyCover.title}</b><em>{currentBorderCoverAssessment.strengths[0] ?? currentBorderCoverAssessment.warnings[0] ?? "凭现有行装应验"}</em></span>
                  <strong>{game.journey?.coverBlown ? "已败露" : currentBorderCoverAssessment.definition.id === "open-escort" ? "亮旗" : "待验"}</strong>
                </div>
              )}
              {game.currentEvent.kind === "waystation" && stopoverRouteId && stopoverForecast && (
                <section className="stopover-strategy" aria-label="在落脚点改换行程方略">
                  {stopoverLandmark && (() => {
                    const kind = routeLandmarkKind(stopoverLandmark.kind);
                    return <div className="stopover-landmark"><i>{kind.seal}</i><span><small>前路要点 · {kind.label}</small><b>{stopoverLandmark.name}</b><em>{stopoverLandmark.service}</em></span><p>{stopoverLandmark.description}</p></div>;
                  })()}
                  <div className="stopover-next"><span>下一程 · {routeById(stopoverRouteId).name}<small className={`weather-${stopoverForecast.weather.kind}`}>{stopoverForecast.weather.seal} · {stopoverForecast.weather.label} · {stopoverForecast.weatherEffect.note}</small></span><b>{stopoverForecast.days} 日 · 粮 {stopoverForecast.supplyCost} · 马力 {stopoverForecast.staminaCost}</b></div>
                  {stopoverRoutes.length > 1 && (
                    <section className="stopover-route-book" aria-label="按最新路报重绘剩余行程">
                      <header><span><small>局势已变 · 可随时重绘</small><b>余程三案</b></span><em>只重算前路，不抹去既往损伤</em></header>
                      <div>
                        {stopoverRoutes.map((option, index) => {
                          const intelLabel = option.insight.freshness === "fresh" ? "今报" : option.insight.freshness === "aging" ? "旧报" : "传闻";
                          const deadlineLabel = option.deadlineMargin < 0 ? `预计误限 ${Math.abs(option.deadlineMargin)} 日` : option.deadlineMargin <= 2 ? `期限仅余 ${option.deadlineMargin} 日` : `期限余 ${option.deadlineMargin} 日`;
                          return (
                            <button
                              key={`${option.plan.id}-${index}`}
                              className={`stopover-route-choice ${option.current ? "is-current" : ""}`}
                              disabled={option.current}
                              aria-pressed={option.current}
                              onClick={() => setGame(replanJourneyAtStopover(game, option.plan.id))}
                            >
                              <i>{option.current ? "原" : ["壹", "贰", "叁"][index - 1] ?? "改"}</i>
                              <span><small>{option.current ? "当前余程" : `改走 · ${option.plan.label}`}</small><b>{option.pathLabel}</b><em>{intelLabel} · 路险 {option.travel.dangerLabel}{option.insight.borderSegments ? ` · ${option.insight.borderSegments} 处边关` : " · 同境"} · {option.travel.weatherSummary}</em></span>
                              <strong><b>{option.travel.days} 日</b><small>粮 {option.travel.supplyCost} · 马力 -{option.travel.staminaCost}</small><em className={option.deadlineMargin < 0 ? "is-late" : option.deadlineMargin <= 2 ? "is-tight" : "is-safe"}>{deadlineLabel}</em></strong>
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  )}
                  <div className="stopover-stances">
                    {TRAVEL_STANCE_LIST.map((stance) => (
                      <button key={stance.id} className={`stance-${stance.id} ${game.journey!.stance === stance.id ? "is-selected" : ""}`} aria-pressed={game.journey!.stance === stance.id} onClick={() => setGame(setTravelStance(game, stance.id))}>
                        <i>{stance.seal}</i><span>{stance.title}</span>
                      </button>
                    ))}
                  </div>
                  {stopoverDispositions.length > 0 && (
                    <details className="stopover-disposition">
                      <summary>
                        <span><small>改道也救不了时</small><b>收旗议约</b></span>
                        <em>转托同行 · 退回原城 · 认赔弃镖</em>
                      </summary>
                      <p>这是终止本趟委托的正式决定。先点一次查看落印状态，再点同一项确认执行；所有回银与损失都已列明。</p>
                      <div className="stopover-disposition-options">
                        {stopoverDispositions.map((option) => {
                          const confirming = journeyDispositionConfirm === option.id;
                          const costLabel = option.id === "transfer" ? "接手费" : "赔付";
                          return (
                            <button
                              key={option.id}
                              className={`stopover-disposition-choice disposition-${option.id} ${confirming ? "is-confirming" : ""}`}
                              disabled={!option.available}
                              aria-pressed={confirming}
                              onClick={() => {
                                if (!confirming) {
                                  setJourneyDispositionConfirm(option.id);
                                  return;
                                }
                                setJourneyDispositionConfirm(null);
                                setGame(resolveJourneyDisposition(game, option.id));
                              }}
                            >
                              <i>{option.seal}</i>
                              <span><small>{option.eyebrow}</small><b>{option.label}</b><em>{option.description}</em></span>
                              <strong>
                                <b>{option.delayDays ? `${option.delayDays} 日` : "即办"}</b>
                                <small>{costLabel} {option.compensation} 两{option.tradeRevenue ? ` · 副货回银 ${option.tradeRevenue}` : ""}</small>
                                <em>信用 {option.reputationChange} · 江湖 {option.jianghuReputationChange >= 0 ? "+" : ""}{option.jianghuReputationChange}{option.supplyCost ? ` · 粮 ${option.supplyCost}` : ""}</em>
                                <u>{option.available ? confirming ? "再按一次 · 落印执行" : "先核后果" : option.unavailableReason}</u>
                              </strong>
                            </button>
                          );
                        })}
                      </div>
                    </details>
                  )}
                </section>
              )}
              <div className="event-choices">
                {game.currentEvent.choices.map((item) => (
                  <button key={item.id} className={`event-choice tone-${item.tone ?? "safe"}`} disabled={item.disabled} onClick={() => setGame(resolveEvent(game, item.id))}>
                    <span>{item.label}</span><small>{item.hint}</small><b>{item.disabled ? "×" : "›"}</b>
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}

      {game.phase === "settlement" && game.settlement && (
        <div className="modal-layer settlement-layer" role="dialog" aria-modal="true" aria-labelledby="settlement-title">
          <section className="settlement-card">
            <div className="grade-seal"><span>{game.settlement.grade}</span><small>{game.settlement.outcome === "transfer" ? "转约" : game.settlement.outcome === "return" ? "退约" : game.settlement.outcome === "abandon" ? "失约" : "等镖"}</small></div>
            <span className="kicker">{game.settlement.outcome && game.settlement.outcome !== "delivery" ? "收队" : "抵达"} · {cityById(game.currentCityId).name}</span>
            <h2 id="settlement-title">{game.settlement.title}</h2>
            <p>{game.settlement.summary}</p>
            {game.journey && <JourneyChronicle journey={game.journey} limit={5} paper />}
            <ul>{game.settlement.notes.map((note) => <li key={note}>{note}</li>)}</ul>
            {settlementEquipment && <div className={`settlement-equipment-reward rarity-${settlementEquipment.rarity ?? "fine"}`}>
              <i>{settlementEquipment.seal}</i>
              <span><small>胜阵所得 · {settlementEquipment.origin ?? "行院酬器"}</small><b>{settlementEquipment.name}</b><p>{settlementEquipment.description}</p></span>
              <strong><em>{["新手", "熟手", "老手", "名手"][settlementEquipment.requiredRank]}可用</em><b>已入器械架</b></strong>
            </div>}
            <div className="settlement-rewards">
              <span><small>{game.settlement.outcome && game.settlement.outcome !== "delivery" ? "镖酬" : "实收"}</small><b>{game.settlement.reward} 两</b></span>
              {game.settlement.tradeProfit !== undefined && <span><small>副货 · 回银 {game.settlement.tradeRevenue ?? 0}</small><b>{game.settlement.tradeProfit >= 0 ? "+" : ""}{game.settlement.tradeProfit} 两</b></span>}
              {game.settlement.compensation > 0 && <span><small>{game.settlement.outcome === "transfer" ? "接手费" : "赔付"}</small><b>-{game.settlement.compensation} 两</b></span>}
              <span><small>信用</small><b>{game.settlement.reputationChange >= 0 ? "+" : ""}{game.settlement.reputationChange}</b></span>
              <span><small>守约记录</small><b>{game.completedContracts} 镖</b></span>
            </div>
            <button className="primary-button" onClick={() => setGame(continueAfterSettlement(game))}>在此城整顿，再开镖榜</button>
          </section>
        </div>
      )}

      {game.phase === "gameover" && ending && (
        <div className={`modal-layer ending-layer ending-${ending.outcome}`} role="dialog" aria-modal="true" aria-labelledby="ending-title">
          <section className="ending-card">
            <div className="ending-seal">{ending.seal}</div>
            <span className="kicker">{ending.eyebrow}</span>
            <h2 id="ending-title">{ending.title}</h2>
            <p>{ending.summary}</p>
            <blockquote>{ending.verse}</blockquote>
            <div className="ending-record">
              <span><small>经营日数</small><b>{game.day} 日</b></span>
              <span><small>办妥镖单</small><b>{game.completedContracts} 镖</b></span>
              <span><small>商业信用</small><b>{game.reputation}</b></span>
              <span><small>江湖声望</small><b>{game.jianghuReputation}</b></span>
              <span><small>在营网点</small><b>{Object.values(game.offices).filter((office) => office.active).length} 处</b></span>
            </div>
            {endingLegacy && (
              <div className="ending-legacy">
                <i>{endingLegacy.seal}</i>
                <span><small>{legacy.unlockedIds.includes(endingLegacy.id) ? "谱牒旧章重续" : "谱牒新录"}</small><b>{endingLegacy.title}</b><em>{endingLegacy.effect}</em></span>
              </div>
            )}
            <div className="ending-actions">
              <button className="primary-button" onClick={() => { void beginNewGame(game.originId, game.seed, game.legacyId); }}>承旧物重开此签</button>
              <button className="ghost-button" onClick={() => setLaunch("setup")}>另择出身与天下</button>
            </div>
          </section>
        </div>
      )}

      {showHelp && (
        <div className="modal-layer help-layer" role="dialog" aria-modal="true" aria-labelledby="help-title">
          <section className="help-card">
            <button className="close-button" onClick={() => setShowHelp(false)} aria-label="关闭说明">×</button>
            <span className="kicker">风云行 · 新掌柜手册</span>
            <h2 id="help-title">一趟镖，三次取舍</h2>
            <div className="help-steps">
              <div><b>壹</b><h3>看镖</h3><p>比较报酬、时限与封条要求。高价的镖，往往藏着没写在榜上的麻烦。</p></div>
              <div><b>贰</b><h3>择路</h3><p>快路未必稳；驿亭可重绘余程，实在无力再走时也能正式转托、退回或认赔收旗。随车副货会按实际落脚城结清。</p></div>
              <div><b>叁</b><h3>守约</h3><p>战斗由镖队自动执行，你只下达开路、围车、护马等阵令；商业信用决定谁敢托付重镖，江湖声望则改变山寨、同行与武人的态度。</p></div>
            </div>
            <p className="help-tip">{game.originId === "linan-guild" ? "建议第一趟接下「十四日抵襄阳」，它会展示南宋边境与城市易主的核心变化。" : `你从${cityById(originById(game.originId).startCityId).name}起号；先比较本地镖榜与路报，再利用出身车马走出自己的第一条商路。`}</p>
            <button className="primary-button" onClick={() => { setShowHelp(false); setGame({ ...game, tutorialSeen: true }); }}>明白，开门见客</button>
            <button className="text-button" onClick={() => { setShowHelp(false); setLaunch("setup"); }}>另择出身重新起号</button>
          </section>
        </div>
      )}
    </main>
  );
}

export default App;
