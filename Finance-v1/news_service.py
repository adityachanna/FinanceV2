"""Company news without the retired Yahoo /xhr/ncp ticker-news endpoint."""
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
import html
import logging
import re
from urllib.parse import urlsplit
import xml.etree.ElementTree as ET

import requests
import yfinance as yf

logger = logging.getLogger(__name__)


def plain(value):
    return html.unescape(re.sub(r'<[^>]*>', '', value)).strip() if isinstance(value, str) else ''


def web_url(value):
    if isinstance(value, dict):
        value = value.get('url')
    if not isinstance(value, str):
        return None
    parsed = urlsplit(value.strip())
    return value.strip() if parsed.scheme in ('http', 'https') and parsed.hostname else None


def published(value):
    try:
        if isinstance(value, (int, float)):
            date = datetime.fromtimestamp(value, timezone.utc)
        elif isinstance(value, str):
            try:
                date = datetime.fromisoformat(value.replace('Z', '+00:00'))
            except ValueError:
                date = parsedate_to_datetime(value)
        else:
            return None
        return date.replace(tzinfo=date.tzinfo or timezone.utc).astimezone(timezone.utc).isoformat()
    except (ValueError, TypeError, OverflowError, OSError):
        return None


def normalize_articles(items, limit):
    articles, seen_urls, seen_titles = [], set(), set()
    for item in items or []:
        if not isinstance(item, dict) or item.get('ad'):
            continue
        content = item.get('content') if isinstance(item.get('content'), dict) else item
        title = plain(content.get('title'))
        candidates = [content.get(key) for key in ['canonicalUrl', 'clickThroughUrl', 'link', 'url']]
        url = next((url for value in candidates if (url := web_url(value))), None)
        if not title or not url or url in seen_urls or title.casefold() in seen_titles:
            continue
        provider = content.get('provider') or item.get('provider') or {}
        publisher = provider.get('displayName') if isinstance(provider, dict) else provider
        publisher = plain(publisher or content.get('publisher')) or 'Yahoo Finance'
        date = content.get('pubDate') or content.get('providerPublishTime') or content.get('published_at')
        articles.append({'title': title, 'url': url, 'publisher': publisher,
                         'published_at': published(date), 'summary': plain(content.get('summary') or content.get('description'))})
        seen_urls.add(url)
        seen_titles.add(title.casefold())
    articles.sort(key=lambda item: item['published_at'] or '', reverse=True)
    return articles[:limit]


def rss_news(ticker):
    response = requests.get('https://feeds.finance.yahoo.com/rss/2.0/headline',
                            params={'s': ticker, 'region': 'US', 'lang': 'en-US'},
                            headers={'User-Agent': 'AlphaSharp/1.0'}, timeout=12)
    response.raise_for_status()
    if len(response.content) > 2_000_000:
        raise ValueError('News feed exceeds the size limit')
    root = ET.fromstring(response.content)
    return [{'title': item.findtext('title'), 'link': item.findtext('link'),
             'publisher': item.findtext('source') or 'Yahoo Finance',
             'pubDate': item.findtext('pubDate'), 'summary': item.findtext('description')}
            for item in root.findall('.//item')]


def company_news(ticker, max_items=5):
    ticker = ticker.strip().upper()
    if not re.fullmatch(r'[A-Z0-9^][A-Z0-9.\-=^]{0,24}', ticker):
        raise ValueError('Use a valid ticker symbol')
    if not 1 <= max_items <= 20:
        raise ValueError('Request between 1 and 20 news articles')
    source, errors, available = 'Yahoo Finance Search', [], False
    try:
        raw = yf.Search(ticker, max_results=0, news_count=max_items, lists_count=0,
                        include_cb=False, timeout=12).news
        articles = normalize_articles(raw, max_items)
        available = True
    except Exception as error:
        logger.warning('Yahoo search news failed for %s: %s', ticker, error)
        errors.append(error)
        articles = []
    if not articles:
        try:
            articles = normalize_articles(rss_news(ticker), max_items)
            source, available = 'Yahoo Finance RSS', True
        except Exception as error:
            logger.warning('Yahoo RSS news failed for %s: %s', ticker, error)
            errors.append(error)
    if not available:
        raise RuntimeError('Yahoo Finance news is temporarily unavailable. Try refreshing shortly.') from errors[-1]
    return {'ticker': ticker, 'news_data': articles, 'source': source, 'ai_generated': False,
            'status': 'available' if articles else 'empty', 'total_news_count': len(articles),
            'retrieved_at': datetime.now(timezone.utc).isoformat()}
