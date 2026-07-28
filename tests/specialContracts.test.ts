import { describe, expect, it } from "vitest";
import { cityById, routeById } from "../src/core/data";
import {
  acceptContract,
  advanceTravel,
  chooseRoute,
  createInitialGame,
  generateContracts,
  generateRoutePlans,
} from "../src/core/game";
import { contractBoardAssessment } from "../src/core/contractBoard";
import {
  coldChainSegmentDamage,
  specialBattleDangerModifier,
  specialSettlementRates,
  specialTravelForecast,
} from "../src/core/specialContractContent";
import { weatherForRegion, weatherForRoute, type RegionalWeather } from "../src/core/weatherContent";
import type { Contract, GameState } from "../src/core/types";

function specialContract(specialHandlingId: Contract["specialHandlingId"] = "cold-chain"): Contract {
  return {
    id: `test-${specialHandlingId}`,
    from: "linan",
    to: "jiankang",
    title: "试运特镖",
    cargo: "一只试运封匣",
    client: "行会试契",
    reward: 180,
    deadline: 8,
    risk: "棘手",
    sealRequired: true,
    kind: "special",
    specialHandlingId,
    patron: "merchant",
    inspectionAllowed: false,
    allowedLoss: 3,
    confidentiality: "隐秘",
    failurePenalty: 70,
    complication: "none",
    clue: "封匣外另附特殊规程。",
    requirement: "依特殊规程照料。",
    secretKnown: true,
    secret: "此为测试镖物。",
    brief: "八日内送抵建康府。",
  };
}

function weather(kind: RegionalWeather["kind"], season: RegionalWeather["season"] = "summer"): RegionalWeather {
  const base = weatherForRegion(1107, 40, "jiangnan-coast");
  return {
    ...base,
    kind,
    season,
    label: kind === "heat" ? "暑气蒸郁" : kind === "frost" ? "霜雪封寒" : base.label,
    seal: kind === "heat" ? "暑" : kind === "frost" ? "霜" : base.seal,
    severity: kind === "heat" ? 2 : kind === "frost" ? 3 : base.severity,
  };
}

describe("特殊镖", () => {
  it("把特镖作为第四种镖单稳定加入新镖榜", () => {
    const generated = generateContracts("linan", 12, 1107, false, 4).contracts;
    expect(new Set(generated.map((contract) => contract.kind))).toEqual(new Set(["cargo", "letter", "escort", "special"]));
    const special = generated.find((contract) => contract.kind === "special");
    expect(special?.specialHandlingId).toMatch(/cold-chain|solemn|appointed|tracked/);
  });

  it("冷藏镖在暑热长途会自然损耗，医师与浸矾篷布能真实减损", () => {
    const contract = specialContract("cold-chain");
    const segment = { days: 5, terrain: "official" as const, weather: weather("heat") };
    const bare = coldChainSegmentDamage(contract, segment, { crewRoles: [], upgrades: [] });
    const prepared = coldChainSegmentDamage(contract, segment, { crewRoles: ["医师"], upgrades: ["fireproof-awning"] });
    const frost = coldChainSegmentDamage(contract, { ...segment, weather: weather("frost", "winter") }, { crewRoles: [], upgrades: [] });
    expect(bare).toBeGreaterThan(prepared);
    expect(bare).toBeGreaterThan(frost);
    expect(prepared).toBeGreaterThanOrEqual(0);
  });

  it("实际推进路段时会把冷藏自然损耗写回车队货况", () => {
    const contract = specialContract("cold-chain");
    const plan = generateRoutePlans(contract.from, contract.to)[0];
    const firstRoute = routeById(plan.routeIds[0]);
    let seed = 1;
    while (seed < 5000 && weatherForRoute(seed, 1, firstRoute).kind !== "heat") seed += 1;
    expect(seed).toBeLessThan(5000);

    const begin = (active: Contract) => {
      const base: GameState = { ...createInitialGame(seed), supplies: 100, contracts: [active] };
      const planning = acceptContract(base, active.id);
      return chooseRoute(planning, generateRoutePlans(active.from, active.to, planning)[0]);
    };
    const specialAfter = advanceTravel(begin(contract));
    const ordinaryAfter = advanceTravel(begin({ ...contract, kind: "cargo", specialHandlingId: undefined }));
    expect(specialAfter.convoy.cargoIntegrity).toBeLessThan(ordinaryAfter.convoy.cargoIntegrity);
    expect(specialAfter.news[0]).toContain("特镖养护");
  });

  it("追踪镖公开亮旗最危险，潜行与暗格可叠加压低敌势", () => {
    const contract = specialContract("tracked");
    expect(specialBattleDangerModifier(contract, "steady", [])).toBe(12);
    expect(specialBattleDangerModifier(contract, "covert", ["hidden-compartment"])).toBe(3);
    const forecast = specialTravelForecast(contract, {
      stance: "covert",
      crewRoles: [],
      upgrades: ["hidden-compartment"],
      segments: [],
      borderSegments: 0,
      deadlineMargin: 4,
    });
    expect(forecast?.note).toContain("大幅削弱");
  });

  it("定时特镖的每日误期扣酬高于普通货镖，并在接镖前明示特殊规程", () => {
    const contract = specialContract("appointed");
    expect(specialSettlementRates(contract)?.lateRate).toBe(.2);
    const game = createInitialGame(1107);
    const assessment = contractBoardAssessment(game, contract);
    expect(assessment.specialHandling?.name).toBe("刻时交付");
    expect(assessment.specialHandling?.counterplay).toContain("轻车快马");
    expect(assessment.plan?.cityIds.at(-1)).toBe(cityById(contract.to).id);
  });
});
