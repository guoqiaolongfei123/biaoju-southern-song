import { useEffect, useMemo, useState } from "react";
import { crewRank } from "../core/crewContent";
import { EQUIPMENT_LIST, MAX_EQUIPMENT_TUNING, SLOT_LABEL, equipmentDisplayName, equipmentEffectSummary, equipmentStats, equipmentTuningGrade, equipmentTuningLevel, equippedCount } from "../core/equipmentContent";
import { CREW_DISCIPLINE_LIST } from "../core/crewDisciplineContent";
import { crewInjuryById } from "../core/injuryContent";
import { crewMasteryForRole } from "../core/crewMasteryContent";
import { BATTLE_FORMATION_IDS, FORMATION_PROFICIENCIES, formationProficiencyRank, normalizeFormationExperience } from "../core/formationProficiency";
import { crewDisciplineChangeCost, crewTrainingCost, equipCrewItem, equipmentPurchaseCost, equipmentTuningCost, purchaseEquipment, setCrewDiscipline, trainCrew, tuneEquipment, unequipCrewItem } from "../core/game";
import type { EquipmentSlot, GameState } from "../core/types";

export default function CrewEquipmentPanel({ game, onChange }: { game: GameState; onChange: (game: GameState) => void }) {
  const [selectedCrewId, setSelectedCrewId] = useState(game.crew[0]?.id ?? "");
  useEffect(() => {
    if (!game.crew.some((member) => member.id === selectedCrewId)) setSelectedCrewId(game.crew[0]?.id ?? "");
  }, [game.crew, selectedCrewId]);
  const member = game.crew.find((item) => item.id === selectedCrewId) ?? game.crew[0];
  const rank = crewRank(member?.experience ?? 0);
  const loadout = member ? game.crewEquipment[member.id] ?? {} : {};
  const stats = useMemo(() => equipmentStats(loadout, game.equipmentTuning), [loadout, game.equipmentTuning]);
  if (!member) return null;
  const trainingCost = crewTrainingCost(game, member.id);
  const disciplineChangeCost = crewDisciplineChangeCost(game, member.id);
  const injury = crewInjuryById(member.injury?.id);
  const mastery = crewMasteryForRole(member.role, rank.level);
  const masteryPreview = crewMasteryForRole(member.role, 2)!;
  const formationExperience = normalizeFormationExperience(member.formationExperience);

  return (
    <section className="equipment-panel" aria-label="镖师养成与装备">
      <div className="equipment-heading">
        <span><small>演武点将 · 器械架</small><b>人物养成</b></span>
        <p>装备归镖局所有，可在出发前自由调配；器械铺还能精校同式谱样，使已配与后续购入的同式器械一并受益。</p>
      </div>
      <div className="equipment-crew-tabs" role="tablist" aria-label="选择镖师">
        {game.crew.map((item) => <button key={item.id} className={item.id === member.id ? "is-active" : ""} onClick={() => setSelectedCrewId(item.id)}><i>{item.name.slice(0, 1)}</i><span><b>{item.name}</b><small>{item.role} · {crewRank(item.experience).label}</small></span></button>)}
      </div>
      <div className="equipment-progress">
        <div>
          <small>{member.role === "副镖头" ? "主战副手 · 第二战力" : "专业随员 · 自动司职"} · 字{member.courtesy} · {member.specialty}</small>
          <b>{rank.label}镖师 · 阅历 {member.experience}{rank.nextAt ? ` / ${rank.nextAt}` : " · 已臻名手"}</b>
          <span>基础战力加成 +{Math.round(rank.battleBonus * 100)}%　装备攻势 +{Math.round(stats.powerBonus * 100)}%　装备体魄 +{stats.maxHpBonus}</span>
        </div>
        <button disabled={game.silver < trainingCost} onClick={() => onChange(trainCrew(game, member.id))}>{game.silver < trainingCost ? `尚缺 ${trainingCost - game.silver} 两` : `演武增阅历 · ${trainingCost} 两`}</button>
      </div>
      {injury && member.injury && <div className={`crew-injury-slip severity-${injury.severity}`}>
        <i>{injury.seal}</i>
        <span><small>名册验伤 · 尚需休养 {member.injury.remainingDays} 日</small><b>{injury.name}</b><em>{injury.description}</em></span>
        <strong>{injury.effect}</strong>
      </div>}
      <div className={`crew-mastery-slip${mastery ? " is-unlocked" : " is-locked"}`}>
        <i>{masteryPreview.seal}</i>
        <span><small>{mastery ? "老手绝活 · 自动应对已生效" : `老手绝活 · 还需 ${Math.max(0, 7 - member.experience)} 点阅历`}</small><b>{masteryPreview.name}</b><em>{masteryPreview.description}</em></span>
        <strong>{mastery ? mastery.effect : "阅历达到 7 后自动领悟"}</strong>
      </div>
      <div className="formation-proficiency">
        <header><span><small>随阵历练 · 自动作战熟练</small><b>三阵习练</b></span><em>{member.role === "副镖头" ? "主用阵每战获得双倍阵历" : "随主阵积累一份阵历"}</em></header>
        <div>
          {BATTLE_FORMATION_IDS.map((formationId) => {
            const definition = FORMATION_PROFICIENCIES[formationId];
            const experience = formationExperience[formationId];
            const proficiency = formationProficiencyRank(experience);
            const previousAt = proficiency.level === 0 ? 0 : proficiency.level === 1 ? 3 : proficiency.level === 2 ? 7 : 12;
            const progress = proficiency.nextAt ? Math.min(100, Math.round((experience - previousAt) / (proficiency.nextAt - previousAt) * 100)) : 100;
            return <article key={formationId} className={`formation-level-${proficiency.level}`}>
              <i>{definition.seal}</i>
              <span><b>{definition.name}</b><small>{definition.motto}</small><em>{proficiency.label} · 阵历 {experience}{proficiency.nextAt ? ` / ${proficiency.nextAt}` : " · 已臻化境"}</em></span>
              <strong>阵中效用 +{Math.round(proficiency.bonus * 100)}%</strong>
              <div aria-label={`${definition.name}熟练进度 ${progress}%`}><u style={{ width: `${progress}%` }} /></div>
            </article>;
          })}
        </div>
      </div>
      <div className={`crew-discipline${rank.level < 1 ? " is-locked" : ""}`}>
        <header>
          <span><small>熟手定职 · 自动作战倾向</small><b>{member.disciplineId ? "战职已立，可付银改习" : rank.level < 1 ? "再历练至熟手即可定职" : "请选择一门战职"}</b></span>
          <em>{member.disciplineId ? `改习 ${disciplineChangeCost} 两` : "初定免费"}</em>
        </header>
        <div>
          {CREW_DISCIPLINE_LIST.map((discipline) => {
            const selected = member.disciplineId === discipline.id;
            const disabled = rank.level < 1 || selected || game.silver < disciplineChangeCost;
            return <button key={discipline.id} className={selected ? "is-selected" : ""} disabled={disabled} onClick={() => onChange(setCrewDiscipline(game, member.id, discipline.id))}>
              <i>{discipline.seal}</i>
              <span><b>{discipline.name}</b><small>{discipline.motto}</small><em>{discipline.effect}</em></span>
              <strong>{selected ? "已定" : rank.level < 1 ? "熟手解锁" : disciplineChangeCost > 0 ? `${disciplineChangeCost} 两改习` : "定此战职"}</strong>
            </button>;
          })}
        </div>
      </div>
      <div className="equipment-workshop-note">
        <i>作</i><span><small>器械铺 · 制式谱样</small><b>修整、精校、名匠三阶</b><em>每阶强化原有攻势、体魄、减伤与护车护马效用；弩、药、钩、牌的自动动作也会更快更强。</em></span><strong>同式全局生效</strong>
      </div>
      <div className="equipment-slots">
        {(["weapon", "armor", "tool"] as EquipmentSlot[]).map((slot) => {
          const currentId = loadout[slot];
          const current = currentId ? EQUIPMENT_LIST.find((item) => item.id === currentId) : undefined;
          const currentTuning = current ? equipmentTuningLevel(game.equipmentTuning[current.id]) : 0;
          return <article key={slot}>
            <header><span>{SLOT_LABEL[slot]}</span>{current ? <button onClick={() => onChange(unequipCrewItem(game, member.id, slot))}>卸下</button> : <i>空位</i>}</header>
            <div className={`equipped-item tuning-${currentTuning}`}>{current ? <><i>{current.seal}</i><span><b>{equipmentDisplayName(current, currentTuning)}</b><small>{current.description}</small><em>当前谱样 · {equipmentTuningGrade(currentTuning)} · {equipmentEffectSummary(current, currentTuning)}</em></span></> : <p>尚未配备{SLOT_LABEL[slot]}</p>}</div>
            <div className="equipment-shelf">
              {EQUIPMENT_LIST.filter((item) => item.slot === slot).map((item) => {
                const isCurrent = currentId === item.id;
                const free = Math.max(0, (game.equipmentStock[item.id] ?? 0) - equippedCount(game.crewEquipment, item.id, member.id));
                const locked = rank.level < item.requiredRank;
                const price = equipmentPurchaseCost(game, item.id);
                const tuningLevel = equipmentTuningLevel(game.equipmentTuning[item.id]);
                const tuningCost = equipmentTuningCost(game, item.id);
                const owned = (game.equipmentStock[item.id] ?? 0) > 0;
                return <div key={item.id} className={`${isCurrent ? "is-equipped " : locked ? "is-locked " : ""}rarity-${item.rarity ?? "ordinary"} tuning-${tuningLevel}`} title={item.description}>
                  <i>{item.seal}</i><span><b>{item.name}{tuningLevel > 0 && <mark className="tuning-mark">{equipmentTuningGrade(tuningLevel)}</mark>}{item.source === "journey" && <mark title={item.origin}>胜阵</mark>}</b><small>{locked ? `需${["新手", "熟手", "老手", "名手"][item.requiredRank]}` : isCurrent ? "正在使用" : free > 0 ? `架上可用 ${free}` : item.source === "journey" ? `${item.origin ?? "护镖所得"} · 尚未获得` : `器械铺 ${price} 两`}</small><em className="item-effect">{equipmentEffectSummary(item, tuningLevel)}</em></span>
                  <div className="equipment-item-actions">
                    {isCurrent ? <em>已配</em> : free > 0 ? <button disabled={locked} onClick={() => onChange(equipCrewItem(game, member.id, item.id))}>配备</button> : item.source === "journey" ? <button disabled>胜阵寻得</button> : <button disabled={locked || game.silver < price} onClick={() => onChange(purchaseEquipment(game, item.id))}>购入</button>}
                    {owned && tuningLevel < MAX_EQUIPMENT_TUNING ? <button className="tuning-button" disabled={game.silver < tuningCost} onClick={() => onChange(tuneEquipment(game, item.id))}>{game.silver < tuningCost ? `缺 ${tuningCost - game.silver} 两` : `精校 ${tuningCost} 两`}</button> : owned && <strong>名匠谱样</strong>}
                  </div>
                </div>;
              })}
            </div>
          </article>;
        })}
      </div>
    </section>
  );
}
