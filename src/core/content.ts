import type {
  Confidentiality,
  Contract,
  ContractComplication,
  ContractKind,
  ContractNegotiation,
  ContractNegotiationId,
  ContractPatron,
  SpecialHandlingId,
} from "./types";

export interface ContractTemplate {
  id: string;
  kind: ContractKind;
  patron: ContractPatron;
  title: string;
  cargo: string;
  sealRequired: boolean;
  inspectionAllowed: boolean;
  allowedLoss: number;
  confidentiality: Confidentiality;
  failurePenalty: number;
  complication: ContractComplication;
  clue: string;
  secret: string;
  requirement: string;
  rewardBonus: number;
  deadlineBuffer: number;
  specialHandlingId?: SpecialHandlingId;
}

export const CONTRACT_KIND_LABEL: Record<ContractKind, string> = {
  cargo: "货镖",
  letter: "信镖",
  escort: "活镖",
  special: "特镖",
};

export const CONTRACT_KIND_SEAL: Record<ContractKind, string> = {
  cargo: "貨",
  letter: "信",
  escort: "人",
  special: "异",
};

export const CONTRACT_PATRON_LABEL: Record<ContractPatron, string> = {
  merchant: "商帮",
  official: "官府",
  jianghu: "江湖",
  temple: "寺观",
  foreign: "异邦",
};

export const CLIENTS_BY_PATRON: Record<ContractPatron, readonly string[]> = {
  merchant: ["同仁药铺", "晋商常记", "四海茶行", "榷货务牙人", "临安沈氏行栈"],
  official: ["京湖制置司故吏", "枢密院承旨房", "两浙转运司书办", "沿江安抚司门客"],
  jianghu: ["六和塔下无名客", "河东马会", "西湖武馆旧友", "江陵船帮掌柜"],
  temple: ["径山寺知客", "天台山行脚僧", "龙虎山道录", "灵隐寺药寮"],
  foreign: ["大理马帮译人", "西域胡商", "高丽海客", "吐蕃茶马使随员"],
};

export const CONTRACT_TEMPLATES: readonly ContractTemplate[] = [
  {
    id: "medicine-muster-roll",
    kind: "cargo",
    patron: "merchant",
    title: "药香不出封",
    cargo: "三箱上等药材",
    sealRequired: true,
    inspectionAllowed: false,
    allowedLoss: 5,
    confidentiality: "隐秘",
    failurePenalty: 48,
    complication: "military",
    clue: "药箱比同样分量的川芎沉了半成，底板又新钉过。",
    secret: "箱底夹着一册沿江伤兵名录，落入敌手便能推算宋军调动。",
    requirement: "封条不得损坏，也不得交官府开箱。",
    rewardBonus: 24,
    deadlineBuffer: 4,
  },
  {
    id: "brocade-ledger",
    kind: "cargo",
    patron: "merchant",
    title: "锦里藏针",
    cargo: "一车蜀锦",
    sealRequired: false,
    inspectionAllowed: true,
    allowedLoss: 12,
    confidentiality: "寻常",
    failurePenalty: 36,
    complication: "double_deal",
    clue: "货卷数目与报关单相合，唯独最里面一匹系着北地绳结。",
    secret: "锦卷中藏有两份互相矛盾的商契，交付人可能临时要求改送别处。",
    requirement: "可验货，但不可让同行商队抄录货单。",
    rewardBonus: 12,
    deadlineBuffer: 5,
  },
  {
    id: "tribute-tea",
    kind: "cargo",
    patron: "official",
    title: "雨前第一焙",
    cargo: "十二篓建茶",
    sealRequired: true,
    inspectionAllowed: true,
    allowedLoss: 8,
    confidentiality: "寻常",
    failurePenalty: 42,
    complication: "fragile",
    clue: "竹篓里垫着新焙炭灰，最怕水汽与长日暴晒。",
    secret: "其中两篓是送入行在的贡样；一旦受潮，普通茶价也赔不起。",
    requirement: "不得淋雨，渡水时必须留人在船舱看守。",
    rewardBonus: 18,
    deadlineBuffer: 3,
  },
  {
    id: "salt-tallies",
    kind: "cargo",
    patron: "jianghu",
    title: "白货无引",
    cargo: "八袋淮盐",
    sealRequired: false,
    inspectionAllowed: true,
    allowedLoss: 15,
    confidentiality: "隐秘",
    failurePenalty: 30,
    complication: "contraband",
    clue: "盐袋火漆没有榷货务押字，委托人却催得比军情还急。",
    secret: "这批盐没有官引，经过任何榷场都会被当作私盐没收。",
    requirement: "不得经过官仓清点，必要时可弃货保人。",
    rewardBonus: 34,
    deadlineBuffer: 4,
  },
  {
    id: "frontier-dispatch",
    kind: "letter",
    patron: "official",
    title: "军门不落款",
    cargo: "一封无款蜡书",
    sealRequired: true,
    inspectionAllowed: false,
    allowedLoss: 0,
    confidentiality: "绝密",
    failurePenalty: 62,
    complication: "military",
    clue: "封蜡是京湖军中用色，落款位置却被利刃整齐削去。",
    secret: "信中写着襄樊守军三日后的换防时辰。",
    requirement: "宁可毁信，不可落入非宋军吏之手。",
    rewardBonus: 44,
    deadlineBuffer: 2,
  },
  {
    id: "merchant-ledger",
    kind: "letter",
    patron: "merchant",
    title: "账页不能落地",
    cargo: "一册缄封账簿",
    sealRequired: true,
    inspectionAllowed: false,
    allowedLoss: 0,
    confidentiality: "隐秘",
    failurePenalty: 45,
    complication: "double_deal",
    clue: "账簿封皮写的是茶价，书脊夹层却留有盐钞水印。",
    secret: "账簿同时记着宋金两边的货款，任何一方查到都会追究商号。",
    requirement: "封皮可受损，内页不得缺失一张。",
    rewardBonus: 28,
    deadlineBuffer: 3,
  },
  {
    id: "surrender-half-seal",
    kind: "letter",
    patron: "foreign",
    title: "半枚降印",
    cargo: "一封夹有半印的密札",
    sealRequired: true,
    inspectionAllowed: false,
    allowedLoss: 0,
    confidentiality: "绝密",
    failurePenalty: 58,
    complication: "wanted",
    clue: "信封带着新磨过的血迹，半枚铜印只看得出一个“降”字。",
    secret: "密札是边将私下议降的凭证，送信人与收信人都可能反悔灭口。",
    requirement: "只认另一半铜印，不认官凭与口信。",
    rewardBonus: 52,
    deadlineBuffer: 2,
  },
  {
    id: "family-letter",
    kind: "letter",
    patron: "temple",
    title: "故人一纸",
    cargo: "三封家书与一枚木簪",
    sealRequired: false,
    inspectionAllowed: true,
    allowedLoss: 0,
    confidentiality: "寻常",
    failurePenalty: 20,
    complication: "none",
    clue: "纸张粗陋，三封信却各自用了不同路数的军中折法。",
    secret: "写信人已战死，僧人托你送的是他们最后留下的家书。",
    requirement: "不问回信，只求亲手交到三户人家。",
    rewardBonus: 4,
    deadlineBuffer: 7,
  },
  {
    id: "silent-physician",
    kind: "escort",
    patron: "temple",
    title: "不问来处",
    cargo: "一位沉默医师",
    sealRequired: false,
    inspectionAllowed: true,
    allowedLoss: 0,
    confidentiality: "隐秘",
    failurePenalty: 50,
    complication: "wanted",
    clue: "医师懂北地军中伤药，左手虎口还有被烙铁烧去的印痕。",
    secret: "他曾替金军主将治伤，如今两国都有人想让他永远闭嘴。",
    requirement: "不得盘问姓名；若遭盘查，只称药铺坐堂。",
    rewardBonus: 38,
    deadlineBuffer: 4,
  },
  {
    id: "siege-engineer",
    kind: "escort",
    patron: "official",
    title: "木鸢过江",
    cargo: "一名军器所匠人",
    sealRequired: false,
    inspectionAllowed: true,
    allowedLoss: 0,
    confidentiality: "绝密",
    failurePenalty: 68,
    complication: "military",
    clue: "匠人的行李只有尺规，却能随口说出襄阳城墙每一段厚薄。",
    secret: "他掌握新式床弩图样，金军细作已经买通沿路脚店寻找他。",
    requirement: "匠人必须活着抵达；图样可在危急时焚毁。",
    rewardBonus: 55,
    deadlineBuffer: 3,
  },
  {
    id: "living-witness",
    kind: "escort",
    patron: "jianghu",
    title: "孤证入城",
    cargo: "一名蒙面证人",
    sealRequired: false,
    inspectionAllowed: false,
    allowedLoss: 0,
    confidentiality: "绝密",
    failurePenalty: 56,
    complication: "double_deal",
    clue: "证人从不上车睡觉，委托人派来的随从也始终不肯背对他。",
    secret: "他握有商帮通敌的口供；委托人真正想要的可能不是作证，而是灭口。",
    requirement: "不得让委托人随从与证人单独相处。",
    rewardBonus: 48,
    deadlineBuffer: 3,
  },
  {
    id: "artisan-family",
    kind: "escort",
    patron: "merchant",
    title: "一门手艺",
    cargo: "一户造船匠家眷",
    sealRequired: false,
    inspectionAllowed: true,
    allowedLoss: 10,
    confidentiality: "寻常",
    failurePenalty: 34,
    complication: "fragile",
    clue: "老人带病，幼童怕水，行李中却有一套被官府编号的船样。",
    secret: "这家人是从官营船场逃出的匠户，原籍官司可能沿路追索。",
    requirement: "宁可误期，也不得让老人和孩子连夜赶路。",
    rewardBonus: 20,
    deadlineBuffer: 6,
  },
  {
    id: "ice-sealed-medicine",
    kind: "special",
    specialHandlingId: "cold-chain",
    patron: "temple",
    title: "冰瓮不离阴",
    cargo: "两瓮冰封解疫丹",
    sealRequired: true,
    inspectionAllowed: true,
    allowedLoss: 4,
    confidentiality: "隐秘",
    failurePenalty: 62,
    complication: "fragile",
    clue: "瓮壁包了三层湿麻，封蜡旁还压着每两个时辰换冰的药签。",
    secret: "药丸离冰后会迅速失效，委托人却刻意少报了一半所需冰料。",
    requirement: "须阴凉通风；不可在暑热中久停，沿途要留意换冰。",
    rewardBonus: 46,
    deadlineBuffer: 3,
  },
  {
    id: "northbound-coffin",
    kind: "special",
    specialHandlingId: "solemn",
    patron: "jianghu",
    title: "归柩过关",
    cargo: "一具北归旧柩",
    sealRequired: true,
    inspectionAllowed: false,
    allowedLoss: 0,
    confidentiality: "绝密",
    failurePenalty: 74,
    complication: "wanted",
    clue: "棺钉是南地新铸，灵牌却刮去了籍贯，抬棺人一听巡检二字便噤声。",
    secret: "柩中除遗骸外还藏着一面旧军旗，宋金两边都不愿它回到故乡。",
    requirement: "不得开棺验看；入关只认同乡会馆的引魂帖。",
    rewardBonus: 62,
    deadlineBuffer: 5,
  },
  {
    id: "appointed-bronze-pattern",
    kind: "special",
    specialHandlingId: "appointed",
    patron: "official",
    title: "更漏前交印",
    cargo: "一匣限时铜范",
    sealRequired: true,
    inspectionAllowed: false,
    allowedLoss: 3,
    confidentiality: "绝密",
    failurePenalty: 70,
    complication: "military",
    clue: "交割文书不写日期，只写目的地城楼第三通更鼓之前。",
    secret: "铜范是新铸关防的母模；误过时辰，旧关防便会先被敌探冒用。",
    requirement: "必须在约定更漏前交付；误一日即大幅扣酬。",
    rewardBonus: 58,
    deadlineBuffer: 1,
  },
  {
    id: "unknown-vermilion-chest",
    kind: "special",
    specialHandlingId: "tracked",
    patron: "foreign",
    title: "朱匣无人认",
    cargo: "一只无款朱漆匣",
    sealRequired: true,
    inspectionAllowed: false,
    allowedLoss: 0,
    confidentiality: "绝密",
    failurePenalty: 82,
    complication: "double_deal",
    clue: "匣角嵌着四国文字磨平后的铜片，委托人身后已经换过三拨尾巴。",
    secret: "匣中是数家边贸暗线的总账；沿路至少有两股势力正循特殊香料追踪。",
    requirement: "不可开匣；须隐藏气味与行踪，不得公开报出接货人。",
    rewardBonus: 76,
    deadlineBuffer: 3,
  },
] as const;

export function complicationRisk(complication: ContractComplication): number {
  if (complication === "military" || complication === "wanted") return 14;
  if (complication === "contraband" || complication === "double_deal") return 10;
  if (complication === "fragile") return 6;
  return 0;
}

export function isBorderSensitive(contract: Contract): boolean {
  return contract.specialHandlingId === "solemn"
    || contract.specialHandlingId === "tracked"
    || contract.complication === "contraband"
    || contract.complication === "wanted"
    || contract.complication === "military"
    || contract.complication === "double_deal";
}

const CONTRACT_NEGOTIATION_IDS = new Set<ContractNegotiationId>(["higher-reward", "extended-deadline", "reduced-penalty"]);

function hydrateContractNegotiation(value: unknown): ContractNegotiation | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Partial<ContractNegotiation>;
  if (typeof raw.id !== "string" || !CONTRACT_NEGOTIATION_IDS.has(raw.id as ContractNegotiationId)) return undefined;
  if (typeof raw.contactId !== "string" || !raw.contactId) return undefined;
  if (![raw.favorCost, raw.day, raw.before, raw.after].every((item) => typeof item === "number" && Number.isFinite(item))) return undefined;
  return {
    id: raw.id as ContractNegotiationId,
    contactId: raw.contactId,
    favorCost: Math.max(0, Math.round(raw.favorCost!)),
    day: Math.max(1, Math.round(raw.day!)),
    before: Math.max(0, Math.round(raw.before!)),
    after: Math.max(0, Math.round(raw.after!)),
  };
}

export function hydrateLegacyContract(contract: Contract): Contract {
  if (contract.kind && contract.patron && typeof contract.secretKnown === "boolean") return { ...contract, negotiation: hydrateContractNegotiation(contract.negotiation) };
  if (contract.id === "opening-xiangyang") {
    return {
      ...contract,
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
      negotiation: hydrateContractNegotiation(contract.negotiation),
    };
  }
  const cargo = contract.cargo ?? "不明镖物";
  const kind: ContractKind = /医师|匠人|证人|家眷|一位|一名|一户/.test(cargo)
    ? "escort"
    : /信|札|账簿|文书|名录/.test(cargo)
      ? "letter"
      : "cargo";
  return {
    ...contract,
    kind,
    patron: "merchant",
    inspectionAllowed: !contract.sealRequired,
    allowedLoss: kind === "cargo" ? 10 : 0,
    confidentiality: contract.sealRequired ? "隐秘" : "寻常",
    failurePenalty: Math.max(20, Math.round((contract.reward ?? 80) * 0.28)),
    complication: "none",
    clue: "旧镖单没有留下可供追查的细目。",
    requirement: contract.sealRequired ? "封条须保持完整。" : "保证人货按期抵达。",
    secretKnown: false,
    negotiation: hydrateContractNegotiation(contract.negotiation),
  };
}
