import json
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.cache.redis_client import get_sync_redis_client
from backend.modules.exposure.models import UserHealthProfile, UserLog
from backend.modules.health.model import predict_health_risk
from backend.modules.health.schemas import HealthRiskResponse

class HealthService:
    def __init__(self):
        self._redis = get_sync_redis_client()

    def get_user_risk_prediction(self, db: Session, user_id: int) -> HealthRiskResponse:
        cache_key = f"health:risk:{user_id}"
        cached = self._read_cache(cache_key)
        if cached is not None:
            return HealthRiskResponse(**cached)

        profile = db.execute(
            select(UserHealthProfile).where(UserHealthProfile.user_id == user_id)
        ).scalar_one_or_none()

        now = datetime.now(timezone.utc)
        since = now - timedelta(hours=24)
        logs = db.execute(
            select(UserLog)
            .where(UserLog.user_id == user_id)
            .where(UserLog.timestamp >= since)
            .order_by(UserLog.timestamp.asc())
        ).scalars().all()

        if not logs:
            raise ValueError("No exposure logs found for the last 24 hours.")

        avg_pm25 = sum(float(log.pm25) for log in logs) / len(logs)
        max_pm25 = max(float(log.pm25) for log in logs)
        first_ts = self._as_utc(logs[0].timestamp)
        last_ts = self._as_utc(logs[-1].timestamp)
        exposure_duration = max(0.25, (last_ts - first_ts).total_seconds() / 3600.0)

        no2 = max(5.0, min(120.0, avg_pm25 * 0.55))
        co = max(0.2, min(15.0, avg_pm25 / 14.0))

        input_data = {
            "age": profile.age if profile else 30,
            "pm25": avg_pm25,
            "no2": no2,
            "co": co,
            "asthma": 1 if profile and profile.asthma else 0,
            "heart_disease": 1 if profile and profile.heart_disease else 0,
            "exposure_duration": exposure_duration,
        }

        prediction = predict_health_risk(input_data)
        risk_category = str(prediction["risk_category"])

        if risk_category == "HIGH":
            symptoms = ["breathing issues", "asthma trigger"]
        elif risk_category == "MEDIUM":
            symptoms = ["irritation", "fatigue"]
        else:
            symptoms = ["safe warning"]

        response = HealthRiskResponse(
            risk_score=float(prediction["risk_score"]),
            risk_category=risk_category,
            symptoms=symptoms,
            probabilities=prediction["probabilities"],
            risk_level=risk_category,
        )

        self._write_cache(cache_key, response.model_dump())
        return response

    def _read_cache(self, key: str) -> dict | None:
        try:
            payload = self._redis.get(key)
            if not payload:
                return None
            return json.loads(payload)
        except Exception:
            return None

    def _write_cache(self, key: str, value: dict, ttl_seconds: int = 120) -> None:
        try:
            self._redis.setex(key, ttl_seconds, json.dumps(value))
        except Exception:
            return

    @staticmethod
    def _as_utc(ts: datetime) -> datetime:
        if ts.tzinfo is None:
            return ts.replace(tzinfo=timezone.utc)
        return ts.astimezone(timezone.utc)
