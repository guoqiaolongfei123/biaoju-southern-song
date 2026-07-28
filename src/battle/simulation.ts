import { randomStep } from "../core/rng";
import { martialArtById } from "../core/martialContent";
import { injuryForBattleDamage } from "../core/injuryContent";
import { EQUIPMENT, equipmentDisplayName, equipmentHasBattleTrait, equipmentTuningLevel, type EquipmentDefinition } from "../core/equipmentContent";
import { createFormationExperience, dominantBattleFormation, formationExperienceAwards, formationProficiencyRank, normalizeFormationExperience } from "../core/formationProficiency";
import { deputyBondGain, deputyBondRank } from "../core/deputyBondContent";
import { coreCombatExperienceGain, coreCombatFocusTuning } from "../core/coreCombatFocusContent";
import { martialProficiencyExperienceGain, martialProficiencyTuning } from "../core/martialProficiencyContent";
import type { BattleConfig, BattleFormationId, BattleObjectiveMode, BattleResult, CoreCombatFocusId, CrewDisciplineId, CrewMasteryId, CrewRole, EquipmentId, MartialArtId } from "../core/types";
import { STANDARD_BATTLE_MODIFIERS, battleDoctrine, type BattleDoctrineId } from "./doctrineContent";

export interface Vec2 { x: number; y: number }
export interface Fighter extends Vec2 {
  id: string;
  hp: number;
  maxHp: number;
  cooldown: number;
  flash: number;
}

export interface Combatant extends Fighter {
  attackPulse: number;
  facingX: number;
  facingY: number;
}

export interface LeaderCombatant extends Combatant {
  name: string;
  power: number;
  armorMultiplier: number;
  experience: number;
  formationExperience: Record<BattleFormationId, number>;
  equipmentIds: EquipmentId[];
  equipmentTuning: Partial<Record<EquipmentId, number>>;
  injuryName: string | null;
  movementMultiplier: number;
  techniqueCooldownMultiplier: number;
}

export interface Enemy extends Combatant {
  type: "raider" | "archer" | "hooker" | "cutter" | "torch" | "boarder" | "banner" | "leader";
  lane: number;
  stunned: number;
  carrier: boolean;
  rallied: number;
  clientHunter: boolean;
  attackWindup: number;
  attackWindupDuration: number;
  attackTargetId: string | null;
  boarded: boolean;
}

export interface BattleClient extends Combatant {
  name: string;
  panic: number;
}

export interface Guard extends Combatant {
  name: string;
  role: CrewRole;
  power: number;
  armorMultiplier: number;
  cartGuardBonus: number;
  horseGuardBonus: number;
  formationExperience: Record<BattleFormationId, number>;
  equipmentIds: EquipmentId[];
  equipmentTuning: Partial<Record<EquipmentId, number>>;
  supportCooldown: number;
  supportPulse: number;
  supportKind: GuardSupportKind | null;
  disciplineId: CrewDisciplineId | null;
  disciplineName: string | null;
  masteryId: CrewMasteryId | null;
  masteryName: string | null;
  masterySeal: string | null;
  masteryPulse: number;
  masteryCooldown: number;
  masteryResolved: boolean;
  injuryName: string | null;
  movementMultiplier: number;
  supportCooldownMultiplier: number;
  engageRangeBonus: number;
  convoyProtection: number;
}

export interface BattleHorse extends Fighter {
  tetherCut: boolean;
}

export interface BattleBanner extends Vec2 {
  captureProgress: number;
  contested: boolean;
  stolen: boolean;
  lost: boolean;
  recovered: boolean;
  carrierId: string | null;
  flash: number;
}

export type BattleFormation = BattleFormationId;
export type BattleStrategy = "balanced" | "breakthrough" | "guard-cart" | "guard-horses" | "guard-client" | "focus-fire" | "repair-cart" | "rescue";
export type EnemyLeaderPhase = "absent" | "command" | "challenge" | "defeated";
export type TechniquePolicy = "auto" | "reserve";
export type GuardSupportKind = "crossbow" | "volley" | "medicine" | "horse-hook" | "wheel-hook" | "shield" | "mastery" | "rescue" | "repair" | "coordination" | "core-combo" | "core-counter";
export type BattleCueKind = "player-strike" | "guard-strike" | "coordination" | "core-combo" | "enemy-strike" | "arrow" | "bolt" | "volley" | "hook" | "torch" | "technique" | "heal" | "revive" | "rescue" | "repair" | "mastery" | "brace" | "counter" | "breach" | "leader-challenge" | "banner-grab" | "banner-recover" | "banner-lost";

export interface BattleCue {
  id: number;
  kind: BattleCueKind;
  sourceId: string;
  targetId: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  amount: number;
  label?: string;
  assistSourceId?: string;
  assistX?: number;
  assistY?: number;
  targetLabel?: string;
  actionLabel?: string;
  counterAmount?: number;
  ttl: number;
  duration: number;
}

export interface BattleThreatNotice {
  tone: "steady" | "horse" | "cart" | "ranged" | "command";
  label: string;
  advice: string;
}

export interface BattleAttackIntent {
  enemyId: string;
  enemyType: Enemy["type"];
  targetId: string;
  targetLabel: string;
  actionLabel: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  progress: number;
  remaining: number;
  tone: BattleThreatNotice["tone"];
  recommendedStrategy: Extract<BattleStrategy, "guard-cart" | "guard-horses" | "guard-client" | "breakthrough">;
  advice: string;
}

export type BattleIntentReadiness = "covered" | "relaying" | "uncovered";

export interface BattleSimulation {
  config: BattleConfig;
  doctrineId: BattleDoctrineId | null;
  player: LeaderCombatant;
  guards: Guard[];
  enemies: Enemy[];
  cart: { x: number; y: number; hp: number; maxHp: number; cargo: number; flash: number };
  horse: BattleHorse;
  client: BattleClient | null;
  initialClientHp: number;
  clientGuarded: boolean;
  banner: BattleBanner;
  morale: number;
  initialMorale: number;
  elapsed: number;
  rally: number;
  formation: BattleFormation;
  activeStrategy: BattleStrategy;
  formationSeconds: Record<BattleFormationId, number>;
  outcome: BattleResult["outcome"] | null;
  defeatedEnemies: number;
  initialGuardCount: number;
  initialCartHp: number;
  initialHorseHp: number;
  guardContributions: Record<string, { damage: number; support: number; defeats: number }>;
  leaderContribution: { damage: number; support: number; defeats: number };
  attackPulse: number;
  techniquePulse: number;
  techniqueCooldown: number;
  techniqueCount: number;
  techniqueDamage: number;
  cues: BattleCue[];
  nextCueId: number;
  rngState: number;
  reinforcementWave: number;
  wavePulse: number;
  enemyCommandPulse: number;
  leaderCommandCount: number;
  leaderPhase: EnemyLeaderPhase;
  leaderChallengePulse: number;
  leaderChallengeCount: number;
  leaderDefeated: boolean;
  pursuitResolved: "recovered" | "escaped" | null;
  rescueTargetId: string | null;
  rescueRescuerId: string | null;
  rescueProgress: number;
  rescuePulse: number;
  rescuedGuardIds: string[];
  repairerId: string | null;
  repairProgress: number;
  repairPulse: number;
  repairCount: number;
  cartRepairTotal: number;
  volleyTargetId: string | null;
  volleyProgress: number;
  volleyPulse: number;
  volleyCooldown: number;
  volleyCount: number;
  coordinationWindow: { guardId: string; targetId: string; expiresAt: number } | null;
  coordinationCooldown: number;
  coordinationPulse: number;
  coordinationCount: number;
  coreComboCooldown: number;
  coreComboPulse: number;
  coreComboCount: number;
  coreCounterPulse: number;
  coreCounterCount: number;
  defenseCounters: number;
  defenseBreaches: number;
  defensePulse: number;
  defenseOutcome: "counter" | "breach" | null;
  openingMasteriesResolved: boolean;
  message: string;
}

export interface BattleInput {
  x: number;
  y: number;
  attack: boolean;
  technique?: boolean;
  rally: boolean;
  guardHorses?: boolean;
  guardClient?: boolean;
  rescue?: boolean;
  repair?: boolean;
  focusFire?: boolean;
  retreat: boolean;
  formation?: BattleFormation;
  strategy?: BattleStrategy;
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function moveToward(entity: Vec2, target: Vec2, amount: number): void {
  const dx = target.x - entity.x;
  const dy = target.y - entity.y;
  const length = Math.hypot(dx, dy) || 1;
  entity.x += (dx / length) * Math.min(amount, length);
  entity.y += (dy / length) * Math.min(amount, length);
  if ("facingX" in entity && "facingY" in entity) {
    const combatant = entity as Combatant;
    combatant.facingX = dx / length;
    combatant.facingY = dy / length;
  }
}

function faceToward(entity: Combatant, target: Vec2): void {
  const dx = target.x - entity.x;
  const dy = target.y - entity.y;
  const length = Math.hypot(dx, dy) || 1;
  entity.facingX = dx / length;
  entity.facingY = dy / length;
}

function emitCue(
  state: BattleSimulation,
  kind: BattleCueKind,
  source: Fighter | Vec2,
  target: (Fighter | Vec2) & { id?: string },
  amount: number,
  label?: string,
  presentation?: { assistSourceId?: string; assistX?: number; assistY?: number; targetLabel?: string; actionLabel?: string; counterAmount?: number },
): void {
  const duration = kind === "arrow" || kind === "bolt" ? .46 : kind === "volley" ? .82 : kind === "core-combo" ? .94 : kind === "coordination" ? .76 : kind === "counter" || kind === "breach" ? .72 : kind === "leader-challenge" ? .95 : kind === "torch" ? .52 : kind === "hook" || kind === "brace" ? .34 : kind === "heal" || kind === "revive" || kind === "rescue" || kind === "repair" ? .62 : kind === "mastery" || kind.startsWith("banner-") ? .72 : kind === "technique" ? .48 : .28;
  state.cues.push({
    id: state.nextCueId,
    kind,
    sourceId: "id" in source ? source.id : "unknown",
    targetId: target.id ?? "cart",
    fromX: source.x,
    fromY: source.y,
    toX: target.x,
    toY: target.y,
    amount,
    label,
    ...presentation,
    ttl: duration,
    duration,
  });
  state.nextCueId += 1;
  if (state.cues.length > 36) state.cues.splice(0, state.cues.length - 36);
}

export function battleObjectiveMode(config: BattleConfig): BattleObjectiveMode {
  return config.objectiveMode ?? (config.terrain === "river" ? "holdout" : "breakthrough");
}

export function battleObjectiveSeconds(config: BattleConfig): number {
  if (config.objectiveSeconds && config.objectiveSeconds > 0) return config.objectiveSeconds;
  const mode = battleObjectiveMode(config);
  return mode === "holdout" ? 42 : mode === "gate-run" ? 48 : mode === "pursuit" ? 34 : 72;
}

export function pursuitCarrier(state: BattleSimulation): Enemy | undefined {
  return state.enemies.find((enemy) => enemy.carrier);
}

function pursuitRunnerSpeed(state: BattleSimulation): number {
  return state.config.terrain === "mountain" ? 46 : state.config.terrain === "river" ? 50 : 54;
}

export function battleTimeRemaining(state: BattleSimulation): number | null {
  const mode = battleObjectiveMode(state.config);
  if (mode === "breakthrough") return null;
  if (mode === "pursuit") {
    const carrier = pursuitCarrier(state);
    if (!carrier || carrier.hp <= 0) return 0;
    return Math.max(0, Math.ceil(Math.min(battleObjectiveSeconds(state.config) - state.elapsed, (925 - carrier.x) / pursuitRunnerSpeed(state))));
  }
  return Math.max(0, Math.ceil(battleObjectiveSeconds(state.config) - state.elapsed));
}

export function battleInitialMessage(config: BattleConfig): string {
  const mode = battleObjectiveMode(config);
  if (mode === "holdout") return config.terrain === "river" ? "守住车马，等待渡船靠岸" : "围车停阵，撑到援手抵达";
  if (mode === "gate-run") return config.escortClient ? `城门将闭，护住${config.escortClient.name}抢时突进` : "城门将闭，护住客车抢时突进";
  if (mode === "pursuit") return `夺镖者正在脱逃，追回${config.recoveryLabel ?? "镖匣"}`;
  return "护住镖车，向东突围";
}

function baseFormation(config: BattleConfig): BattleFormation {
  return battleObjectiveMode(config) === "holdout" ? "hold" : "advance";
}

function enemyTypeAt(index: number, mode: BattleObjectiveMode): Enemy["type"] {
  const patterns: Record<BattleObjectiveMode, Enemy["type"][]> = {
    breakthrough: ["raider", "boarder", "cutter", "archer", "hooker", "torch"],
    holdout: ["boarder", "raider", "torch", "archer", "cutter", "hooker"],
    "gate-run": ["cutter", "archer", "boarder", "hooker", "torch", "cutter"],
    pursuit: ["raider", "cutter", "archer", "raider", "hooker", "torch"],
  };
  return patterns[mode][index % patterns[mode].length];
}

function createEnemy(index: number, mode: BattleObjectiveMode, terrain: BattleConfig["terrain"], value: number, reinforcement = false, forcedType?: Enemy["type"]): Enemy {
  const carrier = mode === "pursuit" && index === 0;
  const type = carrier ? "raider" : forcedType ?? enemyTypeAt(index, mode);
  const fromTop = index % 2 === 0;
  const topSpawnY = terrain === "river" ? 228 : 46;
  const bottomSpawnY = terrain === "river" ? 474 : 494;
  const hp = carrier ? 160 : type === "leader" ? 168 : type === "banner" ? 150 : type === "hooker" ? 70 : type === "boarder" ? 78 : type === "archer" ? 48 : type === "cutter" ? 54 : type === "torch" ? 52 : 58;
  return {
    id: `enemy-${index}`,
    type,
    x: carrier ? 440 : type === "leader" ? 716 + value * 118 : type === "banner" ? 390 + value * 100 : (reinforcement ? 690 : 340) + value * (reinforcement ? 220 : 520),
    y: carrier || type === "leader" ? 270 : fromTop ? topSpawnY + (index % 3) * 28 : bottomSpawnY - (index % 3) * 34,
    lane: fromTop ? 1 : -1,
    hp,
    maxHp: hp,
    cooldown: value,
    flash: 0,
    attackPulse: 0,
    facingX: -1,
    facingY: 0,
    stunned: 0,
    carrier,
    rallied: 0,
    clientHunter: false,
    attackWindup: 0,
    attackWindupDuration: 0,
    attackTargetId: null,
    boarded: false,
  };
}

export function createBattleSimulation(config: BattleConfig, doctrineId: BattleDoctrineId | null = null): BattleSimulation {
  let rng = config.seed;
  const mode = battleObjectiveMode(config);
  const enemyCount = Math.min(10, 6 + Math.floor(config.danger / 22));
  const enemies: Enemy[] = [];
  for (let index = 0; index < enemyCount; index += 1) {
    const roll = randomStep(rng);
    rng = roll.state;
    const leader = mode !== "pursuit" && Boolean(config.enemyLeaderName) && index === enemyCount - 1;
    const bannerRaider = mode !== "pursuit" && config.danger >= 54 && index === enemyCount - (leader ? 2 : 1);
    const enemy = createEnemy(index, mode, config.terrain, roll.value, false, leader ? "leader" : bannerRaider ? "banner" : undefined);
    if (enemy.type === "leader" && config.enemyLeaderHealthMultiplier !== undefined) {
      const multiplier = Math.max(.5, config.enemyLeaderHealthMultiplier);
      enemy.maxHp = Math.round(enemy.maxHp * multiplier);
      enemy.hp = enemy.maxHp;
    }
    if (enemy.type === "boarder" && config.boarderHealthMultiplier !== undefined) {
      const multiplier = Math.max(.5, config.boarderHealthMultiplier);
      enemy.maxHp = Math.round(enemy.maxHp * multiplier);
      enemy.hp = enemy.maxHp;
    }
    enemies.push(enemy);
  }
  if (config.escortClient) {
    const hunterCount = config.danger >= 66 ? 2 : 1;
    enemies
      .filter((enemy) => enemy.type === "raider" || enemy.type === "archer")
      .slice(0, hunterCount)
      .forEach((enemy) => { enemy.clientHunter = true; });
  }

  const guards: Guard[] = config.guards.map((member, index) => {
    const baseY = 215 + index * 55;
    const xShift = doctrineId === "goose-vanguard" ? 30 : doctrineId === "iron-ring" ? -10 : 0;
    const y = doctrineId === "crescent-snare" ? 270 + (baseY - 270) * 1.22 : doctrineId === "iron-ring" ? 270 + (baseY - 270) * .88 : baseY;
    return {
    id: member.id,
    name: member.name,
    role: member.role,
    x: 138 + index * 20 + xShift,
    y,
    hp: config.downedGuardIds?.includes(member.id) ? 0 : Math.max(12, Math.round((74 + (member.maxHpBonus ?? 0)) * member.healthRatio)),
    maxHp: 74 + (member.maxHpBonus ?? 0),
    cooldown: index * 0.12,
    flash: 0,
    attackPulse: 0,
    facingX: 1,
    facingY: 0,
    power: member.power,
    armorMultiplier: member.armorMultiplier ?? 1,
    cartGuardBonus: member.cartGuardBonus ?? 0,
    horseGuardBonus: member.horseGuardBonus ?? 0,
    formationExperience: normalizeFormationExperience(member.formationExperience),
    equipmentIds: member.equipmentIds ?? [],
    equipmentTuning: member.equipmentTuning ?? {},
    supportCooldown: 1.8 + index * 1.1,
    supportPulse: 0,
    supportKind: null,
    disciplineId: member.disciplineId ?? null,
    disciplineName: member.disciplineName ?? null,
    masteryId: member.masteryId ?? null,
    masteryName: member.masteryName ?? null,
    masterySeal: member.masterySeal ?? null,
    masteryPulse: 0,
    masteryCooldown: 0,
    masteryResolved: false,
    injuryName: member.injuryName ?? null,
    movementMultiplier: member.movementMultiplier ?? 1,
    supportCooldownMultiplier: member.supportCooldownMultiplier ?? 1,
    engageRangeBonus: member.engageRangeBonus ?? 0,
    convoyProtection: member.convoyProtection ?? 1,
    };
  });

  const horseMaxHp = 120;
  const horseHp = Math.max(8, Math.round(horseMaxHp * (config.horseHealthRatio ?? 1)));
  const clientHp = config.escortClient ? Math.max(1, Math.round(100 * config.escortClient.healthRatio)) : 0;
  const cartMaxHp = 220;
  const cartHp = Math.max(8, Math.round(cartMaxHp * (config.cartHealthRatio ?? 1)));
  const leaderMaxHp = 100 + (config.leader?.maxHpBonus ?? 0);
  const leaderHp = Math.max(1, Math.round(leaderMaxHp * (config.leader?.healthRatio ?? 1)));
  return {
    config,
    doctrineId,
    player: {
      id: "player", name: config.leader?.name ?? "总镖头", x: 108, y: 270, hp: leaderHp, maxHp: leaderMaxHp,
      cooldown: 0, flash: 0, attackPulse: 0, facingX: 1, facingY: 0,
      power: config.leader?.power ?? 1, armorMultiplier: config.leader?.armorMultiplier ?? 1,
      experience: config.leader?.experience ?? 0,
      formationExperience: normalizeFormationExperience(config.leader?.formationExperience),
      equipmentIds: config.leader?.equipmentIds ?? [], equipmentTuning: config.leader?.equipmentTuning ?? {},
      injuryName: config.leader?.injuryName ?? null,
      movementMultiplier: config.leader?.movementMultiplier ?? 1,
      techniqueCooldownMultiplier: config.leader?.techniqueCooldownMultiplier ?? 1,
    },
    guards,
    enemies,
    cart: { x: 145, y: 270, hp: cartHp, maxHp: cartMaxHp, cargo: 100, flash: 0 },
    horse: { id: "horse-team", x: 199, y: 270, hp: horseHp, maxHp: horseMaxHp, cooldown: 0, flash: 0, tetherCut: false },
    client: config.escortClient ? {
      id: "escort-client", name: config.escortClient.name, x: 118, y: 334, hp: clientHp, maxHp: 100,
      cooldown: 0, flash: 0, attackPulse: 0, facingX: 1, facingY: 0, panic: 0,
    } : null,
    initialClientHp: clientHp,
    clientGuarded: false,
    banner: { x: 187, y: 210, captureProgress: 0, contested: false, stolen: false, lost: false, recovered: false, carrierId: null, flash: 0 },
    morale: Math.max(0, Math.min(100, config.morale ?? 72)),
    initialMorale: Math.max(0, Math.min(100, config.morale ?? 72)),
    elapsed: 0,
    rally: 0,
    formation: baseFormation(config),
    activeStrategy: "balanced",
    formationSeconds: createFormationExperience(),
    outcome: null,
    defeatedEnemies: 0,
    initialGuardCount: guards.length,
    initialCartHp: cartHp,
    initialHorseHp: horseHp,
    guardContributions: Object.fromEntries(guards.map((guard) => [guard.id, { damage: 0, support: 0, defeats: 0 }])),
    leaderContribution: { damage: 0, support: 0, defeats: 0 },
    attackPulse: 0,
    techniquePulse: 0,
    techniqueCooldown: 0,
    techniqueCount: 0,
    techniqueDamage: 0,
    cues: [],
    nextCueId: 1,
    rngState: rng,
    reinforcementWave: 0,
    wavePulse: 0,
    enemyCommandPulse: 0,
    leaderCommandCount: 0,
    leaderPhase: config.enemyLeaderName ? "command" : "absent",
    leaderChallengePulse: 0,
    leaderChallengeCount: 0,
    leaderDefeated: false,
    pursuitResolved: null,
    rescueTargetId: null,
    rescueRescuerId: null,
    rescueProgress: 0,
    rescuePulse: 0,
    rescuedGuardIds: [],
    repairerId: null,
    repairProgress: 0,
    repairPulse: 0,
    repairCount: 0,
    cartRepairTotal: 0,
    volleyTargetId: null,
    volleyProgress: 0,
    volleyPulse: 0,
    volleyCooldown: 0,
    volleyCount: 0,
    coordinationWindow: null,
    coordinationCooldown: 0,
    coordinationPulse: 0,
    coordinationCount: 0,
    coreComboCooldown: 0,
    coreComboPulse: 0,
    coreComboCount: 0,
    coreCounterPulse: 0,
    coreCounterCount: 0,
    defenseCounters: 0,
    defenseBreaches: 0,
    defensePulse: 0,
    defenseOutcome: null,
    openingMasteriesResolved: false,
    message: battleInitialMessage(config),
  };
}

function damage(target: Fighter, amount: number): void {
  const specialistArmor = "type" in target && (target as Enemy).type === "banner"
    ? .25
    : "type" in target && (target as Enemy).type === "boarder" && (target as Enemy).boarded
      ? .72
      : 1;
  target.hp = Math.max(0, target.hp - amount * specialistArmor);
  target.flash = 0.12;
}

function recordGuardDamage(state: BattleSimulation, guard: Guard, target: Enemy, amount: number): number {
  const before = target.hp;
  damage(target, amount);
  const actual = Math.max(0, before - target.hp);
  const contribution = state.guardContributions[guard.id];
  if (contribution) {
    contribution.damage += actual;
    if (before > 0 && target.hp <= 0) contribution.defeats += 1;
  }
  return actual;
}

function recordLeaderDamage(state: BattleSimulation, target: Enemy, amount: number): number {
  const focus = coreCombatFocusTuning(state.config.leader?.coreCombatFocusId, state.config.leader?.coreCombatExperience ?? 0);
  const elite = target.carrier || target.type === "leader" || target.type === "hooker" || target.type === "cutter" || target.type === "torch" || target.type === "boarder";
  const before = target.hp;
  damage(target, elite ? amount * focus.eliteDamageMultiplier : amount);
  const actual = Math.max(0, before - target.hp);
  state.leaderContribution.damage += actual;
  if (before > 0 && target.hp <= 0) state.leaderContribution.defeats += 1;
  return actual;
}

function leaderFormationBonus(state: BattleSimulation): number {
  return formationProficiencyRank(state.player.formationExperience[state.formation]).bonus;
}

function recordGuardSupport(state: BattleSimulation, guard: Guard, amount: number): void {
  const contribution = state.guardContributions[guard.id];
  if (contribution) contribution.support += Math.max(0, amount);
}

export function battleCoordinationTuning(experienceA = 0, experienceB = 0): { windowSeconds: number; cooldownSeconds: number; damageMultiplier: number } {
  const combinedExperience = Math.max(0, experienceA) + Math.max(0, experienceB);
  return {
    windowSeconds: .72 + Math.min(.22, combinedExperience * .01),
    cooldownSeconds: 6.2 - Math.min(1.8, combinedExperience * .075),
    damageMultiplier: .38 + Math.min(.18, combinedExperience * .0075),
  };
}

export function battleCoreComboTuning(
  leaderExperience = 0,
  deputyExperience = 0,
  bondExperience = 0,
  focusId?: CoreCombatFocusId,
  focusExperience = 0,
): { cooldownSeconds: number; damageMultiplier: number; assistRange: number } {
  const combinedExperience = Math.max(0, leaderExperience) + Math.max(0, deputyExperience);
  const bond = deputyBondRank(bondExperience);
  const focus = coreCombatFocusTuning(focusId, focusExperience);
  return {
    cooldownSeconds: (7.4 - Math.min(2.2, combinedExperience * .07)) * (1 - bond.cooldownReduction) * focus.comboCooldownMultiplier,
    damageMultiplier: (.5 + Math.min(.2, combinedExperience * .008) + bond.comboDamageBonus) * focus.comboDamageMultiplier,
    assistRange: focus.comboAssistRange,
  };
}

export function battleCoreCounterTuning(
  leaderExperience = 0,
  deputyExperience = 0,
  bondExperience = 0,
  focusId?: CoreCombatFocusId,
  focusExperience = 0,
): { incomingMultiplier: number; damageMultiplier: number; stunSeconds: number } {
  const combinedExperience = Math.max(0, leaderExperience) + Math.max(0, deputyExperience);
  const bond = deputyBondRank(bondExperience);
  const focus = coreCombatFocusTuning(focusId, focusExperience);
  return {
    incomingMultiplier: Math.max(.18, (.34 - Math.min(.055, combinedExperience * .0018) - bond.comboDamageBonus * .42) * focus.counterIncomingMultiplier),
    damageMultiplier: (.62 + Math.min(.22, combinedExperience * .009) + bond.comboDamageBonus) * focus.counterDamageMultiplier,
    stunSeconds: .95 + Math.min(.28, combinedExperience * .01) + bond.level * .08 + focus.counterStunBonus,
  };
}

export function battleCoreComboReadiness(state: BattleSimulation): number {
  const deputy = state.config.guards.find((guard) => guard.role === "副镖头" && state.guards.some((fighter) => fighter.id === guard.id && fighter.hp > 0));
  if (!deputy) return 0;
  const tuning = battleCoreComboTuning(state.player.experience, deputy.experience ?? 0, state.config.leader?.deputyBond ?? 0, state.config.leader?.coreCombatFocusId, state.config.leader?.coreCombatExperience ?? 0);
  return Math.round((1 - Math.min(1, state.coreComboCooldown / tuning.cooldownSeconds)) * 100);
}

function guardExperience(state: BattleSimulation, guardId: string): number {
  return state.config.guards.find((guard) => guard.id === guardId)?.experience ?? 0;
}

function resolveGuardCoordination(state: BattleSimulation, guard: Guard, target: Enemy, baseDamage: number, targetHpBeforeStrike: number): boolean {
  if (state.coordinationCooldown > 0 || targetHpBeforeStrike <= 0) return false;
  const opening = state.coordinationWindow;
  const soloTuning = battleCoordinationTuning(guardExperience(state, guard.id));
  const openingPartner = opening && opening.expiresAt >= state.elapsed && opening.guardId !== guard.id && opening.targetId === target.id
    ? state.guards.find((candidate) => candidate.id === opening.guardId && candidate.hp > 0)
    : undefined;
  const readyPartner = state.guards
    .filter((candidate) => candidate.id !== guard.id && candidate.hp > 0)
    .filter((candidate) => candidate.id !== state.rescueRescuerId && candidate.id !== state.repairerId)
    .filter((candidate) => !(state.volleyTargetId && guardHasEquipmentTrait(candidate, "crossbow")))
    .filter((candidate) => candidate.cooldown <= 1.1)
    .filter((candidate) => distance(candidate, target) <= 280)
    .sort((a, b) => distance(a, target) - distance(b, target))[0];
  const partner = openingPartner ?? readyPartner;
  if (!partner) {
    state.coordinationWindow = { guardId: guard.id, targetId: target.id, expiresAt: state.elapsed + soloTuning.windowSeconds };
    return false;
  }
  const tuning = battleCoordinationTuning(guardExperience(state, guard.id), guardExperience(state, partner.id));
  const coordinationDamage = baseDamage * tuning.damageMultiplier;
  const actual = target.hp > 0
    ? recordGuardDamage(state, guard, target, coordinationDamage)
    : Math.min(coordinationDamage, targetHpBeforeStrike);
  if (actual <= 0) return false;
  faceToward(partner, target);
  partner.attackPulse = Math.max(partner.attackPulse, .34);
  partner.cooldown = Math.max(partner.cooldown, .32);
  partner.supportPulse = Math.max(partner.supportPulse, .76);
  partner.supportKind = "coordination";
  guard.supportPulse = Math.max(guard.supportPulse, .76);
  guard.supportKind = "coordination";
  target.stunned = Math.max(target.stunned, state.formation === "hold" ? 1.15 : .72);
  recordGuardSupport(state, partner, actual * .7);
  recordGuardSupport(state, guard, actual * .3);
  const label = state.formation === "advance" ? "雁行夹击" : state.formation === "horses" ? "护马合围" : "交臂护阵";
  emitCue(state, "coordination", guard, target, actual, label, {
    assistSourceId: partner.id,
    assistX: partner.x,
    assistY: partner.y,
  });
  state.coordinationWindow = null;
  state.coordinationCooldown = tuning.cooldownSeconds;
  state.coordinationPulse = .86;
  state.coordinationCount += 1;
  state.message = `${partner.name}与${guard.name}前后接势，${label}！`;
  return true;
}

function resolveCoreCombo(state: BattleSimulation, target: Enemy, leaderDamage: number): boolean {
  if (state.coreComboCooldown > 0 || target.hp <= 0 || leaderDamage <= 0) return false;
  const deputy = state.guards.find((guard) => guard.role === "副镖头" && guard.hp > 0);
  if (!deputy || deputy.id === state.rescueRescuerId || deputy.id === state.repairerId) return false;
  if (state.volleyTargetId && guardHasEquipmentTrait(deputy, "crossbow")) return false;
  const tuning = battleCoreComboTuning(state.player.experience, guardExperience(state, deputy.id), state.config.leader?.deputyBond ?? 0, state.config.leader?.coreCombatFocusId, state.config.leader?.coreCombatExperience ?? 0);
  if (distance(deputy, target) > tuning.assistRange || deputy.cooldown > 1.15) return false;
  const comboPower = leaderDamage * tuning.damageMultiplier;
  const actual = recordGuardDamage(state, deputy, target, comboPower);
  if (actual <= 0) return false;
  faceToward(deputy, target);
  deputy.attackPulse = Math.max(deputy.attackPulse, .42);
  deputy.cooldown = Math.max(deputy.cooldown, .38);
  deputy.supportPulse = Math.max(deputy.supportPulse, .94);
  deputy.supportKind = "core-combo";
  target.stunned = Math.max(target.stunned, state.formation === "advance" ? .92 : .72);
  state.leaderContribution.support += actual * .2;
  recordGuardSupport(state, deputy, actual * .35);
  const focusId = state.config.leader?.coreCombatFocusId ?? "paired-assault";
  const label = focusId === "cross-guard"
    ? "回锋夹截"
    : focusId === "leader-hunt"
      ? target.type === "leader" ? "逐首断旗" : "双锋追魁"
      : state.formation === "advance" ? "双锋贯阵" : state.formation === "horses" ? "并辔截缰" : "主副合垣";
  emitCue(state, "core-combo", state.player, target, Math.max(actual, comboPower), label, {
    assistSourceId: deputy.id,
    assistX: deputy.x,
    assistY: deputy.y,
  });
  state.coreComboCooldown = tuning.cooldownSeconds;
  state.coreComboPulse = 1;
  state.coreComboCount += 1;
  state.message = `${state.player.name}与${deputy.name}主副接势，${label}！`;
  return true;
}

function battleMoraleModifier(state: BattleSimulation): number {
  const steady = .9 + Math.max(0, Math.min(100, state.morale)) / 1000;
  return steady * (state.banner.stolen || state.banner.lost ? .86 : 1);
}

function formationOrderMessage(state: BattleSimulation, formation: BattleFormation): string {
  if (formation === "horses") return "护马！斩缰手不得近前";
  if (formation === "hold") return state.clientGuarded && state.client
    ? `护人！把${state.client.name}收进阵心`
    : state.config.terrain === "river" ? "列阵！守住渡口与车轮" : "围车停阵！先保货物与车轮";
  return battleObjectiveMode(state.config) === "gate-run" ? "催车抢关！赶在城门落锁之前" : battleObjectiveMode(state.config) === "pursuit" ? "分出快手！直追夺镖者" : "开路推进！镖队自行破阵前行";
}

const FORMATION_GUARD_OFFSETS: Record<BattleFormation, Vec2[]> = {
  advance: [
    { x: 48, y: -88 },
    { x: 82, y: 82 },
    { x: -58, y: 96 },
  ],
  hold: [
    { x: -34, y: -98 },
    { x: -104, y: 8 },
    { x: -34, y: 98 },
  ],
  horses: [
    { x: 18, y: -92 },
    { x: 92, y: 4 },
    { x: 22, y: 92 },
  ],
};

export function battleGuardAnchor(state: BattleSimulation, index: number, formation: BattleFormation = state.formation): Vec2 {
  const focus = formation === "horses" ? state.horse : state.clientGuarded && state.client ? state.client : state.cart;
  const offsets = FORMATION_GUARD_OFFSETS[formation];
  const baseOffset = offsets[index % offsets.length];
  const offset = state.doctrineId === "goose-vanguard"
    ? { x: baseOffset.x + 28, y: baseOffset.y * .84 }
    : state.doctrineId === "iron-ring"
      ? { x: baseOffset.x - 12, y: baseOffset.y * .82 }
      : state.doctrineId === "crescent-snare"
        ? { x: baseOffset.x + 4, y: baseOffset.y * 1.18 }
        : baseOffset;
  const extraRank = Math.floor(index / offsets.length);
  const guard = state.guards[index];
  const disciplineShift = guard?.disciplineId === "vanguard" ? 26 : guard?.disciplineId === "bulwark" ? -22 : guard?.disciplineId === "responder" ? 8 : 0;
  return {
    x: Math.max(42, Math.min(914, focus.x + offset.x + disciplineShift - extraRank * 24)),
    y: Math.max(68, Math.min(472, focus.y + offset.y + (index % 2 === 0 ? -extraRank * 18 : extraRank * 18))),
  };
}

export function battleLeaderAnchor(state: BattleSimulation, formation: BattleFormation = state.formation): Vec2 {
  const xShift = state.doctrineId === "goose-vanguard" ? 28 : state.doctrineId === "iron-ring" ? -18 : 0;
  if (formation === "horses") return { x: Math.min(914, state.horse.x + 96 + xShift), y: Math.max(68, state.horse.y - 58) };
  if (formation === "hold") {
    const focus = state.clientGuarded && state.client ? state.client : state.cart;
    return { x: Math.min(914, focus.x + 92 + xShift), y: Math.max(68, focus.y - 72) };
  }
  return { x: Math.min(914, state.cart.x + 142 + xShift), y: state.cart.y - 10 };
}

function shoveFrom(origin: Vec2, target: Vec2, amount: number): void {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const length = Math.hypot(dx, dy) || 1;
  target.x += (dx / length) * amount;
  target.y += (dy / length) * amount;
}

function useTechnique(state: BattleSimulation): boolean {
  const martialArt = martialArtById(state.config.martialArtId);
  const proficiency = martialProficiencyTuning(martialArt.id, state.config.leader?.martialArtExperience ?? 0);
  const doctrineModifiers = battleDoctrine(state.doctrineId)?.modifiers ?? STANDARD_BATTLE_MODIFIERS;
  const leaderPower = state.player.power * (1 + leaderFormationBonus(state));
  const alive = state.enemies.filter((enemy) => enemy.hp > 0);
  let techniqueDamage = 0;
  if (martialArt.id === "guard-spear") {
    const targets = alive.filter((enemy) => distance(state.player, enemy) <= 148 + proficiency.techniqueRangeBonus);
    if (!targets.length) return false;
    for (const enemy of targets) {
      const amount = (enemy.type === "hooker" || enemy.type === "torch" || enemy.type === "boarder" ? 34 : 24) * leaderPower * proficiency.techniquePowerMultiplier;
      techniqueDamage += recordLeaderDamage(state, enemy, amount);
      emitCue(state, "technique", state.player, enemy, amount);
      enemy.stunned = Math.max(enemy.stunned, 0.65 + proficiency.controlBonus);
      shoveFrom(state.player, enemy, 82 + proficiency.controlBonus * 28);
    }
    state.message = `横枪拒马！震开 ${targets.length} 名近敌`;
  } else if (martialArt.id === "severing-sabre") {
    const threatOrder: Record<Enemy["type"], number> = { leader: 8, banner: 7, boarder: 6, hooker: 5, cutter: 5, torch: 4, archer: 2, raider: 1 };
    const target = alive
      .filter((enemy) => distance(state.player, enemy) <= 210 + proficiency.techniqueRangeBonus)
      .sort((a, b) => Number(b.carrier) * 12 - Number(a.carrier) * 12 || threatOrder[b.type] - threatOrder[a.type] || distance(state.player, a) - distance(state.player, b))[0];
    if (!target) return false;
    if (distance(state.player, target) > 42) moveToward(state.player, target, Math.min(72, distance(state.player, target) - 36));
    const specialist = target.carrier || target.type === "leader" || target.type === "hooker" || target.type === "boarder" || target.type === "cutter" || target.type === "torch";
    const amount = (specialist ? 76 * proficiency.specialistMultiplier : 54) * leaderPower * proficiency.techniquePowerMultiplier;
    techniqueDamage += recordLeaderDamage(state, target, amount);
    emitCue(state, "technique", state.player, target, amount);
    target.stunned = Math.max(target.stunned, 0.9);
    shoveFrom(state.player, target, 32);
    state.message = target.carrier ? `赶步断索！夺镖者已经中刀` : target.type === "leader" ? "赶步断旗！匪首号令已乱" : specialist ? "赶步断索！劫车能手已被截住" : "快刀赶步！截下最近追兵";
  } else {
    const targets = alive
      .filter((enemy) => distance(state.player, enemy) <= 88 + proficiency.techniqueRangeBonus)
      .sort((a, b) => distance(state.player, a) - distance(state.player, b))
      .slice(0, 4 + proficiency.extraTargets);
    if (!targets.length) return false;
    for (const enemy of targets) {
      const amount = 16 * leaderPower * proficiency.techniquePowerMultiplier;
      techniqueDamage += recordLeaderDamage(state, enemy, amount);
      emitCue(state, "technique", state.player, enemy, amount);
      enemy.stunned = Math.max(enemy.stunned, 4.2 + proficiency.controlBonus);
      shoveFrom(state.player, enemy, 18);
    }
    state.message = `锁腕卸械！制住 ${targets.length} 名近敌`;
  }
  const focus = coreCombatFocusTuning(state.config.leader?.coreCombatFocusId, state.config.leader?.coreCombatExperience ?? 0);
  state.techniqueCooldown = martialArt.techniqueCooldown * doctrineModifiers.techniqueCooldown * state.player.techniqueCooldownMultiplier * focus.techniqueCooldownMultiplier * proficiency.techniqueCooldownMultiplier;
  state.techniquePulse = 0.32;
  state.techniqueCount += 1;
  state.techniqueDamage += techniqueDamage;
  state.player.cooldown = Math.max(state.player.cooldown, 0.34);
  return true;
}

function applyFormationRally(state: BattleSimulation, message: string): void {
  const deputy = state.guards.find((guard) => guard.hp > 0 && guard.masteryId === "deputy-command");
  const commanded = deputy ? signalMastery(state, deputy) : false;
  state.rally = commanded ? 6 : 4;
  state.message = commanded ? `${deputy!.name}接令传旗：${message}` : message;
}

function updatePlayer(state: BattleSimulation, input: BattleInput, dt: number): void {
  const player = state.player;
  const martialArt = martialArtById(state.config.martialArtId);
  const proficiency = martialProficiencyTuning(martialArt.id, state.config.leader?.martialArtExperience ?? 0);
  player.cooldown -= dt;
  player.flash -= dt;
  player.attackPulse = Math.max(0, player.attackPulse - dt);
  state.techniqueCooldown = Math.max(0, state.techniqueCooldown - dt);
  const length = Math.hypot(input.x, input.y);
  const formationTrainingBonus = leaderFormationBonus(state);
  if (length > 0) {
    player.facingX = input.x / length;
    player.facingY = input.y / length;
    const speed = 188 * (battleDoctrine(state.doctrineId)?.modifiers.playerSpeed ?? 1) * state.player.movementMultiplier * (1 + formationTrainingBonus * .5);
    player.x += player.facingX * speed * dt;
    player.y += player.facingY * speed * dt;
  }
  player.x = Math.max(28, Math.min(925, player.x));
  player.y = Math.max(55, Math.min(485, player.y));

  if (input.formation && input.formation !== state.formation) {
    state.formation = input.formation;
    applyFormationRally(state, formationOrderMessage(state, input.formation));
  }

  if (input.technique && state.techniqueCooldown <= 0) {
    if (!useTechnique(state)) state.message = `${martialArt.technique}：敌手尚在招外`;
  }

  if (input.attack && player.cooldown <= 0) {
    player.cooldown = martialArt.attackCooldown * proficiency.attackCooldownMultiplier;
    state.attackPulse = 0.16;
    player.attackPulse = 0.24;
    for (const enemy of state.enemies) {
      if (enemy.hp <= 0 || distance(player, enemy) > martialArt.attackRange) continue;
      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      const dot = (dx * player.facingX + dy * player.facingY) / (Math.hypot(dx, dy) || 1);
      if (dot > -0.15) {
        const amount = martialArt.attackDamage * proficiency.attackDamageMultiplier * player.power * (1 + formationTrainingBonus) * battleMoraleModifier(state);
        const actual = recordLeaderDamage(state, enemy, amount);
        emitCue(state, "player-strike", player, enemy, amount);
        resolveCoreCombo(state, enemy, actual);
        enemy.x += player.facingX * martialArt.knockback;
        enemy.y += player.facingY * martialArt.knockback;
        if (martialArt.id === "binding-hands") enemy.stunned = Math.max(enemy.stunned, 0.5);
      }
    }
  }
  if (input.rally) {
    if (battleObjectiveMode(state.config) === "holdout") {
      state.formation = "hold";
      applyFormationRally(state, state.config.terrain === "river" ? "列阵！守住渡口与车轮" : "列阵！围车守到援手抵达");
    } else {
      state.formation = state.formation === "hold" ? "advance" : "hold";
      applyFormationRally(state, state.formation === "hold"
        ? "停阵！围住车轮"
        : battleObjectiveMode(state.config) === "gate-run" ? "起行！赶在城门落锁之前" : "起行！向关口推进");
    }
  }
  if (input.guardHorses) {
    state.formation = state.formation === "horses" ? baseFormation(state.config) : "horses";
    applyFormationRally(state, state.formation === "horses"
      ? "护马！斩缰手不得近前"
      : battleObjectiveMode(state.config) === "holdout" ? "收令！重新围车停阵" : "收令！重新护车前行");
  }
  if (input.retreat) state.outcome = "retreat";
}

function guardHasEquipmentTrait(guard: Guard, trait: NonNullable<EquipmentDefinition["battleTrait"]>): boolean {
  return guard.equipmentIds.some((equipmentId) => equipmentHasBattleTrait(equipmentId, trait));
}

function guardTraitEquipment(guard: Guard, trait: NonNullable<EquipmentDefinition["battleTrait"]>): EquipmentDefinition | undefined {
  const equipmentId = guard.equipmentIds.find((id) => equipmentHasBattleTrait(id, trait));
  return equipmentId ? EQUIPMENT[equipmentId] : undefined;
}

function guardTraitTuningLevel(guard: Guard, trait: NonNullable<EquipmentDefinition["battleTrait"]>): number {
  const equipmentId = guard.equipmentIds.find((id) => equipmentHasBattleTrait(id, trait));
  return equipmentId ? equipmentTuningLevel(guard.equipmentTuning[equipmentId]) : 0;
}

function guardTraitEquipmentName(guard: Guard, trait: NonNullable<EquipmentDefinition["battleTrait"]>, fallback: string): string {
  const equipment = guardTraitEquipment(guard, trait);
  return equipment ? equipmentDisplayName(equipment, guardTraitTuningLevel(guard, trait)) : fallback;
}

function tunedSupportCooldown(level: number): number {
  return 1 - equipmentTuningLevel(level) * .05;
}

function updateRescue(state: BattleSimulation, active: boolean, dt: number): void {
  const currentTarget = state.rescueTargetId ? state.guards.find((guard) => guard.id === state.rescueTargetId) : undefined;
  if (currentTarget && (currentTarget.hp > 0 || state.rescuedGuardIds.includes(currentTarget.id))) {
    state.rescueTargetId = null;
    state.rescueRescuerId = null;
    state.rescueProgress = 0;
  }
  if (!active) {
    state.rescueRescuerId = null;
    state.rescueProgress = Math.max(0, state.rescueProgress - 4 * dt);
    return;
  }

  const downed = state.guards.filter((guard) => guard.hp <= 0 && !state.rescuedGuardIds.includes(guard.id));
  if (!downed.length) {
    state.rescueTargetId = null;
    state.rescueRescuerId = null;
    state.rescueProgress = 0;
    return;
  }
  let target = currentTarget && currentTarget.hp <= 0 ? currentTarget : undefined;
  if (!target) {
    target = [...downed].sort((a, b) => distance(a, state.cart) - distance(b, state.cart))[0];
    state.rescueTargetId = target.id;
    state.rescueProgress = 0;
  }

  const living = state.guards.filter((guard) => guard.hp > 0 && guard.id !== target.id);
  const rescuer = [...living].sort((a, b) => {
    const aptitude = (guard: Guard) => guard.role === "医师" ? 72 : guardHasEquipmentTrait(guard, "medicine") ? 46 : 0;
    return distance(a, target!) - aptitude(a) - (distance(b, target!) - aptitude(b));
  })[0];
  if (!rescuer) {
    state.rescueRescuerId = null;
    state.rescueProgress = Math.max(0, state.rescueProgress - 3 * dt);
    state.message = "阵中已无人能腾手救援，只能先保住余众";
    return;
  }

  state.rescueRescuerId = rescuer.id;
  rescuer.supportKind = "rescue";
  rescuer.supportPulse = Math.max(rescuer.supportPulse, .28);
  faceToward(rescuer, target);
  if (distance(rescuer, target) > 38) {
    moveToward(rescuer, target, 118 * rescuer.movementMultiplier * dt);
    state.message = `${rescuer.name}脱离阵位，正赶去救回${target.name}`;
    return;
  }

  const hasMedicine = guardHasEquipmentTrait(rescuer, "medicine");
  const medicineTuning = hasMedicine ? guardTraitTuningLevel(rescuer, "medicine") : 0;
  const rescueRate = (rescuer.role === "医师" ? 36 : hasMedicine ? 30 : 22) * (1 + medicineTuning * .08) * Math.max(.9, Math.min(1.22, rescuer.power));
  state.rescueProgress = Math.min(100, state.rescueProgress + rescueRate * dt);
  state.rescuePulse = .26;
  target.flash = .16;
  if (state.rescueProgress < 100) {
    state.message = rescuer.role === "医师"
      ? `${rescuer.name}正在止血扶伤，掩护他完成救治！`
      : hasMedicine
        ? `${rescuer.name}取出金疮药，正把${target.name}拖回阵内`
        : `${rescuer.name}正把${target.name}拖回车阵，暂时无法迎敌`;
    return;
  }

  const recoveryRatio = rescuer.role === "医师" ? .28 : hasMedicine ? .22 : .14;
  target.hp = Math.max(12, Math.round(target.maxHp * recoveryRatio));
  target.flash = .3;
  target.cooldown = .8;
  state.rescuedGuardIds.push(target.id);
  recordGuardSupport(state, rescuer, target.hp);
  state.rally = Math.max(state.rally, 1.8);
  emitCue(state, "rescue", rescuer, target, target.hp, rescuer.role === "医师" ? "医师救人" : hasMedicine ? "金疮药救人" : "抬回阵中");
  state.message = `${rescuer.name}救回${target.name}，余众重新结阵！`;
  state.rescueTargetId = null;
  state.rescueRescuerId = null;
  state.rescueProgress = 0;
}

export function battleRepairAvailable(state: BattleSimulation): boolean {
  const charges = state.config.spareAxle ? 2 : 1;
  return state.cart.hp > 0
    && state.cart.hp < state.cart.maxHp * .84
    && state.repairCount < charges
    && state.guards.some((guard) => guard.hp > 0);
}

function updateRepair(state: BattleSimulation, active: boolean, dt: number): void {
  if (!active || !battleRepairAvailable(state)) {
    state.repairerId = null;
    state.repairProgress = Math.max(0, state.repairProgress - 5 * dt);
    return;
  }
  const repairAnchor = { x: state.cart.x - 22, y: state.cart.y + 54 };
  const repairer = state.guards
    .filter((guard) => guard.hp > 0 && guard.id !== state.rescueRescuerId)
    .sort((a, b) => {
      const aptitude = (guard: Guard) => (guard.role === "车把式" ? 82 : 0)
        + (guardHasEquipmentTrait(guard, "wheel-hook") ? 38 : 0)
        + (guard.masteryId === "driver-warden" ? 24 : 0);
      return distance(a, repairAnchor) - aptitude(a) - (distance(b, repairAnchor) - aptitude(b));
    })[0];
  if (!repairer) {
    state.repairerId = null;
    state.message = "阵中无人能腾手抢修，只能先护住断轴车架";
    return;
  }
  state.repairerId = repairer.id;
  repairer.supportKind = "repair";
  repairer.supportPulse = Math.max(repairer.supportPulse, .28);
  faceToward(repairer, state.cart);
  if (distance(repairer, repairAnchor) > 30) {
    moveToward(repairer, repairAnchor, 112 * repairer.movementMultiplier * dt);
    state.message = `${repairer.name}脱离阵位，正赶到车轴旁抢修`;
    return;
  }

  const hasWheelHook = guardHasEquipmentTrait(repairer, "wheel-hook");
  const spareMultiplier = state.config.spareAxle ? 1.28 : 1;
  const wheelTuning = hasWheelHook ? guardTraitTuningLevel(repairer, "wheel-hook") : 0;
  const repairRate = (20 + (repairer.role === "车把式" ? 14 : 0) + (hasWheelHook ? 6 + wheelTuning * 2 : 0)) * spareMultiplier * Math.max(.88, Math.min(1.2, repairer.power));
  state.repairProgress = Math.min(100, state.repairProgress + repairRate * dt);
  state.repairPulse = .24;
  state.cart.flash = .08;
  if (state.repairProgress < 100) {
    state.message = state.config.spareAxle
      ? `${repairer.name}正在换上备用车轴，须守住车尾！`
      : hasWheelHook
        ? `${repairer.name}以固轮挠钩撑住车架，正在紧榫复轴`
        : `${repairer.name}正在车下紧榫，暂时无法迎敌`;
    return;
  }

  const repairAmount = 28
    + (repairer.role === "车把式" ? 24 : 0)
    + (hasWheelHook ? 12 : 0)
    + (state.config.spareAxle ? 18 : 0);
  const restored = Math.min(repairAmount, state.cart.maxHp - state.cart.hp);
  state.cart.hp += restored;
  state.cartRepairTotal += restored;
  recordGuardSupport(state, repairer, restored);
  state.repairCount += 1;
  state.repairPulse = .9;
  state.rally = Math.max(state.rally, 1.6);
  emitCue(state, "repair", repairer, { ...state.cart, id: "cart" }, restored, state.config.spareAxle ? "备用车轴换毕" : hasWheelHook ? `${guardTraitEquipmentName(repairer, "wheel-hook", "固轮挠钩")}复轴` : "车架抢修");
  state.message = `${repairer.name}完成抢修，镖车恢复 ${Math.round(restored / state.cart.maxHp * 100)} 分车况！`;
  state.repairerId = null;
  state.repairProgress = 0;
}

export function battleVolleyTarget(state: BattleSimulation): Enemy | undefined {
  const shooters = state.guards.filter((guard) => guard.hp > 0 && guardHasEquipmentTrait(guard, "crossbow"));
  if (!shooters.length) return undefined;
  const alive = state.enemies.filter((enemy) => enemy.hp > 0 && (enemy.type !== "banner" || state.banner.captureProgress > 0 || state.banner.stolen));
  const archerCount = alive.filter((enemy) => enemy.type === "archer").length;
  const urgent = alive.filter((enemy) => {
    if (enemy.carrier || enemy.type === "leader") return true;
    if (enemy.type === "banner" && (state.banner.captureProgress > 0 || state.banner.stolen)) return true;
    if (enemy.type === "archer" && archerCount >= 2) return true;
    if ((enemy.type === "hooker" || enemy.type === "torch" || enemy.type === "boarder") && distance(enemy, state.cart) < 210) return true;
    if (enemy.type === "cutter" && distance(enemy, state.horse) < 195) return true;
    if (state.client && enemy.clientHunter && distance(enemy, state.client) < 275) return true;
    return false;
  }).filter((enemy) => shooters.some((shooter) => distance(shooter, enemy) <= 430));
  const priority: Record<Enemy["type"], number> = { leader: 260, banner: 245, boarder: 215, archer: 155, hooker: 175, cutter: 175, torch: 190, raider: 40 };
  return urgent.sort((a, b) => {
    const score = (enemy: Enemy) => priority[enemy.type]
      + (enemy.carrier ? 330 : 0)
      + (state.client && enemy.clientHunter ? 150 : 0)
      - Math.min(...shooters.map((shooter) => distance(shooter, enemy))) * .18;
    return score(b) - score(a);
  })[0];
}

export function battleVolleyAvailable(state: BattleSimulation): boolean {
  return state.volleyCooldown <= 0 && Boolean(battleVolleyTarget(state));
}

function updateVolley(state: BattleSimulation, active: boolean, dt: number): void {
  if (!active || !battleVolleyAvailable(state)) {
    state.volleyTargetId = null;
    state.volleyProgress = Math.max(0, state.volleyProgress - 18 * dt);
    return;
  }
  const target = battleVolleyTarget(state);
  const shooters = state.guards.filter((guard) => guard.hp > 0
    && guard.id !== state.rescueRescuerId
    && guard.id !== state.repairerId
    && guardHasEquipmentTrait(guard, "crossbow")
    && target
    && distance(guard, target) <= 430);
  if (!target || !shooters.length) {
    state.volleyTargetId = null;
    state.message = "持弩人手尚未取得射界，只能继续护阵";
    return;
  }
  state.volleyTargetId = target.id;
  const averagePower = shooters.reduce((sum, guard) => sum + guard.power, 0) / shooters.length;
  const averageSupportSpeed = shooters.reduce((sum, guard) => sum + 1 / guard.supportCooldownMultiplier, 0) / shooters.length;
  const chargeRate = (18 + shooters.length * 7) * Math.max(.82, Math.min(1.24, averagePower)) * Math.max(.86, Math.min(1.22, averageSupportSpeed));
  state.volleyProgress = Math.min(100, state.volleyProgress + chargeRate * dt);
  for (const shooter of shooters) {
    faceToward(shooter, target);
    shooter.supportPulse = Math.max(shooter.supportPulse, .3);
    shooter.supportKind = "volley";
  }
  state.message = `${shooters.map((guard) => guard.name).join("、")}正踏弩上弦，齐射锁住${target.type === "leader" ? state.config.enemyLeaderName ?? "匪首" : target.carrier ? "夺镖者" : "高危敌手"}`;
  if (state.volleyProgress < 100) return;

  let totalDamage = 0;
  emitCue(state, "volley", shooters[0], target, 0, "弩阵齐发");
  for (const shooter of shooters) {
    const tuning = guardTraitTuningLevel(shooter, "crossbow");
    const amount = 30 * shooter.power * (1 + tuning * .06) * battleMoraleModifier(state);
    totalDamage += recordGuardDamage(state, shooter, target, amount);
    emitCue(state, "bolt", shooter, target, amount, `${guardTraitEquipmentName(shooter, "crossbow", "近阵强弩")}齐射`);
    shooter.attackPulse = .42;
    shooter.cooldown = Math.max(shooter.cooldown, .6);
    shooter.supportCooldown = 6.4 * tunedSupportCooldown(tuning) * shooter.supportCooldownMultiplier;
    shooter.supportPulse = .9;
    shooter.supportKind = "volley";
  }
  target.stunned = Math.max(target.stunned, .72);
  state.volleyTargetId = null;
  state.volleyProgress = 0;
  state.volleyPulse = .9;
  state.volleyCooldown = 9.5;
  state.volleyCount += 1;
  state.rally = Math.max(state.rally, .8);
  state.message = `弩阵齐发，${target.type === "leader" ? state.config.enemyLeaderName ?? "匪首" : target.carrier ? "夺镖者" : "高危敌手"}受创 ${Math.round(totalDamage)}！`;
}

function updateClient(state: BattleSimulation, dt: number): void {
  const client = state.client;
  if (!client || client.hp <= 0) return;
  client.flash = Math.max(0, client.flash - dt);
  client.attackPulse = Math.max(0, client.attackPulse - dt);
  client.panic = Math.max(0, client.panic - dt);
  const threats = state.enemies
    .filter((enemy) => enemy.hp > 0 && (enemy.clientHunter || distance(enemy, client) < 118))
    .sort((a, b) => distance(client, a) - distance(client, b));
  const nearest = threats[0];
  const anchor = state.clientGuarded
    ? { x: state.cart.x - 42, y: state.cart.y + 28 }
    : { x: state.cart.x - 28, y: state.cart.y + 72 };
  if (nearest && distance(client, nearest) < 92) {
    const dx = client.x - nearest.x;
    const dy = client.y - nearest.y;
    const length = Math.hypot(dx, dy) || 1;
    const escape = {
      x: Math.max(state.cart.x - 124, Math.min(state.cart.x + 42, client.x + dx / length * 76)),
      y: Math.max(82, Math.min(462, client.y + dy / length * 76)),
    };
    moveToward(client, escape, (state.clientGuarded ? 72 : 92) * dt);
    client.panic = .42;
    state.message = state.clientGuarded ? `${client.name}已收进阵心，镖师正在截住劫人者` : `${client.name}遭人直逼，须立刻下令护住活镖！`;
  } else if (distance(client, anchor) > 18) {
    moveToward(client, anchor, (state.clientGuarded ? 88 : 72) * dt);
  } else faceToward(client, { x: state.cart.x + 90, y: state.cart.y });
  client.x = Math.max(36, Math.min(914, client.x));
  client.y = Math.max(72, Math.min(468, client.y));
}

function signalMastery(state: BattleSimulation, guard: Guard, target: (Fighter | Vec2) & { id?: string } = guard, kind: "mastery" | "revive" = "mastery", amount = 0): boolean {
  if (!guard.masteryName || guard.masteryCooldown > 0) return false;
  guard.masteryPulse = kind === "revive" ? 1.2 : .92;
  guard.masteryCooldown = 8;
  guard.supportPulse = Math.max(guard.supportPulse, kind === "revive" ? 1.1 : .72);
  guard.supportKind = "mastery";
  emitCue(state, kind, guard, target, amount, guard.masteryName);
  return true;
}

function resolveOpeningMasteries(state: BattleSimulation): void {
  if (state.openingMasteriesResolved) return;
  state.openingMasteriesResolved = true;
  const guide = state.guards.find((guard) => guard.hp > 0 && guard.masteryId === "guide-foresight");
  if (!guide) return;
  for (const enemy of state.enemies) {
    enemy.stunned = Math.max(enemy.stunned, .9);
    enemy.cooldown += .65;
  }
  guide.masteryResolved = true;
  recordGuardSupport(state, guide, 14);
  signalMastery(state, guide);
  state.message = `${guide.name}先声辨伏，群敌第一轮失了先手`;
}

function useGuardMastery(state: BattleSimulation, guard: Guard): boolean {
  if (guard.masteryId === "medic-revival" && !guard.masteryResolved && state.elapsed > 2.8) {
    const patient = state.guards.find((other) => other !== guard && other.hp <= 0);
    if (patient) {
      patient.hp = Math.max(12, Math.round(patient.maxHp * .18));
      patient.flash = .18;
      guard.masteryResolved = true;
      recordGuardSupport(state, guard, patient.hp);
      signalMastery(state, guard, patient, "revive", patient.hp);
      state.message = `${guard.name}施展阵前回生，救回倒地的${patient.name}`;
      return true;
    }
  }
  if (guard.masteryId === "cook-heart" && !guard.masteryResolved && state.elapsed > 3.5) {
    const living = [state.player, ...state.guards].filter((fighter) => fighter.hp > 0);
    const critical = living.some((fighter) => fighter.hp / fighter.maxHp <= .45);
    if (critical) {
      const restored = living.reduce((total, fighter) => {
        const before = fighter.hp;
        fighter.hp = Math.min(fighter.maxHp, fighter.hp + 6);
        return total + fighter.hp - before;
      }, 0);
      guard.masteryResolved = true;
      recordGuardSupport(state, guard, restored);
      state.rally = Math.max(state.rally, 2.2);
      signalMastery(state, guard);
      state.message = `${guard.name}安众定心，阵中众人缓回一口气`;
      return true;
    }
  }
  return false;
}

function useGuardEquipmentSupport(state: BattleSimulation, guard: Guard, aliveEnemies: Enemy[]): boolean {
  if (guard.supportCooldown > 0) return false;
  if (guardHasEquipmentTrait(guard, "crossbow")) {
    const priority: Record<Enemy["type"], number> = { leader: 9, banner: 8, boarder: 8, hooker: 7, cutter: 7, torch: 6, archer: 5, raider: 2 };
    const target = aliveEnemies
      .filter((enemy) => enemy.hp > 0 && distance(guard, enemy) <= 360)
      .sort((a, b) => Number(b.carrier) * 12 - Number(a.carrier) * 12 || priority[b.type] - priority[a.type] || distance(guard, a) - distance(guard, b))[0];
    if (target) {
      const tuning = guardTraitTuningLevel(guard, "crossbow");
      const amount = 28 * guard.power * (1 + tuning * .06) * battleMoraleModifier(state);
      faceToward(guard, target);
      recordGuardDamage(state, guard, target, amount);
      emitCue(state, "bolt", guard, target, amount, guardTraitEquipmentName(guard, "crossbow", "近阵强弩"));
      guard.attackPulse = .42;
      guard.cooldown = Math.max(guard.cooldown, .48);
      guard.supportCooldown = 5.4 * tunedSupportCooldown(tuning) * guard.supportCooldownMultiplier;
      guard.supportPulse = .68;
      guard.supportKind = "crossbow";
      state.message = `${guard.name}踏弩点杀，截住一名高危敌手`;
      return true;
    }
  }
  if (guardHasEquipmentTrait(guard, "medicine") && state.elapsed > 3) {
    const patients: Array<Combatant | Guard | BattleClient> = [state.player, ...state.guards, ...(state.client ? [state.client] : [])]
      .filter((fighter) => fighter.hp > 0 && fighter.hp < fighter.maxHp - 3)
      .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
    const patient = patients[0];
    if (patient && patient.hp / patient.maxHp <= .78) {
      const tuning = guardTraitTuningLevel(guard, "medicine");
      const amount = Math.min(12 + tuning * 2, patient.maxHp - patient.hp);
      patient.hp += amount;
      recordGuardSupport(state, guard, amount);
      emitCue(state, "heal", guard, patient, amount, guardTraitEquipmentName(guard, "medicine", "金疮药"));
      guard.supportCooldown = 8.4 * tunedSupportCooldown(tuning) * guard.supportCooldownMultiplier;
      guard.supportPulse = .9;
      guard.supportKind = "medicine";
      state.message = `${guard.name}就阵裹伤，为${patient.id === "player" ? "镖头" : (patient as Guard | BattleClient).name}稳住伤势`;
      return true;
    }
  }
  return false;
}

function updateGuards(state: BattleSimulation, dt: number): void {
  const aliveEnemies = state.enemies.filter((enemy) => enemy.hp > 0 && (enemy.type !== "banner" || state.banner.captureProgress > 0 || state.banner.stolen));
  const doctrineModifiers = battleDoctrine(state.doctrineId)?.modifiers ?? STANDARD_BATTLE_MODIFIERS;
  for (let index = 0; index < state.guards.length; index += 1) {
    const guard = state.guards[index];
    if (guard.hp <= 0) continue;
    guard.cooldown -= dt;
    guard.flash -= dt;
    guard.attackPulse = Math.max(0, guard.attackPulse - dt);
    guard.supportCooldown = Math.max(0, guard.supportCooldown - dt);
    guard.supportPulse = Math.max(0, guard.supportPulse - dt);
    guard.masteryPulse = Math.max(0, guard.masteryPulse - dt);
    guard.masteryCooldown = Math.max(0, guard.masteryCooldown - dt);
    if (guard.supportPulse <= 0) guard.supportKind = null;
    if (guard.id === state.rescueRescuerId || guard.id === state.repairerId || (state.volleyTargetId && guardHasEquipmentTrait(guard, "crossbow"))) continue;
    if (useGuardMastery(state, guard)) continue;
    if (useGuardEquipmentSupport(state, guard, aliveEnemies)) continue;
    const closest = [...aliveEnemies].sort((a, b) => {
      if (state.clientGuarded && a.clientHunter !== b.clientHunter) return a.clientHunter ? -1 : 1;
      const bannerUrgent = state.banner.stolen || state.banner.captureProgress > 0;
      const bannerTarget = (enemy: Enemy) => state.banner.stolen ? enemy.id === state.banner.carrierId : enemy.type === "banner";
      if (bannerUrgent && state.formation !== "horses" && bannerTarget(a) !== bannerTarget(b)) return bannerTarget(a) ? -1 : 1;
      if (!bannerUrgent && a.type !== b.type && (a.type === "banner" || b.type === "banner")) return a.type === "banner" ? 1 : -1;
      if (guard.masteryId === "clerk-reader") {
        const specialist = (enemy: Enemy) => enemy.type === "leader" || enemy.type === "banner" || enemy.type === "boarder" || enemy.type === "hooker" || enemy.type === "cutter" || enemy.type === "torch";
        if (specialist(a) !== specialist(b)) return specialist(a) ? -1 : 1;
      }
      if (battleObjectiveMode(state.config) === "pursuit" && state.formation === "advance" && a.carrier !== b.carrier) return a.carrier ? -1 : 1;
      if (state.formation === "horses" && a.type !== b.type) {
        if (a.type === "cutter") return -1;
        if (b.type === "cutter") return 1;
      }
      if (state.formation === "hold" && a.type !== b.type) {
        if (a.type === "torch" || a.type === "hooker" || a.type === "boarder") return -1;
        if (b.type === "torch" || b.type === "hooker" || b.type === "boarder") return 1;
      }
      const focus = state.formation === "horses" ? state.horse : state.cart;
      return distance(focus, a) - distance(focus, b);
    })[0];
    const anchor = battleGuardAnchor(state, index);
    const focus = state.formation === "horses" ? state.horse : state.clientGuarded && state.client ? state.client : state.cart;
    const masteryPursuit = guard.masteryId === "runner-pursuit" && Boolean(closest?.carrier || closest?.id === state.banner.carrierId);
    const bannerPursuit = state.formation === "advance" && state.banner.stolen && closest?.id === state.banner.carrierId;
    const formationTrainingBonus = formationProficiencyRank(guard.formationExperience[state.formation]).bonus;
    const pursuitRange = (battleObjectiveMode(state.config) === "pursuit" && state.formation === "advance" ? 430 : bannerPursuit ? 435 : 125) + guard.engageRangeBonus + (masteryPursuit ? 90 : 0);
    const focusRange = state.clientGuarded ? 250 : state.formation === "hold" ? 205 : battleObjectiveMode(state.config) === "pursuit" || bannerPursuit ? 520 : 170;
    if (closest && distance(closest, focus) < focusRange && distance(guard, closest) < pursuitRange) {
      if (distance(guard, closest) > 46) moveToward(guard, closest, (state.rally > 0 ? 128 : 105) * guard.movementMultiplier * doctrineModifiers.guardSpeed * (1 + formationTrainingBonus * .5) * (masteryPursuit ? 1.25 : bannerPursuit ? 1.15 : 1) * dt);
      else if (guard.cooldown <= 0) {
        const equipmentFormationBonus = state.formation === "horses" ? guard.horseGuardBonus : state.formation === "hold" ? guard.cartGuardBonus : 0;
        const amount = (state.rally > 0 ? 25 : 18) * guard.power * (1 + equipmentFormationBonus + formationTrainingBonus) * doctrineModifiers.guardDamage * battleMoraleModifier(state);
        faceToward(guard, closest);
        if (masteryPursuit && signalMastery(state, guard, closest)) state.message = `${guard.name}穿阵飞脚，抢到夺镖者身前`;
        if (guard.masteryId === "clerk-reader" && (closest.type === "leader" || closest.type === "banner" || closest.type === "boarder" || closest.type === "hooker" || closest.type === "cutter" || closest.type === "torch") && signalMastery(state, guard, closest)) state.message = `${guard.name}辨出凶手路数，催阵先截专手`;
        const targetHpBeforeStrike = closest.hp;
        recordGuardDamage(state, guard, closest, amount);
        if (doctrineModifiers.guardStun > 0) closest.stunned = Math.max(closest.stunned, doctrineModifiers.guardStun);
        let cueKind: BattleCueKind = "guard-strike";
        let cueLabel: string | undefined;
        if (state.formation === "horses" && guardHasEquipmentTrait(guard, "horse-hook")) {
          cueKind = "brace";
          cueLabel = guardTraitEquipmentName(guard, "horse-hook", "护马钩镰");
          guard.supportKind = "horse-hook";
          closest.stunned = Math.max(closest.stunned, .3 + guardTraitTuningLevel(guard, "horse-hook") * .04);
        } else if (state.formation === "hold" && guardHasEquipmentTrait(guard, "wheel-hook")) {
          cueKind = "brace";
          cueLabel = guardTraitEquipmentName(guard, "wheel-hook", "固轮挠钩");
          guard.supportKind = "wheel-hook";
          closest.stunned = Math.max(closest.stunned, .3 + guardTraitTuningLevel(guard, "wheel-hook") * .04);
        } else if (state.formation === "hold" && guardHasEquipmentTrait(guard, "shield")) {
          cueKind = "brace";
          cueLabel = `${guardTraitEquipmentName(guard, "shield", "坚牌")}护阵`;
          guard.supportKind = "shield";
          closest.stunned = Math.max(closest.stunned, .16 + guardTraitTuningLevel(guard, "shield") * .04);
        }
        if (cueKind === "brace") guard.supportPulse = .52;
        emitCue(state, cueKind, guard, closest, amount, cueLabel);
        resolveGuardCoordination(state, guard, closest, amount, targetHpBeforeStrike);
        guard.attackPulse = .24;
        guard.cooldown = state.rally > 0 ? 0.58 : 0.8;
      }
    } else {
      moveToward(guard, anchor, 110 * guard.movementMultiplier * doctrineModifiers.guardSpeed * dt);
    }
  }
}

type EnemyAttackTarget = Combatant | Guard | BattleHorse | BattleClient | (BattleSimulation["cart"] & { maxHp: number });

export function enemyAttackWindupDuration(type: Enemy["type"]): number {
  if (type === "leader") return 1.2;
  if (type === "torch") return 1.05;
  if (type === "archer") return .9;
  if (type === "hooker") return .85;
  if (type === "boarder") return .82;
  if (type === "cutter") return .7;
  return .5;
}

function enemyAttackRange(type: Enemy["type"]): number {
  if (type === "leader") return 72;
  if (type === "archer") return 235;
  if (type === "hooker") return 52;
  if (type === "boarder") return 48;
  if (type === "torch") return 44;
  if (type === "cutter") return 38;
  return 40;
}

function enemyAttackTargetId(state: BattleSimulation, target: EnemyAttackTarget): string {
  if (target === state.cart) return "cart";
  return "id" in target ? target.id : "cart";
}

function enemyAttackTargetById(state: BattleSimulation, targetId: string | null): EnemyAttackTarget | null {
  if (!targetId) return null;
  if (targetId === "cart") return state.cart;
  if (targetId === state.player.id) return state.player;
  if (targetId === state.horse.id) return state.horse;
  if (targetId === state.client?.id) return state.client;
  return state.guards.find((guard) => guard.id === targetId) ?? null;
}

function enemyAttackTargetAlive(target: EnemyAttackTarget | null): target is EnemyAttackTarget {
  return Boolean(target && target.hp > 0);
}

function enemyAttackAction(type: Enemy["type"], boarded = false): string {
  if (type === "leader") return "踏阵挑战";
  if (type === "archer") return "攒弓欲射";
  if (type === "hooker") return "抡索拖货";
  if (type === "boarder") return boarded ? "撬封夺货" : "翻篷攀车";
  if (type === "cutter") return "伏身斩缰";
  if (type === "torch") return "引火掷车";
  return "举刃扑杀";
}

function enemyAttackActor(type: Enemy["type"]): string {
  if (type === "leader") return "匪首";
  if (type === "archer") return "弓手";
  if (type === "hooker") return "钩索手";
  if (type === "boarder") return "攀车者";
  if (type === "cutter") return "斩缰手";
  if (type === "torch") return "火手";
  return "敌手";
}

function enemyAttackTargetLabel(state: BattleSimulation, targetId: string): string {
  if (targetId === "cart") return "镖车";
  if (targetId === state.horse.id) return "马匹";
  if (targetId === state.player.id) return state.player.name;
  if (targetId === state.client?.id) return state.client.name;
  return state.guards.find((guard) => guard.id === targetId)?.name ?? "阵中人手";
}

export function battleAttackIntents(state: BattleSimulation): BattleAttackIntent[] {
  const intents: BattleAttackIntent[] = [];
  for (const enemy of state.enemies) {
    if (enemy.hp <= 0 || enemy.attackWindup <= 0 || !enemy.attackTargetId) continue;
    const target = enemyAttackTargetById(state, enemy.attackTargetId);
    if (!enemyAttackTargetAlive(target)) continue;
    const targetId = enemy.attackTargetId;
    const recommendedStrategy: BattleAttackIntent["recommendedStrategy"] = targetId === "cart"
      ? "guard-cart"
      : targetId === state.horse.id
        ? "guard-horses"
        : targetId === state.client?.id
          ? "guard-client"
          : "breakthrough";
    const tone: BattleAttackIntent["tone"] = targetId === state.horse.id
      ? "horse"
      : targetId === "cart" || targetId === state.client?.id
        ? "cart"
        : enemy.type === "archer"
          ? "ranged"
          : "command";
    const advice = recommendedStrategy === "guard-cart"
      ? "围车可卸去冲力"
      : recommendedStrategy === "guard-horses"
        ? "护马可挡斩缰"
        : recommendedStrategy === "guard-client"
          ? "收阵优先截劫"
          : "开路压近可打断";
    intents.push({
      enemyId: enemy.id,
      enemyType: enemy.type,
      targetId,
      targetLabel: enemyAttackTargetLabel(state, targetId),
      actionLabel: enemyAttackAction(enemy.type, enemy.boarded),
      fromX: enemy.x,
      fromY: enemy.y,
      toX: target.x,
      toY: target.y,
      progress: Math.max(0, Math.min(1, 1 - enemy.attackWindup / Math.max(.01, enemy.attackWindupDuration))),
      remaining: enemy.attackWindup,
      tone,
      recommendedStrategy,
      advice,
    });
  }
  return intents.sort((a, b) => {
    const aCritical = a.targetId === "cart" || a.targetId === state.horse.id || a.targetId === state.client?.id ? 1 : 0;
    const bCritical = b.targetId === "cart" || b.targetId === state.horse.id || b.targetId === state.client?.id ? 1 : 0;
    return bCritical - aCritical || a.remaining - b.remaining;
  });
}

export function battleIntentReadiness(
  state: BattleSimulation,
  intent: BattleAttackIntent,
  activeStrategy: BattleStrategy,
  pendingStrategy: BattleStrategy | null = null,
): BattleIntentReadiness {
  const covered = intent.targetId === "cart"
    ? state.formation === "hold"
    : intent.targetId === state.horse.id
      ? state.formation === "horses"
      : intent.targetId === state.client?.id
        ? state.clientGuarded
        : activeStrategy === "breakthrough";
  if (covered) return "covered";
  if (pendingStrategy === intent.recommendedStrategy) return "relaying";
  return "uncovered";
}

function nearbyConvoyProtection(state: BattleSimulation, target: Vec2): number {
  const protectors = state.guards.filter((guard) => guard.hp > 0 && guard.convoyProtection < 1 && distance(guard, target) <= 145);
  const protection = protectors
    .reduce((value, guard) => value * guard.convoyProtection, 1);
  const trainedFormation: BattleFormationId = target === state.horse ? "horses" : "hold";
  const formationProtection = state.formation === trainedFormation
    ? 1 - Math.min(.18, state.guards
      .filter((guard) => guard.hp > 0 && distance(guard, target) <= 165)
      .reduce((sum, guard) => sum + formationProficiencyRank(guard.formationExperience[trainedFormation]).bonus * .55, 0))
    : 1;
  const keeper = protectors.find((guard) => guard.masteryId === "driver-warden");
  const targetId = target === state.horse ? state.horse.id : target === state.client ? state.client.id : "cart";
  if (keeper && signalMastery(state, keeper, { ...target, id: targetId })) {
    state.message = `${keeper.name}贴辙护车，替车马卸去一分冲力`;
  }
  return Math.max(.68, protection * formationProtection);
}

function leaderCounterDeputy(state: BattleSimulation): Guard | undefined {
  return state.guards.find((guard) => (
    guard.role === "副镖头"
    && guard.hp > 0
    && guard.id !== state.rescueRescuerId
    && guard.id !== state.repairerId
    && distance(guard, state.player) <= 420
  ));
}

function boarderCounterGuard(state: BattleSimulation): Guard | undefined {
  return state.guards
    .filter((guard) => guard.hp > 0 && guard.id !== state.rescueRescuerId && guard.id !== state.repairerId)
    .filter((guard) => distance(guard, state.cart) <= 225)
    .sort((a, b) => {
      const score = (guard: Guard) => Number(guard.role === "车把式") * 3 + Number(guardHasEquipmentTrait(guard, "wheel-hook")) * 2 + guard.cartGuardBonus;
      return score(b) - score(a) || distance(a, state.cart) - distance(b, state.cart);
    })[0];
}

function resolveBoarderCounterSupport(state: BattleSimulation, enemy: Enemy): { guard: Guard; damage: number; label: string } | null {
  const guard = boarderCounterGuard(state);
  if (!guard) return null;
  const hasWheelHook = guardHasEquipmentTrait(guard, "wheel-hook");
  const tuning = hasWheelHook ? guardTraitTuningLevel(guard, "wheel-hook") : 0;
  const label = hasWheelHook ? `${guardTraitEquipmentName(guard, "wheel-hook", "固轮挠钩")}掀贼` : "车把式掀贼";
  const damageAmount = (hasWheelHook ? 11 + tuning * 2 : 8) * guard.power * battleMoraleModifier(state);
  const damageDone = recordGuardDamage(state, guard, enemy, damageAmount);
  faceToward(guard, enemy);
  guard.attackPulse = Math.max(guard.attackPulse, .36);
  guard.cooldown = Math.max(guard.cooldown, .55);
  guard.supportPulse = Math.max(guard.supportPulse, .9);
  guard.supportKind = "wheel-hook";
  enemy.stunned = Math.max(enemy.stunned, 1.08 + tuning * .08);
  recordGuardSupport(state, guard, Math.max(4, damageDone * .65));
  emitCue(state, "brace", guard, enemy, damageDone, label);
  return { guard, damage: damageDone, label };
}

function criticalDefenseResolution(state: BattleSimulation, enemy: Enemy, target: EnemyAttackTarget): { countered: boolean; counterTitle: string; breachTitle: string; targetId: string; targetLabel: string; deputy?: Guard } | null {
  if (target === state.player && enemy.type === "leader") {
    const countered = state.activeStrategy === "breakthrough";
    const deputy = countered ? leaderCounterDeputy(state) : undefined;
    const coreCounterTitle = state.config.leader?.coreCombatFocusId === "cross-guard"
      ? "交锋截阵"
      : state.config.leader?.coreCombatFocusId === "leader-hunt" ? "夺魁回锋" : "主副截锋";
    return {
      countered,
      counterTitle: deputy ? coreCounterTitle : "迎锋破势",
      breachTitle: "逼战失应",
      targetId: state.player.id,
      targetLabel: state.player.name,
      deputy,
    };
  }
  if (target === state.client && state.client) return {
    countered: state.clientGuarded,
    counterTitle: "近卫截劫",
    breachTitle: "活镖失护",
    targetId: state.client.id,
    targetLabel: state.client.name,
  };
  if (target === state.horse) return {
    countered: state.formation === "horses",
    counterTitle: "护马卸刀",
    breachTitle: "马前失位",
    targetId: state.horse.id,
    targetLabel: "马匹",
  };
  if (target === state.cart) return {
    countered: state.formation === "hold",
    counterTitle: enemy.type === "boarder" ? enemy.boarded ? "封口截手" : "围车掀贼" : "围车卸力",
    breachTitle: enemy.type === "boarder" ? enemy.boarded ? "货封被撬" : "车尾失守" : "车阵被破",
    targetId: "cart",
    targetLabel: "镖车",
  };
  return null;
}

function updateBannerRaider(state: BattleSimulation, enemy: Enemy, dt: number): boolean {
  if (enemy.type !== "banner") return false;
  const banner = state.banner;
  if (banner.lost) return true;
  if (banner.stolen && banner.carrierId === enemy.id) {
    moveToward(enemy, { x: 942, y: enemy.y }, 94 * dt);
    banner.x = enemy.x - 8;
    banner.y = enemy.y - 34;
    if (enemy.x >= 925) {
      banner.lost = true;
      banner.flash = 1;
      enemy.hp = 0;
      emitCue(state, "banner-lost", enemy, banner, 0, "镖旗失守");
      state.message = "夺旗手逃出阵外，风云行镖旗失守！";
    }
    return true;
  }

  const target = { x: banner.x, y: banner.y + 28 };
  const targetDistance = distance(enemy, target);
  if (targetDistance > 34) {
    moveToward(enemy, target, 132 * dt);
    return true;
  }
  faceToward(enemy, target);
  enemy.attackPulse = Math.max(enemy.attackPulse, .24);
  banner.contested = true;
  banner.flash = .18;
  const holdCover = state.formation === "hold" ? .48 : state.formation === "horses" ? .82 : 1;
  banner.captureProgress = Math.min(100, banner.captureProgress + 66 * holdCover * dt);
  if (banner.captureProgress >= 100) {
    banner.stolen = true;
    banner.carrierId = enemy.id;
    banner.flash = 1;
    state.morale = Math.max(0, state.morale - 22);
    emitCue(state, "banner-grab", enemy, banner, 0, "夺旗手得旗");
    state.message = "夺旗手拔走镖旗！强行开路可追旗，围车则先保人货";
  } else if (banner.captureProgress >= 55) {
    state.message = "夺旗手正在拔旗，围车可压住他的手脚！";
  }
  return true;
}

function resolveBannerAfterCombat(state: BattleSimulation, dt: number): void {
  const banner = state.banner;
  if (!banner.contested && !banner.stolen && !banner.lost) banner.captureProgress = Math.max(0, banner.captureProgress - 7 * dt);
  if (!banner.carrierId || banner.lost) return;
  const carrier = state.enemies.find((enemy) => enemy.id === banner.carrierId);
  if (!carrier || carrier.hp > 0) return;
  banner.stolen = false;
  banner.recovered = true;
  banner.carrierId = null;
  banner.captureProgress = 0;
  banner.flash = 1;
  banner.x = state.cart.x + 42;
  banner.y = state.cart.y - 60;
  state.morale = Math.min(100, state.morale + 12);
  emitCue(state, "banner-recover", carrier ?? banner, banner, 0, "夺旗复得");
  state.message = "夺旗手伏诛，众人重新把镖旗立回车前！";
}

function resolveEnemyAttack(state: BattleSimulation, enemy: Enemy, target: EnemyAttackTarget): void {
  const doctrineModifiers = battleDoctrine(state.doctrineId)?.modifiers ?? STANDARD_BATTLE_MODIFIERS;
  const boarderWasAttached = enemy.type === "boarder" && enemy.boarded;
  const attackAction = enemyAttackAction(enemy.type, boarderWasAttached);
  const baseDamage = (enemy.type === "leader" ? 16 : enemy.type === "archer" ? 5 : enemy.type === "cutter" ? 9 : enemy.type === "torch" ? 7 : enemy.type === "boarder" ? 5.5 : 6) * (enemy.rallied > 0 ? 1.25 : 1);
  const cueKind: BattleCueKind = enemy.type === "archer" ? "arrow" : enemy.type === "hooker" || enemy.type === "boarder" ? "hook" : enemy.type === "torch" ? "torch" : "enemy-strike";
  const defense = criticalDefenseResolution(state, enemy, target);
  const coreCounterTuning = defense?.deputy
    ? battleCoreCounterTuning(state.player.experience, guardExperience(state, defense.deputy.id), state.config.leader?.deputyBond ?? 0, state.config.leader?.coreCombatFocusId, state.config.leader?.coreCombatExperience ?? 0)
    : null;
  const coreCounterShieldTuning = defense?.deputy && guardHasEquipmentTrait(defense.deputy, "shield")
    ? guardTraitTuningLevel(defense.deputy, "shield")
    : null;
  const coreCounterEquipmentMultiplier = coreCounterShieldTuning === null ? 1 : .88 - coreCounterShieldTuning * .025;
  let resolvedDamage = 0;
  let counterDamage = 0;
  let boarderSupport: { guard: Guard; damage: number; label: string } | null = null;
  faceToward(enemy, target);
  enemy.attackPulse = enemy.type === "leader" ? .5 : enemy.type === "archer" ? .42 : enemy.type === "torch" ? .38 : .28;
  if (target === state.client && state.client) {
    const formationCover = state.clientGuarded ? .38 : state.formation === "hold" ? .76 : 1;
    const disciplineCover = nearbyConvoyProtection(state, state.client);
    const amount = baseDamage * formationCover * disciplineCover * doctrineModifiers.convoyDamage;
    resolvedDamage = amount;
    damage(state.client, amount);
    state.client.panic = .85;
    emitCue(state, cueKind, enemy, state.client, amount, "劫人");
    state.message = state.clientGuarded
      ? `${state.client.name}藏在护卫阵心，劫人者未能近身`
      : `${state.client.name}被劫人者击伤！下令护住活镖可大幅减伤`;
  } else if (target === state.horse) {
    const formationCover = state.formation === "horses" ? 0.48 : 1;
    const disciplineCover = nearbyConvoyProtection(state, state.horse);
    const amount = baseDamage * (state.config.horseProtection ?? 1) * formationCover * disciplineCover * doctrineModifiers.convoyDamage;
    resolvedDamage = amount;
    damage(state.horse, amount);
    emitCue(state, cueKind, enemy, state.horse, amount);
    if (enemy.type === "cutter") {
      state.horse.tetherCut = true;
      state.message = state.formation === "horses" ? "护马阵挡住一记割缰刀" : "斩缰手已经割上挽具！";
    } else state.message = "弓手正在攒射马匹！";
  } else if (target !== state.cart && "id" in target) {
    const guardTarget = state.guards.find((guard) => guard.id === target.id);
    const amount = target === state.player
      ? baseDamage * state.player.armorMultiplier * (defense?.countered ? (coreCounterTuning?.incomingMultiplier ?? .42) * coreCounterEquipmentMultiplier : 1)
      : guardTarget ? baseDamage * guardTarget.armorMultiplier : baseDamage;
    resolvedDamage = amount;
    damage(target, amount);
    emitCue(state, cueKind, enemy, target, amount);
  } else {
    const holdCover = state.formation === "hold" ? 0.68 : 1;
    const disciplineCover = nearbyConvoyProtection(state, state.cart);
    const specialistCartDamage = enemy.type === "boarder" ? boarderWasAttached ? 4.2 : 2.2 : enemy.type === "archer" ? 3 : enemy.type === "hooker" ? 4 : enemy.type === "torch" ? 5 : 3.5;
    const cartDamage = specialistCartDamage * (state.config.cartArmor ?? 1) * holdCover * disciplineCover * doctrineModifiers.convoyDamage;
    resolvedDamage = cartDamage;
    state.cart.hp = Math.max(0, state.cart.hp - cartDamage);
    state.cart.flash = .18;
    emitCue(state, cueKind, enemy, { ...state.cart, id: "cart" }, cartDamage);
    if (enemy.type === "hooker") state.cart.cargo = Math.max(0, state.cart.cargo - 0.8 * (state.config.cargoProtection ?? 1) * disciplineCover * doctrineModifiers.convoyDamage);
    if (enemy.type === "boarder" && !defense?.countered) {
      const cargoDamage = (boarderWasAttached ? 4.8 : .45) * (state.config.cargoProtection ?? 1) * disciplineCover * doctrineModifiers.convoyDamage;
      state.cart.cargo = Math.max(0, state.cart.cargo - cargoDamage);
    }
    if (enemy.type === "torch") {
      state.cart.cargo = Math.max(0, state.cart.cargo - 1.6 * (state.config.cargoProtection ?? 1) * holdCover * disciplineCover * doctrineModifiers.convoyDamage);
      state.message = state.formation === "hold" ? "停阵挡住火手，快将他逼退！" : "火手已经贴近车篷！";
    }
  }
  if (defense?.countered && enemy.type === "boarder") {
    boarderSupport = resolveBoarderCounterSupport(state, enemy);
    enemy.boarded = false;
    enemy.x += 68;
    enemy.y = Math.max(62, Math.min(478, enemy.y + enemy.lane * 24));
  } else if (enemy.type === "boarder" && target === state.cart && !boarderWasAttached) {
    enemy.boarded = true;
    enemy.x = state.cart.x + 18;
    enemy.y = state.cart.y + enemy.lane * 31;
  }
  if (defense?.countered && defense.deputy && coreCounterTuning) {
    const deputy = defense.deputy;
    const counterPower = 14 * ((state.player.power + deputy.power) / 2) * coreCounterTuning.damageMultiplier * battleMoraleModifier(state);
    const leaderCounter = recordLeaderDamage(state, enemy, counterPower * .56);
    const deputyCounter = recordGuardDamage(state, deputy, enemy, counterPower * .44);
    counterDamage = leaderCounter + deputyCounter;
    faceToward(state.player, enemy);
    faceToward(deputy, enemy);
    state.player.attackPulse = Math.max(state.player.attackPulse, .24);
    deputy.attackPulse = Math.max(deputy.attackPulse, .24);
    deputy.cooldown = Math.max(deputy.cooldown, .4);
    deputy.supportPulse = Math.max(deputy.supportPulse, 1.05);
    deputy.supportKind = "core-counter";
    state.attackPulse = Math.max(state.attackPulse, .18);
    state.coreCounterPulse = 1;
    state.coreCounterCount += 1;
    state.leaderContribution.support += Math.max(1, baseDamage - resolvedDamage) * .45;
    recordGuardSupport(state, deputy, Math.max(1, baseDamage - resolvedDamage) * .55);
  }
  if (defense) {
    const outcome = defense.countered ? "counter" : "breach";
    const title = defense.countered ? defense.counterTitle : defense.breachTitle;
    if (defense.countered) state.defenseCounters += 1;
    else state.defenseBreaches += 1;
    if (defense.countered && enemy.type === "leader") enemy.stunned = Math.max(enemy.stunned, coreCounterTuning?.stunSeconds ?? .85);
    state.defenseOutcome = outcome;
    state.defensePulse = .92;
    emitCue(state, outcome, enemy, target === state.cart ? { ...state.cart, id: "cart" } : target, resolvedDamage, title, {
      targetLabel: defense.targetLabel,
      actionLabel: attackAction,
      assistSourceId: defense.deputy?.id,
      assistX: defense.deputy?.x,
      assistY: defense.deputy?.y,
      counterAmount: counterDamage || undefined,
    });
    state.message = defense.countered
      ? defense.deputy
        ? `${state.player.name}与${defense.deputy.name}交叉截锋${coreCounterShieldTuning === null ? "" : `，${guardTraitEquipmentName(defense.deputy, "shield", "坚牌")}同时架住来刃`}，卸开匪首重招并反击 ${Math.max(1, Math.round(counterDamage))} 点`
        : boarderSupport
          ? `${boarderSupport.guard.name}贴住车尾，以${boarderSupport.label}将攀车者掀落，并反击 ${Math.max(1, Math.round(boarderSupport.damage))} 点`
        : `阵令应对得当：${title}，挡住${enemyAttackActor(enemy.type)}来势，${defense.targetLabel}只受 ${Math.max(1, Math.round(resolvedDamage))} 点冲击`
      : enemy.type === "boarder"
        ? boarderWasAttached
          ? "攀车者撬开货封，镖货正在快速流失！立即围车截手"
          : "攀车者已翻上车尾；下一招将撬封夺货，立即围车掀贼"
        : `阵线被破：${enemyAttackActor(enemy.type)}${attackAction}命中${defense.targetLabel}，应立即调整阵令`;
  }
  const baseCooldown = enemy.type === "leader" ? 1.5 : enemy.type === "archer" ? 1.35 : enemy.type === "torch" ? 1.08 : enemy.type === "boarder" && enemy.boarded ? .72 : 0.88;
  enemy.cooldown = Math.max(.42, baseCooldown - enemy.attackWindupDuration * .35);
  enemy.attackTargetId = null;
  enemy.attackWindup = 0;
  enemy.attackWindupDuration = 0;
}

function leaderShouldChallenge(state: BattleSimulation, leader: Enemy): boolean {
  const challengeSeconds = Math.max(2.1, state.config.enemyLeaderChallengeSeconds ?? 6.4);
  const earliestChallenge = Math.min(3.4, challengeSeconds - .35);
  if (state.leaderPhase !== "command" || state.elapsed < earliestChallenge || state.leaderCommandCount < 1) return false;
  const survivingFollowers = state.enemies.filter((enemy) => enemy !== leader && enemy.hp > 0).length;
  return leader.hp <= leader.maxHp * .72 || survivingFollowers <= 3 || state.elapsed >= challengeSeconds;
}

function beginLeaderChallenge(state: BattleSimulation, leader: Enemy): void {
  state.leaderPhase = "challenge";
  state.leaderChallengePulse = 1;
  state.leaderChallengeCount += 1;
  state.enemyCommandPulse = 0;
  leader.cooldown = Math.min(leader.cooldown, .45);
  leader.rallied = 0;
  emitCue(state, "leader-challenge", leader, state.player, 0, "弃旗逼战", {
    targetLabel: state.player.name,
    actionLabel: "踏阵挑战",
  });
  state.message = `匪首弃旗提刀，直逼${state.player.name}！强行开路可迎锋破势`;
}

function updateEnemies(state: BattleSimulation, dt: number): void {
  for (const enemy of state.enemies) {
    if (enemy.hp <= 0) continue;
    enemy.cooldown -= dt;
    enemy.flash -= dt;
    enemy.attackPulse = Math.max(0, enemy.attackPulse - dt);
    enemy.attackWindup = Math.max(0, enemy.attackWindup - dt);
    enemy.stunned = Math.max(0, enemy.stunned - dt);
    enemy.rallied = Math.max(0, enemy.rallied - dt);
    if (enemy.stunned > 0) {
      enemy.attackTargetId = null;
      enemy.attackWindup = 0;
      enemy.attackWindupDuration = 0;
      continue;
    }
    if (updateBannerRaider(state, enemy, dt)) continue;
    if (enemy.carrier && battleObjectiveMode(state.config) === "pursuit") {
      moveToward(enemy, { x: 940, y: 270 + enemy.lane * 26 }, pursuitRunnerSpeed(state) * dt);
      continue;
    }
    if (enemy.type === "boarder" && enemy.boarded) {
      enemy.x = state.cart.x + 18;
      enemy.y = state.cart.y + enemy.lane * 31;
      faceToward(enemy, { x: state.cart.x - 24, y: state.cart.y - 8 });
    }
    if (enemy.type === "leader") {
      if (leaderShouldChallenge(state, enemy)) beginLeaderChallenge(state, enemy);
      if (state.leaderPhase === "command") {
        const commandPost = { x: Math.min(886, state.cart.x + 365), y: state.cart.y + enemy.lane * 92 };
        if (distance(enemy, commandPost) > 38) moveToward(enemy, commandPost, 72 * dt);
        else faceToward(enemy, state.cart);
        if (enemy.cooldown <= 0 && state.elapsed > 2.2) {
          const rallied = state.enemies.filter((other) => other !== enemy && other.hp > 0 && distance(enemy, other) <= 470);
          for (const other of rallied) {
            other.rallied = Math.max(other.rallied, 4.2);
            other.cooldown = Math.min(other.cooldown, .18);
          }
          enemy.attackPulse = .44;
          enemy.cooldown = 6.4;
          state.enemyCommandPulse = 1;
          state.leaderCommandCount += 1;
          state.message = `匪首挥旗号令，${rallied.length} 名喽啰压上车阵！`;
        }
        continue;
      }
      if (state.leaderPhase === "challenge") {
        const target = state.player;
        if (enemy.attackTargetId) {
          const pendingTarget = enemyAttackTargetById(state, enemy.attackTargetId);
          if (!enemyAttackTargetAlive(pendingTarget) || distance(enemy, pendingTarget) > enemyAttackRange("leader") * 1.65) {
            enemy.attackTargetId = null;
            enemy.attackWindup = 0;
            enemy.attackWindupDuration = 0;
            enemy.cooldown = Math.max(enemy.cooldown, .14);
          } else {
            faceToward(enemy, pendingTarget);
            if (enemy.attackWindup > 0) continue;
            resolveEnemyAttack(state, enemy, pendingTarget);
            continue;
          }
        }
        const targetDistance = distance(enemy, target);
        if (targetDistance > enemyAttackRange("leader")) moveToward(enemy, target, 108 * dt);
        else if (enemy.cooldown <= 0) {
          faceToward(enemy, target);
          enemy.attackTargetId = target.id;
          enemy.attackWindupDuration = enemyAttackWindupDuration("leader");
          enemy.attackWindup = enemy.attackWindupDuration;
          state.message = `匪首沉肩蓄势，提刀直取${state.player.name}！`;
        }
      }
      continue;
    }

    if (enemy.attackTargetId) {
      const pendingTarget = enemyAttackTargetById(state, enemy.attackTargetId);
      const range = enemyAttackRange(enemy.type);
      if (!enemyAttackTargetAlive(pendingTarget) || distance(enemy, pendingTarget) > range * 1.65) {
        enemy.attackTargetId = null;
        enemy.attackWindup = 0;
        enemy.attackWindupDuration = 0;
        enemy.cooldown = Math.max(enemy.cooldown, .14);
      } else {
        faceToward(enemy, pendingTarget);
        if (enemy.attackWindup > 0) continue;
        resolveEnemyAttack(state, enemy, pendingTarget);
        continue;
      }
    }
    let target: EnemyAttackTarget;
    const playerDistance = distance(enemy, state.player);
    const livingGuards = state.guards.filter((guard) => guard.hp > 0);
    const nearestGuard = [...livingGuards].sort((a, b) => distance(enemy, a) - distance(enemy, b))[0];
    if (enemy.clientHunter && state.client && state.client.hp > 0) target = state.client;
    else if (enemy.type === "cutter") target = state.horse;
    else if (enemy.type === "hooker" || enemy.type === "torch" || enemy.type === "boarder") target = state.cart;
    else if (enemy.type === "archer" && Number(enemy.id.split("-").at(-1)) % 2 === 0 && state.horse.hp > 0) target = state.horse;
    else if (playerDistance < 115) target = state.player;
    else if (nearestGuard && distance(enemy, nearestGuard) < 95) target = nearestGuard;
    else target = state.cart;

    const targetDistance = distance(enemy, target);
    const attackRange = enemyAttackRange(enemy.type);
    if (targetDistance > attackRange || (enemy.type === "archer" && targetDistance < 120)) {
      const targetPoint = enemy.type === "archer" && targetDistance < 120
        ? { x: enemy.x - (target.x - enemy.x), y: enemy.y - (target.y - enemy.y) }
        : target;
      const rallySpeed = enemy.rallied > 0 ? 1.28 : 1;
      moveToward(enemy, targetPoint, (enemy.type === "hooker" ? 74 : enemy.type === "boarder" ? 118 : enemy.type === "cutter" ? 112 : enemy.type === "torch" ? 94 : 88) * rallySpeed * dt);
    } else if (enemy.cooldown <= 0 && state.elapsed > 2.2) {
      faceToward(enemy, target);
      enemy.attackTargetId = enemyAttackTargetId(state, target);
      enemy.attackWindupDuration = enemyAttackWindupDuration(enemy.type);
      enemy.attackWindup = enemy.attackWindupDuration;
      if (enemy.type === "cutter") state.message = "斩缰手伏身蓄刀，目标直指马匹！";
      else if (enemy.type === "hooker") state.message = "钩索手抡索取准，正盯着镖车货位！";
      else if (enemy.type === "boarder") state.message = enemy.boarded ? "攀车者伏在车尾撬封，货物下一息便要失守！" : "攀车者正借轮翻篷，企图攀上车尾！";
      else if (enemy.type === "torch") state.message = "火手正在引燃火把，准备掷向车篷！";
      else if (enemy.type === "archer") state.message = `弓手张弦锁定${enemyAttackTargetLabel(state, enemy.attackTargetId)}！`;
    }
  }
}

function spawnDueReinforcements(state: BattleSimulation): void {
  if (battleObjectiveMode(state.config) !== "holdout") return;
  const fractions = [.18, .39, .6, .81];
  const objectiveSeconds = battleObjectiveSeconds(state.config);
  while (state.reinforcementWave < fractions.length && state.elapsed >= objectiveSeconds * fractions[state.reinforcementWave]) {
    const nextWave = state.reinforcementWave + 1;
    const waveSize = state.config.danger >= 66 ? 3 : 2;
    for (let member = 0; member < waveSize; member += 1) {
      const roll = randomStep(state.rngState);
      state.rngState = roll.state;
      const index = state.enemies.length;
      state.enemies.push(createEnemy(index, "holdout", state.config.terrain, roll.value, true));
    }
    state.reinforcementWave = nextWave;
    state.wavePulse = .9;
    state.message = nextWave === fractions.length ? "最后一拨追兵压上岸来！" : `敌援又至！第 ${nextWave + 1} 拨来敌逼近车阵`;
  }
}

function strategyFormation(state: BattleSimulation, strategy: BattleStrategy): BattleFormation {
  if (strategy === "breakthrough") return "advance";
  if (strategy === "guard-cart" || strategy === "guard-client" || strategy === "focus-fire" || strategy === "repair-cart" || strategy === "rescue") return "hold";
  if (strategy === "guard-horses") return "horses";
  if (state.banner.stolen) return "advance";
  if (state.banner.captureProgress > 0) return "hold";
  const horseThreat = state.enemies.some((enemy) => enemy.hp > 0 && enemy.type === "cutter" && distance(enemy, state.horse) < 180);
  if (horseThreat) return "horses";
  const cartThreat = state.enemies.some((enemy) => enemy.hp > 0 && (enemy.type === "hooker" || enemy.type === "torch" || enemy.type === "boarder") && distance(enemy, state.cart) < 190);
  return cartThreat ? "hold" : baseFormation(state.config);
}

function strategyTarget(state: BattleSimulation, strategy: BattleStrategy): Enemy | undefined {
  const threat: Record<Enemy["type"], number> = { leader: 52, banner: 3, boarder: 44, hooker: 36, cutter: 36, torch: 32, archer: 14, raider: 8 };
  const coreFocus = coreCombatFocusTuning(state.config.leader?.coreCombatFocusId, state.config.leader?.coreCombatExperience ?? 0);
  const rescueTarget = strategy === "rescue" && state.rescueTargetId ? state.guards.find((guard) => guard.id === state.rescueTargetId) : undefined;
  const focus = rescueTarget ?? (strategy === "guard-client" && state.client ? state.client : strategy === "guard-horses" ? state.horse : strategy === "guard-cart" || strategy === "focus-fire" || strategy === "repair-cart" || strategy === "rescue" ? state.cart : state.player);
  const volleyTarget = strategy === "focus-fire" ? battleVolleyTarget(state) : undefined;
  return state.enemies.filter((enemy) => enemy.hp > 0 && (enemy.type !== "banner" || state.banner.captureProgress > 0 || state.banner.stolen)).sort((a, b) => {
    const priority = (enemy: Enemy) => {
      let value = threat[enemy.type];
      if (state.banner.stolen && enemy.id === state.banner.carrierId) value += strategy === "guard-cart" || strategy === "guard-horses" ? 70 : 260;
      else if (enemy.type === "banner" && state.banner.captureProgress > 0) value += strategy === "guard-horses" ? 20 : 150;
      if (battleObjectiveMode(state.config) === "pursuit" && enemy.carrier && (strategy === "balanced" || strategy === "breakthrough")) value += strategy === "breakthrough" ? 280 : 210;
      if (enemy.type === "leader" && strategy === "breakthrough") value += 145;
      if (enemy.type === "leader" && strategy === "balanced" && enemy.rallied > 0) value += 52;
      if (strategy === "guard-horses" && enemy.type === "cutter") value += 90;
      if (strategy === "guard-cart" && (enemy.type === "hooker" || enemy.type === "torch" || enemy.type === "boarder")) value += enemy.type === "boarder" && enemy.boarded ? 150 : 90;
      if (strategy === "repair-cart") value += Math.max(0, 150 - distance(state.cart, enemy) * .55) + (enemy.type === "hooker" || enemy.type === "torch" || enemy.type === "boarder" ? 90 : 0);
      if (strategy === "focus-fire" && enemy.id === volleyTarget?.id) value += 320;
      if (strategy === "guard-client" && enemy.clientHunter) value += 210;
      if (strategy === "balanced" && state.client && clientThreatened(state) && enemy.clientHunter) value += 105;
      if (strategy === "rescue") value += Math.max(0, 100 - distance(focus, enemy) * .45);
      if (strategy === "breakthrough") value += Math.max(0, 45 - Math.abs(enemy.x - state.cart.x) * .05);
      if (strategy === "balanced" && (enemy.type === "hooker" || enemy.type === "boarder" || enemy.type === "cutter" || enemy.type === "torch")) value += 42;
      if (enemy.carrier || enemy.type === "leader" || enemy.type === "boarder" || enemy.type === "hooker" || enemy.type === "cutter" || enemy.type === "torch") value += coreFocus.elitePriorityBonus;
      return value - distance(focus, enemy) * .18;
    };
    return priority(b) - priority(a);
  })[0];
}

export function clientThreatened(state: BattleSimulation): boolean {
  const client = state.client;
  if (!client || client.hp <= 0) return false;
  return state.enemies.some((enemy) => enemy.hp > 0 && ((enemy.clientHunter && distance(enemy, client) < 260) || distance(enemy, client) < 105));
}

export function battleThreatNotice(state: BattleSimulation): BattleThreatNotice {
  const alive = state.enemies.filter((enemy) => enemy.hp > 0);
  if (state.client && state.client.hp <= 0) return { tone: "command", label: `${state.client.name}重伤倒地`, advice: "活镖已经无法继续赶路" };
  if (state.client && clientThreatened(state)) {
    const hunter = alive.filter((enemy) => enemy.clientHunter).sort((a, b) => distance(a, state.client!) - distance(b, state.client!))[0];
    return {
      tone: "command",
      label: hunter ? `劫人者距活镖 ${Math.max(1, Math.round(distance(hunter, state.client) / 12))} 步` : "敌手逼近活镖",
      advice: state.clientGuarded ? "护卫正截住劫人者" : "可下护住活镖令",
    };
  }
  if (state.banner.lost) return { tone: "command", label: "镖旗已经失守", advice: "先保人货脱阵" };
  if (state.banner.stolen) {
    const flagCarrier = alive.find((enemy) => enemy.id === state.banner.carrierId);
    const seconds = flagCarrier ? Math.max(1, Math.ceil((925 - flagCarrier.x) / 94)) : 0;
    return { tone: "command", label: `夺旗手约 ${seconds} 息脱逃`, advice: state.formation === "advance" ? "快手正在追旗" : "强行开路可追回" };
  }
  if (state.banner.captureProgress > 0) return {
    tone: "command",
    label: `夺旗 ${Math.round(state.banner.captureProgress)}%`,
    advice: state.formation === "hold" ? "停阵正在压住夺旗手" : "宜围车护旗",
  };
  if (state.leaderPhase === "challenge") return {
    tone: "command",
    label: "匪首弃旗逼战",
    advice: state.activeStrategy === "breakthrough" ? "镖头正在迎锋破势" : "宜强行开路接战",
  };
  if (state.rescueTargetId) {
    const target = state.guards.find((guard) => guard.id === state.rescueTargetId);
    const rescuer = state.guards.find((guard) => guard.id === state.rescueRescuerId);
    return {
      tone: "steady",
      label: `救援 ${Math.round(state.rescueProgress)}%`,
      advice: rescuer && target ? `${rescuer.name}正在救回${target.name}` : "等待可用人手",
    };
  }
  const rescueCandidate = state.guards.find((guard) => guard.hp <= 0 && !state.rescuedGuardIds.includes(guard.id));
  if (rescueCandidate && state.guards.some((guard) => guard.hp > 0)) return {
    tone: "command",
    label: `${rescueCandidate.name}倒地待援`,
    advice: "可下收阵救人令",
  };
  if (state.repairerId) {
    const repairer = state.guards.find((guard) => guard.id === state.repairerId);
    return { tone: "cart", label: `抢修 ${Math.round(state.repairProgress)}%`, advice: repairer ? `${repairer.name}正在车下复轴` : "守住车尾" };
  }
  if (battleRepairAvailable(state)) return {
    tone: "command",
    label: `车况 ${Math.round(state.cart.hp / state.cart.maxHp * 100)}% · 轴架告急`,
    advice: "可下停阵抢修令",
  };
  if (state.volleyTargetId) {
    const target = alive.find((enemy) => enemy.id === state.volleyTargetId);
    return { tone: "ranged", label: `攒弩 ${Math.round(state.volleyProgress)}%`, advice: target?.type === "leader" ? "齐射正锁定匪首" : "持弩镖师正在取准" };
  }
  if (battleVolleyAvailable(state)) {
    const target = battleVolleyTarget(state);
    const label = target?.carrier ? "夺镖者进入弩程" : target?.type === "leader" ? "匪首暴露在弩程" : target?.type === "archer" ? "弓手列阵攒射" : "专手进入弩程";
    return { tone: "command", label, advice: "可下集中齐射令" };
  }
  if (!alive.length) return { tone: "steady", label: "阵面已清", advice: battleObjectiveMode(state.config) === "holdout" ? "继续守到援来" : "催车向前" };
  const carrier = alive.find((enemy) => enemy.carrier);
  if (carrier && battleObjectiveMode(state.config) === "pursuit") {
    const seconds = Math.max(1, Math.ceil((925 - carrier.x) / pursuitRunnerSpeed(state)));
    return { tone: "ranged", label: `夺镖者约 ${seconds} 息脱逃`, advice: state.formation === "advance" ? "快手正在追截" : "宜强行开路追击" };
  }
  const leader = alive.find((enemy) => enemy.type === "leader");
  if (leader && state.enemyCommandPulse > 0) return { tone: "command", label: "匪首挥旗催动群匪", advice: "可强行开路斩首" };
  const boarder = alive
    .filter((enemy) => enemy.type === "boarder" && (enemy.boarded || distance(enemy, state.cart) < 210))
    .sort((a, b) => Number(b.boarded) - Number(a.boarded) || distance(a, state.cart) - distance(b, state.cart))[0];
  if (boarder) return {
    tone: "cart",
    label: boarder.boarded ? "攀车者已伏上车尾" : "攀车者正在借轮翻篷",
    advice: state.formation === "hold" ? "车把式正准备掀贼" : "立即围车固守",
  };
  const cutter = alive.find((enemy) => enemy.type === "cutter" && distance(enemy, state.horse) < 180);
  if (cutter) return { tone: "horse", label: "斩缰手逼近马队", advice: "宜下护马令" };
  const cartThreat = alive
    .filter((enemy) => (enemy.type === "torch" || enemy.type === "hooker") && distance(enemy, state.cart) < 190)
    .sort((a, b) => distance(a, state.cart) - distance(b, state.cart))[0];
  if (cartThreat) return {
    tone: "cart",
    label: cartThreat.type === "torch" ? "火手正在贴车" : "钩索手逼近货车",
    advice: "宜围车固守",
  };
  const archers = alive.filter((enemy) => enemy.type === "archer");
  if (archers.length >= 2) return { tone: "ranged", label: "远处弓手攒射", advice: "可强行开路压近" };
  if (leader) return { tone: "command", label: "匪首正在后阵整队", advice: "强行开路可斩首" };
  return { tone: "steady", label: "敌阵尚散", advice: "临机应变" };
}

export function autoBattleInput(state: BattleSimulation, strategy: BattleStrategy = "balanced", techniquePolicy: TechniquePolicy = "auto"): BattleInput {
  const formation = strategyFormation(state, strategy);
  const target = strategyTarget(state, strategy);
  const martialArt = martialArtById(state.config.martialArtId);
  const rescueTarget = strategy === "rescue" && state.rescueTargetId ? state.guards.find((guard) => guard.id === state.rescueTargetId) : undefined;
  const leaderAnchor = rescueTarget ? { x: Math.min(914, rescueTarget.x + 58), y: Math.max(68, rescueTarget.y - 48) } : battleLeaderAnchor(state, formation);
  const anchorDistance = distance(state.player, leaderAnchor);
  const returnToFormation = (): BattleInput => ({
    x: anchorDistance > 16 ? leaderAnchor.x - state.player.x : 0,
    y: anchorDistance > 16 ? leaderAnchor.y - state.player.y : 0,
    attack: false,
    technique: false,
    rally: false,
    guardHorses: false,
    guardClient: strategy === "guard-client",
    rescue: strategy === "rescue",
    repair: strategy === "repair-cart",
    focusFire: strategy === "focus-fire",
    retreat: false,
    formation,
    strategy,
  });
  if (!target) return returnToFormation();
  const formationFocus = rescueTarget ?? (strategy === "guard-client" && state.client ? state.client : formation === "horses" ? state.horse : state.cart);
  const defenseRadius = strategy === "rescue" ? 205 : strategy === "guard-client" ? 260 : strategy === "repair-cart" ? 275 : strategy === "focus-fire" ? 250 : formation === "horses" ? 220 : formation === "hold" ? 238 : Number.POSITIVE_INFINITY;
  if (distance(formationFocus, target) > defenseRadius) return returnToFormation();
  const targetDistance = distance(state.player, target);
  const desiredRange = martialArt.attackRange * .72;
  const x = targetDistance > desiredRange ? target.x - state.player.x : 0;
  const y = targetDistance > desiredRange ? target.y - state.player.y : 0;
  const nearby = state.enemies.filter((enemy) => enemy.hp > 0 && distance(state.player, enemy) <= (martialArt.id === "guard-spear" ? 148 : martialArt.id === "binding-hands" ? 88 : 210));
  const specialistNearby = nearby.some((enemy) => enemy.carrier || enemy.type === "banner" || enemy.type === "leader" || enemy.type === "boarder" || enemy.type === "hooker" || enemy.type === "cutter" || enemy.type === "torch");
  const techniqueWorthwhile = martialArt.id === "severing-sabre" ? specialistNearby : nearby.length >= 2 || specialistNearby;
  return {
    x,
    y,
    attack: targetDistance <= martialArt.attackRange,
    technique: techniquePolicy === "auto" && state.techniqueCooldown <= 0 && techniqueWorthwhile,
    rally: false,
    guardHorses: false,
    guardClient: strategy === "guard-client",
    rescue: strategy === "rescue",
    repair: strategy === "repair-cart",
    focusFire: strategy === "focus-fire",
    retreat: false,
    formation,
    strategy,
  };
}

export function stepBattle(state: BattleSimulation, input: BattleInput, dt: number): BattleSimulation {
  if (state.outcome) return state;
  const safeDt = Math.min(dt, 0.05);
  state.activeStrategy = input.strategy ?? state.activeStrategy;
  state.clientGuarded = Boolean(input.guardClient && state.client && state.client.hp > 0);
  state.elapsed += safeDt;
  state.rally = Math.max(0, state.rally - safeDt);
  state.attackPulse = Math.max(0, state.attackPulse - safeDt);
  state.techniquePulse = Math.max(0, state.techniquePulse - safeDt);
  state.wavePulse = Math.max(0, state.wavePulse - safeDt);
  state.enemyCommandPulse = Math.max(0, state.enemyCommandPulse - safeDt);
  state.leaderChallengePulse = Math.max(0, state.leaderChallengePulse - safeDt);
  state.rescuePulse = Math.max(0, state.rescuePulse - safeDt);
  state.repairPulse = Math.max(0, state.repairPulse - safeDt);
  state.volleyPulse = Math.max(0, state.volleyPulse - safeDt);
  state.volleyCooldown = Math.max(0, state.volleyCooldown - safeDt);
  state.coordinationPulse = Math.max(0, state.coordinationPulse - safeDt);
  state.coordinationCooldown = Math.max(0, state.coordinationCooldown - safeDt);
  state.coreComboPulse = Math.max(0, state.coreComboPulse - safeDt);
  state.coreComboCooldown = Math.max(0, state.coreComboCooldown - safeDt);
  state.coreCounterPulse = Math.max(0, state.coreCounterPulse - safeDt);
  state.defensePulse = Math.max(0, state.defensePulse - safeDt);
  if (state.coordinationWindow && state.coordinationWindow.expiresAt < state.elapsed) state.coordinationWindow = null;
  state.cues = state.cues.filter((cue) => {
    cue.ttl -= safeDt;
    return cue.ttl > 0;
  });
  state.cart.flash = Math.max(0, state.cart.flash - safeDt);
  state.banner.flash = Math.max(0, state.banner.flash - safeDt);
  state.banner.contested = false;
  if (!state.banner.stolen && !state.banner.lost) {
    state.banner.x = state.cart.x + 42;
    state.banner.y = state.cart.y - 60;
  }
  resolveOpeningMasteries(state);
  spawnDueReinforcements(state);
  updatePlayer(state, input, safeDt);
  state.formationSeconds[state.formation] += safeDt;
  updateRescue(state, Boolean(input.rescue), safeDt);
  updateRepair(state, Boolean(input.repair), safeDt);
  updateVolley(state, Boolean(input.focusFire), safeDt);
  updateClient(state, safeDt);
  updateGuards(state, safeDt);
  state.horse.flash -= safeDt;
  state.horse.x = state.cart.x + 54;
  state.horse.y = state.cart.y;
  const messageBeforeEnemies = state.message;
  updateEnemies(state, safeDt);
  resolveBannerAfterCombat(state, safeDt);
  const enemyThreatMessageChanged = state.message !== messageBeforeEnemies;

  const mode = battleObjectiveMode(state.config);
  const closeEnemies = state.enemies.filter((enemy) => enemy.hp > 0 && distance(enemy, state.cart) < 68).length;
  const baseTerrainSpeed = state.config.terrain === "mountain" ? 18 : 24;
  const terrainSpeed = mode === "gate-run" ? baseTerrainSpeed * 1.22 : baseTerrainSpeed;
  const formationSpeed = state.formation === "advance" ? 1 : state.formation === "horses" ? 0.38 : 0;
  const doctrineCartSpeed = battleDoctrine(state.doctrineId)?.modifiers.cartSpeed ?? 1;
  if (mode !== "holdout" && mode !== "pursuit" && state.horse.hp > 0) state.cart.x += (closeEnemies ? terrainSpeed * 0.5 : terrainSpeed) * formationSpeed * doctrineCartSpeed * safeDt;
  state.player.x = Math.max(state.player.x, state.cart.x - 180);
  const defeatedNow = state.enemies.filter((enemy) => enemy.hp <= 0).length;
  const defeatedLeader = state.enemies.find((enemy) => enemy.type === "leader" && enemy.hp <= 0);
  const leaderFellNow = Boolean(defeatedLeader && !state.leaderDefeated);
  if (leaderFellNow) {
    state.leaderDefeated = true;
    state.leaderPhase = "defeated";
    state.enemyCommandPulse = 0;
    state.leaderChallengePulse = 0;
    for (const enemy of state.enemies) {
      if (enemy.hp <= 0 || enemy.type === "leader") continue;
      enemy.rallied = 0;
      enemy.stunned = Math.max(enemy.stunned, 1.15);
    }
    state.message = "匪首旗倒！群匪号令溃散";
  }
  if (defeatedNow > state.defeatedEnemies) {
    state.defeatedEnemies = defeatedNow;
    const equipmentSupportActive = state.guards.some((guard) => guard.supportPulse > 0);
    if (!leaderFellNow && state.horse.flash <= 0 && !enemyThreatMessageChanged && state.techniquePulse <= 0 && !equipmentSupportActive) state.message = defeatedNow % 3 === 0 ? "前路渐开，护车前行！" : "击退一人";
  }
  const carrier = pursuitCarrier(state);
  if (state.client && state.client.hp <= 0) {
    state.message = `${state.client.name}重伤倒地，活镖已经失守！`;
    state.outcome = "defeat";
  }
  else if (mode === "pursuit" && carrier && carrier.hp <= 0) {
    state.pursuitResolved = "recovered";
    state.message = `${state.config.recoveryLabel ?? "镖匣"}已追回，鸣哨收拢车阵！`;
    state.outcome = "complete";
  }
  else if (mode === "pursuit" && carrier && (carrier.x >= 925 || state.elapsed >= battleObjectiveSeconds(state.config))) {
    state.pursuitResolved = "escaped";
    state.message = `夺镖者逃出山口，${state.config.recoveryLabel ?? "镖匣"}未能追回`;
    state.outcome = "partial";
  }
  else if (mode === "holdout" && state.elapsed >= battleObjectiveSeconds(state.config)) state.outcome = state.cart.cargo >= 76 && state.horse.hp > 0 && (!state.client || state.client.hp >= 45) ? "complete" : "partial";
  else if (state.cart.x >= 842) state.outcome = state.cart.cargo >= 76 && (!state.client || state.client.hp >= 45) ? "complete" : "partial";
  else if (state.horse.hp <= 0) state.outcome = "partial";
  else if (state.player.hp <= 0 || state.cart.hp <= 0 || state.cart.cargo <= 0) state.outcome = "defeat";
  else if (state.elapsed >= battleObjectiveSeconds(state.config)) state.outcome = "partial";
  return state;
}

export function battleProgress(state: BattleSimulation): number {
  if (battleObjectiveMode(state.config) === "pursuit") {
    const carrier = pursuitCarrier(state);
    return carrier ? Math.min(100, Math.round((1 - carrier.hp / carrier.maxHp) * 100)) : 100;
  }
  return battleObjectiveMode(state.config) === "holdout"
    ? Math.min(100, Math.round((state.elapsed / battleObjectiveSeconds(state.config)) * 100))
    : Math.min(100, Math.round(((state.cart.x - 145) / 697) * 100));
}

export function battleResult(state: BattleSimulation): BattleResult {
  const downGuards = state.guards.filter((guard) => guard.hp <= 0).length;
  const pursuitLoss = battleObjectiveMode(state.config) === "pursuit" && state.pursuitResolved !== "recovered" ? state.config.pursuitCargoLoss ?? 28 : 0;
  const cargoLoss = Math.round(100 - state.cart.cargo + pursuitLoss);
  const leaderDamage = Math.max(0, Math.round((state.player.maxHp - state.player.hp) / state.player.maxHp * 100));
  const leaderInjury = injuryForBattleDamage(leaderDamage, state.config.seed, "player-leader");
  const guardDamage = Object.fromEntries(state.guards.map((guard) => {
    const healthLost = Math.max(0, guard.maxHp - guard.hp);
    return [guard.id, Math.min(60, Math.round((healthLost / guard.maxHp) * 38) + (guard.hp <= 0 ? 22 : 0))];
  }));
  const guardInjuries = Object.fromEntries(Object.entries(guardDamage).flatMap(([guardId, damage]) => {
    const injuryId = injuryForBattleDamage(damage, state.config.seed, guardId);
    return injuryId ? [[guardId, injuryId]] : [];
  }));
  const bannerLost = state.banner.lost || state.banner.stolen;
  const rawOutcome = state.outcome ?? "partial";
  const clientDamage = state.client ? Math.max(0, Math.round(state.initialClientHp - state.client.hp)) : 0;
  const clientDowned = Boolean(state.client && state.client.hp <= 0);
  const adjustedOutcome = clientDowned ? "defeat" : clientDamage >= 35 && rawOutcome === "complete" ? "partial" : rawOutcome;
  const cartDelta = (state.initialCartHp - state.cart.hp) / state.cart.maxHp * 100;
  const guardContributions = Object.fromEntries(state.guards.map((guard) => {
    const raw = state.guardContributions[guard.id] ?? { damage: 0, support: 0, defeats: 0 };
    const damage = Math.round(raw.damage);
    const support = Math.round(raw.support);
    const score = damage + support * 1.35 + raw.defeats * 18;
    const experience = (guard.role === "副镖头" ? 2 : 1) + Number(score >= 30) + Number(score >= 100);
    const title = support >= 18 && support >= damage * .35
      ? "救危护阵"
      : raw.defeats >= 2
        ? "破敌争先"
        : damage >= 70
          ? "迎锋力战"
          : support > 0
            ? "勤于照应"
            : damage > 0
              ? "随阵迎敌"
              : "随阵历练";
    return [guard.id, { damage, support, defeats: raw.defeats, title, experience }];
  }));
  const guardExperience = Object.fromEntries(Object.entries(guardContributions).map(([guardId, contribution]) => [guardId, contribution.experience]));
  const formationAwards = formationExperienceAwards(state.formationSeconds);
  const dominantFormation = dominantBattleFormation(state.formationSeconds);
  const coreFormationAwards = Object.fromEntries(Object.entries(formationAwards).map(([formationId, gain]) => [formationId, formationId === dominantFormation ? (gain ?? 0) + 1 : gain]));
  const guardFormationExperience = Object.fromEntries(state.guards.map((guard) => [guard.id, guard.role === "副镖头" ? { ...coreFormationAwards } : { [dominantFormation]: 1 }]));
  const leaderDamageDone = Math.round(state.leaderContribution.damage);
  const leaderScore = leaderDamageDone + state.leaderContribution.defeats * 22;
  const leaderExperience = 2 + Number(leaderScore >= 45) + Number(leaderScore >= 125);
  const leaderContribution = {
    damage: leaderDamageDone,
    support: Math.round(state.leaderContribution.support),
    defeats: state.leaderContribution.defeats,
    title: state.leaderContribution.defeats >= 3 ? "破阵先登" : leaderDamageDone >= 110 ? "亲摧强敌" : leaderDamageDone >= 45 ? "当锋开路" : "坐镇中军",
    experience: leaderExperience,
  };
  const deputy = state.config.guards.find((guard) => guard.role === "副镖头");
  const coreCombatFocusId = state.config.leader?.coreCombatFocusId;
  const leaderCoreCombatExperience = coreCombatFocusId ? {
    [coreCombatFocusId]: coreCombatExperienceGain(coreCombatFocusId, {
      combos: state.coreComboCount,
      counters: state.coreCounterCount,
      leaderDefeated: state.leaderDefeated,
      leaderDefeats: state.leaderContribution.defeats,
    }),
  } : undefined;
  const martialArtId = martialArtById(state.config.martialArtId).id;
  const martialExperienceGain = martialProficiencyExperienceGain(state.techniqueCount, state.leaderDefeated);
  const leaderMartialExperience: Partial<Record<MartialArtId, number>> | undefined = martialExperienceGain > 0
    ? { [martialArtId]: martialExperienceGain }
    : undefined;
  return {
    outcome: bannerLost && adjustedOutcome === "complete" ? "partial" : adjustedOutcome,
    elapsedHours: Math.max(2, Math.round(state.elapsed / 7)),
    leaderDamage,
    leaderInjury: leaderInjury ?? undefined,
    leaderExperience,
    leaderContribution,
    leaderFormationExperience: { ...coreFormationAwards },
    leaderDeputyCombos: state.coreComboCount,
    leaderDeputyCounters: state.coreCounterCount,
    leaderDeputyId: deputy?.id,
    leaderDeputyBondGain: deputy ? deputyBondGain(state.coreComboCount + state.coreCounterCount) : undefined,
    leaderCoreCombatExperience,
    leaderMartialExperience,
    enemyLeaderDefeated: state.leaderDefeated,
    leaderChallenges: state.leaderChallengeCount,
    guardLoss: downGuards,
    cartDamage: Math.max(0, Math.round(cartDelta)),
    cartRepair: Math.max(0, Math.round(-cartDelta)),
    cargoLoss: Math.min(100, cargoLoss + (state.outcome === "defeat" ? 35 : 0)),
    sealBroken: state.cart.cargo < 82 || state.cart.hp < 42,
    guardDamage,
    guardExperience,
    guardFormationExperience,
    formationSeconds: { ...state.formationSeconds },
    dominantFormation,
    guardContributions,
    guardInjuries,
    horseDamage: Math.min(100, Math.max(0, Math.round(((state.initialHorseHp - state.horse.hp) / state.horse.maxHp) * 100)) + (state.outcome === "defeat" ? 12 : 0)),
    bannerLost,
    bannerRecovered: state.banner.recovered && !bannerLost,
    moraleDamage: Math.max(0, state.initialMorale - state.morale),
    defenseCounters: state.defenseCounters,
    defenseBreaches: state.defenseBreaches,
    clientDamage,
    clientDowned,
  };
}
