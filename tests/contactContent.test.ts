import { describe, expect, it } from "vitest";
import { acceptContract, callInContactFavor, contactFavorOffer, contractNegotiationOffer, createInitialGame, negotiateContract } from "../src/core/game";
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
    expect(hydrated?.version).toBe(26);
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

  it("熟客会回到本城镖榜，并可用人情择一改约后随镖单启程", () => {
    const game = createInitialGame(1107);
    const contact = game.contacts[0];
    const contract = game.contracts.find((item) => item.client === contact.name);
    expect(contract).toBeTruthy();
    expect(contract?.patron).toBe(contact.patron);

    const offer = contractNegotiationOffer(game, contract!.id);
    expect(offer).toMatchObject({ completed: false, tierLabel: "熟面" });
    expect(offer?.options.map((option) => option.id)).toEqual(["higher-reward", "extended-deadline", "reduced-penalty"]);
    const originalReward = contract!.reward;
    const changed = negotiateContract(game, contract!.id, "higher-reward");
    const changedContract = changed.contracts.find((item) => item.id === contract!.id)!;
    expect(changedContract.reward).toBe(Math.round(originalReward * 1.12));
    expect(changedContract.negotiation).toMatchObject({ id: "higher-reward", favorCost: 6, before: originalReward, after: changedContract.reward });
    expect(changed.contacts[0].favor).toBe(contact.favor - 6);
    expect(contractNegotiationOffer(changed, contract!.id)).toMatchObject({ completed: true, options: [] });
    expect(negotiateContract(changed, contract!.id, "extended-deadline")).toBe(changed);

    const accepted = acceptContract(changed, contract!.id);
    expect(accepted.phase).toBe("planning");
    expect(accepted.journey?.contract.negotiation).toEqual(changedContract.negotiation);
    expect(accepted.journey?.contract.reward).toBe(changedContract.reward);
  });

  it("宽限与减赔会修改真实条款，未到熟面则不能改约", () => {
    const base = createInitialGame(1107);
    const contact = base.contacts[0];
    const contract = base.contracts.find((item) => item.client === contact.name)!;
    const widened = negotiateContract(base, contract.id, "extended-deadline");
    const widenedContract = widened.contracts.find((item) => item.id === contract.id)!;
    expect(widenedContract.deadline).toBe(contract.deadline + 2);
    expect(widenedContract.brief.startsWith(`${contract.deadline + 2}日内`)).toBe(true);
    expect(widened.contacts[0].favor).toBe(contact.favor - 5);

    const reduced = negotiateContract(createInitialGame(1107), contract.id, "reduced-penalty");
    const reducedContract = reduced.contracts.find((item) => item.id === contract.id)!;
    expect(reducedContract.failurePenalty).toBe(Math.max(1, Math.round(contract.failurePenalty * .75)));
    expect(reduced.contacts[0].favor).toBe(contact.favor - 4);

    const unfamiliar = { ...base, contacts: base.contacts.map((item) => ({ ...item, favor: 9 })) };
    expect(contractNegotiationOffer(unfamiliar, contract.id)).toBeNull();
    expect(negotiateContract(unfamiliar, contract.id, "higher-reward")).toBe(unfamiliar);
  });

  it("旧档会保留合法改约印记并剔除损坏数据", () => {
    const base = createInitialGame(1107);
    const contract = base.contracts.find((item) => item.client === base.contacts[0].name)!;
    const negotiated = negotiateContract(base, contract.id, "higher-reward");
    const migrated = migrateSavedGame({ ...negotiated, version: 23 });
    expect(migrated?.version).toBe(26);
    expect(migrated?.contracts.find((item) => item.id === contract.id)?.negotiation).toEqual(
      negotiated.contracts.find((item) => item.id === contract.id)?.negotiation,
    );

    const broken = migrateSavedGame({
      ...base,
      version: 23,
      contracts: base.contracts.map((item) => item.id === contract.id ? { ...item, negotiation: { id: "invented", contactId: 7 } } : item),
    });
    expect(broken?.contracts.find((item) => item.id === contract.id)?.negotiation).toBeUndefined();
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
