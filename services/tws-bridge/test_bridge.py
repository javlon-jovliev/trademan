import os
import unittest
from unittest.mock import patch
from ibapi.contract import Contract
from bridge import Session, finite


class BridgeTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {"IBKR_ACCOUNT_ID": "DU1"})
        self.env.start()
        self.client = Session()
        self.client.accounts = ["DU1"]
        self.client.authorize("DU1")

    def tearDown(self):
        self.env.stop()

    def test_snapshot_waits_for_complete_download_and_normalizes_derivatives(self):
        contract = Contract()
        contract.conId = 123
        contract.symbol = "ES"
        contract.secType = "FUT"
        contract.currency = "USD"
        contract.multiplier = "50"
        def download(subscribe, account):
            if not subscribe:
                return
            self.client.updateAccountValue("Currency", "USD", "BASE", account)
            self.client.updateAccountValue("NetLiquidation", "1000", "USD", account)
            self.client.updatePortfolio(contract, -2, 101, -10100, 5000, 0, 0, account)
            self.client.accountDownloadEnd(account)
        with patch.object(self.client, "reqAccountUpdates", side_effect=download), \
                patch.object(self.client, "isConnected", return_value=True):
            result = self.client.snapshot("DU1")
        self.assertEqual(result["positions"][0]["averagePrice"], 100)
        self.assertEqual(result["positions"][0]["quantity"], -2)
        self.assertEqual(result["positions"][0]["fx"], 1)
        self.assertIsNone(result["cash"])

    def test_incomplete_snapshot_never_returns_an_empty_position_list(self):
        with patch.object(self.client, "reqAccountUpdates"), \
                patch.object(self.client.done, "wait", return_value=False):
            with self.assertRaises(RuntimeError):
                self.client.snapshot("DU1")

    def test_wrong_or_unmanaged_account_is_rejected(self):
        for account in ["DU2", "../DU1"]:
            with self.assertRaises(ValueError):
                self.client.authorize(account)
        self.client.accounts = []
        with self.assertRaises(ValueError):
            self.client.authorize("DU1")

    def test_missing_derivative_multiplier_fails_closed(self):
        contract = Contract()
        contract.secType = "OPT"
        with self.assertRaises(ValueError):
            self.client.updatePortfolio(contract, 1, 10, 1000, 1000, 0, 0, "DU1")

    def test_disconnect_and_permission_errors_invalidate_download(self):
        self.client.error(1, 0, 354, "sensitive broker detail", "")
        self.assertTrue(self.client.failed)
        with self.assertRaises(RuntimeError):
            self.client.wait()

    def test_market_data_uses_broker_timestamp(self):
        self.client.tickByTickBidAsk(1, 1700000000, 10, 11, 1, 1, None)
        self.assertEqual(int(self.client.ticks[1][2].timestamp()), 1700000000)
        self.client.tickByTickBidAsk(2, 1700000000, 12, 11, 1, 1, None)
        self.assertNotIn(2, self.client.ticks)

    def test_rejects_unset_ibkr_numeric_sentinels(self):
        for value in ["nan", "inf", 1.7976931348623157e308]:
            with self.assertRaises(ValueError):
                finite(value)


if __name__ == "__main__":
    unittest.main()
