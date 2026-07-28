import { describe, expect, it } from "vitest";
import { createInitialGame } from "../src/core/game";
import type { CityState } from "../src/core/types";
import {
  advanceFrontlineCity,
  evolveFrontlineCampaign,
  factionsAtWar,
  frontlineSituation,
} from "../src/core/frontlineContent";

describe("连续战线演化", () => {
  it("只把存在主要战争关系的异旗邻城视为直接战线", () => {
    expect(factionsAtWar("song", "jin")).toBe(true);
    expect(factionsAtWar("jin", "mongol")).toBe(true);
    expect(factionsAtWar("song", "dali")).toBe(false);
    expect(factionsAtWar("song", "song")).toBe(false);
  });

  it("战线军情会列出相邻敌城、守势、兵压与下一阶段预警", () => {
    const game = createInitialGame(1107);
    const report = frontlineSituation(game.cities, "xiangyang", game.day);
    expect(report.exposed).toBe(true);
    expect(report.risk).toBe("siege");
    expect(report.hostileCityIds).toEqual(expect.arrayContaining(["kaifeng", "luoyang"]));
    expect(report.dominantAttacker).toBe("jin");
    expect(report.detail).toContain("开封府");
    expect(report.nextWarning).toContain("争城");

    const interior = frontlineSituation(game.cities, "linan", game.day);
    expect(interior).toMatchObject({ exposed: false, visible: false, pressure: 0, risk: "quiet" });
  });

  it("城市不会无预警直接换旗，而会依次经历边紧、围城、争城与易主", () => {
    const initial = createInitialGame(1107).cities;
    let cities: Record<string, CityState> = {
      ...initial,
      xiangyang: { ...initial.xiangyang, status: "stable" as const, security: 48, statusSinceDay: 1, playerAidDay: -99 },
    };
    const tension = advanceFrontlineCity(cities, "xiangyang", 4)!;
    expect(tension.city.status).toBe("tense");
    expect(tension.city.owner).toBe("song");
    cities = { ...cities, xiangyang: tension.city };

    const siege = advanceFrontlineCity(cities, "xiangyang", 7)!;
    expect(siege.city.status).toBe("besieged");
    expect(siege.city.owner).toBe("song");
    cities = { ...cities, xiangyang: siege.city };

    const contested = advanceFrontlineCity(cities, "xiangyang", 10)!;
    expect(contested.city.status).toBe("contested");
    expect(contested.city.owner).toBe("song");
    cities = { ...cities, xiangyang: contested.city };

    const captured = advanceFrontlineCity(cities, "xiangyang", 13)!;
    expect(captured.city.status).toBe("captured");
    expect(captured.city.owner).toBe("jin");
    expect(captured.news).toContain("旧关牒");
  });

  it("本号刚完成地方援助时会提高守势、降低兵压并至少阻止七日内升级", () => {
    const initial = createInitialGame(1107).cities;
    const unaided = frontlineSituation(initial, "xiangyang", 4);
    const aidedCities = {
      ...initial,
      xiangyang: { ...initial.xiangyang, playerAidDay: 4 },
    };
    const aided = frontlineSituation(aidedCities, "xiangyang", 4);
    expect(aided.defense).toBe(unaided.defense + 10);
    expect(aided.pressure).toBe(unaided.pressure - 10);
    expect(aided.detail).toContain("本号援助");
    expect(advanceFrontlineCity(aidedCities, "xiangyang", 4)).toBeNull();
  });

  it("换旗四日后会进入新政初定期，世界演化对同一天下签保持确定", () => {
    const initial = createInitialGame(1107).cities;
    const occupied = {
      ...initial,
      xiangyang: { ...initial.xiangyang, owner: "jin" as const, status: "captured" as const, statusSinceDay: 6, security: 30 },
    };
    expect(advanceFrontlineCity(occupied, "xiangyang", 9)).toBeNull();
    const settled = advanceFrontlineCity(occupied, "xiangyang", 10)!;
    expect(settled.city).toMatchObject({ owner: "jin", status: "tense", security: 38 });

    const first = evolveFrontlineCampaign(initial, 8, 1, 20);
    const second = evolveFrontlineCampaign(initial, 8, 1, 20);
    expect(first).toEqual(second);
    expect(first.news).toHaveLength(1);
    expect(first.changedCityId).toBeTruthy();
    if (first.nextStatus === "captured") expect(first.previousStatus).toBe("contested");
  });
});
