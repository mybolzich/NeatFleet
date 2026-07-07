import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, MessageSquare, AlertCircle, RefreshCw, Terminal, Info } from 'lucide-react';
import { Stop, Vehicle, OptimizerConfig } from '../types';

interface AICopilotProps {
  stops: Stop[];
  vehicles: Vehicle[];
  config: OptimizerConfig;
}

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export const AICopilot: React.FC<AICopilotProps> = ({ stops, vehicles, config }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `### 🤖 RouteManager AI Copilot Active

I can analyze your active dispatch schedule, diagnose delays, and provide tactical recommendations.

**Click one of the Quick Analysis queries below** or ask me anything!`,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleQuery = async (customPrompt?: string) => {
    const promptToSend = customPrompt || input;
    if (!promptToSend.trim() || loading) return;

    // Add user message
    const userMessage: Message = { role: 'user', content: promptToSend };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ai-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stops,
          vehicles,
          config,
          customPrompt: promptToSend,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Server returned an error.');
      }

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.analysis || 'No analysis generated.' },
      ]);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to generate advisory report.');
      setMessages((prev) => [
        ...prev,
        {
          role: 'system',
          content: `⚠️ **Advisory Error**: Could not connect to Gemini AI. Please ensure your API key is correctly configured in **Settings > Secrets** in the AI Studio environment.`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([
      {
        role: 'assistant',
        content: `### 🤖 RouteManager AI Copilot Active\n\nHow can I help you optimize your routes today?`,
      },
    ]);
  };

  return (
    <div className="flex flex-col h-full bg-white border border-slate-200 rounded-2xl p-4 overflow-hidden shadow-xs">
      {/* Panel Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-500 animate-pulse" />
          <h2 className="text-base font-bold text-slate-800 font-sans">AI Dispatch Copilot</h2>
        </div>
        <button
          onClick={clearChat}
          className="text-[10px] text-slate-400 hover:text-slate-600 transition underline font-mono cursor-pointer"
        >
          Reset Chat
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 mb-4 select-text">
        {messages.map((m, i) => {
          const isAssistant = m.role === 'assistant';
          const isSystem = m.role === 'system';

          return (
            <div
              key={i}
              className={`p-3.5 rounded-xl border max-w-[92%] text-xs leading-relaxed font-sans ${
                isSystem
                  ? 'bg-red-50 border-red-200 text-red-700 mx-auto w-full'
                  : isAssistant
                  ? 'bg-slate-50 border-slate-200 text-slate-850 mr-auto'
                  : 'bg-blue-50/70 border-blue-200/60 text-slate-800 ml-auto'
              }`}
            >
              {isAssistant && (
                <div className="flex items-center gap-1.5 text-[10px] text-amber-600 font-bold uppercase tracking-wider mb-2 select-none">
                  <Sparkles className="w-3.5 h-3.5" /> Route Advisor
                </div>
              )}

              {/* Simple Markdown renderer approximation */}
              <div className="space-y-2 whitespace-pre-wrap">
                {m.content.split('\n').map((line, lIdx) => {
                  if (line.startsWith('### ')) {
                    return <h3 key={lIdx} className="text-sm font-bold text-slate-900 mt-2">{line.replace('### ', '')}</h3>;
                  }
                  if (line.startsWith('**') && line.endsWith('**')) {
                    return <strong key={lIdx} className="block text-slate-800 mt-1">{line.replace(/\*\*/g, '')}</strong>;
                  }
                  if (line.startsWith('- ')) {
                    return <li key={lIdx} className="ml-4 list-disc text-slate-600">{line.replace('- ', '')}</li>;
                  }
                  return <p key={lIdx} className="text-slate-600">{line}</p>;
                })}
              </div>
            </div>
          );
        })}

        {/* AI Loading State with visual tickers */}
        {loading && (
          <div className="p-4 rounded-xl border bg-slate-50 border-slate-200 text-xs text-slate-700 flex flex-col gap-3 mr-auto max-w-[85%] animate-pulse shadow-xs">
            <div className="flex items-center gap-2 text-amber-600 font-bold text-[10px] uppercase tracking-wider">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Thinking...
            </div>
            <div className="space-y-1.5 font-mono text-[10px] text-slate-400">
              <div>&gt; Loading fleet metrics and GPS logs...</div>
              <div>&gt; Scanning traffic zone delay vectors...</div>
              <div>&gt; Evaluating VRP solver convergence...</div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Quick Analysis Shortcut Presets */}
      <div className="mb-3 space-y-1.5">
        <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider block">Quick Queries</span>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => handleQuery('Provide a full diagnostic analysis of this routing profile')}
            disabled={loading}
            className="px-2.5 py-1 text-[10px] bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-800 border border-slate-200 rounded-lg transition shadow-xs cursor-pointer"
          >
            📋 Full Diagnostics Report
          </button>
          <button
            onClick={() => handleQuery('Suggest how to fix the delays')}
            disabled={loading}
            className="px-2.5 py-1 text-[10px] bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-800 border border-slate-200 rounded-lg transition shadow-xs cursor-pointer"
          >
            ⏱️ Fix Late Deliveries
          </button>
          <button
            onClick={() => handleQuery('How can I optimize truck capacities?')}
            disabled={loading}
            className="px-2.5 py-1 text-[10px] bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-800 border border-slate-200 rounded-lg transition shadow-xs cursor-pointer"
          >
            📦 Balance Cargo Load
          </button>
        </div>
      </div>

      {/* Input Message Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleQuery();
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
          placeholder="Ask Copilot about routing, delays, or drivers..."
          className="flex-1 bg-white border border-slate-200 text-slate-800 placeholder:text-slate-400 text-xs rounded-xl px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-100 disabled:text-slate-300 text-white p-2.5 rounded-xl transition cursor-pointer shadow-xs"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
