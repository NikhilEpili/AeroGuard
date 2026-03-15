import React, { useState, useEffect, useRef, useCallback } from 'react'
import axios from 'axios'

const NOMINATIM = 'https://nominatim.openstreetmap.org/search'

/**
 * Search Nominatim with Mumbai context first, falling back to a bare India search.
 * Returns an array of { lat, lon, displayName, placeId }.
 */
const searchPlaces = async (query) => {
  const attempt = async (q) => {
    const res = await axios.get(NOMINATIM, {
      params: {
        q:            q,
        format:       'jsonv2',
        addressdetails: 1,
        countrycodes: 'in',
        limit:        6
      },
      headers:  { 'Accept-Language': 'en' },
      timeout:  8000
    })
    return res.data || []
  }

  const primary = await attempt(`${query}, Mumbai, India`)
  const raw     = primary.length ? primary : await attempt(query)

  return raw.map((r) => ({
    lat:         parseFloat(r.lat),
    lon:         parseFloat(r.lon),
    displayName: r.display_name,
    placeId:     r.place_id ?? `${r.lon}:${r.lat}`
  }))
}

/**
 * LocationAutocomplete – text input with live Nominatim place suggestions.
 *
 * Props:
 *   initialValue    – initial display text shown in the input
 *   placeholder     – placeholder string for the input
 *   disabled        – disables the input
 *   onSelect(place) – called when user picks a result; place = { lat, lon, displayName, placeId }
 *   onChange(text)  – called on every keystroke so the parent can reset stored coords
 *   externalValue   – when set (non-empty string), overrides input text (e.g. from map click)
 */
const LocationAutocomplete = ({
  initialValue  = '',
  placeholder,
  disabled,
  onSelect,
  onChange,
  externalValue
}) => {
  const [inputValue,  setInputValue]  = useState(initialValue)
  const [suggestions, setSuggestions] = useState([])
  const [open,        setOpen]        = useState(false)
  const [searching,   setSearching]   = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const debounceRef   = useRef(null)
  const containerRef  = useRef(null)

  // Sync when a reverse-geocoded value is pushed in from outside (map click)
  useEffect(() => {
    if (externalValue) {
      setInputValue(externalValue)
      setSuggestions([])
      setOpen(false)
    }
  }, [externalValue])

  // Fetch suggestions 400 ms after user stops typing
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    const query = inputValue.trim()
    if (query.length < 3) {
      setSuggestions([])
      setOpen(false)
      return
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const results = await searchPlaces(query)
        setSuggestions(results)
        setOpen(results.length > 0)
        setActiveIndex(-1)
      } catch {
        setSuggestions([])
        setOpen(false)
      } finally {
        setSearching(false)
      }
    }, 400)

    return () => clearTimeout(debounceRef.current)
  }, [inputValue])

  // Close dropdown when the user clicks outside the component
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelect = useCallback(
    (place) => {
      setInputValue(place.displayName)
      setSuggestions([])
      setOpen(false)
      setActiveIndex(-1)
      onSelect(place)
    },
    [onSelect]
  )

  const handleKeyDown = (e) => {
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault()
      handleSelect(suggestions[activeIndex])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="autocomplete-wrapper" ref={containerRef}>
      <input
        type="text"
        value={inputValue}
        onChange={(e) => {
          setInputValue(e.target.value)
          onChange?.(e.target.value)
          setActiveIndex(-1)
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className="autocomplete-input"
        autoComplete="off"
        spellCheck="false"
        aria-autocomplete="list"
        aria-expanded={open}
      />

      {searching && <span className="autocomplete-spinner" aria-label="Searching…" />}

      {open && suggestions.length > 0 && (
        <ul className="autocomplete-dropdown" role="listbox" aria-label="Location suggestions">
          {suggestions.map((place, idx) => (
            <li
              key={`${place.placeId}-${idx}`}
              role="option"
              aria-selected={idx === activeIndex}
              className={`autocomplete-item${idx === activeIndex ? ' active' : ''}`}
              onMouseDown={() => handleSelect(place)}
              onMouseEnter={() => setActiveIndex(idx)}
            >
              <span className="autocomplete-pin">📍</span>
              <span className="autocomplete-text">{place.displayName}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default LocationAutocomplete
