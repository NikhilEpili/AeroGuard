import React from 'react'

/**
 * RouteForm – Input panel for start/end coordinates and find route button.
 */
const RouteForm = ({ onSubmit, loading }) => {
  const [startLat, setStartLat] = React.useState(19.0760)
  const [startLon, setStartLon] = React.useState(72.8777)
  const [endLat, setEndLat] = React.useState(19.2183)
  const [endLon, setEndLon] = React.useState(72.9781)

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit({
      startLat: parseFloat(startLat),
      startLon: parseFloat(startLon),
      endLat: parseFloat(endLat),
      endLon: parseFloat(endLon)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="route-form">
      <h2>Safe Route Navigation</h2>
      
      <fieldset>
        <legend>Start Location</legend>
        <label>
          Latitude:
          <input
            type="number"
            step="0.0001"
            value={startLat}
            onChange={(e) => setStartLat(e.target.value)}
            disabled={loading}
          />
        </label>
        <label>
          Longitude:
          <input
            type="number"
            step="0.0001"
            value={startLon}
            onChange={(e) => setStartLon(e.target.value)}
            disabled={loading}
          />
        </label>
      </fieldset>

      <fieldset>
        <legend>End Location</legend>
        <label>
          Latitude:
          <input
            type="number"
            step="0.0001"
            value={endLat}
            onChange={(e) => setEndLat(e.target.value)}
            disabled={loading}
          />
        </label>
        <label>
          Longitude:
          <input
            type="number"
            step="0.0001"
            value={endLon}
            onChange={(e) => setEndLon(e.target.value)}
            disabled={loading}
          />
        </label>
      </fieldset>

      <button type="submit" disabled={loading}>
        {loading ? 'Finding Route...' : 'Find Safe Route'}
      </button>
    </form>
  )
}

export default RouteForm
