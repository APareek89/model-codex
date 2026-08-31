import type { DesktopApi } from "../types";

declare global {
  interface Window {
    modelCodex: DesktopApi;
  }
}

export {};
