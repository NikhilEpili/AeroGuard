from __future__ import annotations

from backend.routing.pollution_model import PollutionModel
from backend.services.directions_service import DirectionsService
import logging

_logger = logging.getLogger(__name__)


class RouteController:
    def __init__(self) -> None:
        self.directions_service = DirectionsService()
        self.pollution_model = PollutionModel()

    def build_route_bundle(
        self,
        *,
        start_lat: float,
        start_lon: float,
        end_lat: float,
        end_lon: float,
        travel_mode: str,
        pollution_grid: list[dict[str, float | int]],
        use_predicted_pollution: bool,
    ) -> dict:
        candidates = self.directions_service.get_candidate_routes(
            start_location=(start_lat, start_lon),
            destination=(end_lat, end_lon),
            travel_mode=travel_mode,
        )
        if not candidates:
            raise ValueError("No candidate routes found")

        evaluated = self.pollution_model.evaluate_candidates(
            candidates=candidates,
            pollution_grid=pollution_grid,
            travel_mode=travel_mode,
        )

        # ------------------------------------------------------------------
        # Guarantee ≥ 3 distinct candidates (one per strategy).
        # OSRM often returns only 1–2 routes for short urban trips; without
        # enough diversity select_strategy_routes falls back to ranked[0] for
        # every strategy → all three routes are identical → same stats.
        # We supplement with synthetic (geometrically distinct) candidates
        # only when necessary; real OSRM routes are always preferred.
        # ------------------------------------------------------------------
        distinct_sigs: set[str] = {e.signature for e in evaluated}
        if len(distinct_sigs) < 3:
            _logger.debug(
                "Only %d distinct OSRM candidate(s) found; padding with synthetic routes.",
                len(distinct_sigs),
            )
            synthetic_candidates = self.directions_service.get_synthetic_candidates(
                (start_lat, start_lon), (end_lat, end_lon), travel_mode
            )
            synthetic_evaluated = self.pollution_model.evaluate_candidates(
                candidates=synthetic_candidates,
                pollution_grid=pollution_grid,
                travel_mode=travel_mode,
            )
            for syn in synthetic_evaluated:
                if syn.signature not in distinct_sigs:
                    evaluated.append(syn)
                    distinct_sigs.add(syn.signature)
                    if len(distinct_sigs) >= 3:
                        break

        selected_routes = self.pollution_model.select_strategy_routes(evaluated)
        return self.pollution_model.build_route_bundle(
            selected_routes=selected_routes,
            use_predicted_pollution=use_predicted_pollution,
        )