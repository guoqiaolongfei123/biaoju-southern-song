import { weatherSeason, type WeatherSeason } from "./weatherContent";

export const DAYS_PER_GAME_MONTH = 30;
export const MONTHS_PER_GAME_YEAR = 12;
export const DAYS_PER_GAME_YEAR = DAYS_PER_GAME_MONTH * MONTHS_PER_GAME_YEAR;

const MONTH_LABELS = ["正月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "冬月", "腊月"] as const;
const DAY_LABELS = [
  "初一", "初二", "初三", "初四", "初五", "初六", "初七", "初八", "初九", "初十",
  "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十",
  "廿一", "廿二", "廿三", "廿四", "廿五", "廿六", "廿七", "廿八", "廿九", "三十",
] as const;

const SEASON_LABELS: Record<WeatherSeason, { seal: string; label: string; roadTitle: string; roadSummary: string }> = {
  spring: { seal: "春", label: "春令", roadTitle: "春雨渐密", roadSummary: "江南土路易软，山径多雾；水路须防连雨涨水。" },
  summer: { seal: "夏", label: "夏令", roadTitle: "暑雨交作", roadSummary: "午后暑热耗马，沿海与大江须防急雨雷暴。" },
  autumn: { seal: "秋", label: "秋令", roadTitle: "秋高路清", roadSummary: "多地天光转稳，惟高地与河面仍可能遇强风。" },
  winter: { seal: "冬", label: "冬令", roadTitle: "霜风在途", roadSummary: "北地与山口易结霜，高原草料与马力消耗更甚。" },
};

const SEASON_PERIOD_PREFIX = ["孟", "仲", "季"] as const;
const SEASON_CHARACTER: Record<WeatherSeason, string> = { spring: "春", summer: "夏", autumn: "秋", winter: "冬" };

function chineseNumber(value: number): string {
  if (value <= 0) return "零";
  const digits = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
  if (value < 10) return digits[value];
  if (value < 20) return `十${value === 10 ? "" : digits[value - 10]}`;
  if (value < 100) {
    const tens = Math.floor(value / 10);
    const ones = value % 10;
    return `${digits[tens]}十${ones ? digits[ones] : ""}`;
  }
  return String(value);
}

export interface GameCalendarDate {
  absoluteDay: number;
  eraYear: number;
  eraYearLabel: string;
  gregorianYear: number;
  month: number;
  monthLabel: string;
  dayOfMonth: number;
  dayLabel: string;
  dateLabel: string;
  fullLabel: string;
  season: WeatherSeason;
  seasonSeal: string;
  seasonLabel: string;
  seasonPeriodLabel: string;
  daysUntilSeasonChange: number;
}

export interface SeasonalTravelAdvisory {
  season: WeatherSeason;
  seal: string;
  label: string;
  title: string;
  summary: string;
}

/**
 * A deliberately readable game calendar: twelve equal thirty-day months.
 * It is not a claim of day-for-day equivalence with the historical lunisolar
 * calendar; it keeps the sandbox's year, month and four weather seasons in one
 * stable timeline.
 */
export function gameCalendarDate(day: number): GameCalendarDate {
  const absoluteDay = Math.max(1, Math.floor(day));
  const zeroBasedDay = absoluteDay - 1;
  const eraYear = Math.floor(zeroBasedDay / DAYS_PER_GAME_YEAR) + 1;
  const dayOfYear = (zeroBasedDay % DAYS_PER_GAME_YEAR) + 1;
  const month = Math.floor((dayOfYear - 1) / DAYS_PER_GAME_MONTH) + 1;
  const dayOfMonth = ((dayOfYear - 1) % DAYS_PER_GAME_MONTH) + 1;
  const season = weatherSeason(absoluteDay);
  const monthWithinSeason = (month - 1) % 3;
  const seasonInfo = SEASON_LABELS[season];
  const eraYearLabel = eraYear === 1 ? "元年" : `${chineseNumber(eraYear)}年`;
  const monthLabel = MONTH_LABELS[month - 1];
  const dayLabel = DAY_LABELS[dayOfMonth - 1];
  const seasonEndDayOfYear = Math.ceil(dayOfYear / 90) * 90;
  return {
    absoluteDay,
    eraYear,
    eraYearLabel,
    gregorianYear: 1207 + eraYear,
    month,
    monthLabel,
    dayOfMonth,
    dayLabel,
    dateLabel: `${monthLabel}${dayLabel}`,
    fullLabel: `嘉定${eraYearLabel} · ${monthLabel}${dayLabel}`,
    season,
    seasonSeal: seasonInfo.seal,
    seasonLabel: seasonInfo.label,
    seasonPeriodLabel: `${SEASON_PERIOD_PREFIX[monthWithinSeason]}${SEASON_CHARACTER[season]}`,
    daysUntilSeasonChange: seasonEndDayOfYear - dayOfYear,
  };
}

export function seasonalTravelAdvisory(day: number): SeasonalTravelAdvisory {
  const season = weatherSeason(day);
  const info = SEASON_LABELS[season];
  return { season, seal: info.seal, label: info.label, title: info.roadTitle, summary: info.roadSummary };
}
