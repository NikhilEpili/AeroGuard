# AeroGuard

## Backend Project Structure

This repository now includes a production-grade FastAPI backend scaffold in [backend](backend).

### Project Tree

- [backend/main.py](backend/main.py) – FastAPI application entrypoint, router registration, and health endpoint.
- [backend/api/route_api.py](backend/api/route_api.py) – Route-facing HTTP APIs for safe-route navigation requests.
- [backend/api/sensor_api.py](backend/api/sensor_api.py) – Sensor ingestion and simulation APIs.
- [backend/core/config.py](backend/core/config.py) – Centralized environment-based settings and connection URLs.
- [backend/core/logging.py](backend/core/logging.py) – Shared logging configuration for all services.
- [backend/grid/grid_generator.py](backend/grid/grid_generator.py) – Builds pollution grid cells from sensor inputs.
- [backend/grid/pollution_interpolator.py](backend/grid/pollution_interpolator.py) – Interpolates air-quality values between sparse observations.
- [backend/iot/sensor_simulator.py](backend/iot/sensor_simulator.py) – Generates mock sensor readings for local testing.
- [backend/iot/mqtt_consumer.py](backend/iot/mqtt_consumer.py) – Consumes real-time MQTT sensor events.
- [backend/routing/graph_loader.py](backend/routing/graph_loader.py) – Placeholder graph-loading boundary for future road-network data.
- [backend/routing/pollution_cost.py](backend/routing/pollution_cost.py) – Calculates pollution cost for route segments.
- [backend/routing/safe_route_engine.py](backend/routing/safe_route_engine.py) – Ranks candidate routes by exposure and travel efficiency.
- [backend/services/directions_service.py](backend/services/directions_service.py) – Wraps OpenRouteService API and provides OSRM fallback candidates.
- [backend/services/pollution_service.py](backend/services/pollution_service.py) – Coordinates pollution interpolation, scoring, and sensor updates.
- [backend/db/database.py](backend/db/database.py) – SQLAlchemy engine, session factory, and DB dependency.
- [backend/db/models.py](backend/db/models.py) – Postgres/PostGIS ORM models for sensors, pollution readings, pollution grid, and route cache.
- [backend/cache/redis_client.py](backend/cache/redis_client.py) – Shared Redis client factory for caching and hot-path lookups.
- [backend/utils/geo_utils.py](backend/utils/geo_utils.py) – Geographic helpers such as distance and midpoint calculations.
- [requirements.txt](requirements.txt) – Python dependencies.
- [Dockerfile](Dockerfile) – Container image definition for the API service.
- [docker-compose.yml](docker-compose.yml) – Local orchestration for API, PostGIS, Redis, and Mosquitto.

## Module Responsibilities

### API Layer

- [backend/api/route_api.py](backend/api/route_api.py) receives route search requests, calls candidate route retrieval, applies pollution scoring, and returns the safest route plus alternatives.
- [backend/api/sensor_api.py](backend/api/sensor_api.py) accepts live air-quality readings and provides a simulator endpoint to test the ingestion pipeline.

### Core Layer

- [backend/core/config.py](backend/core/config.py) keeps environment variables in one place and exposes typed settings for database, Redis, MQTT, and routing APIs.
- [backend/core/logging.py](backend/core/logging.py) provides consistent structured logging across all modules.

### Pollution Intelligence Layer

- [backend/grid/grid_generator.py](backend/grid/grid_generator.py) transforms validated sensor readings into grid-ready pollution cells.
- [backend/grid/pollution_interpolator.py](backend/grid/pollution_interpolator.py) estimates pollution in areas without direct sensors using inverse-distance weighting.
- [backend/services/pollution_service.py](backend/services/pollution_service.py) pulls free OpenAQ measurements (with local fallback) and builds route-area pollution snapshots.

OpenAQ note: configure `OPENAQ_BASE_URL=https://api.openaq.org/v3`. If OpenAQ is unavailable, AeroGuard automatically falls back to simulated pollution points so demos continue without crashes.

### IoT Layer

- [backend/iot/sensor_simulator.py](backend/iot/sensor_simulator.py) supports development and testing when physical sensors are unavailable.
- [backend/iot/mqtt_consumer.py](backend/iot/mqtt_consumer.py) is the integration point for real-time MQTT-based sensor streams.

### Routing Layer

- [backend/routing/graph_loader.py](backend/routing/graph_loader.py) is the boundary where road graph or custom map data can be loaded later.
- [backend/routing/pollution_cost.py](backend/routing/pollution_cost.py) converts pollutant values into numeric route penalties.
- [backend/routing/safe_route_engine.py](backend/routing/safe_route_engine.py) sorts candidates and selects the best route using the computed pollution exposure score.

### Service Layer

- [backend/services/directions_service.py](backend/services/directions_service.py) uses OpenRouteService when configured and falls back to free OSRM route alternatives.
- [backend/services/pollution_service.py](backend/services/pollution_service.py) centralizes route scoring and sensor-driven pollution updates.

## Safe Route Scoring Model

- Candidate routes are segmented and sampled along geometry.
- Exposure is computed as: $\sum (PM2.5_{segment} \times time_{segment})$.
- Context-aware multiplier is applied: $\times trafficFactor \times roadFactor$.
- Route ranking minimizes exposure first, then duration and distance.
- `/api/v1/routes/safe-route` returns `fastest_route`, `balanced_route`, and `cleanest_route`, plus `exposure_reduction_percent`.
- `/api/v1/routes/safe-route` accepts `travel_mode=walking|cycling|driving`, `route_type=fastest|balanced|cleanest`, and `use_predicted_pollution=true|false`.
- `/api/v1/routes/predict-pollution?lat=...&lon=...` returns next-hour PM2.5/AQI forecast.
- `/api/v1/routes/pollution-heatmap` returns IDW-interpolated grid cells for map heat layers.
- Graph precompute endpoint: `/api/v1/routes/graph/precompute` stores PostGIS `road_segments` costs.
- Graph query endpoint: `/api/v1/routes/graph/safe-route` runs A* or ALT over precomputed segment costs.

## IoT Simulation Endpoints

- `/api/v1/sensors/simulate` returns a single simulated reading.
- `/api/v1/sensors/simulate/batch` returns one reading per simulated sensor for heatmap workflows.
- `/api/v1/sensors/nearby?lat=...&lon=...&radius_m=2000` uses PostGIS `ST_DWithin` to find sensors in range.

### Data and Cache Layer

- [backend/db/database.py](backend/db/database.py) owns database connectivity and request-scoped sessions.
- [backend/db/models.py](backend/db/models.py) defines persistent entities for sensors, pollution readings, pollution grids, and route cache.
- [backend/cache/redis_client.py](backend/cache/redis_client.py) gives the backend a shared async Redis client for low-latency reads and hot caching.

## Database Migrations (Alembic)

- Alembic config: [alembic.ini](alembic.ini)
- Migration environment: [alembic/env.py](alembic/env.py)
- Initial schema migration: [alembic/versions/20260313_01_initial_aeroguard_schema.py](alembic/versions/20260313_01_initial_aeroguard_schema.py)

The initial migration enables PostGIS (`CREATE EXTENSION IF NOT EXISTS postgis`) and creates spatial indexes for geometry columns.

Road graph precompute migration: [alembic/versions/20260314_01_add_road_segments_table.py](alembic/versions/20260314_01_add_road_segments_table.py)

Run migrations:

- `alembic upgrade head`

Create a new migration after model updates:

- `alembic revision --autogenerate -m "describe_change"`

### Utility Layer

- [backend/utils/geo_utils.py](backend/utils/geo_utils.py) contains reusable geo primitives used by routing and scoring logic.

## Local Run

- Install dependencies with `pip install -r requirements.txt`
- Start the stack with `docker compose up --build`
- Launch the API locally with `uvicorn backend.main:app --reload`
- Open the docs at `http://localhost:8000/docs`

## Local OSRM (Contraction Hierarchies) Setup

AeroGuard now uses a local OSRM instance as the base route engine, with CH preprocessing for fast queries.

1. Download Mumbai coverage OpenStreetMap data (Geofabrik Maharashtra extract):
	- `https://download.openstreetmap.fr/extracts/asia/india/maharashtra.osm.pbf`
2. Build OSRM graph using car profile:
	- `osrm-extract -p /opt/car.lua /data/mumbai-latest.osm.pbf`
3. Enable CH preprocessing:
	- `osrm-contract /data/mumbai-latest.osrm`
4. Run local OSRM server:
	- `osrm-routed --algorithm ch /data/mumbai-latest.osrm --port 5000`

With Docker Compose, these steps are automated by `osrm-download`, `osrm-extract`, `osrm-contract`, and `osrm` services in [docker-compose.yml](docker-compose.yml).

The init containers are idempotent: once `/data/mumbai-latest.osrm.hsgr` exists, future `docker compose up` runs skip the expensive download/extract/contract work and start the `osrm` server directly.

### API Integration Notes

- [backend/api/route_api.py](backend/api/route_api.py) explicitly fetches an OSRM base route for each request.
- [backend/services/directions_service.py](backend/services/directions_service.py) prioritizes OSRM candidates and deduplicates merged routes.
- Pollution-aware ranking now uses configurable weighted scoring:
  - `ROUTE_WEIGHT_POLLUTION` (default 0.7)
  - `ROUTE_WEIGHT_DURATION` (default 0.2)
  - `ROUTE_WEIGHT_DISTANCE` (default 0.1)