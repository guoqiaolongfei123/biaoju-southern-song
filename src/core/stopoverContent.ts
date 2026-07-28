import type { CityStatus, RouteTerrain } from "./types";
import { routeLandmarkKind, type RouteLandmark } from "./routeLandmarkContent";

export interface StopoverTheme {
  seal: string;
  eyebrow: string;
  title: (cityName: string) => string;
  description: string;
}

const TERRAIN_STOPOVERS: Record<RouteTerrain, StopoverTheme> = {
  official: {
    seal: "驛",
    eyebrow: "中途落脚 · 官驿灯火",
    title: (cityName) => `${cityName}外，驿亭尚未闭门`,
    description: "驿卒正换草料，脚店灶火也还热着。这里不算正式入城，却足够让镖队重新清点人货。",
  },
  mountain: {
    seal: "店",
    eyebrow: "中途落脚 · 山店夜宿",
    title: (cityName) => `${cityName}外，山店仍留着一盏灯`,
    description: "挑夫在檐下烘鞋，掌柜认得几条翻岭小道。若要改换脚程，这是难得的一处歇脚地。",
  },
  river: {
    seal: "渡",
    eyebrow: "中途落脚 · 渡亭系舟",
    title: (cityName) => `${cityName}外，渡亭泊着最后一班船`,
    description: "舟子收缆前还能添水补粮，也有人刚从下一处水道回来，袖中带着尚热的路报。",
  },
};

const TROUBLED_STATUS_NOTE: Partial<Record<CityStatus, string>> = {
  tense: "城门盘查比往日更严，驿亭里说话的人都压低了声音。",
  besieged: "城外烽烟未熄，能买到的草料和口粮都比往日昂贵。",
  captured: "新旗号刚挂上城头，旧牙人不敢公开招呼熟客。",
  famine: "流民挤在亭外，粮袋一露便会引来许多目光。",
  plague: "城门设了药棚，来往商旅都被要求远离人群。",
  disrupted: "商路断续，脚店只敢开半扇门做生意。",
  martial: "巡卒来回点名，镖旗与货票都显得格外扎眼。",
  contested: "城上两面旗号都有人认，谁也说不准明日归谁。",
};

export function stopoverTheme(terrain: RouteTerrain, status: CityStatus, cityName: string, landmark?: RouteLandmark | null): StopoverTheme & { statusNote: string } {
  const theme = TERRAIN_STOPOVERS[terrain];
  const statusNote = TROUBLED_STATUS_NOTE[status] ?? `${cityName}城外商旅往来如常，牙人愿意按市价替镖队张罗。`;
  if (!landmark) return { ...theme, statusNote };
  const kind = routeLandmarkKind(landmark.kind);
  return {
    seal: kind.seal,
    eyebrow: `中途落脚 · 前路${kind.label}`,
    title: () => `${cityName}外，${landmark.name}的路签到了`,
    description: `${landmark.description}路签上另注“${landmark.service}”，正好可在启程前重新清点人货。`,
    statusNote,
  };
}
