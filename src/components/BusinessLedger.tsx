import { businessLedgerSummary } from "../core/businessLedger";
import { cityById, routeById } from "../core/data";
import type { BusinessRecord, GameState } from "../core/types";

const KIND_LABEL: Record<BusinessRecord["contractKind"], string> = {
  cargo: "货镖",
  letter: "信镖",
  escort: "活镖",
  special: "特镖",
};

const OUTCOME_LABEL: Record<BusinessRecord["outcome"], string> = {
  delivery: "照约交割",
  transfer: "同行转托",
  return: "退回原主",
  abandon: "认赔收旗",
};

function signedSilver(value: number): string {
  return `${value >= 0 ? "+" : "−"}${Math.abs(value)} 两`;
}

export default function BusinessLedger({ game }: { game: GameState }) {
  const records = game.businessLedger ?? [];
  const summary = businessLedgerSummary(records);
  return <section className="business-ledger" aria-label="柜上总账">
    <header>
      <i>账</i>
      <span><small>主旗经营 · 最近十二趟</small><b>柜上总账</b><p>按真实现银记账，可回看哪类镖、哪条路与哪种收队方式真正有利可图。</p></span>
      <strong className={summary.totalNet < 0 ? "is-loss" : ""}><small>累计净银</small>{signedSilver(summary.totalNet)}</strong>
    </header>
    {records.length ? <>
      <dl className="business-ledger-summary">
        <div><dt>留档镖程</dt><dd>{summary.completed} 趟</dd></div>
        <div><dt>照约交割</dt><dd>{summary.delivered}／{summary.completed}</dd></div>
        <div><dt>有利可图</dt><dd>{summary.profitable} 趟</dd></div>
        <div><dt>平均净银</dt><dd className={summary.averageNet < 0 ? "is-loss" : ""}>{signedSilver(summary.averageNet)}</dd></div>
      </dl>
      {summary.bestRecord && <div className="business-ledger-best"><i>佳</i><span><small>账上最佳</small><b>{summary.bestRecord.title}</b><em>{cityById(summary.bestRecord.fromCityId).name}至{cityById(summary.bestRecord.toCityId).name} · 净增 {summary.bestRecord.finance.netChange} 两</em></span></div>}
      <div className="business-ledger-records">
        {records.map((record) => {
          const routeNames = record.routeIds.map((id) => routeById(id).name);
          const finance = record.finance;
          return <article key={record.id} className={`outcome-${record.outcome} ${finance.netChange < 0 ? "is-loss" : "is-profit"}`}>
            <i className="business-grade">{record.grade}</i>
            <div className="business-record-main">
              <small>第 {record.startedDay}—{record.closedDay} 日 · {KIND_LABEL[record.contractKind]} · {OUTCOME_LABEL[record.outcome]}</small>
              <b>{record.title}</b>
              <em>{cityById(record.fromCityId).name} → {cityById(record.toCityId).name} · {record.durationDays} 日 · {record.routeIds.length} 段路</em>
            </div>
            <strong><small>本趟净银</small>{signedSilver(finance.netChange)}</strong>
            <div className="business-record-cash">
              <span><small>途中变化</small><b>{signedSilver(finance.enRouteCashChange)}</b></span>
              <span><small>实收镖酬</small><b>+{finance.contractReward}</b></span>
              {finance.tradeRevenue > 0 && <span><small>副货回银</small><b>+{finance.tradeRevenue}</b></span>}
              {finance.compensation > 0 && <span><small>赔付／接手</small><b>−{finance.compensation}</b></span>}
              <span><small>货信完整</small><b>{record.cargoIntegrity}%{record.sealIntact ? " · 印全" : " · 破印"}</b></span>
              {record.battlesWon > 0 && <span><small>胜阵</small><b>{record.battlesWon} 场</b></span>}
            </div>
            <p>{routeNames.length ? routeNames.join(" → ") : "未留完整路簿名目"}</p>
          </article>;
        })}
      </div>
    </> : <div className="business-ledger-empty"><i>空</i><span><b>柜上尚无已结镖程</b><p>完成第一趟主旗委托后，这里会留下路线、耗时、真实收支与交割结果。</p></span></div>}
  </section>;
}
