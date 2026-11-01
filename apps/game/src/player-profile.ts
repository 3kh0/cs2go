export type SteamProfile = {
  steamId: string;
  name: string;
  avatar: string | null;
  publicAvatar?: string | null;
  profileUrl: string;
};
let profile: SteamProfile | null = null;
export const playerProfile = () => profile;
export const playerAvatar = () => profile?.avatar || null;
export const playerName = () => profile?.name || "YOU";
export function setPlayerProfile(value: SteamProfile | null) {
  profile = value;
  window.dispatchEvent(new Event("cs2go-profile-change"));
  document.getElementById("home-player-name")!.textContent = value?.name || "PLAYER";
  const avatar = document.getElementById("steam-avatar") as HTMLImageElement;
  avatar.hidden = !value?.avatar;
  if (value?.avatar) avatar.src = value.avatar;
  else avatar.removeAttribute("src");
  document.getElementById("steam-account-label")!.textContent = value ? "STEAM" : "SIGN IN";
  document.getElementById("steam-account-button")!.title = value
    ? `${value.name} - Steam account`
    : "Sign in with Steam";
}
