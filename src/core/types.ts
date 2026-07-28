export type FactionId = "song" | "jin" | "xixia" | "dali" | "tibetan" | "mongol" | "neutral";
export type CityStatus = "prosperous" | "stable" | "tense" | "besieged" | "captured" | "famine" | "plague" | "disrupted" | "martial" | "contested" | "autonomous";
export type RouteTerrain = "official" | "mountain" | "river";
export type RouteCondition = "clear" | "muddy" | "flooded" | "blockaded" | "banditry";
export type GamePhase = "map" | "planning" | "travel" | "event" | "battle" | "settlement" | "gameover";
export type CityTier = "capital" | "major" | "station";
export type CrewRole = "副镖头" | "趟子手" | "车把式" | "账房" | "医师" | "向导" | "厨子";
export type CrewDisciplineId = "vanguard" | "bulwark" | "responder";
export type CrewMasteryId = "deputy-command" | "runner-pursuit" | "driver-warden" | "clerk-reader" | "medic-revival" | "guide-foresight" | "cook-heart";
export type CrewInjuryId = "blade-wound" | "sprain" | "fracture" | "internal-trauma";
export type OfficeTier = "headquarters" | "outpost" | "branch";
export type CityStandingTier = "stranger" | "known" | "trusted" | "pillar";
export type FactionStandingTier = "hostile" | "watched" | "neutral" | "recognized" | "honored";
export type IntelFreshness = "fresh" | "aging" | "rumor";
export type ContractKind = "cargo" | "letter" | "escort";
export type ContractPatron = "merchant" | "official" | "jianghu" | "temple" | "foreign";
export type ContractComplication = "none" | "contraband" | "wanted" | "military" | "fragile" | "double_deal";
export type Confidentiality = "寻常" | "隐秘" | "绝密";
export type WagonId = "covered-cart" | "swift-cart" | "armored-cart";
export type HorseTeamId = "draft-pair" | "post-pair" | "mountain-mules";
export type ConvoyUpgradeId = "iron-wheels" | "spare-axle" | "hidden-compartment" | "fireproof-awning";
export type CareerObjectiveId = "jiangnan-foundation" | "trade-network" | "renowned-escort";
export type CareerEndingId = "great-escort" | "credit-collapse" | "convoy-ruin" | "insolvent";
export type LegacyId = "guarantor-letter" | "veteran-token" | "merchant-credit" | "route-ledger";
export type PrincipleId = "clear-eyed" | "sealed-oath" | "living-promise" | "shadow-pass" | "peaceful-road";
export type OriginId = "linan-guild" | "xiangyang-veterans" | "quanzhou-merchants";
export type TravelStance = "steady" | "haste" | "covert";
export type TravelCoverId = "open-escort" | "merchant-caravan" | "pilgrim-party" | "military-train";
export type BattleObjectiveMode = "breakthrough" | "holdout" | "gate-run" | "pursuit";
export type BattleFormationId = "advance" | "hold" | "horses";
export type MartialArtId = "guard-spear" | "severing-sabre" | "binding-hands";
export type CoreCombatFocusId = "paired-assault" | "cross-guard" | "leader-hunt";
export type EquipmentSlot = "weapon" | "armor" | "tool";
export type EquipmentId = "jujube-spear" | "yanling-sabre" | "arm-crossbow" | "leather-jacket" | "iron-vest" | "rattan-shield" | "medicine-kit" | "horse-tackle" | "wheel-hook" | "frontier-hook-spear" | "watch-crossbow" | "field-medicine-chest" | "black-lacquer-shield";
export type HandoffChoice = "original" | "authority" | "covert";
export type TradeGoodId = "silk" | "tea" | "salt" | "spice" | "ironware" | "grain" | "books" | "medicine" | "hide";
export type WorldActorKind = "merchant" | "patrol" | "rival" | "army";

export interface CityDefinition {
  id: string;
  name: string;
  subtitle: string;
  x: number;
  y: number;
  lon: number;
  lat: number;
  defaultOwner: FactionId;
  tier: CityTier;
  description: string;
  specialties: string[];
}

export interface CityState {
  owner: FactionId;
  status: CityStatus;
  prosperity: number;
  security: number;
  intelDay: number;
  statusSinceDay: number;
  playerAidDay: number;
}

export interface RouteDefinition {
  id: string;
  from: string;
  to: string;
  name: string;
  terrain: RouteTerrain;
  days: number;
  danger: number;
  note: string;
}

export interface Contract {
  id: string;
  from: string;
  to: string;
  title: string;
  cargo: string;
  client: string;
  reward: number;
  deadline: number;
  risk: "稳妥" | "棘手" | "凶险";
  sealRequired: boolean;
  kind: ContractKind;
  patron: ContractPatron;
  inspectionAllowed: boolean;
  allowedLoss: number;
  confidentiality: Confidentiality;
  failurePenalty: number;
  complication: ContractComplication;
  clue: string;
  requirement: string;
  secretKnown: boolean;
  secret: string;
  brief: string;
}

export interface RoutePlan {
  id: string;
  routeIds: string[];
  cityIds: string[];
  days: number;
  danger: number;
  label: string;
  description: string;
}

export interface RouteState {
  condition: RouteCondition;
  sinceDay: number;
  clearsDay: number | null;
}

export interface RouteIntelState {
  surveyedDay: number;
  knownDanger: number;
  trips: number;
  knownCondition: RouteCondition;
}

export interface WorldActor {
  id: string;
  name: string;
  kind: WorldActorKind;
  faction: FactionId;
  routeId: string;
  fromCityId: string;
  toCityId: string;
  progress: number;
}

export interface OfficeState {
  cityId: string;
  tier: OfficeTier;
  openedDay: number;
  ownerAtOpening: FactionId;
  active: boolean;
}

export interface RoutePlanInsight {
  freshness: IntelFreshness;
  freshestAge: number;
  stalestAge: number;
  knownDanger: number;
  dangerLabel: string;
  trips: number;
  borderSegments: number;
  fullySurveyed: boolean;
  blockedSegments: number;
  conditionReports: Array<{
    routeId: string;
    condition: RouteCondition;
    label: string;
    stale: boolean;
  }>;
}

export interface ConvoyState {
  leaderHp: number;
  guardsFit: number;
  cartHp: number;
  cargoIntegrity: number;
  sealIntact: boolean;
  morale: number;
  wagonId: WagonId;
  horseTeamId: HorseTeamId;
  horseHp: number;
  horseStamina: number;
  upgrades: ConvoyUpgradeId[];
}

export interface CrewMember {
  id: string;
  name: string;
  courtesy: string;
  role: CrewRole;
  hp: number;
  maxHp: number;
  experience: number;
  formationExperience?: Record<BattleFormationId, number>;
  wage: number;
  specialty: string;
  biography: string;
  hiringCost: number;
  originCityId: string;
  disciplineId: CrewDisciplineId | null;
  injury: CrewInjury | null;
}

export interface LeaderProgression {
  id: "player-leader";
  name: string;
  courtesy: string;
  title: "总镖头";
  experience: number;
  martialExperience: Record<MartialArtId, number>;
  coreCombatFocusId: CoreCombatFocusId;
  coreCombatExperience: Record<CoreCombatFocusId, number>;
  formationExperience: Record<BattleFormationId, number>;
  deputyBonds: Record<string, number>;
  injury: CrewInjury | null;
}

export interface CrewInjury {
  id: CrewInjuryId;
  remainingDays: number;
  acquiredDay: number;
}

export interface JourneyState {
  contract: Contract;
  plan: RoutePlan;
  segmentIndex: number;
  startedDay: number;
  elapsedDays: number;
  traveledRouteIds: string[];
  crewIds: string[];
  battleVictories?: number;
  stance: TravelStance;
  /** 出城前备下的过关身份；亮旗正行不作伪装，也不收行装费用。 */
  coverId?: TravelCoverId;
  /** 伪装一旦在边关败露，本趟镖不能再次借用同一套身份。 */
  coverBlown?: boolean;
  /** 活镖的独立人身状态；旧存档与非活镖行程缺省时按 100 处理。 */
  escortHealth?: number;
  issuerFaction?: FactionId;
  expectedDestinationOwner?: FactionId;
  handoffChoice?: HandoffChoice;
  tradeLot?: TradeLot;
}

export interface TradeLot {
  goodId: TradeGoodId;
  originCityId: string;
  purchasePrice: number;
}

export interface EventChoice {
  id: string;
  label: string;
  hint: string;
  tone?: "safe" | "risk" | "danger";
  disabled?: boolean;
}

export interface TravelEvent {
  id: string;
  kind: "border" | "bandits" | "storm" | "refugees" | "breakdown" | "rumor" | "roadblock" | "waystation" | "handoff" | "caravan";
  actorId?: string;
  eyebrow: string;
  title: string;
  description: string;
  choices: EventChoice[];
  battleMode?: BattleObjectiveMode;
}

export interface BattleConfig {
  id: string;
  seed: number;
  terrain: RouteTerrain;
  danger: number;
  objective: string;
  objectiveMode?: BattleObjectiveMode;
  objectiveSeconds?: number;
  objectiveNote?: string;
  recoveryLabel?: string;
  pursuitCargoLoss?: number;
  enemyFaction: string;
  enemyLeaderName?: string;
  enemyLeaderChallengeSeconds?: number;
  enemyLeaderHealthMultiplier?: number;
  boarderHealthMultiplier?: number;
  routeName: string;
  vehicleName?: string;
  horseName?: string;
  cartArmor?: number;
  cartHealthRatio?: number;
  spareAxle?: boolean;
  cargoProtection?: number;
  horseProtection?: number;
  horseHealthRatio?: number;
  morale?: number;
  downedGuardIds?: string[];
  escortClient?: {
    name: string;
    healthRatio: number;
  };
  martialArtId?: MartialArtId;
  leader?: {
    name: string;
    experience: number;
    healthRatio: number;
    power: number;
    maxHpBonus?: number;
    armorMultiplier?: number;
    formationExperience?: Partial<Record<BattleFormationId, number>>;
    equipmentIds?: EquipmentId[];
    equipmentNames?: string[];
    equipmentTuning?: Partial<Record<EquipmentId, number>>;
    injuryName?: string;
    movementMultiplier?: number;
    techniqueCooldownMultiplier?: number;
    martialArtExperience?: number;
    deputyBond?: number;
    coreCombatFocusId?: CoreCombatFocusId;
    coreCombatExperience?: number;
  };
  guards: Array<{
    id: string;
    name: string;
    role: CrewRole;
    experience?: number;
    formationExperience?: Partial<Record<BattleFormationId, number>>;
    healthRatio: number;
    power: number;
    maxHpBonus?: number;
    armorMultiplier?: number;
    cartGuardBonus?: number;
    horseGuardBonus?: number;
    equipmentIds?: EquipmentId[];
    equipmentNames?: string[];
    equipmentTuning?: Partial<Record<EquipmentId, number>>;
    disciplineId?: CrewDisciplineId;
    disciplineName?: string;
    masteryId?: CrewMasteryId;
    masteryName?: string;
    masterySeal?: string;
    injuryName?: string;
    movementMultiplier?: number;
    supportCooldownMultiplier?: number;
    engageRangeBonus?: number;
    convoyProtection?: number;
  }>;
}

export interface CrewEquipment {
  weapon?: EquipmentId;
  armor?: EquipmentId;
  tool?: EquipmentId;
}

export interface BattleContribution {
  damage: number;
  support: number;
  defeats: number;
  title: string;
  experience: number;
}

export interface BattleResult {
  outcome: "complete" | "partial" | "retreat" | "defeat";
  elapsedHours: number;
  leaderDamage: number;
  leaderExperience?: number;
  leaderContribution?: BattleContribution;
  leaderFormationExperience?: Partial<Record<BattleFormationId, number>>;
  leaderDeputyCombos?: number;
  leaderDeputyCounters?: number;
  leaderDeputyId?: string;
  leaderDeputyBondGain?: number;
  leaderCoreCombatExperience?: Partial<Record<CoreCombatFocusId, number>>;
  leaderMartialExperience?: Partial<Record<MartialArtId, number>>;
  enemyLeaderDefeated?: boolean;
  leaderChallenges?: number;
  leaderInjury?: CrewInjuryId;
  guardLoss: number;
  cartDamage: number;
  cartRepair?: number;
  cargoLoss: number;
  sealBroken: boolean;
  guardDamage: Record<string, number>;
  guardExperience?: Record<string, number>;
  guardFormationExperience?: Record<string, Partial<Record<BattleFormationId, number>>>;
  formationSeconds?: Record<BattleFormationId, number>;
  dominantFormation?: BattleFormationId;
  guardContributions?: Record<string, BattleContribution>;
  guardInjuries?: Partial<Record<string, CrewInjuryId>>;
  horseDamage?: number;
  bannerLost?: boolean;
  bannerRecovered?: boolean;
  moraleDamage?: number;
  defenseCounters?: number;
  defenseBreaches?: number;
  clientDamage?: number;
  clientDowned?: boolean;
}

export interface Settlement {
  grade: "甲" | "乙" | "丙" | "失镖";
  title: string;
  summary: string;
  reward: number;
  compensation: number;
  tradeRevenue?: number;
  tradeProfit?: number;
  equipmentReward?: EquipmentId;
  reputationChange: number;
  notes: string[];
}

export interface CareerState {
  claimedObjectiveIds: CareerObjectiveId[];
  endingId: CareerEndingId | null;
}

export interface LegacyState {
  version: 1;
  completedRuns: number;
  victories: number;
  bestCompletedContracts: number;
  unlockedIds: LegacyId[];
  recordedRunKeys: string[];
}

export interface ConductState {
  investigations: number;
  intactSealedDeliveries: number;
  escortDeliveries: number;
  concealedBorders: number;
  peacefulPassages: number;
}

export interface GameState {
  version: 20;
  seed: number;
  originId: OriginId;
  legacyId: LegacyId | null;
  rngState: number;
  day: number;
  phase: GamePhase;
  currentCityId: string;
  selectedCityId: string;
  silver: number;
  supplies: number;
  reputation: number;
  jianghuReputation: number;
  cityReputation: Record<string, number>;
  relations: Record<FactionId, number>;
  factionAudienceDay: Record<FactionId, number>;
  travelPermits: Record<FactionId, number>;
  cities: Record<string, CityState>;
  routeIntel: Record<string, RouteIntelState>;
  routeStates: Record<string, RouteState>;
  worldActors: WorldActor[];
  offices: Record<string, OfficeState>;
  contracts: Contract[];
  convoy: ConvoyState;
  martialArtId: MartialArtId;
  leader: LeaderProgression;
  crew: CrewMember[];
  equipmentStock: Record<EquipmentId, number>;
  equipmentTuning: Record<EquipmentId, number>;
  crewEquipment: Record<string, CrewEquipment>;
  recruitPool: CrewMember[];
  recruitPoolCityId: string;
  activeCrewIds: string[];
  journey: JourneyState | null;
  currentEvent: TravelEvent | null;
  pendingBattle: BattleConfig | null;
  settlement: Settlement | null;
  news: string[];
  completedContracts: number;
  career: CareerState;
  conduct: ConductState;
  tutorialSeen: boolean;
}
