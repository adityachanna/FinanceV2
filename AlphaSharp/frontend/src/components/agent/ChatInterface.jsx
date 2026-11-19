import { useState, useRef, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { agentService } from '../../services/agentService';
import RichText from '../common/RichText';

const STARTERS = [
  'What is Apple’s valuation?',
  'How has Tesla performed?',
  'Show Microsoft financials',
  'What is the market risk right now?',
];

export default function ChatInterface({ mode = 'built-in' }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [threadId] = useState(`thread_${Date.now()}`);
  const listRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const ask = async (question) => {
    const text = question.trim();
    if (!text || loading) return;
    setMessages(prev => [...prev, { id: Date.now(), role: 'user', content: text }]);
    setInput('');
    setLoading(true);
    try {
      const result = await agentService.queryAgent(text, threadId);
      const response = result?.data ?? result;
      setMessages(prev => [...prev, {
        id: Date.now() + 1, role: 'assistant',
        content: response.response || response.answer || response.message || 'No answer was returned.',
      }]);
    } catch (error) {
      const timedOut = error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT';
      setMessages(prev => [...prev, {
        id: Date.now() + 1, role: 'assistant', isError: true,
        content: timedOut
          ? 'The answer took too long. Ask again, or shorten the question.'
          : error.response?.data?.message || 'The model service did not answer. Check that AlphaSharp is still running, then ask again.',
      }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="chat-panel">
      <div className="chat-log" ref={listRef} aria-live="polite">
        {messages.length === 0 && (
          <div className="chat-empty">
            <h2>Ask about a company or the market</h2>
            <p>{mode === 'ai'
              ? 'Answers use live company data and AlphaSharp’s regime model.'
              : 'Answers come from Yahoo Finance data and AlphaSharp’s regime model. Add an OpenRouter key for open-ended AI answers.'}</p>
            <div className="chat-starters">
              {STARTERS.map(starter => <button key={starter} type="button" onClick={() => ask(starter)}>{starter}</button>)}
            </div>
          </div>
        )}
        {messages.map(message => (
          <div key={message.id} className={`chat-message ${message.role}${message.isError ? ' error' : ''}`}>
            {message.role === 'user'
              ? <p>{message.content}</p>
              : <RichText text={message.content} />}
          </div>
        ))}
        {loading && (
          <div className="chat-message assistant pending">
            <Loader2 size={16} className="spin" />
            <span>{mode === 'ai' ? 'Gathering data and writing an answer. This can take a minute.' : 'Fetching data…'}</span>
          </div>
        )}
      </div>
      <form className="chat-compose" onSubmit={event => { event.preventDefault(); ask(input); }}>
        <label htmlFor="chat-input" className="sr-only">Your question</label>
        <input id="chat-input" ref={inputRef} type="text" value={input} onChange={event => setInput(event.target.value)}
          placeholder="For example: Is NVDA expensive compared with AMD?" disabled={loading} autoComplete="off" />
        <button type="submit" className="primary-button" disabled={!input.trim() || loading}><Send size={16} />Ask</button>
      </form>
    </div>
  );
}
