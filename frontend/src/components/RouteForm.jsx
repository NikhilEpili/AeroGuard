import React from 'react'
import LocationAutocomplete from './LocationAutocomplete'

const DEFAULT_START = { displayName: 'Bandra, Mumbai', lat: null, lon: null }
const DEFAULT_END   = { displayName: 'Powai, Mumbai',  lat: null, lon: null }

/**
 * RouteForm – Input panel for start / destination with live Nominatim autocomplete.
 *
 * Props:
 *   onSubmit({ startPlace, endPlace })  – called on form submit
 *   loading                             – disables inputs while route is fetching
 *   onPlaceSelect(type, place)          – fires immediately when user selects a suggestion
 *                                         type = 'start' | 'end'
 *   startDisplayValue                   – override text for start input (from map click)
 *   endDisplayValue                     – override text for end input   (from map click)
 */
const RouteForm = ({ onSubmit, loading, onPlaceSelect, startDisplayValue, endDisplayValue }) => {
  const [startPlace, setStartPlace] = React.useState(DEFAULT_START)
  const [endPlace,   setEndPlace]   = React.useState(DEFAULT_END)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!startPlace.displayName.trim() || !endPlace.displayName.trim()) return
    onSubmit({ startPlace, endPlace })
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

      <button type="submit" disabled={loading}>
        {loading ? 'Finding Route…' : 'Find Safe Route'}
      </button>
    </form>
  )
}

export default RouteForm
