import type { ConvoyUpgradeId, FactionId, HorseTeamId, OriginId, WagonId } from "./types";

export interface OriginDefinition {
  id: OriginId;
  seal: string;
  title: string;
  subtitle: string;
  startCityId: "linan" | "xiangyang" | "quanzhou";
  description: string;
  advantage: string;
  warning: string;
  difficulty: "平" | "险" | "奇";
  silver: number;
  supplies: number;
  reputation: number;
  morale: number;
  wagonId: WagonId;
  horseTeamId: HorseTeamId;
  upgrades: ConvoyUpgradeId[];
  activeCrewIds: string[];
  crewExperience: Record<string, number>;
  relations: Partial<Record<FactionId, number>>;
  includeOpeningContract: boolean;
  news: string;
}

export const ORIGINS: Record<OriginId, OriginDefinition> = {
  "linan-guild": {
    id: "linan-guild", seal: "行", title: "行在旧号", subtitle: "临安府 · 牙行承牌",
    startCityId: "linan", difficulty: "平",
    description: "承下临安旧行院的一间门脸，有熟客、有旧车，也有一张不能推辞的襄阳急镖。",
    advantage: "本钱均衡，天下路报最全，并保留完整的襄阳易主开局。",
    warning: "没有专长捷径，须靠每一趟镖慢慢立名。",
    silver: 120, supplies: 14, reputation: 28, morale: 72,
    wagonId: "covered-cart", horseTeamId: "draft-pair", upgrades: [],
    activeCrewIds: ["lu-cang", "qiao-qing", "he-sheng"], crewExperience: {}, relations: {},
    includeOpeningContract: true,
    news: "【临安开张】风云行承下旧行院门脸，第一面镖旗今日挂上清河坊。",
  },
  "xiangyang-veterans": {
    id: "xiangyang-veterans", seal: "戍", title: "边军旧部", subtitle: "襄阳府 · 解甲成行",
    startCityId: "xiangyang", difficulty: "险",
    description: "几名边军旧识凑出一辆铁叶重车，在汉水烽烟下改挂镖旗，专走旁人不敢走的北路。",
    advantage: "铁叶重车、川峡骡队与铁包车轮开局，三名主力各有一趟阅历。",
    warning: "现银偏少，金国敌意更深，开门便处在围城风声里。",
    silver: 82, supplies: 18, reputation: 32, morale: 80,
    wagonId: "armored-cart", horseTeamId: "mountain-mules", upgrades: ["iron-wheels"],
    activeCrewIds: ["lu-cang", "qiao-qing", "he-sheng"], crewExperience: { "lu-cang": 1, "qiao-qing": 1, "he-sheng": 1 },
    relations: { song: 20, jin: -12 }, includeOpeningContract: false,
    news: "【汉水起旗】几名京湖旧卒卸下军牌，把一辆铁叶重车推到了风云行门前。",
  },
  "quanzhou-merchants": {
    id: "quanzhou-merchants", seal: "舶", title: "海商联号", subtitle: "泉州 · 蕃舶合股",
    startCityId: "quanzhou", difficulty: "奇",
    description: "泉州海商合出股本，要风云行把舶货与密账送进内地；他们给得起快车，也藏得住货。",
    advantage: "现银丰厚，轻辕快车、驿道健马与暗格夹层开局，账房直接随队。",
    warning: "补给较少、信用尚浅，轻车在劫道围攻中十分脆弱。",
    silver: 158, supplies: 10, reputation: 24, morale: 66,
    wagonId: "swift-cart", horseTeamId: "post-pair", upgrades: ["hidden-compartment"],
    activeCrewIds: ["qiao-qing", "he-sheng", "shen-yan"], crewExperience: { "qiao-qing": 1, "shen-yan": 1 },
    relations: { song: 10, dali: 10, neutral: 8 }, includeOpeningContract: false,
    news: "【刺桐合股】舶商把银箱、暗格快车与三封荐书一并送进风云行新号。",
  },
};

export const ORIGIN_LIST = Object.values(ORIGINS);

export function originById(originId: OriginId): OriginDefinition {
  return ORIGINS[originId];
}
