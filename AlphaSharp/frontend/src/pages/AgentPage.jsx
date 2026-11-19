import { useEffect, useState } from 'react';
import { KeyRound, Database } from 'lucide-react';
import ChatInterface from '../components/agent/ChatInterface';
import { agentService } from '../services/agentService';

export default function AgentPage() {
  const [mode, setMode] = useState(null);
  useEffect(() => {
    agentService.getStatus()
      .then(result => setMode((result?.data ?? result)?.configured ? 'ai' : 'built-in'))
      .catch(() => setMode('built-in'));
  }, []);

  return <div className="workspace-page">
    <div className="workspace-intro"><div>
      <h1>Assistant</h1>
      <p>Ask about valuations, company financials, recent price moves or current market risk.</p>
    </div></div>
    {mode === null ? <div className="panel empty-copy">Checking the assistant…</div> : <div className="agent-layout">
      <ChatInterface mode={mode} />
      <aside className="panel agent-aside">
        {mode === 'ai' ? <>
          <h2><KeyRound size={18} />AI answers are on</h2>
          <p>The assistant uses an OpenRouter model with tools for company financials, price history and the HSMM risk snapshot. If the provider fails, the built-in analyst answers instead.</p>
        </> : <>
          <h2><Database size={18} />Built-in analyst</h2>
          <p>No AI key is set, so answers are assembled directly from Yahoo Finance and the regime model. Every figure in an answer is a figure from the data.</p>
          <p>It understands four kinds of question: valuation, financials, price performance and market risk. Name the company or its ticker.</p>
          <p className="agent-hint">To turn on open-ended AI answers, paste an OpenRouter key into the <code>.env</code> file in the AlphaSharp folder and restart.</p>
        </>}
        <p className="agent-hint">Check figures against the source before relying on them. Nothing here is investment advice.</p>
      </aside>
    </div>}
  </div>;
}
