import { getString } from "../../lib/i18n/index";
import { useSessionStore } from "../../store/useSessionStore";

/** How long it has been playing since the last break of five minutes, shown once it is a minute or more. */
export function SessionChip() {
  const minutes = useSessionStore((s) => Math.floor(s.sessionMs / 60_000));
  if (minutes < 1) return null;
  return (
    <div
      title={getString("session_title")}
      className="whitespace-nowrap rounded-full bg-chrome-black/20 px-2 py-1 text-xs font-semibold tabular-nums text-chrome-zinc-400"
    >
      {getString("session_chip", minutes)}
    </div>
  );
}
