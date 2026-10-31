export type SteamHandlerOptions = {
  secret?: string;
  origin?: string;
  fetcher?: (input: string | URL, init?: RequestInit) => Promise<Response>;
  now?: () => number;
};
export function createSteamHandler(
  options?: SteamHandlerOptions,
): (request: Request) => Promise<Response>;
export function steamAuthPlugin(): import("vite").Plugin;
