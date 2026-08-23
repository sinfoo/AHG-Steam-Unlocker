import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from 'react'
import { Search, Clock, ArrowUpDown, X } from 'lucide-react'
import { bridge } from '../../bridge'
import { loadGameImage } from '../../services/imageCache'
import './search-bar.css'

interface SearchResult {
  appid: string
  name?: string
  header_image?: string
}

interface SearchBarProps {
  onSearch: (query: string) => void
  accentColor: string
  colors: {
    bgCard: string
    text: string
    textMuted: string
    border: string
    violet: string
    /** @deprecated kept for SearchBar.css fallback — can be omitted */
    topBarBg?: string
  }
}

const COLORS = {
  searchBg: 'rgba(255,255,255,0.04)',
  searchBgFocus: 'rgba(255,255,255,0.07)',
  searchBorder: 'rgba(255,255,255,0.06)',
  searchBorderFocus: 'rgba(255,255,255,0.12)',
  dropdownBg: 'rgba(15,15,25,0.97)',
  dropdownBorder: 'rgba(255,255,255,0.08)',
  hoverBg: 'rgba(255,255,255,0.04)',
  resultImgBg: 'rgba(255,255,255,0.04)',
}

/** Small internal component: shows header_image or falls back to loadGameImage via appid. */
function SearchResultCover({ appid, headerImage }: { appid: string; headerImage?: string }) {
  const [src, setSrc] = useState<string | null>(headerImage || null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (headerImage) {
      setSrc(headerImage)
      setError(false)
      return
    }
    let cancelled = false
    loadGameImage(appid).then(url => {
      if (!cancelled && url) {
        setSrc(url)
        setError(false)
      } else if (!cancelled) {
        setError(true)
      }
    })
    return () => { cancelled = true }
  }, [appid, headerImage])

  if (src && !error) {
    return <img src={src} alt="" loading="lazy" onError={() => setError(true)} />
  }
  return <div className="search-bar-result-placeholder" />
}

export default function SearchBar({ onSearch, accentColor, colors }: SearchBarProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('searchHistory') || '[]').slice(0, 5)
    } catch { return [] }
  })
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null as unknown as ReturnType<typeof setTimeout>)

  // Debounced search via bridge.queryGames
  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setSelectedIndex(-1)
      return
    }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await bridge.queryGames({ search: query.trim(), limit: 8 })
        setResults(data.games || [])
        setSelectedIndex(-1)
      } catch {
        // bridge may throw if query is too short or no results
        setResults([])
      }
    }, 200)
    return () => clearTimeout(debounceRef.current)
  }, [query])

  // Close dropdown on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const saveToHistory = useCallback((q: string) => {
    if (!q.trim()) return
    const updated = [q, ...searchHistory.filter(h => h !== q)].slice(0, 5)
    setSearchHistory(updated)
    localStorage.setItem('searchHistory', JSON.stringify(updated))
  }, [searchHistory])

  const handleSubmit = useCallback((q: string) => {
    const trimmed = q.trim()
    if (!trimmed) return
    saveToHistory(trimmed)
    setShowDropdown(false)
    onSearch(trimmed)
  }, [onSearch, saveToHistory])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const max = results.length + 1 // +1 for "View all"
      setSelectedIndex(prev => Math.min(prev + 1, max - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const picked = selectedIndex >= 0 && selectedIndex < results.length ? results[selectedIndex] : null
      if (picked) {
        // Enter on a highlighted result opens THAT game — its exact name pins it to
        // the top of browse — instead of re-submitting the raw typed query.
        const target = (picked.name || query).trim()
        setShowDropdown(false)
        setQuery(target)
        saveToHistory(target)
        onSearch(target)
      } else {
        handleSubmit(query)
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false)
      inputRef.current?.blur()
    }
  }, [selectedIndex, results, handleSubmit, query, saveToHistory, onSearch])

  const clearQuery = useCallback(() => {
    setQuery('')
    setResults([])
    setShowDropdown(false)
    inputRef.current?.focus()
  }, [])

  const handleResultClick = useCallback((game: SearchResult) => {
    setShowDropdown(false)
    // Navigate to browse with the CLICKED GAME's name — not the raw typed query.
    // The dropdown (SQLite substring) and browse (worker search) rank differently,
    // so re-submitting the raw query could lose the very game the user picked.
    // An exact-name query scores 100 and pins the game to the top.
    const target = (game.name || query).trim()
    setQuery(target)
    saveToHistory(target)
    onSearch(target)
  }, [onSearch, query, saveToHistory])

  const showHistory = !query.trim() && searchHistory.length > 0
  const showResults = query.trim().length > 0
  const dropdownVisible = showDropdown && (showHistory || showResults)

  return (
    <div className="search-bar-wrapper" ref={dropdownRef}>
      <div className="search-bar-input-group" style={{
        '--search-bg': COLORS.searchBg,
        '--search-bg-focus': COLORS.searchBgFocus,
        '--search-border': COLORS.searchBorder,
        '--search-border-focus': colors.topBarBg || COLORS.searchBorderFocus,
        '--search-text': colors.text,
        '--search-text-muted': colors.textMuted,
        '--accent': accentColor,
      } as React.CSSProperties}>
        <Search size={16} className="search-bar-icon" />
        <input
          ref={inputRef}
          type="text"
          className="search-bar-input"
          placeholder="Search games..."
          value={query}
          onChange={e => { setQuery(e.target.value); setShowDropdown(true) }}
          onFocus={() => setShowDropdown(true)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          spellCheck={false}
        />
        {query && (
          <button className="search-bar-clear" onClick={clearQuery} tabIndex={-1}>
            <X size={14} />
          </button>
        )}
      </div>

      {dropdownVisible && (
        <div className="search-bar-dropdown" style={{
          '--dropdown-bg': COLORS.dropdownBg,
          '--dropdown-border': COLORS.dropdownBorder,
          '--hover-bg': COLORS.hoverBg,
          '--result-img-bg': COLORS.resultImgBg,
          '--text': colors.text,
          '--text-muted': colors.textMuted,
        } as React.CSSProperties}>
          {/* Search History */}
          {showHistory && (
            <div className="search-bar-history">
              <div className="search-bar-section-header">
                <Clock size={12} />
                <span>Recent searches</span>
              </div>
              {searchHistory.map((item, i) => (
                <button
                  key={i}
                  className={`search-bar-history-item ${selectedIndex === i ? 'selected' : ''}`}
                  onClick={() => { setQuery(item); handleSubmit(item) }}
                  onMouseEnter={() => setSelectedIndex(i)}
                >
                  <Clock size={13} />
                  <span>{item}</span>
                </button>
              ))}
            </div>
          )}

          {/* Instant Results */}
          {showResults && results.length > 0 && (
            <div className="search-bar-results">
              <div className="search-bar-section-header">
                <Search size={12} />
                <span>Instant results</span>
              </div>
              {results.map((game, i) => {
                const idx = showHistory ? i + searchHistory.length : i
                return (
                  <button
                    key={game.appid}
                    className={`search-bar-result-item ${selectedIndex === idx ? 'selected' : ''}`}
                    onClick={() => handleResultClick(game)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    <div className="search-bar-result-image">
                      <SearchResultCover appid={game.appid} headerImage={game.header_image} />
                    </div>
                    <div className="search-bar-result-name">
                      <span>{game.name || 'Unknown'}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {/* No results */}
          {showResults && results.length === 0 && query.trim().length >= 2 && (
            <div className="search-bar-empty">
              <span>No games match "{query.trim()}"</span>
            </div>
          )}

          {/* View all */}
          {query.trim().length > 0 && (
            <button
              className={`search-bar-view-all ${selectedIndex === (results.length + (showHistory ? searchHistory.length : 0)) ? 'selected' : ''}`}
              onClick={() => handleSubmit(query)}
              onMouseEnter={() => setSelectedIndex(results.length + (showHistory ? searchHistory.length : 0))}
            >
              <ArrowUpDown size={13} />
              <span>View all results for "<strong>{query.trim()}</strong>"</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
