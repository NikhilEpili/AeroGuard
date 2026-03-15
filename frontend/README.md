# AeroGuard – Test Frontend

Minimal React + Vite developer testing tool for the **Safe Route Navigation API**.

## What is this?

This is **NOT the production UI**. This is a temporary frontend scaffolding to quickly verify that the backend API works as expected during development. It allows you to:

- Enter start/end coordinates
- Request a safe route from the backend
- Visualize the route on an interactive map
- See pollution exposure scores and risk levels

## Quick Start

### Prerequisites
- Node.js 16+
- npm or yarn
- Backend running on `localhost:8000`

### Setup

```bash
cd frontend
npm install
npm run dev
```

Optional frontend env override:

```bash
cp .env.example .env
```

Use `VITE_API_BASE_URL` to point the frontend to your backend (default is `http://localhost:8000`).

The dev server will start on **http://localhost:3000**.

### Usage

1. **Enter coordinates** in the input fields (defaults: Mumbai start → Bandra end)
2. **Click "Find Safe Route"**
3. **Map updates** with the returned route as a green polyline
4. **View route info**: exposure score, average AQI, risk level, distance, duration

## Architecture

```
src/
├── main.jsx              Entry point
├── App.jsx               Main layout (form + map)
├── App.css               Minimal CSS styling
├── components/
│   ├── RouteForm.jsx     Coordinate input + button
│   └── MapView.jsx       Leaflet map + polyline rendering
└── services/
    └── api.js            Axios client for GET /safe-route
```

## API Integration

The frontend calls:

```
GET http://localhost:8000/api/v1/routes/safe-route?start_lat=X&start_lon=Y&end_lat=Z&end_lon=W
```

Expected response:

```json
{
  "route": {
    "geometry": "encoded_polyline",
    "distance_km": 12.5,
    "duration_minutes": 18.3
  },
  "exposure_score": 450.2,
  "average_aqi": 65.4,
  "risk_level": "Moderate"
}
```

## Build for Production

```bash
npm run build
```

Outputs static files to `dist/`.

## Notes

- **CORS**: Backend must allow browser origins like `localhost:3000` / `localhost:5173`.
- **Polyline decoding**: Uses standard Google Maps polyline encoding format.
- **Markers**: Green = start, red = end. Route shown as green dashed line.
- **Map tiles**: OpenStreetMap (free, no API key required).

## Future Enhancements (Not in Scope)

- Authentication
- Saved routes
- Historical queries
- Real-time sensor data overlay
- Traffic integration
- Mobile responsiveness

---

This is a **temporary development tool**. For production, build a proper full-featured frontend with proper UI/UX design.
