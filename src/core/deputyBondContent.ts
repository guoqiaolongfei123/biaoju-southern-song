export interface DeputyBondRank {
  label: "初识" | "相知" | "同心" | "托命";
  level: number;
  seal: string;
  nextAt: number | null;
  comboDamageBonus: number;
  cooldownReduction: number;
}

export function deputyBondRank(experience: number): DeputyBondRank {
  const safe = Math.max(0, Math.floor(experience));
  if (safe >= 12) return { label: "托命", level: 3, seal: "托", nextAt: null, comboDamageBonus: .14, cooldownReduction: .16 };
  if (safe >= 7) return { label: "同心", level: 2, seal: "同", nextAt: 12, comboDamageBonus: .09, cooldownReduction: .11 };
  if (safe >= 3) return { label: "相知", level: 1, seal: "知", nextAt: 7, comboDamageBonus: .04, cooldownReduction: .06 };
  return { label: "初识", level: 0, seal: "识", nextAt: 3, comboDamageBonus: 0, cooldownReduction: 0 };
}

export function deputyBondGain(comboCount: number): number {
  const safe = Math.max(0, Math.floor(comboCount));
  return 1 + Number(safe >= 1) + Number(safe >= 3);
}

export function normalizeDeputyBonds(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).flatMap(([id, experience]) => (
    id && typeof experience === "number" && Number.isFinite(experience)
      ? [[id, Math.max(0, Math.floor(experience))]]
      : []
  )));
}
