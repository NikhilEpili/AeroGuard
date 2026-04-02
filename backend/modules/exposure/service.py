import json
import random
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.cache.redis_client import get_sync_redis_client
from backend.modules.exposure.models import UserHealthProfile, UserLog
from backend.services.pollution_service import PollutionService


class ExposureService:
    def __init__(self):
        self._redis = get_sync_redis_client()

    @staticmethod
    def _normalize_timestamp(ts: datetime) -> datetime:
        if ts.tzinfo is None:
            return ts.replace(tzinfo=timezone.utc)
        return ts.astimezone(timezone.utc)

    @staticmethod
    def _risk_from_avg_pm25(avg_pm25: float) -> str:
        if avg_pm25 < 40:
            return "LOW"
        if avg_pm25 < 70:
            return "MEDIUM"
        return "HIGH"

    def create_user_log(self, db: Session, user_id: int, latitude: Decimal, longitude: Decimal, timestamp: datetime) -> UserLog:
        pm25_int = random.randint(40, 120)
        pm25 = Decimal(str(pm25_int))
        aqi = PollutionService.pm25_to_aqi(float(pm25))

        new_log = UserLog(
            user_id=user_id,
            latitude=latitude,
            longitude=longitude,
            pm25=pm25,
            aqi=aqi,
            timestamp=self._normalize_timestamp(timestamp),
        )
        db.add(new_log)
        db.commit()
        db.refresh(new_log)
        self._invalidate_user_cache(user_id)
        return new_log

    def get_logs_last_24h(self, db: Session, user_id: int) -> list[UserLog]:
        now = datetime.now(timezone.utc)
        since = now - timedelta(hours=24)
        return db.execute(
            select(UserLog)
            .where(UserLog.user_id == user_id)
            .where(UserLog.timestamp >= since)
            .order_by(UserLog.timestamp.asc())
        ).scalars().all()

    def get_timeline(self, db: Session, user_id: int) -> list[dict[str, int | str]]:
        cache_key = f"exposure:timeline:{user_id}"
        cached = self._read_cache(cache_key)
        if cached is not None:
            return cached

        logs = self.get_logs_last_24h(db, user_id)
        timeline = [{"time": log.timestamp.strftime("%H:%M"), "pm25": int(float(log.pm25))} for log in logs]
        self._write_cache(cache_key, timeline)
        return timeline

    @staticmethod
    def calculate_exposure(logs: list[UserLog]) -> dict[str, float | str]:
        if not logs:
            return {
                "avg_pm25": 0.0,
                "max_pm25": 0.0,
                "min_pm25": 0.0,
                "cigarettes": 0.0,
                "risk_level": "LOW",
            }

        if len(logs) == 1:
            avg_pm25 = float(logs[0].pm25)
            max_pm25 = avg_pm25
            min_pm25 = avg_pm25
            cigarettes = min(10.0, avg_pm25 / 22.0)
            return {
                "avg_pm25": round(avg_pm25, 2),
                "max_pm25": round(max_pm25, 2),
                "min_pm25": round(min_pm25, 2),
                "cigarettes": round(cigarettes, 2),
                "risk_level": ExposureService._risk_from_avg_pm25(avg_pm25),
            }

        weighted_sum = 0.0
        total_seconds = 0.0
        max_pm25 = max(float(log.pm25) for log in logs)
        min_pm25 = min(float(log.pm25) for log in logs)

        for idx, log in enumerate(logs[:-1]):
            current_ts = ExposureService._normalize_timestamp(log.timestamp)
            next_ts = ExposureService._normalize_timestamp(logs[idx + 1].timestamp)
            duration_seconds = max((next_ts - current_ts).total_seconds(), 0.0)
            weighted_sum += float(log.pm25) * duration_seconds
            total_seconds += duration_seconds

        if total_seconds <= 0:
            avg_pm25 = float(logs[-1].pm25)
        else:
            avg_pm25 = weighted_sum / total_seconds

        cigarettes = min(10.0, avg_pm25 / 22.0)
        return {
            "avg_pm25": round(avg_pm25, 2),
            "max_pm25": round(max_pm25, 2),
            "min_pm25": round(min_pm25, 2),
            "cigarettes": round(cigarettes, 2),
            "risk_level": ExposureService._risk_from_avg_pm25(avg_pm25),
        }

    def get_exposure_report(self, db: Session, user_id: int) -> dict[str, float | str]:
        cache_key = f"exposure:report:{user_id}"
        cached = self._read_cache(cache_key)
        if cached is not None:
            return cached

        logs = self.get_logs_last_24h(db, user_id)
        report = self.calculate_exposure(logs)
        self._write_cache(cache_key, report)
        return report

    def _invalidate_user_cache(self, user_id: int) -> None:
        try:
            self._redis.delete(f"exposure:timeline:{user_id}")
            self._redis.delete(f"exposure:report:{user_id}")
            self._redis.delete(f"health:risk:{user_id}")
        except Exception:
            return

    def _read_cache(self, key: str) -> Optional[dict | list]:
        try:
            payload = self._redis.get(key)
            if not payload:
                return None
            return json.loads(payload)
        except Exception:
            return None

    def _write_cache(self, key: str, value: dict | list, ttl_seconds: int = 120) -> None:
        try:
            self._redis.setex(key, ttl_seconds, json.dumps(value))
        except Exception:
            return

    @staticmethod
    def get_health_profile(db: Session, user_id: int) -> Optional[UserHealthProfile]:
        return db.execute(
            select(UserHealthProfile).where(UserHealthProfile.user_id == user_id)
        ).scalar_one_or_none()
