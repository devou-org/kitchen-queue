'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { 
  Bot, Send, Sparkles, Trash2, TrendingUp, ShoppingBag, 
  Clock, AlertTriangle, Activity, Zap, RefreshCw, X, Maximize2, Minimize2,
  CheckCircle2, ChevronRight, MessageSquare, User
} from 'lucide-react';

import { useRestaurant } from '@/hooks/useRestaurant';
import { SalesTrendChart } from './SalesTrendChart';

interface ChatMessage {
  id?: string;
  role: 'user' | 'model';
  content: string;
  tool_calls?: any[];
  tool_results?: any[];
  tokens_used?: number;
  created_at?: string;
}

interface ChatSession {
  id: string;
  title: string;
  updated_at: string;
}

const QDINE_LOGO_URL = 'https://ik.imagekit.io/j2q8x5lu0/qdine/qdine-logo-rotated.png';

const QUICK_PROMPTS = [
  { label: 'Sales Summary', query: 'How much did we sell yesterday vs today?', icon: TrendingUp },
  { label: 'Top Products', query: 'What are our top 5 best selling items this week?', icon: ShoppingBag },
  { label: 'Peak Rush Hours', query: 'What time of day do we make the most sales?', icon: Clock },
  { label: 'Cancellations', query: 'Analyze our order cancellation rate and revenue lost.', icon: AlertTriangle },
  { label: 'Weekly Compare', query: 'Compare our sales performance between this week and last week.', icon: Activity },
  { label: 'Low Stock Alert', query: 'Which items are currently low in stock or out of stock?', icon: Zap },
];

export function AIAnalystWidget({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const { slug } = useParams();
  const slugStr = Array.isArray(slug) ? slug[0] : slug;
  const { restaurant } = useRestaurant();
  const primaryColor = restaurant?.primary_color || '#059669';

  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isExpanded, setIsExpanded] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeToolStep, setActiveToolStep] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, activeToolStep, isOpen]);

  useEffect(() => {
    if (slugStr && isOpen && sessions.length === 0) {
      fetchSessions();
    }
  }, [slugStr, isOpen]);

  const fetchSessions = async () => {
    try {
      const headers: Record<string, string> = slugStr ? { 'x-restaurant-slug': slugStr } : {};
      const res = await fetch('/api/ai/chat', { headers });
      const data = await res.json();
      if (data.success && data.sessions) {
        setSessions(data.sessions);
        if (data.sessions.length > 0 && !activeSessionId) {
          setActiveSessionId(data.sessions[0].id);
          fetchMessages(data.sessions[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch AI sessions:', err);
    }
  };

  const fetchMessages = async (sessionId: string) => {
    try {
      const headers: Record<string, string> = slugStr ? { 'x-restaurant-slug': slugStr } : {};
      const res = await fetch(`/api/ai/chat?sessionId=${sessionId}`, { headers });
      const data = await res.json();
      if (data.success && data.messages) {
        setMessages(data.messages);
      }
    } catch (err) {
      console.error('Failed to fetch AI messages:', err);
    }
  };

  const handleSelectSession = (sessionId: string) => {
    setActiveSessionId(sessionId);
    fetchMessages(sessionId);
  };

  const handleNewChat = () => {
    setActiveSessionId(null);
    setMessages([]);
  };

  const handleClearHistory = async () => {
    if (!confirm('Clear AI chat history?')) return;
    try {
      const headers: Record<string, string> = slugStr ? { 'x-restaurant-slug': slugStr } : {};
      await fetch('/api/ai/chat', {
        method: 'DELETE',
        headers
      });
      setActiveSessionId(null);
      setMessages([]);
      setSessions([]);
    } catch (err) {
      console.error('Failed to clear history:', err);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || loading) return;

    setInputMessage('');
    const userMsg: ChatMessage = { role: 'user', content: text, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    setActiveToolStep('Planning & analyzing metrics...');

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (slugStr) headers['x-restaurant-slug'] = slugStr;

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: text,
          sessionId: activeSessionId || undefined
        })
      });

      const data = await res.json();

      if (data.sessionId && data.sessionId !== activeSessionId) {
        setActiveSessionId(data.sessionId);
        fetchSessions();
      }

      if (data.success) {
        const assistantMsg: ChatMessage = {
          role: 'model',
          content: data.message,
          tool_calls: data.toolCalls,
          tokens_used: data.tokens?.total,
          created_at: new Date().toISOString()
        };
        setMessages(prev => [...prev, assistantMsg]);
      } else {
        setMessages(prev => [
          ...prev,
          {
            role: 'model',
            content: `⚠️ ${data.error || 'Failed to process request.'}`,
            created_at: new Date().toISOString()
          }
        ]);
      }
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          role: 'model',
          content: '⚠️ Connection error. Please try again.',
          created_at: new Date().toISOString()
        }
      ]);
    } finally {
      setLoading(false);
      setActiveToolStep(null);
    }
  };

  const formatContent = (content: string) => {
    const lines = content.split('\n');
    return lines.map((line, idx) => {
      if (line.startsWith('### ')) {
        return <h3 key={idx} style={{ fontSize: '14px', fontWeight: 800, marginTop: '12px', marginBottom: '6px', color: '#0F172A' }}>{line.replace('### ', '')}</h3>;
      }
      if (line.startsWith('## ') || line.startsWith('# ')) {
        return <h2 key={idx} style={{ fontSize: '15px', fontWeight: 800, marginTop: '14px', marginBottom: '8px', color: '#0F172A' }}>{line.replace(/^#+\s*/, '')}</h2>;
      }
      if (line.startsWith('- ') || line.startsWith('* ')) {
        const bulletText = line.substring(2);
        return (
          <div key={idx} style={{ display: 'flex', gap: '6px', marginBottom: '4px', alignItems: 'flex-start' }}>
            <span style={{ color: '#059669', fontWeight: 'bold' }}>•</span>
            <span dangerouslySetInnerHTML={{ __html: formatBold(bulletText) }} />
          </div>
        );
      }
      if (line.trim() === '') {
        return <div key={idx} style={{ height: '6px' }} />;
      }
      return (
        <p key={idx} style={{ marginBottom: '6px', lineHeight: 1.5 }} dangerouslySetInnerHTML={{ __html: formatBold(line) }} />
      );
    });
  };

  const formatBold = (text: string) => {
    return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  };

  return (
    <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999, fontFamily: 'inherit' }}>
      {/* Floating Trigger Button */}
      {!isOpen && (
        <div
          onClick={() => setIsOpen(true)}
          style={{
            position: 'relative',
            padding: '2px',
            borderRadius: '50px',
            background: `linear-gradient(90deg, ${primaryColor}, #34D399, #60A5FA, #A855F7, ${primaryColor})`,
            backgroundSize: '300% 300%',
            animation: 'animatedBorder 3s linear infinite',
            boxShadow: `0 4px 18px ${primaryColor}4D`,
            cursor: 'pointer',
            transition: 'transform 0.2s ease-in-out',
            display: 'inline-block'
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.04) translateY(-1px)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1) translateY(0)'}
        >
          <button
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '10px 22px',
              borderRadius: '48px',
              background: primaryColor,
              color: '#FFFFFF',
              border: 'none',
              fontWeight: 700,
              fontSize: '14px',
              letterSpacing: '0.02em',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            <Bot size={18} />
            <span>AI Analyst</span>
          </button>
        </div>
      )}

      {/* Expanded Floating Chat Panel */}
      {isOpen && (
        <div
          style={{
            width: isExpanded ? '680px' : '420px',
            height: isExpanded ? '720px' : '560px',
            maxWidth: 'calc(100vw - 32px)',
            maxHeight: 'calc(100vh - 40px)',
            background: '#FFFFFF',
            borderRadius: '24px',
            border: '1px solid #E2E8F0',
            boxShadow: `0 20px 50px rgba(15, 23, 42, 0.15), 0 10px 20px ${primaryColor}1A`,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            animation: 'slideUp 0.3s ease-out'
          }}
        >
          {/* Minimal Header */}
          <div style={{
            padding: '12px 16px',
            background: '#FFFFFF',
            borderBottom: '1px solid #F1F5F9',
            color: '#0F172A',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '26px', height: '26px', borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #E2E8F0' }}>
                <img 
                  src={QDINE_LOGO_URL} 
                  alt="Qdine Logo" 
                  style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scale(1.3)' }} 
                />
              </div>
              <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0, color: '#0F172A' }}>
                Qdine AI Analyst
              </h3>
            </div>

            {/* Minimal Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                onClick={handleNewChat}
                title="New Chat"
                style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#64748B', padding: '6px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                <Sparkles size={14} />
              </button>

              {messages.length > 0 && (
                <button
                  onClick={handleClearHistory}
                  title="Clear Chat"
                  style={{ background: '#FEF2F2', border: '1px solid #FEE2E2', color: '#EF4444', padding: '6px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                  <Trash2 size={14} />
                </button>
              )}

              <button
                onClick={() => setIsExpanded(!isExpanded)}
                title={isExpanded ? 'Minimize width' : 'Maximize width'}
                style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#64748B', padding: '6px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>

              <button
                onClick={() => setIsOpen(false)}
                title="Close"
                style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#64748B', padding: '6px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Messages Body */}
          <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px', background: '#F8FAFC' }}>
            {messages.length === 0 && !loading && (
              <div style={{ textAlign: 'center', margin: 'auto 0', padding: '20px 10px' }}>
                <div style={{
                  width: '44px', height: '44px', borderRadius: '50%',
                  background: '#FFFFFF', border: '1px solid #E2E8F0',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 12px', overflow: 'hidden', flexShrink: 0
                }}>
                  <img src={QDINE_LOGO_URL} alt="Qdine Logo" style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scale(1.3)' }} />
                </div>
                <h4 style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', marginBottom: '4px' }}>
                  Ask Qdine AI Analyst
                </h4>
                <p style={{ fontSize: '12px', color: '#64748B', maxWidth: '320px', margin: '0 auto 16px', lineHeight: 1.5 }}>
                  Get instant data-driven answers on your sales, orders, peak hours, and inventory.
                </p>

                {/* Quick Prompts */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px', textAlign: 'left' }}>
                  {QUICK_PROMPTS.slice(0, 4).map((item, idx) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={idx}
                        onClick={() => handleSendMessage(item.query)}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '12px',
                          border: '1px solid #E2E8F0',
                          background: '#FFFFFF',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '10px',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = '#059669';
                          e.currentTarget.style.background = '#F0FDF4';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = '#E2E8F0';
                          e.currentTarget.style.background = '#FFFFFF';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <Icon size={16} color="#059669" />
                          <span style={{ fontSize: '12px', fontWeight: 600, color: '#1E293B' }}>{item.query}</span>
                        </div>
                        <ChevronRight size={14} color="#94A3B8" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Chat List */}
            {messages.map((msg, idx) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    gap: '8px',
                    flexDirection: isUser ? 'row-reverse' : 'row',
                    alignItems: 'flex-start'
                  }}
                >
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: isUser ? '#F1F5F9' : '#FFFFFF',
                    color: isUser ? primaryColor : '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    border: '1px solid #E2E8F0',
                    overflow: 'hidden'
                  }}>
                    {isUser ? (
                      restaurant?.logo_url ? (
                        <img src={restaurant.logo_url} alt={restaurant.name || 'Restaurant'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ fontSize: '11px', fontWeight: 800, color: primaryColor }}>
                          {restaurant?.name ? restaurant.name.charAt(0).toUpperCase() : <User size={13} />}
                        </div>
                      )
                    ) : (
                      <img src={QDINE_LOGO_URL} alt="Qdine" style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scale(1.3)' }} />
                    )}
                  </div>

                  <div style={{ maxWidth: '82%' }}>
                    <div style={{
                      padding: '8px 12px',
                      borderRadius: isUser ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                      background: isUser ? primaryColor : '#FFFFFF',
                      color: isUser ? '#FFFFFF' : '#0F172A',
                      border: isUser ? 'none' : '1px solid #E2E8F0',
                      fontSize: '13px',
                      lineHeight: 1.45,
                      boxShadow: isUser ? 'none' : '0 1px 3px rgba(0, 0, 0, 0.02)'
                    }}>
                      {isUser ? (
                        <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{msg.content}</p>
                      ) : (
                        <div>
                          {formatContent(msg.content)}
                          <SalesTrendChart toolCalls={msg.tool_calls} primaryColor={primaryColor} />
                        </div>
                      )}
                    </div>

                    {!isUser && msg.tool_calls && msg.tool_calls.length > 0 && (
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                        {msg.tool_calls.map((t: any, i: number) => (
                          <span key={i} style={{
                            fontSize: '10px',
                            fontWeight: 500,
                            background: '#F8FAFC',
                            color: '#64748B',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            border: '1px solid #F1F5F9'
                          }}>
                            <CheckCircle2 size={10} color={primaryColor} /> Verified via {t.name}()
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Thinking indicator */}
            {loading && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div style={{
                  width: '24px', height: '24px', borderRadius: '50%',
                  background: '#FFFFFF', border: '1px solid #E2E8F0',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden'
                }}>
                  <img src={QDINE_LOGO_URL} alt="Qdine" style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scale(1.3)' }} />
                </div>
                <div style={{
                  padding: '8px 14px', borderRadius: '14px',
                  background: `${primaryColor}0D`,
                  border: `1px solid ${primaryColor}26`,
                  display: 'flex', alignItems: 'center', gap: '8px'
                }}>
                  <RefreshCw size={13} color={primaryColor} style={{ animation: 'spin 1.2s linear infinite' }} />
                  <span style={{ fontSize: '12px', fontWeight: 600, color: primaryColor, opacity: 0.85 }}>
                    {activeToolStep || 'Planning & analyzing metrics...'}
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Footer */}
          <div style={{
            padding: '12px 14px',
            borderTop: '1px solid #E2E8F0',
            background: '#FFFFFF',
            display: 'flex',
            gap: '8px',
            alignItems: 'center'
          }}>
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
              placeholder="Ask sales, peak hours, cancellations..."
              disabled={loading}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: '12px',
                border: '1px solid #CBD5E1',
                fontSize: '13px',
                outline: 'none',
                background: '#F8FAFC',
                color: '#0F172A'
              }}
              onFocus={(e) => e.target.style.borderColor = primaryColor}
              onBlur={(e) => e.target.style.borderColor = '#CBD5E1'}
            />

            <button
              onClick={() => handleSendMessage()}
              disabled={loading || !inputMessage.trim()}
              style={{
                padding: '10px 16px',
                borderRadius: '12px',
                background: loading || !inputMessage.trim() ? '#E2E8F0' : primaryColor,
                color: loading || !inputMessage.trim() ? '#94A3B8' : '#FFFFFF',
                border: 'none',
                fontWeight: 700,
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: loading || !inputMessage.trim() ? 'not-allowed' : 'pointer'
              }}
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes subtlePulse {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.7); }
          70% { transform: scale(1.1); box-shadow: 0 0 0 6px rgba(52, 211, 153, 0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(52, 211, 153, 0); }
        }
        @keyframes animatedBorder {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
    </div>
  );
}
