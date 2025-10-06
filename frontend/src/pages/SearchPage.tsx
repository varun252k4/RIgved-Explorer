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
}

interface Mandala {
  id: number;
  name: string;
}

interface Sukta {
  id: number;
  name: string;
}

// Pagination state interface
interface PaginationState {
  currentPage: number;
  pageSize: number;
  totalPages: number;
  totalResults: number;
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
  const [currentView, setCurrentView] = useState<'search' | 'browse'>('browse');
  const [activeDropdown, setActiveDropdown] = useState<'mandala' | 'sukta' | 'rik' | null>(null);
  const [exporting, setExporting] = useState(false);
  const API_BASE = "https://rigved-backend-1-0.onrender.com";
  
  // Pagination state
  const [pagination, setPagination] = useState<PaginationState>({
    currentPage: 1,
    pageSize: 10,
    totalPages: 1,
    totalResults: 0
  });

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
      const response = await fetch(`${API_BASE}/mandalas`);
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

  const formatVerseText = (text?: string): React.ReactNode => {
    if (!text) return null;
  
    // Step 1: Remove surrounding quotes, whitespace, and invisible characters
    text = text.replace(/^[\s"“”‘’«»\u200B\u00A0]+|[\s"“”‘’«»\u200B\u00A0]+$/g, "");
  
    // Step 2: Replace danda and double danda with a consistent split marker "|"
    text = text.replace(/॥/g, "॥|").replace(/।/g, "।|");
  
    // Step 3: Also split by newlines in case verses come multi-line
    let parts = text.split(/\||\n/).map(p => p.trim()).filter(Boolean);
  
    // Step 4: Render each part on a separate line
    return parts.map((line, idx) => (
      <div key={idx} style={{ margin: "2px 0", lineHeight: "1.4", textAlign: "center" }}>
        {line}
      </div>
    ));
  };

  const fetchSuktas = async (mandalaId: number) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/mandala/${mandalaId}/suktas`);
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
      const response = await fetch(`${API_BASE}/mandala/${mandalaId}/sukta/${suktaId}/riks`);
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
      const response = await fetch(`${API_BASE}/mandala/${mandalaId}/sukta/${suktaId}/rik/${rikNumber}`);
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

  // Updated search function with pagination
  const handleSearch = async (page: number = 1, newPageSize?: number) => {
    if (!searchQuery.trim()) return;

    try {
      setLoading(true);
      setError(null);
      
      const pageSize = newPageSize || pagination.pageSize;
      
      const params = new URLSearchParams({
        query: searchQuery,
        page: page.toString(),
        page_size: pageSize.toString()
      });

      selectedFields.forEach(field => {
        params.append('fields', field);
      });

      const response = await fetch(`${API_BASE}/search?${params}`);
      const data = await response.json();
      
      setSearchResults(data.results || []);
      setSelectedVerse(null);
      setSelectedVerseKey(null);
      setCurrentView('browse');
      
      // Update pagination state with API response data
      setPagination(prev => ({
        ...prev,
        currentPage: page,
        pageSize: pageSize,
        totalPages: data.total_pages || Math.ceil((data.total_results || 0) / pageSize),
        totalResults: data.total_results || 0
      }));
      
    } catch (err) {
      setError('Search failed. Please try again.');
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle page change
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      handleSearch(newPage);
    }
  };

  // Handle page size change
  const handlePageSizeChange = (newSize: number) => {
    setPagination(prev => ({
      ...prev,
      pageSize: newSize,
      currentPage: 1 // Reset to first page when changing page size
    }));
    handleSearch(1, newSize);
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

      const response = await fetch(`${API_BASE}/export_pdf/${selectedMandala}/${selectedSukta}?include_padapatha=true&include_transliteration=true&include_translation=true`);
      
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
              .text { margin: 10px 0; }
              .sanskrit { font-family: "Noto Sans Devanagari", sans-serif; font-size: 16px; }
              .pagination-info { color: #666; margin: 10px 0; }
            </style>
          </head>
          <body>
            <h1>Rigveda Search Results</h1>
            <p><strong>Search Query:</strong> "${searchQuery}"</p>
            <p><strong>Total Results:</strong> ${pagination.totalResults}</p>
            <p><strong>Page:</strong> ${pagination.currentPage} of ${pagination.totalPages}</p>
            <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
            <hr>
            ${searchResults.map((result, index) => {
              const globalIndex = ((pagination.currentPage - 1) * pagination.pageSize) + index + 1;
              return `
                <div class="result">
                  <div class="location">${globalIndex}. Mandala ${result.mandala}, Sukta ${result.sukta}, Rik ${result.rik_number}</div>
                  ${result.translation ? `<div class="text"><strong>Translation:</strong> ${result.translation}</div>` : ''}
                  ${result.devanagari ? `<div class="text sanskrit"><strong>Devanagari:</strong> ${result.devanagari}</div>` : ''}
                  ${result.transliteration ? `<div class="text"><strong>Transliteration:</strong> ${result.transliteration}</div>` : ''}
                </div>
              `;
            }).join('')}
            <div class="pagination-info">
              Page ${pagination.currentPage} of ${pagination.totalPages} | 
              Showing ${((pagination.currentPage - 1) * pagination.pageSize) + 1} - ${Math.min(pagination.currentPage * pagination.pageSize, pagination.totalResults)} of ${pagination.totalResults} results
            </div>
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

  // Pagination controls component
  const renderPagination = () => {
    if (pagination.totalPages <= 1) return null;

    return (
      <div className="pagination-controls">
        {/* Page Size Selector */}
        <div className="page-size-selector">
          <label>Results per page: </label>
          <select 
            value={pagination.pageSize}
            onChange={(e) => handlePageSizeChange(Number(e.target.value))}
            className="page-size-select"
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>

        {/* Page Navigation */}
        <div className="page-navigation">
          <button 
            className="page-btn"
            onClick={() => handlePageChange(1)}
            disabled={pagination.currentPage === 1}
            title="First Page"
          >
            <i className="fas fa-angle-double-left"></i>
          </button>
          
          <button 
            className="page-btn"
            onClick={() => handlePageChange(pagination.currentPage - 1)}
            disabled={pagination.currentPage === 1}
            title="Previous Page"
          >
            <i className="fas fa-angle-left"></i>
          </button>

          <span className="page-info">
            Page {pagination.currentPage} of {pagination.totalPages}
          </span>

          <button 
            className="page-btn"
            onClick={() => handlePageChange(pagination.currentPage + 1)}
            disabled={pagination.currentPage === pagination.totalPages}
            title="Next Page"
          >
            <i className="fas fa-angle-right"></i>
          </button>
          
          <button 
            className="page-btn"
            onClick={() => handlePageChange(pagination.totalPages)}
            disabled={pagination.currentPage === pagination.totalPages}
            title="Last Page"
          >
            <i className="fas fa-angle-double-right"></i>
          </button>
        </div>

        {/* Results Count */}
        <div className="results-count">
          Showing {((pagination.currentPage - 1) * pagination.pageSize) + 1} -{' '}
          {Math.min(pagination.currentPage * pagination.pageSize, pagination.totalResults)} of{' '}
          {pagination.totalResults} results
        </div>
      </div>
    );
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
              placeholder="Search for verses, or concepts..."
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
            {['translation', 'devanagari', 'transliteration'].map(field => (
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
                <div className="results-info">
                  <h3>Search Results ({pagination.totalResults})</h3>
                  <div className="pagination-top">
                    {renderPagination()}
                  </div>
                </div>
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
              <>
                <div className="search-results">
                  {searchResults.map((result, index) => {
                    const resultKey = `search-result-${index}`;
                    const isExpanded = selectedVerseKey === resultKey;
                    const globalIndex = ((pagination.currentPage - 1) * pagination.pageSize) + index + 1;
                    
                    return (
                      <div key={index} className="search-result-container">
                        <div
                          className={`result-item ${isExpanded ? 'expanded' : ''}`}
                          onClick={() => handleSearchResultClick(result, index)}
                        >
                          <div className="result-header">
                            <span className="verse-location">
                              {globalIndex}. Mandala {result.mandala}, Sukta {result.sukta}, Rik {result.rik_number}
                              {isExpanded && <i className="fas fa-chevron-up expand-icon"></i>}
                              {!isExpanded && <i className="fas fa-chevron-down expand-icon"></i>}
                            </span>
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
                              <p className="sanskrit-text">{formatVerseText(selectedVerse.samhita.devanagari.text)}</p>
                            </div>

                            <div className="verse-section">
                              <h4>Padapatha</h4>
                              <p>{selectedVerse.padapatha.devanagari.text}</p>
                            </div>
                            <div className='verse-section'>
                              <h4>Transliteration</h4>
                              <p className="transliteration">{selectedVerse.padapatha.transliteration.text}</p>
                            </div>

                            {/* <div className="verse-section">
                              <h4>Translation</h4>
                              <p className="translation">{selectedVerse.translation}</p>
                            </div> */}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                
                {/* Pagination Controls at Bottom */}
                <div className="pagination-bottom">
                  {renderPagination()}
                </div>
              </>
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