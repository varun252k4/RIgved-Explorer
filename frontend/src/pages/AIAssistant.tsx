import React, { useState, useRef, useEffect } from 'react';
import './AIAssistant.css';
import Navbar from '../components/Navbar/Navbar';

// Types
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

// Extended interface for selected verse with context
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

  // Format markdown-like text (## for headers, ** for bold)
  const formatMessage = (text: string) => {
    return text
      .split('\n')
      .map((line, index) => {
        // Handle headers (##)
        if (line.startsWith('## ')) {
          return <h4 key={index} className="message-header">{line.replace('## ', '')}</h4>;
        }
        // Handle bold (**text**)
        const boldRegex = /\*\*(.*?)\*\*/g;
        const parts = line.split(boldRegex);
        if (parts.length > 1) {
          return (
            <p key={index} className="message-paragraph">
              {parts.map((part, i) => 
                i % 2 === 1 ? <strong key={i} className="message-bold">{part}</strong> : part
              )}
            </p>
          );
        }
        // Regular paragraphs
        if (line.trim()) {
          return <p key={index} className="message-paragraph">{line}</p>;
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

  return (
    <div className="ai-assistant-page">
      <Navbar />
      {/* Header */}
      <div className="search-header">
        <h1>Rigveda AI Assistant</h1>
        <p>Chat with our AI to explore the wisdom of the Rigveda</p>
      </div>

      <div className="search-container">
        <div className="content-area">
          {/* Left Side - Chat Interface */}
          <div className="main-content">
            <div className="chat-section">
              <div className="results-header">
                <h3>AI Dialogue</h3>
                <button 
                  className="clear-all-button"
                  onClick={handleClearChat}
                  disabled={messages.length === 0}
                >
                  <i className="fas fa-trash"></i>
                  Clear Chat
                </button>
              </div>

              {/* Chat Messages */}
              <div className="chat-messages" ref={chatContainerRef}>
                {messages.length === 0 && (
                  <div className="browse-instructions">
                    <div className="instructions-icon">
                      <i className="fas fa-robot"></i>
                    </div>
                    <h3>Welcome to Rigveda AI Assistant</h3>
                    <p>Ask me anything about the Rigveda - deities, philosophy, verses, or historical context.</p>
                    
                    <div className="suggested-questions">
                      <h4>Try asking:</h4>
                      <div className="suggestion-grid">
                        {suggestedQuestions.map((question, index) => (
                          <button
                            key={index}
                            className="suggestion-chip"
                            onClick={() => setQuery(question)}
                          >
                            {question}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="browse-features">
                      <div className="feature">
                        <i className="fas fa-book"></i>
                        <span>Verse References</span>
                      </div>
                      <div className="feature">
                        <i className="fas fa-comments"></i>
                        <span>Contextual Answers</span>
                      </div>
                      <div className="feature">
                        <i className="fas fa-search"></i>
                        <span>Detailed Analysis</span>
                      </div>
                    </div>
                  </div>
                )}

                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`message ${message.type}-message`}
                  >
                    <div className="message-avatar">
                      {message.type === 'user' ? (
                        <i className="fas fa-user"></i>
                      ) : (
                        <i className="fas fa-robot"></i>
                      )}
                    </div>
                    <div className="message-content">
                      <div className="message-header">
                        <span className="message-sender">
                          {message.type === 'user' ? 'You' : 'Rigveda AI'}
                        </span>
                        <span className="message-time">
                          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="message-text">
                        {formatMessage(message.content)}
                      </div>

                      {/* Context Verses for Assistant Messages */}
                      {message.type === 'assistant' && message.context && message.context.length > 0 && (
                        <div className="context-verses">
                          <div className="context-header">
                            <i className="fas fa-book"></i>
                            <span>Reference Verses ({message.context.length})</span>
                          </div>
                          <div className="context-list">
                            {message.context.map((verse, index) => {
                              const verseId = getVerseId(verse);
                              const isExpanded = expandedVerses.has(verseId);
                              
                              return (
                                <div key={index} className="search-result-container">
                                  <div 
                                    className={`result-item ${isExpanded ? 'expanded' : ''}`}
                                    onClick={() => toggleVerseExpansion(verseId)}
                                  >
                                    <div className="result-header">
                                      <div className="verse-location">
                                        M{verse.mandala}.{verse.sukta}.{verse.rik_number}
                                        <i className={`expand-icon fas fa-chevron-${isExpanded ? 'up' : 'down'}`}></i>
                                      </div>
                                      {verse.deity && (
                                        <span className="deity-tag">{verse.deity}</span>
                                      )}
                                    </div>
                                    {verse.translation && (
                                      <p className="verse-text">
                                        {verse.translation}
                                      </p>
                                    )}
                                    {verse.devanagari && (
                                      <p className="devanagari-text">
                                        {verse.devanagari}
                                      </p>
                                    )}
                                  </div>

                                  {/* Expanded Verse Details */}
                                  {isExpanded && (
                                    <div className="verse-detail-expanded">
                                      <div className="verse-section">
                                        <h4>Devanagari Text</h4>
                                        <p className="sanskrit-text">
                                          {verse.devanagari || "Loading..."}
                                        </p>
                                      </div>
                                      {verse.transliteration && (
                                        <div className="verse-section">
                                          <h4>Transliteration</h4>
                                          <p className="transliteration">
                                            {verse.transliteration}
                                          </p>
                                        </div>
                                      )}
                                      {verse.translation && (
                                        <div className="verse-section">
                                          <h4>Translation</h4>
                                          <p className="translation">
                                            {verse.translation}
                                          </p>
                                        </div>
                                      )}
                                      {verse.deity && (
                                        <div className="verse-section">
                                          <h4>Deity</h4>
                                          <span className="deity-badge">{verse.deity}</span>
                                        </div>
                                      )}
                                      <button 
                                        className="export-verse-button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleContextVerseClick(verse);
                                        }}
                                      >
                                        <i className="fas fa-external-link-alt"></i>
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
                ))}

                {loading && (
                  <div className="message assistant-message">
                    <div className="message-avatar">
                      <i className="fas fa-robot"></i>
                    </div>
                    <div className="message-content">
                      <div className="message-header">
                        <span className="message-sender">Rigveda AI</span>
                      </div>
                      <div className="loading-spinner">
                        <div className="spinner"></div>
                        <p>Consulting the sacred texts...</p>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="search-section">
                {error && (
                  <div className="error-message">
                    <i className="fas fa-exclamation-triangle"></i>
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="chat-input-form">
                  <div className="search-input-group">
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Ask about the Rigveda..."
                      className="search-input"
                      disabled={loading}
                    />
                    <button 
                      type="submit" 
                      disabled={loading || !query.trim()}
                      className="search-button"
                    >
                      {loading ? (
                        <div className="button-spinner"></div>
                      ) : (
                        <>
                          <i className="fas fa-paper-plane"></i>
                          Send
                        </>
                      )}
                    </button>
                  </div>

                  <div className="search-filters">
                    <div className="option-group">
                      <label>Max References:</label>
                      <select
                        value={maxResults}
                        onChange={(e) => setMaxResults(Number(e.target.value))}
                        className="option-select"
                      >
                        <option value={3}>3</option>
                        <option value={5}>5</option>
                        <option value={8}>8</option>
                        <option value={10}>10</option>
                      </select>
                    </div>

                    <div className="option-group">
                      <label>Include Fields:</label>
                      <div className="field-options">
                        {[
                          { value: 'translation', label: 'Translation' },
                          { value: 'devanagari', label: 'Devanagari' },
                          { value: 'transliteration', label: 'Transliteration' },
                          { value: 'deity', label: 'Deity' }
                        ].map(field => (
                          <label key={field.value} className="filter-checkbox">
                            <input
                              type="checkbox"
                              checked={selectedFields.includes(field.value)}
                              onChange={() => handleFieldToggle(field.value)}
                            />
                            {field.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>

          <div className="browse-sidebar">
  <div className="sidebar-header">
    <h3>Reference Verses</h3>
    <p>Click on any verse to see detailed information below</p>
  </div>

  <div className="details-content">
    {selectedVerse ? (
      <div className="verse-detail">
        {/* Selected Verse Details */}
        <div className="selected-verse-section">
          <div className="verse-header">
            <h3>
              Mandala {selectedVerse.context.mandala}, 
              Sukta {selectedVerse.context.sukta}, 
              Rik {selectedVerse.context.rik_number}
            </h3>
            {selectedVerse.detail.deity && (
              <span className="deity-badge">{selectedVerse.detail.deity}</span>
            )}
          </div>

          <div className="verse-section">
            <h4>Samhita (Devanagari)</h4>
            <p className="sanskrit-text">{selectedVerse.detail.samhita.devanagari.text}</p>
          </div>

          <div className="verse-section">
            <h4>Padapatha</h4>
            <p className="sanskrit-text">{selectedVerse.detail.padapatha.devanagari.text}</p>
            <p className="transliteration">{selectedVerse.detail.padapatha.transliteration.text}</p>
          </div>

          <div className="verse-section">
            <h4>Translation</h4>
            <p className="translation">{selectedVerse.detail.translation}</p>
          </div>
        </div>

        {/* All Reference Verses List */}
        {messages.length > 0 && (
          <div className="all-references-section">
            <h4>All Reference Verses</h4>
            <div className="references-list">
              {messages
                .filter(msg => msg.type === 'assistant' && msg.context)
                .flatMap(msg => msg.context || [])
                .map((verse, index) => (
                  <div
                    key={`${verse.mandala}-${verse.sukta}-${verse.rik_number}-${index}`}
                    className={`reference-item ${
                      selectedVerse.context.mandala === verse.mandala &&
                      selectedVerse.context.sukta === verse.sukta &&
                      selectedVerse.context.rik_number === verse.rik_number
                        ? 'active'
                        : ''
                    }`}
                    onClick={() => fetchVerseDetail(verse)}
                  >
                    <div className="reference-header">
                      <span className="verse-location">
                        M{verse.mandala}.{verse.sukta}.{verse.rik_number}
                      </span>
                      {verse.deity && (
                        <span className="deity-tag">{verse.deity}</span>
                      )}
                    </div>
                    {verse.translation && (
                      <p className="verse-preview">
                        {verse.translation.substring(0, 80)}...
                      </p>
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    ) : (
      <div className="no-selection">
        <div className="no-selection-icon">
          <i className="fas fa-book-open"></i>
        </div>
        <h4>No verse selected</h4>
        <p>Click on any reference verse to view its details here.</p>
        
        {/* Show all references even when no verse is selected */}
        {messages.length > 0 && (
          <div className="all-references-section">
            <h4>All Reference Verses</h4>
            <div className="references-list">
              {messages
                .filter(msg => msg.type === 'assistant' && msg.context)
                .flatMap(msg => msg.context || [])
                .map((verse, index) => (
                  <div
                    key={`${verse.mandala}-${verse.sukta}-${verse.rik_number}-${index}`}
                    className="reference-item"
                    onClick={() => fetchVerseDetail(verse)}
                  >
                    <div className="reference-header">
                      <span className="verse-location">
                        M{verse.mandala}.{verse.sukta}.{verse.rik_number}
                      </span>
                      {verse.deity && (
                        <span className="deity-tag">{verse.deity}</span>
                      )}
                    </div>
                    {verse.translation && (
                      <p className="verse-preview">
                        {verse.translation.substring(0, 80)}...
                      </p>
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    )}
  </div>
</div>
</div>
</div>
</div>
  );
};

export default AIAssistant;