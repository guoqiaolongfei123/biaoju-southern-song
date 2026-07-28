import { normalizeJourneyChronicle } from "../core/journeyChronicle";
import type { JourneyState } from "../core/types";

interface JourneyChronicleProps {
  journey: JourneyState;
  limit?: number;
  paper?: boolean;
}

export default function JourneyChronicle({ journey, limit = 4, paper = false }: JourneyChronicleProps) {
  const allEntries = normalizeJourneyChronicle(journey.chronicle);
  const recentEntries = allEntries.slice(-limit);
  const entries = paper ? recentEntries : recentEntries.reverse();
  if (!entries.length) return null;

  return (
    <section className={`journey-chronicle${paper ? " is-paper" : ""}`} aria-label="本趟镖行纪">
      <header>
        <span><small>本趟决策与后果</small><b>镖行纪</b></span>
        <em>第 {journey.startedDay} 日起 · 共 {allEntries.length} 记</em>
      </header>
      <ol>
        {entries.map((entry) => (
          <li key={entry.id} className={`tone-${entry.tone}`}>
            <time>第{entry.day}日</time>
            <i>{entry.seal}</i>
            <span><b>{entry.title}</b><small>{entry.detail}</small></span>
          </li>
        ))}
      </ol>
    </section>
  );
}
