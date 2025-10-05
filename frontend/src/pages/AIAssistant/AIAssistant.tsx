import React, { useState, useRef, useEffect } from 'react';
import './AIAssistant.css';
import Navbar from '../../components/Navbar/Navbar';

// Types (unchanged)
interface ContextVerse {
  mandala: number;
  sukta: number;
  rik_number: number;
  translation?: string;
  devanagari?: string;
  transliteration?: string;
  deity?: string;
}

interface VerseDetail {
  rik_number: number;
  samhita: {
    devanagari: { text: string };
  };
  padapatha: {
    devanagari: { text: string };
    transliteration: { text: string };
  };
  translation: string;
  deity: string;
}

interface AIResponse {
  query: string;
  context: ContextVerse[];
  answer: string;
}

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  context?: ContextVerse[];
}

interface SelectedVerse {
  detail: VerseDetail;
  context: ContextVerse;
}

const AIAssistant: React.FC = () => {
  // State management
  const [query, setQuery] = useState('');
  const [maxResults, setMaxResults] = useState<number>(5);
  const [selectedFields, setSelectedFields] = useState<string[]>(['translation']);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedVerse, setSelectedVerse] = useState<SelectedVerse | null>(null);
  const [loadingVerse, setLoadingVerse] = useState(false);
  const [expandedVerses, setExpandedVerses] = useState<Set<string>>(new Set());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Toggle verse expansion
  const toggleVerseExpansion = (verseId: string) => {
    setExpandedVerses(prev => {
      const newSet = new Set(prev);
      if (newSet.has(verseId)) {
        newSet.delete(verseId);
      } else {
        newSet.add(verseId);
      }
      return newSet;
    });
  };

  // Format markdown-like text
  const formatMessage = (text: string) => {
    return text
      .split('\n')
      .map((line, index) => {
        if (line.startsWith('## ')) {
          return <h4 key={index} className="ai-message-header">{line.replace('## ', '')}</h4>;
        }
        const boldRegex = /\*\*(.*?)\*\*/g;
        const parts = line.split(boldRegex);
        if (parts.length > 1) {
          return (
            <p key={index} className="ai-message-paragraph">
              {parts.map((part, i) => 
                i % 2 === 1 ? <strong key={i} className="ai-message-bold">{part}</strong> : part
              )}
            </p>
          );
        }
        if (line.trim()) {
          return <p key={index} className="ai-message-paragraph">{line}</p>;
        }
        return <br key={index} />;
      });
  };

  // Handle AI query submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: query,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setLoading(true);
    setError(null);
    setSelectedVerse(null);
    setExpandedVerses(new Set());

    try {
      const params = new URLSearchParams({
        query: query,
        max_results: maxResults.toString()
      });

      selectedFields.forEach(field => {
        params.append('fields', field);
      });

      const response = await fetch(`/ai-assistant?${params}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      const data: AIResponse = await response.json();
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: data.answer,
        timestamp: new Date(),
        context: data.context
      };

      setMessages(prev => [...prev, assistantMessage]);
      setQuery('');
    } catch (err) {
      setError('Failed to get AI response. Please try again.');
      console.error('AI Assistant error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch detailed verse information
  const fetchVerseDetail = async (verse: ContextVerse) => {
    try {
      setLoadingVerse(true);
      const response = await fetch(`/mandala/${verse.mandala}/sukta/${verse.sukta}/rik/${verse.rik_number}`);
      if (!response.ok) {
        throw new Error('Failed to fetch verse details');
      }
      const detail: VerseDetail = await response.json();
      setSelectedVerse({
        detail,
        context: verse
      });
    } catch (err) {
      setError('Failed to fetch verse details');
      console.error('Verse detail error:', err);
    } finally {
      setLoadingVerse(false);
    }
  };

  // Handle field selection
  const handleFieldToggle = (field: string) => {
    setSelectedFields(prev =>
      prev.includes(field)
        ? prev.filter(f => f !== field)
        : [...prev, field]
    );
  };

  // Handle context verse click
  const handleContextVerseClick = (verse: ContextVerse) => {
    fetchVerseDetail(verse);
  };

  // Clear conversation
  const handleClearChat = () => {
    setMessages([]);
    setSelectedVerse(null);
    setError(null);
    setExpandedVerses(new Set());
  };

  // Get all reference verses from messages
  const getAllReferenceVerses = () => {
    return messages
      .filter(msg => msg.type === 'assistant' && msg.context)
      .flatMap(msg => msg.context || []);
  };

  // Suggested questions
  const suggestedQuestions = [
    "Who is Agni in the Rigveda?",
    "Explain the concept of Rita in the Vedas",
    "What are the main deities mentioned in the first Mandala?",
    "Tell me about the creation hymns in Rigveda",
    "How is Soma described in the Rigveda?",
    "What is the significance of Yajna in Rigveda?",
    "Explain the role of Indra in Rigvedic hymns"
  ];

  // Get verse ID for expansion tracking
  const getVerseId = (verse: ContextVerse) => 
    `M${verse.mandala}S${verse.sukta}R${verse.rik_number}`;

  const referenceVerses = getAllReferenceVerses();

  return (
    <div className="ai-assistant-page">
      <Navbar />
      
      {/* Header */}
      <div className="search-header">
        <div className="ai-header-content">
          <h1>Rigveda AI Assistant</h1>
          <p>Ask questions and explore the wisdom of the Rigveda with AI-powered insights</p>
        </div>
      </div>

      <div className="ai-main-container">
        {/* Main Content Area */}
        <div className="ai-content-wrapper">
          {/* Chat Panel */}
          <div className={`ai-chat-panel ${sidebarCollapsed ? 'ai-chat-panel-expanded' : ''}`}>
            <div className="ai-chat-header">
              <div className="ai-chat-title">
                <h2>AI Chatbot</h2>
              </div>
              <div className="ai-chat-controls">
                <button 
                  className="ai-btn ai-btn-secondary ai-btn-clear"
                  onClick={handleClearChat}
                  disabled={messages.length === 0}
                >
                  <i className="ai-icon ai-icon-clear"></i>
                  Clear Chat
                </button>
                <button 
                  className="ai-btn ai-btn-icon ai-toggle-sidebar"
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  title={sidebarCollapsed ? "Show References" : "Hide References"}
                >
                  <i className={`ai-icon ai-icon-${sidebarCollapsed ? 'sidebar-show' : 'sidebar-hide'}`}></i>
                </button>
              </div>
            </div>

            {/* Chat Messages */}
            <div className="ai-chat-messages" ref={chatContainerRef}>
              {messages.length === 0 ? (
                <div className="ai-welcome-state">
                  <div className="ai-welcome-icon">
                    <i className="ai-icon ai-icon-veda"></i>
                  </div>
                  <h3>Welcome to Rigveda AI</h3>
                  <p>Ask me anything about deities, philosophy, verses, or historical context from the Rigveda.</p>

                  <div className="ai-suggestions">
                    <h4>Suggested Questions</h4>
                    <div className="ai-suggestion-grid">
                      {suggestedQuestions.map((question, index) => (
                        <button
                          key={index}
                          className="ai-suggestion-chip"
                          onClick={() => setQuery(question)}
                        >
                          {question}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="ai-features">
                    <div className="ai-feature-item">
                      <i className="ai-icon ai-icon-verse"></i>
                      <span>Verse References</span>
                    </div>
                    <div className="ai-feature-item">
                      <i className="ai-icon ai-icon-context"></i>
                      <span>Contextual Answers</span>
                    </div>
                    <div className="ai-feature-item">
                      <i className="ai-icon ai-icon-analysis"></i>
                      <span>Detailed Analysis</span>
                    </div>
                  </div>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`ai-message ai-${message.type}-message`}
                  >
                    <div className="ai-message-avatar">
                      {message.type === 'user' ? (
                        <i className="ai-icon ai-icon-user"></i>
                      ) : (
                        <i className="ai-icon ai-icon-bot"></i>
                      )}
                    </div>
                    <div className="ai-message-content">
                      <div className="ai-message-header">
                        <span className="ai-message-sender">
                          {message.type === 'user' ? 'You' : 'Rigveda AI'}
                        </span>
                        <span className="ai-message-time">
                          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="ai-message-text">
                        {formatMessage(message.content)}
                      </div>

                      {/* Context Verses for Assistant Messages */}
                      {message.type === 'assistant' && message.context && message.context.length > 0 && (
                        <div className="ai-context-section">
                          <div className="ai-context-header">
                            <i className="ai-icon ai-icon-references"></i>
                            <span>Reference Verses ({message.context.length})</span>
                          </div>
                          <div className="ai-context-grid">
                            {message.context.map((verse, index) => {
                              const verseId = getVerseId(verse);
                              const isExpanded = expandedVerses.has(verseId);
                              
                              return (
                                <div key={index} className="ai-context-card">
                                  <div
                                    className={`ai-context-preview ${isExpanded ? 'ai-expanded' : ''}`}
                                    onClick={() => toggleVerseExpansion(verseId)}
                                  >
                                    <div className="ai-context-header">
                                      <div className="ai-verse-meta">
                                        <span className="ai-verse-location">
                                          M{verse.mandala}.{verse.sukta}.{verse.rik_number}
                                        </span>
                                        {verse.deity && (
                                          <span className="ai-deity-badge">{verse.deity}</span>
                                        )}
                                      </div>
                                      <i className={`ai-icon ai-icon-chevron-${isExpanded ? 'up' : 'down'}`}></i>
                                    </div>
                                    {verse.translation && (
                                      <p className="ai-verse-preview">
                                        {verse.translation}
                                      </p>
                                    )}
                                  </div>

                                  {/* Expanded Details */}
                                  {isExpanded && (
                                    <div className="ai-verse-details">
                                      {verse.devanagari && (
                                        <div className="ai-verse-field">
                                          <label>Devanagari</label>
                                          <p className="ai-sanskrit-text">{verse.devanagari}</p>
                                        </div>
                                      )}
                                      {verse.transliteration && (
                                        <div className="ai-verse-field">
                                          <label>Transliteration</label>
                                          <p className="ai-transliteration">{verse.transliteration}</p>
                                        </div>
                                      )}
                                      {verse.translation && (
                                        <div className="ai-verse-field">
                                          <label>Translation</label>
                                          <p className="ai-translation">{verse.translation}</p>
                                        </div>
                                      )}
                                      <button 
                                        className="ai-btn ai-btn-outline ai-btn-view-details"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleContextVerseClick(verse);
                                        }}
                                      >
                                        <i className="ai-icon ai-icon-external"></i>
                                        View Full Details
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}

              {loading && (
                <div className="ai-message ai-assistant-message">
                  <div className="ai-message-avatar">
                  </div>
                  <div className="ai-message-content">
                    <div className="ai-message-header">
                      <span className="ai-message-sender">Rigveda AI</span>
                    </div>
                    <div className="ai-loading-state">
                      <div className="ai-typing-indicator">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                      <p>Searching through sacred texts...</p>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="ai-input-section">
              {error && (
                <div className="ai-error-banner">
                  <i className="ai-icon ai-icon-error"></i>
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="ai-input-form">
                <div className="ai-input-group">
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Ask about deities, philosophy, verses..."
                    className="ai-text-input"
                    disabled={loading}
                  />
                  <button 
                    type="submit" 
                    disabled={loading || !query.trim()}
                    className="ai-btn ai-btn-primary ai-send-button"
                  >
                    {loading ? (
                      <div className="ai-spinner"></div>
                    ) : (
                      <>
                        Send
                      </>
                    )}
                  </button>
                </div>

                <div className="ai-settings-panel">
                  <div className="ai-setting-group">
                    <label>Max References</label>
                    <select
                      value={maxResults}
                      onChange={(e) => setMaxResults(Number(e.target.value))}
                      className="ai-select"
                    >
                      {[3, 5, 8, 10].map(num => (
                        <option key={num} value={num}>{num}</option>
                      ))}
                    </select>
                  </div>

                  <div className="ai-setting-group">
                    <label>Include Fields</label>
                    <div className="ai-checkbox-group">
                      {[
                        { value: 'translation', label: 'Translation' },
                        { value: 'devanagari', label: 'Devanagari' },
                        { value: 'transliteration', label: 'Transliteration' },
                      ].map(field => (
                        <label key={field.value} className="ai-checkbox-label">
                          <input
                            type="checkbox"
                            checked={selectedFields.includes(field.value)}
                            onChange={() => handleFieldToggle(field.value)}
                            className="ai-checkbox"
                          />
                          <span className="ai-checkbox-custom"></span>
                          {field.label}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </form>
            </div>
          </div>

          {/* References Sidebar */}
          {!sidebarCollapsed && (
            <div className="ai-references-sidebar">
              <div className="ai-sidebar-header">
                <h3>
                  <i className="ai-icon ai-icon-book"></i>
                  Reference Verses
                  {referenceVerses.length > 0 && (
                    <span className="ai-count-badge">{referenceVerses.length}</span>
                  )}
                </h3>
                <p>Click any verse to view detailed analysis</p>
              </div>

              <div className="ai-sidebar-content">
                {selectedVerse ? (
                  <div className="ai-verse-detail-view">
                    <div className="ai-detail-header">
                      <h4>
                        Mandala {selectedVerse.context.mandala}, 
                        Sukta {selectedVerse.context.sukta}, 
                        Rik {selectedVerse.context.rik_number}
                      </h4>
                      {selectedVerse.detail.deity && (
                        <span className="ai-deity-tag">{selectedVerse.detail.deity}</span>
                      )}
                    </div>

                    <div className="ai-detail-section">
                      <h5>Samhita (Devanagari)</h5>
                      <p className="ai-sanskrit-text">{selectedVerse.detail.samhita.devanagari.text}</p>
                    </div>

                    <div className="ai-detail-section">
                      <h5>Padapatha</h5>
                      <p className="ai-sanskrit-text">{selectedVerse.detail.padapatha.devanagari.text}</p>
                      <p className="ai-transliteration">{selectedVerse.detail.padapatha.transliteration.text}</p>
                    </div>

                    <div className="ai-detail-section">
                      <h5>Translation</h5>
                      <p className="ai-translation">{selectedVerse.detail.translation}</p>
                    </div>
                  </div>
                ) : (
                  <div className="ai-no-selection">
                    <i className="ai-icon ai-icon-select"></i>
                    <h4>No verse selected</h4>
                    <p>Choose a reference verse to view its complete details and analysis.</p>
                  </div>
                )}

                {/* All References List */}
                {referenceVerses.length > 0 && (
                  <div className="ai-all-references">
                    <h4>All References</h4>
                    <div className="ai-references-list">
                      {referenceVerses.map((verse, index) => (
                        <div
                          key={`${verse.mandala}-${verse.sukta}-${verse.rik_number}-${index}`}
                          className={`ai-reference-item ${
                            selectedVerse?.context.mandala === verse.mandala &&
                            selectedVerse?.context.sukta === verse.sukta &&
                            selectedVerse?.context.rik_number === verse.rik_number
                              ? 'ai-active'
                              : ''
                          }`}
                          onClick={() => fetchVerseDetail(verse)}
                        >
                          <div className="ai-reference-meta">
                            <span className="ai-verse-ref">
                              M{verse.mandala}.{verse.sukta}.{verse.rik_number}
                            </span>
                            {verse.deity && (
                              <span className="ai-deity-mini">{verse.deity}</span>
                            )}
                          </div>
                          {verse.translation && (
                            <p className="ai-verse-snippet">
                              {verse.translation.substring(0, 100)}...
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIAssistant;