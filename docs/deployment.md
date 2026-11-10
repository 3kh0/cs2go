# Production deployment

Pushes to `main` run `.github/workflows/deploy.yml`. Client builds wait for the exact
R2 release manifest and verification receipt for the current asset Git tree.
GitHub Actions only checks these public completion markers: asset checkout,
compression, source verification and sync run independently on na1. Vercel and the
client container build after publication. The server image is built and
smoke-tested separately before GHCR publication. `workflow_dispatch` requests all
release jobs, including server image publication.

## Independent asset sync on na1

The unprivileged `cs2go-assets` account owns a systemd user service and timer:

- `cs2go-assets-sync.service` runs `scripts/sync-assets-server.sh`, installed at
  `/opt/cs2go-assets/sync-assets-server.sh`.
- `cs2go-assets-sync.timer` checks for updates two minutes after the previous run
  completes. It continues when GitHub Actions runs are cancelled.
- Persistent checkout: `/opt/cs2go-assets/work/cs2go/cs2go`.
- Python environment: `/opt/cs2go-assets/python` (boto3 1.40.61).
- Bun: `/home/cs2go-assets/.bun/bin/bun`, matching package.json.
- Compression cache: `/var/cache/cs2go-assets/transport`.
- Last successful publication: `/var/cache/cs2go-assets/last-sync.json`.

The script fetches main into the existing sparse clone and pins the fetched SHA
for the whole operation. It refuses tracked modifications and serializes runs
with a lock. An exact published receipt skips verification and upload. Otherwise,
seeding reuses R2 payloads only after their size and SHA-256 match the manifest;
missing payloads are generated locally. Source verification must pass before
publication; the release manifest and verification receipt are written last.
After sync, obsolete compression-cache files are removed.

The service uses Nice=10, CPUQuota=200%, MemoryHigh=6G, MemoryMax=8G and IOWeight=25.
Keep enough disk space for Git objects, the checkout and compressed payloads;
the initial checkout requires much more space than incremental updates. The
`cs2go-assets` user has lingering enabled so the timer survives logout/reboot.
To inspect from a root SSH session:

```sh
asset_uid=$(id -u cs2go-assets)
runuser -u cs2go-assets -- env XDG_RUNTIME_DIR=/run/user/$asset_uid \
  DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/$asset_uid/bus \
  systemctl --user status cs2go-assets-sync.service cs2go-assets-sync.timer
journalctl _UID="$asset_uid" _SYSTEMD_USER_UNIT=cs2go-assets-sync.service
```

## Credential provisioning

The manually dispatched `asset-sync-handoff.yml` workflow uses the repository-scoped
runner `na1-cs2go-assets` only to install the existing R2 repository secrets into
`/home/cs2go-assets/.config/cs2go-assets/r2.env` (mode 0600), then starts the independent
timer/service. It does not clone, verify, encode or upload assets. Dispatch it again
after rotating keys. Do not use this runner for pull-request workflows.

Runner location: `/opt/cs2go-assets/runner`, workspace: `/opt/cs2go-assets/work`,
service: `actions.runner.3kh0-cs2go.na1-cs2go-assets.service`. If replacing the host,
register an official checksum-verified Actions runner under the same non-root
account and label `cs2go-assets`, recreate the paths and Python/Bun environments,
install the script and user units, enable lingering, then provision credentials.
