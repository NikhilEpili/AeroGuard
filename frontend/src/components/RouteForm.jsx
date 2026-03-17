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
          >
            Walking
          </button>
          <button
            type="button"
            className={travelMode === 'cycling' ? 'active' : ''}
            onClick={() => onTravelModeChange('cycling')}
            disabled={loading}
          >
            Cycling
          </button>
          <button
            type="button"
            className={travelMode === 'bike' ? 'active' : ''}
            onClick={() => onTravelModeChange('bike')}
            disabled={loading}
          >
            Bike
          </button>
          <button
            type="button"
            className={travelMode === 'driving' ? 'active' : ''}
            onClick={() => onTravelModeChange('driving')}
            disabled={loading}
          >
            Car
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
