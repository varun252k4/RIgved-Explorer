import React, { useState, useEffect } from 'react';
import './SearchPage.css';
import Navbar from '../components/Navbar/Navbar';

// Types
interface SearchResult {
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

interface Mandala {
  id: number;
  name: string;
}

interface Sukta {
  id: number;
  name: string;
}

const SearchPage: React.FC = () => {
  // State management
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFields, setSelectedFields] = useState<string[]>(['translation']);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedVerse, setSelectedVerse] = useState<VerseDetail | null>(null);
  const [selectedVerseKey, setSelectedVerseKey] = useState<string | null>(null);
  const [mandalas, setMandalas] = useState<Mandala[]>([]);
  const [selectedMandala, setSelectedMandala] = useState<number | null>(null);
  const [suktas, setSuktas] = useState<Sukta[]>([]);
  const [selectedSukta, setSelectedSukta] = useState<number | null>(null);
  const [riks, setRiks] = useState<number[]>([]);
  const [currentView, setCurrentView] = useState<'search' | 'browse'>('search');
  const [activeDropdown, setActiveDropdown] = useState<'mandala' | 'sukta' | 'rik' | null>(null);
  const [exporting, setExporting] = useState(false);

  // Fetch mandalas on component mount
  useEffect(() => {
    fetchMandalas();
  }, []);

  // Fetch suktas when mandala is selected
  useEffect(() => {
    if (selectedMandala) {
      fetchSuktas(selectedMandala);
      setSelectedSukta(null);
      setRiks([]);
      setSelectedVerse(null);
      setSelectedVerseKey(null);
      setActiveDropdown('sukta');
    }
  }, [selectedMandala]);

  // Fetch riks when sukta is selected
  useEffect(() => {
    if (selectedMandala && selectedSukta) {
      fetchRiks(selectedMandala, selectedSukta);
      setSelectedVerse(null);
      setSelectedVerseKey(null);
      setActiveDropdown('rik');
    }
  }, [selectedMandala, selectedSukta]);

  // API Calls
  const fetchMandalas = async () => {
    try {
      setLoading(true);
      const response = await fetch('/mandalas');
      const data = await response.json();
      const formattedMandalas = data.mandalas.map((name: string, index: number) => ({
        id: index + 1,
        name: name
      }));
      setMandalas(formattedMandalas);
    } catch (err) {
      setError('Failed to fetch mandalas');
    } finally {
      setLoading(false);
    }
  };

  const fetchSuktas = async (mandalaId: number) => {
    try {
      setLoading(true);
      const response = await fetch(`/mandala/${mandalaId}/suktas`);
      const data = await response.json();
      const formattedSuktas = data.suktas.map((name: string, index: number) => ({
        id: index + 1,
        name: name
      }));
      setSuktas(formattedSuktas);
    } catch (err) {
      setError('Failed to fetch suktas');
    } finally {
      setLoading(false);
    }
  };

  const fetchRiks = async (mandalaId: number, suktaId: number) => {
    try {
      setLoading(true);
      const response = await fetch(`/mandala/${mandalaId}/sukta/${suktaId}/riks`);
      const data = await response.json();
      setRiks(data.riks);
    } catch (err) {
      setError('Failed to fetch riks');
    } finally {
      setLoading(false);
    }
  };

  const fetchVerseDetail = async (mandalaId: number, suktaId: number, rikNumber: number, resultKey: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/mandala/${mandalaId}/sukta/${suktaId}/rik/${rikNumber}`);
      const data = await response.json();
      setSelectedVerse(data);
      setSelectedVerseKey(resultKey);
      setActiveDropdown(null);
    } catch (err) {
      setError('Failed to fetch verse details');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (page: number = 1) => {
    if (!searchQuery.trim()) return;

    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams({
        query: searchQuery,
        page: page.toString(),
        page_size: '10'
      });

      selectedFields.forEach(field => {
        params.append('fields', field);
      });

      const response = await fetch(`/search?${params}`);
      const data = await response.json();
      setSearchResults(data.results);
      setSelectedVerse(null);
      setSelectedVerseKey(null);
      setCurrentView('search');
    } catch (err) {
      setError('Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Export to PDF function
  const handleExportPDF = async () => {
    if (!selectedMandala || !selectedSukta) {
      setError('Please select a Mandala and Sukta to export');
      return;
    }

    try {
      setExporting(true);
      setError(null);

      const response = await fetch(`/export_pdf/${selectedMandala}/${selectedSukta}?include_padapatha=true&include_transliteration=true&include_translation=true`);
      
      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `Mandala-${selectedMandala}-Sukta-${selectedSukta}.pdf`;
      
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

    } catch (err) {
      setError('Failed to export PDF. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  // Export search results to PDF
  const handleExportSearchResults = async () => {
    if (searchResults.length === 0) {
      setError('No search results to export');
      return;
    }

    try {
      setExporting(true);
      setError(null);

      // Create HTML content for PDF
      const content = `
        <html>
          <head>
            <title>Rigveda Search Results - "${searchQuery}"</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              h1 { color: #2C1810; border-bottom: 2px solid #FF9933; padding-bottom: 10px; }
              .result { margin-bottom: 20px; padding: 15px; border: 1px solid #e0e0e0; border-radius: 8px; }
              .location { color: #FF9933; font-weight: bold; }
              .deity { background: #138808; color: white; padding: 2px 8px; border-radius: 10px; font-size: 12px; }
              .text { margin: 10px 0; }
              .sanskrit { font-family: "Noto Sans Devanagari", sans-serif; font-size: 16px; }
            </style>
          </head>
          <body>
            <h1>Rigveda Search Results</h1>
            <p><strong>Search Query:</strong> "${searchQuery}"</p>
            <p><strong>Total Results:</strong> ${searchResults.length}</p>
            <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
            <hr>
            ${searchResults.map((result, index) => `
              <div class="result">
                <div class="location">${index + 1}. Mandala ${result.mandala}, Sukta ${result.sukta}, Rik ${result.rik_number}</div>
                ${result.deity ? `<span class="deity">Deity: ${result.deity}</span>` : ''}
                ${result.translation ? `<div class="text"><strong>Translation:</strong> ${result.translation}</div>` : ''}
                ${result.devanagari ? `<div class="text sanskrit"><strong>Devanagari:</strong> ${result.devanagari}</div>` : ''}
                ${result.transliteration ? `<div class="text"><strong>Transliteration:</strong> ${result.transliteration}</div>` : ''}
              </div>
            `).join('')}
          </body>
        </html>
      `;

      // For now, we'll use window.print for search results since backend only supports Sukta export
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(content);
        printWindow.document.close();
        printWindow.print();
      }

    } catch (err) {
      setError('Failed to export search results');
    } finally {
      setExporting(false);
    }
  };

  const handleFieldToggle = (field: string) => {
    setSelectedFields(prev =>
      prev.includes(field)
        ? prev.filter(f => f !== field)
        : [...prev, field]
    );
  };

  const handleRikSelect = (rikNumber: number) => {
    if (selectedMandala && selectedSukta) {
      const resultKey = `mandala-${selectedMandala}-sukta-${selectedSukta}-rik-${rikNumber}`;
      fetchVerseDetail(selectedMandala, selectedSukta, rikNumber, resultKey);
    }
  };

  const handleSearchResultClick = (result: SearchResult, index: number) => {
    const resultKey = `search-result-${index}`;
    
    if (selectedVerseKey === resultKey) {
      setSelectedVerse(null);
      setSelectedVerseKey(null);
    } else {
      fetchVerseDetail(result.mandala, result.sukta, result.rik_number, resultKey);
    }
  };

  const handleClearSelection = () => {
    setSelectedMandala(null);
    setSelectedSukta(null);
    setSelectedVerse(null);
    setSelectedVerseKey(null);
    setRiks([]);
    setActiveDropdown('mandala');
  };

  const toggleDropdown = (dropdown: 'mandala' | 'sukta' | 'rik') => {
    setActiveDropdown(activeDropdown === dropdown ? null : dropdown);
  };

  // Get selected mandala/sukta names
  const getSelectedMandalaName = () => {
    return mandalas.find(m => m.id === selectedMandala)?.name || `Mandala ${selectedMandala}`;
  };

  const getSelectedSuktaName = () => {
    return suktas.find(s => s.id === selectedSukta)?.name || `Sukta ${selectedSukta}`;
  };

  return (
    <div className="search-page">
      <Navbar />
      <div className="search-header">
        <h1>Explore the Rigveda</h1>
        <p>Search across translations, browse by structure, or explore specific verses</p>
      </div>

      <div className="search-container">
        
        {/* Search Section */}
        <div className="search-section">
          <div className="search-input-group">
            <input
              type="text"
              placeholder="Search for verses, deities, or concepts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="search-input"
            />
            <button 
              onClick={() => handleSearch()} 
              disabled={loading}
              className="search-button"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>

          {/* Search Filters */}
          <div className="search-filters">
            <label>Search in:</label>
            {['translation', 'devanagari', 'transliteration', 'deity'].map(field => (
              <label key={field} className="filter-checkbox">
                <input
                  type="checkbox"
                  checked={selectedFields.includes(field)}
                  onChange={() => handleFieldToggle(field)}
                />
                {field.charAt(0).toUpperCase() + field.slice(1)}
              </label>
            ))}
          </div>
        </div>

        {/* View Toggle */}
        <div className="view-toggle">
          <button
            className={`toggle-btn ${currentView === 'search' ? 'active' : ''}`}
            onClick={() => setCurrentView('search')}
          >
            Search Results
          </button>
          <button
            className={`toggle-btn ${currentView === 'browse' ? 'active' : ''}`}
            onClick={() => {
              setCurrentView('browse');
              setActiveDropdown('mandala');
            }}
          >
            Browse Structure
          </button>
        </div>

        <div className="content-area">
          {/* Left Sidebar - Browse Structure */}
          <div className="browse-sidebar">
            <div className="sidebar-header">
              <h3>Browse by Structure</h3>
              {(selectedMandala || selectedSukta || selectedVerse) && (
                <button className="clear-all-button" onClick={handleClearSelection}>
                  <i className="fas fa-times"></i>
                  Clear All
                </button>
              )}
            </div>
            
            {/* Mandala Dropdown */}
            <div className="dropdown-section">
              <div 
                className={`dropdown-header ${activeDropdown === 'mandala' ? 'active' : ''}`}
                onClick={() => toggleDropdown('mandala')}
              >
                <span className="dropdown-title">
                  {selectedMandala ? getSelectedMandalaName() : 'Select Mandala'}
                </span>
                <i className={`fas fa-chevron-${activeDropdown === 'mandala' ? 'up' : 'down'}`}></i>
              </div>
              
              {activeDropdown === 'mandala' && (
                <div className="dropdown-content">
                  <div className="dropdown-list">
                    {mandalas.map(mandala => (
                      <div
                        key={mandala.id}
                        className={`dropdown-item ${selectedMandala === mandala.id ? 'selected' : ''}`}
                        onClick={() => setSelectedMandala(mandala.id)}
                      >
                        {mandala.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sukta Dropdown - Only show if mandala is selected */}
            {selectedMandala && (
              <div className="dropdown-section">
                <div 
                  className={`dropdown-header ${activeDropdown === 'sukta' ? 'active' : ''}`}
                  onClick={() => toggleDropdown('sukta')}
                >
                  <span className="dropdown-title">
                    {selectedSukta ? getSelectedSuktaName() : 'Select Sukta'}
                  </span>
                  <i className={`fas fa-chevron-${activeDropdown === 'sukta' ? 'up' : 'down'}`}></i>
                </div>
                
                {activeDropdown === 'sukta' && (
                  <div className="dropdown-content">
                    <div className="dropdown-list">
                      {suktas.map(sukta => (
                        <div
                          key={sukta.id}
                          className={`dropdown-item ${selectedSukta === sukta.id ? 'selected' : ''}`}
                          onClick={() => setSelectedSukta(sukta.id)}
                        >
                          {sukta.name}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Rik Dropdown - Only show if sukta is selected */}
            {selectedSukta && (
              <div className="dropdown-section">
                <div 
                  className={`dropdown-header ${activeDropdown === 'rik' ? 'active' : ''}`}
                  onClick={() => toggleDropdown('rik')}
                >
                  <span className="dropdown-title">
                    {selectedVerse ? `Rik ${selectedVerse.rik_number}` : 'Select Rik'}
                  </span>
                  <i className={`fas fa-chevron-${activeDropdown === 'rik' ? 'up' : 'down'}`}></i>
                </div>
                
                {activeDropdown === 'rik' && (
                  <div className="dropdown-content">
                    <div className="dropdown-list">
                      {riks.map(rik => (
                        <div
                          key={rik}
                          className={`dropdown-item ${selectedVerse?.rik_number === rik ? 'selected' : ''}`}
                          onClick={() => handleRikSelect(rik)}
                        >
                          Rik {rik}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Export Section */}
            {(selectedMandala && selectedSukta) && (
              <div className="export-section">
                <h4>Export Options</h4>
                <button 
                  className="export-button"
                  onClick={handleExportPDF}
                  disabled={exporting}
                >
                  <i className="fas fa-file-pdf"></i>
                  {exporting ? 'Exporting...' : 'Export Sukta as PDF'}
                </button>
                <div className="export-info">
                  <small>Includes padapatha, transliteration, and translation</small>
                </div>
              </div>
            )}

            {/* Selection Summary */}
            {(selectedMandala || selectedSukta || selectedVerse) && (
              <div className="selection-summary">
                <h4>Current Selection</h4>
                <div className="selection-path">
                  {selectedMandala && (
                    <span className="path-item">{getSelectedMandalaName()}</span>
                  )}
                  {selectedSukta && (
                    <>
                      <i className="fas fa-chevron-right"></i>
                      <span className="path-item">{getSelectedSuktaName()}</span>
                    </>
                  )}
                  {selectedVerse && (
                    <>
                      <i className="fas fa-chevron-right"></i>
                      <span className="path-item">Rik {selectedVerse.rik_number}</span>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Main Content Area */}
          <div className="main-content">
            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            {loading && (
              <div className="loading-spinner">
                <div className="spinner"></div>
                Loading...
              </div>
            )}

            {/* Search Results Header with Export */}
            {currentView === 'search' && searchResults.length > 0 && (
              <div className="results-header">
                <h3>Search Results ({searchResults.length})</h3>
                <button 
                  className="export-search-button"
                  onClick={handleExportSearchResults}
                  disabled={exporting}
                >
                  <i className="fas fa-file-export"></i>
                  Export Results
                </button>
              </div>
            )}

            {/* Search Results */}
            {currentView === 'search' && searchResults.length > 0 && (
              <div className="search-results">
                {searchResults.map((result, index) => {
                  const resultKey = `search-result-${index}`;
                  const isExpanded = selectedVerseKey === resultKey;
                  
                  return (
                    <div key={index} className="search-result-container">
                      <div
                        className={`result-item ${isExpanded ? 'expanded' : ''}`}
                        onClick={() => handleSearchResultClick(result, index)}
                      >
                        <div className="result-header">
                          <span className="verse-location">
                            Mandala {result.mandala}, Sukta {result.sukta}, Rik {result.rik_number}
                            {isExpanded && <i className="fas fa-chevron-up expand-icon"></i>}
                            {!isExpanded && <i className="fas fa-chevron-down expand-icon"></i>}
                          </span>
                          {result.deity && (
                            <span className="deity-tag">Deity: {result.deity}</span>
                          )}
                        </div>
                        {result.translation && (
                          <p className="verse-text">{result.translation}</p>
                        )}
                        {result.devanagari && (
                          <p className="devanagari-text">{result.devanagari}</p>
                        )}
                      </div>

                      {/* Verse Details shown immediately below the selected result */}
                      {isExpanded && selectedVerse && (
                        <div className="verse-detail-expanded">
                          <div className="verse-section">
                            <h4>Samhita (Devanagari)</h4>
                            <p className="sanskrit-text">{selectedVerse.samhita.devanagari.text}</p>
                          </div>

                          <div className="verse-section">
                            <h4>Padapatha</h4>
                            <p className="sanskrit-text">{selectedVerse.padapatha.devanagari.text}</p>
                            <p className="transliteration">{selectedVerse.padapatha.transliteration.text}</p>
                          </div>

                          <div className="verse-section">
                            <h4>Translation</h4>
                            <p className="translation">{selectedVerse.translation}</p>
                          </div>

                          {selectedVerse.deity && (
                            <div className="verse-section">
                              <h4>Deity</h4>
                              <span className="deity-badge">{selectedVerse.deity}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {currentView === 'search' && searchQuery && searchResults.length === 0 && !loading && (
              <div className="no-results">
                <i className="fas fa-search"></i>
                <h4>No results found for "{searchQuery}"</h4>
                <p>Try adjusting your search terms or filters</p>
              </div>
            )}

            {/* Browse Content - Verse Detail View */}
            {currentView === 'browse' && selectedVerse && (
              <div className="verse-detail">
                <div className="verse-header">
                  <h3>
                    Verse Details - Mandala {selectedMandala}, Sukta {selectedSukta}, Rik {selectedVerse.rik_number}
                  </h3>
                  <button 
                    className="export-verse-button"
                    onClick={handleExportPDF}
                    disabled={exporting}
                  >
                    <i className="fas fa-file-pdf"></i>
                    {exporting ? 'Exporting...' : 'Export Sukta'}
                  </button>
                </div>
                
                <div className="verse-section">
                  <h4>Samhita (Devanagari)</h4>
                  <p className="sanskrit-text">{selectedVerse.samhita.devanagari.text}</p>
                </div>

                <div className="verse-section">
                  <h4>Padapatha</h4>
                  <p className="sanskrit-text">{selectedVerse.padapatha.devanagari.text}</p>
                  <p className="transliteration">{selectedVerse.padapatha.transliteration.text}</p>
                </div>

                <div className="verse-section">
                  <h4>Translation</h4>
                  <p className="translation">{selectedVerse.translation}</p>
                </div>

                {selectedVerse.deity && (
                  <div className="verse-section">
                    <h4>Deity</h4>
                    <span className="deity-badge">{selectedVerse.deity}</span>
                  </div>
                )}
              </div>
            )}

            {/* Browse Instructions */}
            {currentView === 'browse' && !selectedVerse && (
              <div className="browse-instructions">
                <div className="instructions-icon">
                  <i className="fas fa-book-open"></i>
                </div>
                <h3>Browse the Rigveda</h3>
                <p>Use the dropdown menus in the sidebar to navigate through the structure of the Rigveda.</p>
                
                {!selectedMandala && (
                  <div className="instruction-step">
                    <div className="step-indicator">
                      <span>1</span>
                    </div>
                    <div className="step-content">
                      <strong>Start by selecting a Mandala</strong>
                      <p>Choose from the 10 Mandalas (books) in the sidebar</p>
                    </div>
                  </div>
                )}

                {selectedMandala && !selectedSukta && (
                  <div className="instruction-step">
                    <div className="step-indicator">
                      <span>2</span>
                    </div>
                    <div className="step-content">
                      <strong>Now select a Sukta</strong>
                      <p>Choose a hymn from the available Suktas in Mandala {selectedMandala}</p>
                    </div>
                  </div>
                )}

                {selectedSukta && !selectedVerse && (
                  <div className="instruction-step">
                    <div className="step-indicator">
                      <span>3</span>
                    </div>
                    <div className="step-content">
                      <strong>Select a Rik to view details</strong>
                      <p>Click on any Rik number to see the complete verse with translation</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SearchPage;