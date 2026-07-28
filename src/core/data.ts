import type { CityDefinition, CityTier, FactionId, RouteDefinition, RouteTerrain } from "./types";
import { projectLonLat } from "../map/projection";

export const FACTIONS: Record<FactionId, { name: string; short: string; color: string; ink: string }> = {
  song: { name: "大宋", short: "宋", color: "#557c68", ink: "#e3ead7" },
  jin: { name: "大金", short: "金", color: "#9b4b38", ink: "#f1d3b8" },
  xixia: { name: "西夏", short: "夏", color: "#9a7b45", ink: "#efe0b8" },
  dali: { name: "大理", short: "理", color: "#6e668b", ink: "#e1dcf1" },
  tibetan: { name: "吐蕃诸部", short: "蕃", color: "#80664e", ink: "#e8d5bd" },
  mongol: { name: "蒙古诸部", short: "蒙", color: "#596b70", ink: "#d9e2df" },
  neutral: { name: "地方势力", short: "争", color: "#8a774f", ink: "#eadbb9" },
};

function site(
  id: string,
  name: string,
  subtitle: string,
  lon: number,
  lat: number,
  defaultOwner: FactionId,
  tier: CityTier = "station",
  description?: string,
  specialties: string[] = [],
): CityDefinition {
  const [x, y] = projectLonLat(lon, lat);
  return {
    id,
    name,
    subtitle,
    lon,
    lat,
    x,
    y,
    defaultOwner,
    tier,
    description: description ?? `${subtitle}。往来商旅在这里换马、验牒，也交换沿途最新的旗号与路况。`,
    specialties: specialties.length ? specialties : tier === "capital" ? ["天下消息", "大宗委托", "通关文牒"] : tier === "major" ? ["商队", "补给", "地方人脉"] : ["驿站", "向导", "路报"],
  };
}

export const CITIES: CityDefinition[] = [
  // 金国与北方
  site("yanjing", "中都大兴府", "金国中京", 116.4, 39.9, "jin", "capital", "金国朝廷与北方商路的核心，城门盘查森严，各国使节与大商队云集。", ["金国关牒", "皮货", "北地军情"]),
  site("datong", "西京大同府", "云中重镇", 113.3, 40.1, "jin", "major"),
  site("taiyuan", "太原府", "河东都会", 112.55, 37.87, "jin", "major", "太行以西的兵家要地，铁器、战马与军情都在这里转手。", ["铁器", "战马", "军需"]),
  site("zhending", "真定府", "河北咽喉", 114.5, 38.0, "jin", "major"),
  site("jinan", "济南府", "齐州旧城", 117.0, 36.67, "jin", "major"),
  site("yidu", "益都府", "山东东路治所", 118.48, 36.68, "jin", "major"),
  site("kaifeng", "南京开封府", "汴梁旧都", 114.31, 34.8, "jin", "capital", "昔日大宋东京，如今是金国南京。旧商号、人质与密探都藏在繁华背后。", ["旧宋人脉", "漕运", "违禁货"]),
  site("luoyang", "河南府", "西京故城", 112.45, 34.62, "jin", "major"),
  site("hezhong", "河中府", "蒲州河津", 110.7, 35.6, "jin", "major"),
  site("jingzhao", "京兆府", "关中都会", 108.94, 34.34, "jin", "major"),
  site("lanzhou", "兰州", "黄河上渡", 103.83, 36.06, "jin"),

  // 西夏与高原
  site("xingqing", "中兴府", "西夏国都", 106.2, 38.47, "xixia", "capital", "贺兰山下的西夏国都，河西商旅、驼队与多语文书在此汇聚。", ["驼队", "党项文书", "河西向导"]),
  site("lingzhou", "灵州", "河套门户", 106.34, 37.99, "xixia", "major"),
  site("liangzhou", "西凉府", "河西东门", 102.64, 37.93, "xixia", "major"),
  site("ganzhou", "甘州", "河西商埠", 100.45, 38.93, "xixia", "major"),
  site("qingtang", "西宁州", "青唐故地", 101.78, 36.62, "tibetan", "major"),
  site("songpan", "松州", "川西羌道", 103.6, 32.64, "tibetan"),
  site("lhasa", "逻些城", "雪域都会", 91.13, 29.65, "tibetan", "major"),

  // 宋金边境
  site("xiangyang", "襄阳府", "京西南路屏障", 112.14, 32.04, "song", "major", "汉水边的南宋北门。城外烽燧不断，任何一趟普通货镖都可能转成军镖。", ["军需", "边军文书", "北路情报"]),
  site("zaoyang", "枣阳军", "襄北前哨", 112.75, 32.12, "song"),
  site("guanghua", "光化军", "汉水关口", 111.67, 32.38, "song"),
  site("shouchun", "安丰军", "淮西重镇", 116.78, 32.57, "song", "major"),
  site("hezhou", "和州", "濡须渡口", 118.35, 31.75, "song"),
  site("chuzhou", "滁州", "淮东山城", 118.32, 32.3, "song"),
  site("yangzhou", "扬州", "淮东大埠", 119.42, 32.39, "song", "major", "运河与长江交会的繁忙商埠，北货南运都要经过这里。", ["盐引", "漕船", "北地消息"]),
  site("jiankang", "建康府", "江南东路帅府", 118.8, 32.06, "song", "major", "扼守长江的陪都与军事中心，水军、官船和大商帮在此交错。", ["水军关系", "军械", "江防路报"]),
  site("zhenjiang", "镇江府", "京口要津", 119.42, 32.2, "song", "major"),

  // 两浙与东南海路
  site("linan", "临安府", "大宋行在", 120.15, 30.27, "song", "capital", "钱塘江与西湖之间的大宋都城，各地行院、牙人和大商帮都在这里设有总号。", ["高价值委托", "天下舆报", "商帮总号"]),
  site("pingjiang", "平江府", "江南财赋之地", 120.62, 31.3, "song", "major", "河港纵横的富庶大城，丝绸、书画与精细货镖尤其兴盛。", ["丝绸", "书画", "河港"]),
  site("changzhou", "常州", "运河粮仓", 119.97, 31.81, "song"),
  site("huzhou", "湖州", "太湖南岸", 120.09, 30.9, "song"),
  site("jiaxing", "嘉兴府", "秀水粮乡", 120.75, 30.75, "song", "major"),
  site("shaoxing", "绍兴府", "越州故地", 120.58, 30.0, "song", "major"),
  site("qingyuan", "庆元府", "明州海港", 121.55, 29.87, "song", "major", "东海大港，来自高丽、日本与南洋的货物在这里换船入境。", ["海船", "舶货", "外商通事"]),
  site("taizhou", "台州", "括苍海路", 121.42, 28.66, "song"),
  site("wenzhou", "温州", "瓯江港城", 120.7, 28.0, "song", "major"),
  site("wuzhou", "婺州", "浙中商埠", 119.65, 29.08, "song"),
  site("quzhou", "衢州", "三衢山口", 118.88, 28.97, "song"),
  site("yanzhou", "严州", "新安江口", 119.28, 29.48, "song"),

  // 荆湖与江南西路
  site("ezhou", "鄂州", "长江中游重镇", 114.3, 30.6, "song", "major", "长江、汉水与湖区航路交会，向西入蜀、向北赴襄阳都从这里分路。", ["江船", "粮米", "荆湖向导"]),
  site("jiangling", "江陵府", "荆湖北路帅府", 112.24, 30.34, "song", "major"),
  site("yuezhou", "岳州", "洞庭门户", 113.13, 29.37, "song"),
  site("tanzhou", "潭州", "湖南都会", 112.94, 28.23, "song", "major"),
  site("hengzhou", "衡州", "湘南驿路", 112.57, 26.89, "song"),
  site("longxing", "隆兴府", "江南西路治所", 115.86, 28.68, "song", "major"),
  site("jiangzhou", "江州", "庐山江埠", 115.99, 29.72, "song"),
  site("raozhou", "饶州", "鄱阳湖东", 117.2, 29.3, "song"),
  site("jizhou", "吉州", "赣江中渡", 114.98, 27.11, "song"),
  site("ganzhou_song", "赣州", "章贡水口", 114.94, 25.83, "song", "major"),

  // 四川
  site("chengdu", "成都府", "西南大都会", 104.07, 30.67, "song", "major", "锦江边的大城，是川峡货物、交子与西南山路的总汇。", ["蜀锦", "交子", "山路向导"]),
  site("tongchuan", "潼川府", "涪江要冲", 105.39, 30.87, "song", "major"),
  site("lizhou", "利州", "蜀道北门", 105.84, 32.44, "song", "major"),
  site("xingyuan", "兴元府", "汉中府治", 107.03, 33.07, "song", "major"),
  site("kuizhou", "夔州", "三峡西口", 109.57, 31.05, "song", "major"),
  site("chongqing", "重庆府", "巴渝山城", 106.55, 29.57, "song", "major"),
  site("hezhou_shu", "合州", "钓鱼山下", 106.27, 29.99, "song"),
  site("luzhou", "泸州", "川南酒埠", 105.44, 28.87, "song"),

  // 福建
  site("jianning", "建宁府", "闽北山府", 118.17, 27.33, "song", "major"),
  site("fuzhou", "福州", "福建路治所", 119.3, 26.08, "song", "major"),
  site("quanzhou", "泉州", "刺桐大港", 118.68, 24.88, "song", "major", "海舶云集的世界港口，香料、珠宝与异国客商使每一趟镖都身价不凡。", ["海贸", "香料", "外商人脉"]),
  site("zhangzhou", "漳州", "九龙江口", 117.65, 24.52, "song"),
  site("tingzhou", "汀州", "闽西山城", 116.36, 25.83, "song"),

  // 岭南
  site("guangzhou", "广州", "广南东路都会", 113.27, 23.13, "song", "major", "珠江口的海贸中心，香药、象牙、珠货与外洋消息极多。", ["市舶司", "南洋货", "珠江船帮"]),
  site("shaozhou", "韶州", "岭北关门", 113.6, 24.81, "song"),
  site("huizhou", "惠州", "东江驿城", 114.42, 23.11, "song"),
  site("chaozhou", "潮州", "韩江海口", 116.63, 23.66, "song"),
  site("jingjiang", "静江府", "广南西路治所", 110.3, 25.27, "song", "major"),
  site("yongzhou", "邕州", "岭南西南门", 108.32, 22.82, "song", "major"),
  site("rongzhou", "容州", "郁水商埠", 110.55, 22.86, "song"),
  site("qinzhou", "钦州", "南海边港", 108.62, 21.95, "song"),

  // 大理
  site("dali", "大理城", "大理国都", 100.23, 25.6, "dali", "capital", "苍山洱海之间的大理国都，茶马古道与诸部使者在此汇集。", ["茶马贸易", "白蛮向导", "南诏古道"]),
  site("shanchan", "善阐府", "大理东都", 102.7, 25.04, "dali", "major"),
  site("nongdong", "弄栋府", "滇中驿道", 101.55, 25.04, "dali"),
];

export const TERRAIN_LABEL: Record<RouteTerrain, string> = {
  official: "官道",
  mountain: "山路",
  river: "水路",
};

const terrainNote: Record<RouteTerrain, string> = {
  official: "驿站与铺兵较多，通行稳定但常有官检。",
  mountain: "路险且伤车马，熟路向导能显著降低风险。",
  river: "顺流省时载重高，水位、封渡和水匪难料。",
};

function road(id: string, from: string, to: string, name: string, terrain: RouteTerrain, days: number, danger: number, note = terrainNote[terrain]): RouteDefinition {
  return { id, from, to, name, terrain, days, danger, note };
}

export const ROUTES: RouteDefinition[] = [
  // 北方路网
  road("yanjing-datong", "yanjing", "datong", "燕云官道", "official", 3, 54),
  road("yanjing-zhending", "yanjing", "zhending", "燕南官道", "official", 3, 48),
  road("datong-taiyuan", "datong", "taiyuan", "雁门驿道", "mountain", 3, 62),
  road("zhending-taiyuan", "zhending", "taiyuan", "井陉山道", "mountain", 2, 61),
  road("zhending-jinan", "zhending", "jinan", "河北东路", "official", 3, 45),
  road("jinan-yidu", "jinan", "yidu", "齐鲁官道", "official", 2, 34),
  road("jinan-kaifeng", "jinan", "kaifeng", "大名南路", "official", 4, 43),
  road("kaifeng-luoyang", "kaifeng", "luoyang", "汴洛官道", "official", 2, 37),
  road("luoyang-hezhong", "luoyang", "hezhong", "崤函西道", "mountain", 2, 52),
  road("hezhong-jingzhao", "hezhong", "jingzhao", "关中东道", "official", 2, 44),
  road("taiyuan-hezhong", "taiyuan", "hezhong", "河东南路", "mountain", 3, 57),
  road("taiyuan-jingzhao", "taiyuan", "jingzhao", "吕梁商道", "mountain", 4, 67),
  road("lanzhou-jingzhao", "lanzhou", "jingzhao", "陇右官道", "mountain", 4, 63),
  road("lanzhou-qingtang", "lanzhou", "qingtang", "湟水道", "mountain", 2, 61),
  road("xingqing-lingzhou", "xingqing", "lingzhou", "河套驿道", "official", 1, 36),
  road("lingzhou-liangzhou", "lingzhou", "liangzhou", "河西东道", "mountain", 4, 58),
  road("liangzhou-ganzhou", "liangzhou", "ganzhou", "河西商道", "official", 3, 49),
  road("lingzhou-lanzhou", "lingzhou", "lanzhou", "黄河峡道", "mountain", 3, 66),

  // 宋金边路
  road("kaifeng-shouchun", "kaifeng", "shouchun", "淮北官道", "official", 4, 76),
  road("kaifeng-xiangyang", "kaifeng", "xiangyang", "京西北路", "official", 4, 78),
  road("luoyang-xiangyang", "luoyang", "xiangyang", "伏牛山道", "mountain", 3, 73),
  road("jingzhao-xingyuan", "jingzhao", "xingyuan", "秦岭栈道", "mountain", 3, 79),
  road("xiangyang-zaoyang", "xiangyang", "zaoyang", "襄北驿路", "official", 1, 63),
  road("xiangyang-guanghua", "xiangyang", "guanghua", "汉水西道", "river", 1, 58),
  road("shouchun-hezhou", "shouchun", "hezhou", "淮西南道", "official", 2, 57),
  road("shouchun-yangzhou", "shouchun", "yangzhou", "淮东粮道", "official", 3, 55),
  road("hezhou-jiankang", "hezhou", "jiankang", "横江渡", "river", 1, 48),
  road("chuzhou-jiankang", "chuzhou", "jiankang", "滁岭官道", "official", 1, 37),
  road("chuzhou-yangzhou", "chuzhou", "yangzhou", "淮东驿路", "official", 1, 35),
  road("yangzhou-zhenjiang", "yangzhou", "zhenjiang", "瓜洲渡", "river", 1, 42),
  road("zhenjiang-jiankang", "zhenjiang", "jiankang", "长江上行", "river", 1, 34),

  // 两浙
  road("linan-jiankang", "linan", "jiankang", "行在江淮驿路", "official", 4, 39, "横穿江南腹地的长程驿路，铺兵齐全，遇战事时也最容易被征用。"),
  road("jiankang-pingjiang", "jiankang", "pingjiang", "江南东路", "official", 3, 34),
  road("zhenjiang-changzhou", "zhenjiang", "changzhou", "运河南段", "river", 1, 26),
  road("changzhou-pingjiang", "changzhou", "pingjiang", "太湖东道", "river", 1, 25),
  road("pingjiang-jiaxing", "pingjiang", "jiaxing", "吴越水网", "river", 1, 22),
  road("jiaxing-linan", "jiaxing", "linan", "临平水路", "river", 1, 24),
  road("pingjiang-huzhou", "pingjiang", "huzhou", "太湖西路", "river", 1, 26),
  road("huzhou-linan", "huzhou", "linan", "武林官道", "official", 1, 23),
  road("linan-shaoxing", "linan", "shaoxing", "钱塘越道", "river", 1, 27),
  road("shaoxing-qingyuan", "shaoxing", "qingyuan", "浙东运河", "river", 2, 30),
  road("qingyuan-taizhou", "qingyuan", "taizhou", "东海近岸", "river", 2, 43),
  road("taizhou-wenzhou", "taizhou", "wenzhou", "括苍海路", "river", 2, 46),
  road("linan-yanzhou", "linan", "yanzhou", "新安江道", "river", 1, 35),
  road("yanzhou-wuzhou", "yanzhou", "wuzhou", "兰溪水路", "river", 1, 32),
  road("wuzhou-quzhou", "wuzhou", "quzhou", "衢江道", "river", 1, 35),
  road("yanzhou-huzhou", "yanzhou", "huzhou", "天目山道", "mountain", 2, 49),

  // 长江、荆湖与江西
  road("jiankang-jiangzhou", "jiankang", "jiangzhou", "长江中航", "river", 3, 38),
  road("jiankang-ezhou", "jiankang", "ezhou", "长江西航", "river", 4, 42),
  road("ezhou-jiangzhou", "ezhou", "jiangzhou", "鄂赣江路", "river", 2, 39),
  road("jiangzhou-longxing", "jiangzhou", "longxing", "赣北官道", "official", 1, 31),
  road("jiangzhou-raozhou", "jiangzhou", "raozhou", "鄱阳湖路", "river", 1, 29),
  road("raozhou-longxing", "raozhou", "longxing", "豫章东道", "official", 1, 32),
  road("quzhou-raozhou", "quzhou", "raozhou", "仙霞西道", "mountain", 2, 48),
  road("longxing-jizhou", "longxing", "jizhou", "赣江中航", "river", 2, 34),
  road("jizhou-ganzhou", "jizhou", "ganzhou_song", "赣江南航", "river", 2, 39),
  road("xiangyang-ezhou", "xiangyang", "ezhou", "汉水南航", "river", 2, 56),
  road("xiangyang-jiangling", "xiangyang", "jiangling", "荆襄官道", "official", 2, 52),
  road("jiangling-yuezhou", "jiangling", "yuezhou", "洞庭西水道", "river", 2, 43),
  road("ezhou-yuezhou", "ezhou", "yuezhou", "洞庭东水道", "river", 2, 39),
  road("yuezhou-tanzhou", "yuezhou", "tanzhou", "湘江北航", "river", 1, 31),
  road("tanzhou-hengzhou", "tanzhou", "hengzhou", "湘江南航", "river", 2, 37),

  // 四川与三峡
  road("jiangling-kuizhou", "jiangling", "kuizhou", "三峡东航", "river", 3, 62),
  road("kuizhou-chongqing", "kuizhou", "chongqing", "峡江上航", "river", 3, 67),
  road("chongqing-hezhou", "chongqing", "hezhou_shu", "嘉陵江道", "river", 1, 38),
  road("hezhou-tongchuan", "hezhou_shu", "tongchuan", "涪江道", "river", 1, 37),
  road("tongchuan-chengdu", "tongchuan", "chengdu", "成都东道", "official", 2, 35),
  road("chengdu-lizhou", "chengdu", "lizhou", "金牛蜀道", "mountain", 3, 62),
  road("lizhou-xingyuan", "lizhou", "xingyuan", "剑门栈道", "mountain", 1, 57),
  road("xingyuan-xiangyang", "xingyuan", "xiangyang", "汉水东道", "mountain", 4, 64),
  road("chongqing-luzhou", "chongqing", "luzhou", "长江南航", "river", 2, 41),
  road("luzhou-chengdu", "luzhou", "chengdu", "蜀南官道", "official", 3, 47),
  road("songpan-chengdu", "songpan", "chengdu", "岷山古道", "mountain", 3, 72),
  road("qingtang-songpan", "qingtang", "songpan", "羌中山道", "mountain", 3, 76),
  road("qingtang-lhasa", "qingtang", "lhasa", "青藏驼道", "mountain", 6, 83),

  // 福建与海路
  road("wenzhou-fuzhou", "wenzhou", "fuzhou", "闽浙海路", "river", 3, 52),
  road("fuzhou-quanzhou", "fuzhou", "quanzhou", "福建海路", "river", 2, 39),
  road("quanzhou-zhangzhou", "quanzhou", "zhangzhou", "刺桐南道", "river", 1, 31),
  road("quanzhou-jianning", "quanzhou", "jianning", "戴云山道", "mountain", 3, 58),
  road("jianning-wuzhou", "jianning", "wuzhou", "仙霞古道", "mountain", 3, 55),
  road("jianning-tingzhou", "jianning", "tingzhou", "闽西北道", "mountain", 2, 52),
  road("tingzhou-zhangzhou", "tingzhou", "zhangzhou", "博平岭道", "mountain", 2, 55),
  road("tingzhou-ganzhou", "tingzhou", "ganzhou_song", "汀赣古道", "mountain", 2, 52),
  road("zhangzhou-chaozhou", "zhangzhou", "chaozhou", "闽粤海路", "river", 2, 43),

  // 岭南与大理
  road("ganzhou-shaozhou", "ganzhou_song", "shaozhou", "大庾岭道", "mountain", 2, 55),
  road("shaozhou-guangzhou", "shaozhou", "guangzhou", "北江航路", "river", 2, 36),
  road("chaozhou-huizhou", "chaozhou", "huizhou", "粤东官道", "official", 2, 41),
  road("huizhou-guangzhou", "huizhou", "guangzhou", "东江航路", "river", 2, 33),
  road("hengzhou-jingjiang", "hengzhou", "jingjiang", "湘桂山道", "mountain", 2, 53),
  road("jingjiang-shaozhou", "jingjiang", "shaozhou", "南岭东道", "mountain", 2, 58),
  road("jingjiang-yongzhou", "jingjiang", "yongzhou", "桂江西道", "river", 2, 43),
  road("yongzhou-rongzhou", "yongzhou", "rongzhou", "郁江东道", "river", 2, 46),
  road("rongzhou-guangzhou", "rongzhou", "guangzhou", "西江航路", "river", 3, 45),
  road("yongzhou-qinzhou", "yongzhou", "qinzhou", "钦江南道", "river", 2, 49),
  road("dali-shanchan", "dali", "shanchan", "滇池东道", "official", 2, 42),
  road("dali-nongdong", "dali", "nongdong", "洱海东道", "official", 1, 37),
  road("nongdong-shanchan", "nongdong", "shanchan", "滇中驿道", "official", 1, 40),
  road("shanchan-yongzhou", "shanchan", "yongzhou", "西南夷道", "mountain", 5, 74),
  road("dali-chengdu", "dali", "chengdu", "川滇茶马道", "mountain", 6, 81),
];

export function cityById(id: string): CityDefinition {
  const city = CITIES.find((item) => item.id === id);
  if (!city) throw new Error(`Unknown city: ${id}`);
  return city;
}

export function routeById(id: string): RouteDefinition {
  const route = ROUTES.find((item) => item.id === id);
  if (!route) throw new Error(`Unknown route: ${id}`);
  return route;
}

export function otherCity(route: RouteDefinition, cityId: string): string {
  return route.from === cityId ? route.to : route.from;
}
