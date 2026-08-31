import type { ReactNode } from "react";

export type IconName =
  | "agent" | "api" | "arrow" | "attach" | "back" | "branch" | "check"
  | "chevron" | "clock" | "close" | "folder" | "forward" | "globe" | "help"
  | "history" | "layout" | "mic" | "model" | "more" | "new" | "plus"
  | "search" | "send" | "spark" | "stop" | "tools" | "trash";

const paths: Record<IconName, ReactNode> = {
  agent: <><circle cx="12" cy="8" r="3"/><path d="M6.5 20v-2a5.5 5.5 0 0 1 11 0v2"/><path d="m18.5 5 1-2 1 2 2 1-2 1-1 2-1-2-2-1z"/></>,
  api: <><path d="M8 8H5a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h3"/><path d="M16 8h3a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-3"/><path d="M8 12h8"/></>,
  arrow: <><path d="M12 19V5"/><path d="m6.5 10.5 5.5-5.5 5.5 5.5"/></>,
  attach: <path d="m20.5 11.5-8.8 8.8a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 1 1-2.8-2.8l8.5-8.5"/>,
  back: <path d="m15 18-6-6 6-6"/>,
  branch: <><circle cx="7" cy="5" r="2"/><circle cx="17" cy="7" r="2"/><circle cx="7" cy="19" r="2"/><path d="M7 7v10M9 9c4 0 6-2 6-2"/></>,
  check: <path d="m5 12 4 4 10-10"/>,
  chevron: <path d="m8 10 4 4 4-4"/>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  close: <><path d="M6 6l12 12"/><path d="M18 6 6 18"/></>,
  folder: <path d="M3.5 7.5h6l2-2h9v13h-17z"/>,
  forward: <path d="m9 18 6-6-6-6"/>,
  globe: <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></>,
  help: <><circle cx="12" cy="12" r="9"/><path d="M9.7 9a2.5 2.5 0 1 1 3.7 2.2c-1 .6-1.4 1.1-1.4 2.3"/><path d="M12 17h.01"/></>,
  history: <><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 7v5l3 2"/></>,
  layout: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/></>,
  mic: <><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></>,
  model: <><path d="M4 7h10M18 7h2"/><circle cx="16" cy="7" r="2"/><path d="M4 17h2M10 17h10"/><circle cx="8" cy="17" r="2"/></>,
  more: <><circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="19" cy="12" r="1" fill="currentColor"/></>,
  new: <><path d="M5 4h9l5 5v11H5z"/><path d="M14 4v5h5M8 15h8M12 11v8"/></>,
  plus: <><path d="M12 5v14"/><path d="M5 12h14"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></>,
  send: <><path d="M12 19V5"/><path d="m6.5 10.5 5.5-5.5 5.5 5.5"/></>,
  spark: <><path d="m12 3 1.4 4.1 4.1 1.4-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4z"/><path d="m18 14 .8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8z"/></>,
  stop: <rect x="7" y="7" width="10" height="10" rx="2"/>,
  tools: <><path d="m14.7 6.3 3-3a4 4 0 0 1-5 5l-7.8 7.8a2.1 2.1 0 0 0 3 3l7.8-7.8a4 4 0 0 0 5-5l-3 3"/></>,
  trash: <><path d="M4 7h16M9 7V4h6v3"/><path d="m7 7 1 13h8l1-13"/></>,
};

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}
