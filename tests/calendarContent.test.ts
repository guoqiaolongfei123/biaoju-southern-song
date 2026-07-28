import { describe, expect, it } from "vitest";
import { DAYS_PER_GAME_YEAR, gameCalendarDate, seasonalTravelAdvisory } from "../src/core/calendarContent";

describe("嘉定行用历与季候路报", () => {
  it("把沙盘日数稳定换算为年、月、日与四季", () => {
    expect(gameCalendarDate(1)).toMatchObject({
      eraYear: 1,
      eraYearLabel: "元年",
      month: 1,
      monthLabel: "正月",
      dayOfMonth: 1,
      dayLabel: "初一",
      season: "spring",
      seasonPeriodLabel: "孟春",
    });
    expect(gameCalendarDate(90)).toMatchObject({ month: 3, dayOfMonth: 30, season: "spring", daysUntilSeasonChange: 0 });
    expect(gameCalendarDate(91)).toMatchObject({ month: 4, dayOfMonth: 1, season: "summer", seasonPeriodLabel: "孟夏" });
    expect(gameCalendarDate(271)).toMatchObject({ month: 10, season: "winter", seasonPeriodLabel: "孟冬" });
  });

  it("跨年后推进嘉定年号并从春令重新开始", () => {
    const nextYear = gameCalendarDate(DAYS_PER_GAME_YEAR + 1);
    expect(nextYear.fullLabel).toBe("嘉定二年 · 正月初一");
    expect(nextYear.gregorianYear).toBe(1209);
    expect(nextYear.season).toBe("spring");
  });

  it("每季提供与真实天气权重相呼应的行路提示", () => {
    expect(seasonalTravelAdvisory(1)).toMatchObject({ seal: "春", title: "春雨渐密" });
    expect(seasonalTravelAdvisory(91)).toMatchObject({ seal: "夏", title: "暑雨交作" });
    expect(seasonalTravelAdvisory(181)).toMatchObject({ seal: "秋", title: "秋高路清" });
    expect(seasonalTravelAdvisory(271)).toMatchObject({ seal: "冬", title: "霜风在途" });
  });
});
