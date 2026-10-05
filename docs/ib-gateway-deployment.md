# Incremental IB Gateway migration and Hetzner deployment

## What changes

`IBKR_ADAPTER=web` remains the default. `broker/factory.ts` selects the existing
Client Portal adapter or `broker/tws.ts`. Both implement snapshots, status,
keep-alive, quotes and daily candles. No automatic failover is performed.
The app's account sync transaction, sector overrides, Prisma schema, risk engine,
alerts, Telegram delivery, demo mode and UI response formats are unchanged.

The TWS adapter talks to a private Python bridge using the **official IBKR SDK**;
the bridge talks TCP to authenticated IB Gateway or TWS. Its HTTP API only exposes
read operations. No order placement/cancellation or account switching is implemented.
Gateway itself is installed on the Ubuntu host with a virtual display and private
remote desktop. Compose manages PostgreSQL, migrations, web, worker and bridge.
Gateway GUI installation/login remains an operator step, deliberately outside
container credential automation.

Flex remains the source of executions, commissions, fee currencies and matched
closed trades in either mode. TWS execution downloads do not replace this complete
historical reporting path. Configure an Activity Flex XML query using the existing
README requirements. Missing Flex credentials continue to produce a history error
and retry; portfolio sync can still succeed.

## Configuration

- `IBKR_ADAPTER`: `web` or `tws`. Restart web and worker after changing it.
- `IBKR_ACCOUNT_ID`: exact managed account; bridge rejects every other account.
- `IBKR_TWS_BRIDGE_URL`: local `http://127.0.0.1:8000`, Compose `http://tws-bridge:8000`, or trusted HTTPS endpoint.
- `IBKR_TWS_BRIDGE_TOKEN`: random shared token, at least 32 characters; generate with `openssl rand -hex 32`.
- `IBKR_TWS_HOST`: Gateway TCP host, `host.docker.internal` for this production stack.
- `IBKR_TWS_PORT`: configured Gateway port; commonly paper 4002/live 4001, TWS paper 7497/live 7496. Check the GUI rather than relying on the defaults.
- `IBKR_TWS_CLIENT_ID`: exclusive client ID, default 71. Do not run two bridge instances with the same client ID.
- `IBKR_GATEWAY_URL`: only used by Web API. Continue verifying its TLS certificate.
- `IBKR_FLEX_TOKEN`, `IBKR_FLEX_QUERY_ID`, `TELEGRAM_BOT_TOKEN`: existing server credentials.

No IBKR username, password or 2FA code belongs in this app's environment.
Never set `NODE_TLS_REJECT_UNAUTHORIZED=0`. Do not use `NEXT_PUBLIC_` for secrets.

## Local tests and paper-account trial

```sh
pnpm install --frozen-lockfile
pnpm db:generate
pnpm lint
pnpm typecheck
pnpm test
pnpm build
python3 services/tws-bridge/install-sdk.py
python3 -m venv work/tws-venv
work/tws-venv/bin/pip install ./services/tws-bridge/vendor/ibapi
work/tws-venv/bin/python -m unittest discover -s services/tws-bridge -p 'test_*.py'
```

The SDK installer verifies the pinned official 10.50.2 archive SHA-256 before
extracting. SDK code is ignored by Git; changing its version requires reviewing
and updating the download/checksum plus compatibility tests. The bridge image
installs this staged SDK, including its pinned protobuf dependency. Use a Gateway
version compatible with that SDK (IBKR currently recommends 1051 or later).

Copy `.env.example` to `.env` and configure your local PostgreSQL and credentials.
Set `DEMO_MODE=false`, `IBKR_ADAPTER=tws`, `IBKR_TWS_HOST=127.0.0.1`, paper-account
port and bridge token. Log into paper Gateway. Enable socket clients and read-only
API mode; allow localhost. Start the bridge in a terminal that has loaded the same
configured environment (the Python process does not automatically load `.env`):

```sh
set -a
. ./.env
set +a
work/tws-venv/bin/python services/tws-bridge/bridge.py
```

Only source an environment file you control. In another terminal run:

```sh
pnpm db:migrate
pnpm db:seed
pnpm exec tsx scripts/connect-live.ts
pnpm dev
# Separate terminal, after verifying the account:
pnpm worker
```

Inspect Gateway versus app: account/base currency, NLV, cash, short quantities,
derivative multiplier and per-unit average price, FX, candle dates, history costs
and alerts. Disconnect Gateway and confirm last positions remain, connected becomes
false and reconnect restores sync. A failed or incomplete account download must
never delete positions. Test on a separate database/paper account first.

## Ubuntu server

1. Prepare an Ubuntu x86_64 Hetzner server, SSH keys, Docker Engine and Compose v2
   from Docker's official installation guide. Keep SSH available; allow inbound
   80/443 for the web reverse proxy. Start with adequate memory for Next build,
   PostgreSQL and Java Gateway; measure usage before choosing production capacity.
2. Install IB Gateway from IBKR on the host. Provide a virtual display/lightweight
   desktop and remote access bound to loopback, reached via SSH tunnel. Do not
   expose VNC/RDP or the API socket publicly. Authenticate manually including 2FA.
   Enable socket API and read-only mode. Configure the API port and trusted client
   IP/subnet used by Docker. Permit only the required Docker bridge subnet on that
   port in host firewall rules. A Gateway bound only to loopback is unreachable
   through `host.docker.internal`; verify its listener and firewall before proceeding.
3. Clone this branch, run the SDK installer, and copy
   `deploy/production.env.example` to root `.env.production`. Set the account,
   domain/origin, tokens and strong seed/DB passwords; `chmod 600 .env.production`.
   Use a URL-safe hexadecimal DB password because Compose interpolates it into a URL.
4. Build and migrate, then bootstrap the user explicitly:

```sh
python3 services/tws-bridge/install-sdk.py
docker compose --env-file .env.production -f compose.production.yaml build
docker compose --env-file .env.production -f compose.production.yaml up -d db
docker compose --env-file .env.production -f compose.production.yaml run --rm migrate
docker compose --env-file .env.production -f compose.production.yaml run --rm bootstrap
docker compose --env-file .env.production -f compose.production.yaml up -d tws-bridge
docker compose --env-file .env.production -f compose.production.yaml run --rm connect
docker compose --env-file .env.production -f compose.production.yaml up -d web worker
```

5. Install Caddy on the host using its official Ubuntu instructions. Replace the
   example hostname in `deploy/Caddyfile`, point domain DNS to the server and use
   the file as Caddy's site configuration. Caddy terminates HTTPS and forwards to
   loopback port 3000. Set `APP_ORIGIN` to exactly that HTTPS origin.
6. Verify browser login, connection status, sync timestamps, Flex history and
   Telegram delivery if enabled. Check `docker compose ... ps` and service logs.
   Do not share rendered Compose configuration or environment dumps: they contain
   secrets. No server deployment was performed by this change.

Migrations are a dedicated service; seeding is an explicit bootstrap action.
No database port, bridge port or Gateway port is published by Compose. Web is
bound to host loopback. PostgreSQL data persists in a named volume. Keep encrypted
off-server database backups and test restoration before switching a live account.
Never use `down -v` on the production stack.

## Cutover, rollback and operational limits

- Stop the worker, back up PostgreSQL, verify paper comparisons, then select `tws`
  and restart web/worker. The same Prisma records remain. No schema migration is
  added. Avoid comparing both modes by logging into competing IBKR sessions.
- Rollback: stop worker, set `IBKR_ADAPTER=web`, configure and authenticate the
  Client Portal Gateway, then recreate web/worker. If using a custom Web API CA,
  mount that CA file into the containers and set `NODE_EXTRA_CA_CERTS` to the
  container path. Cached history, positions and scenario overrides remain.
- Operator login/2FA and reauthentication after Gateway resets remain necessary.
  Auto Restart is helpful but does not guarantee unattended authentication.
  Use a dedicated secondary IBKR username for this same account if other trading
  sessions would interrupt this one. Grant only required account/data access for
  this read-only app. Both logins see the same positions when their access rights
  permit it; real-time subscriptions are per username and may incur separate fees.
- Bridge calls are serialized and use one fresh socket session per operation.
  Busy requests return 503 and the existing worker retries. Connection status can
  temporarily report unavailable while a download is running. Test real-world
  latency before promoting; a persistent multiplexed session is a future extension.
- Bid/ask capture uses real tick-by-tick broker timestamps, filters crossed/stale
  quotes, and rotates up to five contracts per poll including open orders.
  Appropriate tick-by-tick subscriptions and permissions are required. Missing or
  unsupported data produces no synthetic benchmark. More than five contracts means
  reduced per-contract sampling; this is not complete high-frequency coverage.
- Historical data uses annual daily TRADES/RTH windows, at most 15 years, preserving
  existing cache merges and retries. Permissions, pacing and instrument availability
  can leave charts incomplete. Contracts without usable TRADES data need a future
  explicit asset-specific policy rather than silently substituting price series.
- Cross-currency FX may be unavailable (`null`); current prices can be unavailable.
  Existing risk data-quality handling remains active. Missing derivative multipliers,
  invalid numbers and incomplete downloads fail rather than producing inaccurate data.
- This first increment retains Flex executions. Streaming executions/commission
  reconciliation, persistent sessions and full quote coverage are future work.

## Official references

- SDK distribution: https://interactivebrokers.github.io/
- Account callbacks: https://www.interactivebrokers.com/docs/tws-api/doc/account-portfolio-data/account-updates/receiving-account-updates
- Historical bars: https://www.interactivebrokers.com/docs/tws-api/doc/market-data-historical/historical-bars/receiving-historical-bars
- Docker Ubuntu: https://docs.docker.com/engine/install/ubuntu/
- Caddy installation: https://caddyserver.com/docs/install
