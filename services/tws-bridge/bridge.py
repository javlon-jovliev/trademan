"""Read-only, serialized bridge using the official IBKR Python API.
Each operation creates a fresh session; incomplete downloads never become snapshots.
"""
import hmac
import json
import math
import os
import threading
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from ibapi.client import EClient
from ibapi.wrapper import EWrapper
from ibapi.contract import Contract

TIMEOUT = 15
LOCK = threading.Lock()
QUOTE_CURSOR = 0


def finite(value):
    value = float(value)
    if not math.isfinite(value) or abs(value) >= 1e100:
        raise ValueError("Invalid broker number")
    return value


class Session(EWrapper, EClient):
    def __init__(self):
        EClient.__init__(self, self)
        self.ready = threading.Event()
        self.done = threading.Event()
        self.accounts = []
        self.accounts_ready = threading.Event()
        self.values = {}
        self.positions = {}
        self.contracts = []
        self.bars = []
        self.ticks = {}
        self.live = {}
        self.orders = set()
        self.failed = False
        self.account = None
        self.thread = None

    def nextValidId(self, orderId):
        self.ready.set()

    def managedAccounts(self, accountsList):
        self.accounts = accountsList.split(",")
        self.accounts_ready.set()

    def error(self, reqId, *args):
        # Compatible with API versions with/without the errorTime argument.
        code = args[1] if len(args) >= 4 else args[0]
        if code not in (2104, 2106, 2107, 2108, 2158):
            self.failed = True
            self.done.set()

    def connectionClosed(self):
        self.failed = True
        self.done.set()

    def wait(self):
        if not self.done.wait(TIMEOUT) or self.failed or not self.isConnected():
            raise RuntimeError("Incomplete broker response")
        self.done.clear()

    def __enter__(self):
        try:
            self.connect(os.getenv("IBKR_TWS_HOST", "host.docker.internal"),
                         int(os.getenv("IBKR_TWS_PORT", "4002")),
                         int(os.getenv("IBKR_TWS_CLIENT_ID", "71")))
            self.thread = threading.Thread(target=self.run, daemon=True)
            self.thread.start()
            if not self.ready.wait(TIMEOUT) or self.failed:
                raise RuntimeError("Gateway unavailable")
            self.reqManagedAccts()
            if not self.accounts_ready.wait(TIMEOUT) or self.failed:
                raise RuntimeError("Accounts unavailable")
            return self
        except Exception:
            self.close()
            raise

    def close(self):
        self.disconnect()
        if self.thread:
            self.thread.join(2)

    def __exit__(self, *args):
        self.close()

    def authorize(self, account):
        if account != os.environ["IBKR_ACCOUNT_ID"] or account not in self.accounts:
            raise ValueError("Account unavailable")
        self.account = account

    def updateAccountValue(self, key, val, currency, accountName):
        if accountName == self.account:
            self.values[(key, currency)] = val

    def updatePortfolio(self, contract, position, marketPrice, marketValue,
                        averageCost, unrealizedPNL, realizedPNL, accountName):
        if accountName != self.account:
            return
        quantity = finite(position)
        if quantity == 0:
            self.positions.pop(str(contract.conId), None)
            return
        multiplier = finite(contract.multiplier or
                            (1 if contract.secType in ("STK", "CASH", "CRYPTO") else "nan"))
        if multiplier <= 0:
            raise ValueError("Missing multiplier")
        self.positions[str(contract.conId)] = dict(
            conid=str(contract.conId), symbol=contract.localSymbol or contract.symbol,
            name=contract.symbol, quantity=quantity,
            averagePrice=finite(averageCost) / multiplier,
            currentPrice=finite(marketPrice) if marketPrice > 0 else None,
            previousClose=None, multiplier=multiplier, fx=None,
            currency=contract.currency, assetClass=contract.secType, sector="Unknown")

    def accountDownloadEnd(self, accountName):
        if accountName == self.account:
            self.done.set()

    def snapshot(self, account):
        self.authorize(account)
        self.reqAccountUpdates(True, account)
        try:
            self.wait()
        finally:
            self.reqAccountUpdates(False, account)
        currency = self.values.get(("Currency", "BASE"))
        if not currency or ("NetLiquidation", currency) not in self.values:
            raise ValueError("Missing base currency or account values")
        def value(key):
            raw = self.values.get((key, currency))
            return finite(raw) if raw is not None else None
        for position in self.positions.values():
            position["fx"] = 1 if position["currency"] == currency else (
                finite(self.values[("ExchangeRate", position["currency"])])
                if ("ExchangeRate", position["currency"]) in self.values else None)
        return dict(brokerId=account, currency=currency, nlv=value("NetLiquidation"),
                    cash=value("TotalCashBalance"), buyingPower=value("BuyingPower"),
                    maintenanceMargin=value("MaintMarginReq"),
                    excessLiquidity=value("ExcessLiquidity"), positions=list(self.positions.values()))

    def contractDetails(self, reqId, details):
        self.contracts.append(details.contract)

    def contractDetailsEnd(self, reqId):
        self.done.set()

    def contract(self, conid):
        if not str(conid).isdigit() or int(conid) <= 0:
            raise ValueError("Invalid contract")
        self.contracts = []
        contract = Contract()
        contract.conId = int(conid)
        self.reqContractDetails(1, contract)
        self.wait()
        if len(self.contracts) != 1:
            raise ValueError("Ambiguous contract")
        return self.contracts[0]

    def historicalData(self, reqId, bar):
        time = datetime.strptime(bar.date, "%Y%m%d").strftime("%Y-%m-%d")
        self.bars.append(dict(time=time, open=finite(bar.open), high=finite(bar.high),
                              low=finite(bar.low), close=finite(bar.close)))

    def historicalDataEnd(self, reqId, start, end):
        self.done.set()

    def history(self, conid, to):
        contract = self.contract(conid)
        end = datetime.fromisoformat(to.replace("Z", "+00:00")).astimezone(timezone.utc)
        self.reqHistoricalData(2, contract, end.strftime("%Y%m%d-%H:%M:%S"),
                               "1 Y", "1 day", "TRADES", 1, 1, False, [])
        self.wait()
        return self.bars

    def openOrder(self, orderId, contract, order, orderState):
        if order.account == self.account:
            self.orders.add(str(contract.conId))

    def openOrderEnd(self):
        self.done.set()

    def tickByTickBidAsk(self, reqId, timestamp, bidPrice, askPrice,
                        bidSize, askSize, tickAttribBidAsk):
        at = datetime.fromtimestamp(timestamp, timezone.utc)
        if bidPrice > 0 and askPrice >= bidPrice:
            self.ticks[reqId] = (finite(bidPrice), finite(askPrice), at)

    def quotes(self, account, conids):
        self.authorize(account)
        if len(conids) > 1000 or any(not str(c).isdigit() for c in conids):
            raise ValueError("Invalid contracts")
        self.reqAllOpenOrders()
        self.wait()
        ids = list(dict.fromkeys([*conids, *sorted(self.orders)]))
        global QUOTE_CURSOR
        results = []
        if not ids:
            return results
        offset = QUOTE_CURSOR % len(ids)
        batch = (ids[offset:] + ids[:offset])[:5]
        QUOTE_CURSOR = (offset + len(batch)) % len(ids)
        deadline = time.monotonic() + 40
        # Rotate bounded batches. Tick-by-tick uses broker timestamps, never receipt
        # time or delayed quotes, so execution benchmarks stay conservative.
        for index, conid in enumerate(batch):
            if time.monotonic() >= deadline:
                break
            contract = self.contract(conid)
            req = 100 + index
            self.reqTickByTickData(req, contract, "BidAsk", 0, False)
            try:
                threading.Event().wait(2.1)
                now = datetime.now(timezone.utc)
                quote = self.ticks.get(req)
                if quote and 0 <= (now - quote[2]).total_seconds() <= 15:
                    results.append(dict(conid=conid, bid=quote[0], ask=quote[1],
                                        at=quote[2].isoformat(), observedAt=now.isoformat()))
                if self.failed:
                    raise RuntimeError("Market data unavailable")
            finally:
                self.cancelTickByTickData(req)
        return results


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass  # Do not log tokens, account identifiers or payloads.

    def do_POST(self):
        token = os.environ["IBKR_TWS_BRIDGE_TOKEN"]
        if not hmac.compare_digest(self.headers.get("Authorization", ""), "Bearer " + token):
            self.respond(401, {"error": "Unauthorized"})
            return
        if self.path not in ("/status", "/snapshot", "/history", "/quotes"):
            self.respond(404, {"error": "Unknown operation"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length < 0 or length > 65536:
                raise ValueError("Invalid payload size")
            body = json.loads(self.rfile.read(length) or b"{}")
            if not LOCK.acquire(timeout=1):
                self.respond(503, {"error": "Bridge busy; retry"})
                return
            try:
                with Session() as client:
                    if self.path == "/status":
                        client.authorize(os.environ["IBKR_ACCOUNT_ID"])
                        result = {"connected": True}
                    elif self.path == "/snapshot":
                        result = client.snapshot(body["accountId"])
                    elif self.path == "/history":
                        client.authorize(os.environ["IBKR_ACCOUNT_ID"])
                        result = client.history(body["conid"], body["to"])
                    else:
                        result = client.quotes(body["accountId"], body["conids"])
            finally:
                LOCK.release()
            self.respond(200, result)
        except Exception:
            self.respond(503, {"error": "Broker operation failed; check Gateway and permissions"})

    def respond(self, status, body):
        data = json.dumps(body, allow_nan=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


if __name__ == "__main__":
    if len(os.environ.get("IBKR_TWS_BRIDGE_TOKEN", "")) < 32:
        raise SystemExit("Configure a bridge token of at least 32 characters")
    if not os.environ.get("IBKR_ACCOUNT_ID"):
        raise SystemExit("Configure IBKR_ACCOUNT_ID")
    ThreadingHTTPServer((os.getenv("IBKR_TWS_BIND", "127.0.0.1"), 8000), Handler).serve_forever()
