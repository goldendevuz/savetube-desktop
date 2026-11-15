import type { ReactNode } from "react";

interface HomeFeedMessageProps {
  title: string;
  body: string;
  action?: ReactNode;
  /** What is hiding videos, when the page is empty because of the viewer's own filters. */
  details?: { title: string; items: string[]; hint: string };
}

/** A whole-page state of Home: disabled, empty or failed. */
export function HomeFeedMessage({ title, body, action, details }: HomeFeedMessageProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-chrome-zinc-800 bg-chrome-zinc-900/10 p-8 py-24 text-center">
      <div>
        <h3 className="font-bold text-chrome-zinc-300">{title}</h3>
        <p className="mt-1 max-w-sm text-xs text-chrome-zinc-500">{body}</p>
      </div>
      {details && details.items.length > 0 && (
        <div className="max-w-md text-left text-xs text-chrome-zinc-400">
          <p className="mb-1 font-semibold text-chrome-zinc-300">{details.title}</p>
          <ul className="list-disc space-y-0.5 pl-5">
            {details.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="mt-2 text-chrome-zinc-500">{details.hint}</p>
        </div>
      )}
      {action}
    </div>
  );
}
