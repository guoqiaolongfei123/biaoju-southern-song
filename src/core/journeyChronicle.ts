import type { JourneyChronicleEntry, JourneyChronicleKind, JourneyChronicleTone, JourneyState } from "./types";

export const JOURNEY_CHRONICLE_LIMIT = 18;

const KINDS = new Set<JourneyChronicleKind>(["contract", "departure", "road", "event", "battle", "route", "arrival"]);
const TONES = new Set<JourneyChronicleTone>(["ink", "good", "risk", "danger"]);

function cleanText(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 180) : fallback;
}

export function normalizeJourneyChronicle(value: unknown): JourneyChronicleEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const source = item as Record<string, unknown>;
    const kind = typeof source.kind === "string" && KINDS.has(source.kind as JourneyChronicleKind)
      ? source.kind as JourneyChronicleKind
      : "event";
    const tone = typeof source.tone === "string" && TONES.has(source.tone as JourneyChronicleTone)
      ? source.tone as JourneyChronicleTone
      : "ink";
    const day = typeof source.day === "number" && Number.isFinite(source.day) ? Math.max(1, Math.floor(source.day)) : 1;
    return [{
      id: cleanText(source.id, `旧记-${day}-${index}`),
      day,
      kind,
      tone,
      seal: cleanText(source.seal, "记").slice(0, 2),
      title: cleanText(source.title, "旧途留记"),
      detail: cleanText(source.detail, "这条旧记录没有留下更多细节。"),
      routeId: typeof source.routeId === "string" ? source.routeId : undefined,
      cityId: typeof source.cityId === "string" ? source.cityId : undefined,
    } satisfies JourneyChronicleEntry];
  }).slice(-JOURNEY_CHRONICLE_LIMIT);
}

export function appendJourneyChronicle(journey: JourneyState, entry: JourneyChronicleEntry): JourneyState {
  const chronicle = normalizeJourneyChronicle(journey.chronicle);
  let uniqueId = entry.id;
  let suffix = 1;
  while (chronicle.some((item) => item.id === uniqueId)) {
    uniqueId = `${entry.id}-${entry.day}-${suffix}`;
    suffix += 1;
  }
  return {
    ...journey,
    chronicle: [...chronicle, { ...entry, id: uniqueId }].slice(-JOURNEY_CHRONICLE_LIMIT),
  };
}

export function chronicleToneForChoice(tone: "safe" | "risk" | "danger" | undefined): JourneyChronicleTone {
  return tone === "safe" ? "good" : tone === "danger" ? "danger" : tone === "risk" ? "risk" : "ink";
}

export function chronicleSealForEvent(kind: string): string {
  return ({
    border: "关",
    bandits: "匪",
    storm: "雨",
    refugees: "民",
    breakdown: "车",
    rumor: "报",
    roadblock: "阻",
    waystation: "驿",
    handoff: "交",
    caravan: "旗",
    intrigue: "疑",
  } as Record<string, string>)[kind] ?? "记";
}
