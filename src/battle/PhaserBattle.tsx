import { useCallback, useEffect, useRef, useState } from "react";
import Phaser from "phaser";
import type { BattleConfig, BattleResult } from "../core/types";
import { martialArtById } from "../core/martialContent";
import { martialProficiencyEffectSummary, martialProficiencyRank } from "../core/martialProficiencyContent";
import { crewRank } from "../core/crewContent";
import { equipmentHasBattleTrait } from "../core/equipmentContent";
import { crewInjuryById } from "../core/injuryContent";
import { deputyBondRank } from "../core/deputyBondContent";
import { CORE_COMBAT_FOCUSES, DEFAULT_CORE_COMBAT_FOCUS, coreCombatFocusEffectSummary, coreCombatFocusRank } from "../core/coreCombatFocusContent";
import { BATTLE_FORMATION_IDS, FORMATION_PROFICIENCIES, formationProficiencyRank, normalizeFormationExperience } from "../core/formationProficiency";
import { BATTLE_ASSETS, battleBackgroundAsset, enemyTextureKey } from "./assets";
import { BATTLE_DOCTRINE_LIST, battleDoctrine, type BattleDoctrineId } from "./doctrineContent";
import { battleInjuryLabel, battleResultPresentation } from "./resultPresentation";
import { battleDefenseVerdictFromCue, battleDoctrineMoment, battleMomentFromCue, battleOrderMoment, type BattleDefenseVerdict, type BattleMoment } from "./momentPresentation";
import { battleCoreComboTiming, battleDefeatPose, battleHitPose, shouldReduceBattleMotion, type BattleCoreComboTiming } from "./animationPresentation";
import { battleCoreFocusVisual } from "./coreFocusPresentation";
import { battleGearBadges, battleGearRespondsToStrategy, battleGearSupportsAction, type BattleGearBadge } from "./equipmentPresentation";
import { BATTLE_PACE_OPTIONS, battlePacingState, type BattlePace } from "./pacing";
import {
  advanceBattleCommand,
  battleCommandRelayDuration,
  battleCommandRelayProgress,
  battleCommandRelayRemaining,
  createBattleCommandRelay,
  issueBattleCommand,
  type BattleCommandRelayState,
} from "./commandRelay";
import {
  battleInitialMessage,
  battleAttackIntents,
  battleIntentReadiness,
  battleCoreComboReadiness,
  battleCoreComboTuning,
  battleGuardAnchor,
  battleObjectiveMode,
  battleProgress,
  battleRepairAvailable,
  battleRearThreatStatus,
  battleVolleyAvailable,
  battleResult,
  battleThreatNotice,
  battleTimeRemaining,
  clientThreatened,
  autoBattleInput,
  createBattleSimulation,
  stepBattle,
  type BattleStrategy,
  type BattleAttackIntent,
  type BattleIntentReadiness,
  type BattleCue,
  type BattleSimulation,
  type BattleThreatNotice,
  type Enemy,
  type Guard,
  type TechniquePolicy,
} from "./simulation";

interface PhaserBattleProps {
  config: BattleConfig;
  onComplete: (result: BattleResult) => void;
}

interface BattleHud {
  playerHp: number;
  cartHp: number;
  horseHp: number;
  cargo: number;
  progress: number;
  remainingSeconds: number | null;
  enemies: number;
  enemyLeaderHp: number | null;
  enemyLeaderPhase: BattleSimulation["leaderPhase"];
  leaderChallengeCount: number;
  message: string;
  formation: BattleSimulation["formation"];
  techniqueCooldown: number;
  morale: number;
  bannerProgress: number;
  bannerState: "secure" | "contested" | "stolen" | "lost";
  rescueAvailable: boolean;
  repairAvailable: boolean;
  repairProgress: number;
  volleyAvailable: boolean;
  volleyProgress: number;
  volleyCooldown: number;
  coordinationCount: number;
  coordinationActive: boolean;
  coreComboCount: number;
  coreComboActive: boolean;
  coreComboReadiness: number;
  coreComboCooldown: number;
  coreCounterCount: number;
  coreCounterActive: boolean;
  rearThreatCount: number;
  rearSurrounded: boolean;
  rearDefenseActive: boolean;
  rearDefenseOutcome: BattleSimulation["rearDefenseOutcome"];
  rearTurnCount: number;
  rearGuardCount: number;
  rearHitCount: number;
  defenseCounters: number;
  defenseBreaches: number;
  defenseOutcome: BattleSimulation["defenseOutcome"];
  defenseActive: boolean;
  clientHp: number | null;
  clientThreatened: boolean;
  threat: BattleThreatNotice;
  incomingIntent: BattleAttackIntent | null;
  incomingIntents: Array<BattleAttackIntent & { readiness: BattleIntentReadiness }>;
  dangerFocus: boolean;
  timeScale: number;
  activeStrategy: BattleStrategy;
  pendingStrategy: BattleStrategy | null;
  commandProgress: number;
  commandRemaining: number;
  guards: Array<{ id: string; name: string; hp: number; discipline?: string; mastery?: string; injury?: string; support?: string }>;
}

interface BattleOrders {
  command: BattleCommandRelayState;
  techniquePolicy: TechniquePolicy;
  retreat: boolean;
  pace: BattlePace;
  paused: boolean;
}

const initialOrders = (): BattleOrders => ({ command: createBattleCommandRelay(), techniquePolicy: "auto", retreat: false, pace: "standard", paused: false });

const battleColorHex = (color: number): string => `#${color.toString(16).padStart(6, "0")}`;

const GUARD_SUPPORT_LABEL: Record<NonNullable<BattleSimulation["guards"][number]["supportKind"]>, string> = {
  crossbow: "弩发",
  volley: "齐射",
  medicine: "救治",
  "horse-hook": "护马",
  "wheel-hook": "固轮",
  shield: "举牌",
  mastery: "绝活",
  rescue: "救人",
  repair: "抢修",
  coordination: "合击",
  "core-combo": "主副合击",
  "core-counter": "主副截锋",
  "rear-guard": "护背",
};

const GUARD_DISCIPLINE_BADGE = {
  vanguard: { seal: "锋", color: "#e2b273", background: "rgba(105,42,31,.88)" },
  bulwark: { seal: "镇", color: "#dec88c", background: "rgba(76,62,37,.9)" },
  responder: { seal: "应", color: "#b9d2b5", background: "rgba(45,75,55,.88)" },
} as const;

const ENEMY_THREAT_BADGES: Partial<Record<BattleSimulation["enemies"][number]["type"], { seal: string; color: string; background: string }>> = {
  leader: { seal: "首", color: "#f3d28b", background: "rgba(105,35,27,.96)" },
  banner: { seal: "夺", color: "#f3c77f", background: "rgba(116,38,28,.96)" },
  archer: { seal: "弓", color: "#dccb9e", background: "rgba(66,54,39,.88)" },
  cutter: { seal: "缰", color: "#f0c46e", background: "rgba(91,55,27,.9)" },
  hooker: { seal: "钩", color: "#e4bc76", background: "rgba(72,50,29,.9)" },
  boarder: { seal: "攀", color: "#f0c27c", background: "rgba(104,57,27,.94)" },
  torch: { seal: "火", color: "#f08b65", background: "rgba(101,39,29,.92)" },
};

function battleStrategyColor(strategy: BattleStrategy): number {
  if (strategy === "guard-cart" || strategy === "guard-client" || strategy === "rescue") return 0x85b18f;
  if (strategy === "guard-horses" || strategy === "repair-cart" || strategy === "focus-fire") return 0xd5a65d;
  if (strategy === "breakthrough") return 0xd67b52;
  return 0xd1b56f;
}

function enemyIntentSeal(type: Enemy["type"]): string {
  if (type === "archer") return "弓";
  if (type === "cutter") return "缰";
  if (type === "hooker") return "钩";
  if (type === "boarder") return "攀";
  if (type === "torch") return "火";
  if (type === "leader") return "首";
  if (type === "banner") return "夺";
  return "袭";
}

function intentReadinessLabel(readiness: BattleIntentReadiness): string {
  return readiness === "covered" ? "已应" : readiness === "relaying" ? "传令" : "未应";
}

interface GuardGearBadgeView {
  badge: BattleGearBadge;
  container: Phaser.GameObjects.Container;
}

class EscortScene extends Phaser.Scene {
  private simulation: BattleSimulation;
  private groundLayer!: Phaser.GameObjects.Graphics;
  private renderLayer!: Phaser.GameObjects.Graphics;
  private convoySprite!: Phaser.GameObjects.Image;
  private convoyMaskShape!: Phaser.GameObjects.Graphics;
  private bannerSprite!: Phaser.GameObjects.Container;
  private leaderSprite!: Phaser.GameObjects.Image;
  private leaderRoleBadge!: Phaser.GameObjects.Container;
  private deputyRoleBadge?: Phaser.GameObjects.Container;
  private clientSprite?: Phaser.GameObjects.Image;
  private guardSprites = new Map<string, Phaser.GameObjects.Image>();
  private guardDisciplineBadges = new Map<string, Phaser.GameObjects.Text>();
  private guardGearBadges = new Map<string, GuardGearBadgeView[]>();
  private guardGearOrderPulseUntil = new Map<string, number>();
  private enemySprites = new Map<string, Phaser.GameObjects.Image>();
  private enemyThreatBadges = new Map<string, Phaser.GameObjects.Text>();
  private previousEnemyHp = new Map<string, number>();
  private enemyDefeatAt = new Map<string, number>();
  private previousGuardHp = new Map<string, number>();
  private guardDefeatAt = new Map<string, number>();
  private ended = false;
  private lastHudAt = 0;
  private lastDefeated = 0;
  private lastCueId = 0;
  private lastStrategy: BattleStrategy = "balanced";
  private lastWave = 0;
  private lastLeaderCommand = 0;
  private lastLeaderChallenge = 0;
  private leaderDefeatShown = false;
  private techniqueWasActive = false;
  private reducedMotion = false;
  private nextOrderMomentId = 100000;
  private lastMomentKey = "";
  private lastMomentAt = -10;

  constructor(
    private battleConfig: BattleConfig,
    doctrineId: BattleDoctrineId,
    private orders: BattleOrders,
    private reportHud: (hud: BattleHud) => void,
    private reportMoment: (moment: BattleMoment) => void,
    private reportDefenseVerdict: (verdict: BattleDefenseVerdict) => void,
    private reportResult: (result: BattleResult) => void,
  ) {
    super("escort");
    this.simulation = createBattleSimulation(battleConfig, doctrineId);
  }

  preload(): void {
    this.load.image(BATTLE_ASSETS.convoy.key, BATTLE_ASSETS.convoy.path);
    this.load.image(BATTLE_ASSETS.client.key, BATTLE_ASSETS.client.path);
    for (const asset of Object.values(BATTLE_ASSETS.backgrounds)) this.load.image(asset.key, asset.path);
    for (const asset of [...BATTLE_ASSETS.leader, ...BATTLE_ASSETS.guards, ...BATTLE_ASSETS.enemies]) this.load.image(asset.key, asset.path);
    this.load.image(BATTLE_ASSETS.chief.key, BATTLE_ASSETS.chief.path);
  }

  create(): void {
    this.reducedMotion = shouldReduceBattleMotion(window.location.search, window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
    this.lastStrategy = this.orders.command.active;
    this.cameras.main.setBackgroundColor(this.battleConfig.terrain === "river" ? "#273c3d" : this.battleConfig.terrain === "mountain" ? "#34352d" : "#3c3528");
    const background = battleBackgroundAsset(this.battleConfig.terrain);
    this.add.image(480, 270, background.key).setDisplaySize(960, 540).setDepth(-20);
    this.groundLayer = this.add.graphics().setDepth(0);
    this.renderLayer = this.add.graphics().setDepth(20);
    this.drawBackdrop();
    this.createEntitySprites();
    this.showDoctrineOpening();
  }

  private createEntitySprites(): void {
    this.convoySprite = this.add.image(this.simulation.cart.x + 42, this.simulation.cart.y, BATTLE_ASSETS.convoy.key)
      .setOrigin(.5, .66).setScale(.145).setDepth(2);
    this.convoyMaskShape = this.make.graphics({ x: 0, y: 0 }, false);
    this.convoySprite.setMask(this.convoyMaskShape.createGeometryMask());
    const bannerPole = this.add.graphics();
    bannerPole.lineStyle(4, 0x4e3826, 1).lineBetween(0, -43, 0, 34);
    bannerPole.lineStyle(1, 0xd8bd79, .7).lineBetween(-2, -43, -2, 34);
    bannerPole.fillStyle(0x8f352b, .98).fillTriangle(-2, -40, -46, -30, -2, -13);
    bannerPole.lineStyle(2, 0xd3ad61, .9).lineBetween(-2, -40, -46, -30).lineBetween(-46, -30, -2, -13);
    const bannerText = this.add.text(-18, -27, "風\n雲", {
      fontFamily: "serif", fontSize: "9px", color: "#f2dba3", align: "center", lineSpacing: -4,
      stroke: "#4b1d17", strokeThickness: 1,
    }).setOrigin(.5);
    this.bannerSprite = this.add.container(this.simulation.banner.x, this.simulation.banner.y + 36, [bannerPole, bannerText]).setDepth(9);
    this.leaderSprite = this.add.image(this.simulation.player.x, this.simulation.player.y, "battle-leader-1")
      .setOrigin(.5, .86).setScale(.3).setDepth(4);
    this.leaderRoleBadge = this.createCoreRoleBadge("主", this.battleConfig.leader?.name ?? "总镖头", 0xb64f3e, 0xe9c47c);
    if (this.simulation.client) {
      this.clientSprite = this.add.image(this.simulation.client.x, this.simulation.client.y, BATTLE_ASSETS.client.key)
        .setOrigin(.5, .91).setScale(.078).setDepth(3.5);
    }
    this.simulation.guards.forEach((guard, index) => {
      const sprite = this.add.image(guard.x, guard.y, `battle-guard-${(index % 3) + 1}`)
        .setOrigin(.5, .86).setScale(.245).setDepth(3);
      this.guardSprites.set(guard.id, sprite);
      this.previousGuardHp.set(guard.id, guard.hp);
      if (guard.role === "副镖头") this.deputyRoleBadge = this.createCoreRoleBadge("副", guard.name, 0xa87937, 0xe5c47d);
      if (guard.disciplineId) {
        const style = GUARD_DISCIPLINE_BADGE[guard.disciplineId];
        const badge = this.add.text(guard.x, guard.y - 53, style.seal, {
          fontFamily: "serif",
          fontSize: "11px",
          color: style.color,
          backgroundColor: style.background,
          padding: { x: 4, y: 2 },
          stroke: "#21170f",
          strokeThickness: 1,
        }).setOrigin(.5).setDepth(10).setAlpha(.86);
        this.guardDisciplineBadges.set(guard.id, badge);
      }
      this.createGuardGearBadges(guard);
    });
    this.ensureEnemySprites();
  }

  private createCoreRoleBadge(seal: string, name: string, edge: number, ink: number): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0).setDepth(14);
    const shadow = this.add.graphics();
    shadow.fillStyle(0x120f0c, .9).fillRoundedRect(5, -12, 72, 24, 3);
    shadow.lineStyle(2, edge, .78).strokeRoundedRect(5, -12, 72, 24, 3);
    shadow.lineStyle(1, 0xecd8a4, .22).lineBetween(18, 8, 71, 8);
    shadow.fillStyle(0x120f0c, .9).fillCircle(0, 0, 13);
    shadow.lineStyle(3, edge, .88).strokeCircle(0, 0, 12);
    shadow.lineStyle(1, 0xecd8a4, .46).strokeCircle(0, 0, 8.5);
    shadow.fillStyle(edge, .28).fillCircle(0, 0, 7);
    const text = this.add.text(0, .5, seal, {
      fontFamily: "serif",
      fontSize: "12px",
      color: `#${ink.toString(16).padStart(6, "0")}`,
      stroke: "#21150f",
      strokeThickness: 2,
    }).setOrigin(.5);
    const nameText = this.add.text(42, .5, name, {
      fontFamily: "serif",
      fontSize: "12px",
      color: `#${ink.toString(16).padStart(6, "0")}`,
      stroke: "#21150f",
      strokeThickness: 2,
      letterSpacing: 1,
    }).setOrigin(.5);
    container.add([shadow, text, nameText]);
    return container;
  }

  private createGuardGearBadges(guard: Guard): void {
    const views = battleGearBadges(guard.equipmentIds, 2, guard.equipmentTuning).map((badge) => {
      const container = this.add.container(guard.x, guard.y - 26).setDepth(10.5).setAlpha(badge.tuningLevel > 0 ? .88 : .76);
      const paper = this.add.graphics();
      paper.fillStyle(0x18130f, .9).fillRoundedRect(-8, -8, 16, 16, 2);
      paper.lineStyle(badge.tuningLevel > 1 ? 2 : 1.5, badge.color, badge.tuningLevel > 0 ? .98 : .82).strokeRoundedRect(-8, -8, 16, 16, 2);
      paper.lineStyle(1, 0xead8aa, .18).strokeRoundedRect(-5.5, -5.5, 11, 11, 1);
      if (badge.tuningLevel > 0) {
        paper.fillStyle(0xf0c86f, .94);
        for (let index = 0; index < badge.tuningLevel; index += 1) paper.fillCircle(-4 + index * 4, 10.5, 1.25);
      }
      const seal = this.add.text(0, .5, badge.seal, {
        fontFamily: "serif",
        fontSize: "9px",
        color: `#${badge.color.toString(16).padStart(6, "0")}`,
        stroke: "#17110d",
        strokeThickness: 1,
      }).setOrigin(.5);
      container.add([paper, seal]);
      return { badge, container };
    });
    if (views.length) this.guardGearBadges.set(guard.id, views);
  }

  private ensureEnemySprites(): void {
    this.simulation.enemies.forEach((enemy) => {
      if (this.enemySprites.has(enemy.id)) return;
      const sprite = this.add.image(enemy.x, enemy.y, enemyTextureKey(enemy.type))
        .setOrigin(.5, .86).setScale(enemy.type === "leader" ? .31 : enemy.type === "hooker" ? .27 : enemy.type === "boarder" ? .255 : .245).setDepth(3);
      if (enemy.type === "cutter") sprite.setTint(0xbfa898);
      if (enemy.type === "boarder") sprite.setTint(0xc39b70);
      this.enemySprites.set(enemy.id, sprite);
      this.previousEnemyHp.set(enemy.id, enemy.hp);
      const badgeStyle = enemy.carrier
        ? { seal: "镖", color: "#f3d18a", background: "rgba(113,37,28,.94)" }
        : enemy.clientHunter
          ? { seal: "劫", color: "#f3d18a", background: "rgba(126,42,30,.96)" }
        : ENEMY_THREAT_BADGES[enemy.type];
      if (badgeStyle) {
        const badge = this.add.text(enemy.x, enemy.y - 66, badgeStyle.seal, {
          fontFamily: "serif",
          fontSize: "14px",
          color: badgeStyle.color,
          backgroundColor: badgeStyle.background,
          padding: { x: 5, y: 3 },
          stroke: "#21170f",
          strokeThickness: 2,
        }).setOrigin(.5).setDepth(12).setAlpha(.58);
        this.enemyThreatBadges.set(enemy.id, badge);
      }
    });
  }

  private drawBackdrop(): void {
    const objectiveMode = battleObjectiveMode(this.battleConfig);
    const staticLayer = this.add.graphics();
    staticLayer.setDepth(-1);
    staticLayer.fillStyle(0x17130f, 0.1).fillRect(0, 0, 960, 540);
    staticLayer.fillStyle(0x0d0b08, 0.46).fillRoundedRect(18, 14, 272, 44, 4);
    staticLayer.fillStyle(0x0d0b08, 0.4).fillRoundedRect(806, 235, 126, 48, 4);
    staticLayer.lineStyle(2, 0xd0b46e, 0.17).lineBetween(48, 270, 904, 270);
    if (objectiveMode === "gate-run") {
      staticLayer.fillStyle(0x1b1813, 0.88).fillRect(858, 110, 76, 320);
      staticLayer.fillStyle(0x5a4935, 0.8).fillRect(848, 95, 96, 32);
      staticLayer.fillStyle(0xd0b46e, 0.22).fillTriangle(848, 95, 896, 61, 944, 95);
      staticLayer.fillStyle(0x8f3429, 0.74).fillTriangle(822, 144, 856, 154, 822, 168);
      staticLayer.lineStyle(3, 0xd6bd7b, 0.6).lineBetween(822, 134, 822, 184);
    } else if (objectiveMode === "holdout") {
      staticLayer.lineStyle(2, 0xd6bd7b, 0.2).strokeCircle(148, 270, 92).strokeCircle(148, 270, 112);
    } else if (objectiveMode === "pursuit") {
      staticLayer.fillStyle(0x2a1712, .34).fillRect(916, 84, 18, 372);
      staticLayer.lineStyle(3, 0xb85a46, .62).lineBetween(925, 84, 925, 456);
      staticLayer.fillStyle(0xb85a46, .72).fillTriangle(862, 126, 914, 144, 862, 162);
      staticLayer.lineStyle(3, 0xd8b96e, .5).lineBetween(862, 116, 862, 178);
    }
    this.add.text(30, 24, this.battleConfig.routeName, {
      fontFamily: "serif", fontSize: "19px", color: "#e8d8b2", letterSpacing: 4,
    }).setDepth(2);
    const landmark = objectiveMode === "holdout" ? (this.battleConfig.terrain === "river" ? "渡 船" : "援 旗") : objectiveMode === "gate-run" ? "城 门" : objectiveMode === "pursuit" ? "逃 口" : "关 口";
    this.add.text(833, 248, landmark, { fontFamily: "serif", fontSize: "18px", color: "#e8d8b2" }).setDepth(2);
  }

  update(_time: number, deltaMs: number): void {
    if (this.ended) return;
    const intentBeforeStep = battleAttackIntents(this.simulation)[0] ?? null;
    const pacingBeforeStep = battlePacingState(this.orders.pace, intentBeforeStep, this.orders.paused);
    const battleDelta = deltaMs / 1000 * pacingBeforeStep.timeScale;
    if (pacingBeforeStep.timeScale > 0) {
      const commandStep = advanceBattleCommand(this.orders.command, battleDelta);
      this.orders.command = commandStep.state;
      const input = autoBattleInput(this.simulation, this.orders.command.active, this.orders.techniquePolicy);
      input.retreat = this.orders.retreat;
      this.orders.retreat = false;
      stepBattle(this.simulation, input, battleDelta);
    }
    this.ensureEnemySprites();
    this.playBattleCues();
    if (this.orders.command.active !== this.lastStrategy) {
      this.showStrategyOrder(this.orders.command.active);
      this.lastStrategy = this.orders.command.active;
    }
    if (this.simulation.reinforcementWave > this.lastWave) {
      this.showWaveCallout(this.simulation.reinforcementWave);
      this.lastWave = this.simulation.reinforcementWave;
    }
    if (this.simulation.leaderCommandCount > this.lastLeaderCommand) {
      this.showLeaderCommand();
      this.lastLeaderCommand = this.simulation.leaderCommandCount;
    }
    if (this.simulation.leaderChallengeCount > this.lastLeaderChallenge) {
      this.showLeaderChallenge();
      this.lastLeaderChallenge = this.simulation.leaderChallengeCount;
    }
    if (this.simulation.leaderDefeated && !this.leaderDefeatShown) {
      this.showLeaderDefeat();
      this.leaderDefeatShown = true;
    }
    this.updateEntitySprites();
    this.drawSimulation();
    if (this.time.now - this.lastHudAt > 100) {
      this.lastHudAt = this.time.now;
      const incomingIntents = battleAttackIntents(this.simulation);
      const incomingIntent = incomingIntents[0] ?? null;
      const rearStatus = battleRearThreatStatus(this.simulation);
      const pacing = battlePacingState(this.orders.pace, incomingIntent, this.orders.paused);
      this.reportHud({
        playerHp: Math.round(this.simulation.player.hp),
        cartHp: Math.round((this.simulation.cart.hp / this.simulation.cart.maxHp) * 100),
        horseHp: Math.round((this.simulation.horse.hp / this.simulation.horse.maxHp) * 100),
        cargo: Math.round(this.simulation.cart.cargo),
        progress: battleProgress(this.simulation),
        remainingSeconds: battleTimeRemaining(this.simulation),
        enemies: this.simulation.enemies.filter((enemy) => enemy.hp > 0).length,
        enemyLeaderHp: (() => {
          const leader = this.simulation.enemies.find((enemy) => enemy.type === "leader");
          return leader ? Math.max(0, Math.round(leader.hp / leader.maxHp * 100)) : null;
        })(),
        enemyLeaderPhase: this.simulation.leaderPhase,
        leaderChallengeCount: this.simulation.leaderChallengeCount,
        message: this.simulation.message,
        formation: this.simulation.formation,
        techniqueCooldown: this.simulation.techniqueCooldown,
        morale: Math.round(this.simulation.morale),
        bannerProgress: Math.round(this.simulation.banner.captureProgress),
        bannerState: this.simulation.banner.lost ? "lost" : this.simulation.banner.stolen ? "stolen" : this.simulation.banner.captureProgress > 0 ? "contested" : "secure",
        rescueAvailable: this.simulation.guards.some((guard) => guard.hp <= 0 && !this.simulation.rescuedGuardIds.includes(guard.id)) && this.simulation.guards.some((guard) => guard.hp > 0),
        repairAvailable: battleRepairAvailable(this.simulation),
        repairProgress: Math.round(this.simulation.repairProgress),
        volleyAvailable: battleVolleyAvailable(this.simulation),
        volleyProgress: Math.round(this.simulation.volleyProgress),
        volleyCooldown: this.simulation.volleyCooldown,
        coordinationCount: this.simulation.coordinationCount,
        coordinationActive: this.simulation.coordinationPulse > 0,
        coreComboCount: this.simulation.coreComboCount,
        coreComboActive: this.simulation.coreComboPulse > 0,
        coreComboReadiness: battleCoreComboReadiness(this.simulation),
        coreComboCooldown: this.simulation.coreComboCooldown,
        coreCounterCount: this.simulation.coreCounterCount,
        coreCounterActive: this.simulation.coreCounterPulse > 0,
        rearThreatCount: rearStatus.rearEnemyIds.length,
        rearSurrounded: rearStatus.surrounded || this.simulation.rearSurroundedPulse > 0,
        rearDefenseActive: this.simulation.rearDefensePulse > 0,
        rearDefenseOutcome: this.simulation.rearDefenseOutcome,
        rearTurnCount: this.simulation.rearTurnCount,
        rearGuardCount: this.simulation.rearGuardCount,
        rearHitCount: this.simulation.rearHitCount,
        defenseCounters: this.simulation.defenseCounters,
        defenseBreaches: this.simulation.defenseBreaches,
        defenseOutcome: this.simulation.defenseOutcome,
        defenseActive: this.simulation.defensePulse > 0,
        clientHp: this.simulation.client ? Math.round(this.simulation.client.hp) : null,
        clientThreatened: clientThreatened(this.simulation),
        threat: battleThreatNotice(this.simulation),
        incomingIntent,
        incomingIntents: incomingIntents.slice(0, 3).map((intent) => ({
          ...intent,
          readiness: battleIntentReadiness(this.simulation, intent, this.orders.command.active, this.orders.command.pending),
        })),
        dangerFocus: pacing.dangerFocus,
        timeScale: pacing.timeScale,
        activeStrategy: this.orders.command.active,
        pendingStrategy: this.orders.command.pending,
        commandProgress: Math.round(battleCommandRelayProgress(this.orders.command) * 100),
        commandRemaining: battleCommandRelayRemaining(this.orders.command),
        guards: this.simulation.guards.map((guard) => ({ id: guard.id, name: guard.name, hp: Math.round((guard.hp / guard.maxHp) * 100), discipline: guard.disciplineName ?? undefined, mastery: guard.masteryName ?? undefined, injury: guard.injuryName ?? undefined, support: guard.supportKind ? GUARD_SUPPORT_LABEL[guard.supportKind] : undefined })),
      });
    }
    if (this.simulation.outcome) {
      this.ended = true;
      this.time.delayedCall(650, () => this.reportResult(battleResult(this.simulation)));
    }
  }

  private drawHealth(x: number, y: number, width: number, ratio: number, color: number): void {
    this.renderLayer.fillStyle(0x100e0b, 0.82).fillRoundedRect(x - 2, y - 2, width + 4, 8, 3);
    this.renderLayer.fillStyle(0xd9cda9, 0.2).fillRect(x, y, width, 4);
    this.renderLayer.fillStyle(color, 0.98).fillRect(x, y, width * Math.max(0, ratio), 4);
  }

  private drawDashedLine(graphics: Phaser.GameObjects.Graphics, x1: number, y1: number, x2: number, y2: number, color: number, alpha: number, width: number): void {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.hypot(dx, dy) || 1;
    const step = 19;
    const dash = 11;
    graphics.lineStyle(width, color, alpha);
    for (let cursor = 0; cursor < length; cursor += step) {
      const end = Math.min(length, cursor + dash);
      graphics.lineBetween(x1 + dx * cursor / length, y1 + dy * cursor / length, x1 + dx * end / length, y1 + dy * end / length);
    }
  }

  private drawAttackIntents(): void {
    const state = this.simulation;
    const intents = battleAttackIntents(state);
    for (const intent of intents) {
      const color = intent.enemyType === "torch"
        ? 0xd75d43
        : intent.enemyType === "cutter"
          ? 0xd2854f
          : intent.enemyType === "hooker"
            ? 0xc29a5d
            : intent.enemyType === "archer"
              ? 0xd5bd7b
              : 0xbd6250;
      const pulse = this.reducedMotion ? .54 : .46 + Math.sin(state.elapsed * 18 + intent.fromX * .01) * .12;
      const urgency = .24 + intent.progress * .58;
      const fromX = intent.fromX;
      const fromY = intent.fromY - 12;
      const toX = intent.toX;
      const toY = intent.toY + 8;
      const ranged = intent.enemyType === "archer" || intent.enemyType === "hooker" || intent.enemyType === "torch";
      if (ranged) this.drawDashedLine(this.groundLayer, fromX, fromY, toX, toY, color, urgency * pulse, intent.targetId === "cart" || intent.targetId === state.horse.id ? 3 : 2);
      else {
        const dx = toX - fromX;
        const dy = toY - fromY;
        const length = Math.hypot(dx, dy) || 1;
        const nx = -dy / length;
        const ny = dx / length;
        this.groundLayer.fillStyle(color, .045 + intent.progress * .075)
          .fillTriangle(fromX, fromY, toX + nx * 24, toY + ny * 24, toX - nx * 24, toY - ny * 24);
        this.groundLayer.lineStyle(2, color, urgency * .56).lineBetween(fromX, fromY, toX, toY);
      }
      const radius = 34 - intent.progress * 13;
      this.renderLayer.fillStyle(color, .035 + intent.progress * .07).fillCircle(toX, toY, radius + 7);
      this.renderLayer.lineStyle(3, color, urgency * pulse).strokeCircle(toX, toY, radius);
      this.renderLayer.lineStyle(1, 0xf1ddb0, urgency * .55).strokeCircle(toX, toY, radius + 8);
      this.renderLayer.lineStyle(2, color, urgency * .72)
        .lineBetween(toX - radius - 13, toY, toX - radius + 1, toY)
        .lineBetween(toX + radius - 1, toY, toX + radius + 13, toY)
        .lineBetween(toX, toY - radius - 13, toX, toY - radius + 1)
        .lineBetween(toX, toY + radius - 1, toX, toY + radius + 13);
    }
  }

  private drawPendingOrderRelay(): void {
    const command = this.orders.command;
    if (!command.pending) return;
    const guards = this.simulation.guards.filter((guard) => guard.hp > 0);
    if (!guards.length) return;
    const progress = battleCommandRelayProgress(command);
    const color = battleStrategyColor(command.pending);
    const originX = this.simulation.player.x;
    const originY = this.simulation.player.y - 8;
    const reach = progress * guards.length;
    this.renderLayer.lineStyle(4, color, .88).beginPath().arc(originX, originY, 27, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress).strokePath();
    this.renderLayer.lineStyle(1, 0xf0ddb0, .48).strokeCircle(originX, originY, 34);
    guards.forEach((guard, index) => {
      const local = Phaser.Math.Clamp(reach - index, 0, 1);
      if (local <= 0) return;
      const endX = Phaser.Math.Linear(originX, guard.x, local);
      const endY = Phaser.Math.Linear(originY, guard.y - 5, local);
      this.groundLayer.lineStyle(2, color, .2 + local * .45).lineBetween(originX, originY, endX, endY);
      this.renderLayer.fillStyle(color, .94).fillCircle(endX, endY, 3.5);
      if (local >= 1) {
        this.renderLayer.lineStyle(2, color, .52).strokeCircle(guard.x, guard.y - 5, 17);
        this.renderLayer.lineStyle(1, 0xf0ddb0, .32).strokeCircle(guard.x, guard.y - 5, 23);
      }
    });
  }

  private showStrategyOrder(strategy: BattleStrategy): void {
    const order = {
      balanced: { seal: "衡", label: "临机应变", color: "#d6ba79" },
      breakthrough: { seal: "进", label: "强行开路", color: "#d58a57" },
      "guard-cart": { seal: "车", label: "围车固守", color: "#7fb091" },
      "guard-horses": { seal: "马", label: "护住马匹", color: "#d5a55d" },
      "guard-client": { seal: "人", label: "护住活镖", color: "#d4bd7b" },
      "focus-fire": { seal: "弩", label: "集中齐射", color: "#d6b46f" },
      "repair-cart": { seal: "修", label: "停阵抢修", color: "#d2aa62" },
      rescue: { seal: "援", label: "收阵救人", color: "#8fbd99" },
    }[strategy];
    this.reportMoment(battleOrderMoment(strategy, this.nextOrderMomentId++));
    this.playOrderRelay(strategy);
    const panel = this.add.container(58, 74).setDepth(45);
    const seal = this.add.text(0, 0, order.seal, {
      fontFamily: "serif", fontSize: "27px", color: order.color,
      backgroundColor: "rgba(23,18,13,.88)", padding: { x: 10, y: 7 },
      stroke: "#2b2016", strokeThickness: 2,
    }).setOrigin(0, .5);
    const label = this.add.text(56, 0, order.label, {
      fontFamily: "serif", fontSize: "19px", color: "#ead9b5",
      backgroundColor: "rgba(23,18,13,.72)", padding: { x: 11, y: 8 },
    }).setOrigin(0, .5);
    panel.add([seal, label]);
    if (this.reducedMotion) {
      this.time.delayedCall(500, () => panel.destroy(true));
      return;
    }
    panel.setAlpha(0).setX(42);
    this.tweens.add({ targets: panel, alpha: 1, x: 58, duration: 120, ease: "Quad.easeOut", yoyo: true, hold: 470, onComplete: () => panel.destroy(true) });
  }

  private showDoctrineOpening(): void {
    const doctrine = battleDoctrine(this.simulation.doctrineId);
    if (!doctrine) return;
    this.reportMoment(battleDoctrineMoment(doctrine));
    const panel = this.add.container(58, 77).setDepth(45);
    const seal = this.add.text(0, 0, doctrine.seal, {
      fontFamily: "serif", fontSize: "27px", color: doctrine.color,
      backgroundColor: "rgba(23,18,13,.9)", padding: { x: 10, y: 7 },
      stroke: "#2b2016", strokeThickness: 2,
    }).setOrigin(0, .5);
    const label = this.add.text(56, 0, `预案 · ${doctrine.title}`, {
      fontFamily: "serif", fontSize: "19px", color: "#ead9b5",
      backgroundColor: "rgba(23,18,13,.76)", padding: { x: 11, y: 8 },
    }).setOrigin(0, .5);
    panel.add([seal, label]);
    if (this.reducedMotion) {
      this.time.delayedCall(800, () => panel.destroy(true));
      return;
    }
    panel.setAlpha(0).setX(38);
    this.tweens.add({ targets: panel, alpha: 1, x: 58, duration: 180, ease: "Quad.easeOut", yoyo: true, hold: 1050, onComplete: () => panel.destroy(true) });
  }

  private playOrderRelay(strategy: BattleStrategy): void {
    const color = battleStrategyColor(strategy);
    const originX = this.simulation.player.x;
    const originY = this.simulation.player.y - 8;
    const wave = this.add.graphics().setPosition(originX, originY).setDepth(39);
    wave.lineStyle(4, color, .86).strokeCircle(0, 0, 18);
    wave.lineStyle(1, 0xf1deb0, .58).strokeCircle(0, 0, 30);
    if (this.reducedMotion) {
      this.time.delayedCall(220, () => wave.destroy());
      return;
    }
    this.tweens.add({ targets: wave, scale: 3.8, alpha: 0, duration: 620, ease: "Quad.easeOut", onComplete: () => wave.destroy() });
    this.simulation.guards.filter((guard) => guard.hp > 0).forEach((guard, index) => {
      const relayLine = this.add.graphics().setDepth(38);
      relayLine.lineStyle(2, color, .34).lineBetween(originX, originY, guard.x, guard.y - 4);
      const marker = this.add.circle(originX, originY, 4, color, .95).setDepth(40);
      const delay = index * 58;
      relayLine.setAlpha(0);
      this.tweens.add({ targets: relayLine, alpha: .72, duration: 80, delay, yoyo: true, hold: 130, onComplete: () => relayLine.destroy() });
      this.tweens.add({
        targets: marker,
        x: guard.x,
        y: guard.y - 4,
        duration: 210,
        delay,
        ease: "Cubic.easeOut",
        onComplete: () => {
          marker.destroy();
          this.showImpact(guard.x, guard.y - 8, color, false);
          const badge = this.guardDisciplineBadges.get(guard.id);
          if (badge) this.tweens.add({ targets: badge, scale: 1.3, duration: 90, yoyo: true, ease: "Quad.easeOut" });
          for (const gearView of this.guardGearBadges.get(guard.id) ?? []) {
            if (!battleGearRespondsToStrategy(gearView.badge, strategy)) continue;
            this.guardGearOrderPulseUntil.set(`${guard.id}:${gearView.badge.equipmentId}`, this.simulation.elapsed + .82);
          }
        },
      });
    });
  }

  private showWaveCallout(wave: number): void {
    const panel = this.add.container(902, 78).setDepth(46);
    const flag = this.add.graphics();
    flag.fillStyle(0x351713, .9).fillRoundedRect(-194, -25, 194, 50, 3);
    flag.lineStyle(2, 0xa34838, .72).strokeRoundedRect(-194, -25, 194, 50, 3);
    flag.fillStyle(0x963c31, .9).fillTriangle(-194, -25, -214, 0, -194, 25);
    const text = this.add.text(-15, 0, wave >= 4 ? "最后一拨 · 守住车阵" : `敌援再至 · 第 ${wave + 1} 拨`, {
      fontFamily: "serif", fontSize: "18px", color: "#f0d5aa", letterSpacing: 2,
    }).setOrigin(1, .5);
    panel.add([flag, text]);
    if (this.reducedMotion) {
      this.time.delayedCall(650, () => panel.destroy(true));
      return;
    }
    panel.setAlpha(0).setX(940);
    this.tweens.add({ targets: panel, x: 902, alpha: 1, duration: 160, ease: "Back.easeOut", yoyo: true, hold: 720, onComplete: () => panel.destroy(true) });
  }

  private showLeaderCommand(): void {
    const panel = this.add.container(902, 138).setDepth(47);
    const flag = this.add.graphics();
    flag.fillStyle(0x471914, .94).fillRoundedRect(-228, -27, 228, 54, 3);
    flag.lineStyle(2, 0xd06b4f, .82).strokeRoundedRect(-228, -27, 228, 54, 3);
    flag.fillStyle(0xb64435, .96).fillTriangle(-228, -27, -250, 0, -228, 27);
    const seal = this.add.text(-205, 0, "令", {
      fontFamily: "serif", fontSize: "22px", color: "#f1cb7c", stroke: "#32130f", strokeThickness: 3,
    }).setOrigin(.5);
    const label = this.add.text(-18, 0, "匪首号令 · 群匪压阵", {
      fontFamily: "serif", fontSize: "17px", color: "#f0d5aa", letterSpacing: 2,
    }).setOrigin(1, .5);
    panel.add([flag, seal, label]);
    if (this.reducedMotion) {
      this.time.delayedCall(720, () => panel.destroy(true));
      return;
    }
    panel.setAlpha(0).setX(948);
    this.tweens.add({ targets: panel, x: 902, alpha: 1, duration: 150, ease: "Back.easeOut", yoyo: true, hold: 900, onComplete: () => panel.destroy(true) });
  }

  private showLeaderChallenge(): void {
    const panel = this.add.container(902, 138).setDepth(50);
    const flag = this.add.graphics();
    flag.fillStyle(0x551813, .97).fillRoundedRect(-272, -30, 272, 60, 3);
    flag.lineStyle(3, 0xe27657, .92).strokeRoundedRect(-272, -30, 272, 60, 3);
    flag.fillStyle(0xc34837, .98).fillTriangle(-272, -30, -298, 0, -272, 30);
    const seal = this.add.text(-242, 0, "战", {
      fontFamily: "serif", fontSize: "25px", color: "#f4d58c", stroke: "#35110d", strokeThickness: 3,
    }).setOrigin(.5);
    const label = this.add.text(-18, 0, `弃旗逼战 · 直取${this.simulation.player.name}`, {
      fontFamily: "serif", fontSize: "18px", color: "#f4ddbb", letterSpacing: 2,
    }).setOrigin(1, .5);
    panel.add([flag, seal, label]);
    if (this.reducedMotion) {
      this.time.delayedCall(980, () => panel.destroy(true));
      return;
    }
    panel.setAlpha(0).setX(960);
    this.tweens.add({ targets: panel, x: 902, alpha: 1, duration: 170, ease: "Back.easeOut", yoyo: true, hold: 1120, onComplete: () => panel.destroy(true) });
    this.cameras.main.shake(160, .0042);
    this.cameras.main.setZoom(1.018);
    this.tweens.add({ targets: this.cameras.main, zoom: 1, duration: 560, ease: "Cubic.easeOut" });
  }

  private showLeaderDefeat(): void {
    const panel = this.add.container(902, 138).setDepth(48);
    const flag = this.add.graphics();
    flag.fillStyle(0x21352a, .95).fillRoundedRect(-226, -27, 226, 54, 3);
    flag.lineStyle(2, 0xc5a75e, .82).strokeRoundedRect(-226, -27, 226, 54, 3);
    flag.fillStyle(0xb98a42, .92).fillTriangle(-226, -27, -248, 0, -226, 27);
    const seal = this.add.text(-203, 0, "破", {
      fontFamily: "serif", fontSize: "22px", color: "#f2d488", stroke: "#17241c", strokeThickness: 3,
    }).setOrigin(.5);
    const label = this.add.text(-18, 0, "匪首旗倒 · 群匪失令", {
      fontFamily: "serif", fontSize: "17px", color: "#e9ddb9", letterSpacing: 2,
    }).setOrigin(1, .5);
    panel.add([flag, seal, label]);
    if (this.reducedMotion) {
      this.time.delayedCall(820, () => panel.destroy(true));
      return;
    }
    panel.setAlpha(0).setX(948);
    this.tweens.add({ targets: panel, x: 902, alpha: 1, duration: 150, ease: "Back.easeOut", yoyo: true, hold: 980, onComplete: () => panel.destroy(true) });
  }

  private showDamage(cue: BattleCue, color: string): void {
    const value = Math.max(1, Math.round(cue.amount));
    const text = this.add.text(cue.toX, cue.toY - 50, `-${value}`, {
      fontFamily: "serif", fontSize: cue.kind === "technique" ? "21px" : "15px", color,
      stroke: "#19120d", strokeThickness: 4,
    }).setOrigin(.5).setDepth(48);
    if (this.reducedMotion) {
      this.time.delayedCall(260, () => text.destroy());
      return;
    }
    this.tweens.add({ targets: text, y: text.y - 28, alpha: 0, duration: 520, ease: "Cubic.easeOut", onComplete: () => text.destroy() });
  }

  private showImpact(x: number, y: number, color: number, strong = false): void {
    const impact = this.add.graphics().setPosition(x, y).setDepth(44);
    impact.lineStyle(strong ? 4 : 3, color, .92);
    const rays = strong ? 7 : 5;
    for (let index = 0; index < rays; index += 1) {
      const angle = (Math.PI * 2 * index) / rays + .24;
      const inner = strong ? 8 : 5;
      const outer = strong ? 26 : 17;
      impact.lineBetween(Math.cos(angle) * inner, Math.sin(angle) * inner, Math.cos(angle) * outer, Math.sin(angle) * outer);
    }
    impact.fillStyle(color, .36).fillCircle(0, 0, strong ? 11 : 7);
    if (this.reducedMotion) {
      this.time.delayedCall(120, () => impact.destroy());
      return;
    }
    this.tweens.add({ targets: impact, scale: 1.35, alpha: 0, duration: strong ? 300 : 220, ease: "Quad.easeOut", onComplete: () => impact.destroy() });
  }

  private showEnemyDefeat(enemy: Enemy, index: number): void {
    const leader = enemy.type === "leader";
    this.showDefeatBurst(enemy.x, enemy.y + 16, leader ? "leader" : "enemy", index);
    if (!leader || this.reducedMotion) return;
    this.cameras.main.shake(185, .0048);
    this.cameras.main.setZoom(1.022);
    this.tweens.add({ targets: this.cameras.main, zoom: 1, duration: 620, ease: "Cubic.easeOut" });
  }

  private showGuardDown(guard: Guard, index: number): void {
    this.showDefeatBurst(guard.x, guard.y + 15, "guard", index);
  }

  private showDefeatBurst(x: number, y: number, kind: "enemy" | "leader" | "guard", index: number): void {
    const leader = kind === "leader";
    const guard = kind === "guard";
    const accent = leader ? 0xc56845 : guard ? 0xb57755 : 0x8d4b38;
    const ink = guard ? 0x213026 : 0x211915;
    const stain = this.add.graphics().setPosition(x, y + (leader ? 7 : 4)).setDepth(1.4).setAngle((index % 2 ? -1 : 1) * (leader ? 7 : 12));
    stain.fillStyle(ink, leader ? .32 : .22).fillEllipse(0, 0, leader ? 82 : 55, leader ? 20 : 14);
    stain.fillStyle(accent, leader ? .16 : .1).fillEllipse((index % 3 - 1) * 7, -1, leader ? 48 : 32, leader ? 11 : 8);

    const burst = this.add.graphics().setPosition(x, y - (leader ? 17 : 11)).setDepth(47);
    const rayCount = leader ? 12 : 8;
    for (let ray = 0; ray < rayCount; ray += 1) {
      const angle = (Math.PI * 2 * ray) / rayCount + index * .19;
      const inner = leader ? 9 + (ray % 3) * 2 : 6 + (ray % 2) * 2;
      const outer = leader ? 39 + (ray % 4) * 8 : 25 + (ray % 3) * 6;
      burst.lineStyle(ray % 3 === 0 ? 4 : 2, ray % 2 ? accent : ink, leader ? .88 : .72)
        .lineBetween(Math.cos(angle) * inner, Math.sin(angle) * inner, Math.cos(angle) * outer, Math.sin(angle) * outer);
    }
    burst.fillStyle(ink, .7).fillCircle(0, 0, leader ? 17 : 11);
    burst.fillStyle(accent, .58).fillCircle(-3, -2, leader ? 9 : 6);

    const fleckCount = leader ? 13 : 7;
    for (let fleckIndex = 0; fleckIndex < fleckCount; fleckIndex += 1) {
      const angle = (Math.PI * 2 * fleckIndex) / fleckCount + index * .31;
      const distance = (leader ? 39 : 25) + (fleckIndex % 4) * (leader ? 8 : 5);
      const fleck = this.add.ellipse(x, y - (leader ? 17 : 11), leader ? 9 : 6, leader ? 4 : 3, fleckIndex % 3 ? ink : accent, .82)
        .setDepth(46).setRotation(angle);
      if (this.reducedMotion) {
        fleck.setPosition(x + Math.cos(angle) * distance * .35, y - 11 + Math.sin(angle) * distance * .35).setAlpha(.38);
        this.time.delayedCall(180, () => fleck.destroy());
      } else {
        this.tweens.add({
          targets: fleck,
          x: x + Math.cos(angle) * distance,
          y: y - 11 + Math.sin(angle) * distance * .72,
          alpha: 0,
          scaleX: .35,
          duration: leader ? 620 : 430,
          ease: "Cubic.easeOut",
          onComplete: () => fleck.destroy(),
        });
      }
    }

    const stampText = leader ? "破" : guard ? "伤" : "伏";
    const stamp = this.add.text(x, y - (leader ? 75 : 58), stampText, {
      fontFamily: "serif", fontSize: leader ? "28px" : "18px", color: leader ? "#f0ce82" : guard ? "#d9b27b" : "#cda679",
      backgroundColor: leader ? "rgba(75,28,21,.9)" : guard ? "rgba(31,52,39,.84)" : "rgba(37,27,21,.76)",
      padding: { x: leader ? 9 : 6, y: leader ? 6 : 4 }, stroke: "#1a120d", strokeThickness: leader ? 3 : 2,
    }).setOrigin(.5).setDepth(50).setAngle((index % 2 ? -1 : 1) * 4);

    if (this.reducedMotion) {
      this.time.delayedCall(260, () => { burst.destroy(); stamp.destroy(); });
      return;
    }
    burst.setScale(.72).setAlpha(.9);
    this.tweens.add({ targets: burst, scale: leader ? 1.55 : 1.28, alpha: 0, duration: leader ? 560 : 390, ease: "Quad.easeOut", onComplete: () => burst.destroy() });
    stamp.setAlpha(0).setScale(.72);
    this.tweens.add({ targets: stamp, alpha: 1, scale: 1, y: stamp.y - 8, duration: 130, ease: "Back.easeOut", yoyo: true, hold: leader ? 620 : 300, onComplete: () => stamp.destroy() });
  }

  private showEquipmentCallout(cue: BattleCue, color: string): void {
    if (!cue.label) return;
    const text = this.add.text(cue.fromX, cue.fromY - 56, cue.label, {
      fontFamily: "serif", fontSize: "13px", color,
      backgroundColor: "rgba(24,19,14,.86)", padding: { x: 6, y: 3 },
      stroke: "#17110d", strokeThickness: 2,
    }).setOrigin(.5).setDepth(49);
    if (this.reducedMotion) {
      this.time.delayedCall(420, () => text.destroy());
      return;
    }
    text.setAlpha(0).setScale(.86);
    this.tweens.add({ targets: text, alpha: 1, scale: 1, y: text.y - 10, duration: 140, ease: "Back.easeOut", yoyo: true, hold: 380, onComplete: () => text.destroy() });
  }

  private showMasteryCallout(cue: BattleCue): void {
    if (!cue.label) return;
    const x = Phaser.Math.Clamp(cue.fromX, 102, 858);
    const y = Phaser.Math.Clamp(cue.fromY - 76, 72, 430);
    const panel = this.add.container(x, y).setDepth(52);
    const paper = this.add.graphics();
    paper.fillStyle(0x17231b, .94).fillRoundedRect(-82, -21, 164, 42, 3);
    paper.lineStyle(2, 0xc6a35d, .8).strokeRoundedRect(-82, -21, 164, 42, 3);
    paper.lineStyle(1, 0xe5ce8b, .32).lineBetween(-62, 14, 72, 14);
    paper.fillStyle(0xb17b37, .88).fillTriangle(-82, -21, -96, 0, -82, 21);
    const seal = this.add.text(-61, 0, "绝", {
      fontFamily: "serif", fontSize: "20px", color: "#f0d58b", stroke: "#182119", strokeThickness: 3,
    }).setOrigin(.5);
    const label = this.add.text(13, 0, cue.label, {
      fontFamily: "serif", fontSize: "15px", color: "#e9dbb5", letterSpacing: 2,
    }).setOrigin(.5);
    panel.add([paper, seal, label]);
    if (this.reducedMotion) {
      this.time.delayedCall(620, () => panel.destroy(true));
      return;
    }
    panel.setAlpha(0).setScale(.82).setY(y + 8);
    this.tweens.add({ targets: panel, alpha: 1, scale: 1, y, duration: 150, ease: "Back.easeOut", yoyo: true, hold: 620, onComplete: () => panel.destroy(true) });
  }

  private showRescueCallout(cue: BattleCue): void {
    const x = Phaser.Math.Clamp(cue.toX, 116, 844);
    const y = Phaser.Math.Clamp(cue.toY - 82, 72, 420);
    const panel = this.add.container(x, y).setDepth(53);
    const paper = this.add.graphics();
    paper.fillStyle(0x1d3428, .96).fillRoundedRect(-92, -23, 184, 46, 3);
    paper.lineStyle(2, 0xb8b36d, .82).strokeRoundedRect(-92, -23, 184, 46, 3);
    paper.fillStyle(0x6d9b79, .9).fillTriangle(-92, -23, -108, 0, -92, 23);
    const seal = this.add.text(-68, 0, "援", {
      fontFamily: "serif", fontSize: "21px", color: "#e9d58d", stroke: "#142219", strokeThickness: 3,
    }).setOrigin(.5);
    const label = this.add.text(18, 0, cue.label ?? "抬回阵中", {
      fontFamily: "serif", fontSize: "15px", color: "#e7ddbd", letterSpacing: 2,
    }).setOrigin(.5);
    panel.add([paper, seal, label]);
    if (this.reducedMotion) {
      this.time.delayedCall(720, () => panel.destroy(true));
      return;
    }
    panel.setAlpha(0).setScale(.84).setY(y + 8);
    this.tweens.add({ targets: panel, alpha: 1, scale: 1, y, duration: 150, ease: "Back.easeOut", yoyo: true, hold: 760, onComplete: () => panel.destroy(true) });
  }

  private playHeal(cue: BattleCue): void {
    const revival = cue.kind === "revive" || cue.kind === "rescue";
    const color = revival ? 0xd0b45f : 0x82b894;
    const rings = this.add.graphics().setPosition(cue.toX, cue.toY - 15).setDepth(44);
    rings.lineStyle(revival ? 5 : 3, color, .8).strokeCircle(0, 0, revival ? 26 : 22);
    rings.lineStyle(1, revival ? 0xf2dda1 : 0xd8e7c6, .65).strokeCircle(0, 0, revival ? 41 : 34);
    rings.fillStyle(color, .4).fillRect(-3, -13, 6, 26).fillRect(-13, -3, 26, 6);
    const value = this.add.text(cue.toX, cue.toY - 52, `+${Math.round(cue.amount)}`, {
      fontFamily: "serif", fontSize: revival ? "20px" : "16px", color: revival ? "#efd58a" : "#a9d3ad", stroke: "#142019", strokeThickness: 4,
    }).setOrigin(.5).setDepth(48);
    if (cue.kind === "rescue") this.showRescueCallout(cue);
    else if (revival) this.showMasteryCallout(cue);
    else this.showEquipmentCallout(cue, "#a8cfaa");
    if (this.reducedMotion) {
      this.time.delayedCall(280, () => { rings.destroy(); value.destroy(); });
      return;
    }
    this.tweens.add({ targets: rings, scale: 1.65, alpha: 0, duration: 560, ease: "Quad.easeOut", onComplete: () => rings.destroy() });
    this.tweens.add({ targets: value, y: value.y - 24, alpha: 0, duration: 620, ease: "Cubic.easeOut", onComplete: () => value.destroy() });
  }

  private playRepair(cue: BattleCue): void {
    const x = Phaser.Math.Clamp(cue.toX, 118, 842);
    const y = Phaser.Math.Clamp(cue.toY - 76, 74, 414);
    const repair = this.add.container(x, y).setDepth(54);
    const paper = this.add.graphics();
    paper.fillStyle(0x332717, .97).fillRoundedRect(-104, -25, 208, 50, 3);
    paper.lineStyle(2, 0xd1aa61, .88).strokeRoundedRect(-104, -25, 208, 50, 3);
    paper.lineStyle(1, 0xf0d38b, .28).lineBetween(-62, 16, 90, 16);
    paper.fillStyle(0xa66f33, .94).fillTriangle(-104, -25, -121, 0, -104, 25);
    const seal = this.add.text(-77, 0, "修", {
      fontFamily: "serif", fontSize: "22px", color: "#f2d48b", stroke: "#271a0d", strokeThickness: 3,
    }).setOrigin(.5);
    const label = this.add.text(20, -5, cue.label ?? "车架抢修", {
      fontFamily: "serif", fontSize: "15px", color: "#eadab7", letterSpacing: 2,
    }).setOrigin(.5);
    const value = this.add.text(20, 13, `车况 +${Math.max(1, Math.round(cue.amount / this.simulation.cart.maxHp * 100))}`, {
      fontFamily: "serif", fontSize: "12px", color: "#d8b96f", letterSpacing: 1,
    }).setOrigin(.5);
    repair.add([paper, seal, label, value]);

    const sparks = this.add.graphics().setPosition(cue.toX, cue.toY + 9).setDepth(45);
    for (let index = 0; index < 8; index += 1) {
      const angle = -2.75 + index * .39;
      const inner = 10 + (index % 2) * 3;
      const outer = 24 + (index % 3) * 5;
      sparks.lineStyle(index % 2 ? 2 : 3, index % 2 ? 0xf2d28a : 0xb87935, .88)
        .lineBetween(Math.cos(angle) * inner, Math.sin(angle) * inner, Math.cos(angle) * outer, Math.sin(angle) * outer);
    }
    sparks.lineStyle(3, 0xd3ae61, .72).strokeCircle(0, 0, 19);
    if (this.reducedMotion) {
      this.time.delayedCall(760, () => { repair.destroy(true); sparks.destroy(); });
      return;
    }
    repair.setAlpha(0).setScale(.84).setY(y + 8);
    this.tweens.add({ targets: repair, alpha: 1, scale: 1, y, duration: 160, ease: "Back.easeOut", yoyo: true, hold: 900, onComplete: () => repair.destroy(true) });
    this.tweens.add({ targets: sparks, scale: 1.55, angle: 24, alpha: 0, duration: 620, ease: "Quad.easeOut", onComplete: () => sparks.destroy() });
  }

  private playCoreCounterFigures(cue: BattleCue): void {
    if (!cue.assistSourceId) return;
    const focus = battleCoreFocusVisual(this.battleConfig.leader?.coreCombatFocusId);
    const deputySprite = this.guardSprites.get(cue.assistSourceId);
    const deputyEcho = this.add.image(cue.assistX ?? cue.toX, (cue.assistY ?? cue.toY) + 21, deputySprite?.texture.key ?? "battle-guard-1")
      .setOrigin(.5, .86).setDepth(50).setScale(.275).setTint(focus.secondary).setAlpha(.25);
    const leaderEcho = this.add.image(cue.toX, cue.toY + 25, this.leaderSprite.texture.key)
      .setOrigin(.5, .86).setDepth(51).setScale(.33).setTint(focus.primary).setAlpha(.28);
    deputyEcho.setBlendMode(Phaser.BlendModes.ADD);
    leaderEcho.setBlendMode(Phaser.BlendModes.ADD);
    const deputyFacing = Math.sign(cue.toX - (cue.assistX ?? cue.toX)) || 1;
    const leaderFacing = Math.sign(cue.fromX - cue.toX) || 1;
    deputyEcho.setFlipX(deputyFacing < 0);
    leaderEcho.setFlipX(leaderFacing < 0);

    const clash = this.add.graphics().setPosition(cue.toX, cue.toY - 14).setDepth(52);
    if (focus.choreography === "ward") {
      clash.lineStyle(9, focus.primary, .27).beginPath().arc(0, 0, 39, -2.55, -.58).strokePath();
      clash.beginPath().arc(0, 0, 39, .58, 2.55).strokePath();
      clash.lineStyle(3, focus.highlight, .94).beginPath().arc(0, 0, 34, -2.55, -.58).strokePath();
      clash.beginPath().arc(0, 0, 34, .58, 2.55).strokePath();
      clash.lineStyle(2, focus.secondary, .86).strokeCircle(0, 0, 22).lineBetween(-34, 0, 34, 0);
    } else if (focus.choreography === "hunt") {
      clash.setPosition(cue.fromX, cue.fromY - 14);
      clash.lineStyle(7, focus.secondary, .25).strokeCircle(0, 0, 38);
      clash.lineStyle(3, focus.highlight, .93).strokeCircle(0, 0, 31);
      clash.lineStyle(3, focus.primary, .88).lineBetween(-49, 0, -22, 0).lineBetween(22, 0, 49, 0).lineBetween(0, -49, 0, -22).lineBetween(0, 22, 0, 49);
      clash.lineStyle(3, focus.secondary, .9).lineBetween(-35, 30, 37, -32);
    } else {
      clash.lineStyle(8, focus.primary, .3).lineBetween(-38, -30, 38, 30).lineBetween(-38, 30, 38, -30);
      clash.lineStyle(3, focus.highlight, .94).lineBetween(-42, -33, 42, 33).lineBetween(-42, 33, 42, -33);
      clash.lineStyle(2, focus.secondary, .85).strokeCircle(0, 0, 34);
    }
    const counterValue = this.add.text(cue.fromX, cue.fromY - 58, `反 -${Math.max(1, Math.round(cue.counterAmount ?? 0))}`, {
      fontFamily: "serif", fontSize: "18px", color: battleColorHex(focus.primary), stroke: "#24150e", strokeThickness: 4,
    }).setOrigin(.5).setDepth(55);

    if (this.reducedMotion) {
      deputyEcho.setPosition(cue.toX - 24, cue.toY + 20).setAlpha(.36);
      leaderEcho.setPosition(cue.fromX - leaderFacing * 18, cue.fromY + 20).setAlpha(.36);
      this.time.delayedCall(340, () => { deputyEcho.destroy(); leaderEcho.destroy(); clash.destroy(); counterValue.destroy(); });
      return;
    }

    deputyEcho.setAlpha(0);
    leaderEcho.setAlpha(0);
    clash.setAlpha(0).setScale(.7);
    counterValue.setAlpha(0);
    this.tweens.add({
      targets: deputyEcho,
      x: cue.toX - deputyFacing * 22,
      y: cue.toY + 20,
      alpha: .76,
      duration: 155,
      ease: "Cubic.easeIn",
      onComplete: () => this.tweens.add({ targets: deputyEcho, alpha: 0, duration: 210, onComplete: () => deputyEcho.destroy() }),
    });
    this.tweens.add({ targets: clash, alpha: 1, scale: 1.08, delay: 125, duration: 70, yoyo: true, hold: 90, onComplete: () => clash.destroy() });
    this.tweens.add({
      targets: leaderEcho,
      x: cue.fromX - leaderFacing * 18,
      y: cue.fromY + 20,
      alpha: .78,
      delay: 145,
      duration: 185,
      ease: "Cubic.easeIn",
      onComplete: () => this.tweens.add({ targets: leaderEcho, x: leaderEcho.x + leaderFacing * 26, alpha: 0, duration: 210, onComplete: () => leaderEcho.destroy() }),
    });
    this.time.delayedCall(285, () => {
      this.showImpact(cue.fromX, cue.fromY - 16, focus.primary, true);
      counterValue.setAlpha(1);
      this.tweens.add({ targets: counterValue, y: counterValue.y - 24, alpha: 0, duration: 560, ease: "Cubic.easeOut", onComplete: () => counterValue.destroy() });
      this.cameras.main.shake(150, focus.cameraShake);
    });
    this.cameras.main.setZoom(focus.choreography === "hunt" ? 1.03 : focus.choreography === "cross" ? 1.027 : 1.022);
    this.tweens.add({ targets: this.cameras.main, zoom: 1, delay: 260, duration: 580, ease: "Cubic.easeOut" });
  }

  private playDefenseResponse(cue: BattleCue): void {
    const countered = cue.kind === "counter";
    const coreCounter = countered && Boolean(cue.assistSourceId);
    const focus = battleCoreFocusVisual(this.battleConfig.leader?.coreCombatFocusId);
    const color = coreCounter ? focus.primary : countered ? 0x86b493 : 0xc65f4d;
    const delay = cue.actionLabel === "攒弓欲射" || cue.actionLabel === "引火掷车" ? 220 : 70;
    const render = () => {
      const targetY = cue.toY - 14;
      const ward = this.add.graphics().setPosition(cue.toX, targetY).setDepth(47);
      if (countered) {
        ward.lineStyle(6, color, .8).beginPath().arc(0, 0, 35, -2.58, -.56).strokePath();
        ward.beginPath().arc(0, 0, 35, .56, 2.58).strokePath();
        ward.lineStyle(2, 0xe8dcae, .78).strokeCircle(0, 0, 23);
        ward.lineStyle(3, color, .85).lineBetween(-31, -8, -15, 0).lineBetween(-31, 8, -15, 0).lineBetween(31, -8, 15, 0).lineBetween(31, 8, 15, 0);
        if (coreCounter && focus.choreography === "cross") ward.lineStyle(3, focus.secondary, .88).lineBetween(-33, -28, 33, 28).lineBetween(-33, 28, 33, -28);
        if (coreCounter && focus.choreography === "ward") {
          ward.lineStyle(3, focus.secondary, .9).beginPath().arc(0, 0, 43, -2.5, -.64).strokePath();
          ward.beginPath().arc(0, 0, 43, .64, 2.5).strokePath();
        }
        if (coreCounter && focus.choreography === "hunt") ward.lineStyle(3, focus.secondary, .9).strokeCircle(0, 0, 40).lineBetween(-49, 0, 49, 0);
      } else {
        ward.fillStyle(0x8f2f27, .22).fillCircle(0, 0, 31);
        ward.lineStyle(4, color, .9).lineBetween(-32, -27, -6, -4).lineBetween(-6, -4, -19, 17).lineBetween(-6, -4, 9, 8).lineBetween(9, 8, 31, 29);
        ward.lineStyle(2, 0xf0b181, .72).lineBetween(9, 8, 28, -13).lineBetween(-6, -4, 4, -31);
      }

      const x = Phaser.Math.Clamp(cue.toX, 126, 834);
      const y = Phaser.Math.Clamp(cue.toY - 86, 70, 418);
      const panel = this.add.container(x, y).setDepth(57);
      const paper = this.add.graphics();
      paper.fillStyle(coreCounter ? focus.panel : countered ? 0x1e3527 : 0x481b16, .97).fillRoundedRect(-108, -25, 216, 50, 3);
      paper.lineStyle(2, color, .9).strokeRoundedRect(-108, -25, 216, 50, 3);
      paper.lineStyle(1, countered ? 0xcbd5a4 : 0xe2a273, .28).lineBetween(-64, 16, 94, 16);
      paper.fillStyle(coreCounter ? focus.edge : countered ? 0x5f956f : 0xa44134, .95).fillTriangle(-108, -25, -126, 0, -108, 25);
      const seal = this.add.text(-82, 0, coreCounter ? focus.seal : countered ? "应" : "破", {
        fontFamily: "serif", fontSize: "22px", color: coreCounter ? battleColorHex(focus.highlight) : countered ? "#dce1ae" : "#f0ad80", stroke: "#22150f", strokeThickness: 3,
      }).setOrigin(.5);
      const title = this.add.text(12, -6, cue.label ?? (countered ? "阵令对症" : "阵线失位"), {
        fontFamily: "serif", fontSize: "16px", color: "#edddb9", letterSpacing: 3,
      }).setOrigin(.5);
      const detail = this.add.text(12, 14, coreCounter
        ? `卸伤 ${Math.max(1, Math.round(cue.amount))} · 反击 ${Math.max(1, Math.round(cue.counterAmount ?? 0))}`
        : `${cue.targetLabel ?? "车马"} · ${countered ? `实受 ${Math.max(1, Math.round(cue.amount))}` : "宜立即换阵"}`, {
        fontFamily: "serif", fontSize: "10px", color: coreCounter ? battleColorHex(focus.primary) : countered ? "#a8c4a5" : "#dc9278", letterSpacing: 1,
      }).setOrigin(.5);
      panel.add([paper, seal, title, detail]);
      if (coreCounter) this.playCoreCounterFigures(cue);
      if (this.reducedMotion) {
        this.time.delayedCall(720, () => { ward.destroy(); panel.destroy(true); });
        return;
      }
      panel.setAlpha(0).setScale(.86).setY(y + 8);
      this.tweens.add({ targets: ward, scale: countered ? 1.5 : 1.32, angle: countered ? 12 : 0, alpha: 0, duration: 520, ease: "Cubic.easeOut", onComplete: () => ward.destroy() });
      this.tweens.add({ targets: panel, alpha: 1, scale: 1, y, duration: 130, ease: "Back.easeOut", yoyo: true, hold: 650, onComplete: () => panel.destroy(true) });
      if (!coreCounter) this.cameras.main.shake(countered ? 70 : 125, countered ? .0014 : .0034);
    };
    if (delay > 0) this.time.delayedCall(delay, render); else render();
  }

  private playCoreComboFigures(cue: BattleCue, timing: BattleCoreComboTiming): void {
    const focus = battleCoreFocusVisual(this.battleConfig.leader?.coreCombatFocusId);
    const deputySprite = cue.assistSourceId ? this.guardSprites.get(cue.assistSourceId) : undefined;
    const deputyTexture = deputySprite?.texture.key ?? "battle-guard-1";
    const targetY = cue.toY + 20;
    const leaderDirection = Math.sign(cue.toX - cue.fromX) || 1;
    const deputyDirection = Math.sign(cue.toX - (cue.assistX ?? cue.fromX)) || -1;
    const leaderEcho = this.add.image(cue.fromX, cue.fromY + 25, this.leaderSprite.texture.key)
      .setOrigin(.5, .86).setDepth(45).setScale(.325).setFlipX(leaderDirection < 0).setTint(focus.primary).setAlpha(.16);
    const deputyEcho = this.add.image(cue.assistX ?? cue.fromX, (cue.assistY ?? cue.fromY) + 21, deputyTexture)
      .setOrigin(.5, .86).setDepth(45).setScale(.275).setFlipX(deputyDirection < 0).setTint(focus.secondary).setAlpha(.16);
    leaderEcho.setBlendMode(Phaser.BlendModes.ADD);
    deputyEcho.setBlendMode(Phaser.BlendModes.ADD);

    const signature = this.add.graphics().setPosition(cue.toX, cue.toY - 15).setDepth(48).setAlpha(0);
    if (focus.choreography === "ward") {
      signature.lineStyle(10, focus.primary, .2).beginPath().arc(0, 0, 43, -2.54, -.6).strokePath();
      signature.beginPath().arc(0, 0, 43, .6, 2.54).strokePath();
      signature.lineStyle(3, focus.highlight, .9).beginPath().arc(0, 0, 36, -2.54, -.6).strokePath();
      signature.beginPath().arc(0, 0, 36, .6, 2.54).strokePath();
      signature.lineStyle(2, focus.secondary, .82).strokeCircle(0, 0, 23);
    } else if (focus.choreography === "hunt") {
      signature.lineStyle(8, focus.secondary, .22).strokeCircle(0, 0, 43);
      signature.lineStyle(3, focus.highlight, .92).strokeCircle(0, 0, 34);
      signature.lineStyle(3, focus.primary, .86).lineBetween(-53, 0, -23, 0).lineBetween(23, 0, 53, 0).lineBetween(0, -53, 0, -23).lineBetween(0, 23, 0, 53);
      signature.lineStyle(2, focus.secondary, .86).strokeRect(-17, -17, 34, 34);
    } else {
      signature.lineStyle(7, focus.primary, .24).lineBetween(-42, -31, 42, 31).lineBetween(-42, 31, 42, -31);
      signature.lineStyle(3, focus.highlight, .9).lineBetween(-45, -34, 45, 34).lineBetween(-45, 34, 45, -34);
      signature.lineStyle(2, focus.secondary, .82).strokeCircle(0, 0, 37);
    }

    const slash = (angle: number, color: number, delay: number): void => {
      const cut = this.add.graphics().setPosition(cue.toX, cue.toY - 15).setDepth(49).setAngle(angle).setAlpha(0).setScale(.72);
      cut.lineStyle(11, color, .32).lineBetween(-48, 0, 48, 0);
      cut.lineStyle(4, 0xf7e5b0, .94).lineBetween(-52, 0, 52, 0);
      cut.lineStyle(2, color, .82).lineBetween(-34, -8, 39, 8);
      this.time.delayedCall(delay, () => {
        cut.setAlpha(1);
        if (this.reducedMotion) {
          this.time.delayedCall(150, () => cut.destroy());
          return;
        }
        this.tweens.add({ targets: cut, scaleX: 1.45, scaleY: .68, alpha: 0, duration: timing.impactMs, ease: "Cubic.easeOut", onComplete: () => cut.destroy() });
      });
    };

    const impactAt = timing.approachMs;
    slash(focus.slashAngles[0], focus.primary, impactAt);
    slash(focus.slashAngles[1], focus.secondary, impactAt + timing.strikeGapMs);

    if (this.reducedMotion) {
      leaderEcho.setPosition(cue.toX - 24, targetY).setAlpha(.34);
      deputyEcho.setPosition(cue.toX + 24, targetY).setAlpha(.34);
      signature.setAlpha(.78);
      this.time.delayedCall(timing.settleMs, () => { leaderEcho.destroy(); deputyEcho.destroy(); signature.destroy(); });
      return;
    }

    const approach = Math.max(80, timing.approachMs);
    this.tweens.add({
      targets: leaderEcho,
      x: cue.toX - leaderDirection * 19,
      y: targetY - 2,
      alpha: .72,
      scaleX: .35,
      scaleY: .3,
      duration: approach,
      ease: "Cubic.easeIn",
      onComplete: () => this.tweens.add({ targets: leaderEcho, x: leaderEcho.x + leaderDirection * 34, alpha: 0, duration: 220, ease: "Cubic.easeOut", onComplete: () => leaderEcho.destroy() }),
    });
    this.tweens.add({
      targets: deputyEcho,
      x: cue.toX - deputyDirection * 21,
      y: targetY + 3,
      alpha: .68,
      scaleX: .3,
      scaleY: .255,
      delay: timing.strikeGapMs,
      duration: approach,
      ease: "Cubic.easeIn",
      onComplete: () => this.tweens.add({ targets: deputyEcho, x: deputyEcho.x + deputyDirection * 32, alpha: 0, duration: 220, ease: "Cubic.easeOut", onComplete: () => deputyEcho.destroy() }),
    });
    this.cameras.main.setZoom(timing.cameraZoom);
    this.time.delayedCall(impactAt + timing.strikeGapMs, () => {
      signature.setAlpha(1).setScale(.78);
      this.tweens.add({
        targets: signature,
        scale: focus.choreography === "hunt" ? 1.7 : focus.choreography === "ward" ? 1.42 : 1.55,
        angle: focus.choreography === "cross" ? 34 : 0,
        alpha: 0,
        duration: focus.choreography === "ward" ? 720 : 590,
        ease: "Cubic.easeOut",
        onComplete: () => signature.destroy(),
      });
      this.cameras.main.shake(155, focus.cameraShake);
      this.tweens.add({ targets: this.cameras.main, zoom: 1, duration: timing.settleMs, ease: "Cubic.easeOut" });
    });
  }

  private playCoordination(cue: BattleCue): void {
    const core = cue.kind === "core-combo";
    const focus = battleCoreFocusVisual(this.battleConfig.leader?.coreCombatFocusId);
    const assistX = cue.assistX ?? cue.fromX;
    const assistY = cue.assistY ?? cue.fromY;
    const source = core ? this.battleConfig.leader?.name ?? "总镖头" : this.battleConfig.guards.find((guard) => guard.id === cue.sourceId)?.name ?? "镖师";
    const deputy = this.battleConfig.guards.find((guard) => guard.id === cue.assistSourceId);
    const partner = deputy?.name ?? "同伴";
    const coreTiming = battleCoreComboTiming(
      this.battleConfig.leader?.experience ?? 0,
      deputy?.experience ?? 0,
      this.battleConfig.leader?.deputyBond ?? 0,
      this.reducedMotion,
      this.battleConfig.leader?.coreCombatFocusId,
      this.battleConfig.leader?.coreCombatExperience ?? 0,
    );
    const targetY = cue.toY - 15;
    const color = core ? focus.primary : this.simulation.formation === "hold" ? 0x8fbc96 : 0xe0b963;
    const trails = this.add.graphics().setDepth(42);
    const firstBendY = Math.min(500, Math.max(40, (assistY + targetY) / 2 - 34));
    const secondBendY = Math.min(500, Math.max(40, (cue.fromY + targetY) / 2 + 32));
    const assistCurve = new Phaser.Curves.QuadraticBezier(
      new Phaser.Math.Vector2(assistX, assistY - 13),
      new Phaser.Math.Vector2((assistX + cue.toX) / 2, firstBendY),
      new Phaser.Math.Vector2(cue.toX, targetY),
    ).getPoints(24);
    const sourceCurve = new Phaser.Curves.QuadraticBezier(
      new Phaser.Math.Vector2(cue.fromX, cue.fromY - 13),
      new Phaser.Math.Vector2((cue.fromX + cue.toX) / 2, secondBendY),
      new Phaser.Math.Vector2(cue.toX, targetY),
    ).getPoints(24);
    trails.lineStyle(core ? 9 : 6, color, core ? .34 : .25).strokePoints(assistCurve, false);
    trails.lineStyle(core ? 3 : 2, 0xf3deb0, core ? .88 : .72).strokePoints(assistCurve, false);
    trails.lineStyle(core ? 9 : 6, core ? focus.secondary : color, core ? .34 : .25).strokePoints(sourceCurve, false);
    trails.lineStyle(core ? 3 : 2, 0xf3deb0, core ? .88 : .72).strokePoints(sourceCurve, false);

    const ring = this.add.graphics().setPosition(cue.toX, targetY).setDepth(44);
    if (core && focus.choreography === "ward") {
      ring.lineStyle(7, focus.primary, .8).beginPath().arc(0, 0, 33, -2.58, -.56).strokePath();
      ring.beginPath().arc(0, 0, 33, .56, 2.58).strokePath();
      ring.lineStyle(2, focus.highlight, .72).strokeCircle(0, 0, 22).strokeCircle(0, 0, 46);
      ring.lineStyle(3, focus.secondary, .78).lineBetween(-42, 0, -18, 0).lineBetween(18, 0, 42, 0);
    } else if (core && focus.choreography === "hunt") {
      ring.lineStyle(5, focus.secondary, .82).strokeCircle(0, 0, 36);
      ring.lineStyle(2, focus.highlight, .8).strokeCircle(0, 0, 49);
      ring.lineStyle(3, focus.primary, .85).lineBetween(-57, 0, -25, 0).lineBetween(25, 0, 57, 0).lineBetween(0, -57, 0, -25).lineBetween(0, 25, 0, 57);
      ring.lineStyle(2, focus.secondary, .78).strokeRect(-20, -20, 40, 40);
    } else {
      ring.lineStyle(5, color, .9).strokeCircle(0, 0, 27);
      ring.lineStyle(1, 0xf4dfaa, .72).strokeCircle(0, 0, 42);
      ring.lineStyle(3, color, .82).lineBetween(-46, -25, 46, 25).lineBetween(-46, 25, 46, -25);
      if (core) {
        ring.lineStyle(3, focus.secondary, .82).strokeCircle(0, 0, 52);
        ring.lineStyle(2, focus.highlight, .72).strokeRect(-24, -24, 48, 48);
      }
    }

    const x = Phaser.Math.Clamp(cue.toX, 126, 834);
    const y = Phaser.Math.Clamp(cue.toY - 91, 72, 416);
    const panel = this.add.container(x, y).setDepth(56);
    const paper = this.add.graphics();
    paper.fillStyle(core ? focus.panel : this.simulation.formation === "hold" ? 0x20372a : 0x3b2b16, .97).fillRoundedRect(-119, -28, 238, 56, 3);
    paper.lineStyle(2, color, .9).strokeRoundedRect(-119, -28, 238, 56, 3);
    paper.lineStyle(1, 0xf0d695, .28).lineBetween(-71, 18, 104, 18);
    paper.fillStyle(core ? focus.edge : this.simulation.formation === "hold" ? 0x5f8e6b : 0xa77534, .95).fillTriangle(-119, -28, -139, 0, -119, 28);
    const seal = this.add.text(-91, 0, core ? focus.seal : "合", {
      fontFamily: "serif", fontSize: "24px", color: core ? battleColorHex(focus.highlight) : "#f1d58d", stroke: "#261b10", strokeThickness: 3,
    }).setOrigin(.5);
    const title = this.add.text(15, -7, cue.label ?? "前后接势", {
      fontFamily: "serif", fontSize: "17px", color: "#eeddb9", letterSpacing: 3,
    }).setOrigin(.5);
    const names = this.add.text(15, 14, core ? `${source} × ${partner} · ${focus.name}` : `${partner} × ${source}`, {
      fontFamily: "serif", fontSize: "11px", color: core ? battleColorHex(focus.primary) : "#bda572", letterSpacing: 1,
    }).setOrigin(.5);
    panel.add([paper, seal, title, names]);
    if (core) {
      this.playCoreComboFigures(cue, coreTiming);
      this.time.delayedCall(coreTiming.approachMs + coreTiming.strikeGapMs, () => this.showDamage(cue, battleColorHex(focus.primary)));
    } else this.showDamage(cue, "#f0cf80");
    if (this.reducedMotion) {
      this.time.delayedCall(720, () => { trails.destroy(); ring.destroy(); panel.destroy(true); });
      return;
    }
    panel.setAlpha(0).setScale(.82).setY(y + 10);
    trails.setAlpha(0);
    this.tweens.add({ targets: trails, alpha: 1, duration: core ? 120 : 90, yoyo: true, hold: core ? 250 : 190, onComplete: () => trails.destroy() });
    if (core) {
      ring.setAlpha(0).setScale(.72);
      this.time.delayedCall(coreTiming.approachMs + coreTiming.strikeGapMs, () => {
        ring.setAlpha(1);
        this.tweens.add({
          targets: ring,
          scale: focus.choreography === "hunt" ? 1.9 : focus.choreography === "ward" ? 1.52 : 1.72,
          angle: focus.choreography === "cross" ? 45 : 0,
          alpha: 0,
          duration: focus.choreography === "ward" ? 740 : 650,
          ease: "Cubic.easeOut",
          onComplete: () => ring.destroy(),
        });
      });
    } else this.tweens.add({ targets: ring, scale: 1.55, angle: 28, alpha: 0, duration: 520, ease: "Cubic.easeOut", onComplete: () => ring.destroy() });
    this.tweens.add({ targets: panel, alpha: 1, scale: 1, y, duration: 150, ease: "Back.easeOut", yoyo: true, hold: core ? 980 : 820, onComplete: () => panel.destroy(true) });
    if (!core) this.cameras.main.shake(105, .0028);
  }

  private playVolley(cue: BattleCue): void {
    const panel = this.add.container(480, 92).setDepth(56);
    const paper = this.add.graphics();
    paper.fillStyle(0x312515, .97).fillRoundedRect(-132, -27, 264, 54, 3);
    paper.lineStyle(2, 0xd6b466, .9).strokeRoundedRect(-132, -27, 264, 54, 3);
    paper.lineStyle(1, 0xf0d998, .3).lineBetween(-79, 17, 116, 17);
    paper.fillStyle(0xa27134, .94).fillTriangle(-132, -27, -151, 0, -132, 27);
    const seal = this.add.text(-101, 0, "弩", {
      fontFamily: "serif", fontSize: "24px", color: "#f1d38a", stroke: "#26190d", strokeThickness: 3,
    }).setOrigin(.5);
    const label = this.add.text(20, 0, cue.label ?? "弩阵齐发", {
      fontFamily: "serif", fontSize: "18px", color: "#eeddb8", letterSpacing: 4,
    }).setOrigin(.5);
    panel.add([paper, seal, label]);

    const sight = this.add.graphics().setPosition(cue.toX, cue.toY - 15).setDepth(46);
    sight.lineStyle(4, 0xe1bb69, .92).strokeCircle(0, 0, 31);
    sight.lineStyle(1, 0xf3dfa4, .72).strokeCircle(0, 0, 47);
    sight.lineStyle(3, 0xe1bb69, .86)
      .lineBetween(-58, 0, -20, 0).lineBetween(20, 0, 58, 0)
      .lineBetween(0, -58, 0, -20).lineBetween(0, 20, 0, 58);
    sight.fillStyle(0xe4bd69, .5).fillCircle(0, 0, 6);
    if (this.reducedMotion) {
      this.time.delayedCall(700, () => { panel.destroy(true); sight.destroy(); });
      return;
    }
    panel.setAlpha(0).setScale(.86).setY(103);
    this.tweens.add({ targets: panel, alpha: 1, scale: 1, y: 92, duration: 150, ease: "Back.easeOut", yoyo: true, hold: 780, onComplete: () => panel.destroy(true) });
    this.tweens.add({ targets: sight, scale: .58, angle: 18, alpha: 0, duration: 620, ease: "Cubic.easeIn", onComplete: () => sight.destroy() });
    this.cameras.main.shake(115, .0028);
  }

  private playProjectile(cue: BattleCue): void {
    const isArrow = cue.kind === "arrow" || cue.kind === "bolt";
    const isBolt = cue.kind === "bolt";
    const color = isBolt ? 0xe5bb68 : isArrow ? 0xe4d1a2 : 0xf0a846;
    const projectile = this.add.container(cue.fromX, cue.fromY - 28).setDepth(42);
    const mark = this.add.graphics();
    if (isArrow) {
      mark.lineStyle(isBolt ? 5 : 3, color, .95).lineBetween(isBolt ? -16 : -12, 0, 11, 0);
      mark.fillStyle(color, .95).fillTriangle(11, 0, 4, -4, 4, 4);
      if (isBolt) mark.lineStyle(2, 0x6f4226, .9).lineBetween(-12, -6, -12, 6);
    } else {
      mark.fillStyle(0x7e251b, .42).fillCircle(0, 0, 12);
      mark.fillStyle(color, .95).fillCircle(0, 0, 6);
      mark.fillStyle(0xffda72, .88).fillCircle(-2, -2, 3);
    }
    projectile.add(mark);
    const targetY = cue.toY - 22;
    projectile.setRotation(Math.atan2(targetY - projectile.y, cue.toX - projectile.x));
    const finish = () => {
      projectile.destroy(true);
      this.showImpact(cue.toX, targetY, color, cue.kind === "torch");
      this.showDamage(cue, cue.kind === "torch" ? "#f4b45f" : "#ead7ac");
      if (isBolt) this.showEquipmentCallout(cue, "#edcb82");
    };
    if (this.reducedMotion) {
      projectile.setPosition(cue.toX, targetY);
      finish();
      return;
    }
    this.tweens.add({
      targets: projectile,
      x: cue.toX,
      y: targetY - (cue.kind === "torch" ? 12 : 0),
      angle: projectile.angle + (cue.kind === "torch" ? 180 : 0),
      duration: Math.round(cue.duration * 620),
      ease: cue.kind === "torch" ? "Quad.easeIn" : "Sine.easeIn",
      onComplete: finish,
    });
  }

  private showBannerEvent(cue: BattleCue): void {
    const recovered = cue.kind === "banner-recover";
    const lost = cue.kind === "banner-lost";
    const sealText = recovered ? "复" : lost ? "失" : "夺";
    const label = recovered ? "夺旗手伏诛 · 行旗复立" : lost ? "夺旗手脱阵 · 镖旗失守" : "夺旗手得旗 · 快手追截";
    const panel = this.add.container(902, 138).setDepth(54);
    const paper = this.add.graphics();
    const fill = recovered ? 0x20362a : 0x4a1914;
    const line = recovered ? 0xc7aa60 : 0xd16a50;
    paper.fillStyle(fill, .96).fillRoundedRect(-266, -30, 266, 60, 3);
    paper.lineStyle(2, line, .9).strokeRoundedRect(-266, -30, 266, 60, 3);
    paper.fillStyle(recovered ? 0xb68a42 : 0xb44535, .96).fillTriangle(-266, -30, -290, 0, -266, 30);
    paper.lineStyle(1, 0xf1d28a, .28).lineBetween(-224, 20, -18, 20);
    const seal = this.add.text(-237, 0, sealText, {
      fontFamily: "serif", fontSize: "25px", color: "#f2d184", stroke: recovered ? "#17251d" : "#32130f", strokeThickness: 3,
    }).setOrigin(.5);
    const text = this.add.text(-18, 0, label, {
      fontFamily: "serif", fontSize: "17px", color: "#f0ddba", letterSpacing: 2,
    }).setOrigin(1, .5);
    panel.add([paper, seal, text]);
    if (this.reducedMotion) {
      this.time.delayedCall(900, () => panel.destroy(true));
      return;
    }
    panel.setAlpha(0).setX(956);
    this.tweens.add({ targets: panel, x: 902, alpha: 1, duration: 170, ease: "Back.easeOut", yoyo: true, hold: lost ? 1250 : 920, onComplete: () => panel.destroy(true) });
    if (lost) this.cameras.main.shake(170, .0042);
  }

  private playBattleCues(): void {
    const cues = this.simulation.cues.filter((cue) => cue.id > this.lastCueId).sort((a, b) => a.id - b.id);
    for (const cue of cues) {
      this.lastCueId = Math.max(this.lastCueId, cue.id);
      const moment = battleMomentFromCue(cue, this.battleConfig, this.simulation.formation, this.simulation.activeStrategy);
      if (moment) {
        const momentKey = `${cue.kind}:${cue.sourceId}:${cue.label ?? ""}`;
        if (momentKey !== this.lastMomentKey || this.simulation.elapsed - this.lastMomentAt > .72) {
          this.lastMomentKey = momentKey;
          this.lastMomentAt = this.simulation.elapsed;
          this.reportMoment(moment);
        }
      }
      if (cue.kind === "banner-grab" || cue.kind === "banner-recover" || cue.kind === "banner-lost") {
        this.showBannerEvent(cue);
        continue;
      }
      if (cue.kind === "leader-challenge") continue;
      if (cue.kind === "rear-turn") {
        const turn = this.add.graphics().setPosition(cue.fromX, cue.fromY - 6).setDepth(43);
        turn.lineStyle(5, 0x78ad8a, .86).beginPath().arc(0, 0, 42, -.35, Math.PI + .65).strokePath();
        turn.fillStyle(0xd9c77f, .92).fillTriangle(-41, 3, -30, -5, -29, 9);
        this.tweens.add({ targets: turn, scale: 1.24, alpha: 0, duration: 520, ease: "Quad.easeOut", onComplete: () => turn.destroy() });
        continue;
      }
      if (cue.kind === "rear-guard") {
        this.showEquipmentCallout(cue, "#e1c57b");
        this.showImpact(cue.toX, cue.toY - 16, 0xd8b566, true);
        this.showDamage(cue, "#f0d18b");
        continue;
      }
      if (cue.kind === "arrow" || cue.kind === "bolt" || cue.kind === "torch") {
        this.playProjectile(cue);
        continue;
      }
      if (cue.kind === "heal" || cue.kind === "revive" || cue.kind === "rescue") {
        this.playHeal(cue);
        continue;
      }
      if (cue.kind === "repair") {
        this.playRepair(cue);
        continue;
      }
      if (cue.kind === "counter" || cue.kind === "breach") {
        const verdict = battleDefenseVerdictFromCue(cue, this.simulation.activeStrategy, this.battleConfig);
        if (verdict) this.reportDefenseVerdict(verdict);
        this.playDefenseResponse(cue);
        continue;
      }
      if (cue.kind === "coordination" || cue.kind === "core-combo") {
        this.playCoordination(cue);
        continue;
      }
      if (cue.kind === "volley") {
        this.playVolley(cue);
        continue;
      }
      if (cue.kind === "mastery") {
        this.showMasteryCallout(cue);
        continue;
      }
      if (cue.kind === "brace") {
        this.showEquipmentCallout(cue, "#9fc5a6");
        this.showImpact(cue.toX, cue.toY - 16, 0x7eaa8a, true);
        this.showDamage(cue, "#b8d1af");
        continue;
      }
      if (cue.kind === "hook") {
        const rope = this.add.graphics().setDepth(41);
        rope.lineStyle(3, 0xc9ae78, .88).lineBetween(cue.fromX, cue.fromY - 16, cue.toX, cue.toY - 10);
        rope.lineStyle(1, 0xf2ddb0, .48).lineBetween(cue.fromX, cue.fromY - 18, cue.toX, cue.toY - 12);
        rope.strokeCircle(cue.toX, cue.toY - 10, 6);
        this.tweens.add({ targets: rope, alpha: 0, duration: 300, hold: 70, onComplete: () => rope.destroy() });
        this.time.delayedCall(130, () => {
          this.showImpact(cue.toX, cue.toY - 12, 0xd7bd86);
          this.showDamage(cue, "#dfc796");
        });
        continue;
      }
      const technique = cue.kind === "technique";
      const color = technique ? 0xf0c66d : cue.kind === "enemy-strike" || cue.kind === "rear-hit" ? 0xc96d58 : 0xe1c47d;
      const slash = this.add.graphics().setPosition(cue.toX, cue.toY - 16).setDepth(43);
      slash.lineStyle(technique ? 7 : 4, color, technique ? .88 : .74);
      slash.beginPath().arc(0, 0, technique ? 34 : 22, -.95, .72).strokePath();
      this.tweens.add({ targets: slash, scale: technique ? 1.45 : 1.2, alpha: 0, duration: technique ? 360 : 210, ease: "Quad.easeOut", onComplete: () => slash.destroy() });
      this.showImpact(cue.toX, cue.toY - 16, color, technique);
      this.showDamage(cue, technique ? "#f3cf76" : cue.kind === "enemy-strike" || cue.kind === "rear-hit" ? "#e18975" : "#e7d09d");
    }
  }

  private updateEntitySprites(): void {
    const state = this.simulation;
    const techniqueActive = state.techniquePulse > 0;
    const attackProgress = state.player.attackPulse > 0 ? 1 - state.player.attackPulse / .24 : 0;
    const leaderFrame = techniqueActive ? 4 : state.player.attackPulse > .16 ? 2 : state.player.attackPulse > .07 ? 3 : state.player.attackPulse > 0 ? 4 : 1;
    const leaderKey = `battle-leader-${leaderFrame}`;
    if (this.leaderSprite.texture.key !== leaderKey) this.leaderSprite.setTexture(leaderKey);
    const leaderLunge = state.player.attackPulse > 0 ? Math.sin(attackProgress * Math.PI) * 15 : 0;
    const leaderHit = battleHitPose(state.player.flash, state.player.facingX);
    const leaderScale = techniqueActive ? .35 : state.attackPulse > 0 ? .335 : .32;
    this.leaderSprite.setPosition(state.player.x + state.player.facingX * leaderLunge + leaderHit.offsetX, state.player.y + 25 + state.player.facingY * leaderLunge + Math.sin(state.elapsed * 5) * 1.5)
      .setDepth(4 + state.player.y / 1000).setFlipX(state.player.facingX < -.08)
      .setScale(leaderScale * leaderHit.scaleX, leaderScale * leaderHit.scaleY)
      .setAngle(techniqueActive ? -2 : leaderHit.angle).setAlpha(state.player.hp > 0 ? 1 : .3);
    if (state.player.flash > 0) this.leaderSprite.setTint(0xffc995); else this.leaderSprite.clearTint();
    const coreBadgePulse = (state.coreComboPulse > 0 || state.coreCounterPulse > 0) && !this.reducedMotion ? 1.08 + Math.sin(state.elapsed * 22) * .1 : 1;
    this.leaderRoleBadge.setPosition(state.player.x - 31, state.player.y - 70).setDepth(14 + state.player.y / 1000)
      .setScale(coreBadgePulse).setAlpha(state.player.hp > 0 ? 1 : .25).setVisible(state.player.hp > 0);

    this.convoySprite.setPosition(state.cart.x + 42, state.cart.y + 30 + Math.sin(state.elapsed * 4) * .8)
      .setDepth(2 + state.cart.y / 1000).setAngle(state.horse.tetherCut ? -1.5 : 0)
      .setScale(state.cart.flash > 0 ? .148 : .145)
      .setAlpha(state.cart.hp > 0 ? 1 : .38);
    if (state.repairPulse > 0) this.convoySprite.setTint(0xe0c47b);
    else if (state.horse.flash > 0 || state.cart.flash > 0 || state.cart.hp < state.cart.maxHp * .3) this.convoySprite.setTint(0xd9937d);
    else this.convoySprite.clearTint();
    const flagHoleX = state.cart.x + 12;
    const flagHoleY = state.cart.y - 59;
    const flagHoleWidth = 43;
    const flagHoleHeight = 66;
    this.convoyMaskShape.clear().fillStyle(0xffffff, 1)
      .fillRect(-20, -20, 1000, flagHoleY + 20)
      .fillRect(-20, flagHoleY + flagHoleHeight, 1000, 580 - flagHoleY - flagHoleHeight)
      .fillRect(-20, flagHoleY, flagHoleX + 20, flagHoleHeight)
      .fillRect(flagHoleX + flagHoleWidth, flagHoleY, 1000 - flagHoleX - flagHoleWidth, flagHoleHeight);

    const bannerWave = this.reducedMotion ? 0 : Math.sin(state.elapsed * (state.banner.stolen ? 10 : 4.5)) * (state.banner.stolen ? 3.2 : 1.4);
    this.bannerSprite.setPosition(state.banner.x, state.banner.y + 36)
      .setDepth(8 + state.banner.y / 1000)
      .setAngle((state.banner.stolen ? -13 : 0) + bannerWave)
      .setScale(state.banner.flash > 0 ? 1.12 : 1)
      .setAlpha(state.banner.lost ? .08 : state.cart.hp > 0 ? 1 : .42);

    if (this.clientSprite && state.client) {
      const panicLean = state.client.panic > 0 ? -4 : 0;
      this.clientSprite.setPosition(state.client.x, state.client.y + 23 + Math.sin(state.elapsed * 4.2) * 1.1)
        .setDepth(3.5 + state.client.y / 1000)
        .setFlipX(state.client.facingX < -.08)
        .setAngle(state.client.hp > 0 ? panicLean : -72)
        .setScale(state.client.panic > 0 ? .081 : .078)
        .setAlpha(state.client.hp > 0 ? 1 : .3);
      if (state.client.flash > 0) this.clientSprite.setTint(0xffb58e);
      else if (state.clientGuarded) this.clientSprite.setTint(0xe4d6ad);
      else this.clientSprite.clearTint();
    }

    state.guards.forEach((guard, index) => {
      const sprite = this.guardSprites.get(guard.id)!;
      const previousHp = this.previousGuardHp.get(guard.id) ?? guard.hp;
      if (previousHp > 0 && guard.hp <= 0 && !this.guardDefeatAt.has(guard.id)) {
        this.guardDefeatAt.set(guard.id, state.elapsed);
        this.showGuardDown(guard, index);
      }
      this.previousGuardHp.set(guard.id, guard.hp);
      const repairing = guard.id === state.repairerId;
      const aimingVolley = Boolean(state.volleyTargetId && guard.equipmentIds.some((id) => equipmentHasBattleTrait(id, "crossbow")));
      const striking = !repairing && !aimingVolley && guard.hp > 0 && guard.attackPulse > 0;
      const strikeProgress = striking ? 1 - guard.attackPulse / .24 : 0;
      const lunge = striking ? Math.sin(strikeProgress * Math.PI) * 10 : 0;
      const coreDeputy = guard.role === "副镖头";
      const idleScale = coreDeputy ? .27 : .245;
      const scaleX = aimingVolley ? idleScale + .01 : striking ? idleScale + .013 : idleScale;
      const scaleY = repairing ? idleScale - .04 : aimingVolley ? idleScale - .02 : striking ? idleScale - .01 : idleScale;
      if (guard.hp <= 0) {
        const defeatAt = this.guardDefeatAt.get(guard.id) ?? state.elapsed;
        const pose = battleDefeatPose(this.reducedMotion ? 1 : state.elapsed - defeatAt, -1, "guard");
        sprite.setPosition(guard.x, guard.y + 21 + pose.offsetY).setDepth(3 + guard.y / 1000).setAlpha(pose.alpha)
          .setFlipX(guard.facingX < -.08).setAngle(pose.angle).setScale(idleScale * pose.scaleX, idleScale * pose.scaleY);
      } else {
        const hit = battleHitPose(guard.flash, guard.facingX);
        sprite.setPosition(guard.x + guard.facingX * lunge + hit.offsetX, guard.y + 21 + guard.facingY * lunge + Math.sin(state.elapsed * 4.5 + index) * 1.2)
          .setDepth(3 + guard.y / 1000).setAlpha(1).setFlipX(guard.facingX < -.08)
          .setAngle(repairing ? 12 : aimingVolley ? -6 : striking ? -3 : hit.angle)
          .setScale(scaleX * hit.scaleX, scaleY * hit.scaleY);
      }
      if (guard.flash > 0) sprite.setTint(0xffc995);
      else if (repairing) sprite.setTint(0xd8b66c);
      else if (aimingVolley) sprite.setTint(0xe0bf78);
      else if (guard.supportKind === "medicine") sprite.setTint(0x9ed2a7);
      else if (guard.supportKind === "crossbow") sprite.setTint(0xe8c47a);
      else if (guard.supportKind) sprite.setTint(0x9fc8aa);
      else sprite.clearTint();
      const disciplineBadge = this.guardDisciplineBadges.get(guard.id);
      if (disciplineBadge) disciplineBadge.setPosition(guard.x, guard.y - 52).setDepth(10 + guard.y / 1000).setVisible(guard.hp > 0);
      if (guard.role === "副镖头" && this.deputyRoleBadge) {
        this.deputyRoleBadge.setPosition(guard.x - 29, guard.y - 70).setDepth(14 + guard.y / 1000)
          .setScale(coreBadgePulse).setAlpha(guard.hp > 0 ? 1 : .25).setVisible(guard.hp > 0);
      }
      const gearViews = this.guardGearBadges.get(guard.id) ?? [];
      const gearSide = guard.facingX < -.08 ? -1 : 1;
      gearViews.forEach((gearView, gearIndex) => {
        const orderPulseUntil = this.guardGearOrderPulseUntil.get(`${guard.id}:${gearView.badge.equipmentId}`) ?? -1;
        const automaticSupport = battleGearSupportsAction(gearView.badge, guard.supportKind);
        const orderResponse = state.elapsed < orderPulseUntil;
        const highlighted = automaticSupport || orderResponse;
        const pulse = highlighted && !this.reducedMotion ? 1.12 + Math.sin(state.elapsed * 18 + gearIndex) * .08 : 1;
        const spread = (gearIndex - (gearViews.length - 1) / 2) * 18;
        gearView.container
          .setPosition(guard.x + gearSide * 29 + spread, guard.y - 27)
          .setDepth(10.5 + guard.y / 1000)
          .setScale(pulse)
          .setAlpha(highlighted ? 1 : .72)
          .setVisible(guard.hp > 0);
      });
    });

    state.enemies.forEach((enemy, index) => {
      const sprite = this.enemySprites.get(enemy.id)!;
      const previousHp = this.previousEnemyHp.get(enemy.id) ?? enemy.hp;
      if (previousHp > 0 && enemy.hp <= 0 && !this.enemyDefeatAt.has(enemy.id)) {
        this.enemyDefeatAt.set(enemy.id, state.elapsed);
        this.showEnemyDefeat(enemy, index);
      }
      this.previousEnemyHp.set(enemy.id, enemy.hp);
      const baseScale = enemy.type === "leader" ? .31 : enemy.type === "hooker" ? .27 : enemy.type === "boarder" ? .255 : .245;
      const attacking = enemy.hp > 0 && enemy.attackPulse > 0;
      const winding = enemy.hp > 0 && enemy.attackWindup > 0 && Boolean(enemy.attackTargetId);
      const attackDuration = enemy.type === "leader" ? .44 : enemy.type === "archer" ? .42 : enemy.type === "torch" ? .38 : .28;
      const strikeProgress = attacking ? 1 - enemy.attackPulse / attackDuration : 0;
      const lunge = attacking ? Math.sin(strikeProgress * Math.PI) * (enemy.type === "archer" ? 4 : 9) : 0;
      const windupProgress = winding ? 1 - enemy.attackWindup / Math.max(.01, enemy.attackWindupDuration) : 0;
      const anticipationPull = winding ? Math.sin(windupProgress * Math.PI / 2) * (enemy.type === "archer" ? 8 : enemy.type === "torch" || enemy.type === "hooker" || enemy.type === "boarder" ? 7 : 5) : 0;
      if (enemy.hp <= 0) {
        const defeatAt = this.enemyDefeatAt.get(enemy.id) ?? state.elapsed;
        const direction = index % 2 === 0 ? 1 : -1;
        const pose = battleDefeatPose(this.reducedMotion ? 1 : state.elapsed - defeatAt, direction, enemy.type === "leader" ? "leader" : "raider");
        sprite.setPosition(enemy.x, enemy.y + 22 + pose.offsetY).setDepth(3 + enemy.y / 1000).setFlipX(enemy.facingX > .08)
          .setAlpha(pose.alpha).setAngle(pose.angle).setScale(baseScale * pose.scaleX, baseScale * pose.scaleY);
      } else {
        const hit = battleHitPose(enemy.flash, enemy.facingX);
        const boarderLift = enemy.type === "boarder" && enemy.boarded ? -17 : 0;
        const boarderLean = enemy.type === "boarder" && enemy.boarded ? enemy.lane * -16 : 0;
        const boarderPry = enemy.type === "boarder" && enemy.boarded && winding ? Math.sin(windupProgress * Math.PI) * 7 : 0;
        sprite.setPosition(enemy.x + enemy.facingX * (lunge - anticipationPull + boarderPry) + hit.offsetX, enemy.y + 22 + boarderLift + enemy.facingY * (lunge - anticipationPull) + Math.sin(state.elapsed * 5 + index * .7) * 1.5)
          .setDepth(3 + enemy.y / 1000).setFlipX(enemy.facingX > .08).setAlpha(1)
          .setAngle(attacking ? 3 + boarderLean : winding ? enemy.type === "archer" ? -7 : enemy.type === "torch" ? 6 : enemy.type === "boarder" ? boarderLean - 7 : -4 : hit.angle + boarderLean)
          .setScale((attacking ? baseScale * 1.06 : winding ? baseScale * .97 : baseScale) * hit.scaleX, (attacking ? baseScale * .94 : winding ? baseScale * 1.045 : baseScale) * hit.scaleY);
      }
      sprite.clearTint();
      if (enemy.type === "cutter") sprite.setTint(0xbfa898);
      if (enemy.type === "boarder") sprite.setTint(enemy.boarded ? 0xd6a967 : 0xc39b70);
      if (enemy.type === "banner") sprite.setTint(0xc38c79);
      if (enemy.rallied > 0 && enemy.type !== "leader") sprite.setTint(0xd89a74);
      if (enemy.stunned > 0) sprite.setTint(0xd8b95d);
      if (winding) sprite.setTint(enemy.type === "torch" ? 0xe79569 : enemy.type === "cutter" ? 0xd4aa72 : enemy.type === "boarder" ? 0xe3ae62 : 0xd8c292);
      if (enemy.flash > 0) sprite.setTint(0xffb17d);
      const badge = this.enemyThreatBadges.get(enemy.id);
      if (badge) {
        const urgent = winding || enemy.carrier || (enemy.clientHunter && state.client && distanceBetween(enemy, state.client) < 270) || (enemy.type === "banner" && (state.banner.captureProgress > 0 || state.banner.carrierId === enemy.id)) || (enemy.type === "leader" && (state.enemyCommandPulse > 0 || state.leaderPhase === "challenge"))
          ? true
          : enemy.type === "cutter"
            ? distanceBetween(enemy, state.horse) < 180
          : enemy.type === "hooker" || enemy.type === "torch" || enemy.type === "boarder"
            ? distanceBetween(enemy, state.cart) < 190
            : distanceBetween(enemy, state.cart) < 285;
        const pulse = urgent && !this.reducedMotion ? 1 + Math.sin(state.elapsed * 11 + index) * .08 : 1;
        badge.setPosition(enemy.x, enemy.y - (enemy.type === "boarder" && enemy.boarded ? 73 : 67)).setDepth(11 + enemy.y / 1000)
          .setVisible(enemy.hp > 0).setAlpha(urgent ? .98 : .58).setScale(pulse);
      }
    });

    if (!this.reducedMotion && state.defeatedEnemies > this.lastDefeated) {
      this.cameras.main.shake(85, .0022);
    }
    this.lastDefeated = state.defeatedEnemies;
    if (!this.reducedMotion && techniqueActive && !this.techniqueWasActive) this.cameras.main.shake(125, .0035);
    this.techniqueWasActive = techniqueActive;
  }

  private drawSimulation(): void {
    const g = this.renderLayer;
    const ground = this.groundLayer;
    const state = this.simulation;
    g.clear();
    ground.clear();

    const formationColor = state.formation === "horses" ? 0xd29a55 : state.formation === "hold" ? 0x74a78b : 0xd5b45f;
    const focus = state.formation === "horses" ? state.horse : state.clientGuarded && state.client ? state.client : state.cart;
    const orderPulse = state.rally > 0 ? .24 + Math.sin(state.elapsed * 10) * .06 : .14;
    ground.lineStyle(2, formationColor, orderPulse).strokeEllipse(focus.x + 18, focus.y + 14, state.formation === "advance" ? 250 : 208, 148);
    ground.lineStyle(1, formationColor, orderPulse * .62).strokeEllipse(focus.x + 18, focus.y + 14, state.formation === "advance" ? 292 : 244, 178);
    state.guards.forEach((guard, index) => {
      if (guard.hp <= 0) return;
      const anchor = battleGuardAnchor(state, index);
      const distantFromPost = distanceBetween(guard, anchor) > 34;
      ground.lineStyle(1, formationColor, distantFromPost ? orderPulse * .7 : orderPulse * .35).lineBetween(focus.x + 14, focus.y + 14, anchor.x, anchor.y + 17);
      ground.fillStyle(0x17120d, .48).fillCircle(anchor.x, anchor.y + 18, 10);
      ground.lineStyle(2, formationColor, distantFromPost ? .62 : .36).strokeCircle(anchor.x, anchor.y + 18, 10);
      ground.lineStyle(1, 0xf0ddb0, distantFromPost ? .34 : .18).strokeCircle(anchor.x, anchor.y + 18, 5);
    });
    if (state.formation === "advance") {
      for (let offset = 128; offset <= 308; offset += 60) {
        const x = Math.min(900, state.cart.x + offset);
        ground.lineStyle(3, formationColor, .16).lineBetween(x - 13, state.cart.y - 4, x, state.cart.y + 6);
        ground.lineBetween(x, state.cart.y + 6, x - 13, state.cart.y + 16);
      }
    } else {
      const guarded = state.formation === "horses" ? state.horse : state.cart;
      ground.lineStyle(4, formationColor, .18).beginPath().arc(guarded.x + 18, guarded.y + 14, 72, -2.6, -.55).strokePath();
      ground.beginPath().arc(guarded.x + 18, guarded.y + 14, 72, .55, 2.6).strokePath();
    }
    this.drawPendingOrderRelay();
    this.drawAttackIntents();
    const rearStatus = battleRearThreatStatus(state);
    const rearResponseTarget = state.rearResponseTargetId ? state.enemies.find((enemy) => enemy.id === state.rearResponseTargetId && enemy.hp > 0) : undefined;
    const rearMarkedEnemies = state.enemies.filter((enemy) => rearStatus.rearEnemyIds.includes(enemy.id));
    if (rearMarkedEnemies.length > 0 || rearResponseTarget || rearStatus.surrounded || state.rearSurroundedPulse > 0) {
      const rearColor = state.rearDefenseOutcome === "hit" && state.rearDefensePulse > 0 ? 0xd05243 : state.rearDefenseOutcome === "guard" && state.rearDefensePulse > 0 ? 0xd5ad60 : 0x76ad88;
      const pulse = this.reducedMotion ? .62 : .5 + Math.sin(state.elapsed * 14) * .13;
      const marked = rearMarkedEnemies.length > 0 ? rearMarkedEnemies : rearResponseTarget ? [rearResponseTarget] : [];
      for (const enemy of marked) {
        const angle = Math.atan2(enemy.y - state.player.y, enemy.x - state.player.x);
        ground.lineStyle(3, rearColor, pulse).beginPath().arc(state.player.x, state.player.y + 5, 48, angle - .42, angle + .42).strokePath();
        ground.lineStyle(1, 0xedd79b, pulse * .7).lineBetween(state.player.x + Math.cos(angle) * 50, state.player.y + 5 + Math.sin(angle) * 50, enemy.x - Math.cos(angle) * 24, enemy.y - Math.sin(angle) * 24);
      }
      const surrounded = rearStatus.surrounded || state.rearSurroundedPulse > 0;
      g.lineStyle(surrounded ? 4 : 2, rearColor, pulse).strokeCircle(state.player.x, state.player.y + 4, surrounded ? 61 : 53);
      if (surrounded && (rearStatus.escapeX || rearStatus.escapeY)) {
        ground.lineStyle(5, 0x82b291, pulse).lineBetween(state.player.x, state.player.y + 8, state.player.x + rearStatus.escapeX * 58, state.player.y + 8 + rearStatus.escapeY * 58);
        ground.fillStyle(0xd8c281, pulse).fillCircle(state.player.x + rearStatus.escapeX * 61, state.player.y + 8 + rearStatus.escapeY * 61, 5);
      }
    }
    ground.fillStyle(0x0d0c09, .36).fillEllipse(state.cart.x + 46, state.cart.y + 48, 205, 38);
    ground.fillStyle(0x0d0c09, .32).fillEllipse(state.player.x, state.player.y + 24, 62, 18);
    if (state.client) ground.fillStyle(0x0d0c09, state.client.hp > 0 ? .28 : .16).fillEllipse(state.client.x, state.client.y + 22, 48, 14);
    for (const guard of state.guards) ground.fillStyle(0x0d0c09, guard.hp > 0 ? .28 : .16).fillEllipse(guard.x, guard.y + 22, 52, 15);
    for (const enemy of state.enemies) ground.fillStyle(0x0d0c09, enemy.hp > 0 ? .28 : .13).fillEllipse(enemy.x, enemy.y + 22, 52, 15);

    for (const enemy of state.enemies) {
      if (enemy.hp <= 0 || enemy.rallied <= 0) continue;
      const pulse = .22 + Math.sin(state.elapsed * 9 + enemy.x) * .06;
      ground.lineStyle(2, 0xc65b43, pulse).strokeEllipse(enemy.x, enemy.y + 19, 66, 29);
      ground.fillStyle(0x9e3629, pulse * .28).fillEllipse(enemy.x, enemy.y + 19, 58, 23);
    }
    const enemyLeader = state.enemies.find((enemy) => enemy.type === "leader" && enemy.hp > 0);
    if (enemyLeader && state.enemyCommandPulse > 0) {
      const commandProgress = 1 - state.enemyCommandPulse;
      g.lineStyle(5, 0xd26048, .72 * state.enemyCommandPulse).strokeCircle(enemyLeader.x, enemyLeader.y - 6, 48 + commandProgress * 118);
      g.lineStyle(2, 0xf0c978, .58 * state.enemyCommandPulse).strokeCircle(enemyLeader.x, enemyLeader.y - 6, 34 + commandProgress * 92);
    }
    if (enemyLeader && state.leaderPhase === "challenge") {
      const pulse = this.reducedMotion ? .48 : .42 + Math.sin(state.elapsed * 9) * .12;
      ground.lineStyle(4, 0xc95440, pulse).lineBetween(enemyLeader.x, enemyLeader.y + 7, state.player.x, state.player.y + 7);
      ground.lineStyle(1, 0xf1cf8c, pulse * .72).lineBetween(enemyLeader.x, enemyLeader.y + 2, state.player.x, state.player.y + 2);
      g.lineStyle(3, 0xd55d47, pulse).strokeCircle(enemyLeader.x, enemyLeader.y - 5, 43);
      g.lineStyle(2, 0xe8c47f, pulse * .78).strokeCircle(state.player.x, state.player.y - 4, 37);
    }

    this.drawHealth(state.cart.x - 76, state.cart.y - 65, 90, state.cart.hp / state.cart.maxHp, 0xd6ae61);
    this.drawHealth(state.horse.x + 2, state.horse.y - 65, 70, state.horse.hp / state.horse.maxHp, 0xc28b5a);
    const repairer = state.repairerId ? state.guards.find((guard) => guard.id === state.repairerId) : undefined;
    if (repairer) {
      const repairX = Phaser.Math.Clamp(state.cart.x - 57, 18, 848);
      const repairY = Phaser.Math.Clamp(state.cart.y + 77, 32, 482);
      const pulse = this.reducedMotion ? .52 : .4 + Math.sin(state.elapsed * 14) * .13;
      ground.lineStyle(3, 0xd0a65c, .5).lineBetween(repairer.x, repairer.y + 9, state.cart.x + 9, state.cart.y + 40);
      ground.lineStyle(1, 0xf1da9b, .46).lineBetween(repairer.x, repairer.y + 4, state.cart.x + 9, state.cart.y + 35);
      g.fillStyle(0x171008, .92).fillRoundedRect(repairX, repairY, 116, 13, 2);
      g.lineStyle(2, 0xd0a65c, .9).strokeRoundedRect(repairX, repairY, 116, 13, 2);
      g.fillStyle(0xd3ad62, .98).fillRect(repairX + 3, repairY + 4, 110 * state.repairProgress / 100, 5);
      g.lineStyle(3, 0xd2ac61, pulse)
        .lineBetween(state.cart.x - 31, state.cart.y + 24, state.cart.x - 31, state.cart.y + 42)
        .lineBetween(state.cart.x - 31, state.cart.y + 42, state.cart.x - 13, state.cart.y + 42)
        .lineBetween(state.cart.x + 32, state.cart.y + 24, state.cart.x + 32, state.cart.y + 42)
        .lineBetween(state.cart.x + 32, state.cart.y + 42, state.cart.x + 14, state.cart.y + 42);
      if (state.repairPulse > 0) {
        for (let index = 0; index < 4; index += 1) {
          const angle = -2.5 + index * .55 + state.elapsed * 2;
          g.lineStyle(2, index % 2 ? 0xf1cf7b : 0xb87332, pulse)
            .lineBetween(state.cart.x + 5, state.cart.y + 38, state.cart.x + 5 + Math.cos(angle) * 18, state.cart.y + 38 + Math.sin(angle) * 18);
        }
      }
    }
    const volleyTarget = state.volleyTargetId ? state.enemies.find((enemy) => enemy.id === state.volleyTargetId && enemy.hp > 0) : undefined;
    if (volleyTarget) {
      const shooters = state.guards.filter((guard) => guard.hp > 0 && guard.equipmentIds.some((id) => equipmentHasBattleTrait(id, "crossbow")));
      const pulse = this.reducedMotion ? .54 : .42 + Math.sin(state.elapsed * 12) * .13;
      for (const shooter of shooters) {
        ground.lineStyle(2, 0xd8b568, pulse).lineBetween(shooter.x + shooter.facingX * 14, shooter.y + 3, volleyTarget.x, volleyTarget.y - 8);
        ground.lineStyle(1, 0xf0dda5, pulse * .72).lineBetween(shooter.x + shooter.facingX * 14, shooter.y - 1, volleyTarget.x, volleyTarget.y - 12);
      }
      const sightX = Phaser.Math.Clamp(volleyTarget.x, 36, 924);
      const sightY = Phaser.Math.Clamp(volleyTarget.y - 10, 46, 474);
      g.lineStyle(3, 0xd8b568, pulse).strokeCircle(sightX, sightY, 31);
      g.lineStyle(1, 0xf1dda1, pulse).strokeCircle(sightX, sightY, 43);
      g.lineStyle(2, 0xd8b568, pulse)
        .lineBetween(sightX - 51, sightY, sightX - 22, sightY).lineBetween(sightX + 22, sightY, sightX + 51, sightY)
        .lineBetween(sightX, sightY - 51, sightX, sightY - 22).lineBetween(sightX, sightY + 22, sightX, sightY + 51);
      const barX = Phaser.Math.Clamp(sightX - 48, 18, 846);
      const barY = Phaser.Math.Clamp(sightY - 67, 24, 468);
      g.fillStyle(0x150f08, .92).fillRoundedRect(barX, barY, 98, 12, 2);
      g.lineStyle(2, 0xd4ae60, .9).strokeRoundedRect(barX, barY, 98, 12, 2);
      g.fillStyle(0xdcb86b, .98).fillRect(barX + 3, barY + 4, 92 * state.volleyProgress / 100, 4);
    }
    if (state.client) {
      const clientThreat = clientThreatened(state);
      this.drawHealth(state.client.x - 28, state.client.y - 54, 56, state.client.hp / state.client.maxHp, clientThreat ? 0xc45d46 : 0xd2b96f);
      if (clientThreat) {
        const hunter = state.enemies.filter((enemy) => enemy.hp > 0 && enemy.clientHunter).sort((a, b) => distanceBetween(a, state.client!) - distanceBetween(b, state.client!))[0];
        if (hunter) {
          const pulse = this.reducedMotion ? .48 : .36 + Math.sin(state.elapsed * 10) * .12;
          ground.lineStyle(state.clientGuarded ? 2 : 4, state.clientGuarded ? 0xd2b96f : 0xc34d3c, pulse).lineBetween(hunter.x, hunter.y + 8, state.client.x, state.client.y + 8);
          ground.lineStyle(2, state.clientGuarded ? 0x82ad8d : 0xe4aa70, .66).strokeCircle(state.client.x, state.client.y + 10, state.clientGuarded ? 48 : 38);
        }
      }
    }
    if (state.horse.tetherCut) {
      g.lineStyle(5, 0xb34838, .9).lineBetween(state.horse.x - 12, state.horse.y - 14, state.horse.x + 14, state.horse.y + 12);
      g.lineStyle(2, 0xf0c28b, .75).lineBetween(state.horse.x - 13, state.horse.y + 12, state.horse.x + 13, state.horse.y - 14);
    }
    if (!state.banner.lost && (state.banner.captureProgress > 0 || state.banner.stolen)) {
      const progress = state.banner.stolen ? 1 : state.banner.captureProgress / 100;
      const barX = Phaser.Math.Clamp(state.banner.x - 32, 18, 876);
      const barY = Phaser.Math.Clamp(state.banner.y - 28, 28, 478);
      g.fillStyle(0x130d0a, .9).fillRoundedRect(barX, barY, 66, 10, 2);
      g.lineStyle(2, 0xd1a75b, .82).strokeRoundedRect(barX, barY, 66, 10, 2);
      g.fillStyle(state.banner.stolen ? 0xb34535 : 0xc78443, .96).fillRect(barX + 3, barY + 3, 60 * progress, 4);
      if (state.banner.contested && !state.banner.stolen) {
        const flash = this.reducedMotion ? .7 : .55 + Math.sin(state.elapsed * 10) * .18;
        g.lineStyle(2, 0xe0bd72, flash).strokeRoundedRect(state.banner.x - 5, state.banner.y - 8, 57, 38, 2);
      }
    }
    const rescueTarget = state.rescueTargetId ? state.guards.find((guard) => guard.id === state.rescueTargetId) : undefined;
    const rescueGuard = state.rescueRescuerId ? state.guards.find((guard) => guard.id === state.rescueRescuerId) : undefined;
    if (rescueTarget && rescueTarget.hp <= 0) {
      const rescueColor = 0x86b491;
      if (rescueGuard) {
        ground.lineStyle(3, rescueColor, .42).lineBetween(rescueGuard.x, rescueGuard.y + 10, rescueTarget.x, rescueTarget.y + 10);
        ground.lineStyle(1, 0xe2d59d, .48).lineBetween(rescueGuard.x, rescueGuard.y + 6, rescueTarget.x, rescueTarget.y + 6);
      }
      const rescueX = Phaser.Math.Clamp(rescueTarget.x - 37, 18, 868);
      const rescueY = Phaser.Math.Clamp(rescueTarget.y - 66, 28, 470);
      g.fillStyle(0x10150f, .9).fillRoundedRect(rescueX, rescueY, 76, 12, 2);
      g.lineStyle(2, rescueColor, .86).strokeRoundedRect(rescueX, rescueY, 76, 12, 2);
      g.fillStyle(rescueColor, .96).fillRect(rescueX + 3, rescueY + 4, 70 * state.rescueProgress / 100, 4);
      g.lineStyle(2, 0xd7c982, .72)
        .lineBetween(rescueTarget.x - 28, rescueTarget.y - 31, rescueTarget.x - 28, rescueTarget.y - 18)
        .lineBetween(rescueTarget.x - 28, rescueTarget.y - 31, rescueTarget.x - 15, rescueTarget.y - 31)
        .lineBetween(rescueTarget.x + 28, rescueTarget.y - 31, rescueTarget.x + 28, rescueTarget.y - 18)
        .lineBetween(rescueTarget.x + 28, rescueTarget.y - 31, rescueTarget.x + 15, rescueTarget.y - 31);
    }

    if (state.attackPulse > 0) {
      g.lineStyle(9, 0xf4d885, state.attackPulse / 0.18);
      g.beginPath().arc(state.player.x, state.player.y, 62, -0.92 + Math.atan2(state.player.facingY, state.player.facingX), 0.92 + Math.atan2(state.player.facingY, state.player.facingX)).strokePath();
    }
    if (state.techniquePulse > 0) {
      const techniqueColor = state.config.martialArtId === "severing-sabre" ? 0xd66a4c : state.config.martialArtId === "binding-hands" ? 0x70a78a : 0xd6b85f;
      const proficiency = martialProficiencyRank(state.config.leader?.martialArtExperience ?? 0);
      const alpha = Math.min(1, state.techniquePulse / .24);
      const expansion = (0.32 - state.techniquePulse) * (120 + proficiency.level * 13);
      const facing = Math.atan2(state.player.facingY, state.player.facingX);
      if (state.config.martialArtId === "severing-sabre") {
        const reach = 54 + expansion + proficiency.level * 7;
        const cross = (angle: number, offset: number, color: number, width: number) => {
          const normalX = Math.cos(angle + Math.PI / 2) * offset;
          const normalY = Math.sin(angle + Math.PI / 2) * offset;
          g.lineStyle(width, color, alpha * .9).lineBetween(
            state.player.x - Math.cos(angle) * reach * .28 + normalX,
            state.player.y - Math.sin(angle) * reach * .28 + normalY,
            state.player.x + Math.cos(angle) * reach + normalX,
            state.player.y + Math.sin(angle) * reach + normalY,
          );
        };
        cross(facing - .48, -8, techniqueColor, 9 + proficiency.level);
        cross(facing + .28, 8, 0xf4dfab, 3 + Math.floor(proficiency.level / 2));
        g.lineStyle(2, 0xb74234, alpha * .75).strokeCircle(state.player.x + Math.cos(facing) * reach * .66, state.player.y + Math.sin(facing) * reach * .66, 18 + proficiency.level * 3);
      } else if (state.config.martialArtId === "binding-hands") {
        const radius = 46 + expansion * .72 + proficiency.level * 5;
        g.lineStyle(8 + proficiency.level, techniqueColor, alpha * .72).strokeCircle(state.player.x, state.player.y, radius);
        g.lineStyle(2, 0xdbe4b7, alpha * .8).strokeCircle(state.player.x, state.player.y, radius * .72);
        for (let knot = 0; knot < 4 + proficiency.level; knot += 1) {
          const angle = facing + knot * (Math.PI * 2 / (4 + proficiency.level));
          const knotX = state.player.x + Math.cos(angle) * radius;
          const knotY = state.player.y + Math.sin(angle) * radius;
          g.lineStyle(2, techniqueColor, alpha * .9).strokeCircle(knotX, knotY, 6 + proficiency.level);
        }
      } else {
        const radius = 58 + expansion + proficiency.level * 5;
        g.lineStyle(9 + proficiency.level, techniqueColor, alpha).beginPath().arc(state.player.x, state.player.y, radius, facing - 1.08, facing + 1.08).strokePath();
        g.lineStyle(2, 0xf4e5b1, alpha * .8).beginPath().arc(state.player.x, state.player.y, radius - 13, facing - .94, facing + .94).strokePath();
        for (let ray = -1; ray <= 1; ray += 1) {
          const angle = facing + ray * .48;
          g.lineStyle(3, ray === 0 ? 0xf4e5b1 : techniqueColor, alpha * .88).lineBetween(
            state.player.x + Math.cos(angle) * 32,
            state.player.y + Math.sin(angle) * 32,
            state.player.x + Math.cos(angle) * (radius + 23),
            state.player.y + Math.sin(angle) * (radius + 23),
          );
        }
      }
    }
    this.drawHealth(state.player.x - 28, state.player.y - 49, 56, state.player.hp / state.player.maxHp, 0x6ca57e);

    for (const guard of state.guards) {
      if (guard.hp <= 0) continue;
      const coreDeputy = guard.role === "副镖头";
      const width = coreDeputy ? 56 : 44;
      this.drawHealth(guard.x - width / 2, guard.y - (coreDeputy ? 47 : 42), width, guard.hp / guard.maxHp, coreDeputy ? 0xc59f59 : 0x739b7a);
    }

    for (const enemy of state.enemies) {
      if (enemy.hp <= 0) continue;
      if (enemy.carrier) {
        g.fillStyle(0x8f3429, .94).fillRoundedRect(enemy.x - 33, enemy.y - 24, 24, 27, 3);
        g.lineStyle(2, 0xe0bd72, .92).strokeRoundedRect(enemy.x - 33, enemy.y - 24, 24, 27, 3);
        g.lineStyle(2, 0xd6c18a, .82).lineBetween(enemy.x - 21, enemy.y - 24, enemy.x - 21, enemy.y + 3).lineBetween(enemy.x - 33, enemy.y - 11, enemy.x - 9, enemy.y - 11);
      }
      if (enemy.stunned > 0) {
        g.lineStyle(2, 0xe6ca79, 0.9).strokeCircle(enemy.x, enemy.y - 48, 9);
        g.lineBetween(enemy.x - 6, enemy.y - 48, enemy.x + 6, enemy.y - 48);
      }
      if (enemy.type === "hooker" && distanceBetween(enemy, state.cart) < 235) g.lineStyle(2, 0xd9b86d, .3).lineBetween(enemy.x - 18, enemy.y - 3, state.cart.x + 6, state.cart.y);
      if (enemy.type === "boarder" && (enemy.boarded || distanceBetween(enemy, state.cart) < 205)) {
        const boardColor = enemy.boarded ? 0xd66e43 : 0xd5a45e;
        const pulse = this.reducedMotion ? .62 : .52 + Math.sin(state.elapsed * 12 + enemy.lane) * .12;
        g.lineStyle(enemy.boarded ? 4 : 2, boardColor, pulse)
          .lineBetween(enemy.x - 5, enemy.y - 17, state.cart.x + 12, state.cart.y - 16 + enemy.lane * 13);
        if (enemy.boarded) {
          g.lineStyle(2, 0xf0c77b, pulse * .9)
            .lineBetween(state.cart.x - 1, state.cart.y - 25 + enemy.lane * 12, state.cart.x + 12, state.cart.y - 34 + enemy.lane * 12)
            .lineBetween(state.cart.x + 3, state.cart.y - 18 + enemy.lane * 12, state.cart.x + 17, state.cart.y - 27 + enemy.lane * 12);
        }
        if (enemy.attackWindup > 0) {
          const progress = Math.max(0, Math.min(1, 1 - enemy.attackWindup / Math.max(.01, enemy.attackWindupDuration)));
          const barX = Phaser.Math.Clamp(state.cart.x - 37, 18, 850);
          const barY = Phaser.Math.Clamp(state.cart.y + enemy.lane * 65, 38, 486);
          g.fillStyle(0x171008, .9).fillRoundedRect(barX, barY, 102, 11, 2);
          g.lineStyle(2, boardColor, .9).strokeRoundedRect(barX, barY, 102, 11, 2);
          g.fillStyle(boardColor, .96).fillRect(barX + 3, barY + 3, 96 * progress, 5);
        }
      }
      if (enemy.type === "cutter" && distanceBetween(enemy, state.horse) < 150) g.lineStyle(2, 0xe2d1ad, .55).lineBetween(enemy.x - 4, enemy.y - 8, state.horse.x, state.horse.y);
      if (enemy.type === "torch") {
        g.fillStyle(0xf1b34d, .16 + Math.sin(state.elapsed * 12) * .04).fillCircle(enemy.x - 17, enemy.y - 54, 18);
      }
      const healthWidth = enemy.type === "leader" ? 62 : 40;
      this.drawHealth(enemy.x - healthWidth / 2, enemy.y - (enemy.type === "leader" ? 54 : 42), healthWidth, enemy.hp / enemy.maxHp, enemy.type === "leader" ? 0xd08a45 : 0xa94b3d);
    }
  }
}

function distanceBetween(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export default function PhaserBattle({ config, onComplete }: PhaserBattleProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);
  const onCompleteRef = useRef(onComplete);
  const ordersRef = useRef<BattleOrders>(initialOrders());
  const [started, setStarted] = useState(false);
  const [result, setResult] = useState<BattleResult | null>(null);
  const [battleMoments, setBattleMoments] = useState<BattleMoment[]>([]);
  const momentTimersRef = useRef<number[]>([]);
  const [defenseVerdict, setDefenseVerdict] = useState<BattleDefenseVerdict | null>(null);
  const [strategy, setStrategy] = useState<BattleStrategy>("balanced");
  const [techniquePolicy, setTechniquePolicy] = useState<TechniquePolicy>("auto");
  const [doctrineId, setDoctrineId] = useState<BattleDoctrineId>("iron-ring");
  const [pace, setPace] = useState<BattlePace>("standard");
  const [paused, setPaused] = useState(false);
  const objectiveMode = battleObjectiveMode(config);
  const bossBattle = Boolean(config.enemyLeaderName);
  const martialArt = martialArtById(config.martialArtId);
  const martialExperience = config.leader?.martialArtExperience ?? 0;
  const martialRank = martialProficiencyRank(martialExperience);
  const deputy = config.guards.find((guard) => guard.role === "副镖头");
  const deputyBondExperience = config.leader?.deputyBond ?? 0;
  const deputyBond = deputyBondRank(deputyBondExperience);
  const coreCombatFocusId = config.leader?.coreCombatFocusId ?? DEFAULT_CORE_COMBAT_FOCUS;
  const coreCombatFocus = CORE_COMBAT_FOCUSES[coreCombatFocusId];
  const coreCombatExperience = config.leader?.coreCombatExperience ?? 0;
  const coreCombatRank = coreCombatFocusRank(coreCombatExperience);
  const coreComboTuning = battleCoreComboTuning(config.leader?.experience ?? 0, deputy?.experience ?? 0, deputyBondExperience, coreCombatFocusId, coreCombatExperience);
  const [hud, setHud] = useState<BattleHud>({
    playerHp: Math.max(1, Math.round((100 + (config.leader?.maxHpBonus ?? 0)) * (config.leader?.healthRatio ?? 1))),
    cartHp: Math.round((config.cartHealthRatio ?? 1) * 100),
    horseHp: Math.round((config.horseHealthRatio ?? 1) * 100),
    cargo: 100,
    progress: 0,
    remainingSeconds: objectiveMode === "breakthrough" ? null : config.objectiveSeconds ?? (objectiveMode === "holdout" ? 42 : objectiveMode === "pursuit" ? 34 : 48),
    enemies: Math.min(10, 6 + Math.floor(config.danger / 22)),
    enemyLeaderHp: bossBattle ? 100 : null,
    enemyLeaderPhase: bossBattle ? "command" : "absent",
    leaderChallengeCount: 0,
    message: battleInitialMessage(config),
    formation: objectiveMode === "holdout" ? "hold" : "advance",
    techniqueCooldown: 0,
    morale: Math.round(config.morale ?? 72),
    bannerProgress: 0,
    bannerState: "secure",
    rescueAvailable: Boolean(config.downedGuardIds?.length && config.guards.length > config.downedGuardIds.length),
    repairAvailable: Boolean((config.cartHealthRatio ?? 1) < .84 && config.guards.length),
    repairProgress: 0,
    volleyAvailable: Boolean(config.enemyLeaderName && config.guards.some((guard) => guard.equipmentIds?.some((id) => equipmentHasBattleTrait(id, "crossbow")))),
    volleyProgress: 0,
    volleyCooldown: 0,
    coordinationCount: 0,
    coordinationActive: false,
    coreComboCount: 0,
    coreComboActive: false,
    coreComboReadiness: deputy ? 100 : 0,
    coreComboCooldown: 0,
    coreCounterCount: 0,
    coreCounterActive: false,
    rearThreatCount: 0,
    rearSurrounded: false,
    rearDefenseActive: false,
    rearDefenseOutcome: null,
    rearTurnCount: 0,
    rearGuardCount: 0,
    rearHitCount: 0,
    defenseCounters: 0,
    defenseBreaches: 0,
    defenseOutcome: null,
    defenseActive: false,
    clientHp: config.escortClient ? Math.round(config.escortClient.healthRatio * 100) : null,
    clientThreatened: false,
    threat: { tone: "steady", label: "敌阵尚散", advice: "临机应变" },
    incomingIntent: null,
    incomingIntents: [],
    dangerFocus: false,
    timeScale: 1,
    activeStrategy: "balanced",
    pendingStrategy: null,
    commandProgress: 100,
    commandRemaining: 0,
    guards: config.guards.map((guard) => ({ id: guard.id, name: guard.name, hp: config.downedGuardIds?.includes(guard.id) ? 0 : Math.round(guard.healthRatio * 100), discipline: guard.disciplineName, mastery: guard.masteryName, injury: guard.injuryName })),
  });
  onCompleteRef.current = onComplete;
  const commandRelaySeconds = battleCommandRelayDuration({
    guardCount: config.guards.length,
    morale: hud.morale,
    hasDeputyCommand: config.guards.some((guard) => guard.masteryId === "deputy-command"),
    responderCount: config.guards.filter((guard) => guard.disciplineId === "responder").length,
  });
  const relayTalentLabel = [
    config.guards.some((guard) => guard.masteryId === "deputy-command") ? "镇场传令" : null,
    config.guards.filter((guard) => guard.disciplineId === "responder").length > 0 ? "游阵策应" : null,
  ].filter(Boolean).join(" · ") || "按队列传令";

  const showBattleMoment = useCallback((moment: BattleMoment) => {
    setBattleMoments((current) => [moment, ...current.filter((item) => item.id !== moment.id)].slice(0, 3));
    const timer = window.setTimeout(() => {
      setBattleMoments((current) => current.filter((item) => item.id !== moment.id));
    }, 3600);
    momentTimersRef.current.push(timer);
  }, []);

  const showDefenseVerdict = useCallback((verdict: BattleDefenseVerdict) => {
    setDefenseVerdict(verdict);
  }, []);

  useEffect(() => () => {
    for (const timer of momentTimersRef.current) window.clearTimeout(timer);
    momentTimersRef.current = [];
  }, []);

  useEffect(() => {
    if (result) continueRef.current?.focus({ preventScroll: true });
  }, [result]);

  useEffect(() => {
    if (!started || result) return;
    const pauseForInterruption = () => {
      ordersRef.current.paused = true;
      setPaused(true);
    };
    const pauseWhenHidden = () => { if (document.hidden) pauseForInterruption(); };
    document.addEventListener("visibilitychange", pauseWhenHidden);
    window.addEventListener("blur", pauseForInterruption);
    if (document.hidden || !document.hasFocus()) pauseForInterruption();
    return () => {
      document.removeEventListener("visibilitychange", pauseWhenHidden);
      window.removeEventListener("blur", pauseForInterruption);
    };
  }, [result, started]);

  useEffect(() => {
    if (!started) return;
    if (strategy === "rescue" && hud.rescueAvailable) return;
    if (strategy === "guard-client" && hud.clientThreatened) return;
    if (strategy === "repair-cart" && hud.repairAvailable) return;
    if (strategy === "focus-fire" && hud.volleyAvailable) return;
    if (strategy !== "rescue" && strategy !== "guard-client" && strategy !== "repair-cart" && strategy !== "focus-fire") return;
    setStrategy("balanced");
    ordersRef.current.command = issueBattleCommand(
      ordersRef.current.command,
      "balanced",
      commandRelaySeconds,
    );
  }, [commandRelaySeconds, hud.clientThreatened, hud.repairAvailable, hud.rescueAvailable, hud.volleyAvailable, started, strategy]);

  useEffect(() => {
    if (!started || !mountRef.current) return;
    const scene = new EscortScene(config, doctrineId, ordersRef.current, setHud, showBattleMoment, showDefenseVerdict, setResult);
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: mountRef.current,
      width: 960,
      height: 540,
      backgroundColor: "#28241c",
      scene,
      physics: { default: "arcade" },
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      render: { antialias: true, pixelArt: false },
    });
    return () => game.destroy(true);
  }, [config, doctrineId, showBattleMoment, showDefenseVerdict, started]);

  const issueStrategy = (next: BattleStrategy) => {
    setStrategy(next);
    ordersRef.current.command = issueBattleCommand(
      ordersRef.current.command,
      next,
      commandRelaySeconds,
    );
  };
  const selectPace = (next: BattlePace) => {
    setPace(next);
    ordersRef.current.pace = next;
  };
  const togglePause = () => {
    setPaused((current) => {
      const next = !current;
      ordersRef.current.paused = next;
      return next;
    });
  };
  const toggleTechniquePolicy = () => {
    const next = techniquePolicy === "auto" ? "reserve" : "auto";
    setTechniquePolicy(next);
    ordersRef.current.techniquePolicy = next;
  };
  const formationLabel = hud.formation === "advance" ? objectiveMode === "pursuit" ? "追击阵" : "行进阵" : hud.formation === "hold" ? "停阵" : "护马阵";
  const formationEffect = hud.activeStrategy === "rescue" ? "收阵拖回伤员" : hud.activeStrategy === "repair-cart" ? "车把式离阵 · 余众守尾" : hud.activeStrategy === "focus-fire" ? "持弩人手取准 · 余众守阵" : hud.activeStrategy === "guard-client" ? "收阵护人 · 优先截劫" : hud.formation === "advance" ? objectiveMode === "pursuit" ? "快手越阵追镖" : "全速推进" : hud.formation === "hold" ? "停阵减轻车伤" : "慢行减轻马伤";
  const sceneLabel = objectiveMode === "holdout"
    ? config.terrain === "river" ? "渡口停阵" : "据车固守"
    : objectiveMode === "gate-run" ? "抢时入城" : objectiveMode === "pursuit" ? "夺镖者正在逃" : bossBattle ? "匪首压阵" : config.terrain === "mountain" ? "山路突围" : "官道行进";
  const readyTitle = objectiveMode === "holdout" ? "守到援来" : objectiveMode === "gate-run" ? "车到门前，胜过杀尽" : objectiveMode === "pursuit" ? `截人，追回${config.recoveryLabel ?? "镖匣"}` : bossBattle ? "护阵，伺机斩首" : "护车，不必杀尽";
  const readyDescription = config.objectiveNote ?? (objectiveMode === "holdout"
    ? "车队必须停阵固守，时限走尽后仍保住车马即可脱险。"
    : objectiveMode === "gate-run"
      ? "客车会向城门疾进；停阵能够减伤，却会把仅剩的时辰交给追兵。"
      : objectiveMode === "pursuit"
        ? "夺镖者会持续向山口脱逃；追击阵会让快手越过车阵追截，停阵则优先保住剩余人车。"
      : "镖车会自行向东；停阵更能护车，却会把时限交给敌人。");
  const strategyLabel: Record<BattleStrategy, string> = { balanced: "临机应变", breakthrough: "强行开路", "guard-cart": "围车固守", "guard-horses": "护住马匹", "guard-client": "护住活镖", "focus-fire": "集中齐射", "repair-cart": "停阵抢修", rescue: "收阵救人" };
  const selectedDoctrine = battleDoctrine(doctrineId)!;
  const selectedPace = BATTLE_PACE_OPTIONS.find((option) => option.id === pace) ?? BATTLE_PACE_OPTIONS[1];
  const debrief = result ? battleResultPresentation(result, config) : null;
  const dominantFormation = result?.dominantFormation ? FORMATION_PROFICIENCIES[result.dominantFormation] : null;
  const formationTotalSeconds = result?.formationSeconds ? BATTLE_FORMATION_IDS.reduce((sum, id) => sum + result.formationSeconds![id], 0) : 0;
  const formationAwards = result?.leaderFormationExperience ?? result?.guardFormationExperience?.[config.guards[0]?.id ?? ""] ?? {};
  const leaderExperienceGain = result?.leaderExperience ?? result?.leaderContribution?.experience ?? 0;
  const leaderOldRank = crewRank(config.leader?.experience ?? 0);
  const leaderNewRank = crewRank((config.leader?.experience ?? 0) + leaderExperienceGain);
  const leaderNewInjury = crewInjuryById(result?.leaderInjury);
  const leaderFormationGains = result?.leaderFormationExperience ?? {};
  const leaderFormationGainLabel = BATTLE_FORMATION_IDS.filter((formationId) => (leaderFormationGains[formationId] ?? 0) > 0).map((formationId) => `${FORMATION_PROFICIENCIES[formationId].seal}+${leaderFormationGains[formationId]}`).join(" · ");
  const deputyBondGain = result?.leaderDeputyBondGain ?? 0;
  const deputyBondAfter = deputyBondRank(deputyBondExperience + deputyBondGain);
  const coreCombatExperienceGain = result?.leaderCoreCombatExperience?.[coreCombatFocusId] ?? 0;
  const coreCombatRankAfter = coreCombatFocusRank(coreCombatExperience + coreCombatExperienceGain);
  const martialExperienceGain = result?.leaderMartialExperience?.[martialArt.id] ?? 0;
  const martialRankAfter = martialProficiencyRank(martialExperience + martialExperienceGain);
  const damageValue = (damage: number, suffix = "") => damage > 0 ? `-${damage}${suffix}` : "无损";
  const cartResultValue = result && (result.cartRepair ?? 0) > 0 ? `+${result.cartRepair}` : damageValue(result?.cartDamage ?? 0);
  const bannerLabel = hud.bannerState === "lost" ? "失守" : hud.bannerState === "stolen" ? "被夺" : hud.bannerState === "contested" ? `${hud.bannerProgress}%` : "在阵";
  const enemyLeaderPhaseLabel = hud.enemyLeaderPhase === "challenge" ? "逼战" : hud.enemyLeaderPhase === "defeated" ? "已破" : "号令";
  const incomingDefense = hud.incomingIntent && hud.incomingIntent.recommendedStrategy !== "breakthrough" ? hud.incomingIntent.recommendedStrategy : null;
  const contextualStrategy: BattleStrategy = incomingDefense ?? (hud.clientThreatened ? "guard-client" : hud.rescueAvailable ? "rescue" : hud.repairAvailable ? "repair-cart" : hud.volleyAvailable ? "focus-fire" : "balanced");
  const contextualSeal = contextualStrategy === "guard-client" ? "人" : contextualStrategy === "guard-cart" ? "车" : contextualStrategy === "guard-horses" ? "马" : contextualStrategy === "rescue" ? "援" : contextualStrategy === "repair-cart" ? "修" : contextualStrategy === "focus-fire" ? "弩" : "衡";
  const contextualLabel = contextualStrategy === "guard-client" ? "护住活镖" : contextualStrategy === "guard-cart" ? "围车接招" : contextualStrategy === "guard-horses" ? "截住斩缰" : contextualStrategy === "rescue" ? "收阵救人" : contextualStrategy === "repair-cart" ? "停阵抢修" : contextualStrategy === "focus-fire" ? "集中齐射" : "临机应变";
  const contextualHint = hud.incomingIntent && incomingDefense
    ? `${hud.incomingIntent.actionLabel} · ${hud.incomingIntent.advice}`
    : contextualStrategy === "guard-client" ? "收拢阵形 · 优先截住劫人者" : contextualStrategy === "guard-cart" ? "停阵卸力 · 压住车旁专手" : contextualStrategy === "guard-horses" ? "护马阵迎刀 · 马伤减半" : contextualStrategy === "rescue" ? "派最近人手拖回伤员" : contextualStrategy === "repair-cart" ? hud.repairProgress > 0 ? `车把式脱阵 · 抢修 ${hud.repairProgress}%` : config.spareAxle ? "换上备用车轴 · 余众守尾" : "车把式紧榫复轴 · 余众守尾" : contextualStrategy === "focus-fire" ? hud.volleyProgress > 0 ? `踏弩取准 · 齐射 ${hud.volleyProgress}%` : "持弩镖师同步锁定高危目标" : "威胁与夺旗自适配";
  const liveThreat: BattleThreatNotice = hud.incomingIntent
    ? { tone: hud.incomingIntent.tone, label: `${hud.incomingIntent.actionLabel} → ${hud.incomingIntent.targetLabel}`, advice: `${Math.max(.1, hud.incomingIntent.remaining).toFixed(1)}息 · ${hud.incomingIntent.advice}` }
    : hud.threat;
  const commandClass = (candidate: BattleStrategy, base = "") => [
    base,
    hud.activeStrategy === candidate ? "is-active" : "",
    hud.pendingStrategy === candidate ? "is-pending" : "",
  ].filter(Boolean).join(" ");
  const commandLabel = hud.pendingStrategy
    ? `${strategyLabel[hud.activeStrategy]} → ${strategyLabel[hud.pendingStrategy]}`
    : strategyLabel[hud.activeStrategy];

  return (
    <section className={`battle-shell${result ? " is-resolved" : ""}`} aria-label="护车战斗">
      <div className="battle-topbar">
        <div>
          <span className="kicker">突发战斗 · {config.enemyFaction}</span>
          <h2>{config.objective}</h2>
          {(config.vehicleName || config.horseName) && <small className="battle-convoy-name">{config.vehicleName} · {config.horseName}</small>}
          {started && <small className={`battle-doctrine-tag doctrine-${doctrineId}`}><i>{selectedDoctrine.seal}</i>{selectedDoctrine.title}</small>}
        </div>
        <div className="battle-stats" aria-live="polite">
          <span>镖头 <b>{hud.playerHp}</b></span>
          <span>镖车 <b>{hud.cartHp}</b></span>
          <span>马匹 <b>{hud.horseHp}</b></span>
          {config.escortClient ? <span className={`battle-client-stat${hud.clientThreatened ? " is-threatened" : ""}`}>活镖 <b>{hud.clientHp ?? 0}</b></span> : <span>货物 <b>{hud.cargo}%</b></span>}
          <span className={`battle-morale-stat${hud.morale < 60 ? " is-low" : ""}`}>士气 <b>{hud.morale}</b></span>
          <span className={`battle-banner-stat is-${hud.bannerState}`}>镖旗 <b>{bannerLabel}</b></span>
          <span>余敌 <b>{hud.enemies}</b></span>
          {bossBattle && <span className={`battle-chief-stat is-${hud.enemyLeaderPhase}`} aria-label={`${config.enemyLeaderName}，${enemyLeaderPhaseLabel}阶段，气势 ${hud.enemyLeaderHp ?? 0}%`}>
            匪首 <b>{enemyLeaderPhaseLabel}</b><small>{hud.enemyLeaderPhase === "defeated" ? "群匪失令" : `气势 ${hud.enemyLeaderHp ?? 0}%`}</small><i><em style={{ width: `${hud.enemyLeaderHp ?? 0}%` }} /></i>
          </span>}
          {started && deputy && <span className={`battle-core-combo-stat focus-${coreCombatFocusId}${hud.coreComboActive || hud.coreCounterActive ? " is-active" : hud.coreComboReadiness >= 100 ? " is-ready" : ""}`} aria-label={`${coreCombatFocus.name}${hud.coreComboReadiness >= 100 ? "已经就绪" : `蓄势 ${hud.coreComboReadiness}%`}，本战合击 ${hud.coreComboCount} 次、迎锋 ${hud.coreCounterCount} 次`}>
            主副 <b>{hud.coreCounterActive ? "截锋" : hud.coreComboActive ? "合击" : hud.coreComboReadiness >= 100 ? "待发" : `${Math.ceil(hud.coreComboCooldown)}息`}</b><small>{coreCombatFocus.name} · {hud.coreComboCount}合{hud.coreCounterCount > 0 ? ` · ${hud.coreCounterCount}截` : ""}</small><i><em style={{ width: `${hud.coreComboReadiness}%` }} /></i>
          </span>}
          {started && <span className={`battle-coordination-stat${hud.coordinationActive ? " is-active" : ""}`}>连携 <b>{hud.coordinationCount}</b></span>}
          {started && <span className={`battle-defense-stat${hud.defenseActive && hud.defenseOutcome ? ` is-${hud.defenseOutcome}` : ""}`}>应招 <b>{hud.defenseCounters}妥 · {hud.defenseBreaches}失</b></span>}
          {started && <span className={`battle-rear-stat${hud.rearDefenseActive && hud.rearDefenseOutcome ? ` is-${hud.rearDefenseOutcome}` : ""}${hud.rearSurrounded ? " is-surrounded" : ""}`} aria-label={`身后判定：自动回身 ${hud.rearTurnCount} 次，副镖头护背 ${hud.rearGuardCount} 次，背袭命中 ${hud.rearHitCount} 次`}>
            护背 <b>{hud.rearSurrounded ? "脱围" : hud.rearThreatCount > 0 ? `警 ${hud.rearThreatCount}` : hud.rearDefenseOutcome === "guard" && hud.rearDefenseActive ? "截住" : "稳"}</b><small>{hud.rearTurnCount}回 · {hud.rearGuardCount}截{hud.rearHitCount > 0 ? ` · ${hud.rearHitCount}中` : ""}</small>
          </span>}
          {hud.remainingSeconds !== null && <span className="battle-timer">{objectiveMode === "holdout" ? "援至" : objectiveMode === "pursuit" ? "脱逃" : "闭门"} <b>{hud.remainingSeconds}息</b></span>}
        </div>
      </div>
      <div className="battle-crew-line" aria-label="随行镖队">
        {hud.guards.map((guard) => <span key={guard.id}><strong>{guard.name}{guard.discipline && <mark>{guard.discipline}</mark>}{guard.mastery && <mark className="is-mastery" title={`老手绝活：${guard.mastery}`}>绝·{guard.mastery.slice(0, 2)}</mark>}{guard.injury && <mark className="is-injury">{guard.injury}</mark>}{guard.support && <em>{guard.support}</em>}</strong><i><em style={{ width: `${guard.hp}%` }} /></i><b>{guard.hp}</b></span>)}
      </div>
      <div className="battle-progress"><i style={{ width: `${hud.progress}%` }} /></div>
      {started && !result && hud.incomingIntents.length > 0 && <section className="battle-intent-ledger" aria-label="敌招队列">
        <header><i>候</i><span><b>敌招将发</b><small>{hud.incomingIntents.length} 路来势 · 先看目标再下令</small></span></header>
        <div>
          {hud.incomingIntents.map((intent) => <article key={intent.enemyId} className={`is-${intent.readiness} tone-${intent.tone}`} title={`${intent.actionLabel}将攻向${intent.targetLabel}，建议${strategyLabel[intent.recommendedStrategy]}`}>
            <i>{enemyIntentSeal(intent.enemyType)}</i>
            <span><small>{intent.actionLabel} · 宜{strategyLabel[intent.recommendedStrategy]}</small><b>{intent.targetLabel}</b></span>
            <em>{Math.max(.1, intent.remaining).toFixed(1)}息</em>
            <strong>{intentReadinessLabel(intent.readiness)}</strong>
            <span className="battle-intent-progress"><i style={{ width: `${Math.round(intent.progress * 100)}%` }} /></span>
          </article>)}
        </div>
      </section>}
      {started && !result && <div className={`battle-pacebar${paused ? " is-paused" : hud.dangerFocus ? " is-focused" : ""}`} aria-label="观阵节奏">
        <span aria-live="polite"><i>{paused ? "停" : hud.dangerFocus ? "危" : selectedPace.seal}</i><b>{paused ? "按兵审势" : hud.dangerFocus ? "敌招将发 · 自动审势" : `观阵 · ${selectedPace.label}`}</b><small>{paused ? "战阵已停，仍可调整阵令" : hud.dangerFocus ? `时流放缓至 ${hud.timeScale.toFixed(1)} 倍，等你定策` : selectedPace.description}</small></span>
        <div role="group" aria-label="选择战斗速度">
          <button aria-pressed={paused} className={paused ? "is-active is-pause" : "is-pause"} onClick={togglePause}><i>{paused ? "续" : "停"}</i><span>{paused ? "续阵" : "暂停"}</span></button>
          {BATTLE_PACE_OPTIONS.map((option) => <button key={option.id} aria-pressed={pace === option.id} className={pace === option.id ? "is-active" : ""} title={option.description} onClick={() => selectPace(option.id)}><i>{option.seal}</i><span>{option.label}</span></button>)}
        </div>
      </div>}
      {started && <div className="battle-command-strip" aria-label="镖队阵令">
        <span className={`battle-order-state is-${liveThreat.tone} ${hud.incomingIntent ? "has-incoming-intent" : ""}${hud.pendingStrategy ? " is-relaying" : ""}`}><small>{hud.pendingStrategy ? `传令尚需 ${Math.max(.1, hud.commandRemaining).toFixed(1)} 息` : `${formationLabel} · ${formationEffect}`}</small><b>{commandLabel}</b><em>{liveThreat.label} · {liveThreat.advice}</em>{hud.pendingStrategy && <span className="battle-command-relay" aria-label={`阵令传达 ${hud.commandProgress}%`}><i style={{ width: `${hud.commandProgress}%` }} /></span>}</span>
        <button aria-pressed={hud.activeStrategy === contextualStrategy} aria-busy={hud.pendingStrategy === contextualStrategy} className={commandClass(contextualStrategy, `${contextualStrategy === "guard-client" ? "battle-client-order" : contextualStrategy === "rescue" ? "battle-rescue" : contextualStrategy === "repair-cart" ? "battle-repair-order" : contextualStrategy === "focus-fire" ? "battle-volley-order" : ""}${hud.incomingIntent && incomingDefense ? " battle-incoming-order" : ""}`)} onClick={() => issueStrategy(contextualStrategy)}><i>{contextualSeal}</i><span>{contextualLabel}<small>{contextualHint}</small></span></button>
        <button aria-pressed={hud.activeStrategy === "breakthrough"} aria-busy={hud.pendingStrategy === "breakthrough"} className={commandClass("breakthrough")} onClick={() => issueStrategy("breakthrough")}><i>进</i><span>{objectiveMode === "pursuit" ? "分队追镖" : "强行开路"}<small>{objectiveMode === "pursuit" ? "优先截住夺镖者" : hud.bannerState === "stolen" ? "快手越阵追回镖旗" : bossBattle ? "优先追斩匪首" : "全速推进"}</small></span></button>
        <button aria-pressed={hud.activeStrategy === "guard-cart"} aria-busy={hud.pendingStrategy === "guard-cart"} className={commandClass("guard-cart")} onClick={() => issueStrategy("guard-cart")}><i>车</i><span>围车固守<small>停阵 · 护车压制夺旗</small></span></button>
        <button aria-pressed={hud.activeStrategy === "guard-horses"} aria-busy={hud.pendingStrategy === "guard-horses"} className={commandClass("guard-horses")} onClick={() => issueStrategy("guard-horses")}><i>马</i><span>护住马匹<small>慢行 · 马伤减半</small></span></button>
        <button aria-pressed={techniquePolicy === "auto"} className={`battle-technique martial-${martialArt.id} ${techniquePolicy === "auto" ? "is-active" : ""}`} onClick={toggleTechniquePolicy}><i>{martialArt.seal}</i><span>{techniquePolicy === "auto" ? `绝技自动 · ${hud.techniqueCooldown > .05 ? `${Math.ceil(hud.techniqueCooldown)}息` : "待发"}` : "绝技保留"}<small>{martialArt.technique} · {martialRank.label}</small></span></button>
        <button className="battle-retreat" onClick={() => { ordersRef.current.paused = false; ordersRef.current.retreat = true; setPaused(false); }}><i>退</i><span>鸣金撤退<small>保人弃势</small></span></button>
      </div>}
      {!started ? (
        <div className="battle-ready">
          <div className="battle-ready-figure"><span>戰</span><img src={`${import.meta.env.BASE_URL}assets/battle/leader/01.png`} alt="持枪迎敌的镖头" /></div>
          <div className="battle-ready-copy">
            <span className="kicker">{sceneLabel} · 等你发令</span>
            <h3>{readyTitle}</h3>
            <p className="battle-ready-objective">{readyDescription} {(config.cartHealthRatio ?? 1) < .84 ? `镖车当前只有 ${Math.round((config.cartHealthRatio ?? 1) * 100)} 分车况，开战后可下「停阵抢修」令。` : config.enemyLeaderName && config.guards.some((guard) => guard.equipmentIds?.some((id) => equipmentHasBattleTrait(id, "crossbow"))) ? `持近阵强弩的队员会等待你的「集中齐射」令。` : config.escortClient ? `「${config.escortClient.name}」会作为真实单位随车行动，危急时可下「护住活镖」令。` : !config.objectiveNote && config.danger >= 54 && objectiveMode !== "pursuit" ? "高危匪众可能派夺旗手直取行旗。" : ""}</p>
            <div className="battle-control-contract" aria-label="战斗操作分工">
              <i>令</i><span><small>玩家只管策略</small><b>选预案 · 下阵令</b><em>敌招显形时自动缓速</em></span><strong>人物自动作战</strong>
            </div>
            {config.escortClient && <div className="battle-client-slip"><img src={BATTLE_ASSETS.client.path} alt="活镖旅客" /><span><small>此行活镖</small><b>{config.escortClient.name}</b><em>人身气血会带入余程与最终交割</em></span></div>}
            {bossBattle && <div className="battle-chief-slip"><i>首</i><span><small>敌方首领 · 两阶段自动行为</small><b>{config.enemyLeaderName}</b><em>先在后阵号令群匪；局势不利时会弃旗逼战、直取总镖头。重招将提前显形，「强行开路」可自动迎锋破势。</em></span><strong>号令 → 逼战</strong></div>}
            <div className="battle-doctrine-picker" aria-label="选择战术预案">
              <header><span>战前预案</span><small>自动作战将按此站位与节奏执行</small></header>
              <div>{BATTLE_DOCTRINE_LIST.map((item) => <button key={item.id} aria-pressed={doctrineId === item.id} className={doctrineId === item.id ? "is-selected" : ""} onClick={() => setDoctrineId(item.id)}>
                <i style={{ color: item.color }}>{item.seal}</i><span><b>{item.title}</b><small>{item.effect}</small><em>{item.risk}</em></span>
              </button>)}</div>
            </div>
            <div className="battle-ready-launch">
              <div className="battle-relay-readiness"><i>令</i><span><small>本队阵令传达</small><b>约 {commandRelaySeconds.toFixed(1)} 息送达</b><em>{relayTalentLabel} · 士气越稳响应越快</em></span></div>
              <button className="primary-button" onClick={() => setStarted(true)}>按「{selectedDoctrine.title}」迎敌</button>
            </div>
            <details className="battle-ready-details">
              <summary><span><small>本阵人物与自动行动</small><b>武学 · 双核心 · 装备 · 护背</b></span><em>展开详情</em></summary>
              <p>镖头与随行镖师会自行寻敌、出招与护车；身后近敌会触发自动回身，三面受敌时会边迎敌边侧退脱围，副镖头在近侧则自动补住背袭路线。你只需临阵调整护卫重点与推进节奏。敌方危险起手命中车、马或活镖时，会以「应／破」明确结算阵令是否对症。绝技「{martialArt.technique}」默认在合适时机自动施展。</p>
              <div className={`battle-martial-slip martial-${martialArt.id}${config.leader?.injuryName ? " is-injured" : ""}`}><i>{martialArt.seal}</i><span><small>{config.leader?.name ?? "总镖头"} · {crewRank(config.leader?.experience ?? 0).label} · {martialRank.label} · 武历 {martialExperience} · {martialArt.school}{config.leader?.injuryName ? <mark>带伤 · {config.leader.injuryName}</mark> : null}</small><b>{martialArt.name}</b><em>{martialProficiencyEffectSummary(martialArt.id, martialExperience)}{config.leader?.equipmentNames?.length ? ` · 随身 ${config.leader.equipmentNames.join("、")}` : ""}</em></span></div>
              {deputy && <div className={`battle-core-bond-slip focus-${coreCombatFocusId} bond-level-${deputyBond.level}`} aria-label={`双核心武路 ${coreCombatFocus.name}，主副默契 ${deputyBond.label}`}>
                <i>{coreCombatFocus.seal}</i><span><small>{coreCombatFocus.name} · {coreCombatRank.label} · 武路 {coreCombatExperience} · 默契「{deputyBond.label}」</small><b>{config.leader?.name ?? "总镖头"} × {deputy.name}</b><em>{coreCombatFocusEffectSummary(coreCombatFocusId, coreCombatExperience)} · 约 {coreComboTuning.cooldownSeconds.toFixed(1)} 息再合</em></span><strong>自动依路出招</strong>
              </div>}
              <div className="battle-ready-crew">{config.guards.map((guard) => <span key={guard.id}><b>{guard.name}</b>{guard.role}{guard.disciplineName && <em>{guard.disciplineName}</em>}{guard.masteryName && <em className="is-mastery">绝活 · {guard.masteryName}</em>}{guard.injuryName && <mark>{guard.injuryName}</mark>}<small>{crewRank(guard.experience ?? 0).label} · 阅历 {guard.experience ?? 0} · {guard.equipmentNames?.length ? guard.equipmentNames.join(" · ") : "未配器械"}</small></span>)}</div>
              <div className="ready-controls"><span>预案 <b>{selectedDoctrine.title}</b></span><span>临阵 <b>只下阵令</b></span><span>护背 <b>自动回身脱围</b></span><span>连携 <b>同敌自动合击</b></span><span>{config.guards.some((guard) => guard.equipmentIds?.some((id) => equipmentHasBattleTrait(id, "crossbow"))) ? "弩令" : (config.cartHealthRatio ?? 1) < .84 ? "抢修" : "救援"} <b>{config.guards.some((guard) => guard.equipmentIds?.some((id) => equipmentHasBattleTrait(id, "crossbow"))) ? "齐射取准" : (config.cartHealthRatio ?? 1) < .84 ? config.spareAxle ? "备用轴在车" : "就地紧榫" : "倒地可救"}</b></span><span>绝技 <b>自动择机</b></span></div>
            </details>
          </div>
        </div>
      ) : (
        <div className={`phaser-frame focus-${coreCombatFocusId}${result ? " has-debrief" : ""}${paused ? " is-paused" : ""}${hud.dangerFocus && !paused ? " is-danger-focus" : ""}${(hud.coreComboActive || hud.coreCounterActive) && !paused ? " is-core-combo" : ""}`}>
          <div className="phaser-mount" ref={mountRef} />
          {paused && !result && <div className="battle-pause-curtain" role="status"><i>停</i><span><b>按兵审势</b><small>人物不会行动，阵令仍可调整</small></span></div>}
          {hud.dangerFocus && !paused && hud.incomingIntent && <div className="battle-danger-focus" aria-hidden="true"><i>危</i><span><b>{hud.incomingIntent.actionLabel}</b><small>{hud.incomingIntent.targetLabel} · 时流放缓</small></span></div>}
          {!result && defenseVerdict && <div className={`battle-defense-verdict is-${defenseVerdict.tone}`} role="status" aria-label={`阵令判词：${defenseVerdict.incoming}攻向${defenseVerdict.target}，${defenseVerdict.strategyLabel}${defenseVerdict.tone === "counter" ? "应对得当" : "未能应对"}，${defenseVerdict.result}`}>
            <header><i>{defenseVerdict.seal}</i><span><small>阵令判词 · 最近一招</small><b>{defenseVerdict.title}</b></span></header>
            <ol>
              <li><small>来招</small><b>{defenseVerdict.incoming}</b><em>攻向 {defenseVerdict.target}</em></li>
              <li><small>我令</small><b><i>{defenseVerdict.strategySeal}</i>{defenseVerdict.strategyLabel}</b><em>{defenseVerdict.tone === "counter" ? "阵令对症" : "阵令失应"}</em></li>
              <li><small>结算</small><b>{defenseVerdict.result}</b><em>{defenseVerdict.advice}</em></li>
            </ol>
          </div>}
          {!result && battleMoments.length > 0 && <div className="battle-moment-feed" aria-live="polite" aria-label="阵中自动行动记功">
            {battleMoments.map((moment) => <article key={moment.id} className={`is-${moment.tone}`}>
              <i>{moment.seal}</i>
              <span><small>{moment.eyebrow}</small><b>{moment.title}</b><em>{moment.detail}</em></span>
            </article>)}
          </div>}
          {result && debrief && (
            <div className={`battle-debrief is-${debrief.tone}`} role="dialog" aria-modal="true" aria-labelledby="battle-result-title">
              <article>
                <header>
                  <span className="battle-debrief-seal" aria-label={`战阵评定 ${debrief.grade}`}>{debrief.grade}</span>
                  <div>
                    <small>{debrief.eyebrow}</small>
                    <h3 id="battle-result-title">{debrief.title}</h3>
                    <p>{debrief.summary}</p>
                  </div>
                </header>
                <div className="battle-debrief-metrics" aria-label="战斗损失">
                  <span className={result.leaderDamage >= 20 ? "is-severe" : ""}><i>人</i><small>镖头伤势</small><b>{damageValue(result.leaderDamage)}</b></span>
                  <span className={(result.horseDamage ?? 0) >= 12 ? "is-severe" : ""}><i>马</i><small>马匹损伤</small><b>{damageValue(result.horseDamage ?? 0)}</b></span>
                  <span className={result.cartDamage >= 10 ? "is-severe" : (result.cartRepair ?? 0) > 0 ? "is-repaired" : ""}><i>车</i><small>{(result.cartRepair ?? 0) > 0 ? "阵前抢修" : "车架损伤"}</small><b>{cartResultValue}</b></span>
                  {config.escortClient
                    ? <span className={(result.clientDamage ?? 0) >= 12 || result.clientDowned ? "is-severe" : ""}><i>人</i><small>活镖伤势</small><b>{result.clientDowned ? "失守" : damageValue(result.clientDamage ?? 0)}</b></span>
                    : <span className={result.cargoLoss >= 8 ? "is-severe" : ""}><i>货</i><small>镖物折损</small><b>{damageValue(result.cargoLoss, "%")}</b></span>}
                  <span className={result.sealBroken ? "is-severe" : ""}><i>封</i><small>镖封</small><b>{result.sealBroken ? "已破" : "完好"}</b></span>
                  <span className={result.bannerLost ? "is-severe" : ""}><i>旗</i><small>风云行旗</small><b>{result.bannerLost ? "失守" : result.bannerRecovered ? "复得" : "在阵"}</b></span>
                </div>
                {((result.defenseCounters ?? 0) + (result.defenseBreaches ?? 0) > 0) && <div className={`battle-defense-record${(result.defenseBreaches ?? 0) > (result.defenseCounters ?? 0) ? " is-breached" : ""}`}>
                  <i>阵</i><span><small>临阵应对</small><b>得当 {result.defenseCounters ?? 0} 次 · 失位 {result.defenseBreaches ?? 0} 次</b><em>{(result.defenseBreaches ?? 0) === 0 ? "车、马与活镖的危险起手均被阵令接住" : (result.defenseCounters ?? 0) >= (result.defenseBreaches ?? 0) ? "多数危险起手得到正确应对" : "阵令失位较多，下一程宜更留意敌招目标"}</em></span>
                </div>}
                {bossBattle && <div className={`battle-chief-record${result.enemyLeaderDefeated ? " is-defeated" : " is-escaped"}`}>
                  <i>{result.enemyLeaderDefeated ? "破" : "遁"}</i><span><small>匪首交锋</small><b>{result.enemyLeaderDefeated ? `${config.enemyLeaderName}伏诛，群匪失令` : `${config.enemyLeaderName}趁乱脱阵`}</b><em>后阵号令后逼战 {result.leaderChallenges ?? 0} 次；{result.enemyLeaderDefeated ? "斩首威名与记功写入行程" : "车队脱阵为先，未能留下匪首"}。</em></span>
                </div>}
                {dominantFormation && formationTotalSeconds > 0 && <div className="battle-formation-review" aria-label="阵法熟练结算">
                  <i>{dominantFormation.seal}</i>
                  <span><small>阵令复盘 · 随阵习练</small><b>本阵主用「{dominantFormation.name}」</b><em>{dominantFormation.effect}；参战镖师会按实际阵令积累对应阵历。</em></span>
                  <strong>{BATTLE_FORMATION_IDS.map((formationId) => {
                    const seconds = result.formationSeconds?.[formationId] ?? 0;
                    if (seconds < .5) return null;
                    return <mark key={formationId} className={formationAwards[formationId] ? "is-earned" : ""}>{FORMATION_PROFICIENCIES[formationId].seal} {Math.round(seconds)}息{formationAwards[formationId] ? " · 阵历 +1" : ""}</mark>;
                  })}</strong>
                </div>}
                {deputy && deputyBondGain > 0 && <div className={`battle-core-combo-review${deputyBondAfter.level > deputyBond.level ? " is-rank-up" : ""}`} aria-label="主副合击与默契结算">
                  <i>双</i>
                  <span><small>双核心记功 · 默契成长</small><b>{config.leader?.name ?? "总镖头"}与{deputy.name}并肩破阵</b><em>默契「{deputyBond.label}」{deputyBondAfter.level > deputyBond.level ? `晋为「${deputyBondAfter.label}」` : `提升至 ${deputyBondExperience + deputyBondGain}`}；往后合击会更快、更重。</em></span>
                  <strong>合击 {result.leaderDeputyCombos ?? 0} 次 · 截锋 {result.leaderDeputyCounters ?? 0} 次 · 默契 +{deputyBondGain}</strong>
                </div>}
                {coreCombatExperienceGain > 0 && <div className={`battle-core-combo-review battle-core-focus-review${coreCombatRankAfter.level > coreCombatRank.level ? " is-rank-up" : ""}`} aria-label="双核心武路成长结算">
                  <i>{coreCombatFocus.seal}</i>
                  <span><small>主角与副镖头 · 战斗专精成长</small><b>武路「{coreCombatFocus.name}」</b><em>{coreCombatRankAfter.level > coreCombatRank.level ? `由「${coreCombatRank.label}」晋为「${coreCombatRankAfter.label}」` : `武路提升至 ${coreCombatExperience + coreCombatExperienceGain}`}；{coreCombatFocus.growthHint}。</em></span>
                  <strong>武路 +{coreCombatExperienceGain} · {coreCombatFocusEffectSummary(coreCombatFocusId, coreCombatExperience + coreCombatExperienceGain)}</strong>
                </div>}
                {martialExperienceGain > 0 && <div className={`battle-core-combo-review battle-martial-review martial-${martialArt.id}${martialRankAfter.level > martialRank.level ? " is-rank-up" : ""}`} aria-label="总镖头武学熟练成长结算">
                  <i>{martialArt.seal}</i>
                  <span><small>主角专属 · 武学实战成长</small><b>{martialArt.name} · {martialRankAfter.label}</b><em>{martialRankAfter.level > martialRank.level ? `由「${martialRank.label}」晋为「${martialRankAfter.label}」` : `武历提升至 ${martialExperience + martialExperienceGain}`}；绝技由总镖头自行择机，所用越熟，招路越稳。</em></span>
                  <strong>武历 +{martialExperienceGain} · {martialProficiencyEffectSummary(martialArt.id, martialExperience + martialExperienceGain)}</strong>
                </div>}
                <div className="battle-debrief-crew" aria-label="随行人手战后记功与伤势">
                  <span className={`is-leader${leaderNewInjury ? " is-severe" : ""}${leaderNewRank.level > leaderOldRank.level ? " is-rank-up" : ""}`}>
                    <i>主</i>
                    <b>{config.leader?.name ?? "总镖头"}{result.leaderContribution && <em>{result.leaderContribution.title}</em>}</b>
                    <small>总镖头 · {battleInjuryLabel(result.leaderDamage)}{result.leaderDamage > 0 ? ` ${result.leaderDamage}` : ""}{leaderNewInjury ? ` · ${leaderNewInjury.name}` : ""} · 第一战力</small>
                    <strong><span>{result.leaderContribution?.damage ? `破敌 ${result.leaderContribution.damage}` : "坐镇中军"}{result.leaderContribution?.defeats ? ` · 击破 ${result.leaderContribution.defeats}` : ""}</span><mark>阅历 +{leaderExperienceGain}</mark>{leaderFormationGainLabel && <mark className="is-formation">阵 {leaderFormationGainLabel}</mark>}{leaderNewRank.level > leaderOldRank.level && <em>晋 · {leaderNewRank.label}</em>}</strong>
                  </span>
                  {config.guards.map((guard) => {
                    const damage = result.guardDamage[guard.id] ?? 0;
                    const newInjury = crewInjuryById(result.guardInjuries?.[guard.id]);
                    const contribution = result.guardContributions?.[guard.id];
                    const experience = result.guardExperience?.[guard.id] ?? contribution?.experience ?? 0;
                    const oldRank = crewRank(guard.experience ?? 0);
                    const newRank = crewRank((guard.experience ?? 0) + experience);
                    const rankUp = newRank.level > oldRank.level;
                    const oldFormationExperience = normalizeFormationExperience(guard.formationExperience);
                    const formationGains = result.guardFormationExperience?.[guard.id] ?? {};
                    const formationRankUp = BATTLE_FORMATION_IDS.find((formationId) => {
                      const gain = formationGains[formationId] ?? 0;
                      return gain > 0 && formationProficiencyRank(oldFormationExperience[formationId] + gain).level > formationProficiencyRank(oldFormationExperience[formationId]).level;
                    });
                    const formationGainLabel = BATTLE_FORMATION_IDS.filter((formationId) => (formationGains[formationId] ?? 0) > 0).map((formationId) => `${FORMATION_PROFICIENCIES[formationId].seal}+${formationGains[formationId]}`).join(" · ");
                    return <span key={guard.id} className={`${guard.role === "副镖头" ? "is-deputy " : ""}${damage >= 25 || (newInjury?.severity ?? 0) >= 3 ? "is-severe " : ""}${rankUp ? "is-rank-up" : ""}`}>
                      <i>{guard.name.slice(0, 1)}</i>
                      <b>{guard.name}{contribution && <em>{contribution.title}</em>}</b>
                      <small>{guard.role}{guard.role === "副镖头" ? " · 第二战力" : ""} · {battleInjuryLabel(damage)}{damage > 0 ? ` ${damage}` : ""}{newInjury ? ` · ${newInjury.name}` : ""}</small>
                      <strong><span>{contribution?.damage ? `破敌 ${contribution.damage}` : "守阵"}{contribution?.support ? ` · 援护 ${contribution.support}` : ""}{contribution?.defeats ? ` · 击破 ${contribution.defeats}` : ""}</span><mark>阅历 +{experience}</mark>{formationGainLabel && <mark className="is-formation">阵 {formationGainLabel}</mark>}{rankUp && <em>晋 · {newRank.label}</em>}{formationRankUp && <em>阵 · {formationProficiencyRank(oldFormationExperience[formationRankUp] + (formationGains[formationRankUp] ?? 0)).label}</em>}</strong>
                    </span>;
                  })}
                </div>
                <footer>
                  <p><i>后续</i>{debrief.advice}</p>
                  <button ref={continueRef} className="primary-button" onClick={() => onCompleteRef.current(result)}>收阵，继续行程</button>
                </footer>
              </article>
            </div>
          )}
        </div>
      )}
      <div className="battle-footer">
        <div className="battle-message">{debrief?.title ?? hud.message}</div>
        <div className="battle-controls">{result ? "伤损、抢修、人身、士气、阵令应对与旗号结果将在收阵后写回行程" : `全队自动作战 · 自动回身与脱围 · ${selectedDoctrine.title}预案 · ${(config.cartHealthRatio ?? 1) < .84 ? "车况危急时可下抢修令" : config.enemyLeaderName && config.guards.some((guard) => guard.equipmentIds?.some((id) => equipmentHasBattleTrait(id, "crossbow"))) ? "高危目标入弩程可下齐射令" : config.escortClient ? "危急时可下护人令" : "倒地时可下救人令"} · 「应／破」记录危险起手是否接住`}</div>
      </div>
    </section>
  );
}
