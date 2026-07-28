import type { Contract, DeputyDispatch, DeputyDispatchOutcome, DeputyDispatchReport, FactionId, GameState, HandoffChoice, LegacyId, LegacyState, MartialArtId, OriginId, TradeGoodId, TravelCoverId, TravelStance } from "./types";
import { hydrateLegacyContract } from "./content";
import { createInitialCityReputation, createInitialCrew, createInitialOffices, createInitialRouteIntel, createInitialRouteStates, crewBattleGuards } from "./game";
import { generateRecruitPool, normalizeCrewMember } from "./crewContent";
import { CITIES, ROUTES, cityById } from "./data";
import { DEFAULT_CONVOY_EQUIPMENT } from "./convoyContent";
import { cityStanding, cityStatusEffect } from "./cityContent";
import { createFactionRecord } from "./factionContent";
import { createConductState } from "./conductContent";
import { ORIGINS } from "./originContent";
import { TRAVEL_STANCES } from "./travelContent";
import { TRAVEL_COVERS } from "./travelCoverContent";
import { TRADE_GOODS } from "./tradeContent";
import { DEFAULT_MARTIAL_ART, MARTIAL_ARTS } from "./martialContent";
import { normalizeWorldActors } from "./worldActorContent";
import { EQUIPMENT_LIST, equippedCount, normalizeCrewEquipment, normalizeEquipmentStock, normalizeEquipmentTuning } from "./equipmentContent";
import { LEGACY_BOONS, normalizeLegacyState } from "./legacyContent";
import { normalizeLeaderProgression } from "./leaderContent";
import { clampJianghuReputation } from "./jianghuContent";
import { normalizeRivalBureaus } from "./rivalContent";
import { normalizeRouteInfluence } from "./roadPowerContent";
import { normalizeContacts } from "./contactContent";
import { normalizeJourneyChronicle } from "./journeyChronicle";
import { createBusinessRecord, normalizeBusinessLedger } from "./businessLedger";

const DB_NAME = "biaoju-saves";
const STORE_NAME = "games";
const SLOT = "autosave";
const LEGACY_SLOT = "legacy";

const ROUTE_IDS = new Set(ROUTES.map((route) => route.id));
const CITY_IDS = new Set(CITIES.map((city) => city.id));
const DISPATCH_OUTCOMES = new Set<DeputyDispatchOutcome>(["success", "hard-won", "failed"]);

function finiteNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeDeputyDispatches(value: unknown, rosterCrewIds: Set<string>): DeputyDispatch[] {
  if (!Array.isArray(value)) return [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const source = item as Record<string, unknown>;
    const crewIds = [...new Set(Array.isArray(source.crewIds) ? source.crewIds.filter((id): id is string => typeof id === "string" && rosterCrewIds.has(id)) : [])];
    if (typeof source.id !== "string" || typeof source.title !== "string" || typeof source.routeId !== "string" || !ROUTE_IDS.has(source.routeId) || typeof source.fromCityId !== "string" || typeof source.toCityId !== "string" || crewIds.length !== 3) continue;
    const startedDay = Math.max(1, Math.floor(finiteNumber(source.startedDay, 1)));
    const returnsDay = Math.max(startedDay + 1, Math.floor(finiteNumber(source.returnsDay, startedDay + 1)));
    return [{
      id: source.id,
      title: source.title,
      routeId: source.routeId,
      fromCityId: source.fromCityId,
      toCityId: source.toCityId,
      crewIds,
      startedDay,
      returnsDay,
      danger: Math.max(0, Math.min(100, Math.round(finiteNumber(source.danger)))),
      successChance: Math.max(0, Math.min(100, Math.round(finiteNumber(source.successChance)))),
      successReward: Math.max(0, Math.round(finiteNumber(source.successReward))),
      wageCost: Math.max(0, Math.round(finiteNumber(source.wageCost))),
      resolutionRoll: Math.max(0, Math.min(1, finiteNumber(source.resolutionRoll, .5))),
    }];
  }
  return [];
}

function normalizeDeputyDispatchReports(value: unknown, rosterCrewIds: Set<string>): DeputyDispatchReport[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const source = item as Record<string, unknown>;
    const crewIds = [...new Set(Array.isArray(source.crewIds) ? source.crewIds.filter((id): id is string => typeof id === "string" && rosterCrewIds.has(id)) : [])];
    if (typeof source.id !== "string" || typeof source.title !== "string" || typeof source.routeId !== "string" || !ROUTE_IDS.has(source.routeId) || typeof source.fromCityId !== "string" || typeof source.toCityId !== "string" || typeof source.outcome !== "string" || !DISPATCH_OUTCOMES.has(source.outcome as DeputyDispatchOutcome) || typeof source.summary !== "string") return [];
    return [{
      id: source.id,
      title: source.title,
      routeId: source.routeId,
      fromCityId: source.fromCityId,
      toCityId: source.toCityId,
      crewIds,
      resolvedDay: Math.max(1, Math.floor(finiteNumber(source.resolvedDay, 1))),
      outcome: source.outcome as DeputyDispatchOutcome,
      silverChange: Math.round(finiteNumber(source.silverChange)),
      summary: source.summary,
    } satisfies DeputyDispatchReport];
  }).slice(0, 4);
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveGame(game: GameState): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(game, SLOT);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

export function migrateSavedGame(value: unknown): GameState | null {
  if (!value || typeof value !== "object") return null;
  const saved = value as Record<string, unknown>;
  if (saved.version !== 2 && saved.version !== 3 && saved.version !== 4 && saved.version !== 5 && saved.version !== 6 && saved.version !== 7 && saved.version !== 8 && saved.version !== 9 && saved.version !== 10 && saved.version !== 11 && saved.version !== 12 && saved.version !== 13 && saved.version !== 14 && saved.version !== 15 && saved.version !== 16 && saved.version !== 17 && saved.version !== 18 && saved.version !== 19 && saved.version !== 20 && saved.version !== 21 && saved.version !== 22 && saved.version !== 23 && saved.version !== 24 && saved.version !== 25 && saved.version !== 26) return null;
  const legacy = value as unknown as GameState;
  if (!legacy.cities || !legacy.day) return null;
  const originId: OriginId = typeof saved.originId === "string" && saved.originId in ORIGINS ? saved.originId as OriginId : "linan-guild";
  const legacyId: LegacyId | null = typeof saved.legacyId === "string" && saved.legacyId in LEGACY_BOONS ? saved.legacyId as LegacyId : null;
  const headquartersCityId = ORIGINS[originId].startCityId;
  const cities = Object.fromEntries(Object.entries(legacy.cities).map(([id, city]) => [id, {
    ...city,
    statusSinceDay: typeof city.statusSinceDay === "number" ? city.statusSinceDay : 1,
    playerAidDay: typeof city.playerAidDay === "number" ? city.playerAidDay : -99,
  }]));
  const crew = Array.isArray(saved.crew)
    ? legacy.crew.map((member) => normalizeCrewMember(member, legacy.currentCityId ?? "linan"))
    : createInitialCrew();
  const rosterCrewIds = new Set(crew.map((member) => member.id));
  const deputyDispatches = normalizeDeputyDispatches(saved.deputyDispatches, rosterCrewIds);
  const deputyDispatchReports = normalizeDeputyDispatchReports(saved.deputyDispatchReports, rosterCrewIds);
  const dispatchedCrewIds = new Set(deputyDispatches.flatMap((dispatch) => dispatch.crewIds));
  const leader = normalizeLeaderProgression(saved.leader);
  const normalizedEquipmentStock = normalizeEquipmentStock(saved.equipmentStock);
  const equipmentTuning = normalizeEquipmentTuning(saved.equipmentTuning);
  const crewEquipment = normalizeCrewEquipment(saved.crewEquipment);
  const equipmentStock = Object.fromEntries(EQUIPMENT_LIST.map((item) => [item.id, Math.max(normalizedEquipmentStock[item.id], equippedCount(crewEquipment, item.id))])) as GameState["equipmentStock"];
  const availableCrewIds = new Set(crew.filter((member) => !member.captivity && !dispatchedCrewIds.has(member.id)).map((member) => member.id));
  const activeCrewIds = [...new Set(Array.isArray(saved.activeCrewIds) ? legacy.activeCrewIds : ["lu-cang", "qiao-qing", "he-sheng"])]
    .filter((id) => availableCrewIds.has(id))
    .slice(0, 3);
  const legacyJourney = saved.journey as Record<string, unknown> | null;
  const legacyStance: TravelStance = typeof legacyJourney?.stance === "string" && legacyJourney.stance in TRAVEL_STANCES ? legacyJourney.stance as TravelStance : "steady";
  const legacyCoverId: TravelCoverId = typeof legacyJourney?.coverId === "string" && legacyJourney.coverId in TRAVEL_COVERS ? legacyJourney.coverId as TravelCoverId : "open-escort";
  const journeyContract = legacyJourney ? hydrateLegacyContract(legacyJourney.contract as Contract) : null;
  const legacyTradeLot = legacyJourney?.tradeLot as Record<string, unknown> | undefined;
  const tradeGoodId = typeof legacyTradeLot?.goodId === "string" && legacyTradeLot.goodId in TRADE_GOODS ? legacyTradeLot.goodId as TradeGoodId : null;
  const tradeLot = tradeGoodId && typeof legacyTradeLot?.originCityId === "string" && typeof legacyTradeLot.purchasePrice === "number"
    ? { goodId: tradeGoodId, originCityId: legacyTradeLot.originCityId, purchasePrice: Math.max(0, Math.round(legacyTradeLot.purchasePrice)) }
    : undefined;
  const factionIds = new Set<FactionId>(["song", "jin", "xixia", "dali", "tibetan", "mongol", "neutral"]);
  const handoffChoices = new Set<HandoffChoice>(["original", "authority", "covert"]);
  const journey = legacyJourney
    ? {
      ...legacyJourney,
      contract: journeyContract!,
      crewIds: [...new Set(Array.isArray(legacyJourney.crewIds) ? legacyJourney.crewIds as string[] : activeCrewIds)].filter((id) => availableCrewIds.has(id)),
      battleVictories: typeof legacyJourney.battleVictories === "number" ? Math.max(0, Math.floor(legacyJourney.battleVictories)) : 0,
      openingSilver: Math.max(0, Math.round(finiteNumber(legacyJourney.openingSilver, legacy.silver))),
      stance: legacyStance,
      coverId: legacyCoverId,
      coverBlown: legacyJourney.coverBlown === true,
      issuerFaction: typeof legacyJourney.issuerFaction === "string" && factionIds.has(legacyJourney.issuerFaction as FactionId)
        ? legacyJourney.issuerFaction as FactionId
        : cities[journeyContract!.from]?.owner ?? "neutral",
      expectedDestinationOwner: typeof legacyJourney.expectedDestinationOwner === "string" && factionIds.has(legacyJourney.expectedDestinationOwner as FactionId)
        ? legacyJourney.expectedDestinationOwner as FactionId
        : cities[journeyContract!.to]?.owner ?? "neutral",
      handoffChoice: typeof legacyJourney.handoffChoice === "string" && handoffChoices.has(legacyJourney.handoffChoice as HandoffChoice)
        ? legacyJourney.handoffChoice as HandoffChoice
        : undefined,
      escortHealth: journeyContract!.kind === "escort"
        ? Math.max(0, Math.min(100, typeof legacyJourney.escortHealth === "number" ? legacyJourney.escortHealth : 100))
        : undefined,
      tradeLot,
      chronicle: (() => {
        const normalized = normalizeJourneyChronicle(legacyJourney.chronicle);
        if (normalized.length) return normalized;
        const startedDay = Math.max(1, Math.floor(finiteNumber(legacyJourney.startedDay, legacy.day)));
        return [{
          id: `legacy-contract-${journeyContract!.id}`,
          day: startedDay,
          kind: "contract" as const,
          tone: "ink" as const,
          seal: "续",
          title: `续行「${journeyContract!.title}」`,
          detail: `旧档中的镖行由${cityById(journeyContract!.from).name}发往${cityById(journeyContract!.to).name}，此前细节未逐条留记。`,
          cityId: journeyContract!.from,
        }];
      })(),
    } as GameState["journey"]
    : null;
  const legacyBattle = saved.pendingBattle as Record<string, unknown> | null;
  const martialArtId: MartialArtId = typeof saved.martialArtId === "string" && saved.martialArtId in MARTIAL_ARTS
    ? saved.martialArtId as MartialArtId
    : DEFAULT_MARTIAL_ART;
  const pendingBattle = legacyBattle ? {
    ...legacyBattle,
    martialArtId: typeof legacyBattle.martialArtId === "string" && legacyBattle.martialArtId in MARTIAL_ARTS
      ? legacyBattle.martialArtId as MartialArtId
      : martialArtId,
    routeName: typeof legacyBattle.routeName === "string" ? legacyBattle.routeName : "旧途官道",
    cartHealthRatio: typeof legacyBattle.cartHealthRatio === "number" ? legacyBattle.cartHealthRatio : (legacy.convoy?.cartHp ?? 100) / 100,
    spareAxle: typeof legacyBattle.spareAxle === "boolean" ? legacyBattle.spareAxle : legacy.convoy?.upgrades?.includes("spare-axle") ?? false,
    escortClient: legacyBattle.escortClient ?? (journey?.contract.kind === "escort"
      ? { name: journey.contract.cargo, healthRatio: (journey.escortHealth ?? 100) / 100 }
      : undefined),
    guards: Array.isArray(legacyBattle.guards)
      ? (legacyBattle.guards as NonNullable<GameState["pendingBattle"]>["guards"]).filter((guard) => availableCrewIds.has(guard.id))
      : crewBattleGuards(crew, journey?.crewIds ?? activeCrewIds, crewEquipment, equipmentTuning),
  } as GameState["pendingBattle"] : null;
  const settlement = legacy.settlement ? { ...legacy.settlement, compensation: legacy.settlement.compensation ?? 0 } : null;
  let businessLedger = normalizeBusinessLedger(saved.businessLedger, CITY_IDS, ROUTE_IDS);
  if (!businessLedger.length && settlement && journey) {
    const currentRecord = createBusinessRecord(journey, settlement, legacy.day, legacy.convoy?.cargoIntegrity ?? 100, legacy.convoy?.sealIntact ?? true);
    businessLedger = normalizeBusinessLedger(currentRecord ? [currentRecord] : [], CITY_IDS, ROUTE_IDS);
  }
  const localEffect = cityStatusEffect(cities[legacy.currentCityId]);
  const initialCityReputation = createInitialCityReputation(headquartersCityId);
  const cityReputation = Object.fromEntries(CITIES.map((city) => {
    const oldValue = (saved.cityReputation as Record<string, unknown> | undefined)?.[city.id];
    return [city.id, typeof oldValue === "number" ? oldValue : initialCityReputation[city.id]];
  }));
  const generatedRecruits = generateRecruitPool(
    legacy.currentCityId,
    cityById(legacy.currentCityId).tier,
    legacy.day,
    legacy.rngState,
    crew.map((member) => member.id),
    localEffect.recruitQuality + cityStanding(cityReputation[legacy.currentCityId] ?? 0).recruitQuality,
    localEffect.recruitCount,
  );
  const recruitPool = Array.isArray(saved.recruitPool)
    ? legacy.recruitPool.map((member) => normalizeCrewMember(member, legacy.currentCityId))
    : generatedRecruits.recruits;
  const initialRouteStates = createInitialRouteStates();
  const savedRouteStates = saved.routeStates && typeof saved.routeStates === "object" ? legacy.routeStates : initialRouteStates;
  const routeStates = Object.fromEntries(ROUTES.map((route) => {
    const source = savedRouteStates[route.id] ?? initialRouteStates[route.id];
    const influence = normalizeRouteInfluence(route.id, source);
    return [route.id, {
      ...initialRouteStates[route.id],
      ...source,
      banditPressure: influence.pressure,
      passageUntilDay: influence.passageUntilDay,
      suppressedUntilDay: influence.suppressedUntilDay,
      lastBanditOutcome: influence.lastOutcome,
      lastBanditDay: influence.lastDay,
    }];
  }));
  const fallbackIntel = createInitialRouteIntel(cities, legacy.day, routeStates, headquartersCityId);
  const routeIntel = Object.fromEntries(ROUTES.map((route) => {
    const oldIntel = legacy.routeIntel?.[route.id];
    return [route.id, oldIntel ? { ...oldIntel, knownCondition: oldIntel.knownCondition ?? fallbackIntel[route.id].knownCondition } : fallbackIntel[route.id]];
  }));
  const jianghuReputation = clampJianghuReputation(typeof saved.jianghuReputation === "number"
    ? saved.jianghuReputation
    : Math.round((typeof saved.reputation === "number" ? saved.reputation : ORIGINS[originId].reputation) * 0.5));
  return {
    ...legacy,
    version: 26,
    originId,
    legacyId,
    jianghuReputation,
    cities,
    cityReputation,
    factionAudienceDay: { ...createFactionRecord(-99), ...(saved.factionAudienceDay as Record<string, number> | undefined) },
    travelPermits: { ...createFactionRecord(0), ...(saved.travelPermits as Record<string, number> | undefined) },
    routeStates,
    worldActors: normalizeWorldActors(saved.worldActors),
    rivalBureaus: normalizeRivalBureaus(saved.rivalBureaus),
    convoy: {
      ...legacy.convoy,
      wagonId: legacy.convoy?.wagonId ?? DEFAULT_CONVOY_EQUIPMENT.wagonId,
      horseTeamId: legacy.convoy?.horseTeamId ?? DEFAULT_CONVOY_EQUIPMENT.horseTeamId,
      horseHp: legacy.convoy?.horseHp ?? DEFAULT_CONVOY_EQUIPMENT.horseHp,
      horseStamina: legacy.convoy?.horseStamina ?? DEFAULT_CONVOY_EQUIPMENT.horseStamina,
      upgrades: Array.isArray(legacy.convoy?.upgrades) ? legacy.convoy.upgrades : [],
    },
    martialArtId,
    leader,
    crew,
    deputyDispatches,
    deputyDispatchReports,
    equipmentStock,
    equipmentTuning,
    crewEquipment,
    recruitPool,
    recruitPoolCityId: typeof saved.recruitPoolCityId === "string" ? legacy.recruitPoolCityId : legacy.currentCityId,
    activeCrewIds,
    contracts: Array.isArray(saved.contracts) ? legacy.contracts.map(hydrateLegacyContract) : [],
    contacts: normalizeContacts(saved.contacts, originId),
    journey,
    pendingBattle,
    settlement,
    businessLedger,
    routeIntel,
    offices: saved.offices && typeof saved.offices === "object"
      ? legacy.offices
      : createInitialOffices(cities, headquartersCityId),
    career: saved.career && typeof saved.career === "object"
      ? {
        claimedObjectiveIds: Array.isArray(legacy.career?.claimedObjectiveIds) ? legacy.career.claimedObjectiveIds : [],
        endingId: legacy.career?.endingId ?? null,
      }
      : { claimedObjectiveIds: [], endingId: null },
    conduct: saved.conduct && typeof saved.conduct === "object"
      ? { ...createConductState(), ...(saved.conduct as Partial<GameState["conduct"]>) }
      : createConductState(),
  };
}

export async function loadGame(): Promise<GameState | null> {
  const database = await openDatabase();
  const value = await new Promise<GameState | null>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(SLOT);
    request.onsuccess = () => {
      resolve(migrateSavedGame(request.result));
    };
    request.onerror = () => reject(request.error);
  });
  database.close();
  return value;
}

export async function loadLegacy(): Promise<LegacyState> {
  const database = await openDatabase();
  const value = await new Promise<unknown>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(LEGACY_SLOT);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  database.close();
  return normalizeLegacyState(value);
}

export async function saveLegacy(legacy: LegacyState): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(normalizeLegacyState(legacy), LEGACY_SLOT);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

export async function clearSave(): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(SLOT);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}
