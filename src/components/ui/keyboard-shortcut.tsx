import { Fragment } from "react/jsx-runtime";

const SHORTCUT_KEY_MAP = {
  Meta: "⌘",
  Shift: "⇧Shift",
  Alt: "⌥Alt",
  Control: "Ctrl",
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
} as Record<string, string>;

export function KeyboardShortcutKey(props: {
  shortcut: string[];
  useShortKeys?: boolean;
}) {
  const { shortcut, useShortKeys } = props;

  return (
    <div className="hidden shrink-0 items-center md:flex">
      {shortcut.map((key, idx, keys) => (
        <Fragment key={idx}>
          <kbd className="relative z-10 flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md border border-b-4 border-neutral-400 bg-neutral-100 px-2 text-xs text-black">
            {SHORTCUT_KEY_MAP[key]
              ? useShortKeys
                ? SHORTCUT_KEY_MAP[key][0]
                : SHORTCUT_KEY_MAP[key]
              : key}
          </kbd>
          {idx !== keys.length - 1 && (
            <span className="px-1 text-zinc-300/60"> + </span>
          )}
        </Fragment>
      ))}
    </div>
  );
}
