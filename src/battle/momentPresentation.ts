import { martialArtById } from "../core/martialContent";
import { DEFAULT_CORE_COMBAT_FOCUS } from "../core/coreCombatFocusContent";
import type { BattleConfig } from "../core/types";
import type { BattleDoctrine } from "./doctrineContent";
import { battleCoreFocusMomentDetail, battleCoreFocusVisual } from "./coreFocusPresentation";
import type { BattleCue, BattleFormation, BattleStrategy } from "./simulation";

export type BattleMomentTone = "gold" | "jade" | "danger" | "ink";

export interface BattleMoment {
  id: number;
  tone: BattleMomentTone;
  seal: string;
  eyebrow: string;
  title: string;
  detail: string;
}

export interface BattleDefenseVerdict {
  id: number;
  tone: "counter" | "breach";
  seal: string;
  title: string;
  incoming: string;
  target: string;
  strategy: BattleStrategy;
  strategyLabel: string;
  strategySeal: string;
  result: string;
  advice: string;
}

const STRATEGY_PRESENTATION: Record<BattleStrategy, { label: string; seal: string }> = {
  balanced: { label: "临机应变", seal: "衡" },
  breakthrough: { label: "强行开路", seal: "进" },
  "guard-cart": { label: "围车固守", seal: "车" },
  "guard-horses": { label: "护住马匹", seal: "马" },
  "guard-client": { label: "护住活镖", seal: "人" },
  "focus-fire": { label: "集中齐射", seal: "弩" },
  "repair-cart": { label: "停阵抢修", seal: "修" },
  rescue: { label: "收阵救人", seal: "援" },
};

const ORDER_PRESENTATION: Record<BattleStrategy, Omit<BattleMoment, "id">> = {
  balanced: { tone: "ink", seal: "衡", eyebrow: "阵令已下 · 全队响应", title: "临机应变", detail: "各按战职自行判断威胁，维持车阵推进" },
  breakthrough: { tone: "gold", seal: "进", eyebrow: "阵令已下 · 先锋响应", title: "强行开路", detail: "镖头与快手越阵，自动优先截住高危敌手" },
  "guard-cart": { tone: "jade", seal: "车", eyebrow: "阵令已下 · 护具响应", title: "围车固守", detail: "全队收拢，盾牌与固轮器械自动护住镖车" },
  "guard-horses": { tone: "gold", seal: "马", eyebrow: "阵令已下 · 钩镰响应", title: "护住马匹", detail: "截缰器械靠前，余众贴马阻住割缰手" },
  "guard-client": { tone: "gold", seal: "人", eyebrow: "阵令已下 · 近卫响应", title: "护住活镖", detail: "镖师收阵护人，自动优先截住劫人者" },
  "focus-fire": { tone: "gold", seal: "弩", eyebrow: "阵令已下 · 持弩人响应", title: "集中齐射", detail: "强弩同步取准，锁定匪首或高危专手" },
  "repair-cart": { tone: "gold", seal: "修", eyebrow: "阵令已下 · 车把式响应", title: "停阵抢修", detail: "修车人脱阵动手，余众自动补位守住车尾" },
  rescue: { tone: "jade", seal: "援", eyebrow: "阵令已下 · 最近人手响应", title: "收阵救人", detail: "救援者脱离阵位，药具与医师自动加快施救" },
};

const FORMATION_LABEL: Record<BattleFormation, string> = {
  advance: "行进阵",
  hold: "停阵",
  horses: "护马阵",
};

function guardForCue(config: BattleConfig, cue: BattleCue) {
  return config.guards.find((guard) => guard.id === cue.sourceId);
}

function roundedAmount(cue: BattleCue): number {
  return Math.max(1, Math.round(cue.amount));
}

export function battleDoctrineMoment(doctrine: BattleDoctrine): BattleMoment {
  return {
    id: 0,
    tone: doctrine.id === "goose-vanguard" ? "gold" : doctrine.id === "iron-ring" ? "jade" : "ink",
    seal: doctrine.seal,
    eyebrow: "战前预案 · 自动执行",
    title: doctrine.title,
    detail: doctrine.subtitle,
  };
}

export function battleOrderMoment(strategy: BattleStrategy, id: number): BattleMoment {
  return { id, ...ORDER_PRESENTATION[strategy] };
}

function recommendedDefenseStrategy(cue: BattleCue, config: BattleConfig): BattleStrategy {
  if (cue.targetLabel === "镖车" || cue.targetId === "cart") return "guard-cart";
  if (cue.targetLabel === "马匹") return "guard-horses";
  if (cue.targetId === "player" || cue.targetLabel === config.leader?.name) return "breakthrough";
  return "guard-client";
}

export function battleDefenseVerdictFromCue(cue: BattleCue, strategy: BattleStrategy, config: BattleConfig): BattleDefenseVerdict | null {
  if (cue.kind !== "counter" && cue.kind !== "breach") return null;
  const countered = cue.kind === "counter";
  const strategyPresentation = STRATEGY_PRESENTATION[strategy];
  const recommended = STRATEGY_PRESENTATION[recommendedDefenseStrategy(cue, config)];
  const deputy = cue.assistSourceId ? config.guards.find((guard) => guard.id === cue.assistSourceId) : undefined;
  const coreFocus = battleCoreFocusVisual(config.leader?.coreCombatFocusId ?? DEFAULT_CORE_COMBAT_FOCUS);
  return {
    id: cue.id,
    tone: cue.kind,
    seal: countered && deputy ? coreFocus.seal : countered ? "应" : "破",
    title: cue.label ?? (countered ? "阵令对症" : "阵线失位"),
    incoming: cue.actionLabel ?? "危险起手",
    target: cue.targetLabel ?? "车马人手",
    strategy,
    strategyLabel: strategyPresentation.label,
    strategySeal: strategyPresentation.seal,
    result: `${countered ? "实受" : "承伤"} ${roundedAmount(cue)}`,
    advice: countered
      ? deputy
        ? `${config.leader?.name ?? "总镖头"} × ${deputy.name}反击 ${Math.max(1, Math.round(cue.counterAmount ?? 0))}`
        : "阵令正合来势，护住目标"
      : `下一招宜下「${recommended.label}」`,
  };
}

export function battleMomentFromCue(cue: BattleCue, config: BattleConfig, formation: BattleFormation, activeStrategy?: BattleStrategy): BattleMoment | null {
  const guard = guardForCue(config, cue);
  const actor = guard?.name ?? "随行镖师";
  const coreFocusId = config.leader?.coreCombatFocusId ?? DEFAULT_CORE_COMBAT_FOCUS;
  const coreFocus = battleCoreFocusVisual(coreFocusId);
  if (cue.kind === "leader-challenge") {
    return {
      id: cue.id,
      tone: "danger",
      seal: "战",
      eyebrow: `${config.enemyLeaderName ?? "匪首"} · 首领转入逼战`,
      title: cue.label ?? "弃旗逼战",
      detail: `直取${config.leader?.name ?? "总镖头"} · 强行开路可自动迎锋化解`,
    };
  }
  if (cue.kind === "counter" || cue.kind === "breach") {
    const countered = cue.kind === "counter";
    const strategyContext = activeStrategy ? `阵令「${STRATEGY_PRESENTATION[activeStrategy].label}」${countered ? "应招" : "失应"} · ` : "";
    const counterDeputy = cue.assistSourceId ? config.guards.find((member) => member.id === cue.assistSourceId) : undefined;
    if (countered && counterDeputy) return {
      id: cue.id,
      tone: coreFocusId === "cross-guard" ? "jade" : "gold",
      seal: coreFocus.seal,
      eyebrow: `${config.leader?.name ?? "总镖头"} × ${counterDeputy.name} · ${coreFocus.name}`,
      title: cue.label ?? "主副截锋",
      detail: `${cue.actionLabel ?? "敌招"}已卸 · ${strategyContext}实受 ${roundedAmount(cue)} · ${battleCoreFocusMomentDetail(coreFocusId, cue.counterAmount ?? 0, true)}`,
    };
    return {
      id: cue.id,
      tone: countered ? "jade" : "danger",
      seal: countered ? "应" : "破",
      eyebrow: `${cue.targetLabel ?? "车马"} · 危险起手结算`,
      title: cue.label ?? (countered ? "阵令对症" : "阵线失位"),
      detail: countered
        ? `${cue.actionLabel ?? "敌招"}已卸 · ${strategyContext}实受 ${roundedAmount(cue)}`
        : `${cue.actionLabel ?? "敌招"}命中 · ${strategyContext}承伤 ${roundedAmount(cue)}，宜立刻换阵`,
    };
  }
  if (cue.kind === "core-combo") {
    const deputy = config.guards.find((member) => member.id === cue.assistSourceId);
    return {
      id: cue.id,
      tone: coreFocusId === "cross-guard" ? "jade" : "gold",
      seal: coreFocus.seal,
      eyebrow: `${config.leader?.name ?? "总镖头"} × ${deputy?.name ?? "副镖头"} · ${coreFocus.name}`,
      title: cue.label ?? "双锋接势",
      detail: battleCoreFocusMomentDetail(coreFocusId, cue.amount),
    };
  }
  if (cue.kind === "coordination") {
    const partner = config.guards.find((member) => member.id === cue.assistSourceId);
    return {
      id: cue.id,
      tone: formation === "hold" ? "jade" : "gold",
      seal: "合",
      eyebrow: `${partner?.name ?? "同伴"} × ${actor} · 阵形自动连携`,
      title: cue.label ?? "前后接势",
      detail: `阅历越深，连携越快 · 合势攻势 ${roundedAmount(cue)}`,
    };
  }
  if (cue.kind === "technique") {
    return {
      id: cue.id,
      tone: "gold",
      seal: martialArtById(config.martialArtId).seal,
      eyebrow: "镖头 · 绝技自动择机",
      title: martialArtById(config.martialArtId).technique,
      detail: `截住高危敌手 · 破敌 ${roundedAmount(cue)}`,
    };
  }
  if (cue.kind === "mastery" || cue.kind === "revive") {
    return {
      id: cue.id,
      tone: "gold",
      seal: guard?.masterySeal ?? "绝",
      eyebrow: `${actor} · 老手绝活自动发动`,
      title: cue.label ?? guard?.masteryName ?? "临阵绝活",
      detail: cue.kind === "revive" ? `阵前回生 · 扶起同伴并恢复 ${roundedAmount(cue)}` : "阅历判断战机 · 无需玩家逐项操作",
    };
  }
  if (cue.kind === "bolt" && !cue.label?.includes("齐射")) {
    return {
      id: cue.id,
      tone: "gold",
      seal: "弩",
      eyebrow: `${actor} · 器械自动响应`,
      title: cue.label ?? "近阵强弩",
      detail: `点杀高危敌手 · 破敌 ${roundedAmount(cue)}`,
    };
  }
  if (cue.kind === "heal") {
    return {
      id: cue.id,
      tone: "jade",
      seal: "药",
      eyebrow: `${actor} · 器械自动响应`,
      title: cue.label ?? "就阵裹伤",
      detail: `先救重伤者 · 恢复体魄 ${roundedAmount(cue)}`,
    };
  }
  if (cue.kind === "brace") {
    return {
      id: cue.id,
      tone: "jade",
      seal: formation === "horses" ? "马" : "守",
      eyebrow: `${actor} · ${FORMATION_LABEL[formation]}器械响应`,
      title: cue.label ?? "器械护阵",
      detail: `坚守阵位并反击 · 破敌 ${roundedAmount(cue)}`,
    };
  }
  if (cue.kind === "volley") {
    return {
      id: cue.id,
      tone: "gold",
      seal: "弩",
      eyebrow: "阵令执行 · 持弩镖师同步响应",
      title: cue.label ?? "弩阵齐发",
      detail: "锁定首要威胁 · 攒弩完成后同时放箭",
    };
  }
  if (cue.kind === "rescue") {
    return {
      id: cue.id,
      tone: "jade",
      seal: "援",
      eyebrow: `${actor} · 收阵救人`,
      title: cue.label ?? "抬回阵中",
      detail: `同伴重新起身 · 恢复体魄 ${roundedAmount(cue)}`,
    };
  }
  if (cue.kind === "repair") {
    return {
      id: cue.id,
      tone: "gold",
      seal: "修",
      eyebrow: `${actor} · 停阵抢修`,
      title: cue.label ?? "车架复稳",
      detail: `车把式自动选位动手 · 修复车架 ${roundedAmount(cue)} 点`,
    };
  }
  if (cue.kind === "banner-grab" || cue.kind === "banner-lost" || cue.kind === "banner-recover") {
    const recovered = cue.kind === "banner-recover";
    const lost = cue.kind === "banner-lost";
    return {
      id: cue.id,
      tone: recovered ? "jade" : "danger",
      seal: recovered ? "复" : lost ? "失" : "夺",
      eyebrow: recovered ? "阵中要闻 · 快手响应" : "阵中急报 · 旗号受袭",
      title: recovered ? "风云行旗复立" : lost ? "风云行旗失守" : "夺旗手已经得旗",
      detail: recovered ? "追旗人自动截住敌手，士气得以稳住" : lost ? "全队士气受挫，须以余阵继续护镖" : "可改下强行开路令，让快手越阵追旗",
    };
  }
  return null;
}
