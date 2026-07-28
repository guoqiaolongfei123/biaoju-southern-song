import type { Settlement } from "../core/types";

export default function SettlementFinanceLedger({ settlement }: { settlement: Settlement }) {
  const finance = settlement.finance;
  if (!finance) return null;
  return <section className={`settlement-finance ${finance.netChange >= 0 ? "is-profit" : "is-loss"}`} aria-label="本趟实际收支">
    <header><i>账</i><span><small>从接镖到收队 · 实际银钱</small><b>本趟收支簿</b></span><strong>{finance.netChange >= 0 ? "净增" : "净减"} {Math.abs(finance.netChange)} 两</strong></header>
    <div>
      <span><small>开旗现银</small><b>{finance.openingSilver}</b></span>
      <span className={finance.enRouteCashChange < 0 ? "is-debit" : "is-credit"}><small>{finance.enRouteCashChange < 0 ? "途中盘缠" : "途中进项"}</small><b>{finance.enRouteCashChange >= 0 ? "+" : ""}{finance.enRouteCashChange}</b></span>
      <span className="is-credit"><small>核定镖酬</small><b>+{finance.grossReward}</b></span>
      <span className="is-debit"><small>随行脚钱</small><b>-{finance.crewWages}</b></span>
      {finance.tradeRevenue > 0 && <span className="is-credit"><small>副货回银</small><b>+{finance.tradeRevenue}</b></span>}
      {finance.compensation > 0 && <span className="is-debit"><small>{settlement.outcome === "transfer" ? "同行接手费" : "失约赔付"}</small><b>-{finance.compensation}</b></span>}
      <span className="is-total"><small>收队现银</small><b>{finance.closingSilver}</b></span>
    </div>
    <p>途中盘缠按实际余额反推，已包含行装、买报、补粮、马料、过关与临事处置；副队归款等同期进项也会如实计入。</p>
  </section>;
}
