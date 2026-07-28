import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameState } from "../core/types";
import { audioDirector } from "./audioDirector";
import { audioCuesForTransition, createAudioSnapshot, normalizeAudioSettings, type AudioSettings } from "./audioState";

const AUDIO_SETTINGS_KEY = "biaoju-audio-v1";

function loadAudioSettings(): AudioSettings {
  if (typeof window === "undefined") return normalizeAudioSettings(null);
  try { return normalizeAudioSettings(JSON.parse(window.localStorage.getItem(AUDIO_SETTINGS_KEY) ?? "null")); }
  catch { return normalizeAudioSettings(null); }
}

export function useGameAudio(options: {
  launch: "loading" | "title" | "setup" | "game";
  game: GameState | null;
  battlePreviewActive?: boolean;
}) {
  const [settings, setSettings] = useState<AudioSettings>(loadAudioSettings);
  const snapshot = useMemo(
    () => createAudioSnapshot(options.launch, options.game, options.battlePreviewActive),
    [options.launch, options.game?.phase, options.game?.day, options.game?.selectedCityId, options.game?.currentEvent?.id, options.game?.career.endingId, options.battlePreviewActive],
  );
  const previousSnapshot = useRef<typeof snapshot | null>(null);

  useEffect(() => {
    audioDirector.configure(settings);
    try { window.localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(settings)); } catch { /* storage unavailable */ }
  }, [settings]);

  useEffect(() => {
    audioDirector.setScene(snapshot.scene);
    for (const cue of audioCuesForTransition(previousSnapshot.current, snapshot)) audioDirector.playCue(cue);
    previousSnapshot.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    if (!settings.enabled) return;
    const unlock = () => { void audioDirector.unlock(); };
    window.addEventListener("pointerdown", unlock, { capture: true, once: true });
    window.addEventListener("keydown", unlock, { capture: true, once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock, true);
      window.removeEventListener("keydown", unlock, true);
    };
  }, [settings.enabled]);

  useEffect(() => {
    const click = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (target?.closest("button:not(:disabled), [role='button']:not([aria-disabled='true'])")) audioDirector.playCue("ui");
    };
    window.addEventListener("pointerup", click, true);
    return () => window.removeEventListener("pointerup", click, true);
  }, []);

  useEffect(() => {
    const visibility = () => { void audioDirector.setSuspended(document.hidden); };
    document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  }, []);

  const toggle = useCallback(() => {
    setSettings((current) => {
      const next = { ...current, enabled: !current.enabled };
      audioDirector.configure(next);
      if (next.enabled) void audioDirector.unlock();
      return next;
    });
  }, []);

  return { enabled: settings.enabled, toggle };
}
