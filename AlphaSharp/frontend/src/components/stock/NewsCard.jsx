import { ExternalLink, Clock, RefreshCw } from 'lucide-react';

function formatDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const elapsed = Date.now() - date.getTime();
  if (elapsed >= 0 && elapsed < 3600000) return `${Math.floor(elapsed / 60000)}m ago`;
  if (elapsed >= 0 && elapsed < 86400000) return `${Math.floor(elapsed / 3600000)}h ago`;
  if (elapsed >= 0 && elapsed < 604800000) return `${Math.floor(elapsed / 86400000)}d ago`;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function NewsCard({ articles = [], loading = false, error = '', source = 'Yahoo Finance', onRefresh }) {
  return <section className="news-panel" aria-busy={loading}>
    <div className="news-heading"><div><h3>Company news</h3><p>{source}. Publisher headlines and links.</p></div>{onRefresh && <button type="button" className="outline-button" onClick={onRefresh} disabled={loading}><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh news</button>}</div>
    {loading ? <p className="news-status" role="status">Loading company headlines…</p> : error ? <p className="news-status news-error" role="alert">{error}</p> : !articles.length ? <p className="news-status">No recent articles were returned for this company. Try refreshing later.</p> : <div className="news-list">{articles.map(article => {
      const published = article.published_at || article.publish_time || article.date;
      const date = formatDate(published);
      return <a className="news-article" key={article.url || article.link} href={article.url || article.link} target="_blank" rel="noopener noreferrer"><div className="news-article-meta"><span>{article.publisher || article.source || 'Yahoo Finance'}</span>{date && <time dateTime={published}><Clock size={12} />{date}</time>}</div><div className="news-article-title"><h4>{article.title || article.headline}</h4><ExternalLink size={16} /></div>{(article.summary || article.description) && <p>{article.summary || article.description}</p>}</a>;
    })}</div>}
  </section>;
}
