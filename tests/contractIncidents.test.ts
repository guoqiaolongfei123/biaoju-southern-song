import { describe, expect, it } from "vitest";
import { routeById } from "../src/core/data";
import { contractIncidentEvent } from "../src/core/contractIncidentContent";
import { acceptContract, chooseRoute, createInitialGame, resolveEvent } from "../src/core/game";
import type { Contract, ContractComplication, CrewRole, GameState, TravelEvent } from "../src/core/types";

function testContract(complication: ContractComplication, overrides: Partial<Contract> = {}): Contract {
  return {
    id: `incident-${complication}`,
    from: "linan",
    to: "xiangyang",
    title: "密箱远行",
    cargo: "一车封箱",
    client: "临安旧客",
    reward: 180,
    deadline: 14,
    risk: "棘手",
    sealRequired: true,
    kind: "cargo",
    patron: "merchant",
    inspectionAllowed: false,
    allowedLoss: 5,
    confidentiality: "隐秘",
    failurePenalty: 50,
    complication,
    clue: "箱契有一处被墨迹遮住。",
    requirement: "不得擅开封箱。",
    secretKnown: false,
    secret: "箱中另藏一份旧军牒。",
    brief: "十四日内送抵襄阳。",
    ...overrides,
  };
}

function incident(complication: ContractComplication, roles: CrewRole[] = [], overrides: Partial<Contract> = {}, supplies = 8, silver = 80): TravelEvent | null {
  return contractIncidentEvent({
    day: 4,
    routeId: "linan-jiankang",
    routeName: "江南东路",
    contract: testContract(complication, overrides),
    crewRoles: roles,
    stance: "steady",
    upgrades: [],
    supplies,
    silver,
  });
}

function stagedIncident(complication: ContractComplication, crewIds?: string[], overrides: Partial<Contract> = {}): GameState {
  const contract = testContract(complication, overrides);
  const base = { ...createInitialGame(1208), contracts: [contract], supplies: 12, silver: 100 };
  const planning = acceptContract(base, contract.id);
  const travel = chooseRoute(planning, planning.journey!.plan);
  const journey = { ...travel.journey!, crewIds: crewIds ?? travel.journey!.crewIds };
  const routeId = journey.plan.routeIds[0];
  const roles = journey.crewIds.flatMap((id) => {
    const member = travel.crew.find((item) => item.id === id && item.hp > 0);
    return member ? [member.role] : [];
  });
  const event = contractIncidentEvent({
    day: travel.day,
    routeId,
    routeName: routeById(routeId).name,
    contract: journey.contract,
    crewRoles: roles,
    stance: journey.stance,
    upgrades: travel.convoy.upgrades,
    supplies: travel.supplies,
    silver: travel.silver,
  });
  return { ...travel, phase: "event", journey, currentEvent: event };
}

describe("镖物异动", () => {
  it("让五种隐藏麻烦各自生成不同的途中抉择，普通镖则不会强行生成", () => {
    const complications: ContractComplication[] = ["fragile", "military", "wanted", "contraband", "double_deal"];
    const events = complications.map((value) => incident(value));
    expect(events.every(Boolean)).toBe(true);
    expect(new Set(events.map((event) => event?.title)).size).toBe(complications.length);
    expect(events.every((event) => event?.kind === "intrigue" && event.choices.length === 3)).toBe(true);
    expect(incident("none")).toBeNull();
  });

  it("把职司、底细与资源真正用于解锁对策", () => {
    expect(incident("fragile")?.choices.find((choice) => choice.id === "intrigue-secure")?.hint).toContain("消耗 1 份补给");
    expect(incident("fragile", ["车把式"])?.choices.find((choice) => choice.id === "intrigue-secure")?.hint).toContain("不耗补给");
    expect(incident("military")?.choices.find((choice) => choice.id === "intrigue-papers")?.disabled).toBe(true);
    expect(incident("military", ["账房"])?.choices.find((choice) => choice.id === "intrigue-papers")?.disabled).toBe(false);
    expect(incident("contraband", [], {}, 8, 9)?.choices.find((choice) => choice.id === "intrigue-bribe")?.disabled).toBe(true);
    expect(incident("double_deal", [], { secretKnown: true })?.choices.find((choice) => choice.id === "intrigue-counterseal")?.disabled).toBe(false);
  });

  it("车把式可无耗加固脆弱镖，硬赶则会真实损伤镖物", () => {
    const withCarter = stagedIncident("fragile", ["he-sheng"]);
    const secured = resolveEvent(withCarter, "intrigue-secure");
    expect(secured.supplies).toBe(withCarter.supplies);
    expect(secured.convoy.cargoIntegrity).toBe(100);
    expect(secured.news.some((line) => line.includes("镖物异动"))).toBe(true);

    const withoutSpecialist = stagedIncident("fragile", ["lu-cang"]);
    const paid = resolveEvent(withoutSpecialist, "intrigue-secure");
    expect(paid.supplies).toBe(withoutSpecialist.supplies - 1);
    const pressed = resolveEvent(stagedIncident("fragile", ["lu-cang"]), "intrigue-press");
    expect(pressed.convoy.cargoIntegrity).toBeLessThan(100);
  });

  it("识破伪札会揭开镖物底细并积累信用", () => {
    const staged = stagedIncident("double_deal", ["shen-yan"]);
    const resolved = resolveEvent(staged, "intrigue-counterseal");
    expect(resolved.reputation).toBe(staged.reputation + 1);
    expect(resolved.journey?.contract.secretKnown).toBe(true);
  });

  it("拒绝军中征发可直接进入自动护车战", () => {
    const staged = stagedIncident("military", ["lu-cang"]);
    const fighting = resolveEvent(staged, "fight");
    expect(fighting.phase).toBe("battle");
    expect(fighting.pendingBattle).not.toBeNull();
  });
});
