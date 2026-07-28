import { describe, expect, it } from "vitest";
import { callInContactFavor, contactFavorOffer, createInitialGame } from "../src/core/game";
import { contactFavorTier, contactId, normalizeContacts, settleContractContact } from "../src/core/contactContent";
import { ROUTES } from "../src/core/data";
import { migrateSavedGame } from "../src/core/save";
import type { Contract, ContractPatron, GameState, LocalContact } from "../src/core/types";

function localContact(game: GameState, patron: ContractPatron, favor = 20): LocalContact {
  const name = `${patron}测试旧识`;
  return {
    id: contactId(game.currentCityId, patron, name),
    name,
    patron,
    homeCityId: game.currentCityId,
    favor,
    completedJobs: 2,
    failedJobs: 0,
    lastDay: game.day,
    lastCalledDay: -99,
    lastNote: "旧日往来。",
  };
}

describe("委托人人情", () => {
  it("人情阶位有稳定阈值，旧档缺字段时会补上出身旧识", () => {
    expect([0, 10, 25, 45].map((favor) => contactFavorTier(favor).label)).toEqual(["初识", "熟面", "相托", "深交"]);
    const migrated = normalizeContacts(undefined, "xiangyang-veterans");
    expect(migrated).toHaveLength(1);
    expect(migrated[0]).toMatchObject({ name: "京湖制置司故吏", homeCityId: "xiangyang", patron: "official", favor: 14 });
    const oldSave = { ...createInitialGame(1107, "quanzhou-merchants"), version: 22, contacts: undefined };
    const hydrated = migrateSavedGame(oldSave);
    expect(hydrated?.version).toBe(23);
    expect(hydrated?.contacts[0]).toMatchObject({ name: "四海茶行", homeCityId: "quanzhou", favor: 14 });
  });

  it("甲乙丙与失镖会留下不同的人情和成败履历", () => {
    const base = createInitialGame(1107);
    const contract: Contract = { ...base.contracts[0], id: "contact-grade", client: "试镖牙人", patron: "merchant" };
    const gradeA = settleContractContact([], contract, "甲", 8);
    expect(gradeA.contact).toMatchObject({ favor: 12, completedJobs: 1, failedJobs: 0, lastDay: 8 });
    const gradeB = settleContractContact(gradeA.contacts, contract, "乙", 12);
    expect(gradeB.contact.favor).toBe(19);
    const gradeC = settleContractContact(gradeB.contacts, contract, "丙", 16);
    expect(gradeC.contact.favor).toBe(21);
    const failed = settleContractContact(gradeC.contacts, contract, "失镖", 20);
    expect(failed.contact).toMatchObject({ favor: 13, completedJobs: 3, failedJobs: 1 });
  });

  it("商帮请托会消耗人情补粮，并受七日冷却约束", () => {
    let game = createInitialGame(1107);
    const contact = localContact(game, "merchant");
    game = { ...game, contacts: [contact], supplies: 9 };
    expect(contactFavorOffer(game, contact.id)).toMatchObject({ enabled: true, cost: 8, cooldownDays: 0 });
    const used = callInContactFavor(game, contact.id);
    expect(used.supplies).toBe(14);
    expect(used.contacts[0]).toMatchObject({ favor: 12, lastCalledDay: 1 });
    expect(contactFavorOffer(used, contact.id)).toMatchObject({ enabled: false, cooldownDays: 7 });
    expect(callInContactFavor(used, contact.id)).toBe(used);
    expect(contactFavorOffer({ ...used, day: 8 }, contact.id)?.enabled).toBe(true);
  });

  it("官府、江湖、寺观和异邦请托分别影响路引、路报、伤员与行粮", () => {
    const officialBase = createInitialGame(1107, "xiangyang-veterans");
    const official = localContact(officialBase, "official");
    const withPermit = callInContactFavor({ ...officialBase, contacts: [official] }, official.id);
    expect(withPermit.travelPermits.song).toBe(6);

    const jianghuBase = createInitialGame(1107);
    const jianghu = localContact(jianghuBase, "jianghu");
    const staleIntel = Object.fromEntries(Object.entries(jianghuBase.routeIntel).map(([id, intel]) => [id, { ...intel, surveyedDay: -20 }]));
    const scouted = callInContactFavor({ ...jianghuBase, contacts: [jianghu], routeIntel: staleIntel }, jianghu.id);
    const localRoutes = ROUTES.filter((route) => route.from === "linan" || route.to === "linan");
    expect(localRoutes.every((route) => scouted.routeIntel[route.id].surveyedDay === jianghuBase.day)).toBe(true);

    const templeBase = createInitialGame(1107);
    const temple = localContact(templeBase, "temple");
    const wounded = {
      ...templeBase,
      contacts: [temple],
      convoy: { ...templeBase.convoy, leaderHp: 40, morale: 50 },
      crew: templeBase.crew.map((member) => ({ ...member, hp: Math.min(member.hp, 30) })),
    };
    const rested = callInContactFavor(wounded, temple.id);
    expect(rested.convoy).toMatchObject({ leaderHp: 64, morale: 57 });
    expect(rested.crew.every((member) => member.hp > wounded.crew.find((old) => old.id === member.id)!.hp)).toBe(true);

    const foreignBase = createInitialGame(1107);
    const foreign = localContact(foreignBase, "foreign");
    const introduced = callInContactFavor({ ...foreignBase, contacts: [foreign], supplies: 7 }, foreign.id);
    expect(introduced.supplies).toBe(10);
    expect(introduced.travelPermits.song).toBe(4);
  });
});
