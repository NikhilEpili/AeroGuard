from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional, Tuple

from sqlalchemy import select, func
from sqlalchemy.orm import Session

from backend.modules.exposure.models import DailyExposureSummary, UserHealthProfile, UserLocationLog
from backend.services.pollution_service import PollutionService


class ExposureService:
    def __init__(self):
        self.pollution_service = PollutionService()

    def get_pollution_for_location(self, lat: float, lon: float) -> Tuple[int, Decimal]:
        """Fetch nearest sensor pollution data using IDW interpolation."""
        # Note: PollutionService.interpolator.interpolate is synchronous
        pollution = self.pollution_service.interpolator.interpolate(
            lat, lon, self.pollution_service._sample_points
        )
        pm25 = Decimal(str(round(float(pollution["pm25"]), 2)))
        aqi = self.pollution_service.pm25_to_aqi(float(pm25))
        return aqi, pm25

    @staticmethod
    def check_alert_status(aqi: int, pm25: Decimal) -> Tuple[bool, Optional[str]]:
        if aqi > 150 or pm25 > 60:
            return True, "High pollution nearby. Consider mask or route change"
        return False, None

    @staticmethod
    def calculate_risk_level(exposure_score: float) -> str:
        if exposure_score < 20:
            return "Low"
        elif exposure_score < 50:
            return "Moderate"
        elif exposure_score < 75:
            return "High"
        else:
            return "Extreme"

    @staticmethod
    def calculate_daily_summary(db: Session, user_id: int, target_date: date) -> Optional[DailyExposureSummary]:
        logs = db.execute(
            select(UserLocationLog)
            .where(UserLocationLog.user_id == user_id)
            .where(func.date(UserLocationLog.timestamp) == target_date)
            .order_by(UserLocationLog.timestamp)
        ).scalars().all()

        if not logs:
            return None

        total_pm25 = Decimal("0")
        aqi_values = []
        total_exposure_units = Decimal("0")

        for i, log in enumerate(logs):
            total_pm25 += log.pm25
            aqi_values.append(log.aqi_value)
            
            # exposure_unit = pm25 * duration_minutes
            if i < len(logs) - 1:
                duration = (logs[i+1].timestamp - log.timestamp).total_seconds() / 60
            else:
                # For the last log of the day, assume it covers 1 minute or until end of day
                duration = 1.0
            
            total_exposure_units += log.pm25 * Decimal(str(duration))

        avg_aqi = float(sum(aqi_values)) / len(aqi_values)
        max_aqi = max(aqi_values)
        min_aqi = min(aqi_values)
        
        # exposure_score = min(100, total_exposure / 10)
        exposure_score = min(100.0, float(total_exposure_units) / 10.0)
        
        # cigarettes = total_pm25 / 22
        cigarette_equivalent = float(total_pm25) / 22.0

        summary = DailyExposureSummary(
            user_id=user_id,
            date=target_date,
            avg_aqi=avg_aqi,
            max_aqi=max_aqi,
            min_aqi=min_aqi,
            pm25_total=total_pm25,
            exposure_score=exposure_score,
            cigarette_equivalent=cigarette_equivalent,
            risk_level=ExposureService.calculate_risk_level(exposure_score)
        )
        
        # Update or create
        existing = db.execute(
            select(DailyExposureSummary)
            .where(DailyExposureSummary.user_id == user_id)
            .where(DailyExposureSummary.date == target_date)
        ).scalar_one_or_none()
        
        if existing:
            existing.avg_aqi = summary.avg_aqi
            existing.max_aqi = summary.max_aqi
            existing.min_aqi = summary.min_aqi
            existing.pm25_total = summary.pm25_total
            existing.exposure_score = summary.exposure_score
            existing.cigarette_equivalent = summary.cigarette_equivalent
            existing.risk_level = summary.risk_level
            return existing
        else:
            db.add(summary)
            return summary

    @staticmethod
    def get_health_profile(db: Session, user_id: int) -> Optional[UserHealthProfile]:
        return db.execute(
            select(UserHealthProfile).where(UserHealthProfile.user_id == user_id)
        ).scalar_one_or_none()
