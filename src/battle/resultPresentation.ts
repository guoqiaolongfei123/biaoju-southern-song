import type { BattleConfig, BattleResult } from "../core/types";

export type BattleResultTone = "victory" | "costly" | "retreat" | "defeat";

export interface BattleResultPresentation {
  grade: "甲" | "乙" | "丙" | "退" | "败";
  tone: BattleResultTone;
  eyebrow: string;
  title: string;
  summary: string;
  advice: string;
}

export function battleResultPresentation(result: BattleResult, config: BattleConfig): BattleResultPresentation {
  const horseDamage = result.horseDamage ?? 0;
  const clientDamage = result.clientDamage ?? 0;
  const maxGuardDamage = Math.max(0, ...Object.values(result.guardDamage));
  const pristine = result.outcome === "complete"
    && result.leaderDamage <= 3
    && result.cartDamage <= 4
    && result.cargoLoss <= 2
    && horseDamage <= 3
    && result.guardLoss === 0
    && maxGuardDamage < 10
    && !result.sealBroken
    && !result.bannerLost
    && clientDamage <= 3
    && !result.clientDowned
    && (result.cartRepair ?? 0) === 0;

  let base: Omit<BattleResultPresentation, "advice">;
  if (config.escortClient && result.clientDowned) base = {
    grade: "败", tone: "defeat", eyebrow: "人身失守 · 活镖倒地", title: "此阵失镖",
    summary: `${config.escortClient.name}在${config.routeName}重伤倒地，纵使车马尚存，也已无法照原约交割。`,
  };
  else if (config.objectiveMode === "pursuit" && result.outcome === "complete") base = {
    grade: pristine ? "甲" : "乙", tone: "victory", eyebrow: "快手截路 · 失镖复得", title: `${config.recoveryLabel ?? "镖匣"}已追回`,
    summary: `夺镖者未能逃出${config.routeName}，风云行收回镖物后立即鸣哨归阵。`,
  };
  else if (config.objectiveMode === "pursuit" && result.outcome === "partial") base = {
    grade: "丙", tone: "costly", eyebrow: "车阵保住 · 失镖未回", title: "夺镖者逃脱",
    summary: `${config.recoveryLabel ?? "镖匣"}被带出逃口，约 ${result.cargoLoss}% 的镖物损失会进入最终交割。`,
  };
  else if (result.bannerLost) base = {
    grade: "丙", tone: "costly", eyebrow: "车马得脱 · 旗号失守", title: "镖旗被夺",
    summary: `夺旗手携风云行旗号逃出${config.routeName}，全队士气与沿途信用都将受损。`,
  };
  else if (result.bannerRecovered && result.outcome === "complete") base = {
    grade: "乙", tone: "victory", eyebrow: "夺旗未遂 · 重立行旗", title: "夺旗复得",
    summary: `夺旗手未能冲出${config.routeName}，镖队斩断退路，把风云行旗重新立回车前。`,
  };
  else if (pristine) base = {
    grade: "甲", tone: "victory", eyebrow: "镖旗不倒 · 人货俱全", title: "全阵得脱",
    summary: `${config.enemyFaction}未能撼动车阵，风云行以近乎无损之势完成「${config.objective}」。`,
  };
  else if (result.outcome === "complete") base = {
    grade: "乙", tone: "victory", eyebrow: "车马仍在 · 前路已开", title: "护镖得胜",
    summary: config.escortClient
      ? `鏖战约 ${result.elapsedHours} 时，镖队护着${config.escortClient.name}冲开${config.enemyFaction}，人身伤势将带入余程。`
      : `鏖战约 ${result.elapsedHours} 时，车阵冲开${config.enemyFaction}，损伤将如实带回行程。`,
  };
  else if (result.outcome === "partial") base = {
    grade: "丙", tone: "costly", eyebrow: "虽得脱险 · 已付代价", title: "带伤出阵",
    summary: `镖队勉强脱离${config.routeName}，人车与镖物未能全部保全。`,
  };
  else if (result.outcome === "retreat") base = {
    grade: "退", tone: "retreat", eyebrow: "鸣金收阵 · 留得人手", title: "退守后路",
    summary: `镖旗主动撤出战场，避开了继续死战，却必须承担失去阵势的代价。`,
  };
  else base = {
    grade: "败", tone: "defeat", eyebrow: "镖阵已破 · 余众散归", title: "此阵失利",
    summary: `${config.enemyFaction}击破车阵，伤损、货失与破封都会进入最终交割。`,
  };

  let advice = "人车尚稳，可以继续赶路。";
  if (result.clientDowned) advice = "活镖已经无法继续赶路；抵达后将按失镖赔付，并承受信用损失。";
  else if (clientDamage >= 20) advice = "护送之人伤势不轻，余程应避战缓行；最终交割会按人身状态扣减镖酬。";
  else if (result.bannerLost) advice = "镖旗失守会削弱士气与信用；入城后应整队安众，并尽快重立旗号。";
  else if (result.sealBroken) advice = "封条已经破损，抵达后可能面临验货、减酬或赔付。";
  else if (result.guardLoss > 0 || maxGuardDamage >= 25 || result.leaderDamage >= 20) advice = "人手伤势不轻，下一处落脚点应优先诊治。";
  else if (horseDamage >= 12) advice = "马匹损伤明显，入城后宜先投宿马院。";
  else if (result.cartDamage >= 10) advice = "车轴与篷架受损，下一处落脚点宜先修车。";
  else if ((result.cartRepair ?? 0) > 0) advice = "阵前抢修只够支撑余程，入城后仍宜卸轮查轴，彻底整修车架。";
  else if (result.cargoLoss >= 8) advice = "镖物已有折损，余程须优先围车护货。";

  return { ...base, advice };
}

export function battleInjuryLabel(damage: number): "无伤" | "擦伤" | "负伤" | "重伤" {
  if (damage <= 0) return "无伤";
  if (damage < 10) return "擦伤";
  if (damage < 25) return "负伤";
  return "重伤";
}
