import { pickRandom, randomInt } from "./rng";
import { CREW_DISCIPLINES } from "./crewDisciplineContent";
import { normalizeCrewInjury } from "./injuryContent";
import { normalizeCrewCaptivity } from "./captivityContent";
import { createFormationExperience, normalizeFormationExperience } from "./formationProficiency";
import type { CityTier, CrewDisciplineId, CrewMember, CrewRole } from "./types";

export const CREW_CAPACITY = 8;

interface RecruitTemplate {
  id: string;
  name: string;
  courtesy: string;
  role: CrewRole;
  maxHp: number;
  wage: number;
  hiringCost: number;
  specialty: string;
  biography: string;
}

const RECRUIT_TEMPLATES: RecruitTemplate[] = [
  { id: "zhu-sanniang", name: "祝三娘", courtesy: "照胆", role: "副镖头", maxHp: 96, wage: 13, hiringCost: 54, specialty: "临阵断后", biography: "淮上军户出身，惯用一杆枣木枪；队尾交给她，乱阵也不易散。" },
  { id: "xue-zhong", name: "薛忠", courtesy: "守一", role: "副镖头", maxHp: 104, wage: 14, hiringCost: 58, specialty: "守车拒马", biography: "曾替盐纲押船十年，话少手稳，最知道什么时候该守、什么时候该退。" },
  { id: "dai-wenling", name: "戴闻铃", courtesy: "逐风", role: "趟子手", maxHp: 84, wage: 8, hiringCost: 34, specialty: "驿路听风", biography: "沿江跑腿出身，能从客栈马料与驿卒脸色里听出前路虚实。" },
  { id: "lin-yan", name: "林雁", courtesy: "归鸿", role: "趟子手", maxHp: 86, wage: 8, hiringCost: 36, specialty: "夜行传信", biography: "善走夜路，记路不靠界碑；乱军封道时也能把消息先送回来。" },
  { id: "shi-gan", name: "石敢", courtesy: "木衡", role: "车把式", maxHp: 98, wage: 9, hiringCost: 39, specialty: "驯骡固轴", biography: "祖传车行手艺，既懂牲口脾气，也懂湿木与干木该怎样合榫。" },
  { id: "cheng-jiu", name: "成九", courtesy: "百辙", role: "车把式", maxHp: 94, wage: 9, hiringCost: 38, specialty: "险坡控车", biography: "川峡盘山道上长大，下坡时听风辨辙，肯拿自己的肩背去抵车杠。" },
  { id: "fang-zhibai", name: "方知白", courtesy: "守墨", role: "账房", maxHp: 74, wage: 10, hiringCost: 42, specialty: "商税辨伪", biography: "做过榷场书手，识得各地税引暗记，也记得常在关前伸手的吏员。" },
  { id: "han-yaolang", name: "韩药郎", courtesy: "济微", role: "医师", maxHp: 70, wage: 11, hiringCost: 46, specialty: "金疮正骨", biography: "背着一只旧藤药笼行医，刀伤、脱臼与风寒都有一套简净法子。" },
  { id: "liu-qixian", name: "刘七弦", courtesy: "识岚", role: "向导", maxHp: 82, wage: 9, hiringCost: 40, specialty: "山路辨岚", biography: "看云脚便知雨势，看鸟群便知山坳里有没有人，最熟东南丘陵的小径。" },
  { id: "alehan", name: "阿勒罕", courtesy: "远岭", role: "向导", maxHp: 90, wage: 10, hiringCost: 44, specialty: "高原识途", biography: "往来茶马道多年，能辨雪线与水源，也知道陌生部族的忌讳。" },
  { id: "gu-xiaomai", name: "顾小麦", courtesy: "和羹", role: "厨子", maxHp: 78, wage: 8, hiringCost: 32, specialty: "省粮安众", biography: "一袋陈米也能安排出三日热食；队伍吃得稳，坏天气里便少些怨气。" },
  { id: "ye-qiuniang", name: "叶秋娘", courtesy: "知味", role: "厨子", maxHp: 76, wage: 8, hiringCost: 33, specialty: "水土调膳", biography: "随商船走过五湖，懂得用本地草叶与干粮压住水土不服。" },
];

export interface CrewRank {
  label: "新手" | "熟手" | "老手" | "名手";
  level: number;
  battleBonus: number;
  nextAt: number | null;
}

export function crewRank(experience: number): CrewRank {
  if (experience >= 12) return { label: "名手", level: 3, battleBonus: 0.12, nextAt: null };
  if (experience >= 7) return { label: "老手", level: 2, battleBonus: 0.08, nextAt: 12 };
  if (experience >= 3) return { label: "熟手", level: 1, battleBonus: 0.04, nextAt: 7 };
  return { label: "新手", level: 0, battleBonus: 0, nextAt: 3 };
}

export function normalizeCrewMember(member: Partial<CrewMember> & Pick<CrewMember, "id" | "name" | "courtesy" | "role" | "hp" | "maxHp" | "experience" | "wage" | "specialty" | "biography">, fallbackCityId: string): CrewMember {
  return {
    ...member,
    hiringCost: member.hiringCost ?? 0,
    originCityId: member.originCityId ?? fallbackCityId,
    disciplineId: typeof member.disciplineId === "string" && member.disciplineId in CREW_DISCIPLINES
      ? member.disciplineId as CrewDisciplineId
      : null,
    injury: normalizeCrewInjury(member.injury),
    captivity: normalizeCrewCaptivity(member.captivity),
    formationExperience: normalizeFormationExperience(member.formationExperience),
  };
}

export function generateRecruitPool(
  cityId: string,
  cityTier: CityTier,
  day: number,
  rngState: number,
  existingIds: string[],
  qualityBonus = 0,
  limit = 3,
): { recruits: CrewMember[]; rngState: number } {
  const hired = new Set(existingIds);
  let available = RECRUIT_TEMPLATES.filter((item) => !hired.has(item.id));
  const recruits: CrewMember[] = [];
  let state = rngState;
  const utilityRoles = new Set<CrewRole>(["向导", "厨子", "医师", "账房"]);

  while (recruits.length < limit && available.length) {
    const pool = recruits.length === 0 && available.some((item) => utilityRoles.has(item.role))
      ? available.filter((item) => utilityRoles.has(item.role))
      : available;
    const picked = pickRandom(state, pool);
    state = picked.state;
    const experienceRoll = randomInt(state, 0, cityTier === "capital" ? 4 : cityTier === "major" ? 3 : 2);
    state = experienceRoll.state;
    const experience = Math.max(0, experienceRoll.value - (day < 8 ? 1 : 0) + qualityBonus);
    const template = picked.value;
    recruits.push({
      ...template,
      id: template.id,
      hp: template.maxHp,
      experience,
      hiringCost: template.hiringCost + experience * 3,
      originCityId: cityId,
      disciplineId: null,
      injury: null,
      captivity: null,
      formationExperience: createFormationExperience(),
    });
    available = available.filter((item) => item.id !== template.id);
  }

  return { recruits, rngState: state };
}
