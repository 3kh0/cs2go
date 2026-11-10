# Production deployment

Pushes to `main` run `.github/workflows/deploy.yml`. Client builds first require an
exact R2 release manifest and a verification receipt for the current asset Git tree.
A missing receipt triggers asset verification and sync; the release manifest is
published last. Vercel and the client container build only after this succeeds.
The server image is built and smoke-tested separately before GHCR publication.
`workflow_dispatch` requests all release jobs, including asset recovery.

## Persistent asset runner

The repository-scoped runner `na1-cs2go-assets` runs on na1 as the unprivileged
`cs2go-assets` account, with the `cs2go-assets` runner label. Only trusted main-branch
pushes and manually dispatched workflows use it; do not attach pull-request jobs.

- Runner: `/opt/cs2go-assets/runner`
- Persistent Actions workspace: `/opt/cs2go-assets/work`
- Python environment: `/opt/cs2go-assets/python` (boto3 1.40.61)
- Compression cache: `/var/cache/cs2go-assets/transport`
- Service: `actions.runner.3kh0-cs2go.na1-cs2go-assets.service`

Actions updates the existing sparse checkout to the exact requested SHA. Checkout
cleanup stays enabled; compression files live outside the checkout and are linked
only when verification is needed. No Actions cache archive needs downloading. When a release is incomplete, seeding
reuses shared R2 payloads only after their size and SHA-256 match the manifest;
missing payloads are generated locally, followed by source verification.
After successful sync, cache files no longer used by the current manifest are
removed. The job requires 20 GiB free before checkout and has a two-hour deadline.
The systemd service uses Nice=10, CPUQuota=200%, MemoryHigh=6G, MemoryMax=8G and
IOWeight=25 to share the host with production services.

R2 credentials remain GitHub Actions secrets, rather than a host-level environment
file. Check runner health with `systemctl status` for the service above and the
repository Actions runner page. If the runner is replaced, install the official
GitHub Actions runner under a dedicated non-root account, verify its published
checksum, recreate the directories/Python environment above, register it to this
repository with the same label, then install the service and resource limits.
Allow enough disk space for the initial asset checkout, Git objects and compressed
representations; subsequent jobs reuse these rather than cloning them again.
