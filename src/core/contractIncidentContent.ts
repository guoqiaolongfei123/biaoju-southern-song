import type {
  Contract,
  ConvoyUpgradeId,
  CrewRole,
  EventChoice,
  TravelEvent,
  TravelStance,
} from "./types";

export interface ContractIncidentContext {
  day: number;
  routeId: string;
  routeName: string;
  contract: Contract;
  crewRoles: readonly CrewRole[];
  stance: TravelStance;
  upgrades: readonly ConvoyUpgradeId[];
  supplies: number;
  silver: number;
}

function choice(id: string, label: string, hint: string, tone: EventChoice["tone"], disabled = false): EventChoice {
  return { id, label, hint, tone, disabled };
}

function hasRole(context: ContractIncidentContext, role: CrewRole): boolean {
  return context.crewRoles.includes(role);
}

function event(context: ContractIncidentContext, title: string, eyebrow: string, description: string, choices: EventChoice[]): TravelEvent {
  return {
    id: `intrigue-${context.day}-${context.routeId}-${context.contract.id}`,
    kind: "intrigue",
    eyebrow,
    title,
    description,
    choices,
  };
}

/**
 * Converts a contract's hidden complication into a visible road decision.
 * The event contains presentation and availability only; resolution remains
 * in the serializable game simulation.
 */
export function contractIncidentEvent(context: ContractIncidentContext): TravelEvent | null {
  const { contract } = context;
  if (contract.complication === "none") return null;

  if (contract.complication === "fragile") {
    const specialist = hasRole(context, "车把式") || hasRole(context, "医师");
    const supplyCost = specialist ? 0 : 1;
    return event(
      context,
      "封箱里传来一声脆响",
      "镖物异动 · 货箱并未开裂，里面却有东西倒了",
      `${context.routeName}刚过一段颠簸路，${contract.cargo}在箱中错了位。继续催车不会误期，但下一次转弯可能把小损变成整箱报废。`,
      [
        choice("intrigue-secure", specialist ? "请随员按物性重新固匣" : "停车拆外架重垫", specialist ? "职司相合：不误期、不耗补给，保住镖物" : `消耗 ${supplyCost} 份补给，保住镖物`, "safe", context.supplies < supplyCost),
        choice("intrigue-open", "依镖单验看内匣", contract.inspectionAllowed ? "查明底细并重新固定；若有外封则照委托验货条款复封" : "委托不许开验，此选项不可用", "risk", !contract.inspectionAllowed),
        choice("intrigue-press", "不停车，压住车速继续走", "不误行程，但镖物会受明显损伤", "danger"),
      ],
    );
  }

  if (contract.complication === "military") {
    const papersReady = hasRole(context, "账房") || contract.patron === "official" || contract.secretKnown;
    return event(
      context,
      "前军要从车上征一份军需",
      "镖物异动 · 军中塘骑拦下民车逐一看票",
      `一队军卒在${context.routeName}设下临时征发棚，点名要看${contract.cargo}。他们未必知道此镖真正用途，却有权先扣车、后补文书。`,
      [
        choice("intrigue-papers", "取委托公文对军牒", papersReady ? `${hasRole(context, "账房") ? "账房识牒" : contract.secretKnown ? "底细已明" : "官府委托"}：说清军需去处，免征放行` : "缺少能相互印证的公文与知情人", "safe", !papersReady),
        choice("intrigue-provision", "另分两份路粮劳军", "补给换通行，不让军卒碰镖封", "risk", context.supplies < 2),
        choice("fight", "拒绝征发，护车列阵", "进入自动护车战；此处军卒会把镖队视作抗命", "danger"),
      ],
    );
  }

  if (contract.complication === "wanted") {
    const canCounterTrack = hasRole(context, "趟子手") || context.stance === "covert" || context.upgrades.includes("hidden-compartment") || contract.secretKnown;
    return event(
      context,
      "同一双草鞋第三次出现在车后",
      "镖物异动 · 歇脚人换了斗笠，却没换脚步",
      `${contract.cargo}的追索者正沿${context.routeName}吊住车尾。他们还没摸清镖队人数；若在下一处宿店前不甩掉，夜里便会贴车动手。`,
      [
        choice("intrigue-shadow", "让前哨反跟一程", canCounterTrack ? `${hasRole(context, "趟子手") ? "趟子手探路" : context.stance === "covert" ? "偃旗潜行" : context.upgrades.includes("hidden-compartment") ? "暗格换匣" : "底细已明"}：耗 1 份补给，反把尾巴引向岔路` : "缺少探路、潜行或藏匣准备", "safe", !canCounterTrack || context.supplies < 1),
        choice("intrigue-night", "弃宿店，连夜换路", "延误 1 日并损耗马力，避开客栈伏击", "risk"),
        choice("fight", "回车截住追踪者", "趁对方人手未齐先战，进入自动护车战", "danger"),
      ],
    );
  }

  if (contract.complication === "contraband") {
    const canExpose = hasRole(context, "账房") || contract.secretKnown;
    return event(
      context,
      "没见过的税吏拿着太新的关印",
      "镖物异动 · 验货棚不在旧路报上",
      `几名自称榷货务差役的人拦在${context.routeName}，只查${contract.cargo}，却说不出上司姓名。真交出货票，假差也可能从票色里坐实违禁底细。`,
      [
        choice("intrigue-counterseal", "反查关印与差牌", canExpose ? `${hasRole(context, "账房") ? "账房识破印色" : "底细已明"}：当场拆穿假差，保住货票与镖封` : "没有识牒人，也不知此镖为何怕查", "safe", !canExpose),
        choice("intrigue-bribe", "只递十两茶钱，不交货票", "花银让路；保住镖物，但江湖会知道你肯向假差付钱", "risk", context.silver < 10),
        choice("fight", "收票护车，逼开验货棚", "假差亮刀便进入自动护车战", "danger"),
      ],
    );
  }

  const canVerify = hasRole(context, "账房") || contract.secretKnown;
  return event(
    context,
    "委托人的第二封急札改了交货暗记",
    "镖物异动 · 两份真印文书彼此冲突",
    `送札人追上${context.routeName}，声称${contract.cargo}要改交另一处接头人。旧约与新札用的是同一枚印，却不能同时作真。`,
    [
      choice("intrigue-counterseal", "逐字核对旧约暗记", canVerify ? `${hasRole(context, "账房") ? "账房核契" : "底细已明"}：识破后补印与假接头人` : "没有账房，也尚未查明镖单底细", "safe", !canVerify),
      choice("intrigue-refuse", "扣下送札人，坚持原约", "延误 1 日查清尾随者；不改目的地，也不破封", "risk"),
      choice("fight", "送札人拔刀，先护住头车", "对方若强夺文书，立即进入自动护车战", "danger"),
    ],
  );
}
