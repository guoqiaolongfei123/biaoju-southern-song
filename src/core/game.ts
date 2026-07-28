import { CITIES, FACTIONS, ROUTES, cityById, otherCity, routeById } from "./data";
import {
  CLIENTS_BY_PATRON,
  CONTRACT_TEMPLATES,
  complicationRisk,
  isBorderSensitive,
} from "./content";
import { CREW_CAPACITY, crewRank, generateRecruitPool } from "./crewContent";
import {
  CONVOY_UPGRADES,
  DEFAULT_CONVOY_EQUIPMENT,
  HORSE_TEAMS,
  WAGONS,
  cargoDamageMultiplier,
  hasConvoyUpgrade,
  wagonDamageMultiplier,
} from "./convoyContent";
import { pickRandom, randomInt, randomStep } from "./rng";
import {
  CITY_STATUS_EFFECTS,
  cityStanding,
  cityServiceMultiplier,
  cityStatusEffect,
  citySupplyAmount,
  contractCountForCity,
} from "./cityContent";
import {
  ROUTE_CONDITION_EFFECTS,
  effectiveRouteCondition,
  routeIsPassable,
} from "./routeContent";
import {
  clampFactionRelation,
  createFactionRecord,
  factionStanding,
} from "./factionContent";
import { careerDefeat, careerObjectiveProgress } from "./careerContent";
import {
  advanceConduct,
  createConductState,
  hasPrinciple,
  principleConcealSaving,
  principleInvestigationDiscount,
  principlePassageMultiplier,
  principleRewardMultiplier,
} from "./conductContent";
import { originById } from "./originContent";
import { travelStanceById } from "./travelContent";
import { stopoverTheme } from "./stopoverContent";
import { TRADE_GOODS, localTradeGood, tradeDemandLabel, tradeSaleValue } from "./tradeContent";
import { DEFAULT_MARTIAL_ART, MARTIAL_ARTS } from "./martialContent";
import { martialProficiencyRank } from "./martialProficiencyContent";
import { advanceWorldActors, createInitialWorldActors, worldActorDangerModifier, worldActorsOnRoute } from "./worldActorContent";
import { EQUIPMENT, MAX_EQUIPMENT_TUNING, createInitialCrewEquipment, createInitialEquipmentStock, createInitialEquipmentTuning, equipmentStats, equipmentTuningGrade, equipmentTuningLevel, equippedCount } from "./equipmentContent";
import { LEGACY_BOONS, legacyStartingModifiers } from "./legacyContent";
import { CREW_DISCIPLINES, crewDisciplineById } from "./crewDisciplineContent";
import { crewMasteryForRole } from "./crewMasteryContent";
import { crewInjuryById, mergeCrewInjury, recoverCrewInjury } from "./injuryContent";
import { FORMATION_PROFICIENCIES, createFormationExperience, formationExperienceAwards, formationProficiencyRank, normalizeFormationExperience } from "./formationProficiency";
import { PLAYER_LEADER_ID, createInitialLeader } from "./leaderContent";
import { deputyBondRank } from "./deputyBondContent";
import { CORE_COMBAT_FOCUSES, coreCombatFocusRank } from "./coreCombatFocusContent";
import { evolveFrontlineCampaign, factionsAtWar, frontlineSituation } from "./frontlineContent";
import type {
  BattleConfig,
  BattleResult,
  CareerObjectiveId,
  ConductState,
  CityState,
  CityStatus,
  CoreCombatFocusId,
  Contract,
  ConvoyUpgradeId,
  CrewMember,
  CrewDisciplineId,
  CrewRole,
  EquipmentId,
  EquipmentSlot,
  EventChoice,
  FactionId,
  GameState,
  HandoffChoice,
  HorseTeamId,
  LegacyId,
  MartialArtId,
  OfficeState,
  OfficeTier,
  OriginId,
  RoutePlan,
  RoutePlanInsight,
  RouteCondition,
  RouteIntelState,
  RouteState,
  Settlement,
  TravelEvent,
  TravelStance,
  TradeGoodId,
  WagonId,
  WorldActor,
} from "./types";

export type ServiceType = "supplies" | "repair" | "heal" | "intel" | "stable";

const CREW_TEMPLATES: Array<Omit<CrewMember, "disciplineId" | "injury" | "formationExperience">> = [
  { id: "lu-cang", name: "鲁沧", courtesy: "定川", role: "副镖头", hp: 100, maxHp: 100, experience: 0, wage: 12, specialty: "临阵压阵", biography: "河东军伍出身，守车与断后皆稳，是总号里最能镇住场面的人。", hiringCost: 0, originCityId: "linan" },
  { id: "qiao-qing", name: "乔青", courtesy: "踏雪", role: "趟子手", hp: 88, maxHp: 88, experience: 0, wage: 7, specialty: "探路识伏", biography: "脚程轻快，记得沿途每一家驿站和每一道暗哨。", hiringCost: 0, originCityId: "linan" },
  { id: "he-sheng", name: "何胜", courtesy: "铁轴", role: "车把式", hp: 92, maxHp: 92, experience: 0, wage: 8, specialty: "护轮修车", biography: "能听车轴声辨出裂纹，走坏路时可大幅降低镖车损伤。", hiringCost: 0, originCityId: "linan" },
  { id: "shen-yan", name: "沈砚", courtesy: "慎之", role: "账房", hp: 76, maxHp: 76, experience: 0, wage: 9, specialty: "识牒通关", biography: "精于关牒、税票与各路银色，正式通关时少花许多冤枉钱。", hiringCost: 0, originCityId: "linan" },
  { id: "su-wen", name: "苏问", courtesy: "怀仁", role: "医师", hp: 72, maxHp: 72, experience: 0, wage: 10, specialty: "随队救治", biography: "随行药箱从不离身，能让负伤队员更快重返镖阵。", hiringCost: 0, originCityId: "linan" },
];

export function createInitialCrew(): CrewMember[] {
  return CREW_TEMPLATES.map((member) => ({ ...member, disciplineId: null, injury: null, formationExperience: createFormationExperience() }));
}

export function crewBattleGuards(crew: CrewMember[], ids: string[], loadouts: GameState["crewEquipment"] = {}, tuning: Partial<GameState["equipmentTuning"]> = {}) {
  const powerByRole: Record<CrewRole, number> = { 副镖头: 1.2, 趟子手: 1.05, 车把式: 0.92, 账房: 0.82, 医师: 0.78, 向导: 0.96, 厨子: 0.86 };
  return ids.map((id) => crew.find((member) => member.id === id)).filter((member): member is CrewMember => Boolean(member)).map((member) => {
    const equipment = equipmentStats(loadouts[member.id], tuning);
    const discipline = crewDisciplineById(member.disciplineId);
    const disciplineModifiers = discipline?.modifiers;
    const rank = crewRank(member.experience);
    const mastery = crewMasteryForRole(member.role, rank.level);
    const masteryModifiers = mastery?.modifiers;
    const injury = crewInjuryById(member.injury?.id);
    const injuryModifiers = injury?.modifiers;
    return {
      id: member.id,
      name: member.name,
      role: member.role,
      experience: member.experience,
      formationExperience: member.formationExperience,
      healthRatio: member.hp / member.maxHp,
      power: powerByRole[member.role] * (1 + rank.battleBonus + equipment.powerBonus) * (disciplineModifiers?.power ?? 1) * (masteryModifiers?.power ?? 1) * (injuryModifiers?.power ?? 1),
      maxHpBonus: equipment.maxHpBonus + (disciplineModifiers?.maxHp ?? 0) + (masteryModifiers?.maxHp ?? 0),
      armorMultiplier: equipment.armorMultiplier * (disciplineModifiers?.armor ?? 1) * (masteryModifiers?.armor ?? 1) * (injuryModifiers?.armor ?? 1),
      cartGuardBonus: equipment.cartGuardBonus + (disciplineModifiers?.cartGuard ?? 0) + (masteryModifiers?.cartGuard ?? 0),
      horseGuardBonus: equipment.horseGuardBonus + (disciplineModifiers?.horseGuard ?? 0) + (masteryModifiers?.horseGuard ?? 0),
      equipmentIds: Object.values(loadouts[member.id] ?? {}).filter((id): id is EquipmentId => Boolean(id)),
      equipmentNames: equipment.names,
      equipmentTuning: Object.fromEntries(Object.values(loadouts[member.id] ?? {}).filter((id): id is EquipmentId => Boolean(id)).map((id) => [id, equipmentTuningLevel(tuning[id])])),
      disciplineId: discipline?.id,
      disciplineName: discipline?.name,
      masteryId: mastery?.id,
      masteryName: mastery?.name,
      masterySeal: mastery?.seal,
      injuryName: injury?.name,
      movementMultiplier: (disciplineModifiers?.speed ?? 1) * (masteryModifiers?.speed ?? 1) * (injuryModifiers?.speed ?? 1),
      supportCooldownMultiplier: (disciplineModifiers?.supportCooldown ?? 1) * (masteryModifiers?.supportCooldown ?? 1) * (injuryModifiers?.supportCooldown ?? 1),
      engageRangeBonus: (disciplineModifiers?.engageRange ?? 0) + (masteryModifiers?.engageRange ?? 0),
      convoyProtection: (disciplineModifiers?.convoyProtection ?? 1) * (masteryModifiers?.convoyProtection ?? 1),
    };
  });
}

export function leaderBattleProfile(game: GameState): NonNullable<BattleConfig["leader"]> {
  const loadout = game.crewEquipment[PLAYER_LEADER_ID] ?? {};
  const equipment = equipmentStats(loadout, game.equipmentTuning);
  const rank = crewRank(game.leader.experience);
  const injury = crewInjuryById(game.leader.injury?.id);
  const injuryModifiers = injury?.modifiers;
  const equipmentIds = Object.values(loadout).filter((id): id is EquipmentId => Boolean(id));
  const battleCrewIds = game.journey?.crewIds.length ? game.journey.crewIds : game.activeCrewIds;
  const deputy = battleCrewIds.map((id) => game.crew.find((member) => member.id === id)).find((member) => member?.role === "副镖头");
  return {
    name: game.leader.name,
    experience: game.leader.experience,
    healthRatio: game.convoy.leaderHp / 100,
    power: 1.28 * (1 + rank.battleBonus + equipment.powerBonus) * (injuryModifiers?.power ?? 1),
    maxHpBonus: equipment.maxHpBonus,
    armorMultiplier: equipment.armorMultiplier * (injuryModifiers?.armor ?? 1),
    formationExperience: game.leader.formationExperience,
    equipmentIds,
    equipmentNames: equipment.names,
    equipmentTuning: Object.fromEntries(equipmentIds.map((id) => [id, equipmentTuningLevel(game.equipmentTuning[id])])),
    injuryName: injury?.name,
    movementMultiplier: injuryModifiers?.speed ?? 1,
    techniqueCooldownMultiplier: injuryModifiers?.supportCooldown ?? 1,
    martialArtExperience: game.leader.martialExperience[game.martialArtId],
    deputyBond: deputy ? game.leader.deputyBonds[deputy.id] ?? 0 : 0,
    coreCombatFocusId: game.leader.coreCombatFocusId,
    coreCombatExperience: game.leader.coreCombatExperience[game.leader.coreCombatFocusId],
  };
}

function journeyCrew(game: GameState): CrewMember[] {
  const ids = game.journey?.crewIds.length ? game.journey.crewIds : game.activeCrewIds;
  return ids.map((id) => game.crew.find((member) => member.id === id)).filter((member): member is CrewMember => Boolean(member));
}

function journeyHasRole(game: GameState, role: CrewRole): boolean {
  return journeyCrew(game).some((member) => member.role === role && member.hp > 0);
}

const INITIAL_CONTRACT: Contract = {
  id: "opening-xiangyang",
  from: "linan",
  to: "xiangyang",
  title: "十四日抵襄阳",
  cargo: "三车守城药材",
  client: "临安广济堂",
  reward: 188,
  deadline: 14,
  risk: "凶险",
  sealRequired: true,
  kind: "cargo",
  patron: "official",
  inspectionAllowed: false,
  allowedLoss: 5,
  confidentiality: "绝密",
  failurePenalty: 56,
  complication: "military",
  clue: "三车药箱中只有头车用的是军中封蜡，箱底还比另外两车厚上一寸。",
  requirement: "封条不得损坏，也不得交由非宋官员检查。",
  secretKnown: false,
  secret: "头车药箱底层压着一封京湖制置司的调防密札。",
  brief: "十四日内送抵襄阳府。封条不得损坏，也不得交由非宋官员检查。",
};

function initialCities(): Record<string, CityState> {
  const borderCities = new Set(["xiangyang", "zaoyang", "guanghua", "shouchun", "yangzhou", "xingyuan"]);
  const prosperousCities = new Set(["linan", "jiankang", "chengdu", "quanzhou", "guangzhou"]);
  return Object.fromEntries(CITIES.map((city) => {
    const status: CityStatus = city.id === "xiangyang" ? "besieged" : borderCities.has(city.id) ? "tense" : prosperousCities.has(city.id) ? "prosperous" : city.defaultOwner === "dali" && city.tier === "capital" ? "autonomous" : "stable";
    const prosperity = city.tier === "capital" ? 86 : city.tier === "major" ? 70 : 56;
    const security = status === "besieged" ? 35 : status === "tense" ? 50 : city.tier === "capital" ? 76 : 64;
    return [city.id, {
      owner: city.defaultOwner,
      status,
      prosperity,
      security,
      intelDay: city.defaultOwner === "song" ? 1 : -1,
      statusSinceDay: 1,
      playerAidDay: -99,
    } satisfies CityState];
  }));
}

function clampDanger(value: number): number {
  return Math.max(8, Math.min(96, Math.round(value)));
}

function statusDanger(status: CityState["status"]): number {
  return CITY_STATUS_EFFECTS[status].danger;
}

function currentRouteDangerFromCities(cities: Record<string, CityState>, routeId: string, condition: RouteCondition = "clear"): number {
  const route = routeById(routeId);
  const from = cities[route.from];
  const to = cities[route.to];
  const securityPenalty = Math.round(((100 - from.security) + (100 - to.security)) / 24);
  const borderPenalty = from.owner === to.owner ? 0 : 11;
  return clampDanger(route.danger + securityPenalty + borderPenalty + statusDanger(from.status) + statusDanger(to.status) + ROUTE_CONDITION_EFFECTS[condition].dangerModifier);
}

export function currentRouteDanger(game: GameState, routeId: string): number {
  const condition = effectiveRouteCondition(game.routeStates[routeId], game.day);
  const livingRoadModifier = worldActorDangerModifier(game.worldActors, routeId, game.relations);
  return clampDanger(currentRouteDangerFromCities(game.cities, routeId, condition) + livingRoadModifier);
}

export function createInitialRouteStates(): Record<string, RouteState> {
  const openingConditions: Partial<Record<string, RouteCondition>> = {
    "yanjing-datong": "banditry",
    "jiangling-kuizhou": "muddy",
    "qingtang-lhasa": "banditry",
    "dali-chengdu": "muddy",
  };
  return Object.fromEntries(ROUTES.map((route) => [route.id, {
    condition: openingConditions[route.id] ?? "clear",
    sinceDay: 1,
    clearsDay: openingConditions[route.id] ? 6 : null,
  } satisfies RouteState]));
}

export function createInitialRouteIntel(cities: Record<string, CityState>, day = 1, routeStates = createInitialRouteStates(), headquartersCityId = "linan"): Record<string, RouteIntelState> {
  return Object.fromEntries(ROUTES.map((route) => {
    const nearHeadquarters = route.from === headquartersCityId || route.to === headquartersCityId;
    const songInterior = cities[route.from].owner === "song" && cities[route.to].owner === "song";
    const surveyedDay = nearHeadquarters ? day : songInterior ? day - 3 : day - 7;
    const knownCondition = effectiveRouteCondition(routeStates[route.id], day);
    return [route.id, { surveyedDay, knownDanger: currentRouteDangerFromCities(cities, route.id, knownCondition), trips: 0, knownCondition } satisfies RouteIntelState];
  }));
}

export function createInitialOffices(cities: Record<string, CityState>, headquartersCityId = "linan"): Record<string, OfficeState> {
  return {
    [headquartersCityId]: { cityId: headquartersCityId, tier: "headquarters", openedDay: 1, ownerAtOpening: cities[headquartersCityId].owner, active: true },
  };
}

export function createInitialCityReputation(headquartersCityId = "linan"): Record<string, number> {
  return Object.fromEntries(CITIES.map((city) => [city.id, city.id === headquartersCityId ? 18 : 0]));
}

function localStanding(game: GameState, cityId = game.currentCityId) {
  return cityStanding(game.cityReputation?.[cityId] ?? 0);
}

function rulingFactionStanding(game: GameState, cityId = game.currentCityId) {
  const factionId = game.cities[cityId].owner;
  return factionStanding(game.relations[factionId] ?? 0);
}

function changeCityReputation(cityReputation: Record<string, number>, cityId: string, amount: number): Record<string, number> {
  return { ...cityReputation, [cityId]: Math.max(-20, Math.min(70, (cityReputation?.[cityId] ?? 0) + amount)) };
}

function officeAt(game: GameState, cityId = game.currentCityId): OfficeState | undefined {
  const office = game.offices[cityId];
  return office?.active ? office : undefined;
}

function officeDiscount(tier: OfficeTier | undefined): number {
  if (tier === "headquarters") return 0.75;
  if (tier === "branch") return 0.8;
  if (tier === "outpost") return 0.9;
  return 1;
}

const SERVICE_BASE_COST: Record<ServiceType, number> = { supplies: 16, repair: 20, heal: 18, intel: 10, stable: 16 };

export function serviceCost(game: GameState, service: ServiceType): number {
  const conditionMultiplier = cityServiceMultiplier(game.cities[game.currentCityId].status, service);
  return Math.ceil(SERVICE_BASE_COST[service] * officeDiscount(officeAt(game)?.tier) * conditionMultiplier * localStanding(game).priceMultiplier * rulingFactionStanding(game).priceMultiplier);
}

export function hasActivePermit(game: GameState, factionId: FactionId): boolean {
  return (game.travelPermits?.[factionId] ?? 0) >= game.day;
}

export function factionAudienceOffer(game: GameState) {
  const city = cityById(game.currentCityId);
  const factionId = game.cities[game.currentCityId].owner;
  const standing = factionStanding(game.relations[factionId] ?? 0);
  const relation = game.relations[factionId] ?? 0;
  const cooldownDays = Math.max(0, 7 - (game.day - (game.factionAudienceDay?.[factionId] ?? -99)));
  const eligibleCity = city.tier === "capital" || city.tier === "major";
  const cost = Math.ceil(20 * cityStatusEffect(game.cities[game.currentCityId]).priceMultiplier * standing.priceMultiplier);
  const gain = standing.tier === "hostile" ? 3 : 4;
  return {
    factionId,
    cost,
    gain,
    cooldownDays,
    eligibleCity,
    enabled: game.phase === "map" && eligibleCity && cooldownDays === 0 && relation < 50 && game.silver >= cost,
  };
}

export function attendFactionAudience(game: GameState): GameState {
  const offer = factionAudienceOffer(game);
  if (!offer.enabled) return game;
  const nextRelation = clampFactionRelation((game.relations[offer.factionId] ?? 0) + offer.gain);
  return {
    ...game,
    silver: game.silver - offer.cost,
    relations: { ...game.relations, [offer.factionId]: nextRelation },
    factionAudienceDay: { ...game.factionAudienceDay, [offer.factionId]: game.day },
    news: [`【行院拜会】风云行在${cityById(game.currentCityId).name}递上门状，${FACTIONS[offer.factionId].name}往来升至 ${nextRelation}。`, ...game.news].slice(0, 6),
  };
}

export function factionPermitOffer(game: GameState) {
  const city = cityById(game.currentCityId);
  const factionId = game.cities[game.currentCityId].owner;
  const standing = factionStanding(game.relations[factionId] ?? 0);
  const eligibleCity = city.tier === "capital" || city.tier === "major";
  const active = hasActivePermit(game, factionId);
  const relationRequired = 15;
  const cost = Math.ceil(30 * standing.priceMultiplier);
  const duration = standing.tier === "honored" ? 30 : 22;
  return {
    factionId,
    cost,
    duration,
    active,
    expiresDay: game.travelPermits?.[factionId] ?? 0,
    relationRequired,
    eligibleCity,
    enabled: game.phase === "map" && eligibleCity && !active && (game.relations[factionId] ?? 0) >= relationRequired && game.silver >= cost,
  };
}

export function acquireFactionPermit(game: GameState): GameState {
  const offer = factionPermitOffer(game);
  if (!offer.enabled) return game;
  const expiresDay = game.day + offer.duration;
  return {
    ...game,
    silver: game.silver - offer.cost,
    travelPermits: { ...game.travelPermits, [offer.factionId]: expiresDay },
    news: [`【路引入匣】${FACTIONS[offer.factionId].name}行院为风云行出具通行路引，可用至第 ${expiresDay} 日。`, ...game.news].slice(0, 6),
  };
}

export function supplyPurchaseAmount(game: GameState): number {
  return citySupplyAmount(game.cities[game.currentCityId].status);
}

function refreshedIntel(game: GameState, routeIds: string[], surveyedDay = game.day): Record<string, RouteIntelState> {
  const routeIntel = { ...game.routeIntel };
  for (const routeId of routeIds) {
    const previous = routeIntel[routeId] ?? { surveyedDay: -99, knownDanger: routeById(routeId).danger, trips: 0, knownCondition: "clear" as const };
    routeIntel[routeId] = { ...previous, surveyedDay, knownDanger: currentRouteDanger(game, routeId), knownCondition: effectiveRouteCondition(game.routeStates[routeId], game.day) };
  }
  return routeIntel;
}

function refreshOfficeIntel(game: GameState): GameState {
  const observedRoutes = new Set<string>();
  for (const office of Object.values(game.offices)) {
    if (!office.active) continue;
    for (const route of ROUTES) if (route.from === office.cityId || route.to === office.cityId) observedRoutes.add(route.id);
  }
  return observedRoutes.size ? { ...game, routeIntel: refreshedIntel(game, [...observedRoutes]) } : game;
}

export function routePlanInsight(game: GameState, plan: RoutePlan): RoutePlanInsight {
  const intel = plan.routeIds.map((routeId) => game.routeIntel[routeId] ?? ({ surveyedDay: -99, knownDanger: routeById(routeId).danger, trips: 0, knownCondition: "clear" as const }));
  const ages = intel.map((item) => Math.max(0, game.day - item.surveyedDay));
  const knownDanger = Math.round(intel.reduce((sum, item) => sum + item.knownDanger, 0) / Math.max(1, intel.length));
  const stalestAge = Math.max(...ages);
  const freshestAge = Math.min(...ages);
  const freshness = stalestAge <= 2 ? "fresh" : stalestAge <= 6 ? "aging" : "rumor";
  const margin = freshness === "fresh" ? 0 : freshness === "aging" ? 7 : 14;
  const dangerLabel = freshness === "fresh" ? `${knownDanger}` : `约 ${clampDanger(knownDanger - margin)}—${clampDanger(knownDanger + margin)}`;
  const borderSegments = plan.routeIds.filter((routeId) => {
    const route = routeById(routeId);
    return game.cities[route.from].owner !== game.cities[route.to].owner;
  }).length;
  const conditionReports = plan.routeIds.flatMap((routeId, index) => {
    const condition = intel[index].knownCondition;
    if (condition === "clear") return [];
    return [{ routeId, condition, label: ROUTE_CONDITION_EFFECTS[condition].label, stale: ages[index] > 2 }];
  });
  return {
    freshness,
    freshestAge,
    stalestAge,
    knownDanger,
    dangerLabel,
    trips: intel.reduce((sum, item) => sum + item.trips, 0),
    borderSegments,
    fullySurveyed: stalestAge <= 1,
    blockedSegments: conditionReports.filter((report) => !routeIsPassable(report.condition) && !report.stale).length,
    conditionReports,
  };
}

export interface SegmentTravelForecast {
  days: number;
  supplyCost: number;
  staminaCost: number;
  staminaShortfall: number;
  dangerModifier: number;
  modifiers: string[];
}

export function segmentTravelForecast(game: GameState, routeId: string, availableStamina = game.convoy.horseStamina, useActualCondition = false): SegmentTravelForecast {
  const route = routeById(routeId);
  const wagon = WAGONS[game.convoy.wagonId];
  const horses = HORSE_TEAMS[game.convoy.horseTeamId];
  const terrainFatigue = horses.terrainFatigue[route.terrain] ?? 1;
  const baseFatigue = route.days * 11 + (route.terrain === "mountain" ? 8 : route.terrain === "river" ? 2 : 4);
  const routeIntel = game.routeIntel[routeId];
  const reportedCondition = routeIntel?.knownCondition ?? "clear";
  const condition = useActualCondition ? effectiveRouteCondition(game.routeStates[routeId], game.day) : reportedCondition;
  const conditionEffect = ROUTE_CONDITION_EFFECTS[condition];
  const stance = travelStanceById(game.journey?.stance);
  const staminaCost = Math.max(8, Math.round(baseFatigue * wagon.fatigueMultiplier * horses.fatigueMultiplier * terrainFatigue * conditionEffect.staminaMultiplier * stance.staminaMultiplier));
  const staminaShortfall = Math.max(0, staminaCost - availableStamina);
  const modifiers: string[] = [];
  const wagonDays = wagon.dayModifier[route.terrain] ?? 0;
  const horseDays = horses.dayModifier[route.terrain] ?? 0;
  if (wagonDays < 0) modifiers.push(`${wagon.name}省时`);
  if (wagonDays > 0) modifiers.push(`${wagon.name}笨重`);
  if (horseDays < 0) modifiers.push(`${horses.name}得地利`);
  if (condition !== "clear") modifiers.push(conditionEffect.label);
  if (stance.id !== "steady") modifiers.push(stance.title);
  const conditionDelay = game.convoy.horseHp < 35 ? 1 : 0;
  if (conditionDelay) modifiers.push("马匹带伤");
  const fatigueDelay = staminaShortfall > 0 ? 1 : 0;
  if (fatigueDelay) modifiers.push("马力不足");
  const injuryDelay = Math.max(
    crewInjuryById(game.leader.injury?.id)?.modifiers.travelDelay ?? 0,
    journeyCrew(game).reduce((delay, member) => Math.max(delay, crewInjuryById(member.injury?.id)?.modifiers.travelDelay ?? 0), 0),
  );
  if (injuryDelay) modifiers.push("重伤拖行");
  const days = Math.max(1, route.days + wagonDays + horseDays + conditionEffect.dayModifier + conditionDelay + fatigueDelay + injuryDelay + stance.dayModifier);
  const familiarSaving = (game.routeIntel[routeId]?.trips ?? 0) >= 2 ? 1 : 0;
  const cookSaving = journeyHasRole(game, "厨子") ? 1 : 0;
  const guideSaving = route.terrain === "mountain" && journeyHasRole(game, "向导") ? 1 : 0;
  const supplyCost = Math.max(1, Math.ceil(days * 1.5) - familiarSaving - cookSaving - guideSaving + stance.supplyModifier);
  return { days, supplyCost, staminaCost, staminaShortfall, dangerModifier: stance.dangerModifier, modifiers };
}

export function routePlanTravelForecast(game: GameState, plan: RoutePlan): { days: number; supplyCost: number; staminaCost: number; dangerModifier: number; dangerLabel: string; modifiers: string[] } {
  let stamina = game.convoy.horseStamina;
  let days = 0;
  let supplyCost = 0;
  let staminaCost = 0;
  const modifiers = new Set<string>();
  for (const routeId of plan.routeIds) {
    const segment = segmentTravelForecast(game, routeId, stamina);
    days += segment.days;
    supplyCost += segment.supplyCost;
    staminaCost += segment.staminaCost;
    stamina = Math.max(0, stamina - segment.staminaCost);
    segment.modifiers.forEach((item) => modifiers.add(item));
  }
  const insight = routePlanInsight(game, plan);
  const stance = travelStanceById(game.journey?.stance);
  const adjustedDanger = clampDanger(insight.knownDanger + stance.dangerModifier);
  const margin = insight.freshness === "fresh" ? 0 : insight.freshness === "aging" ? 7 : 14;
  const dangerLabel = margin ? `约 ${clampDanger(adjustedDanger - margin)}—${clampDanger(adjustedDanger + margin)}` : `${adjustedDanger}`;
  return { days, supplyCost, staminaCost, dangerModifier: stance.dangerModifier, dangerLabel, modifiers: [...modifiers] };
}

function riskLabel(danger: number): Contract["risk"] {
  if (danger >= 68) return "凶险";
  if (danger >= 43) return "棘手";
  return "稳妥";
}

function minDirectDanger(from: string, to: string): number {
  const direct = ROUTES.filter((route) =>
    (route.from === from && route.to === to) || (route.from === to && route.to === from),
  );
  return direct.length ? Math.min(...direct.map((route) => route.danger)) : 52;
}

function preferredTemplateIds(status: CityStatus): ReadonlySet<string> {
  const byStatus: Partial<Record<CityStatus, string[]>> = {
    prosperous: ["tribute-tea", "brocade-ledger", "merchant-ledger", "artisan-family"],
    tense: ["medicine-muster-roll", "frontier-dispatch", "siege-engineer", "surrender-half-seal"],
    besieged: ["medicine-muster-roll", "frontier-dispatch", "siege-engineer", "silent-physician"],
    captured: ["salt-tallies", "merchant-ledger", "surrender-half-seal", "living-witness"],
    famine: ["medicine-muster-roll", "salt-tallies", "family-letter", "silent-physician"],
    plague: ["medicine-muster-roll", "family-letter", "silent-physician", "artisan-family"],
    disrupted: ["brocade-ledger", "salt-tallies", "merchant-ledger", "living-witness"],
    martial: ["medicine-muster-roll", "frontier-dispatch", "siege-engineer", "surrender-half-seal"],
    contested: ["frontier-dispatch", "surrender-half-seal", "siege-engineer", "living-witness"],
    autonomous: ["brocade-ledger", "salt-tallies", "merchant-ledger", "artisan-family"],
  };
  return new Set(byStatus[status] ?? []);
}

export function generateContracts(
  cityId: string,
  day: number,
  rngState: number,
  includeOpening = false,
  limit = 3,
  cityState?: CityState,
  localReputation = 0,
  factionRelation = 0,
  conduct?: ConductState,
): { contracts: Contract[]; rngState: number } {
  const destinations = CITIES.filter((city) => city.id !== cityId && generateRoutePlans(cityId, city.id).length > 0);
  const contracts: Contract[] = includeOpening && cityId === "linan" ? [INITIAL_CONTRACT] : [];
  let state = rngState;
  let attempts = 0;
  const localStatus = cityState?.status ?? "stable";
  const preferredIds = preferredTemplateIds(localStatus);
  const rewardMultiplier = CITY_STATUS_EFFECTS[localStatus].rewardMultiplier * cityStanding(localReputation).rewardMultiplier * factionStanding(factionRelation).rewardMultiplier;
  const principleState = { conduct: conduct ?? createConductState() };
  const favorsLivingCargo = hasPrinciple(principleState, "living-promise");
  const favorsSealedCargo = hasPrinciple(principleState, "sealed-oath");

  while (contracts.length < limit && attempts < 40) {
    attempts += 1;
    const destinationPick = pickRandom(state, destinations);
    state = destinationPick.state;
    const kindOrder = ["cargo", "letter", "escort"] as const;
    const desiredKind = favorsLivingCargo && contracts.length % 3 === 0 ? "escort" : kindOrder[contracts.length % kindOrder.length];
    const sameKind = CONTRACT_TEMPLATES.filter((template) => template.kind === desiredKind);
    const principlePreferred = favorsSealedCargo ? sameKind.filter((template) => template.sealRequired) : [];
    const statusPreferred = (principlePreferred.length ? principlePreferred : sameKind).filter((template) => preferredIds.has(template.id));
    const templatePick = pickRandom(state, statusPreferred.length ? statusPreferred : principlePreferred.length ? principlePreferred : sameKind);
    state = templatePick.state;
    const template = templatePick.value;
    const clientPick = pickRandom(state, CLIENTS_BY_PATRON[template.patron]);
    state = clientPick.state;
    const rewardRoll = randomInt(state, 54, 104);
    state = rewardRoll.state;
    const danger = minDirectDanger(cityId, destinationPick.value.id);
    const distanceBonus = generateRoutePlans(cityId, destinationPick.value.id)[0]?.days ?? 4;
    const index = contracts.length;

    if (contracts.some((item) => item.to === destinationPick.value.id && item.title === template.title)) continue;

    const deadline = Math.max(4, distanceBonus + template.deadlineBuffer);

    contracts.push({
      id: `c-${day}-${cityId}-${destinationPick.value.id}-${index}-${Math.abs(state)}`,
      from: cityId,
      to: destinationPick.value.id,
      title: template.title,
      cargo: template.cargo,
      client: clientPick.value,
      reward: Math.round((rewardRoll.value + distanceBonus * 8 + template.rewardBonus) * rewardMultiplier),
      deadline,
      risk: riskLabel(danger + complicationRisk(template.complication)),
      sealRequired: template.sealRequired,
      kind: template.kind,
      patron: template.patron,
      inspectionAllowed: template.inspectionAllowed,
      allowedLoss: template.allowedLoss,
      confidentiality: template.confidentiality,
      failurePenalty: template.failurePenalty,
      complication: template.complication,
      clue: template.clue,
      requirement: template.requirement,
      secretKnown: false,
      secret: template.secret,
      brief: `${deadline}日内送抵${destinationPick.value.name}。${template.requirement}`,
    });
  }

  return { contracts, rngState: state };
}

export function createInitialGame(seed = 1107, originId: OriginId = "linan-guild", legacyId: LegacyId | null = null): GameState {
  const origin = originById(originId);
  const legacy = legacyStartingModifiers(legacyId);
  const headquartersCityId = origin.startCityId;
  const cities = initialCities();
  const cityReputation = createInitialCityReputation(headquartersCityId);
  const relations: Record<FactionId, number> = { song: 14, jin: -5, xixia: 0, dali: 2, tibetan: 0, mongol: -1, neutral: 2, ...origin.relations };
  const routeStates = createInitialRouteStates();
  const openingCount = contractCountForCity(cities[headquartersCityId], true, cityReputation[headquartersCityId]);
  const rulingFaction = cities[headquartersCityId].owner;
  const generated = generateContracts(headquartersCityId, 1, seed | 0, origin.includeOpeningContract, openingCount, cities[headquartersCityId], cityReputation[headquartersCityId], relations[rulingFaction]);
  const crew = createInitialCrew().map((member) => ({ ...member, experience: (origin.crewExperience[member.id] ?? member.experience) + legacy.crewExperience }));
  const localEffect = cityStatusEffect(cities[headquartersCityId]);
  const localRecruits = generateRecruitPool(headquartersCityId, cityById(headquartersCityId).tier, 1, generated.rngState, crew.map((member) => member.id), localEffect.recruitQuality + cityStanding(cityReputation[headquartersCityId]).recruitQuality, localEffect.recruitCount);
  const worldActors = createInitialWorldActors();
  const initialGame: GameState = {
    version: 19,
    seed,
    originId,
    legacyId,
    rngState: localRecruits.rngState,
    day: 1,
    phase: "map",
    currentCityId: headquartersCityId,
    selectedCityId: headquartersCityId,
    silver: origin.silver + legacy.silver,
    supplies: origin.supplies + legacy.supplies,
    reputation: origin.reputation + legacy.reputation,
    cityReputation,
    relations,
    factionAudienceDay: createFactionRecord(-99),
    travelPermits: createFactionRecord(0),
    cities,
    routeIntel: createInitialRouteIntel(cities, 1, routeStates, headquartersCityId),
    routeStates,
    worldActors,
    offices: createInitialOffices(cities, headquartersCityId),
    contracts: generated.contracts,
    convoy: { leaderHp: 100, guardsFit: 3, cartHp: 100, cargoIntegrity: 100, sealIntact: true, morale: Math.min(100, origin.morale + legacy.morale), ...DEFAULT_CONVOY_EQUIPMENT, wagonId: origin.wagonId, horseTeamId: origin.horseTeamId, upgrades: [...origin.upgrades] },
    martialArtId: DEFAULT_MARTIAL_ART,
    leader: createInitialLeader(),
    crew,
    equipmentStock: createInitialEquipmentStock(),
    equipmentTuning: createInitialEquipmentTuning(),
    crewEquipment: createInitialCrewEquipment(),
    recruitPool: localRecruits.recruits,
    recruitPoolCityId: headquartersCityId,
    activeCrewIds: [...origin.activeCrewIds],
    journey: null,
    currentEvent: null,
    pendingBattle: null,
    settlement: null,
    news: [...(legacyId ? [`【祖业谱牒】本局承用「${LEGACY_BOONS[legacyId].title}」：${LEGACY_BOONS[legacyId].effect}。`] : []), origin.news, "【襄阳急报】金军游骑出现在汉水北岸，京湖制置司仍称城防稳固。", "【行在邸报】钱塘潮平，临安至建康水陆商路照常通行。"],
    completedContracts: 0,
    career: { claimedObjectiveIds: [], endingId: null },
    conduct: createConductState(),
    tutorialSeen: false,
  };
  const routeIntel: Record<string, RouteIntelState> = Object.fromEntries(ROUTES.map((route) => [route.id, {
    ...initialGame.routeIntel[route.id],
    knownDanger: currentRouteDanger(initialGame, route.id),
  }]));
  if (legacy.localRouteMastery > 0) {
    for (const route of ROUTES) {
      if (route.from !== headquartersCityId && route.to !== headquartersCityId) continue;
      routeIntel[route.id] = { ...routeIntel[route.id], trips: Math.max(routeIntel[route.id].trips, legacy.localRouteMastery), surveyedDay: 1 };
    }
  }
  return {
    ...initialGame,
    routeIntel,
  };
}

export function claimCareerObjective(game: GameState, objectiveId: CareerObjectiveId): GameState {
  if (game.phase !== "map") return game;
  const objective = careerObjectiveProgress(game).find((item) => item.id === objectiveId);
  if (!objective || objective.status !== "ready") return game;
  const claimedObjectiveIds = [...(game.career?.claimedObjectiveIds ?? []), objectiveId];
  const completedCareer = objectiveId === "renowned-escort";
  return {
    ...game,
    phase: completedCareer ? "gameover" : game.phase,
    silver: game.silver + objective.reward.silver,
    reputation: game.reputation + objective.reward.reputation,
    career: { claimedObjectiveIds, endingId: completedCareer ? "great-escort" : null },
    news: [`【总号志业】「${objective.title}」落印成卷，得行资 ${objective.reward.silver} 两、信用 +${objective.reward.reputation}。`, ...game.news].slice(0, 6),
  };
}

interface PathCandidate {
  routeIds: string[];
  cityIds: string[];
  days: number;
  danger: number;
}

function planningCondition(game: GameState | undefined, routeId: string, useActual: boolean): { condition: RouteCondition; blocked: boolean } {
  if (!game) return { condition: "clear", blocked: false };
  if (useActual) {
    const condition = effectiveRouteCondition(game.routeStates[routeId], game.day);
    return { condition, blocked: !routeIsPassable(condition) };
  }
  const intel = game.routeIntel[routeId];
  const condition = intel?.knownCondition ?? "clear";
  const freshEnoughToTrustClosure = game.day - (intel?.surveyedDay ?? -99) <= 6;
  return { condition, blocked: freshEnoughToTrustClosure && !routeIsPassable(condition) };
}

function enumeratePaths(from: string, to: string, maxSegments = 6, game?: GameState, useActual = false): PathCandidate[] {
  const found: PathCandidate[] = [];

  function visit(cityId: string, visited: Set<string>, routeIds: string[], cityIds: string[], days: number, dangerSum: number) {
    if (routeIds.length > maxSegments) return;
    if (cityId === to && routeIds.length > 0) {
      found.push({ routeIds, cityIds, days, danger: Math.round(dangerSum / routeIds.length) });
      return;
    }
    for (const route of ROUTES) {
      if (route.from !== cityId && route.to !== cityId) continue;
      const routeCondition = planningCondition(game, route.id, useActual);
      if (routeCondition.blocked) continue;
      const next = otherCity(route, cityId);
      if (visited.has(next)) continue;
      const effect = ROUTE_CONDITION_EFFECTS[routeCondition.condition];
      visit(next, new Set([...visited, next]), [...routeIds, route.id], [...cityIds, next], days + route.days + effect.dayModifier, dangerSum + route.danger + effect.dangerModifier);
    }
  }

  visit(from, new Set([from]), [], [from], 0, 0);
  return found;
}

function describePlan(candidate: PathCandidate): string {
  const terrains = candidate.routeIds.map((id) => routeById(id).terrain);
  if (terrains.every((terrain) => terrain === "official")) return "驿站充足，盘查也最密。";
  if (terrains.includes("river")) return "借水势赶路，须防封渡与水匪。";
  if (terrains.includes("mountain")) return "避开大关，车马损耗与伏击风险更高。";
  return "商旅常走的折中路线。";
}

export function generateRoutePlans(from: string, to: string, game?: GameState, useActual = false): RoutePlan[] {
  const candidates = enumeratePaths(from, to, 6, game, useActual);
  if (!candidates.length) return [];
  const picked: PathCandidate[] = [];
  const pushUnique = (candidate: PathCandidate | undefined) => {
    if (candidate && !picked.some((item) => item.routeIds.join("|") === candidate.routeIds.join("|"))) picked.push(candidate);
  };
  pushUnique([...candidates].sort((a, b) => a.days - b.days || a.danger - b.danger)[0]);
  pushUnique([...candidates].sort((a, b) => a.danger - b.danger || a.days - b.days)[0]);
  pushUnique([...candidates].sort((a, b) => (a.days + a.danger / 20) - (b.days + b.danger / 20))[0]);
  for (const candidate of [...candidates].sort((a, b) => a.days - b.days)) {
    if (picked.length >= 3) break;
    pushUnique(candidate);
  }
  const labels = ["疾行", "稳行", "权衡"];
  return picked.slice(0, 3).map((candidate, index) => ({
    ...candidate,
    id: candidate.routeIds.join("__"),
    label: labels[index] ?? "备选",
    description: describePlan(candidate),
  }));
}

export function hasKnownRoute(game: GameState, from: string, to: string): boolean {
  const queue = [{ cityId: from, depth: 0 }];
  const visitedDepth = new Map([[from, 0]]);
  while (queue.length) {
    const { cityId, depth } = queue.shift()!;
    if (cityId === to) return true;
    if (depth >= 6) continue;
    for (const route of ROUTES) {
      if (route.from !== cityId && route.to !== cityId) continue;
      if (planningCondition(game, route.id, false).blocked) continue;
      const next = otherCity(route, cityId);
      if ((visitedDepth.get(next) ?? Infinity) <= depth + 1) continue;
      visitedDepth.set(next, depth + 1);
      queue.push({ cityId: next, depth: depth + 1 });
    }
  }
  return false;
}

export function contractInvestigationCost(game: GameState): number {
  const accountantSaving = game.crew.some((member) => member.role === "账房" && member.hp >= 20) ? 1 : 0;
  return Math.max(2, Math.ceil(7 * officeDiscount(officeAt(game)?.tier) * localStanding(game).priceMultiplier * rulingFactionStanding(game).priceMultiplier) - accountantSaving - principleInvestigationDiscount(game));
}

export function investigateContract(game: GameState, contractId: string, method: "inquire" | "inspect"): GameState {
  if (game.phase !== "map") return game;
  const contract = game.contracts.find((item) => item.id === contractId && item.from === game.currentCityId);
  if (!contract || contract.secretKnown) return game;
  let silver = game.silver;
  let reputation = game.reputation;
  let reward = contract.reward;
  let report: string;
  if (method === "inquire") {
    const cost = contractInvestigationCost(game);
    if (silver < cost) return game;
    silver -= cost;
    report = `花 ${cost} 两查访行栈、牙人与脚店，底细已经坐实。`;
  } else if (contract.inspectionAllowed) {
    report = contract.kind === "escort" ? "当面问过护送之人，口供与镖单终于对上。" : "按镖单验看封装，夹层与暗记已经查明。";
  } else {
    reputation = Math.max(0, reputation - 3);
    reward = Math.max(1, Math.round(contract.reward * 0.9));
    report = `违背“不许验看”的约定，信用 -3，委托人也扣下了一成酬金。`;
  }
  const contracts = game.contracts.map((item) => item.id === contractId ? { ...item, secretKnown: true, reward } : item);
  return advanceConduct({
    ...game,
    silver,
    reputation,
    contracts,
    news: [`【镖单查验】「${contract.title}」：${report}`, ...game.news].slice(0, 6),
  }, { investigations: 1 });
}

export function acceptContract(game: GameState, contractId: string): GameState {
  const contract = game.contracts.find((item) => item.id === contractId);
  if (!contract || contract.from !== game.currentCityId) return game;
  const plans = generateRoutePlans(contract.from, contract.to, game);
  if (!plans.length) return game;
  return {
    ...game,
    phase: "planning",
    currentEvent: null,
    pendingBattle: null,
    settlement: null,
    contracts: game.contracts,
    selectedCityId: contract.to,
    news: [`已接下「${contract.title}」：${contract.brief}`, ...game.news].slice(0, 6),
    journey: {
      contract,
      plan: plans[0],
      segmentIndex: 0,
      startedDay: game.day,
      elapsedDays: 0,
      traveledRouteIds: [],
      crewIds: [...game.activeCrewIds],
      battleVictories: 0,
      stance: "steady",
      escortHealth: contract.kind === "escort" ? 100 : undefined,
      issuerFaction: game.cities[contract.from].owner,
      expectedDestinationOwner: game.cities[contract.to].owner,
    },
  };
}

export interface TradeOffer {
  goodId: TradeGoodId;
  name: string;
  seal: string;
  description: string;
  purchasePrice: number;
  expectedRevenueMin: number;
  expectedRevenueMax: number;
  expectedProfitMin: number;
  expectedProfitMax: number;
  demandLabel: string;
  purchased: boolean;
}

export function tradeOffer(game: GameState): TradeOffer | null {
  if (game.phase !== "planning" || !game.journey) return null;
  const existing = game.journey.tradeLot;
  const good = existing ? TRADE_GOODS[existing.goodId] : localTradeGood(game.currentCityId, game.day, game.seed);
  if (!good) return null;
  const purchasePrice = existing?.purchasePrice ?? Math.max(8, Math.ceil(
    good.basePrice
      * cityStatusEffect(game.cities[game.currentCityId]).priceMultiplier
      * localStanding(game).priceMultiplier
      * rulingFactionStanding(game).priceMultiplier
      * officeDiscount(officeAt(game)?.tier),
  ));
  const plans = generateRoutePlans(game.journey.contract.from, game.journey.contract.to, game);
  const destination = game.cities[game.journey.contract.to];
  const lot = { goodId: good.id, originCityId: game.currentCityId, purchasePrice };
  const estimates = (plans.length ? plans : [game.journey.plan]).map((plan) => tradeSaleValue(
    lot,
    game.journey!.contract.to,
    destination,
    routePlanTravelForecast(game, plan).days,
    100,
  ));
  const expectedRevenueMin = Math.min(...estimates);
  const expectedRevenueMax = Math.max(...estimates);
  return {
    goodId: good.id,
    name: good.name,
    seal: good.seal,
    description: good.description,
    purchasePrice,
    expectedRevenueMin,
    expectedRevenueMax,
    expectedProfitMin: expectedRevenueMin - purchasePrice,
    expectedProfitMax: expectedRevenueMax - purchasePrice,
    demandLabel: tradeDemandLabel(good.id, game.journey.contract.to, destination),
    purchased: Boolean(existing),
  };
}

export function purchaseTradeLot(game: GameState): GameState {
  const offer = tradeOffer(game);
  if (!offer || offer.purchased || game.silver < offer.purchasePrice || !game.journey) return game;
  return {
    ...game,
    silver: game.silver - offer.purchasePrice,
    journey: {
      ...game.journey,
      tradeLot: { goodId: offer.goodId, originCityId: game.currentCityId, purchasePrice: offer.purchasePrice },
    },
    news: [`【货栈添载】在${cityById(game.currentCityId).name}以 ${offer.purchasePrice} 两收下${offer.name}，随主镖一同上路。`, ...game.news].slice(0, 6),
  };
}

export function cancelContractPlanning(game: GameState): GameState {
  if (game.phase !== "planning" || !game.journey) return game;
  const refund = game.journey.tradeLot?.purchasePrice ?? 0;
  return {
    ...game,
    phase: "map",
    silver: game.silver + refund,
    journey: null,
    selectedCityId: game.currentCityId,
    news: refund ? [`【货栈退票】副货尚未出城，牙人照原价退回 ${refund} 两。`, ...game.news].slice(0, 6) : game.news,
  };
}

export function setTravelStance(game: GameState, stance: TravelStance): GameState {
  const canChange = game.phase === "planning" || (game.phase === "event" && game.currentEvent?.kind === "waystation");
  if (!canChange || !game.journey) return game;
  return { ...game, journey: { ...game.journey, stance } };
}

export function setMartialArt(game: GameState, martialArtId: MartialArtId): GameState {
  if ((game.phase !== "map" && game.phase !== "planning") || !MARTIAL_ARTS[martialArtId]) return game;
  if (game.martialArtId === martialArtId) return game;
  const martialArt = MARTIAL_ARTS[martialArtId];
  return {
    ...game,
    martialArtId,
    news: [`【行前演武】镖头改用${martialArt.name}，临敌绝技为「${martialArt.technique}」。`, ...game.news].slice(0, 6),
  };
}

export function setCoreCombatFocus(game: GameState, coreCombatFocusId: CoreCombatFocusId): GameState {
  if ((game.phase !== "map" && game.phase !== "planning") || !CORE_COMBAT_FOCUSES[coreCombatFocusId]) return game;
  if (game.leader.coreCombatFocusId === coreCombatFocusId) return game;
  const focus = CORE_COMBAT_FOCUSES[coreCombatFocusId];
  const experience = game.leader.coreCombatExperience[coreCombatFocusId];
  const rank = coreCombatFocusRank(experience);
  return {
    ...game,
    leader: { ...game.leader, coreCombatFocusId },
    news: [`【双核心演武】总镖头与副镖头改习「${focus.name}」· ${rank.label}；临敌仍会自行出招，你只需定下阵策。`, ...game.news].slice(0, 6),
  };
}

export function toggleJourneyCrew(game: GameState, memberId: string): GameState {
  if (game.phase !== "planning" || !game.journey) return game;
  const member = game.crew.find((item) => item.id === memberId);
  if (!member || member.hp < 20) return game;
  const selected = game.activeCrewIds.includes(memberId);
  if (!selected && game.activeCrewIds.length >= 3) return game;
  const activeCrewIds = selected
    ? game.activeCrewIds.filter((id) => id !== memberId)
    : [...game.activeCrewIds, memberId];
  return { ...game, activeCrewIds, journey: { ...game.journey, crewIds: activeCrewIds } };
}

export function chooseRoute(game: GameState, plan: RoutePlan): GameState {
  if (!game.journey || game.activeCrewIds.length !== 3) return game;
  const ready = game.activeCrewIds.every((id) => (game.crew.find((member) => member.id === id)?.hp ?? 0) >= 20);
  if (!ready) return game;
  return { ...game, phase: "travel", journey: { ...game.journey, plan, crewIds: [...game.activeCrewIds] } };
}

export interface CityAidOffer {
  available: boolean;
  enabled: boolean;
  label: string;
  detail: string;
  silverCost: number;
  supplyCost: number;
  cooldownDays: number;
}

export function cityAidOffer(game: GameState): CityAidOffer {
  const city = game.cities[game.currentCityId];
  const cooldownDays = Math.max(0, 7 - (game.day - city.playerAidDay));
  const offers: Partial<Record<CityStatus, Omit<CityAidOffer, "available" | "enabled" | "cooldownDays">>> = {
    famine: { label: "开仓赈济", detail: "购粮施粥，缓和饥情并提振城中生计。", silverCost: 18, supplyCost: 4 },
    plague: { label: "捐药设棚", detail: "延请医者，在城门外设棚施药。", silverCost: 25, supplyCost: 0 },
    disrupted: { label: "重开商路", detail: "雇人护送积货出城，让行栈重新转起来。", silverCost: 22, supplyCost: 0 },
    captured: { label: "安置流户", detail: "替易主后的流户立保，收拢混乱市面。", silverCost: 22, supplyCost: 0 },
    contested: { label: "护送乡民", detail: "护送乡民与商户穿过两军争夺的街巷。", silverCost: 24, supplyCost: 2 },
    besieged: { label: "捐粮守城", detail: "把自家补给送上城头，暂缓守军缺粮。", silverCost: 15, supplyCost: 5 },
    tense: { label: "协守夜巡", detail: "资助乡兵巡夜，压住城中谣言与盗乱。", silverCost: 16, supplyCost: 0 },
    martial: { label: "调停关市", detail: "请本地耆老出面，让军府给商旅留一道门。", silverCost: 16, supplyCost: 0 },
  };
  const offer = offers[city.status];
  if (!offer) return { available: false, enabled: false, label: "城中无急务", detail: "眼下不需镖局出面赈济。", silverCost: 0, supplyCost: 0, cooldownDays };
  const enabled = game.phase === "map" && cooldownDays === 0 && game.silver >= offer.silverCost && game.supplies >= offer.supplyCost;
  return { ...offer, available: true, enabled, cooldownDays };
}

export function supportCurrentCity(game: GameState): GameState {
  const offer = cityAidOffer(game);
  if (!offer.available || !offer.enabled) return game;
  const current = game.cities[game.currentCityId];
  let status = current.status;
  let prosperityGain = 4;
  let securityGain = 7;
  let reputationGain = 3;
  if (status === "famine") { prosperityGain = 14; securityGain = 5; reputationGain = 5; status = "stable"; }
  else if (status === "plague") { prosperityGain = 8; securityGain = 8; reputationGain = 5; status = "stable"; }
  else if (status === "disrupted") { prosperityGain = 7; securityGain = 12; reputationGain = 4; status = "stable"; }
  else if (status === "captured") { prosperityGain = 6; securityGain = 11; reputationGain = 4; status = "tense"; }
  else if (status === "contested") { prosperityGain = 4; securityGain = 10; reputationGain = 5; status = "martial"; }
  else if ((status === "tense" || status === "martial") && current.security + securityGain >= 58) status = "stable";
  const aided: CityState = {
    ...current,
    status,
    prosperity: Math.min(100, current.prosperity + prosperityGain),
    security: Math.min(100, current.security + securityGain),
    statusSinceDay: status === current.status ? current.statusSinceDay : game.day,
    playerAidDay: game.day,
    intelDay: game.day,
  };
  const city = cityById(game.currentCityId);
  const faction = current.owner;
  const localReputationGain = reputationGain + 4;
  return {
    ...game,
    silver: game.silver - offer.silverCost,
    supplies: game.supplies - offer.supplyCost,
    reputation: game.reputation + reputationGain,
    cityReputation: changeCityReputation(game.cityReputation, game.currentCityId, localReputationGain),
    relations: { ...game.relations, [faction]: game.relations[faction] + 2 },
    cities: { ...game.cities, [game.currentCityId]: aided },
    news: [`【${city.name}义举】风云行${offer.label}，城中繁荣 +${prosperityGain}、治安 +${securityGain}、本地声望 +${localReputationGain}。`, ...game.news].slice(0, 6),
  };
}

export function officeActionOffer(game: GameState) {
  const existing = game.offices[game.currentCityId];
  const localReputation = game.cityReputation?.[game.currentCityId] ?? 0;
  if (existing?.tier === "headquarters") return { action: "none" as const, label: "总号坐镇", cost: 0, reputation: 0, localReputation: 0, enabled: false };
  if (existing && !existing.active) return { action: "reopen" as const, label: "重新挂牌", cost: 30, reputation: 20, localReputation: 12, enabled: game.silver >= 30 && game.reputation >= 20 && localReputation >= 12 };
  if (existing?.tier === "branch") return { action: "none" as const, label: "分号已立", cost: 0, reputation: 0, localReputation: 0, enabled: false };
  if (existing?.tier === "outpost") return { action: "upgrade" as const, label: "升为分号", cost: 72, reputation: 35, localReputation: 25, enabled: game.silver >= 72 && game.reputation >= 35 && localReputation >= 25 };
  return { action: "establish" as const, label: "安置暗桩", cost: 48, reputation: 20, localReputation: 8, enabled: game.silver >= 48 && game.reputation >= 20 && localReputation >= 8 };
}

export function establishOffice(game: GameState): GameState {
  if (game.phase !== "map") return game;
  const offer = officeActionOffer(game);
  if (!offer.enabled || offer.action === "none") return game;
  const previous = game.offices[game.currentCityId];
  const nextTier: OfficeTier = offer.action === "upgrade" ? "branch" : previous?.tier ?? "outpost";
  const office: OfficeState = {
    cityId: game.currentCityId,
    tier: nextTier,
    openedDay: previous?.openedDay ?? game.day,
    ownerAtOpening: game.cities[game.currentCityId].owner,
    active: true,
  };
  const cityName = cityById(game.currentCityId).name;
  let next: GameState = {
    ...game,
    silver: game.silver - offer.cost,
    offices: { ...game.offices, [game.currentCityId]: office },
    news: [
      `【${cityName}】风云行${nextTier === "branch" ? "分号" : "暗桩"}${offer.action === "reopen" ? "重新挂牌" : "落成"}，周边路报自此有人照应。`,
      ...game.news,
    ].slice(0, 6),
  };
  next = refreshOfficeIntel(next);
  if (nextTier === "branch") {
    const localReputation = next.cityReputation[next.currentCityId] ?? 0;
    const count = contractCountForCity(next.cities[next.currentCityId], true, localReputation);
    const localFaction = next.cities[next.currentCityId].owner;
    const generated = generateContracts(next.currentCityId, next.day, next.rngState, false, count, next.cities[next.currentCityId], localReputation, next.relations[localFaction] ?? 0, next.conduct);
    next = { ...next, contracts: generated.contracts, rngState: generated.rngState };
  }
  return next;
}

export function routeInvestigationCost(game: GameState): number {
  return Math.ceil(12 * officeDiscount(officeAt(game)?.tier) * localStanding(game).priceMultiplier * rulingFactionStanding(game).priceMultiplier);
}

export function investigateRoute(game: GameState, plan: RoutePlan, method: "buy" | "scout"): GameState {
  if (game.phase !== "planning" || !game.journey || routePlanInsight(game, plan).fullySurveyed) return game;
  if (method === "buy") {
    const cost = routeInvestigationCost(game);
    if (game.silver < cost) return game;
    return {
      ...game,
      silver: game.silver - cost,
      routeIntel: refreshedIntel(game, plan.routeIds),
      news: [`【行前路报】已核验「${plan.label}」沿线 ${plan.routeIds.length} 段道路。`, ...game.news].slice(0, 6),
    };
  }
  const scout = journeyCrew(game).find((member) => member.role === "趟子手" && member.hp >= 20);
  if (!scout) return game;
  let next = withWorldAdvance(game, 1);
  next = {
    ...next,
    routeIntel: refreshedIntel(next, plan.routeIds),
    journey: next.journey ? { ...next.journey, elapsedDays: next.day - next.journey.startedDay } : null,
    news: [`【探路回报】${scout.name}耗时一日，带回「${plan.label}」沿线的新路报。`, ...next.news].slice(0, 6),
  };
  return next;
}

export interface CityConditionEvolution {
  cities: Record<string, CityState>;
  rngState: number;
  news: string[];
}

export interface RouteConditionEvolution {
  routeStates: Record<string, RouteState>;
  rngState: number;
  news: string[];
}

export function evolveRouteConditions(
  source: Record<string, RouteState>,
  cities: Record<string, CityState>,
  targetDay: number,
  rngState: number,
  elapsedDays: number,
  excludedRouteIds: ReadonlySet<string> = new Set(),
): RouteConditionEvolution {
  const routeStates = Object.fromEntries(ROUTES.map((route) => {
    const previous = source[route.id] ?? { condition: "clear" as const, sinceDay: 1, clearsDay: null };
    return [route.id, previous.clearsDay !== null && previous.clearsDay <= targetDay
      ? { condition: "clear" as const, sinceDay: targetDay, clearsDay: null }
      : { ...previous }];
  }));
  const eventRoll = randomStep(rngState);
  let state = eventRoll.state;
  if (eventRoll.value >= Math.min(.84, .07 + elapsedDays * .065)) return { routeStates, rngState: state, news: [] };
  const candidates = ROUTES.filter((route) => !excludedRouteIds.has(route.id) && routeStates[route.id].condition === "clear");
  if (!candidates.length) return { routeStates, rngState: state, news: [] };
  const routeRoll = pickRandom(state, candidates);
  state = routeRoll.state;
  const route = routeRoll.value;
  const typeRoll = randomStep(state);
  state = typeRoll.state;
  const adjacentCrisis = [cities[route.from].status, cities[route.to].status].some((status) => ["besieged", "captured", "martial", "contested", "disrupted"].includes(status));
  let condition: RouteCondition;
  if (adjacentCrisis && typeRoll.value < .58) condition = "blockaded";
  else if (route.terrain === "river") condition = typeRoll.value < .55 ? "flooded" : "banditry";
  else if (route.terrain === "mountain") condition = typeRoll.value < .58 ? "muddy" : "banditry";
  else condition = typeRoll.value < .36 ? "muddy" : typeRoll.value < .72 ? "banditry" : "blockaded";
  const durationRoll = randomInt(state, 3, 6);
  state = durationRoll.state;
  routeStates[route.id] = { condition, sinceDay: targetDay, clearsDay: targetDay + durationRoll.value };
  return {
    routeStates,
    rngState: state,
    news: [`【道路急报】${route.name}${ROUTE_CONDITION_EFFECTS[condition].label}，预计 ${durationRoll.value} 日内方有转机。`],
  };
}

export function evolveCityConditions(
  sourceCities: Record<string, CityState>,
  targetDay: number,
  rngState: number,
  elapsedDays: number,
): CityConditionEvolution {
  const cities = { ...sourceCities };
  const eventRoll = randomStep(rngState);
  let state = eventRoll.state;
  if (eventRoll.value >= Math.min(.88, .08 + elapsedDays * .07)) return { cities, rngState: state, news: [] };

  const eligible = CITIES.filter((city) => {
    const condition = cities[city.id];
    return condition
      && !frontlineSituation(cities, city.id, targetDay).exposed
      && condition.status !== "besieged"
      && condition.status !== "captured"
      && condition.status !== "contested";
  });
  if (!eligible.length) return { cities, rngState: state, news: [] };
  const cityRoll = pickRandom(state, eligible);
  state = cityRoll.state;
  const city = cityRoll.value;
  const current = cities[city.id];
  const conditionAge = targetDay - current.statusSinceDay;
  const transient = !["stable", "prosperous", "autonomous", "tense"].includes(current.status);

  if (transient && conditionAge >= 5) {
    const recoveredStatus: CityStatus = current.prosperity >= 74 && current.security >= 62 ? "prosperous" : "stable";
    cities[city.id] = {
      ...current,
      status: recoveredStatus,
      prosperity: Math.min(100, current.prosperity + 4),
      security: Math.min(100, current.security + 5),
      statusSinceDay: targetDay,
      intelDay: targetDay,
    };
    return { cities, rngState: state, news: [`【${city.name}】${CITY_STATUS_EFFECTS[current.status].label}渐退，市门与行栈重新恢复往来。`] };
  }

  const typeRoll = randomStep(state);
  state = typeRoll.state;
  let status: CityStatus;
  if (current.security < 44) status = typeRoll.value < .46 ? "martial" : typeRoll.value < .78 ? "disrupted" : "famine";
  else if (current.prosperity < 52) status = typeRoll.value < .5 ? "famine" : typeRoll.value < .78 ? "disrupted" : "plague";
  else if (current.owner !== "song" && typeRoll.value > .84) status = "autonomous";
  else if (typeRoll.value < .2) status = "prosperous";
  else if (typeRoll.value < .42) status = "tense";
  else if (typeRoll.value < .62) status = "disrupted";
  else if (typeRoll.value < .78) status = "martial";
  else if (typeRoll.value < .9) status = "plague";
  else status = "famine";

  const prosperityDelta = status === "prosperous" ? 6 : status === "famine" ? -10 : status === "plague" ? -7 : status === "disrupted" ? -6 : -2;
  const securityDelta = status === "prosperous" ? 4 : status === "martial" ? 3 : status === "tense" ? -4 : status === "disrupted" ? -7 : status === "famine" ? -5 : -2;
  cities[city.id] = {
    ...current,
    status,
    prosperity: Math.max(18, Math.min(100, current.prosperity + prosperityDelta)),
    security: Math.max(18, Math.min(100, current.security + securityDelta)),
    statusSinceDay: targetDay,
    intelDay: targetDay,
  };
  return {
    cities,
    rngState: state,
    news: [`【${city.name}城报】${CITY_STATUS_EFFECTS[status].label}：${CITY_STATUS_EFFECTS[status].marketNote}。`],
  };
}

function withWorldAdvance(game: GameState, days: number): GameState {
  let next: GameState = { ...game, day: game.day + days };
  const cities = { ...game.cities };
  const news = game.news.filter((item) => !item.startsWith("【天下行旅】") && !item.startsWith("【军伍行报】"));
  let rngState = game.rngState;
  const actorEvolution = advanceWorldActors(game.worldActors ?? createInitialWorldActors(), days, rngState, cities);
  rngState = actorEvolution.rngState;
  news.push(...actorEvolution.news.slice(0, 1));

  if (
    game.completedContracts === 0 &&
    game.journey?.contract.to === "xiangyang" &&
    cities.xiangyang.owner === "song"
  ) {
    cities.xiangyang = { ...cities.xiangyang, owner: "jin", status: "captured", security: 30, intelDay: game.day + days, statusSinceDay: game.day + days };
    news.unshift("【京湖急报】襄阳外城失守，金军已经换下城头宋旗。旧关牒即刻作废。");
  } else {
    const frontlineEvolution = evolveFrontlineCampaign(cities, game.day + days, rngState, days, actorEvolution.actors);
    rngState = frontlineEvolution.rngState;
    Object.assign(cities, frontlineEvolution.cities);
    news.unshift(...frontlineEvolution.news);
  }
  const conditionEvolution = evolveCityConditions(cities, game.day + days, rngState, days);
  rngState = conditionEvolution.rngState;
  Object.assign(cities, conditionEvolution.cities);
  news.unshift(...conditionEvolution.news);
  const currentRouteId = game.journey?.plan.routeIds[game.journey.segmentIndex];
  const routeEvolution = evolveRouteConditions(game.routeStates, cities, game.day + days, rngState, days, new Set(currentRouteId ? [currentRouteId] : []));
  rngState = routeEvolution.rngState;
  news.unshift(...routeEvolution.news);
  next = { ...next, cities, routeStates: routeEvolution.routeStates, worldActors: actorEvolution.actors, news: news.slice(0, 6), rngState };
  const recoveredNames: string[] = [];
  const crew = next.crew.map((member) => {
    if (!member.injury) return member;
    const injury = recoverCrewInjury(member.injury, days);
    if (!injury) recoveredNames.push(member.name);
    return injury === member.injury ? member : { ...member, injury };
  });
  const leaderInjury = recoverCrewInjury(next.leader.injury, days);
  if (next.leader.injury && !leaderInjury) recoveredNames.unshift(next.leader.name);
  const leader = leaderInjury === next.leader.injury ? next.leader : { ...next.leader, injury: leaderInjury };
  if (recoveredNames.length) next = { ...next, leader, crew, news: [`【伤势渐平】${recoveredNames.join("、")}经过休养已经不再受旧伤妨碍。`, ...next.news].slice(0, 6) };
  else if (leader !== next.leader || crew.some((member, index) => member !== next.crew[index])) next = { ...next, leader, crew };
  const offices = { ...next.offices };
  for (const [cityId, office] of Object.entries(offices)) {
    if (!office.active || office.ownerAtOpening === cities[cityId].owner || office.tier === "headquarters") continue;
    offices[cityId] = { ...office, active: false };
    next.news = [`【网点急报】${cityById(cityId).name}易主，当地${office.tier === "branch" ? "分号" : "暗桩"}被迫闭门。`, ...next.news].slice(0, 6);
  }
  return refreshOfficeIntel({ ...next, offices });
}

function choice(id: string, label: string, hint: string, tone: EventChoice["tone"] = "safe", disabled = false): EventChoice {
  return { id, label, hint, tone, disabled };
}

function revealRouteCondition(game: GameState, routeId: string): GameState {
  const previous = game.routeIntel[routeId] ?? { surveyedDay: -99, knownDanger: routeById(routeId).danger, trips: 0, knownCondition: "clear" as const };
  return {
    ...game,
    routeIntel: {
      ...game.routeIntel,
      [routeId]: {
        ...previous,
        surveyedDay: game.day,
        knownDanger: currentRouteDanger(game, routeId),
        knownCondition: effectiveRouteCondition(game.routeStates[routeId], game.day),
      },
    },
  };
}

function createRoadblockEvent(game: GameState, routeId: string): TravelEvent {
  const route = routeById(routeId);
  const routeState = game.routeStates[routeId];
  const condition = effectiveRouteCondition(routeState, game.day);
  const effect = ROUTE_CONDITION_EFFECTS[condition];
  const journey = game.journey!;
  const from = journey.plan.cityIds[journey.segmentIndex];
  const detours = generateRoutePlans(from, journey.contract.to, game, true);
  const waitDays = Math.max(1, (routeState?.clearsDay ?? game.day + 2) - game.day);
  const isFlooded = condition === "flooded";
  return {
    id: `roadblock-${game.day}-${routeId}`,
    kind: "roadblock",
    eyebrow: "旧路报在眼前作废",
    title: isFlooded ? "水漫渡亭，舟子尽已收缆" : "军栅横在道心，前路已经封死",
    description: `${route.name}如今${effect.label}。${effect.description}这条消息直到镖队亲眼看见才算坐实。`,
    choices: [
      choice("wait-road", isFlooded ? "扎营候水退" : "就地候关开", `等待 ${waitDays} 日，保住人货但可能误期`, "safe"),
      ...(detours.length ? [choice("reroute-road", "掉头改走旁路", `改用「${detours[0].label}」；不立刻耗时，但余程与风险重算`, "risk")] : []),
      choice("force-road", isFlooded ? "拆车冒险涉渡" : "亮旗强闯军栅", isFlooded ? "延误 1 日，车马与镖物可能受损" : "进入护车战，打通此路", "danger"),
    ],
  };
}

export interface StopoverOffer {
  cityId: string;
  routeId: string;
  supplyCost: number;
  supplyGain: number;
  intelCost: number;
  intelFresh: boolean;
  officeBacked: boolean;
}

export function stopoverOffer(game: GameState): StopoverOffer | null {
  const journey = game.journey;
  if (!journey || journey.segmentIndex <= 0 || journey.segmentIndex >= journey.plan.routeIds.length) return null;
  const cityId = journey.plan.cityIds[journey.segmentIndex];
  const routeId = journey.plan.routeIds[journey.segmentIndex];
  const cityState = game.cities[cityId];
  if (!cityState) return null;
  const office = officeAt(game, cityId);
  const localPrice = cityStanding(game.cityReputation?.[cityId] ?? 0).priceMultiplier;
  const supplyCost = Math.max(6, Math.ceil(14 * cityServiceMultiplier(cityState.status, "supplies") * officeDiscount(office?.tier) * localPrice));
  const intelCost = office ? 0 : Math.max(3, Math.ceil(7 * cityServiceMultiplier(cityState.status, "intel") * localPrice));
  const routeIntel = game.routeIntel[routeId];
  return {
    cityId,
    routeId,
    supplyCost,
    supplyGain: citySupplyAmount(cityState.status),
    intelCost,
    intelFresh: Boolean(routeIntel && game.day - routeIntel.surveyedDay <= 1),
    officeBacked: Boolean(office),
  };
}

function createStopoverEvent(game: GameState): TravelEvent {
  const offer = stopoverOffer(game)!;
  const city = cityById(offer.cityId);
  const cityState = game.cities[offer.cityId];
  const nextRoute = routeById(offer.routeId);
  const theme = stopoverTheme(nextRoute.terrain, cityState.status, city.name);
  const restFull = game.convoy.leaderHp >= 98 && game.convoy.horseHp >= 98 && game.convoy.horseStamina >= 96 && game.convoy.morale >= 96 && journeyCrew(game).every((member) => member.hp >= member.maxHp);
  const supplyFull = game.supplies >= 24;
  return {
    id: `waystation-${game.day}-${offer.cityId}-${offer.routeId}`,
    kind: "waystation",
    eyebrow: theme.eyebrow,
    title: theme.title(city.name),
    description: `${theme.description}${theme.statusNote}下一程是${nextRoute.name}。镖旗尚未正式入城，不能接榜办事，却可以在这里重新定下脚程。`,
    choices: [
      choice("stop-rest", "住驿整顿一日", restFull ? "人马气力俱足，无须再误一日" : game.supplies < 1 ? "至少需要 1 份余粮才能安顿人马" : "耗 1 份补给；恢复马力、士气与随行伤势", "safe", restFull || game.supplies < 1),
      choice("stop-stock", `托牙人补 ${offer.supplyGain} 份路粮`, supplyFull ? "粮袋已装满" : game.silver < offer.supplyCost ? `需 ${offer.supplyCost} 两，现银不足` : `花 ${offer.supplyCost} 两，不额外耗时`, "safe", supplyFull || game.silver < offer.supplyCost),
      choice("stop-intel", offer.officeBacked ? "取本号封签路报" : "听下一程新路报", offer.intelFresh ? "下一程已是今报" : game.silver < offer.intelCost ? `需 ${offer.intelCost} 两，现银不足` : offer.officeBacked ? "沿途网点已付茶钱，免费核报" : `花 ${offer.intelCost} 两核实旗号、路况与匪情`, "safe", offer.intelFresh || game.silver < offer.intelCost),
      choice("stop-press", "不落镖旗，继续赶路", "不耗时、不花银；连日不整顿会轻损士气", "risk"),
    ],
  };
}

export function borderPassageCost(game: GameState, targetFaction: FactionId, sensitive: boolean): number {
  const base = (journeyHasRole(game, "账房") ? 10 : 18) + (sensitive ? 6 : 0);
  return Math.max(4, Math.ceil(base * factionStanding(game.relations[targetFaction] ?? 0).passageMultiplier * principlePassageMultiplier(game)));
}

export function banditTollCost(game: GameState): number {
  return Math.ceil(22 * principlePassageMultiplier(game));
}

function currentAndNextRouteIds(game: GameState): string[] {
  if (!game.journey) return [];
  return game.journey.plan.routeIds.slice(game.journey.segmentIndex, game.journey.segmentIndex + 2);
}

export function createWorldActorEvent(game: GameState, routeId: string, actor: WorldActor): TravelEvent {
  const route = routeById(routeId);
  const relation = game.relations[actor.faction] ?? 0;
  if (actor.kind === "merchant") {
    return {
      id: `caravan-${game.day}-${routeId}-${actor.id}`,
      kind: "caravan",
      actorId: actor.id,
      eyebrow: "同路商旗在风里招展",
      title: `${actor.name}递来一面副旗`,
      description: `${actor.name}也走${route.name}。领队愿让风云行并入车阵，沿途互相照看；押尾伙计袖中还藏着下一站刚换来的封签路报。`,
      choices: [
        choice("caravan-join", "并旗结伴同行", "不误行程；补给 +2、士气 +5，并核实今明两程路报", "safe"),
        choice("caravan-intel", "花 5 两换一套路报", game.silver < 5 ? "现银不足" : "核实今明两程旗号、路况与匪情", "safe", game.silver < 5),
        choice("traveler-pass", "鸣镖越过车阵", "各守脚程，不欠人情，也不另生枝节", "risk"),
      ],
    };
  }
  if (actor.kind === "army") {
    const issuerFaction = game.journey?.issuerFaction ?? game.cities[game.currentCityId].owner;
    const hostile = relation < 0 || factionsAtWar(actor.faction, issuerFaction);
    if (hostile) {
      const inspectionCost = isBorderSensitive(game.journey!.contract) ? 18 : 12;
      return {
        id: `caravan-${game.day}-${routeId}-${actor.id}`,
        kind: "caravan",
        actorId: actor.id,
        eyebrow: `${FACTIONS[actor.faction].short}军大纛压住整条驿路`,
        title: `${actor.name}前锋勒令全车停验`,
        description: `${actor.name}正沿${route.name}向前线推进。甲骑封住路口，辎重卒逐车点验；这不是寻常巡检，若镖物牵涉军情，任何旧牒都未必压得住。`,
        choices: [
          choice("army-comply", `纳 ${inspectionCost} 两军例受验`, game.silver < inspectionCost ? "现银不足" : "保住时日与封条；该政权往来 +1", "risk", game.silver < inspectionCost),
          choice("army-detour", "卸旗绕过行营", game.supplies < 2 ? "至少需要 2 份补给" : "延误 1 日、耗 2 份补给与 12 点马力", "risk", game.supplies < 2),
          choice("fight", "趁换哨冲破前锋", `与${actor.name}前锋进入高压护车战`, "danger"),
        ],
      };
    }
    return {
      id: `caravan-${game.day}-${routeId}-${actor.id}`,
      kind: "caravan",
      actorId: actor.id,
      eyebrow: "援军行营为镖旗让开一道",
      title: `${actor.name}邀风云行缀随辎重`,
      description: `${actor.name}正沿${route.name}赶赴边城。掌书记愿开四日军前便牒，并把前方塘报抄给镖队；只盼风云行日后遇到军需急镖，仍肯照应。`,
      choices: [
        choice("army-banner", "随营同道", `获四日${FACTIONS[actor.faction].short}境军前便牒、士气 +6，并核实今明两程路报`, "safe"),
        choice("traveler-pass", "谢过军门，自走镖路", "不欠军中人情，照原定脚程前行", "risk"),
      ],
    };
  }
  if (actor.kind === "patrol" && relation < 0) {
    const inspectionCost = isBorderSensitive(game.journey!.contract) ? 14 : 9;
    return {
      id: `caravan-${game.day}-${routeId}-${actor.id}`,
      kind: "caravan",
      actorId: actor.id,
      eyebrow: `${FACTIONS[actor.faction].short}军号角截住去路`,
      title: `${actor.name}横马索验关牒`,
      description: `${actor.name}正沿${route.name}搜检过往车马。对方与风云行素有嫌隙，虽只说核对名册，几名骑卒的手却一直按在刀柄上。`,
      choices: [
        choice("patrol-comply", `纳 ${inspectionCost} 两照章受验`, game.silver < inspectionCost ? "现银不足" : "保住封条与时日；该政权往来 +1", "risk", game.silver < inspectionCost),
        choice("patrol-detour", "卸旗绕过巡队", game.supplies < 1 ? "至少需要 1 份补给" : "延误 1 日、耗 1 份补给与 8 点马力", "risk", game.supplies < 1),
        choice("fight", "拒检，护车突围", `与${actor.name}进入实时护车战`, "danger"),
      ],
    };
  }
  if (actor.kind === "patrol") {
    return {
      id: `caravan-${game.day}-${routeId}-${actor.id}`,
      kind: "caravan",
      actorId: actor.id,
      eyebrow: "巡骑认出了风云行旗号",
      title: `${actor.name}愿替镖队清道`,
      description: `${actor.name}刚从${route.name}前方折返。领骑愿让镖队缀在军旗之后，并开一张三日沿路便牒，但也要风云行记住这份人情。`,
      choices: [
        choice("patrol-banner", "借军旗同道", `获三日${FACTIONS[actor.faction].short}境便牒、士气 +4，并核实当前路报`, "safe"),
        choice("traveler-pass", "拱手谢过，自走镖路", "不欠军中人情，照原定脚程前行", "risk"),
      ],
    };
  }
  return {
    id: `caravan-${game.day}-${routeId}-${actor.id}`,
    kind: "caravan",
    actorId: actor.id,
    eyebrow: "两面镖旗挤上同一条路",
    title: `${actor.name}要争这一程头筹`,
    description: `${actor.name}从${route.name}后方追来，既提议合力压住沿途宵小，又当众夸口会先到下一站。随行镖师都在等掌柜定夺。`,
    choices: [
      choice("rival-team", "合旗清路", game.supplies < 1 ? "至少需要 1 份补给招待同行" : "耗 1 份补给；信用 +1、士气 +5，并核实今明两程路报", "safe", game.supplies < 1),
      choice("rival-race", "催马争先", "马力 -14、车况 -4；信用 +2、士气 +3", "risk"),
      choice("traveler-pass", "不争一时先后", "照自己的章程赶路，不受激将", "safe"),
    ],
  };
}

function createEvent(game: GameState, routeId: string, travelersAtDeparture: readonly WorldActor[] = []): { event: TravelEvent; rngState: number } {
  const route = routeById(routeId);
  const journey = game.journey!;
  const stance = travelStanceById(journey.stance);
  const segmentFrom = journey.plan.cityIds[journey.segmentIndex];
  const segmentTo = journey.plan.cityIds[journey.segmentIndex + 1];
  const destinationOwner = game.cities[segmentTo].owner;
  const originOwner = game.cities[segmentFrom].owner;
  if (destinationOwner !== originOwner) {
    const sensitive = isBorderSensitive(journey.contract);
    const passageCost = borderPassageCost(game, destinationOwner, sensitive);
    const permitValid = hasActivePermit(game, destinationOwner);
    const permitExpiresDay = game.travelPermits?.[destinationOwner] ?? 0;
    const concealSupplyCost = Math.max(0, (hasConvoyUpgrade(game.convoy, "hidden-compartment") ? 1 : 2) - principleConcealSaving(game));
    const subject = journey.contract.kind === "escort" ? "护送之人" : journey.contract.kind === "letter" ? "随身文书" : "车上镖物";
    const concealLabel = journey.contract.kind === "escort" ? "乔装换名过关" : journey.contract.kind === "letter" ? "夹藏密函过关" : "换票分装过关";
    const choices = [
      ...(permitValid ? [choice("permit", `出示${FACTIONS[destinationOwner].short}境路引`, sensitive ? `路引可用至第 ${permitExpiresDay} 日；敏感镖物仍有小概率被抽验` : `路引可用至第 ${permitExpiresDay} 日；免去关税与例行开箱`, sensitive ? "risk" : "safe")] : []),
      choice("papers", "商队名册通关", `花 ${passageCost} 两疏通关节${sensitive ? "；敏感镖物仍可能败露" : "，保住封条"}${journeyHasRole(game, "账房") ? "（账房识牒）" : ""}`, sensitive ? "risk" : "safe"),
      ...(sensitive && journey.contract.secretKnown ? [choice("conceal", concealLabel, `延误 1 日、消耗 ${concealSupplyCost} 份补给，以假身份避开查验${hasPrinciple(game, "shadow-pass") ? "（暗渡关山）" : hasConvoyUpgrade(game.convoy, "hidden-compartment") ? "（暗格夹层）" : ""}`, "safe")] : []),
      choice(
        "detour",
        stance.id === "covert" ? "偃旗循山口" : "趁夜绕过哨卡",
        stance.id === "covert"
          ? journeyHasRole(game, "向导")
            ? "延误 1 日；向导领路免耗补给，潜行布置使车轮只受微损"
            : "延误 1 日、消耗 1 份补给；潜行布置使车轮只受微损"
          : `延误 1 日，消耗 2 份补给并${journeyHasRole(game, "车把式") ? "轻微" : "明显"}损伤车轮`,
        "risk",
      ),
      choice("fight", "亮镖旗，强闯关道", "进入护车战；人货损失会带回地图", "danger"),
    ];
    return {
      rngState: game.rngState,
      event: {
        id: `border-${game.day}-${routeId}`,
        kind: "border",
        eyebrow: "国界在前方移动了",
        title: "旧关牒，过不了新关",
        description: `${cityById(segmentTo).name}前方已经换了旗号。巡骑要求查验${subject}；${journey.contract.sealRequired ? "而镖单明令封条不得破损。" : "若被扣留，交付时限便难以保证。"}${permitValid ? `匣中那张${FACTIONS[destinationOwner].name}路引仍在限期之内。` : ""}${sensitive && journey.contract.secretKnown ? "你已查明此镖经不起细查，好在还能提前换一套身份。" : ""}`,
        choices,
      },
    };
  }

  const roll = randomStep(game.rngState);
  const travelerChance = travelersAtDeparture.length ? 0.34 : 0;
  if (travelersAtDeparture.length && roll.value < travelerChance) {
    const picked = pickRandom(roll.state, travelersAtDeparture);
    return { rngState: picked.state, event: createWorldActorEvent(game, routeId, picked.value) };
  }
  const eventRoll = travelerChance > 0
    ? { ...roll, value: (roll.value - travelerChance) / (1 - travelerChance) }
    : roll;
  const routeIntel = game.routeIntel[routeId] ?? { surveyedDay: -99, knownDanger: route.danger, trips: 0, knownCondition: "clear" as const };
  const mastery = Math.min(3, routeIntel.trips);
  const watchedByOffice = Boolean(officeAt(game, route.from) || officeAt(game, route.to));
  const stormThreshold = Math.max(0.08, (route.terrain === "river" ? 0.22 : 0.13) - mastery * 0.015);
  if (eventRoll.value < stormThreshold) {
    return {
      rngState: eventRoll.state,
      event: {
        id: `storm-${game.day}-${routeId}`,
        kind: "storm",
        eyebrow: route.terrain === "river" ? "河面风急" : "天色骤变",
        title: route.terrain === "river" ? "渡口升起停航旗" : "骤雨把官道化成泥潭",
        description: "车轮越陷越深，马匹也开始躁动。硬赶能保时限，却未必保得住车。",
        choices: [
          choice("shelter", "扎营等候", "延误 1 日，队伍平安，马力恢复 12", "safe"),
          choice("press", "裹轮硬行", "消耗 2 份补给，车辆受轻损", "risk"),
        ],
      },
    };
  }
  const refugeeThreshold = stormThreshold + 0.18;
  if (eventRoll.value < refugeeThreshold) {
    return {
      rngState: eventRoll.state,
      event: {
        id: `refugees-${game.day}-${routeId}`,
        kind: "refugees",
        eyebrow: "路边有人举手",
        title: "一队难民请求随镖而行",
        description: "他们说前方有乱兵，也愿意指出一条少有人知的小路。老人和孩子会拖慢脚程，但眼下确实缺一份新情报。",
        choices: [
          choice("share", "分粮同行", "消耗 3 份补给，获得声望与可靠情报", "safe"),
          choice("decline", "婉拒继续赶路", "不延误，队伍士气略降", "risk"),
        ],
      },
    };
  }
  const stanceBreakdown = stance.id === "haste" ? 0.07 : stance.id === "covert" ? -0.02 : 0;
  const breakdownThreshold = refugeeThreshold + (route.terrain === "mountain" ? 0.17 : 0.12) + stanceBreakdown;
  if (eventRoll.value < breakdownThreshold) {
    const hasCarter = journeyHasRole(game, "车把式");
    const carter = journeyCrew(game).find((member) => member.role === "车把式" && member.hp > 0);
    const hasSpareAxle = hasConvoyUpgrade(game.convoy, "spare-axle");
    return {
      rngState: eventRoll.state,
      event: {
        id: `breakdown-${game.day}-${routeId}`,
        kind: "breakdown",
        eyebrow: "车轴发出一声闷响",
        title: "前轮木榫已经开裂",
        description: `${route.name}的碎石磨坏了轮榫。继续赶路能省下一日，但下一处下坡可能让整辆车侧翻。`,
        choices: [
          choice("repair", hasCarter ? `让${carter?.name ?? "车把式"}就地换榫` : hasSpareAxle ? "换上备用车轴" : "卸货就地换榫", hasSpareAxle ? "不延误、不耗补给（备用车轴）" : hasCarter ? "消耗 1 份补给，不误行程（车把式）" : "延误 1 日并消耗 1 份补给", "safe"),
          choice("press", "捆紧车轴继续走", hasCarter ? "车况轻损（车把式）" : "车况明显受损", "risk"),
        ],
      },
    };
  }
  const stanceRumor = stance.id === "covert" ? 0.1 : stance.id === "haste" ? -0.04 : 0;
  const rumorThreshold = Math.min(0.9, breakdownThreshold + 0.18 + stanceRumor + (watchedByOffice ? 0.08 : 0) + mastery * 0.025);
  if (eventRoll.value < rumorThreshold) {
    return {
      rngState: eventRoll.state,
      event: {
        id: `rumor-${game.day}-${routeId}`,
        kind: "rumor",
        eyebrow: watchedByOffice ? "暗桩在驿亭留下封签" : "驿卒压低声音递来口信",
        title: "前路的旧消息，有了新落款",
        description: watchedByOffice
          ? `风云行的人已经核过${route.name}沿线旗号，封签上的日期就是今日。`
          : `有人说前方刚换了巡检，也有人说只是商旅讹传。花些口粮请驿卒细说，或许能把传闻坐实。`,
        choices: [
          choice("verify", "歇脚核验路报", watchedByOffice ? "网点已付过茶钱，免费更新路报" : "消耗 1 份补给，更新此路情报", "safe"),
          choice("pass", "记下口信继续走", "不作停留，保住行程", "risk"),
        ],
      },
    };
  }
  const demandedTarget = journey.contract.kind === "escort" ? "客车里的人" : journey.contract.kind === "letter" ? "藏信的匣子" : "那辆货车";
  const sacrificeLabel = journey.contract.kind === "escort" ? "交出护送之人" : journey.contract.kind === "letter" ? "焚信弃匣脱身" : "弃下一箱镖货";
  const sacrificeHint = journey.contract.kind === "cargo" ? "货物完整度大损，但人车可走" : "此镖几乎必定失败，但镖队免战";
  const tollCost = banditTollCost(game);
  const pursuit = route.terrain !== "river" && journey.contract.kind !== "escort" && eventRoll.value > rumorThreshold + (1 - rumorThreshold) * 0.54;
  if (pursuit) {
    const stolenItem = journey.contract.kind === "letter" ? "封着暗记的信匣" : journey.contract.complication === "fragile" ? "一匣易碎镖物" : "头车上的红封镖匣";
    const loss = journey.contract.kind === "letter" ? 42 : journey.contract.complication === "fragile" ? 36 : 28;
    return {
      rngState: eventRoll.state,
      event: {
        id: `pursuit-${game.day}-${routeId}`,
        kind: "bandits",
        battleMode: "pursuit",
        eyebrow: "前哨忽然回马高喊",
        title: "快腿贼已经夺镖先逃",
        description: `剪径客用滚木截住后车，一名快腿贼趁乱夺走${stolenItem}，正沿${route.name}向前方山口逃去。其余匪徒回身阻路；此刻分人追镖，剩余车阵便会变薄。`,
        choices: [
          choice("fight", "立刻分出快手追镖", `进入自动追逐战；截住夺镖者可追回${stolenItem}`, "danger"),
          choice("sacrifice", "收拢车阵，不再深追", `保住人车，直接损失约 ${loss}% 镖物与江湖信用`, "risk"),
        ],
      },
    };
  }
  return {
    rngState: eventRoll.state,
    event: {
      id: `bandits-${game.day}-${routeId}`,
      kind: "bandits",
      eyebrow: stance.id === "haste" ? "疾驰扬尘引来三声唿哨" : stance.id === "covert" ? "暗路尽头仍有人候着" : "林中响起三声唿哨",
      title: "有人要借你的镖银买路",
      description: `十余名剪径客堵住${route.name}，却没有急着杀人。他们的眼睛一直盯着${demandedTarget}。`,
      choices: [
        choice("toll", `付 ${tollCost} 两买路`, `银钱换时间，江湖声望受损${hasPrinciple(game, "peaceful-road") ? "（以和开路）" : ""}`, "safe"),
        choice("bluff", "报字号压阵", "以镖局声望赌对方退让", "risk"),
        choice("sacrifice", sacrificeLabel, sacrificeHint, "danger"),
        choice("fight", "护住头车，列阵", "进入实时护车战", "danger"),
      ],
    },
  };
}

export function advanceTravel(game: GameState): GameState {
  if (!game.journey || game.phase !== "travel") return game;
  const routeId = game.journey.plan.routeIds[game.journey.segmentIndex];
  if (!routeId) return game;
  const route = routeById(routeId);
  const travelersAtDeparture = worldActorsOnRoute(game.worldActors, routeId);
  const actualCondition = effectiveRouteCondition(game.routeStates[routeId], game.day);
  if (!routeIsPassable(actualCondition)) {
    const revealed = revealRouteCondition(game, routeId);
    return { ...revealed, currentEvent: createRoadblockEvent(revealed, routeId), phase: "event" };
  }
  const forecast = segmentTravelForecast(game, routeId, game.convoy.horseStamina, true);
  let next = withWorldAdvance(game, forecast.days);
  const supplyCost = forecast.supplyCost;
  const shortfall = Math.max(0, supplyCost - next.supplies);
  const shortfallMoraleLoss = journeyHasRole(next, "厨子") ? 5 : 8;
  const escortShortfallDamage = next.journey!.contract.kind === "escort" ? shortfall * 5 : 0;
  const vulnerableCargo = next.journey!.contract.kind !== "escort" && next.journey!.contract.complication === "fragile";
  const horseDamage = forecast.staminaShortfall > 0 ? Math.min(18, 2 + Math.ceil(forecast.staminaShortfall / 7)) : 0;
  next = {
    ...next,
    supplies: Math.max(0, next.supplies - supplyCost),
    convoy: {
      ...next.convoy,
      morale: Math.max(0, next.convoy.morale - shortfall * shortfallMoraleLoss),
      leaderHp: Math.max(1, next.convoy.leaderHp - shortfall * 3),
      cargoIntegrity: Math.max(0, next.convoy.cargoIntegrity - (vulnerableCargo ? shortfall * 5 : 0)),
      horseStamina: Math.max(0, next.convoy.horseStamina - forecast.staminaCost),
      horseHp: Math.max(1, next.convoy.horseHp - horseDamage),
    },
    journey: {
      ...next.journey!,
      elapsedDays: next.day - next.journey!.startedDay,
      escortHealth: next.journey!.contract.kind === "escort"
        ? Math.max(0, (next.journey!.escortHealth ?? 100) - escortShortfallDamage)
        : next.journey!.escortHealth,
    },
  };
  const created = createEvent(next, routeId, travelersAtDeparture);
  return { ...next, rngState: created.rngState, currentEvent: created.event, phase: "event" };
}

function buildBattle(game: GameState): GameState {
  const journey = game.journey!;
  const stance = travelStanceById(journey.stance);
  const routeId = journey.plan.routeIds[journey.segmentIndex];
  const route = routeById(routeId);
  const encounteredActor = game.currentEvent?.actorId ? game.worldActors.find((actor) => actor.id === game.currentEvent?.actorId) : undefined;
  const enemyFaction = game.currentEvent?.kind === "caravan" && encounteredActor
    ? encounteredActor.name
    : game.currentEvent?.kind === "bandits"
    ? "拦路山寨"
    : game.currentEvent?.kind === "border"
      ? `${FACTIONS[game.cities[journey.plan.cityIds[journey.segmentIndex + 1]].owner].name}巡骑`
      : game.currentEvent?.kind === "roadblock"
        ? "封道军卒"
      : "不明武装";
  const objectiveMode = game.currentEvent?.battleMode ?? (route.terrain === "river" ? "holdout" as const : journey.contract.kind === "escort" ? "gate-run" as const : "breakthrough" as const);
  const objectiveSeconds = objectiveMode === "holdout" ? 42 : objectiveMode === "gate-run" ? (route.terrain === "mountain" ? 54 : 46) : objectiveMode === "pursuit" ? 34 : 72;
  const recoveryLabel = journey.contract.kind === "letter" ? "密信匣" : journey.contract.complication === "fragile" ? "易碎镖匣" : "红封镖匣";
  const pursuitCargoLoss = journey.contract.kind === "letter" ? 42 : journey.contract.complication === "fragile" ? 36 : 28;
  const objective = objectiveMode === "holdout"
    ? "守住车马，撑到渡船靠岸"
    : objectiveMode === "gate-run"
      ? "护送客车在城门落锁前通过关口"
      : objectiveMode === "pursuit"
        ? `截住夺镖者，追回${recoveryLabel}`
      : journey.contract.kind === "letter"
        ? "护住藏信镖车抵达右侧关口"
        : "护送镖车抵达右侧关口";
  const objectiveNote = objectiveMode === "holdout"
    ? `固守 ${objectiveSeconds} 息，车马与镖物仍在即可过渡`
    : objectiveMode === "gate-run"
      ? `${objectiveSeconds} 息内抵达右侧城门，不必杀尽追兵`
      : objectiveMode === "pursuit"
        ? `夺镖者正向右侧山口脱逃；强行开路会自动集中追击，围车则保住余货`
      : "护车推进至右侧关口，停阵可减轻车货损伤";
  const guideCover = route.terrain === "mountain" && journeyHasRole(game, "向导") ? 8 : 0;
  const danger = Math.min(96, Math.max(12, currentRouteDanger(game, routeId) - Math.min(3, game.routeIntel[routeId]?.trips ?? 0) * 5 - guideCover + stance.dangerModifier));
  return {
    ...game,
    phase: "battle",
    currentEvent: null,
    pendingBattle: {
      id: `battle-${game.day}-${routeId}`,
      seed: game.rngState,
      terrain: route.terrain,
      danger,
      objective,
      objectiveMode,
      objectiveSeconds,
      objectiveNote,
      recoveryLabel: objectiveMode === "pursuit" ? recoveryLabel : undefined,
      pursuitCargoLoss: objectiveMode === "pursuit" ? pursuitCargoLoss : undefined,
      enemyFaction,
      enemyLeaderName: game.currentEvent?.kind === "bandits" && danger >= 60 ? "山寨匪首" : undefined,
      routeName: route.name,
      vehicleName: WAGONS[game.convoy.wagonId].name,
      horseName: HORSE_TEAMS[game.convoy.horseTeamId].name,
      cartArmor: wagonDamageMultiplier(game.convoy),
      cartHealthRatio: game.convoy.cartHp / 100,
      spareAxle: hasConvoyUpgrade(game.convoy, "spare-axle"),
      cargoProtection: cargoDamageMultiplier(game.convoy),
      horseProtection: HORSE_TEAMS[game.convoy.horseTeamId].protection,
      horseHealthRatio: game.convoy.horseHp / 100,
      morale: game.convoy.morale,
      escortClient: journey.contract.kind === "escort"
        ? { name: journey.contract.cargo, healthRatio: (journey.escortHealth ?? 100) / 100 }
        : undefined,
      martialArtId: game.martialArtId,
      leader: leaderBattleProfile(game),
      guards: crewBattleGuards(game.crew, journey.crewIds, game.crewEquipment, game.equipmentTuning),
    },
  };
}

function createHandoffEvent(game: GameState): TravelEvent | null {
  const journey = game.journey;
  if (!journey || journey.handoffChoice) return null;
  const expectedOwner = journey.expectedDestinationOwner;
  const actualOwner = game.cities[journey.contract.to].owner;
  if (!expectedOwner || expectedOwner === actualOwner) return null;
  const contract = journey.contract;
  const protectedByPreparation = contract.secretKnown || journey.stance === "covert" || hasConvoyUpgrade(game.convoy, "hidden-compartment");
  const covertSupplyCost = Math.max(0, 2 - (hasConvoyUpgrade(game.convoy, "hidden-compartment") ? 1 : 0) - principleConcealSaving(game));
  const subject = contract.kind === "escort" ? contract.cargo : contract.kind === "letter" ? `装着${contract.cargo}的信匣` : contract.cargo;
  const choices: EventChoice[] = [
    choice("handoff-original", "寻原接头人，照旧约交割", `延误 1 日；保住原约与封条，但会触怒${FACTIONS[actualOwner].name}新署`, "risk"),
    choice(
      "handoff-authority",
      `向${FACTIONS[actualOwner].short}署登记交割`,
      contract.sealRequired ? `立即入城；官署会拆验封条、重议酬金，却能换来${FACTIONS[actualOwner].name}信任` : `立即入城；接受新署重议酬金，换取${FACTIONS[actualOwner].name}信任`,
      "risk",
    ),
    ...(protectedByPreparation ? [choice(
      "handoff-covert",
      "趁夜由旧行院秘密接货",
      `消耗 ${covertSupplyCost} 份补给；保住封条与原约，只让新署留下些许疑心${contract.secretKnown ? "（已知接头暗记）" : journey.stance === "covert" ? "（偃旗潜行）" : "（暗格夹层）"}`,
      "safe",
      game.supplies < covertSupplyCost,
    )] : []),
  ];
  return {
    id: `handoff-${game.day}-${journey.contract.id}`,
    kind: "handoff",
    eyebrow: "城头旗号已换，接货的人也换了",
    title: "一份镖，只能交给一边",
    description: `镖队赶到${cityById(contract.to).name}城外，城头已从${FACTIONS[expectedOwner].short}旗换成${FACTIONS[actualOwner].short}旗。原接头人藏在旧行栈，新官署则张榜要求所有外来镖货先行登记。${subject}只有一份，风云行的信用也只能押给一个答案。`,
    choices,
  };
}

function completeSegment(game: GameState): GameState {
  const journey = game.journey!;
  const completedRouteId = journey.plan.routeIds[journey.segmentIndex];
  const medic = journeyCrew(game).find((member) => member.role === "医师" && member.hp > 0);
  if (medic) {
    let healed = false;
    const crew = game.crew.map((member) => {
      if (!journey.crewIds.includes(member.id) || member.hp >= member.maxHp) return member;
      healed = true;
      return { ...member, hp: Math.min(member.maxHp, member.hp + 4) };
    });
    if (healed) {
      const guardsFit = journey.crewIds.filter((id) => (crew.find((member) => member.id === id)?.hp ?? 0) >= 20).length;
      game = {
        ...game,
        crew,
        convoy: { ...game.convoy, guardsFit },
        news: [`【途中诊治】${medic.name}在歇脚时重新包扎伤口，随行人手各复四分气力。`, ...game.news].slice(0, 6),
      };
    }
  }
  const previousIntel = game.routeIntel[completedRouteId] ?? { surveyedDay: -99, knownDanger: routeById(completedRouteId).danger, trips: 0, knownCondition: "clear" as const };
  const nextTrips = previousIntel.trips + 1;
  const routeIntel = {
    ...game.routeIntel,
    [completedRouteId]: { surveyedDay: game.day, knownDanger: currentRouteDanger(game, completedRouteId), trips: nextTrips, knownCondition: effectiveRouteCondition(game.routeStates[completedRouteId], game.day) },
  };
  const masteryNews = nextTrips === 2 ? [`【熟路成网】${routeById(completedRouteId).name}已走过两趟，往后可少耗一份补给。`, ...game.news].slice(0, 6) : game.news;
  game = { ...game, routeIntel, news: masteryNews };
  const nextIndex = journey.segmentIndex + 1;
  const updatedJourney = {
    ...journey,
    segmentIndex: nextIndex,
    traveledRouteIds: [...journey.traveledRouteIds, journey.plan.routeIds[journey.segmentIndex]],
    elapsedDays: game.day - journey.startedDay,
  };
  if (nextIndex < journey.plan.routeIds.length) {
    const stopped: GameState = { ...game, phase: "event", currentEvent: null, pendingBattle: null, journey: updatedJourney };
    return { ...stopped, currentEvent: createStopoverEvent(stopped) };
  }
  const arrived: GameState = { ...game, journey: updatedJourney, currentEvent: null, pendingBattle: null };
  const handoffEvent = createHandoffEvent(arrived);
  if (handoffEvent) return { ...arrived, phase: "event", currentEvent: handoffEvent };
  return settleJourney(arrived);
}

function settleJourney(game: GameState): GameState {
  const journey = game.journey!;
  const contract = journey.contract;
  const handoffChoice = journey.handoffChoice;
  const expectedDestinationOwner = journey.expectedDestinationOwner ?? game.cities[contract.to].owner;
  const actualDestinationOwner = game.cities[contract.to].owner;
  const changedHands = expectedDestinationOwner !== actualDestinationOwner;
  const lateDays = Math.max(0, game.day - (journey.startedDay + journey.contract.deadline));
  const integrity = contract.kind === "escort" ? journey.escortHealth ?? 100 : game.convoy.cargoIntegrity;
  const sealFailure = contract.sealRequired && !game.convoy.sealIntact;
  const excessLoss = Math.max(0, 100 - integrity - contract.allowedLoss);
  const lateRate = contract.kind === "letter" ? 0.14 : contract.kind === "escort" ? 0.1 : 0.08;
  const lossDivisor = contract.kind === "letter" ? 80 : contract.kind === "escort" ? 92 : 145;
  const sealPenalty = contract.kind === "letter" ? 0.48 : contract.kind === "cargo" ? 0.25 : 0;
  const conditionLabel = contract.kind === "escort" ? "护送对象安危" : contract.kind === "letter" ? "信物完整度" : "货物完整度";
  let multiplier = 1;
  const notes: string[] = [];
  if (lateDays > 0) { multiplier -= Math.min(0.5, lateDays * lateRate); notes.push(`比约定晚了 ${lateDays} 日${contract.kind === "letter" ? "，密信时效受损" : ""}`); }
  if (excessLoss > 0) { multiplier -= excessLoss / lossDivisor; notes.push(`${conditionLabel} ${integrity}%（允损 ${contract.allowedLoss}%）`); }
  if (sealFailure) { multiplier -= sealPenalty; notes.push(contract.kind === "letter" ? "信封与暗记已经破损" : "货封已经破损"); }
  if (changedHands && handoffChoice === "authority") {
    const authorityRate = contract.sealRequired ? .92 : .84;
    multiplier *= authorityRate;
    notes.push(`${FACTIONS[actualDestinationOwner].name}新署按新例重议交割，只认原酬的 ${Math.round(authorityRate * 100)}%`);
  } else if (changedHands && handoffChoice === "original") {
    notes.push(`绕过${FACTIONS[actualDestinationOwner].name}新署，由${FACTIONS[expectedDestinationOwner].name}旧接头人照原约收镖`);
  } else if (changedHands && handoffChoice === "covert") {
    notes.push(`旧行院暗门接镖，原约与封记都没有落进${FACTIONS[actualDestinationOwner].name}新署手中`);
  }
  if (game.convoy.guardsFit < 3) notes.push(`${3 - game.convoy.guardsFit} 名趟子手负伤`);
  if (game.convoy.horseHp < 55) notes.push(`${HORSE_TEAMS[game.convoy.horseTeamId].name}伤损至 ${game.convoy.horseHp}%`);
  if (game.convoy.horseStamina < 20) notes.push("马力已经见底，入城后宜先投宿马院");
  multiplier = Math.max(0, multiplier);
  const principleReward = principleRewardMultiplier(game, contract);
  const grossReward = Math.round(contract.reward * multiplier * principleReward.multiplier);
  if (principleReward.label && multiplier > 0) notes.push(`「${principleReward.label}」名声为此镖添酬 ${Math.round((principleReward.multiplier - 1) * 100)}%`);
  const crewWages = journeyCrew(game).reduce((sum, member) => sum + member.wage, 0);
  const reward = Math.max(0, grossReward - crewWages);
  if (crewWages > 0) notes.push(`随行三人脚钱 ${crewWages} 两`);
  const tradeCondition = Math.min(integrity, game.convoy.cartHp);
  const tradeRevenue = journey.tradeLot ? tradeSaleValue(journey.tradeLot, contract.to, game.cities[contract.to], journey.plan.days, tradeCondition) : 0;
  const tradeProfit = journey.tradeLot ? tradeRevenue - journey.tradeLot.purchasePrice : 0;
  if (journey.tradeLot) {
    const tradeGood = TRADE_GOODS[journey.tradeLot.goodId];
    notes.push(`副货「${tradeGood.name}」以 ${tradeCondition}% 成色售得 ${tradeRevenue} 两，${tradeProfit >= 0 ? `净赚 ${tradeProfit}` : `折本 ${Math.abs(tradeProfit)}`} 两`);
  }
  const grade: Settlement["grade"] = multiplier >= 0.95 ? "甲" : multiplier >= 0.65 ? "乙" : multiplier > 0 ? "丙" : "失镖";
  const equipmentReward = equipmentRewardForDelivery(contract, grade, journey.battleVictories ?? 0, game.completedContracts);
  if (equipmentReward) {
    const item = EQUIPMENT[equipmentReward];
    notes.push(`胜阵所得「${item.name}」一件，已由${item.origin ?? "沿途行院"}送入器械架`);
  }
  const baseReputationChange = grade === "甲" ? 6 : grade === "乙" ? 3 : grade === "丙" ? -2 : -8;
  const reputationChange = baseReputationChange + (changedHands && handoffChoice === "authority" ? -3 : changedHands && handoffChoice === "original" ? 1 : 0);
  const compensation = grade === "失镖" ? Math.min(contract.failurePenalty, game.silver + reward) : 0;
  if (compensation > 0) notes.push(`按镖单赔付 ${compensation} 两`);
  if (!contract.secretKnown && contract.complication !== "none") notes.push(`交付后方知：${contract.secret}`);
  const deliveryVerb = contract.kind === "escort" ? "护送" : contract.kind === "letter" ? "送达" : "运抵";
  const title = grade === "失镖"
    ? "此镖未成"
    : changedHands && handoffChoice === "authority"
      ? "新署收镖"
      : changedHands && handoffChoice === "original"
        ? "旧约得全"
        : changedHands && handoffChoice === "covert"
          ? "暗门交印"
          : grade === "甲"
            ? contract.kind === "escort" ? "人到无恙" : contract.kind === "letter" ? "信达印全" : "镖到货安"
            : grade === "乙" ? "有惊无险" : "残镖抵城";
  const originalCity = game.cities[contract.to];
  const helpfulDelivery = grade === "甲" || grade === "乙";
  const treatsPlague = /药|医师|大夫/.test(contract.cargo);
  const relievesFamine = /粮|米|盐|茶|家眷/.test(contract.cargo);
  const aidsDefense = /军|守城|军器|匠人|蜡书/.test(`${contract.cargo}${contract.title}`);
  const conditionRelieved = helpfulDelivery && (
    (originalCity.status === "plague" && treatsPlague)
    || (originalCity.status === "famine" && relievesFamine)
    || ((originalCity.status === "besieged" || originalCity.status === "contested") && aidsDefense)
  );
  const prosperityChange = grade === "甲" ? 3 : grade === "乙" ? 1 : grade === "失镖" ? -3 : -1;
  const securityChange = grade === "甲" ? 2 : grade === "乙" ? 1 : grade === "失镖" ? -2 : 0;
  let destinationStatus = originalCity.status;
  if (conditionRelieved) {
    destinationStatus = originalCity.status === "besieged" || originalCity.status === "contested" ? "tense" : "stable";
    notes.push(`此镖正解${CITY_STATUS_EFFECTS[originalCity.status].label}之急，${cityById(contract.to).name}城况转为${CITY_STATUS_EFFECTS[destinationStatus].label}`);
  }
  const destinationCity: CityState = {
    ...originalCity,
    status: destinationStatus,
    prosperity: Math.max(0, Math.min(100, originalCity.prosperity + prosperityChange + (conditionRelieved ? 7 : 0))),
    security: Math.max(0, Math.min(100, originalCity.security + securityChange + (conditionRelieved ? 5 : 0))),
    statusSinceDay: destinationStatus === originalCity.status ? originalCity.statusSinceDay : game.day,
    intelDay: game.day,
  };
  const destinationStandingChange = grade === "甲" ? 10 : grade === "乙" ? 6 : grade === "丙" ? 2 : -8;
  const originStandingChange = grade === "甲" ? 3 : grade === "乙" ? 1 : grade === "丙" ? -1 : -4;
  notes.push(`${cityById(contract.to).name}本地声望 ${destinationStandingChange >= 0 ? "+" : ""}${destinationStandingChange}，${cityById(contract.from).name}托运人口碑 ${originStandingChange >= 0 ? "+" : ""}${originStandingChange}`);
  let cityReputation = changeCityReputation(game.cityReputation, contract.from, originStandingChange);
  cityReputation = changeCityReputation(cityReputation, contract.to, destinationStandingChange);
  const targetFaction = actualDestinationOwner;
  const baseRelationChange = grade === "甲" ? 2 : grade === "乙" ? 1 : grade === "丙" ? -1 : -3;
  const relationChanges: Partial<Record<FactionId, number>> = {};
  const addRelationChange = (faction: FactionId, amount: number) => { relationChanges[faction] = (relationChanges[faction] ?? 0) + amount; };
  if (changedHands && handoffChoice === "authority") {
    addRelationChange(targetFaction, grade === "失镖" ? 1 : 4);
    addRelationChange(expectedDestinationOwner, -4);
  } else if (changedHands && (handoffChoice === "original" || handoffChoice === "covert")) {
    addRelationChange(expectedDestinationOwner, baseRelationChange);
    addRelationChange(targetFaction, handoffChoice === "covert" ? -1 : -2);
  } else addRelationChange(targetFaction, baseRelationChange);
  for (const [factionId, amount] of Object.entries(relationChanges) as Array<[FactionId, number]>) {
    notes.push(`${FACTIONS[factionId].name}往来 ${amount >= 0 ? "+" : ""}${amount}`);
  }
  const relations = { ...game.relations };
  for (const [factionId, amount] of Object.entries(relationChanges) as Array<[FactionId, number]>) {
    relations[factionId] = clampFactionRelation((relations[factionId] ?? 0) + amount);
  }
  const settlement: Settlement = {
    grade,
    title,
    summary: `风云行${deliveryVerb}「${contract.cargo}」至${cityById(contract.to).name}${changedHands && handoffChoice ? `，并在易旗之后${handoffChoice === "authority" ? "改向新署交割" : handoffChoice === "covert" ? "完成暗门交割" : "守住原接头之约"}` : ""}。`,
    reward,
    compensation,
    tradeRevenue: journey.tradeLot ? tradeRevenue : undefined,
    tradeProfit: journey.tradeLot ? tradeProfit : undefined,
    equipmentReward,
    reputationChange,
    notes: notes.length ? notes : [contract.kind === "escort" ? "按期抵达，护送之人安然无恙" : contract.kind === "letter" ? "按期抵达，信封、暗记与内页均完好" : "按期抵达，货物与封条均完好"],
  };
  const settled: GameState = {
    ...game,
    phase: "settlement",
    currentCityId: contract.to,
    selectedCityId: contract.to,
    silver: Math.max(0, game.silver + reward + tradeRevenue - compensation),
    reputation: Math.max(0, game.reputation + reputationChange),
    cityReputation,
    relations,
    cities: { ...game.cities, [contract.to]: destinationCity },
    crew: game.crew.map((member) => journey.crewIds.includes(member.id) ? { ...member, experience: member.experience + 1 } : member),
    equipmentStock: equipmentReward
      ? { ...game.equipmentStock, [equipmentReward]: (game.equipmentStock[equipmentReward] ?? 0) + 1 }
      : game.equipmentStock,
    settlement,
    completedContracts: game.completedContracts + 1,
    news: [`【${cityById(contract.to).name}】${settlement.title}，镖酬入账 ${reward} 两${tradeRevenue ? `，副货回银 ${tradeRevenue} 两` : ""}${compensation ? `，赔付 ${compensation} 两` : ""}${equipmentReward ? `，胜阵所得「${EQUIPMENT[equipmentReward].name}」已入器械架` : ""}。`, ...game.news].slice(0, 6),
  };
  const conductIncrements: Partial<ConductState> = {};
  if (helpfulDelivery && contract.sealRequired && !sealFailure) conductIncrements.intactSealedDeliveries = 1;
  if (helpfulDelivery && contract.kind === "escort") conductIncrements.escortDeliveries = 1;
  if (helpfulDelivery && changedHands && handoffChoice === "covert") conductIncrements.concealedBorders = 1;
  return advanceConduct(settled, conductIncrements);
}

export function equipmentRewardForDelivery(contract: Contract, grade: Settlement["grade"], battleVictories = 0, completedContracts = 0): EquipmentId | undefined {
  if (contract.risk !== "凶险" || battleVictories < 1 || (grade !== "甲" && grade !== "乙")) return undefined;
  if (contract.kind === "letter") return "watch-crossbow";
  if (contract.kind === "escort") return "field-medicine-chest";
  return completedContracts % 2 === 0 ? "frontier-hook-spear" : "black-lacquer-shield";
}

export function resolveEvent(game: GameState, choiceId: string): GameState {
  if (!game.currentEvent || game.phase !== "event") return game;
  const kind = game.currentEvent.kind;
  let next: GameState = { ...game };
  const stance = travelStanceById(next.journey?.stance);

  if (choiceId === "fight") return buildBattle(game);
  if (kind === "handoff") {
    const picked = game.currentEvent.choices.find((item) => item.id === choiceId);
    if (!picked || picked.disabled || !next.journey) return next;
    const contract = next.journey.contract;
    const actualOwner = next.cities[contract.to].owner;
    const expectedOwner = next.journey.expectedDestinationOwner ?? actualOwner;
    let handoffChoice: HandoffChoice;
    let report: string;
    if (choiceId === "handoff-original") {
      handoffChoice = "original";
      next = { ...next, day: next.day + 1 };
      report = `镖队在${cityById(contract.to).name}城外多候一日，终于由${FACTIONS[expectedOwner].name}旧行院接走${contract.cargo}。`;
    } else if (choiceId === "handoff-authority") {
      handoffChoice = "authority";
      next = {
        ...next,
        convoy: { ...next.convoy, sealIntact: contract.sealRequired ? false : next.convoy.sealIntact },
      };
      report = `${FACTIONS[actualOwner].name}新署收下${contract.cargo}${contract.sealRequired ? "，当堂拆验了旧封" : "，并重开了一纸交割凭信"}。`;
    } else if (choiceId === "handoff-covert") {
      handoffChoice = "covert";
      const covertSupplyCost = Math.max(0, 2 - (hasConvoyUpgrade(next.convoy, "hidden-compartment") ? 1 : 0) - principleConcealSaving(next));
      if (next.supplies < covertSupplyCost) return next;
      next = { ...next, supplies: next.supplies - covertSupplyCost };
      report = `镖队熄灯卸旗，由旧行院暗门交出${contract.cargo}，没有让${FACTIONS[actualOwner].name}新署碰到封记。`;
    } else return next;
    next = {
      ...next,
      journey: { ...next.journey!, handoffChoice },
      currentEvent: null,
      news: [`【易旗交割】${report}`, ...next.news].slice(0, 6),
    };
    return settleJourney(next);
  }
  if (kind === "waystation") {
    const offer = stopoverOffer(next);
    const picked = game.currentEvent.choices.find((item) => item.id === choiceId);
    if (!offer || !picked || picked.disabled) return next;
    const cityName = cityById(offer.cityId).name;
    if (choiceId === "stop-rest") {
      next = withWorldAdvance(next, 1);
      const hasMedic = journeyHasRole(next, "医师");
      const healAmount = hasMedic ? 10 : 6;
      const crew = next.crew.map((member) => next.journey!.crewIds.includes(member.id)
        ? { ...member, hp: Math.min(member.maxHp, member.hp + healAmount), injury: hasMedic ? recoverCrewInjury(member.injury, 1) : member.injury }
        : member);
      const leader = hasMedic ? { ...next.leader, injury: recoverCrewInjury(next.leader.injury, 1) } : next.leader;
      const guardsFit = next.journey!.crewIds.filter((id) => (crew.find((member) => member.id === id)?.hp ?? 0) >= 20).length;
      next = {
        ...next,
        supplies: Math.max(0, next.supplies - 1),
        leader,
        crew,
        convoy: {
          ...next.convoy,
          leaderHp: Math.min(100, next.convoy.leaderHp + 6),
          guardsFit,
          morale: Math.min(100, next.convoy.morale + 8),
          horseHp: Math.min(100, next.convoy.horseHp + 3),
          horseStamina: Math.min(100, next.convoy.horseStamina + 34),
        },
        news: [`【${cityName}歇脚】镖队住驿整顿一日，人马重新包扎饮喂${hasMedic ? "，随行医师也替伤员换了药" : ""}。`, ...next.news].slice(0, 6),
      };
    } else if (choiceId === "stop-stock") {
      if (next.silver < offer.supplyCost || next.supplies >= 24) return next;
      next = {
        ...next,
        silver: next.silver - offer.supplyCost,
        supplies: Math.min(24, next.supplies + offer.supplyGain),
        news: [`【${cityName}添粮】城外牙人送来 ${offer.supplyGain} 份路粮，收讫 ${offer.supplyCost} 两。`, ...next.news].slice(0, 6),
      };
    } else if (choiceId === "stop-intel") {
      if (next.silver < offer.intelCost || offer.intelFresh) return next;
      next = {
        ...next,
        silver: next.silver - offer.intelCost,
        routeIntel: refreshedIntel(next, [offer.routeId]),
        news: [`【${cityName}核报】${routeById(offer.routeId).name}的路况、旗号与匪情已经核到今日。`, ...next.news].slice(0, 6),
      };
    } else if (choiceId === "stop-press") {
      next = {
        ...next,
        convoy: { ...next.convoy, morale: Math.max(0, next.convoy.morale - 3) },
        news: [`【过${cityName}不入】镖队未落旗便继续赶路，省下时日，却让连日奔波的人手更显疲惫。`, ...next.news].slice(0, 6),
      };
    } else return next;
    return {
      ...next,
      phase: "travel",
      currentEvent: null,
      journey: next.journey ? { ...next.journey, elapsedDays: next.day - next.journey.startedDay } : null,
    };
  }
  if (kind === "caravan") {
    const picked = game.currentEvent.choices.find((item) => item.id === choiceId);
    if (!picked || picked.disabled || !next.journey) return next;
    const actor = game.currentEvent.actorId ? next.worldActors.find((item) => item.id === game.currentEvent?.actorId) : undefined;
    const actorName = actor?.name ?? "同路行旅";
    const routeId = next.journey.plan.routeIds[next.journey.segmentIndex];
    if (choiceId === "caravan-join") {
      next = {
        ...next,
        supplies: Math.min(24, next.supplies + 2),
        relations: actor ? { ...next.relations, [actor.faction]: clampFactionRelation((next.relations[actor.faction] ?? 0) + 1) } : next.relations,
        routeIntel: refreshedIntel(next, currentAndNextRouteIds(next)),
        convoy: { ...next.convoy, morale: Math.min(100, next.convoy.morale + 5) },
        news: [`【并旗同行】风云行与${actorName}合成一阵，沿途互报旗号，还分得两包应急路粮。`, ...next.news].slice(0, 6),
      };
    } else if (choiceId === "caravan-intel") {
      if (next.silver < 5) return next;
      next = {
        ...next,
        silver: next.silver - 5,
        routeIntel: refreshedIntel(next, currentAndNextRouteIds(next)),
        news: [`【商帮换报】${actorName}收下 5 两茶钱，把今明两程的封签路报交给风云行。`, ...next.news].slice(0, 6),
      };
    } else if (choiceId === "patrol-comply") {
      if (!actor) return completeSegment(next);
      const inspectionCost = isBorderSensitive(next.journey.contract) ? 14 : 9;
      if (next.silver < inspectionCost) return next;
      next = {
        ...next,
        silver: next.silver - inspectionCost,
        relations: { ...next.relations, [actor.faction]: clampFactionRelation((next.relations[actor.faction] ?? 0) + 1) },
        news: [`【途中受验】${actorName}收下 ${inspectionCost} 两关例，核过名册后没有拆动镖封。`, ...next.news].slice(0, 6),
      };
    } else if (choiceId === "patrol-detour") {
      if (next.supplies < 1) return next;
      next = withWorldAdvance(next, 1);
      next = {
        ...next,
        supplies: next.supplies - 1,
        convoy: { ...next.convoy, horseStamina: Math.max(0, next.convoy.horseStamina - 8), morale: Math.max(0, next.convoy.morale - 2) },
        journey: next.journey ? { ...next.journey, elapsedDays: next.day - next.journey.startedDay } : null,
        news: [`【避开巡骑】镖队卸旗绕开${actorName}，在荒径多耗一日与一份路粮。`, ...next.news].slice(0, 6),
      };
    } else if (choiceId === "patrol-banner") {
      if (!actor) return completeSegment(next);
      next = {
        ...next,
        relations: { ...next.relations, [actor.faction]: clampFactionRelation((next.relations[actor.faction] ?? 0) + 1) },
        travelPermits: { ...next.travelPermits, [actor.faction]: Math.max(next.travelPermits[actor.faction] ?? 0, next.day + 3) },
        routeIntel: refreshedIntel(next, [routeId]),
        convoy: { ...next.convoy, morale: Math.min(100, next.convoy.morale + 4) },
        news: [`【借旗清道】${actorName}开出三日沿路便牒，风云行缀在军旗后走过这一程。`, ...next.news].slice(0, 6),
      };
    } else if (choiceId === "army-comply") {
      if (!actor) return completeSegment(next);
      const inspectionCost = isBorderSensitive(next.journey.contract) ? 18 : 12;
      if (next.silver < inspectionCost) return next;
      next = {
        ...next,
        silver: next.silver - inspectionCost,
        relations: { ...next.relations, [actor.faction]: clampFactionRelation((next.relations[actor.faction] ?? 0) + 1) },
        news: [`【军前受验】${actorName}前锋收下 ${inspectionCost} 两军例，逐车核名后仍让镖封原样过营。`, ...next.news].slice(0, 6),
      };
    } else if (choiceId === "army-detour") {
      if (next.supplies < 2) return next;
      next = withWorldAdvance(next, 1);
      next = {
        ...next,
        supplies: next.supplies - 2,
        convoy: { ...next.convoy, horseStamina: Math.max(0, next.convoy.horseStamina - 12), morale: Math.max(0, next.convoy.morale - 3) },
        journey: next.journey ? { ...next.journey, elapsedDays: next.day - next.journey.startedDay } : null,
        news: [`【绕开行营】镖队卸旗穿过荒径，避开${actorName}大队，代价是一日、两份路粮与一程马力。`, ...next.news].slice(0, 6),
      };
    } else if (choiceId === "army-banner") {
      if (!actor) return completeSegment(next);
      next = {
        ...next,
        relations: { ...next.relations, [actor.faction]: clampFactionRelation((next.relations[actor.faction] ?? 0) + 2) },
        travelPermits: { ...next.travelPermits, [actor.faction]: Math.max(next.travelPermits[actor.faction] ?? 0, next.day + 4) },
        routeIntel: refreshedIntel(next, currentAndNextRouteIds(next)),
        convoy: { ...next.convoy, morale: Math.min(100, next.convoy.morale + 6) },
        news: [`【随营同道】${actorName}开出四日军前便牒，风云行缀随辎重走过此程，并抄得今明两程塘报。`, ...next.news].slice(0, 6),
      };
    } else if (choiceId === "rival-team") {
      if (next.supplies < 1) return next;
      next = {
        ...next,
        supplies: next.supplies - 1,
        reputation: next.reputation + 1,
        routeIntel: refreshedIntel(next, currentAndNextRouteIds(next)),
        convoy: { ...next.convoy, morale: Math.min(100, next.convoy.morale + 5) },
        news: [`【两镖合旗】风云行拿出一份路粮招待${actorName}，两队互为前后哨，沿路宵小不敢近车。`, ...next.news].slice(0, 6),
      };
    } else if (choiceId === "rival-race") {
      next = {
        ...next,
        reputation: next.reputation + 2,
        convoy: {
          ...next.convoy,
          horseStamina: Math.max(0, next.convoy.horseStamina - 14),
          cartHp: Math.max(5, next.convoy.cartHp - 4),
          morale: Math.min(100, next.convoy.morale + 3),
        },
        news: [`【镖路争先】风云行催马压过${actorName}半个车身，赢得叫好，也让车轴与马力吃了苦头。`, ...next.news].slice(0, 6),
      };
    } else if (choiceId === "traveler-pass") {
      next = { ...next, news: [`【各走一程】风云行与${actorName}拱手错过，各守自己的旗号和脚程。`, ...next.news].slice(0, 6) };
    } else return next;
    return completeSegment(next);
  }
  if (kind === "roadblock") {
    const journey = next.journey!;
    const routeId = journey.plan.routeIds[journey.segmentIndex];
    const routeState = next.routeStates[routeId];
    const condition = effectiveRouteCondition(routeState, next.day);
    if (choiceId === "wait-road") {
      const waitDays = Math.max(1, (routeState?.clearsDay ?? next.day + 2) - next.day);
      next = withWorldAdvance(next, waitDays);
      return {
        ...next,
        phase: "travel",
        currentEvent: null,
        journey: next.journey ? { ...next.journey, elapsedDays: next.day - next.journey.startedDay } : null,
        news: [`【候路再行】镖队在${routeById(routeId).name}前等了 ${waitDays} 日，如今可以重新探路。`, ...next.news].slice(0, 6),
      };
    }
    if (choiceId === "reroute-road") {
      const from = journey.plan.cityIds[journey.segmentIndex];
      const detour = generateRoutePlans(from, journey.contract.to, next, true)[0];
      if (!detour) return next;
      return {
        ...next,
        phase: "travel",
        currentEvent: null,
        journey: { ...journey, plan: detour, segmentIndex: 0 },
        news: [`【临机改道】避开${routeById(routeId).name}，余程改走「${detour.label}」：${detour.cityIds.map((id) => cityById(id).name).join("—")}。`, ...next.news].slice(0, 6),
      };
    }
    if (choiceId === "force-road") {
      if (condition === "blockaded") return buildBattle(next);
      next = withWorldAdvance(next, 1);
      const rawCartDamage = journeyHasRole(next, "车把式") ? 8 : 14;
      const cartDamage = Math.max(2, Math.round(rawCartDamage * wagonDamageMultiplier(next.convoy)));
      const cargoDamage = Math.round((next.journey!.contract.complication === "fragile" ? 12 : 6) * cargoDamageMultiplier(next.convoy));
      next = {
        ...next,
        supplies: Math.max(0, next.supplies - 2),
        convoy: {
          ...next.convoy,
          cartHp: Math.max(5, next.convoy.cartHp - cartDamage),
          cargoIntegrity: Math.max(0, next.convoy.cargoIntegrity - cargoDamage),
          horseHp: Math.max(1, next.convoy.horseHp - 6),
          horseStamina: Math.max(0, next.convoy.horseStamina - 14),
        },
        news: [`【拆车涉渡】强渡${routeById(routeId).name}，车况 -${cartDamage}、镖物 -${cargoDamage}。`, ...next.news].slice(0, 6),
      };
      return completeSegment(next);
    }
    return next;
  }
  if (kind === "border" && choiceId === "permit") {
    const targetCityId = next.journey!.plan.cityIds[next.journey!.segmentIndex + 1];
    const targetFaction = next.cities[targetCityId].owner;
    if (!hasActivePermit(next, targetFaction)) return next;
    const sensitive = isBorderSensitive(next.journey!.contract);
    if (sensitive) {
      const roll = randomStep(next.rngState);
      const standing = factionStanding(next.relations[targetFaction] ?? 0);
      const exposureRisk = Math.max(.05, .24 - standing.inspectionCover - stance.inspectionCover);
      next = { ...next, rngState: roll.state };
      if (roll.value < exposureRisk) {
        const relation = clampFactionRelation((next.relations[targetFaction] ?? 0) - 2);
        return buildBattle({
          ...next,
          relations: { ...next.relations, [targetFaction]: relation },
          news: [`【路引遭疑】巡骑认得行院印色，却从镖物封记中看出破绽；${FACTIONS[targetFaction].name}往来 -2。`, ...next.news].slice(0, 6),
        });
      }
    }
    next = { ...next, news: [`【持牒过关】${FACTIONS[targetFaction].name}巡骑验过路引，未再征税${sensitive ? "，抽验也未看出镖物底细" : "或开箱"}。`, ...next.news].slice(0, 6) };
  } else if (kind === "border" && choiceId === "papers") {
    const targetCityId = next.journey!.plan.cityIds[next.journey!.segmentIndex + 1];
    const targetFaction = next.cities[targetCityId].owner;
    const sensitive = isBorderSensitive(next.journey!.contract);
    const passageCost = borderPassageCost(next, targetFaction, sensitive);
    if (next.silver < passageCost) return buildBattle({ ...next, news: ["【关前失算】银钱不足以打点巡骑，只得仓促列阵。", ...next.news].slice(0, 6) });
    next = advanceConduct({ ...next, silver: next.silver - passageCost, relations: { ...next.relations, [targetFaction]: next.relations[targetFaction] + (sensitive ? 0 : 1) } }, { peacefulPassages: 1 });
    if (sensitive) {
      const roll = randomStep(next.rngState);
      const accountantCover = journeyHasRole(next, "账房") ? 0.1 : 0;
      const relationCover = factionStanding(next.relations[targetFaction] ?? 0).inspectionCover;
      next = { ...next, rngState: roll.state };
      if (roll.value < Math.max(0.16, 0.64 - accountantCover - relationCover - stance.inspectionCover)) {
        return buildBattle({ ...next, news: [`【关牒败露】巡骑从${next.journey!.contract.kind === "escort" ? "口音与名册" : "封签暗记"}中看出破绽，刚收下的银钱也追不回了。`, ...next.news].slice(0, 6) });
      }
      next = { ...next, news: ["【险过新关】敏感镖物藏过巡骑耳目，但这套名册已经不能再用。", ...next.news].slice(0, 6) };
    }
  } else if (kind === "border" && choiceId === "conceal") {
    const targetCityId = next.journey!.plan.cityIds[next.journey!.segmentIndex + 1];
    const targetFaction = next.cities[targetCityId].owner;
    const shadowPass = hasPrinciple(next, "shadow-pass");
    const concealSupplies = Math.max(0, (hasConvoyUpgrade(next.convoy, "hidden-compartment") ? 1 : 2) - principleConcealSaving(next));
    next = advanceConduct({
      ...next,
      day: next.day + 1,
      supplies: Math.max(0, next.supplies - concealSupplies),
      relations: { ...next.relations, [targetFaction]: next.relations[targetFaction] - (shadowPass ? 0 : 1) },
      news: [`【暗渡边关】已知底细让镖队提前换装改牒，${next.journey!.contract.title}没有落入巡骑手中${shadowPass ? "，沿边脚夫也替风云行遮住了行迹" : ""}。`, ...next.news].slice(0, 6),
    }, { concealedBorders: 1 });
  } else if (kind === "border" && choiceId === "detour") {
    const covert = stance.id === "covert";
    const rawCartDamage = covert ? (journeyHasRole(next, "车把式") ? 1 : 3) : journeyHasRole(next, "车把式") ? 4 : 9;
    const cartDamage = Math.max(1, Math.round(rawCartDamage * wagonDamageMultiplier(next.convoy)));
    const supplyCost = covert && journeyHasRole(next, "向导") ? 0 : covert ? 1 : 2;
    next = { ...next, day: next.day + 1, supplies: Math.max(0, next.supplies - supplyCost), convoy: { ...next.convoy, cartHp: Math.max(10, next.convoy.cartHp - cartDamage), horseStamina: Math.max(0, next.convoy.horseStamina - (covert ? 5 : 8)) } };
  } else if (kind === "bandits" && choiceId === "toll") {
    const tollCost = banditTollCost(next);
    if (next.silver < tollCost) return buildBattle({ ...next, news: ["【山道失算】买路银凑不齐，剪径客已经拔刀。", ...next.news].slice(0, 6) });
    next = advanceConduct({ ...next, silver: Math.max(0, next.silver - tollCost), reputation: Math.max(0, next.reputation - 1) }, { peacefulPassages: 1 });
  } else if (kind === "bandits" && choiceId === "bluff") {
    const roll = randomStep(next.rngState);
    next = { ...next, rngState: roll.state };
    if (roll.value + next.reputation / 100 < 0.48) return buildBattle(next);
    next = { ...next, reputation: next.reputation + 2, news: ["【江湖传闻】风云行只报字号，便让一寨人马让开山道。", ...next.news].slice(0, 6) };
  } else if (kind === "bandits" && choiceId === "sacrifice") {
    const contractKind = next.journey!.contract.kind;
    const pursuitLoss = game.currentEvent.battleMode === "pursuit"
      ? contractKind === "letter" ? 42 : next.journey!.contract.complication === "fragile" ? 36 : 28
      : contractKind === "cargo" ? 45 : 100;
    const integrity = Math.max(0, next.convoy.cargoIntegrity - pursuitLoss);
    const reputationLoss = contractKind === "escort" ? 8 : contractKind === "letter" ? 5 : 3;
    next = {
      ...next,
      reputation: Math.max(0, next.reputation - reputationLoss),
      journey: contractKind === "escort" ? { ...next.journey!, escortHealth: 0 } : next.journey,
      convoy: { ...next.convoy, cargoIntegrity: contractKind === "escort" ? next.convoy.cargoIntegrity : integrity, sealIntact: contractKind === "cargo" ? next.convoy.sealIntact : false, morale: Math.max(0, next.convoy.morale - 12) },
      news: [`【弃镖脱身】风云行为保全人手舍下${contractKind === "escort" ? "护送之人" : contractKind === "letter" ? "密函" : game.currentEvent.battleMode === "pursuit" ? "被夺走的镖匣" : "部分镖货"}，江湖议论纷纷。`, ...next.news].slice(0, 6),
    };
  } else if (kind === "storm" && choiceId === "shelter") {
    next = { ...next, day: next.day + 1, convoy: { ...next.convoy, morale: Math.min(100, next.convoy.morale + 3), horseStamina: Math.min(100, next.convoy.horseStamina + 12) } };
  } else if (kind === "storm" && choiceId === "press") {
    const rawCartDamage = journeyHasRole(next, "车把式") ? 4 : 8;
    const cartDamage = Math.max(1, Math.round(rawCartDamage * wagonDamageMultiplier(next.convoy)));
    const rawCargoDamage = next.journey!.contract.complication === "fragile" ? 9 : 0;
    const cargoDamage = Math.round(rawCargoDamage * cargoDamageMultiplier(next.convoy));
    next = { ...next, supplies: Math.max(0, next.supplies - 2), convoy: { ...next.convoy, cartHp: Math.max(10, next.convoy.cartHp - cartDamage), cargoIntegrity: Math.max(0, next.convoy.cargoIntegrity - cargoDamage), horseHp: Math.max(1, next.convoy.horseHp - 3) } };
  } else if (kind === "refugees" && choiceId === "share") {
    next = { ...next, supplies: Math.max(0, next.supplies - 3), reputation: next.reputation + 4 };
  } else if (kind === "refugees" && choiceId === "decline") {
    next = { ...next, convoy: { ...next.convoy, morale: Math.max(0, next.convoy.morale - 5) } };
  } else if (kind === "breakdown" && choiceId === "repair") {
    const hasCarter = journeyHasRole(next, "车把式");
    const hasSpareAxle = hasConvoyUpgrade(next.convoy, "spare-axle");
    next = { ...next, day: next.day + (hasCarter || hasSpareAxle ? 0 : 1), supplies: Math.max(0, next.supplies - (hasSpareAxle ? 0 : 1)) };
  } else if (kind === "breakdown" && choiceId === "press") {
    const rawCartDamage = journeyHasRole(next, "车把式") ? 4 : 11;
    const axleCover = hasConvoyUpgrade(next.convoy, "spare-axle") ? 0.62 : 1;
    const cartDamage = Math.max(1, Math.round(rawCartDamage * axleCover * wagonDamageMultiplier(next.convoy)));
    const rawCargoDamage = next.journey!.contract.complication === "fragile" ? 6 : 0;
    const cargoDamage = Math.round(rawCargoDamage * cargoDamageMultiplier(next.convoy));
    next = { ...next, convoy: { ...next.convoy, cartHp: Math.max(8, next.convoy.cartHp - cartDamage), cargoIntegrity: Math.max(0, next.convoy.cargoIntegrity - cargoDamage), horseHp: Math.max(1, next.convoy.horseHp - 2) } };
  } else if (kind === "rumor" && choiceId === "verify") {
    const routeId = next.journey!.plan.routeIds[next.journey!.segmentIndex];
    const watched = Boolean(officeAt(next, routeById(routeId).from) || officeAt(next, routeById(routeId).to));
    next = {
      ...next,
      supplies: Math.max(0, next.supplies - (watched ? 0 : 1)),
      routeIntel: refreshedIntel(next, [routeId]),
      news: [`【路报坐实】${routeById(routeId).name}的旗号、关税与匪情已重新核验。`, ...next.news].slice(0, 6),
    };
  }
  return completeSegment(next);
}

export function applyBattleResult(game: GameState, result: BattleResult): GameState {
  if (game.phase !== "battle" || !game.pendingBattle) return game;
  const leaderExperienceGain = result.leaderExperience ?? 0;
  const leaderExperience = game.leader.experience + leaderExperienceGain;
  const leaderFormationExperience = normalizeFormationExperience(game.leader.formationExperience);
  const leaderFormationReports: string[] = [];
  for (const [formationId, gain] of Object.entries(result.leaderFormationExperience ?? {}) as Array<[keyof typeof FORMATION_PROFICIENCIES, number]>) {
    if (!gain) continue;
    const oldRank = formationProficiencyRank(leaderFormationExperience[formationId]);
    leaderFormationExperience[formationId] += gain;
    const newRank = formationProficiencyRank(leaderFormationExperience[formationId]);
    leaderFormationReports.push(`${FORMATION_PROFICIENCIES[formationId].name} +${gain}${newRank.level > oldRank.level ? `，晋「${newRank.label}」` : ""}`);
  }
  const leaderRankUp = crewRank(leaderExperience).level > crewRank(game.leader.experience).level;
  const leaderInjury = result.leaderInjury ? mergeCrewInjury(game.leader.injury, result.leaderInjury, game.day) : game.leader.injury;
  const deputyId = result.leaderDeputyId ?? game.pendingBattle.guards.find((guard) => guard.role === "副镖头")?.id;
  const deputyBondGain = deputyId ? Math.max(0, result.leaderDeputyBondGain ?? 0) : 0;
  const deputyBondBefore = deputyId ? game.leader.deputyBonds[deputyId] ?? 0 : 0;
  const deputyBondAfter = deputyBondBefore + deputyBondGain;
  const deputyBonds = deputyId && deputyBondGain > 0
    ? { ...game.leader.deputyBonds, [deputyId]: deputyBondAfter }
    : game.leader.deputyBonds;
  const coreCombatExperience = { ...game.leader.coreCombatExperience };
  const coreCombatReports: string[] = [];
  for (const [focusId, gain] of Object.entries(result.leaderCoreCombatExperience ?? {}) as Array<[CoreCombatFocusId, number]>) {
    if (!gain || !CORE_COMBAT_FOCUSES[focusId]) continue;
    const oldRank = coreCombatFocusRank(coreCombatExperience[focusId]);
    coreCombatExperience[focusId] += gain;
    const newRank = coreCombatFocusRank(coreCombatExperience[focusId]);
    coreCombatReports.push(`${CORE_COMBAT_FOCUSES[focusId].name} +${gain}${newRank.level > oldRank.level ? `，晋「${newRank.label}」` : ""}`);
  }
  const martialExperience = { ...game.leader.martialExperience };
  const martialReports: string[] = [];
  for (const [martialId, gain] of Object.entries(result.leaderMartialExperience ?? {}) as Array<[MartialArtId, number]>) {
    if (!gain || !MARTIAL_ARTS[martialId]) continue;
    const oldRank = martialProficiencyRank(martialExperience[martialId]);
    martialExperience[martialId] += gain;
    const newRank = martialProficiencyRank(martialExperience[martialId]);
    martialReports.push(`${MARTIAL_ARTS[martialId].name} +${gain}${newRank.level > oldRank.level ? `，晋「${newRank.label}」` : ""}`);
  }
  const leader = { ...game.leader, experience: leaderExperience, martialExperience, coreCombatExperience, formationExperience: leaderFormationExperience, deputyBonds, injury: leaderInjury };
  const convoy = {
    ...game.convoy,
    leaderHp: Math.max(1, game.convoy.leaderHp - result.leaderDamage),
    guardsFit: Math.max(0, game.convoy.guardsFit - result.guardLoss),
    cartHp: Math.max(0, Math.min(100, game.convoy.cartHp - result.cartDamage + (result.cartRepair ?? 0))),
    cargoIntegrity: Math.max(0, game.convoy.cargoIntegrity - result.cargoLoss),
    sealIntact: game.convoy.sealIntact && !result.sealBroken,
    morale: Math.max(0, game.convoy.morale - (result.outcome === "complete" ? 2 : 10) - (result.moraleDamage ?? 0)),
    horseHp: Math.max(1, game.convoy.horseHp - (result.horseDamage ?? 0)),
  };
  const injuryReports: string[] = [];
  const meritReports: string[] = [];
  const rankReports: string[] = [];
  const formationReports: string[] = [];
  if (result.leaderInjury) injuryReports.push(`${game.leader.name}落下「${crewInjuryById(result.leaderInjury)!.name}」`);
  if (leaderRankUp) rankReports.push(`${game.leader.name}晋为「${crewRank(leaderExperience).label}」总镖头`);
  const deputyName = deputyId ? game.crew.find((member) => member.id === deputyId)?.name ?? "副镖头" : null;
  const deputyBondRankBefore = deputyBondRank(deputyBondBefore);
  const deputyBondRankAfter = deputyBondRank(deputyBondAfter);
  const crew = game.crew.map((member) => {
    const damage = result.guardDamage[member.id] ?? 0;
    const injuryId = result.guardInjuries?.[member.id];
    const experienceGain = result.guardExperience?.[member.id]
      ?? result.guardContributions?.[member.id]?.experience
      ?? 0;
    const formationGain = result.guardFormationExperience?.[member.id]
      ?? formationExperienceAwards(result.formationSeconds ?? {});
    const trainedFormations = Object.entries(formationGain).filter((entry): entry is [keyof typeof FORMATION_PROFICIENCIES, number] => (entry[1] ?? 0) > 0);
    if (!damage && !injuryId && !experienceGain && !trainedFormations.length) return member;
    const injury = injuryId ? mergeCrewInjury(member.injury, injuryId, game.day) : member.injury;
    if (injuryId) injuryReports.push(`${member.name}落下「${crewInjuryById(injuryId)!.name}」`);
    const experience = member.experience + experienceGain;
    if (experienceGain > 0) {
      const contribution = result.guardContributions?.[member.id];
      meritReports.push(`${member.name}${contribution ? `「${contribution.title}」` : ""}阅历 +${experienceGain}`);
      const oldRank = crewRank(member.experience);
      const newRank = crewRank(experience);
      if (newRank.level > oldRank.level) rankReports.push(`${member.name}晋为「${newRank.label}」`);
    }
    const formationExperience = normalizeFormationExperience(member.formationExperience);
    for (const [formationId, gain] of trainedFormations) {
      const oldRank = formationProficiencyRank(formationExperience[formationId]);
      formationExperience[formationId] += gain;
      const newRank = formationProficiencyRank(formationExperience[formationId]);
      formationReports.push(`${member.name}${FORMATION_PROFICIENCIES[formationId].name} +${gain}${newRank.level > oldRank.level ? `，晋「${newRank.label}」` : ""}`);
    }
    return { ...member, hp: Math.max(0, member.hp - damage), injury, experience, formationExperience };
  });
  const guardsFit = game.journey?.crewIds.filter((id) => (crew.find((member) => member.id === id)?.hp ?? 0) >= 20).length ?? 0;
  const battleNews = [
    ...(result.enemyLeaderDefeated ? [`【阵斩匪首】${game.pendingBattle.enemyLeaderName ?? "山寨匪首"}逼战失利、伏诛阵前，沿路匪众闻风失胆，镖局声望 +2。`] : (result.leaderChallenges ?? 0) > 0 ? [`【匪首遁走】${game.pendingBattle.enemyLeaderName ?? "山寨匪首"}曾弃旗逼战，终在车队脱阵时趁乱退走。`] : []),
    ...((result.cartRepair ?? 0) > 0 ? [`【阵前抢修】车把式在交战中抢回 ${(result.cartRepair ?? 0)} 分车况，镖车得以继续赶路。`] : []),
    ...(result.clientDowned ? [`【活镖失守】${game.pendingBattle.escortClient?.name ?? "护送之人"}重伤倒地，此单已难照原约交割。`] : (result.clientDamage ?? 0) > 0 ? [`【活镖负伤】${game.pendingBattle.escortClient?.name ?? "护送之人"}在阵中受伤 ${(result.clientDamage ?? 0)} 分。`] : []),
    ...(result.bannerLost ? ["【镖旗失守】风云行旗号被夺，沿途声势与信用一并受挫。"] : result.bannerRecovered ? ["【夺旗复得】夺旗手未能脱阵，众人重新把镖旗立回车前。"] : []),
    ...(rankReports.length ? [`【人物晋阶】${rankReports.join("；")}。新的战职、绝活与装备门槛已随名望解开。`] : []),
    ...(leaderExperienceGain > 0 ? [`【总镖头记功】${game.leader.name}${result.leaderContribution ? `「${result.leaderContribution.title}」` : ""}阅历 +${leaderExperienceGain}${leaderFormationReports.length ? `；${leaderFormationReports.join("；")}` : ""}。`] : []),
    ...(martialReports.length ? [`【武学得法】${martialReports.join("；")}。绝技由总镖头自行择机，所用越熟，招路越稳。`] : []),
    ...(deputyName && deputyBondGain > 0 ? [`【主副默契】${game.leader.name}与${deputyName}并肩历阵，默契 +${deputyBondGain}${deputyBondRankAfter.level > deputyBondRankBefore.level ? `，晋为「${deputyBondRankAfter.label}」` : ""}。`] : []),
    ...(coreCombatReports.length ? [`【双核心武路】${coreCombatReports.join("；")}。主角与副镖头会按此专精自动调整合击、截锋与斩将。`] : []),
    ...(formationReports.length ? [`【战阵习练】${formationReports.join("；")}。往后再用此阵，众人会自动站得更稳、出手更快。`] : []),
    ...(meritReports.length ? [`【战后记功】${meritReports.join("；")}。`] : []),
    ...(injuryReports.length ? [`【战后验伤】${injuryReports.join("；")}。`] : []),
  ];
  return completeSegment({
    ...game,
    day: game.day + (result.elapsedHours >= 8 ? 1 : 0),
    reputation: Math.max(0, game.reputation + (result.enemyLeaderDefeated ? 2 : 0) - (result.bannerLost ? 5 : 0)),
    leader,
    crew,
    journey: game.journey ? {
      ...game.journey,
      battleVictories: (game.journey.battleVictories ?? 0) + (result.outcome === "complete" ? 1 : 0),
      escortHealth: game.journey.contract.kind === "escort"
        ? Math.max(0, (game.journey.escortHealth ?? 100) - (result.clientDamage ?? 0))
        : game.journey.escortHealth,
    } : null,
    convoy: { ...convoy, guardsFit },
    pendingBattle: null,
    news: battleNews.length ? [...battleNews, ...game.news].slice(0, 6) : game.news,
  });
}

export function continueAfterSettlement(game: GameState): GameState {
  if (game.phase !== "settlement") return game;
  const endingId = careerDefeat(game);
  if (endingId) return {
    ...game,
    phase: "gameover",
    career: { claimedObjectiveIds: game.career?.claimedObjectiveIds ?? [], endingId },
  };
  const currentOffice = officeAt(game);
  const cityState = game.cities[game.currentCityId];
  const majorOffice = currentOffice?.tier === "headquarters" || currentOffice?.tier === "branch";
  const localReputation = game.cityReputation?.[game.currentCityId] ?? 0;
  const standing = cityStanding(localReputation);
  const contractCount = contractCountForCity(cityState, majorOffice, localReputation);
  const localFaction = cityState.owner;
  const generated = generateContracts(game.currentCityId, game.day, game.rngState, false, contractCount, cityState, localReputation, game.relations[localFaction] ?? 0, game.conduct);
  const cityEffect = cityStatusEffect(cityState);
  const localRecruits = generateRecruitPool(game.currentCityId, cityById(game.currentCityId).tier, game.day, generated.rngState, game.crew.map((member) => member.id), cityEffect.recruitQuality + standing.recruitQuality, cityEffect.recruitCount);
  return {
    ...game,
    phase: "map",
    rngState: localRecruits.rngState,
    contracts: generated.contracts,
    recruitPool: localRecruits.recruits,
    recruitPoolCityId: game.currentCityId,
    journey: null,
    settlement: null,
    currentEvent: null,
    pendingBattle: null,
    convoy: {
      ...game.convoy,
      leaderHp: Math.min(100, game.convoy.leaderHp + 12),
      morale: Math.min(100, game.convoy.morale + 8),
      guardsFit: game.activeCrewIds.filter((id) => (game.crew.find((member) => member.id === id)?.hp ?? 0) >= 20).length,
      cargoIntegrity: 100,
      sealIntact: true,
      horseStamina: Math.min(100, game.convoy.horseStamina + 15),
    },
  };
}

export function purchaseService(game: GameState, service: ServiceType): GameState {
  if (game.phase !== "map") return game;
  const cost = serviceCost(game, service);
  if (service === "supplies" && game.silver >= cost) return { ...game, silver: game.silver - cost, supplies: Math.min(24, game.supplies + supplyPurchaseAmount(game)) };
  if (service === "repair" && game.silver >= cost) return { ...game, silver: game.silver - cost, convoy: { ...game.convoy, cartHp: Math.min(100, game.convoy.cartHp + 30) } };
  if (service === "stable" && game.silver >= cost) return {
    ...game,
    silver: game.silver - cost,
    convoy: { ...game.convoy, horseHp: Math.min(100, game.convoy.horseHp + 26), horseStamina: Math.min(100, game.convoy.horseStamina + 48) },
    news: [`【马院歇养】${HORSE_TEAMS[game.convoy.horseTeamId].name}已经饮水、刷洗并重新钉掌。`, ...game.news].slice(0, 6),
  };
  if (service === "heal" && game.silver >= cost) {
    const hasDoctor = game.crew.some((member) => member.role === "医师" && member.hp > 0);
    const treatmentDays = hasDoctor ? 4 : 3;
    const treated: string[] = [];
    const recovered: string[] = [];
    const leaderInjury = recoverCrewInjury(game.leader.injury, treatmentDays);
    if (game.leader.injury) {
      treated.push(game.leader.name);
      if (!leaderInjury) recovered.push(game.leader.name);
    }
    const leader = leaderInjury === game.leader.injury ? game.leader : { ...game.leader, injury: leaderInjury };
    const crew = game.crew.map((member) => {
      const injury = recoverCrewInjury(member.injury, treatmentDays);
      if (member.injury) {
        treated.push(member.name);
        if (!injury) recovered.push(member.name);
      }
      return { ...member, hp: Math.min(member.maxHp, member.hp + (member.role === "医师" ? 40 : hasDoctor ? 34 : 28)), injury };
    });
    const guardsFit = game.activeCrewIds.filter((id) => (crew.find((member) => member.id === id)?.hp ?? 0) >= 20).length;
    const treatmentNote = treated.length
      ? `并为${treated.join("、")}换药正骨${recovered.length ? `；${recovered.join("、")}的旧伤已经解除` : "，仍需继续休养"}`
      : "众人气血已重新调理";
    return {
      ...game,
      silver: game.silver - cost,
      leader,
      crew,
      convoy: { ...game.convoy, leaderHp: Math.min(100, game.convoy.leaderHp + 35), guardsFit },
      news: [`【延医问药】城中医者${treatmentNote}。`, ...game.news].slice(0, 6),
    };
  }
  if (service === "intel" && game.silver >= cost) {
    const cities = { ...game.cities };
    for (const id of Object.keys(cities)) cities[id] = { ...cities[id], intelDay: game.day };
    const localRoutes = ROUTES.filter((route) => route.from === game.currentCityId || route.to === game.currentCityId).map((route) => route.id);
    return {
      ...game,
      silver: game.silver - cost,
      cities,
      routeIntel: refreshedIntel(game, localRoutes),
      news: ["【新购舆图】各城旗号与本地出城道路情报已经校准。", ...game.news].slice(0, 6),
    };
  }
  return game;
}

export function wagonPurchaseCost(game: GameState, wagonId: WagonId): number {
  return Math.ceil(WAGONS[wagonId].price * officeDiscount(officeAt(game)?.tier) * cityStatusEffect(game.cities[game.currentCityId]).priceMultiplier * localStanding(game).priceMultiplier * rulingFactionStanding(game).priceMultiplier);
}

export function horseTeamPurchaseCost(game: GameState, horseTeamId: HorseTeamId): number {
  return Math.ceil(HORSE_TEAMS[horseTeamId].price * officeDiscount(officeAt(game)?.tier) * cityStatusEffect(game.cities[game.currentCityId]).priceMultiplier * localStanding(game).priceMultiplier * rulingFactionStanding(game).priceMultiplier);
}

export function convoyUpgradePurchaseCost(game: GameState, upgradeId: ConvoyUpgradeId): number {
  return Math.ceil(CONVOY_UPGRADES[upgradeId].price * officeDiscount(officeAt(game)?.tier) * cityStatusEffect(game.cities[game.currentCityId]).priceMultiplier * localStanding(game).priceMultiplier * rulingFactionStanding(game).priceMultiplier);
}

export function purchaseWagon(game: GameState, wagonId: WagonId): GameState {
  if (game.phase !== "map" || game.convoy.wagonId === wagonId) return game;
  const wagon = WAGONS[wagonId];
  const cost = wagonPurchaseCost(game, wagonId);
  if (game.silver < cost || game.convoy.upgrades.length > wagon.upgradeSlots) return game;
  return {
    ...game,
    silver: game.silver - cost,
    convoy: { ...game.convoy, wagonId, cartHp: 100 },
    news: [`【车马铺交割】风云行换用${wagon.name}，旧车折价抵了脚夫与装配钱。`, ...game.news].slice(0, 6),
  };
}

export function purchaseHorseTeam(game: GameState, horseTeamId: HorseTeamId): GameState {
  if (game.phase !== "map" || game.convoy.horseTeamId === horseTeamId) return game;
  const horses = HORSE_TEAMS[horseTeamId];
  const cost = horseTeamPurchaseCost(game, horseTeamId);
  if (game.silver < cost) return game;
  return {
    ...game,
    silver: game.silver - cost,
    convoy: { ...game.convoy, horseTeamId, horseHp: 100, horseStamina: 100 },
    news: [`【马契落印】新购${horses.name}已经套车，马牙人收讫 ${cost} 两。`, ...game.news].slice(0, 6),
  };
}

export function purchaseConvoyUpgrade(game: GameState, upgradeId: ConvoyUpgradeId): GameState {
  if (game.phase !== "map" || hasConvoyUpgrade(game.convoy, upgradeId)) return game;
  const upgrade = CONVOY_UPGRADES[upgradeId];
  const cost = convoyUpgradePurchaseCost(game, upgradeId);
  const slots = WAGONS[game.convoy.wagonId].upgradeSlots;
  if (game.convoy.upgrades.length >= slots || game.silver < cost || game.reputation < upgrade.reputationRequired) return game;
  return {
    ...game,
    silver: game.silver - cost,
    convoy: { ...game.convoy, upgrades: [...game.convoy.upgrades, upgradeId] },
    news: [`【行装新制】${WAGONS[game.convoy.wagonId].name}装上${upgrade.name}，占用一处改装位。`, ...game.news].slice(0, 6),
  };
}

export function equipmentPurchaseCost(game: GameState, equipmentId: EquipmentId): number {
  const officeDiscount = officeAt(game)?.tier === "headquarters" ? .9 : officeAt(game) ? .95 : 1;
  return Math.max(1, Math.round(EQUIPMENT[equipmentId].price * cityServiceMultiplier(game.cities[game.currentCityId].status, "repair") * officeDiscount));
}

export function purchaseEquipment(game: GameState, equipmentId: EquipmentId): GameState {
  if (game.phase !== "map" || !(equipmentId in EQUIPMENT)) return game;
  const item = EQUIPMENT[equipmentId];
  if (item.source === "journey") return game;
  const cost = equipmentPurchaseCost(game, equipmentId);
  if (game.silver < cost) return game;
  return {
    ...game,
    silver: game.silver - cost,
    equipmentStock: { ...game.equipmentStock, [equipmentId]: (game.equipmentStock[equipmentId] ?? 0) + 1 },
    news: [`【器械铺】购得${item.name}一件，已收入镖局器械架。`, ...game.news].slice(0, 8),
  };
}

export function equipmentTuningCost(game: GameState, equipmentId: EquipmentId): number {
  if (!(equipmentId in EQUIPMENT) || (game.equipmentStock[equipmentId] ?? 0) <= 0) return 0;
  const item = EQUIPMENT[equipmentId];
  const level = equipmentTuningLevel(game.equipmentTuning[equipmentId]);
  if (level >= MAX_EQUIPMENT_TUNING) return 0;
  const officeDiscount = officeAt(game)?.tier === "headquarters" ? .9 : officeAt(game) ? .95 : 1;
  const baseValue = item.price > 0 ? item.price : item.rarity === "treasure" ? 90 : 54;
  return Math.max(8, Math.round(baseValue * (.62 + level * .48) * cityServiceMultiplier(game.cities[game.currentCityId].status, "repair") * officeDiscount));
}

export function tuneEquipment(game: GameState, equipmentId: EquipmentId): GameState {
  if (game.phase !== "map" || !(equipmentId in EQUIPMENT) || (game.equipmentStock[equipmentId] ?? 0) <= 0) return game;
  const currentLevel = equipmentTuningLevel(game.equipmentTuning[equipmentId]);
  const cost = equipmentTuningCost(game, equipmentId);
  if (currentLevel >= MAX_EQUIPMENT_TUNING || cost <= 0 || game.silver < cost) return game;
  const nextLevel = currentLevel + 1;
  const item = EQUIPMENT[equipmentId];
  return {
    ...game,
    silver: game.silver - cost,
    equipmentTuning: { ...game.equipmentTuning, [equipmentId]: nextLevel },
    news: [`【器械精校】${item.name}谱样升为「${equipmentTuningGrade(nextLevel)}」，同式器械的攻守效用一并提升。支用 ${cost} 两。`, ...game.news].slice(0, 8),
  };
}

export function equipCrewItem(game: GameState, crewId: string, equipmentId: EquipmentId): GameState {
  if (game.phase !== "map" || !(equipmentId in EQUIPMENT)) return game;
  const member = game.crew.find((item) => item.id === crewId);
  const isLeader = crewId === PLAYER_LEADER_ID;
  const item = EQUIPMENT[equipmentId];
  const experience = isLeader ? game.leader.experience : member?.experience;
  if (experience === undefined || crewRank(experience).level < item.requiredRank) return game;
  if ((game.equipmentStock[equipmentId] ?? 0) <= equippedCount(game.crewEquipment, equipmentId, crewId)) return game;
  const current = game.crewEquipment[crewId] ?? {};
  if (current[item.slot] === equipmentId) return game;
  return {
    ...game,
    crewEquipment: { ...game.crewEquipment, [crewId]: { ...current, [item.slot]: equipmentId } },
    news: [`【点将台】${isLeader ? `${game.leader.name}总镖头` : member!.name}换用${item.name}。`, ...game.news].slice(0, 8),
  };
}

export function unequipCrewItem(game: GameState, crewId: string, slot: EquipmentSlot): GameState {
  if (game.phase !== "map") return game;
  const current = game.crewEquipment[crewId];
  if (!current?.[slot]) return game;
  const next = { ...current };
  delete next[slot];
  return { ...game, crewEquipment: { ...game.crewEquipment, [crewId]: next } };
}

export function crewTrainingCost(game: GameState, crewId: string): number {
  const member = game.crew.find((item) => item.id === crewId);
  const experience = crewId === PLAYER_LEADER_ID ? game.leader.experience : member?.experience;
  if (experience === undefined) return 0;
  return Math.max(6, Math.round((10 + crewRank(experience).level * 7) * cityServiceMultiplier(game.cities[game.currentCityId].status, "heal")));
}

export function trainCrew(game: GameState, crewId: string): GameState {
  if (game.phase !== "map") return game;
  const member = game.crew.find((item) => item.id === crewId);
  const cost = crewTrainingCost(game, crewId);
  const isLeader = crewId === PLAYER_LEADER_ID;
  if ((!member && !isLeader) || cost <= 0 || game.silver < cost) return game;
  if (isLeader) return {
    ...game,
    silver: game.silver - cost,
    leader: { ...game.leader, experience: game.leader.experience + 1 },
    news: [`【总号演武】${game.leader.name}亲自校场试招，阅历增至 ${game.leader.experience + 1}。`, ...game.news].slice(0, 8),
  };
  return {
    ...game,
    silver: game.silver - cost,
    crew: game.crew.map((item) => item.id === crewId ? { ...item, experience: item.experience + 1 } : item),
    news: [`【演武场】${member!.name}完成一轮对练，阅历增至 ${member!.experience + 1}。`, ...game.news].slice(0, 8),
  };
}

export function crewDisciplineChangeCost(game: GameState, crewId: string): number {
  const member = game.crew.find((item) => item.id === crewId);
  if (!member || !member.disciplineId) return 0;
  return Math.max(14, Math.round((18 + crewRank(member.experience).level * 5) * cityServiceMultiplier(game.cities[game.currentCityId].status, "heal")));
}

export function setCrewDiscipline(game: GameState, crewId: string, disciplineId: CrewDisciplineId): GameState {
  if (game.phase !== "map" || !(disciplineId in CREW_DISCIPLINES)) return game;
  const member = game.crew.find((item) => item.id === crewId);
  if (!member || crewRank(member.experience).level < 1 || member.disciplineId === disciplineId) return game;
  const cost = crewDisciplineChangeCost(game, crewId);
  if (game.silver < cost) return game;
  const discipline = CREW_DISCIPLINES[disciplineId];
  return {
    ...game,
    silver: game.silver - cost,
    crew: game.crew.map((item) => item.id === crewId ? { ...item, disciplineId } : item),
    news: [`【点将定职】${member.name}立下「${discipline.name}」战职，往后随阵自行照此行事。${cost > 0 ? `改习支用 ${cost} 两。` : "初定战职，不另取银。"}`, ...game.news].slice(0, 8),
  };
}

export function recruitCrew(game: GameState, memberId: string): GameState {
  if (game.phase !== "map" || game.recruitPoolCityId !== game.currentCityId || game.crew.length >= CREW_CAPACITY) return game;
  const candidate = game.recruitPool.find((member) => member.id === memberId);
  if (!candidate || game.silver < candidate.hiringCost || game.crew.some((member) => member.id === memberId)) return game;
  return {
    ...game,
    silver: game.silver - candidate.hiringCost,
    crew: [...game.crew, { ...candidate }],
    recruitPool: game.recruitPool.filter((member) => member.id !== memberId),
    news: [`【${cityById(game.currentCityId).name}延才】${candidate.role}${candidate.name}入了风云行名册，先付身契银 ${candidate.hiringCost} 两。`, ...game.news].slice(0, 6),
  };
}
