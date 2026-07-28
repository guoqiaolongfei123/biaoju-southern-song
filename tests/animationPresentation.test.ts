import { describe, expect, it } from "vitest";
import { battleCoreComboTiming, battleDefeatPose, battleHitPose, shouldReduceBattleMotion } from "../src/battle/animationPresentation";
import { battleCoreFocusMomentDetail, battleCoreFocusVisual } from "../src/battle/coreFocusPresentation";

describe("battle animation presentation", () => {
  it("makes an experienced, bonded command pair strike in a tighter rhythm", () => {
    const novice = battleCoreComboTiming(0, 0, 0);
    const veterans = battleCoreComboTiming(12, 12, 9);

    expect(veterans.approachMs).toBeLessThan(novice.approachMs);
    expect(veterans.strikeGapMs).toBeLessThan(novice.strikeGapMs);
    expect(veterans.cameraZoom).toBeGreaterThan(novice.cameraZoom);
    expect(veterans.impactMs).toBe(novice.impactMs);
  });

  it("collapses nonessential combo motion when reduced motion is requested", () => {
    expect(battleCoreComboTiming(20, 20, 20, true)).toEqual({
      approachMs: 0,
      strikeGapMs: 0,
      impactMs: 0,
      settleMs: 260,
      cameraZoom: 1,
    });
    expect(shouldReduceBattleMotion("?reduced-motion=1", false)).toBe(true);
  });

  it("gives each command-pair path a distinct weapon language, palette, and camera rhythm", () => {
    const paired = battleCoreFocusVisual("paired-assault");
    const guard = battleCoreFocusVisual("cross-guard");
    const hunt = battleCoreFocusVisual("leader-hunt");
    expect([paired.choreography, guard.choreography, hunt.choreography]).toEqual(["cross", "ward", "hunt"]);
    expect(new Set([paired.primary, guard.primary, hunt.primary]).size).toBe(3);
    expect(guard.cameraShake).toBeLessThan(paired.cameraShake);
    expect(hunt.cameraShake).toBeGreaterThan(paired.cameraShake);

    const pairedTiming = battleCoreComboTiming(12, 12, 9, false, "paired-assault", 18);
    const guardTiming = battleCoreComboTiming(12, 12, 9, false, "cross-guard", 18);
    const huntTiming = battleCoreComboTiming(12, 12, 9, false, "leader-hunt", 18);
    expect(pairedTiming.strikeGapMs).toBeLessThan(guardTiming.strikeGapMs);
    expect(guardTiming.impactMs).toBeGreaterThan(huntTiming.impactMs);
    expect(huntTiming.cameraZoom).toBeGreaterThan(guardTiming.cameraZoom);
    expect(battleCoreFocusMomentDetail("leader-hunt", 28)).toContain("锁定匪首");
  });

  it("keeps hit and defeat poses finite at their boundaries", () => {
    expect(battleHitPose(0, 1)).toMatchObject({ strength: 0, scaleX: 1, scaleY: 1 });
    expect(battleDefeatPose(99, -1, "leader")).toMatchObject({ progress: 1, alpha: .22 });
  });
});
