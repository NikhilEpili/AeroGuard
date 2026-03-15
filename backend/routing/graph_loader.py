from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from heapq import heappop, heappush
from math import inf
from typing import Literal

import requests

from geoalchemy2.elements import WKTElement
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from backend.core.config import get_settings
from backend.core.logging import get_logger
from backend.db.models import RoadSegment
from backend.services.pollution_service import PollutionService
from backend.utils.geo_utils import compute_distance_km


@dataclass(slots=True)
class Edge:
    to_node: str
    cost: float
    distance_km: float
    travel_time_minutes: float
    pm25: float
    start: tuple[float, float]
    end: tuple[float, float]


class GraphLoader:
    OBJECTIVE_WEIGHTS: dict[str, tuple[float, float]] = {
        "fastest": (0.9, 0.1),
        "balanced": (0.5, 0.5),
        "safest": (0.2, 0.8),
    }
    OSRM_MAX_WAYPOINTS = 25

    def __init__(self) -> None:
        self.pollution_service = PollutionService()
        self.settings = get_settings()
        self.logger = get_logger(__name__)

    def precompute_road_segments(
        self,
        db: Session,
        *,
        min_lat: float,
        min_lon: float,
        max_lat: float,
        max_lon: float,
        grid_size_m: int = 200,
        travel_mode: str = "walking",
        replace_existing: bool = True,
    ) -> dict[str, int | str]:
        points = self.pollution_service.get_pollution_heatmap(
            min_lat=min_lat,
            min_lon=min_lon,
            max_lat=max_lat,
            max_lon=max_lon,
            grid_size_m=grid_size_m,
            use_forecast=False,
        )
        if not points:
            return {"status": "empty", "nodes": 0, "segments": 0}

        sorted_lats = sorted({round(float(point["lat"]), 6) for point in points})
        sorted_lons = sorted({round(float(point["lon"]), 6) for point in points})

        lat_index = {lat: idx for idx, lat in enumerate(sorted_lats)}
        lon_index = {lon: idx for idx, lon in enumerate(sorted_lons)}

        node_data: dict[tuple[int, int], dict[str, float | int | str]] = {}
        for point in points:
            lat = round(float(point["lat"]), 6)
            lon = round(float(point["lon"]), 6)
            node_data[(lat_index[lat], lon_index[lon])] = point

        speed_kmph = {
            "walking": 5.0,
            "cycling": 15.0,
            "driving": 30.0,
        }.get(travel_mode, 5.0)

        traffic_factor = {
            "walking": 0.9,
            "cycling": 1.1,
            "driving": 1.3,
        }.get(travel_mode, 1.0)

        if replace_existing:
            db.query(RoadSegment).filter(RoadSegment.travel_mode == travel_mode).delete()

        segments: list[RoadSegment] = []
        for (r, c), src in node_data.items():
            neighbors = [(r + 1, c), (r, c + 1)]  # undirected via pair inserts
            for nr, nc in neighbors:
                dst = node_data.get((nr, nc))
                if not dst:
                    continue

                src_lat = float(src["lat"])
                src_lon = float(src["lon"])
                dst_lat = float(dst["lat"])
                dst_lon = float(dst["lon"])
                distance_km = compute_distance_km(src_lat, src_lon, dst_lat, dst_lon)
                travel_time_minutes = (distance_km / max(speed_kmph, 0.1)) * 60.0
                pm25 = (float(src["pm25"]) + float(dst["pm25"])) / 2.0
                road_factor = 1.0
                exposure_cost = pm25 * travel_time_minutes * traffic_factor * road_factor

                zone_lat = int(src_lat // 0.02)
                zone_lon = int(src_lon // 0.02)
                zone_id = f"{zone_lat}:{zone_lon}"

                start_node_id = f"{src_lat:.6f}:{src_lon:.6f}"
                end_node_id = f"{dst_lat:.6f}:{dst_lon:.6f}"

                forward = RoadSegment(
                    start_node_id=start_node_id,
                    end_node_id=end_node_id,
                    start_lat=src_lat,
                    start_lon=src_lon,
                    end_lat=dst_lat,
                    end_lon=dst_lon,
                    travel_mode=travel_mode,
                    zone_id=zone_id,
                    distance_km=round(distance_km, 4),
                    travel_time_minutes=round(travel_time_minutes, 4),
                    pm25=round(pm25, 2),
                    traffic_factor=round(traffic_factor, 3),
                    road_factor=round(road_factor, 3),
                    exposure_cost=round(exposure_cost, 4),
                    segment_geom=WKTElement(f"LINESTRING({src_lon} {src_lat}, {dst_lon} {dst_lat})", srid=4326),
                )

                backward = RoadSegment(
                    start_node_id=end_node_id,
                    end_node_id=start_node_id,
                    start_lat=dst_lat,
                    start_lon=dst_lon,
                    end_lat=src_lat,
                    end_lon=src_lon,
                    travel_mode=travel_mode,
                    zone_id=zone_id,
                    distance_km=round(distance_km, 4),
                    travel_time_minutes=round(travel_time_minutes, 4),
                    pm25=round(pm25, 2),
                    traffic_factor=round(traffic_factor, 3),
                    road_factor=round(road_factor, 3),
                    exposure_cost=round(exposure_cost, 4),
                    segment_geom=WKTElement(f"LINESTRING({dst_lon} {dst_lat}, {src_lon} {src_lat})", srid=4326),
                )
                segments.extend([forward, backward])

        db.bulk_save_objects(segments)
        db.commit()

        return {
            "status": "ok",
            "nodes": len(node_data),
            "segments": len(segments),
            "travel_mode": travel_mode,
        }

    def load_graph(
        self,
        db: Session,
        *,
        min_lat: float,
        min_lon: float,
        max_lat: float,
        max_lon: float,
        travel_mode: str,
    ) -> tuple[dict[str, list[Edge]], dict[str, tuple[float, float]]]:
        q = (
            db.query(RoadSegment)
            .filter(RoadSegment.travel_mode == travel_mode)
            .filter(
                and_(
                    or_(
                        and_(RoadSegment.start_lat >= min_lat, RoadSegment.start_lat <= max_lat),
                        and_(RoadSegment.end_lat >= min_lat, RoadSegment.end_lat <= max_lat),
                    ),
                    or_(
                        and_(RoadSegment.start_lon >= min_lon, RoadSegment.start_lon <= max_lon),
                        and_(RoadSegment.end_lon >= min_lon, RoadSegment.end_lon <= max_lon),
                    ),
                )
            )
        )
        rows = q.all()

        adjacency: dict[str, list[Edge]] = defaultdict(list)
        node_coords: dict[str, tuple[float, float]] = {}

        for seg in rows:
            start_node = str(seg.start_node_id)
            end_node = str(seg.end_node_id)
            start = (float(seg.start_lat), float(seg.start_lon))
            end = (float(seg.end_lat), float(seg.end_lon))
            node_coords[start_node] = start
            node_coords[end_node] = end

            adjacency[start_node].append(
                Edge(
                    to_node=end_node,
                    cost=float(seg.exposure_cost),
                    distance_km=float(seg.distance_km),
                    travel_time_minutes=float(seg.travel_time_minutes),
                    pm25=float(seg.pm25),
                    start=start,
                    end=end,
                )
            )

        return adjacency, node_coords

    def find_nearest_node(self, node_coords: dict[str, tuple[float, float]], lat: float, lon: float) -> str:
        best_node = ""
        best_distance = inf
        for node_id, (node_lat, node_lon) in node_coords.items():
            d = compute_distance_km(lat, lon, node_lat, node_lon)
            if d < best_distance:
                best_distance = d
                best_node = node_id
        if not best_node:
            raise ValueError("No nodes found in precomputed graph")
        return best_node

    def route_astar(
        self,
        adjacency: dict[str, list[Edge]],
        node_coords: dict[str, tuple[float, float]],
        *,
        start_node: str,
        end_node: str,
        use_alt: bool = False,
        weight_distance: float = 0.2,
        weight_pollution: float = 0.8,
        travel_mode: str = "driving",
    ) -> dict[str, float | list[dict[str, float]]]:
        """A* routing where:

          g(n): cumulative weighted objective cost
              = Σ(weight_distance * edge_distance_km + weight_pollution * edge_pollution_exposure)
          h(n): straight-line distance lower-bound to destination (distance component only)
        f(n): g(n) + h(n)
        """
        if start_node not in node_coords or end_node not in node_coords:
            raise ValueError("Start or end node missing in graph")

        landmarks = self._select_landmarks(node_coords) if use_alt else []
        landmark_dists = self._precompute_landmark_distances(adjacency, landmarks) if landmarks else {}

        open_heap: list[tuple[float, str]] = []
        g_score: dict[str, float] = defaultdict(lambda: inf)
        parent: dict[str, str | None] = {start_node: None}
        closed: set[str] = set()

        normalized_distance_weight, normalized_pollution_weight = self._normalize_weights(
            weight_distance,
            weight_pollution,
        )

        g_score[start_node] = 0.0
        start_h = self._heuristic(
            node_coords,
            start_node,
            end_node,
            weight_distance=normalized_distance_weight,
        )
        heappush(open_heap, (start_h, start_node))

        while open_heap:
            _, current = heappop(open_heap)
            if current in closed:
                continue
            closed.add(current)

            if current == end_node:
                break

            for edge in adjacency.get(current, []):
                objective_edge_cost = (
                    (normalized_distance_weight * edge.distance_km)
                    + (normalized_pollution_weight * edge.cost)
                )
                tentative = g_score[current] + objective_edge_cost
                if tentative >= g_score[edge.to_node]:
                    continue

                g_score[edge.to_node] = tentative
                parent[edge.to_node] = current
                h = self._heuristic(
                    node_coords,
                    edge.to_node,
                    end_node,
                    weight_distance=normalized_distance_weight,
                )
                if landmarks:
                    h = max(h, self._alt_lower_bound(edge.to_node, end_node, landmarks, landmark_dists))
                f_score = tentative + h
                heappush(open_heap, (f_score, edge.to_node))

        if end_node not in parent:
            raise ValueError("No path found in graph")

        node_path: list[str] = []
        cursor: str | None = end_node
        while cursor is not None:
            node_path.append(cursor)
            cursor = parent.get(cursor)
        node_path.reverse()

        fallback_geometry: list[dict[str, float]] = []
        total_distance = 0.0
        total_time = 0.0
        total_exposure = 0.0
        for i, node_id in enumerate(node_path):
            lat, lon = node_coords[node_id]
            fallback_geometry.append({"lat": lat, "lng": lon})
            if i == 0:
                continue
            prev = node_path[i - 1]
            edge = next((e for e in adjacency.get(prev, []) if e.to_node == node_id), None)
            if edge:
                total_distance += edge.distance_km
                total_time += edge.travel_time_minutes
                total_exposure += edge.cost

        geometry = self._build_osrm_geometry(
            node_path=node_path,
            node_coords=node_coords,
            travel_mode=travel_mode,
            fallback_geometry=fallback_geometry,
        )

        average_pm25 = (total_exposure / total_time) if total_time > 0 else 0.0
        objective_score = float(g_score[end_node])

        return {
            "geometry": geometry,
            "distance_km": round(total_distance, 3),
            "duration_minutes": round(total_time, 3),
            "exposure_score": round(total_exposure, 3),
            "average_aqi": round(average_pm25, 2),
            "objective_score": round(objective_score, 3),
            "weight_distance": round(normalized_distance_weight, 3),
            "weight_pollution": round(normalized_pollution_weight, 3),
        }

    def route_multi_objective(
        self,
        adjacency: dict[str, list[Edge]],
        node_coords: dict[str, tuple[float, float]],
        *,
        start_node: str,
        end_node: str,
        use_alt: bool = False,
        travel_mode: str = "driving",
    ) -> dict[str, list[dict[str, float | str | list[dict[str, float]]]] | dict[str, float | str | list[dict[str, float]]]]:
        routes: list[dict[str, float | str | list[dict[str, float]]]] = []

        for route_type, (weight_distance, weight_pollution) in self.OBJECTIVE_WEIGHTS.items():
            result = self.route_astar(
                adjacency,
                node_coords,
                start_node=start_node,
                end_node=end_node,
                use_alt=use_alt,
                weight_distance=weight_distance,
                weight_pollution=weight_pollution,
                travel_mode=travel_mode,
            )
            route_payload = {
                "route_type": route_type,
                "weight_distance": float(result.get("weight_distance", weight_distance)),
                "weight_pollution": float(result.get("weight_pollution", weight_pollution)),
                "geometry": result.get("geometry", []),
                "distance_km": float(result.get("distance_km", 0.0)),
                "duration_minutes": float(result.get("duration_minutes", 0.0)),
                "pollution_exposure": float(result.get("exposure_score", 0.0)),
                "average_aqi": float(result.get("average_aqi", 0.0)),
                "objective_score": float(result.get("objective_score", 0.0)),
                "algorithm": "ALT" if use_alt else "A*",
            }
            routes.append(route_payload)

        by_type = {str(route["route_type"]): route for route in routes}
        return {
            "routes": routes,
            "fastest_route": by_type["fastest"],
            "balanced_route": by_type["balanced"],
            "safest_route": by_type["safest"],
        }

    def _heuristic(
        self,
        node_coords: dict[str, tuple[float, float]],
        node_id: str,
        target_id: str,
        *,
        weight_distance: float,
    ) -> float:
        """Weighted straight-line distance heuristic to destination."""
        lat, lon = node_coords[node_id]
        t_lat, t_lon = node_coords[target_id]
        return weight_distance * compute_distance_km(lat, lon, t_lat, t_lon)

    def _normalize_weights(self, weight_distance: float, weight_pollution: float) -> tuple[float, float]:
        wd = max(float(weight_distance), 0.0)
        wp = max(float(weight_pollution), 0.0)
        total = wd + wp
        if total <= 0:
            return 0.5, 0.5
        return wd / total, wp / total

    def _build_osrm_geometry(
        self,
        *,
        node_path: list[str],
        node_coords: dict[str, tuple[float, float]],
        travel_mode: str,
        fallback_geometry: list[dict[str, float]],
    ) -> list[dict[str, float]]:
        if len(node_path) < 2:
            return fallback_geometry

        waypoints = [node_coords[node_id] for node_id in node_path if node_id in node_coords]
        if len(waypoints) < 2:
            return fallback_geometry

        reduced_waypoints = self._downsample_waypoints(waypoints, self.OSRM_MAX_WAYPOINTS)
        profile = self._osrm_profile(travel_mode)
        coord_str = ";".join(f"{lon:.6f},{lat:.6f}" for lat, lon in reduced_waypoints)
        url = f"{self.settings.osrm_base_url.rstrip('/')}/route/v1/{profile}/{coord_str}"
        params = {
            "overview": "full",
            "geometries": "geojson",
            "steps": "false",
        }

        try:
            response = requests.get(url, params=params, timeout=8)
            response.raise_for_status()
            payload = response.json()
            coordinates = (((payload.get("routes") or [{}])[0]).get("geometry") or {}).get("coordinates") or []
            geometry = [
                {"lat": float(coord[1]), "lng": float(coord[0])}
                for coord in coordinates
                if isinstance(coord, list) and len(coord) >= 2
            ]
            return geometry or fallback_geometry
        except requests.RequestException as exc:
            self.logger.warning("OSRM geometry fetch failed; using fallback path: %s", exc)
            return fallback_geometry

    def _downsample_waypoints(
        self,
        points: list[tuple[float, float]],
        max_points: int,
    ) -> list[tuple[float, float]]:
        if len(points) <= max_points:
            return points

        first = points[0]
        last = points[-1]
        middle = points[1:-1]
        keep_middle = max(0, max_points - 2)
        if keep_middle <= 0 or not middle:
            return [first, last]

        step = len(middle) / keep_middle
        selected = [middle[int(i * step)] for i in range(keep_middle)]
        return [first, *selected, last]

    def _osrm_profile(self, travel_mode: str) -> str:
        mode = str(travel_mode).lower()
        if mode == "walking":
            return "foot"
        if mode == "cycling":
            return "bike"
        return "driving"

    def _alt_lower_bound(
        self,
        node_id: str,
        target_id: str,
        landmarks: list[str],
        landmark_dists: dict[str, dict[str, float]],
    ) -> float:
        """ALT lower bound based on precomputed landmark shortest-path costs."""
        alt_bound = 0.0
        for lm in landmarks:
            d_map = landmark_dists.get(lm, {})
            d_lm_node = d_map.get(node_id)
            d_lm_target = d_map.get(target_id)
            if d_lm_node is None or d_lm_target is None:
                continue
            alt_bound = max(alt_bound, abs(d_lm_target - d_lm_node))

        return alt_bound

    def _select_landmarks(self, node_coords: dict[str, tuple[float, float]]) -> list[str]:
        if len(node_coords) <= 4:
            return list(node_coords.keys())
        nodes = list(node_coords.items())
        north = max(nodes, key=lambda item: item[1][0])[0]
        south = min(nodes, key=lambda item: item[1][0])[0]
        east = max(nodes, key=lambda item: item[1][1])[0]
        west = min(nodes, key=lambda item: item[1][1])[0]
        return list(dict.fromkeys([north, south, east, west]))

    def _precompute_landmark_distances(
        self,
        adjacency: dict[str, list[Edge]],
        landmarks: list[str],
    ) -> dict[str, dict[str, float]]:
        return {landmark: self._dijkstra(adjacency, landmark) for landmark in landmarks}

    def _dijkstra(self, adjacency: dict[str, list[Edge]], source: str) -> dict[str, float]:
        dist: dict[str, float] = defaultdict(lambda: inf)
        dist[source] = 0.0
        heap: list[tuple[float, str]] = [(0.0, source)]

        while heap:
            current_dist, node = heappop(heap)
            if current_dist > dist[node]:
                continue
            for edge in adjacency.get(node, []):
                nd = current_dist + edge.cost
                if nd < dist[edge.to_node]:
                    dist[edge.to_node] = nd
                    heappush(heap, (nd, edge.to_node))

        return dict(dist)
