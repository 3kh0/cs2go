import type { SteamItem } from "./src/steam-inventory";
export type SteamInventorySnapshot = {
  items: SteamItem[];
  reportedTotal: number;
  syncedAt: number;
};
export function steamInventoryPage(data: unknown): {
  items: SteamItem[];
  reportedTotal: number;
  cursor: string | null;
};
export function importSteamInventory(pages: unknown[], syncedAt?: number): SteamInventorySnapshot;
