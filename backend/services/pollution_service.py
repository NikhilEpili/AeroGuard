from backend.grid.pollution_interpolator import PollutionInterpolator
from backend.routing.pollution_cost import PollutionCostCalculator


class PollutionService:
    def __init__(self) -> None:
        self.interpolator = PollutionInterpolator()
        self.cost_calculator = PollutionCostCalculator()
        self._sample_points = [
            {"latitude": 12.9716, "longitude": 77.5946, "pm25": 28.0, "pm10": 52.0, "no2": 19.0},
            {"latitude": 12.9352, "longitude": 77.6245, "pm25": 35.0, "pm10": 61.0, "no2": 24.0},
            {"latitude": 12.9991, "longitude": 77.7011, "pm25": 22.0, "pm10": 40.0, "no2": 16.0},
        ]

    async def score_candidates(self, candidates: list[dict]) -> list[dict]:
        scored_routes: list[dict] = []
        for candidate in candidates:
            pollution_cost = 0.0
            for point in candidate["geometry"]:
                pollution = self.interpolator.interpolate(point["lat"], point["lng"], self._sample_points)
                pollution_cost += self.cost_calculator.segment_cost(
                    pm25=pollution["pm25"],
                    pm10=pollution["pm10"],
                    no2=pollution["no2"],
                    distance_km=max(candidate["distance_km"] / max(len(candidate["geometry"]), 1), 0.1),
                )
            candidate["exposure_score"] = round(pollution_cost, 3)
            scored_routes.append(candidate)
        return scored_routes

    async def ingest_sensor_reading(self, reading: dict) -> None:
        self._sample_points.append(
            {
                "latitude": reading["latitude"],
                "longitude": reading["longitude"],
                "pm25": reading["pm25"],
                "pm10": reading["pm10"],
                "no2": reading["no2"],
            }
        )
