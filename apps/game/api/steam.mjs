import { steamNodeHandler } from "../steam-auth.mjs";

export default steamNodeHandler({
  secret: process.env.STEAM_SESSION_SECRET,
  origin: process.env.STEAM_ORIGIN,
});
