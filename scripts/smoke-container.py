"""Exercise the actual release image before pushing it to GHCR."""

import json
import subprocess
import sys
import time
import urllib.error
import urllib.request

kind, image = sys.argv[1:]
if kind not in ("client", "server"):
    raise SystemExit("Expected client or server")
port = 3000 if kind == "client" else 3001
container = subprocess.check_output(
    [
        "docker", "run", "--detach", "--rm", "--read-only", "--cap-drop=ALL",
        "--security-opt=no-new-privileges", "-p", f"127.0.0.1::{port}",
        "-e", "STEAM_ORIGIN=https://game.example", "-e", "STEAM_SESSION_SECRET=" + "s" * 64,
        image,
    ], text=True,
).strip()
try:
    config = json.loads(subprocess.check_output(["docker", "inspect", container], text=True))[0]
    assert config["Config"]["User"] == "65532:65532"
    binding = config["NetworkSettings"]["Ports"][f"{port}/tcp"][0]
    base = f"http://127.0.0.1:{binding['HostPort']}"

    def request(path, method="GET", headers=None):
        req = urllib.request.Request(base + path, method=method, headers=headers or {})
        try:
            return urllib.request.urlopen(req, timeout=5)
        except urllib.error.HTTPError as error:
            return error

    deadline = time.monotonic() + 30
    while True:
        try:
            health = request("/healthz")
            assert health.status == 200
            assert json.load(health)["ok"] is True
            break
        except (OSError, AssertionError):
            if time.monotonic() >= deadline:
                raise
            time.sleep(0.2)
    if kind == "client":
        home = request("/")
        assert home.status == 200 and "text/html" in home.headers["Content-Type"]
        assert "no-cache" in home.headers["Cache-Control"]
        html = home.read().decode()
        assert 'id="app"' in html
        import re
        bundle = re.search(r'src="(/assets/[^\"]+\.js)"', html)[1]
        asset = request(bundle)
        assert asset.status == 200 and "immutable" in asset.headers["Cache-Control"]
        assert len(asset.read()) > 0
        assert request(bundle, method="HEAD").read() == b""
        worker = request("/sw.js")
        assert worker.status == 200 and "no-cache" in worker.headers["Cache-Control"]
        assert json.load(request("/api/steam")) == {"profile": None}
        assert request("/api/steam?action=sync", method="POST").status == 403
        assert request("/api/steam?action=sync", method="POST", headers={"Origin": "https://game.example"}).status == 401
        login = request("/api/steam?action=session", headers={"X-Forwarded-Host": "attacker.example"})
        assert login.status == 200
        for path in ("/client-server.mjs", "/steam-auth.mjs", "/.env", "/%2e%2e/server.js", "/missing.js"):
            assert request(path).status == 404, path
        assert request("/", method="POST").status == 405
    else:
        assert request("/ws", headers={"Origin": "https://game.example"}).status == 403
        assert request("/ws", headers={"Origin": "https://cs2go.3kh0.net"}).status == 426
    print(f"{kind} container smoke passed: non-root, read-only, HTTP routes and health")
except BaseException:
    subprocess.run(["docker", "logs", container], check=False)
    raise
finally:
    subprocess.run(["docker", "stop", "--time", "5", container], check=True, stdout=subprocess.DEVNULL)
