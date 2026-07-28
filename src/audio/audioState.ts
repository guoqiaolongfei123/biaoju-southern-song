import type { GamePhase, GameState } from "../core/types";

export type AudioScene = "title" | "setup" | "map" | "travel" | "event" | "battle" | "settlement" | "gameover";
export type AudioCue = "ui" | "city" | "day" | "departure" | "alert" | "battle" | "return" | "settlement" | "ending-win" | "ending-loss";

export interface AudioSettings {
  enabled: boolean;
  volume: number;
}

export interface AudioSnapshot {
  scene: AudioScene;
  phase: GamePhase | null;
  day: number;
  selectedCityId: string | null;
  eventId: string | null;
  endingId: string | null;
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = { enabled: true, volume: .52 };

export function normalizeAudioSettings(raw: unknown): AudioSettings {
  if (!raw || typeof raw !== "object") return DEFAULT_AUDIO_SETTINGS;
  const candidate = raw as Partial<AudioSettings>;
  return {
    enabled: typeof candidate.enabled === "boolean" ? candidate.enabled : DEFAULT_AUDIO_SETTINGS.enabled,
    volume: Math.max(.12, Math.min(.8, typeof candidate.volume === "number" ? candidate.volume : DEFAULT_AUDIO_SETTINGS.volume)),
  };
}

function sceneForPhase(phase: GamePhase): AudioScene {
  if (phase === "planning" || phase === "map") return "map";
  return phase;
}

export function createAudioSnapshot(
  launch: "loading" | "title" | "setup" | "game",
  game: GameState | null,
  battlePreviewActive = false,
): AudioSnapshot {
  if (battlePreviewActive) return { scene: "battle", phase: "battle", day: 0, selectedCityId: null, eventId: null, endingId: null };
  const phase = launch === "game" && game ? game.phase : null;
  return {
    scene: phase ? sceneForPhase(phase) : launch === "setup" ? "setup" : "title",
    phase,
    day: game?.day ?? 0,
    selectedCityId: game?.selectedCityId ?? null,
    eventId: game?.currentEvent?.id ?? null,
    endingId: game?.career.endingId ?? null,
  };
}

export function audioCuesForTransition(previous: AudioSnapshot | null, next: AudioSnapshot): AudioCue[] {
  if (!previous) return [];
  const cues: AudioCue[] = [];
  if (previous.scene !== next.scene) {
    if (next.scene === "battle") cues.push("battle");
    else if (previous.scene === "battle") cues.push("return");
    else if (next.scene === "settlement") cues.push("settlement");
    else if (next.scene === "gameover") cues.push(next.endingId === "great-escort" ? "ending-win" : "ending-loss");
    else if (next.scene === "travel") cues.push("departure");
    else if (next.scene === "event") cues.push("alert");
  }
  if (next.day > previous.day && !cues.includes("settlement") && !cues.includes("ending-win") && !cues.includes("ending-loss")) cues.push("day");
  if (next.scene === "map" && previous.scene === "map" && next.selectedCityId !== previous.selectedCityId) cues.push("city");
  return cues.slice(0, 2);
}
