import { describe, expect, it } from "vitest";
import { createInitialGame } from "../src/core/game";
import { audioCuesForTransition, createAudioSnapshot, normalizeAudioSettings } from "../src/audio/audioState";

describe("游戏听觉场景", () => {
  it("把经营、旅途、事件与战斗映射成互不混杂的声音场景", () => {
    const game = createInitialGame(1208);
    expect(createAudioSnapshot("title", null).scene).toBe("title");
    expect(createAudioSnapshot("setup", null).scene).toBe("setup");
    expect(createAudioSnapshot("game", { ...game, phase: "planning" }).scene).toBe("map");
    expect(createAudioSnapshot("game", { ...game, phase: "travel" }).scene).toBe("travel");
    expect(createAudioSnapshot("game", { ...game, phase: "event" }).scene).toBe("event");
    expect(createAudioSnapshot("game", { ...game, phase: "settlement" }).scene).toBe("settlement");
    expect(createAudioSnapshot("loading", null, true).scene).toBe("battle");
  });

  it("只在有意义的状态变化时发出转场提示", () => {
    const game = createInitialGame(1208);
    const map = createAudioSnapshot("game", game);
    const travel = createAudioSnapshot("game", { ...game, phase: "travel" });
    const event = createAudioSnapshot("game", { ...game, phase: "event", currentEvent: { id: "rain", kind: "storm", eyebrow: "风雨", title: "雨脚压路", description: "试音", choices: [] } });
    const battle = createAudioSnapshot("game", { ...game, phase: "battle" });
    const settlement = createAudioSnapshot("game", { ...game, phase: "settlement" });
    expect(audioCuesForTransition(map, travel)).toEqual(["departure"]);
    expect(audioCuesForTransition(travel, event)).toEqual(["alert"]);
    expect(audioCuesForTransition(event, battle)).toEqual(["battle"]);
    expect(audioCuesForTransition(battle, settlement)).toEqual(["return"]);
    expect(audioCuesForTransition(map, map)).toEqual([]);
  });

  it("日期与城市选择提供轻提示，但不会覆盖结算和结局主提示", () => {
    const game = createInitialGame(1208);
    const map = createAudioSnapshot("game", game);
    const nextDay = createAudioSnapshot("game", { ...game, day: game.day + 1 });
    const selected = createAudioSnapshot("game", { ...game, selectedCityId: "jiankang" });
    const win = createAudioSnapshot("game", { ...game, phase: "gameover", career: { ...game.career, endingId: "great-escort" } });
    const loss = createAudioSnapshot("game", { ...game, phase: "gameover", career: { ...game.career, endingId: "credit-collapse" } });
    expect(audioCuesForTransition(map, nextDay)).toEqual(["day"]);
    expect(audioCuesForTransition(map, selected)).toEqual(["city"]);
    expect(audioCuesForTransition(map, win)).toEqual(["ending-win"]);
    expect(audioCuesForTransition(map, loss)).toEqual(["ending-loss"]);
  });

  it("把损坏的本地音量设置收敛到安全范围", () => {
    expect(normalizeAudioSettings(null)).toEqual({ enabled: true, volume: .52 });
    expect(normalizeAudioSettings({ enabled: false, volume: 8 })).toEqual({ enabled: false, volume: .8 });
    expect(normalizeAudioSettings({ enabled: true, volume: 0 })).toEqual({ enabled: true, volume: .12 });
  });
});
