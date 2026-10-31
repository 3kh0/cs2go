let matchActive = false;
let pendingUpdate = false;
let reloading = false;
function applyUpdate() {
  if (!pendingUpdate || matchActive || reloading) return;
  reloading = true;
  location.reload();
}
/** A new build refreshes the menu, never a live match or its results screen. */
export function setAssetCacheMatchActive(active: boolean) {
  matchActive = active;
  if (!active) applyUpdate();
}
function currentShellMatches(worker: ServiceWorker): Promise<boolean> {
  const paths = Array.from(
    document.querySelectorAll<HTMLScriptElement | HTMLLinkElement>(
      'script[type="module"][src], link[rel="stylesheet"][href]',
    ),
  )
    .map((node) => new URL(node instanceof HTMLScriptElement ? node.src : node.href, location.href))
    .filter((url) => url.origin === location.origin)
    .map((url) => url.pathname);
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const finish = (current: boolean) => {
      clearTimeout(timer);
      channel.port1.close();
      channel.port2.close();
      resolve(current);
    };
    const timer = setTimeout(() => finish(false), 2000);
    channel.port1.onmessage = (event) => finish(event.data?.current === true);
    try {
      worker.postMessage({ type: "CHECK_SHELL", paths }, [channel.port2]);
    } catch {
      finish(false);
    }
  });
}
/** Register before downloads; new navigations fetch fresh HTML, with offline fallback. */
export async function startAssetCache(): Promise<void> {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  const serviceWorker = navigator.serviceWorker;
  let controlled = !!serviceWorker.controller;
  serviceWorker.addEventListener("controllerchange", () => {
    const worker = serviceWorker.controller;
    if (!worker) return;
    const updating = controlled;
    controlled = true;
    if (updating)
      void currentShellMatches(worker).then((current) => {
        if (!current) {
          pendingUpdate = true;
          applyUpdate();
        }
      });
  });
  const registration = serviceWorker
    .register("/sw.js", { updateViaCache: "none" })
    .then((reg) => {
      let lastCheck = Date.now();
      const check = () => {
        if (document.hidden || !navigator.onLine || Date.now() - lastCheck < 5000) return;
        lastCheck = Date.now();
        void reg.update().catch(() => {});
      };
      document.addEventListener("visibilitychange", check);
      window.addEventListener("online", check);
      window.addEventListener("focus", check);
      setInterval(check, 60000);
      return reg;
    })
    .catch(() => undefined);
  if (serviceWorker.controller) return;
  let finished = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let listener: (() => void) | undefined;
  try {
    await Promise.race([
      registration.then(async (reg) => {
        if (finished || !reg || serviceWorker.controller) return;
        await new Promise<void>((resolve) => {
          listener = () => {
            if (serviceWorker.controller) resolve();
          };
          serviceWorker.addEventListener("controllerchange", listener);
          listener();
        });
      }),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, 8000);
      }),
    ]);
  } finally {
    finished = true;
    if (timer) clearTimeout(timer);
    if (listener) serviceWorker.removeEventListener("controllerchange", listener);
  }
}
