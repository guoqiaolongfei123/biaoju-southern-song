import { useMemo } from "react";
import { crewRank } from "../core/crewContent";
import { EQUIPMENT_LIST, MAX_EQUIPMENT_TUNING, SLOT_LABEL, equipmentDisplayName, equipmentEffectSummary, equipmentStats, equipmentTuningGrade, equipmentTuningLevel, equippedCount } from "../core/equipmentContent";
import { BATTLE_FORMATION_IDS, FORMATION_PROFICIENCIES, formationProficiencyRank, normalizeFormationExperience } from "../core/formationProficiency";
import { crewTrainingCost, equipCrewItem, equipmentPurchaseCost, equipmentTuningCost, purchaseEquipment, setMartialArt, trainCrew, tuneEquipment, unequipCrewItem } from "../core/game";
import { crewInjuryById } from "../core/injuryContent";
import { PLAYER_LEADER_ID } from "../core/leaderContent";
import { MARTIAL_ART_LIST, martialArtById } from "../core/martialContent";
import { martialProficiencyEffectSummary, martialProficiencyRank } from "../core/martialProficiencyContent";
import { deputyBondRank } from "../core/deputyBondContent";
import type { EquipmentSlot, GameState } from "../core/types";
import CoreCombatFocusPicker from "./CoreCombatFocusPicker";

export default function LeaderProgressionPanel({ game, onChange }: { game: GameState; onChange: (game: GameState) => void }) {
  const leader = game.leader;
  const rank = crewRank(leader.experience);
  const loadout = game.crewEquipment[PLAYER_LEADER_ID] ?? {};
  const stats = useMemo(() => equipmentStats(loadout, game.equipmentTuning), [loadout, game.equipmentTuning]);
  const trainingCost = crewTrainingCost(game, PLAYER_LEADER_ID);
  const formationExperience = normalizeFormationExperience(leader.formationExperience);
  const martialArt = martialArtById(game.martialArtId);
  const injury = crewInjuryById(leader.injury?.id);
  const deputies = game.crew.filter((member) => member.role === "副镖头");

  return <section className="equipment-panel leader-progression-panel" aria-label="主角总镖头养成与装备">
    <div className="leader-progression-heading">
      <i>主</i>
      <span><small>主角 · 总镖头 · 第一战力</small><b>{leader.name}</b><em>字{leader.courtesy} · {rank.label} · 阅历 {leader.experience}{rank.nextAt ? ` / ${rank.nextAt}` : " · 已臻名手"}</em></span>
      <strong><small>{martialArt.school}</small><b>{martialArt.name}</b><em>绝技「{martialArt.technique}」自动择机</em></strong>
    </div>
    {injury && <div className={`leader-injury-state severity-${injury.severity}`} aria-label={`总镖头伤势 ${injury.name}`}>
      <i>{injury.seal}</i><span><small>主角持续伤势 · 体魄 {game.convoy.leaderHp}/100</small><b>{injury.name}</b><em>{injury.description} · {injury.effect}</em></span><strong>尚需 {leader.injury?.remainingDays ?? injury.recoveryDays} 日</strong>
    </div>}
    <div className="equipment-progress leader-combat-progress">
      <div><small>主战成长优先</small><b>基础战力 +{Math.round(rank.battleBonus * 100)}%　装备攻势 +{Math.round(stats.powerBonus * 100)}%</b><span>当前体魄 {game.convoy.leaderHp}/100 · 装备体魄 +{stats.maxHpBonus}{injury ? ` · ${injury.name}正在影响战斗与行程` : " · 状态完好"}</span></div>
      <button disabled={game.silver < trainingCost} onClick={() => onChange(trainCrew(game, PLAYER_LEADER_ID))}>{game.silver < trainingCost ? `尚缺 ${trainingCost - game.silver} 两` : `亲自演武 · ${trainingCost} 两`}</button>
    </div>
    <div className="leader-chapter-heading" id="leader-martial-growth">
      <i>壹</i><span><small>第一章 · 主角战斗成长</small><b>主战修习</b><em>先定武学，再定总镖头亲自承担的战场职责</em></span><strong>武学 · 路数</strong>
    </div>
    <div className="leader-martial-proficiencies" aria-label="总镖头武学熟练">
      <header><span><small>主角专属成长 · 各门独立</small><b>武学得法</b></span><em>绝技自动施展后积累本门武历</em></header>
      <div>{MARTIAL_ART_LIST.map((art) => {
        const experience = leader.martialExperience[art.id];
        const proficiency = martialProficiencyRank(experience);
        const previousAt = proficiency.level === 0 ? 0 : proficiency.level === 1 ? 3 : proficiency.level === 2 ? 8 : 15;
        const progress = proficiency.nextAt ? Math.min(100, Math.round((experience - previousAt) / (proficiency.nextAt - previousAt) * 100)) : 100;
        const active = game.martialArtId === art.id;
        return <button key={art.id} className={`martial-${art.id}${active ? " is-active" : ""}`} aria-pressed={active} onClick={() => onChange(setMartialArt(game, art.id))}>
          <i>{art.seal}</i><span><small>{art.school} · {active ? "当前主修" : "可改习"}</small><b>{art.name}</b><em>{proficiency.label} · 武历 {experience}{proficiency.nextAt ? ` / ${proficiency.nextAt}` : " · 已臻宗成"}</em></span>
          <strong>{martialProficiencyEffectSummary(art.id, experience)}</strong>
          <u aria-label={`${art.name}熟练进度 ${progress}%`}><ins style={{ width: `${progress}%` }} /></u>
        </button>;
      })}</div>
    </div>
    <CoreCombatFocusPicker game={game} onChange={onChange} />
    <div className="leader-chapter-heading" id="leader-command-growth">
      <i>贰</i><span><small>第二章 · 双核心与阵令成长</small><b>搭档与阵法</b><em>主副镖头的默契、截锋与阵历在这里汇总</em></span><strong>主副 · 三阵</strong>
    </div>
    <div className="leader-deputy-bonds" aria-label="主角与副镖头默契成长">
      <header><span><small>双核心成长 · 各自累积</small><b>主副默契</b></span><em>并肩出战与自动合击会提升默契</em></header>
      <div>{deputies.length ? deputies.map((deputy) => {
        const experience = leader.deputyBonds[deputy.id] ?? 0;
        const bond = deputyBondRank(experience);
        const previousAt = bond.level === 0 ? 0 : bond.level === 1 ? 3 : bond.level === 2 ? 7 : 12;
        const progress = bond.nextAt ? Math.min(100, Math.round((experience - previousAt) / (bond.nextAt - previousAt) * 100)) : 100;
        const active = game.activeCrewIds.includes(deputy.id) || game.journey?.crewIds.includes(deputy.id);
        return <article key={deputy.id} className={`${active ? "is-active " : ""}bond-level-${bond.level}`}>
          <i>{bond.seal}</i><span><small>{active ? "本趟主战搭档" : "副镖头"}</small><b>{leader.name} × {deputy.name}</b><em>{bond.label} · 默契 {experience}{bond.nextAt ? ` / ${bond.nextAt}` : " · 已臻托命"}</em></span>
          <strong>合击 +{Math.round(bond.comboDamageBonus * 100)}%<small>回转 -{Math.round(bond.cooldownReduction * 100)}%</small></strong>
          <div aria-label={`${deputy.name}主副默契进度 ${progress}%`}><u style={{ width: `${progress}%` }} /></div>
        </article>;
      }) : <p>局中尚无副镖头；延请一位主战副手后，便会单独积累主副默契。</p>}</div>
    </div>
    <div className="formation-proficiency leader-formations">
      <header><span><small>主战核心 · 阵令亲历</small><b>总镖头三阵习练</b></span><em>主用阵每战获得双倍阵历</em></header>
      <div>{BATTLE_FORMATION_IDS.map((formationId) => {
        const definition = FORMATION_PROFICIENCIES[formationId];
        const experience = formationExperience[formationId];
        const proficiency = formationProficiencyRank(experience);
        const previousAt = proficiency.level === 0 ? 0 : proficiency.level === 1 ? 3 : proficiency.level === 2 ? 7 : 12;
        const progress = proficiency.nextAt ? Math.min(100, Math.round((experience - previousAt) / (proficiency.nextAt - previousAt) * 100)) : 100;
        return <article key={formationId} className={`formation-level-${proficiency.level}`}><i>{definition.seal}</i><span><b>{definition.name}</b><small>{definition.motto}</small><em>{proficiency.label} · 阵历 {experience}{proficiency.nextAt ? ` / ${proficiency.nextAt}` : " · 已臻化境"}</em></span><strong>阵中 +{Math.round(proficiency.bonus * 100)}%</strong><div aria-label={`${definition.name}熟练进度 ${progress}%`}><u style={{ width: `${progress}%` }} /></div></article>;
      })}</div>
    </div>
    <div className="leader-chapter-heading leader-equipment-heading" id="leader-loadout">
      <i>叁</i><span><small>第三章 · 随身兵甲与谱样</small><b>总镖头行装</b><em>当前装备、候选器械、完整效果与操作按槽位归档</em></span><strong>兵刃 · 护具 · 行具</strong>
    </div>
    <div className="equipment-slots leader-equipment-slots">
      {(["weapon", "armor", "tool"] as EquipmentSlot[]).map((slot) => {
        const currentId = loadout[slot];
        const current = currentId ? EQUIPMENT_LIST.find((item) => item.id === currentId) : undefined;
        const currentTuning = current ? equipmentTuningLevel(game.equipmentTuning[current.id]) : 0;
        return <article key={slot} className={`leader-equipment-slot slot-${slot}`}>
          <header><span>{SLOT_LABEL[slot]}</span>{current ? <button onClick={() => onChange(unequipCrewItem(game, PLAYER_LEADER_ID, slot))}>卸下</button> : <i>空位</i>}</header>
          <div className={`equipped-item tuning-${currentTuning}`}>{current ? <><i>{current.seal}</i><span><b>{equipmentDisplayName(current, currentTuning)}</b><small>{current.description}</small><em>当前谱样 · {equipmentTuningGrade(currentTuning)} · {equipmentEffectSummary(current, currentTuning)}</em></span></> : <p>尚未配备{SLOT_LABEL[slot]}</p>}</div>
          <div className="equipment-shelf-heading"><span>候选与谱样</span><small>来源、完整效果与操作均直接显示</small></div>
          <div className="equipment-shelf">{EQUIPMENT_LIST.filter((item) => item.slot === slot).map((item) => {
            const isCurrent = currentId === item.id;
            const free = Math.max(0, (game.equipmentStock[item.id] ?? 0) - equippedCount(game.crewEquipment, item.id, PLAYER_LEADER_ID));
            const locked = rank.level < item.requiredRank;
            const price = equipmentPurchaseCost(game, item.id);
            const tuningLevel = equipmentTuningLevel(game.equipmentTuning[item.id]);
            const tuningCost = equipmentTuningCost(game, item.id);
            const owned = (game.equipmentStock[item.id] ?? 0) > 0;
            return <div key={item.id} className={`${isCurrent ? "is-equipped " : locked ? "is-locked " : ""}rarity-${item.rarity ?? "ordinary"} tuning-${tuningLevel}`}>
              <i>{item.seal}</i><span><b>{item.name}{tuningLevel > 0 && <mark className="tuning-mark">{equipmentTuningGrade(tuningLevel)}</mark>}</b><small>{locked ? `需${["新手", "熟手", "老手", "名手"][item.requiredRank]}` : isCurrent ? "主角正在使用" : free > 0 ? `架上可用 ${free}` : item.source === "journey" ? `${item.origin ?? "护镖所得"} · 尚未获得` : `器械铺 ${price} 两`}</small><em className="item-effect">{equipmentEffectSummary(item, tuningLevel)}</em></span>
              <div className="equipment-item-actions">{isCurrent ? <em>已配</em> : free > 0 ? <button disabled={locked} onClick={() => onChange(equipCrewItem(game, PLAYER_LEADER_ID, item.id))}>装备</button> : item.source === "journey" ? <button disabled>胜阵寻得</button> : <button disabled={locked || game.silver < price} onClick={() => onChange(purchaseEquipment(game, item.id))}>购入</button>}{owned && tuningLevel < MAX_EQUIPMENT_TUNING ? <button className="tuning-button" disabled={game.silver < tuningCost} onClick={() => onChange(tuneEquipment(game, item.id))}>{game.silver < tuningCost ? `缺 ${tuningCost - game.silver} 两` : `精校 ${tuningCost} 两`}</button> : owned && <strong>名匠谱样</strong>}</div>
            </div>;
          })}</div>
        </article>;
      })}
    </div>
  </section>;
}
