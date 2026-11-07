import { resolve } from "node:path";
import { createSteamHandler } from "./steam-auth.mjs";

/** Serve only the built client tree, with the same Steam endpoint as Vercel. */
export async function startClientServer({
  port = Number(process.env.PORT ?? 3000),
  hostname = "0.0.0.0",
  directory = resolve(import.meta.dir, "dist"),
  steamOrigin = process.env.STEAM_ORIGIN,
  secret = process.env.STEAM_SESSION_SECRET,
} = {}) {
  const files = new Map();
  for await (const path of new Bun.Glob("**/*").scan({ cwd: directory, onlyFiles: true }))
    files.set(`/${path}`, Bun.file(resolve(directory, path)));
  if (!files.has("/index.html")) throw new Error("Build the client before starting its server.");
  const steam = createSteamHandler({ origin: steamOrigin, secret });
  return Bun.serve({
    port,
    hostname,
    fetch(request) {
      const url = new URL(request.url);
      if (url.pathname === "/api/steam") {
        // The configured public origin is trusted; arbitrary proxy headers are not.
        const target = steamOrigin ? new URL(url.pathname + url.search, steamOrigin) : url;
        return steam(new Request(target, request));
      }
      if (request.method !== "GET" && request.method !== "HEAD")
        return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
      if (url.pathname === "/healthz") return Response.json({ ok: true });
      const file = files.get(url.pathname === "/" ? "/index.html" : url.pathname);
      if (!file) return new Response("Not found", { status: 404 });
      return new Response(request.method === "HEAD" ? null : file, {
        headers: {
          "Content-Type": file.type,
          "Content-Length": String(file.size),
          "Cache-Control": url.pathname.startsWith("/assets/")
            ? "public, max-age=31536000, immutable"
            : "no-cache, must-revalidate",
          "X-Content-Type-Options": "nosniff",
        },
      });
    },
  });
}

if (import.meta.main) {
  const server = await startClientServer();
  console.log(`CS2GO client listening on port ${server.port}`);
  for (const signal of ["SIGTERM", "SIGINT"])
    process.on(signal, () => {
      void server.stop();
    });
}
