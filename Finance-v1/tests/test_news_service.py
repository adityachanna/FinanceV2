import unittest
from unittest.mock import patch
from types import SimpleNamespace
from news_service import company_news, normalize_articles


class NewsTests(unittest.TestCase):
    def test_search_shape_and_nested_shape_preserve_dates_and_links(self):
        values = [{'title': 'Search article', 'publisher': 'Reuters', 'link': 'https://example.org/a', 'providerPublishTime': 1704067200},
                  {'content': {'title': 'Nested article', 'provider': {'displayName': 'Yahoo Finance'},
                               'canonicalUrl': {'url': 'https://example.org/b'}, 'pubDate': '2024-01-02T12:00:00Z'}}]
        rows = normalize_articles(values, 5)
        self.assertEqual(rows[0]['title'], 'Nested article')
        self.assertEqual(rows[1]['publisher'], 'Reuters')
        self.assertEqual(rows[1]['published_at'], '2024-01-01T00:00:00+00:00')

    def test_invalid_links_ads_and_duplicates_are_not_articles(self):
        rows = normalize_articles([None, {'ad': True, 'title': 'Ad'}, {'title': 'Unsafe', 'url': 'javascript:alert(1)'},
                                   {'title': 'Real', 'url': 'https://example.org/real'},
                                   {'title': 'REAL', 'url': 'https://example.org/duplicate'}], 5)
        self.assertEqual(len(rows), 1)

    @patch('news_service.rss_news')
    @patch('news_service.yf.Search')
    def test_empty_search_uses_rss_without_ai(self, search, rss):
        search.return_value = SimpleNamespace(news=[])
        rss.return_value = [{'title': 'Fallback', 'link': 'https://example.org/news', 'pubDate': 'Mon, 02 Nov 2026 10:00:00 GMT'}]
        value = company_news('aapl', 1)
        self.assertEqual(value['source'], 'Yahoo Finance RSS')
        self.assertEqual(value['total_news_count'], 1)
        self.assertFalse(value['ai_generated'])

    @patch('news_service.rss_news', side_effect=RuntimeError('offline'))
    @patch('news_service.yf.Search', side_effect=RuntimeError('offline'))
    def test_feed_failure_is_distinct_from_successful_empty_response(self, search, rss):
        with self.assertRaisesRegex(RuntimeError, 'temporarily unavailable'):
            company_news('AAPL')
        search.side_effect = None
        search.return_value = SimpleNamespace(news=[])
        rss.side_effect = None
        rss.return_value = []
        self.assertEqual(company_news('AAPL')['status'], 'empty')

    def test_invalid_parameters_rejected_before_network(self):
        for ticker, count in [('AAPL', 0), ('AAPL', 21), ('not/a/ticker', 5)]:
            with self.assertRaises(ValueError): company_news(ticker, count)
