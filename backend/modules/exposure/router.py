from datetime import date
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.db.database import get_db
from backend.modules.exposure.models import UserHealthProfile, UserLocationLog
from backend.modules.exposure.schemas import (
    DailyExposureReportResponse,
    DailyExposureSummaryResponse,
    UserHealthProfileCreate,
    UserHealthProfileResponse,
    LocationLogCreate,
    LocationLogResponse
)
from backend.modules.exposure.service import ExposureService

router = APIRouter(prefix="/exposure", tags=["exposure"])
service = ExposureService()


@router.post("/profile", response_model=UserHealthProfileResponse)
def create_or_update_profile(profile_data: UserHealthProfileCreate, db: Session = Depends(get_db)):
    existing = service.get_health_profile(db, profile_data.user_id)
    if existing:
        for key, value in profile_data.model_dump().items():
            setattr(existing, key, value)
        db.commit()
        db.refresh(existing)
        return existing
    
    new_profile = UserHealthProfile(**profile_data.model_dump())
    db.add(new_profile)
    db.commit()
    db.refresh(new_profile)
    return new_profile


@router.get("/profile/{user_id}", response_model=UserHealthProfileResponse)
def get_profile(user_id: int, db: Session = Depends(get_db)):
    profile = service.get_health_profile(db, user_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile


@router.post("/log", response_model=LocationLogResponse)
def log_location(log_data: LocationLogCreate, db: Session = Depends(get_db)):
    # 1. Fetch nearest sensor pollution if not provided
    aqi = log_data.aqi_value
    pm25 = log_data.pm25
    
    if aqi is None or pm25 is None:
        aqi_fetched, pm25_fetched = service.get_pollution_for_location(
            float(log_data.latitude), float(log_data.longitude)
        )
        aqi = aqi if aqi is not None else aqi_fetched
        pm25 = pm25 if pm25 is not None else pm25_fetched

    # 2. Check for alerts
    is_alert, alert_msg = service.check_alert_status(aqi, pm25)

    # 3. Store the log
    new_log = UserLocationLog(
        user_id=log_data.user_id,
        latitude=log_data.latitude,
        longitude=log_data.longitude,
        aqi_value=aqi,
        pm25=pm25
    )
    db.add(new_log)
    db.commit()
    db.refresh(new_log)
    
    # 4. Construct response with alert info
    response = LocationLogResponse.model_validate(new_log)
    response.alert = is_alert
    response.message = alert_msg
    return response


@router.get("/summary/{user_id}", response_model=DailyExposureSummaryResponse)
def get_daily_summary(
    user_id: int, 
    target_date: date = Query(default=date.today()), 
    db: Session = Depends(get_db)
):
    summary = service.calculate_daily_summary(db, user_id, target_date)
    if not summary:
        raise HTTPException(status_code=404, detail="No logs found for this date")
    
    db.commit() # Save the generated/updated summary
    return summary


@router.get("/report/{user_id}", response_model=DailyExposureReportResponse)
def get_daily_report(
    user_id: int, 
    target_date: date = Query(default=date.today()), 
    db: Session = Depends(get_db)
):
    summary = service.calculate_daily_summary(db, user_id, target_date)
    if not summary:
        raise HTTPException(status_code=404, detail="No logs found for this date")
    
    db.commit()
    return summary
