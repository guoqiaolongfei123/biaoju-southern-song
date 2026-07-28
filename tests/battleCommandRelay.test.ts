import { describe, expect, it } from "vitest";
import {
  advanceBattleCommand,
  battleCommandRelayDuration,
  battleCommandRelayProgress,
  createBattleCommandRelay,
  issueBattleCommand,
} from "../src/battle/commandRelay";

describe("阵令传达", () => {
  it("阵令先进入传达状态，走完时长后才真正换阵", () => {
    const issued = issueBattleCommand(createBattleCommandRelay(), "guard-horses", .5);
    expect(issued.active).toBe("balanced");
    expect(issued.pending).toBe("guard-horses");

    const halfway = advanceBattleCommand(issued, .25);
    expect(halfway.committed).toBeNull();
    expect(halfway.state.active).toBe("balanced");
    expect(battleCommandRelayProgress(halfway.state)).toBeCloseTo(.5);

    const arrived = advanceBattleCommand(halfway.state, .25);
    expect(arrived.committed).toBe("guard-horses");
    expect(arrived.state.active).toBe("guard-horses");
    expect(arrived.state.pending).toBeNull();
  });

  it("新阵令会替换尚未送达的旧令，重选当前阵令则取消传达", () => {
    const first = issueBattleCommand(createBattleCommandRelay(), "guard-cart", .55);
    const progressed = advanceBattleCommand(first, .3).state;
    const replaced = issueBattleCommand(progressed, "breakthrough", .48);
    expect(replaced.pending).toBe("breakthrough");
    expect(replaced.elapsed).toBe(0);
    expect(replaced.serial).toBe(2);

    const cancelled = issueBattleCommand(replaced, "balanced", .48);
    expect(cancelled.active).toBe("balanced");
    expect(cancelled.pending).toBeNull();
  });

  it("传令绝活、策应战职与高士气会缩短全队响应时间", () => {
    const ordinary = battleCommandRelayDuration({ guardCount: 4, morale: 52, hasDeputyCommand: false, responderCount: 0 });
    const trained = battleCommandRelayDuration({ guardCount: 4, morale: 78, hasDeputyCommand: true, responderCount: 1 });
    expect(trained).toBeLessThan(ordinary);
    expect(trained).toBeGreaterThanOrEqual(.36);
    expect(ordinary).toBeLessThanOrEqual(.78);
  });
});
