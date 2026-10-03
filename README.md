# ERTA

Portfolio monitoring and risk management for Interactive Brokers. Next.js 16 / React 19, strict TypeScript, PostgreSQL / Prisma 6, Argon2id sessions, Uzbek and English UI. Broker access is read-only: ERTA has no order submission endpoint.

## Features

- Minimal dashboard with equity history, account daily P&L, transparent heat, gross sector exposure, margin and liquidity.
- Dense, sortable, paginated portfolio table, combined search/filter toolbar, CSV export and keyboard-accessible position drawer. Edit manual risk stops and sector classifications.
- Per-account scenarios: create, edit, duplicate, activate, delete inactive policies. Five editor tabs cover losses/drawdown, heat, trade risk, concentration, exposure, margin, liquidity, sector/asset limits and alert thresholds.
- Closed position journal with expandable post-exit analysis, candlesticks, entry/exit markers and notes. Validated normalized CSV imports and IBKR Flex execution ingestion with persistent FIFO matching for partial exits and shorts.
- Account, password, session revocation, language, sidebar and theme preferences. Broker connection status and second-by-second account timezone clock.
- Telegram transition alerts, acknowledgement, delivery error reporting and retries. A worker syncs broker data every minute and Flex history / OHLC every six hours.
- Deterministic demo seed, a credential-free broker mode, migrations, tests, Docker Compose and GitHub Actions CI.

## Run with PostgreSQL

Requirements: Node.js 22+, pnpm 11.19+, PostgreSQL 17+; alternatively Docker Compose.

```sh
pnpm install --frozen-lockfile
cp .env.example .env
# Set DATABASE_URL and SEED_PASSWORD (12+ characters).
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
# In another terminal for live synchronization:
pnpm worker
```

Open http://localhost:3000. Use SEED_USERNAME / SEED_PASSWORD. The seed creates the initial user; it never resets an existing user's password. Public registration is disabled. Demo accounts are isolated from live accounts; DEMO_MODE must explicitly be `true` to expose demo data.

### Lightweight local development

If a native database cannot run, PGlite offers a persistent PostgreSQL development database:

```sh
# In .env, use this development-only URL:
# DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55432/postgres?connection_limit=1&statement_cache_size=0&pgbouncer=true
pnpm local:pglite
# Another terminal:
pnpm db:migrate
pnpm db:seed
pnpm dev
```

PGlite binds to loopback and has no production authentication guarantees. It is a local development option, not the deployment database. `pnpm local:db` can instead start an ordinary embedded PostgreSQL server using DATABASE_URL and `data/postgres`. Never run both database scripts on the same port. PGlite multiplexing differs from PostgreSQL; production and CI use ordinary PostgreSQL.

## Docker

Copy `.env.example` to `.env`. Set a strong `POSTGRES_PASSWORD`, `SEED_PASSWORD`, and `APP_ORIGIN`. Compose replaces DATABASE_URL with the internal database address.

```sh
docker compose up --build -d
```

The init service applies migrations and seeds before web and worker start. Postgres data persists in the `postgres` volume. Web binds to `127.0.0.1:3000` on the host. Put an HTTPS reverse proxy in front for live production and set APP_ORIGIN to its exact public origin. Back up PostgreSQL regularly. `.env`, local data, browser traces and build artifacts are excluded from Git and Docker context.

## Live IBKR

1. Set `DEMO_MODE=false`, `IBKR_GATEWAY_URL`, `IBKR_ACCOUNT_ID`, and HTTPS `APP_ORIGIN`.
2. Start the official [Client Portal Gateway](https://www.interactivebrokers.com/docs/web-api/v1/endpoints/introduction), authenticate with your IBKR login and 2FA in its browser, and maintain its session. ERTA does not accept or store your brokerage password.
3. Trust the gateway certificate using `NODE_EXTRA_CA_CERTS` if necessary. TLS validation is never disabled. In Docker, localhost means the container: use a reachable gateway hostname and mount the certificate.
4. In Settings → Connections, add the configured account ID and sync. Run the worker to keep data fresh. Existing IBKR market data permissions are required; missing fields remain unavailable.

The adapter validates account ownership at the gateway, reads account summary/ledger and paginated positions, and rejects unknown derivative multipliers. Non-USD positions require an available ledger FX conversion. Manual risk stops and sector classifications survive synchronization. Daily position P&L is unavailable when previous-close data is absent; account daily P&L uses cash-flow-adjusted equity snapshots. Live data older than three minutes or disconnected is marked stale and withheld from current risk calculations. No demo fallback exists.

### Automatic closed-trade history

Set `IBKR_FLEX_TOKEN` and `IBKR_FLEX_QUERY_ID` server-side. Create an Activity Flex XML query with **Trades / Executions** including account ID, trade ID, conid, symbol, signed quantity, trade price, IB commission, multiplier, FX rate to base, date/time, open/close indicator and level of detail. Configure timestamps as `yyyyMMdd;HHmmss` in **UTC**. Include the complete opening and closing history of the lots you want to analyze.

Settings → Connections → IBKR Flex sync requests and polls the [official Flex service](https://www.interactivebrokers.com/docs/web-api/flex-web-service/using-flex-web-service/generate-the-report). Executions are deduplicated by account/trade ID; FIFO matching creates separate closed lots for partial exits. Unmatched closes are deliberately omitted until their opening fills are imported. FIFO may differ from the account's tax-lot elections. Closure reason stays unclassified unless supplied through a normalized CSV; it is never inferred from price alone.

OHLC sync reads the last year of daily bars for Flex-imported contract IDs using [IBKR market data history](https://www.interactivebrokers.com/docs/web-api/api-reference/trading/trading-market-data/get-md-history). Older or unsupported contracts can use CSV imports. Missing historical market-data permissions result in an explicit error, not generated prices.

## Import formats

In Settings → Connections, upload UTF-8 CSV (max 2 MB, 5,000 rows). Quoted fields and CRLF are supported. Imports validate all rows before writing and trade upserts are transactional.

Closed trades:

```csv
symbol,quantity,entry,exit,openedAt,closedAt,reason,fees,externalId,multiplier,fx
AAPL,10,210,220,2026-09-01T14:30:00Z,2026-09-10T14:30:00Z,manual,2,example-1,1,1
```

Quantity is positive for long, negative for short. `reason` is `stop_loss`, `take_profit`, `manual` or `unknown`. Fees are nonnegative in account currency. Prices are in instrument currency. Multiplier and FX default to 1 when omitted, so supply both for derivatives or foreign-currency trades. `externalId` provides idempotency per account.

OHLC history:

```csv
symbol,time,open,high,low,close
AAPL,2026-09-11,220,224,218,222
```

OHLC prices use instrument currency. Bars attach to matching symbols; use distinct derivative contract symbols to avoid collisions. No rows are written when validation fails.

## Risk definitions and limits

- Position risk = absolute current-to-stop distance × absolute quantity × multiplier × FX. Heat = risk / net liquidation × 100.
- Missing stops, prices, FX or positive equity yield unavailable metrics; known partial heat is kept internally and never represented as complete portfolio heat.
- Position weight and sector/asset exposure use absolute market value. Gross exposure sums absolute values; net exposure preserves position direction. Leveraged and long/short allocation totals may exceed 100%.
- Daily / weekly / monthly losses compare equity to the last snapshot before the broker-calendar period, adjusted for external flows. Weeks begin Monday. Without a baseline, the metric is unknown. Record deposits and withdrawals in Connections when reflected in the current broker NLV. Unrecorded external flows affect the reported returns.
- Total drawdown uses a cash-flow-adjusted unitized high-water mark over stored snapshots. ERTA cannot reconstruct equity history predating its records.
- Hard violations and unknown required metrics flag risk-increasing trades as policy-blocked in the UI; ERTA cannot prevent orders placed outside the platform.
- Post-exit held P&L uses the most recent supplied bar, signed quantity, multiplier, recorded FX and original fees. MAE/MFE exclude the exit calendar day because daily bars cannot isolate intraday post-exit activity. Maximum drawdown is a conservative OHLC peak-to-trough bound; intrabar ordering is unknown. Hypothetical results exclude later financing, dividends, corporate actions and fees. They are an analytical comparison, not an exact account counterfactual.

## Telegram

Create a bot through BotFather, start a chat with it, and set `TELEGRAM_BOT_TOKEN` in the server environment. Enter the destination Telegram chat ID in Settings → Notifications, save, enable, then test. Tokens never go to the browser or database. Alerts send once for each active violation/severity transition, repeat after resolution/reappearance, and retry failed deliveries until acknowledged. Run one worker instance per deployment; Telegram delivery is at-least-once and can duplicate after a crash or simultaneous manual sync.

## Security

Argon2id passwords; random 256-bit session tokens with only SHA-256 digests stored in PostgreSQL; seven-day database sessions; HTTP-only SameSite=Lax cookies, secure in live production; exact-origin CSRF checks for mutations; database-backed per-username login attempt limiting; user/account scoping on all portfolio mutations; server-side input validation; password changes revoke every prior session. Do not commit credentials or expose the PGlite development socket. Configure a reverse-proxy IP rate limit for internet deployments, alongside the account limiter. No trading endpoints or broker order submission are implemented.

## Verify

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
# Against a migrated, seeded demo database:
pnpm exec playwright install chromium
pnpm test:e2e
pnpm test:api
```

Set SEED_USERNAME and SEED_PASSWORD in the test process environment. `node --env-file=.env node_modules/@playwright/test/cli.js test` loads them locally. Tests expect demo mode and disposable data. GitHub Actions provides PostgreSQL, runs every check, then runs Chromium UI/API tests. Live broker and Telegram delivery require real credentials and are not verified by demo tests. Docker requires a Docker engine; use CI or an environment with Docker to validate container startup.
