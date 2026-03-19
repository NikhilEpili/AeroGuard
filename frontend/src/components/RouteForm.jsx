import React from 'react'
import LocationAutocomplete from './LocationAutocomplete'

const DEFAULT_START = { displayName: '', lat: null, lon: null }
const DEFAULT_END   = { displayName: '',  lat: null, lon: null }

/**
 * RouteForm – Input panel for start / destination with live Nominatim autocomplete.
 *
 * Props:
 *   onSubmit({ startPlace, endPlace, travelMode })  – called on form submit
 *   loading                             – disables inputs while route is fetching
 *   onPlaceSelect(type, place)          – fires immediately when user selects a suggestion
 *                                         type = 'start' | 'end'
 *   startDisplayValue                   – override text for start input (from map click)
 *   endDisplayValue                     – override text for end input   (from map click)
 *   travelMode                          – current selected travel mode
 *   onTravelModeChange(mode)            – called when travel mode changes
 */
const RouteForm = ({ onSubmit, loading, onPlaceSelect, startDisplayValue, endDisplayValue, travelMode, onTravelModeChange }) => {
  const [startPlace, setStartPlace] = React.useState(DEFAULT_START)
  const [endPlace,   setEndPlace]   = React.useState(DEFAULT_END)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!startPlace.displayName.trim() || !endPlace.displayName.trim()) return
    onSubmit({ startPlace, endPlace, travelMode })
  }

  return (
    <form onSubmit={handleSubmit} className="route-form">
      <h2>Safe Route Navigation</h2>

      <fieldset>
        <legend>Start Location</legend>
        <LocationAutocomplete
          initialValue={DEFAULT_START.displayName}
          placeholder="e.g., Bandra, Mumbai"
          disabled={loading}
          externalValue={startDisplayValue}
          onSelect={(place) => {
            setStartPlace(place)
            onPlaceSelect?.('start', place)
          }}
          onChange={(text) => setStartPlace({ displayName: text, lat: null, lon: null })}
        />
      </fieldset>

      <fieldset>
        <legend>Destination</legend>
        <LocationAutocomplete
          initialValue={DEFAULT_END.displayName}
          placeholder="e.g., Powai, Mumbai"
          disabled={loading}
          externalValue={endDisplayValue}
          onSelect={(place) => {
            setEndPlace(place)
            onPlaceSelect?.('end', place)
          }}
          onChange={(text) => setEndPlace({ displayName: text, lat: null, lon: null })}
        />
      </fieldset>

      <fieldset>
        <legend>Travel Mode</legend>
        <div className="travel-mode-buttons">
          <button
            type="button"
            className={travelMode === 'walking' ? 'active' : ''}
            onClick={() => onTravelModeChange('walking')}
            disabled={loading}
            title="Walking"
          >
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
              <path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7z"/>
            </svg>
          </button>
          <button
            type="button"
            className={travelMode === 'cycling' ? 'active' : ''}
            onClick={() => onTravelModeChange('cycling')}
            disabled={loading}
            title="Cycling"
          >
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="6" cy="17" r="3"></circle>
              <circle cx="18" cy="17" r="3"></circle>
              <path d="M6 17l4-7h4l4 7"></path>
              
              <circle cx="12" cy="7.5" r="1.5" fill="currentColor" stroke="none"></circle>
              <path d="M12 9l-2 3 2 2 2-2z"></path>
              <path d="M11 10l3-2"></path>
              
              <path d="M13 14l3 3"></path>
            </svg>
          </button>
          <button
            type="button"
            className={travelMode === 'bike' ? 'active' : ''}
            onClick={() => onTravelModeChange('bike')}
            disabled={loading}
            title="Bike"
          >
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="6" cy="18" r="3"></circle>
              <circle cx="18" cy="18" r="3"></circle>
              <path d="M6 18l3-5h6l3 5"></path>
              <rect x="10" y="13" width="4" height="2" rx="0.5"></rect>
              <path d="M9 11h5"></path>
              <path d="M14 11l2-2h2"></path>
              <path d="M15 15h2"></path>
            </svg>
          </button>
          <button
            type="button"
            className={travelMode === 'driving' ? 'active' : ''}
            onClick={() => onTravelModeChange('driving')}
            disabled={loading}
            title="Driving"
          >
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
              <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
            </svg>
          </button>
        </div>
      </fieldset>

      <button type="submit" disabled={loading}>
        {loading ? 'Finding Route…' : 'Find Safe Route'}
      </button>
    </form>
  )
}

export default RouteForm
