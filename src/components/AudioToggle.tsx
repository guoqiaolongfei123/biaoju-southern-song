interface AudioToggleProps {
  enabled: boolean;
  onToggle: () => void;
  floating?: boolean;
}

export default function AudioToggle({ enabled, onToggle, floating = false }: AudioToggleProps) {
  return (
    <button
      className={`icon-button audio-toggle ${floating ? "is-floating" : ""} ${enabled ? "is-audible" : "is-muted"}`}
      type="button"
      aria-pressed={enabled}
      aria-label={enabled ? "关闭游戏声音" : "开启游戏声音"}
      title={enabled ? "声音已开 · 点击静音" : "声音已静 · 点击开启"}
      onClick={onToggle}
    >
      <span aria-hidden="true">{enabled ? "声" : "静"}</span>
    </button>
  );
}
