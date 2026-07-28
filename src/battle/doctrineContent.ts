export type BattleDoctrineId = "goose-vanguard" | "iron-ring" | "crescent-snare";

export interface BattleDoctrine {
  id: BattleDoctrineId;
  seal: string;
  title: string;
  subtitle: string;
  effect: string;
  risk: string;
  color: string;
  modifiers: {
    playerSpeed: number;
    guardSpeed: number;
    guardDamage: number;
    convoyDamage: number;
    cartSpeed: number;
    guardStun: number;
    techniqueCooldown: number;
  };
}

export const BATTLE_DOCTRINES: Record<BattleDoctrineId, BattleDoctrine> = {
  "goose-vanguard": {
    id: "goose-vanguard",
    seal: "锋",
    title: "雁行争锋",
    subtitle: "快手越阵，镖头居锋",
    effect: "移速 +14% · 攻势 +12% · 车速 +10%",
    risk: "车马承伤 +10%",
    color: "#d98556",
    modifiers: { playerSpeed: 1.1, guardSpeed: 1.14, guardDamage: 1.12, convoyDamage: 1.1, cartSpeed: 1.1, guardStun: 0, techniqueCooldown: 1 },
  },
  "iron-ring": {
    id: "iron-ring",
    seal: "垒",
    title: "铁桶护镖",
    subtitle: "三人合环，寸步护车",
    effect: "车马承伤 -22% · 贴阵护卫",
    risk: "人手移速 -6% · 车速 -10%",
    color: "#7fa58a",
    modifiers: { playerSpeed: .96, guardSpeed: .94, guardDamage: .98, convoyDamage: .78, cartSpeed: .9, guardStun: 0, techniqueCooldown: 1 },
  },
  "crescent-snare": {
    id: "crescent-snare",
    seal: "缠",
    title: "偃月钩连",
    subtitle: "两翼牵制，留招制敌",
    effect: "命中阻敌 · 绝技回转 +20%",
    risk: "镖师攻势 -8%",
    color: "#809b83",
    modifiers: { playerSpeed: 1.02, guardSpeed: 1.05, guardDamage: .92, convoyDamage: 1, cartSpeed: 1, guardStun: .32, techniqueCooldown: .8 },
  },
};

export const BATTLE_DOCTRINE_LIST = Object.values(BATTLE_DOCTRINES);

export const STANDARD_BATTLE_MODIFIERS: BattleDoctrine["modifiers"] = {
  playerSpeed: 1,
  guardSpeed: 1,
  guardDamage: 1,
  convoyDamage: 1,
  cartSpeed: 1,
  guardStun: 0,
  techniqueCooldown: 1,
};

export function battleDoctrine(id: BattleDoctrineId | null | undefined): BattleDoctrine | null {
  return id ? BATTLE_DOCTRINES[id] : null;
}
