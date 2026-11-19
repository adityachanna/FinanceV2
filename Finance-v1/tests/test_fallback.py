import unittest
from unittest import mock

import fallback


class TickerAndIntentTests(unittest.TestCase):
    def test_company_names_and_tickers_resolve_without_network(self):
        with mock.patch.object(fallback.yf, "Search", side_effect=AssertionError("no network")):
            self.assertEqual(fallback.find_ticker("What is Apple's valuation?"), "AAPL")
            self.assertEqual(fallback.find_ticker("is $nvda expensive"), "NVDA")
            self.assertEqual(fallback.find_ticker("Compare MSFT and the PE of peers"), "MSFT")
            self.assertEqual(fallback.find_ticker("bank of america financials"), "BAC")

    def test_intents(self):
        self.assertEqual(fallback.detect_intent("Is Apple overvalued?"), "valuation")
        self.assertEqual(fallback.detect_intent("How has Tesla performed?"), "performance")
        self.assertEqual(fallback.detect_intent("Show Microsoft debt and cash"), "financials")
        self.assertEqual(fallback.detect_intent("What is the market risk right now?"), "market")

    def test_answer_never_raises(self):
        with mock.patch.object(fallback, "valuation_answer", side_effect=RuntimeError("offline")):
            text = fallback.answer("Apple valuation")
        self.assertIn("could not load data", text)
        self.assertIn("Built-in analyst", text)
        self.assertIn("Try:", fallback.answer(""))

    def test_formatters(self):
        self.assertEqual(fallback.money(5.08e12), "5.08T USD")
        self.assertEqual(fallback.share(0.412), "41.2%")
        self.assertEqual(fallback.pct(-0.05), "-5.0%")
        self.assertEqual(fallback.ratio(None), "n/a")


if __name__ == "__main__":
    unittest.main()
