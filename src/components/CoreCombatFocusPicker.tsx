import { CORE_COMBAT_FOCUS_LIST, coreCombatFocusEffectSummary, coreCombatFocusRank } from "../core/coreCombatFocusContent";
import { setCoreCombatFocus } from "../core/game";
import type { GameState } from "../core/types";

function focusProgress(experience: number): number {
  const rank = coreCombatFocusRank(experience);
  if (!rank.nextAt) return 100;
  const previousAt = rank.level === 0 ? 0 : rank.level === 1 ? 4 : rank.level === 2 ? 10 : 18;
  return Math.min(100, Math.round((experience - previousAt) / (rank.nextAt - previousAt) * 100));
}

export default function CoreCombatFocusPicker({ game, onChange, compact = false }: { game: GameState; onChange: (game: GameState) => void; compact?: boolean }) {
  const activeIds = game.journey?.crewIds.length ? game.journey.crewIds : game.activeCrewIds;
  const deputy = activeIds.map((id) => game.crew.find((member) => member.id === id)).find((member) => member?.role === "副镖头");
  const canChange = game.phase === "map" || game.phase === "planning";

  return <section className={`core-combat-focus${compact ? " is-compact" : ""}`} aria-label="主角与副镖头双核心战斗专精">
    <header>
      <span><small>总镖头 × 副镖头 · 长期主战养成</small><b>双核心武路</b></span>
      <em>{deputy ? `${game.leader.name}与${deputy.name}依此自动出招` : "选入副镖头后组成双核心"}</em>
    </header>
    <div className="core-combat-focus-grid">{CORE_COMBAT_FOCUS_LIST.map((focus) => {
      const experience = game.leader.coreCombatExperience[focus.id];
      const rank = coreCombatFocusRank(experience);
      const active = game.leader.coreCombatFocusId === focus.id;
      const progress = focusProgress(experience);
      return <button
        key={focus.id}
        className={`${active ? "is-selected " : ""}focus-level-${rank.level}`}
        aria-pressed={active}
        disabled={!canChange}
        onClick={() => onChange(setCoreCombatFocus(game, focus.id))}
      >
        <i>{focus.seal}</i>
        <span><small>{focus.motto}</small><b>{focus.name}</b><em>{rank.label} · 武路 {experience}{rank.nextAt ? ` / ${rank.nextAt}` : " · 已臻合璧"}</em></span>
        <strong>{active ? "本趟主修" : "改习此路"}<small>{coreCombatFocusEffectSummary(focus.id, experience)}</small></strong>
        <u aria-label={`${focus.name}进度 ${progress}%`}><ins style={{ width: `${progress}%` }} /></u>
      </button>;
    })}</div>
    {!compact && <p><b>只定策略，不按招式：</b>战中两位核心会按所选武路自行锁敌、合击与截锋；战后各武路独立积累，切换不会丢失已练成的专精。</p>}
  </section>;
}
