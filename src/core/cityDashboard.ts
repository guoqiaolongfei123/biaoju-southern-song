import type { GameState } from "./types";

export type CityWorkspaceTab = "overview" | "contracts" | "ledger" | "prepare" | "crew";

export interface CityActionPriority {
  tab: CityWorkspaceTab;
  seal: string;
  eyebrow: string;
  title: string;
  detail: string;
  tone: "steady" | "warning" | "danger";
}

/**
 * Picks one concrete city action from persistent game state. This is deliberately
 * presentation-agnostic so the right rail can explain why an action matters
 * without duplicating game rules in React.
 */
export function cityActionPriority(game: GameState): CityActionPriority {
  const captiveCrew = game.crew.filter((member) => member.captivity);
  const injuredCrew = game.crew.filter((member) => !member.captivity && (member.injury || member.hp < member.maxHp * .58));
  const leaderInTrouble = Boolean(game.leader.injury) || game.convoy.leaderHp < 58;

  if (captiveCrew.length > 0) return {
    tab: "crew",
    seal: "俘",
    eyebrow: "队员失陷 · 名册战力空缺",
    title: "先查看赎人路引",
    detail: `${captiveCrew.map((member) => member.name).join("、")}仍被扣在路上；人物页会注明可托行院说项的两座城。`,
    tone: "danger",
  };

  if (leaderInTrouble || injuredCrew.length > 0) return {
    tab: "prepare",
    seal: "医",
    eyebrow: "人手带伤 · 出城前处置",
    title: "先延医问药",
    detail: leaderInTrouble
      ? `总镖头体魄 ${game.convoy.leaderHp}/100${game.leader.injury ? "，尚有持续伤势" : ""}；带伤赶路会拖慢行程并削弱战力。`
      : `${injuredCrew.length} 名镖师仍有伤损；先治伤，再按下一趟镖挑人。`,
    tone: "danger",
  };

  if (game.convoy.horseStamina < 40) return {
    tab: "prepare",
    seal: "马",
    eyebrow: "马力不足 · 下一程会误期",
    title: "先投宿马院",
    detail: `当前马力仅 ${game.convoy.horseStamina}/100；投宿可恢复马力与马匹伤势，再比较远途镖单。`,
    tone: game.convoy.horseStamina < 20 ? "danger" : "warning",
  };

  if (game.supplies < 4) return {
    tab: "prepare",
    seal: "粮",
    eyebrow: "余粮吃紧 · 路上选择会变少",
    title: "先添置干粮",
    detail: `总号只余 ${game.supplies} 份补给；绕关、歇脚和坏车都会额外耗粮。`,
    tone: game.supplies < 2 ? "danger" : "warning",
  };

  if (game.convoy.cartHp < 65) return {
    tab: "prepare",
    seal: "车",
    eyebrow: "车况偏低 · 劫车损失会放大",
    title: "先修整镖车",
    detail: `当前车况 ${game.convoy.cartHp}/100；修好车轴与篷架再接凶险镖单。`,
    tone: game.convoy.cartHp < 40 ? "danger" : "warning",
  };

  if (game.convoy.horseHp < 65) return {
    tab: "prepare",
    seal: "驮",
    eyebrow: "牲口有伤 · 脚程与战阵都受限",
    title: "先照料马匹",
    detail: `当前马匹 ${game.convoy.horseHp}/100；投宿马院可同时恢复马力与伤势。`,
    tone: game.convoy.horseHp < 40 ? "danger" : "warning",
  };

  if (game.crew.length < 3) return {
    tab: "crew",
    seal: "人",
    eyebrow: "人手未齐 · 无法组成三人随队",
    title: "先查看本地名帖",
    detail: `名册现有 ${game.crew.length} 人；延入合适职司后再接远镖。`,
    tone: "warning",
  };

  return {
    tab: "contracts",
    seal: "镖",
    eyebrow: "人车可用 · 可以择镖",
    title: game.contracts.length ? "比较本城镖榜" : "等候牙行开榜",
    detail: game.contracts.length
      ? `本城现有 ${game.contracts.length} 份委托；先看目的地、时限与可疑征象，再决定是否访查。`
      : "本城暂时没有可接委托，可先整备车马或查看天下局势。",
    tone: "steady",
  };
}
