from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.db.database import get_db
from backend.modules.exposure.models import UserHealthProfile
from backend.modules.exposure.schemas import (
    ExposureLogCreate,
    ExposureLogResponse,
    ExposureReportResponse,
    ExposureTimelineItem,
    UserHealthProfileCreate,
    UserHealthProfileResponse,
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


@router.post("/log", response_model=ExposureLogResponse)
def log_location(log_data: ExposureLogCreate, db: Session = Depends(get_db)):
    return service.create_user_log(
        db=db,
        user_id=log_data.user_id,
        latitude=log_data.latitude,
        longitude=log_data.longitude,
        timestamp=log_data.timestamp,
    )


@router.get("/timeline/{user_id}", response_model=List[ExposureTimelineItem])
def get_timeline(user_id: int, db: Session = Depends(get_db)):
    return service.get_timeline(db, user_id)


@router.get("/report/{user_id}", response_model=ExposureReportResponse)
def get_daily_report(user_id: int, db: Session = Depends(get_db)):
    report = service.get_exposure_report(db, user_id)
    if report["avg_pm25"] == 0.0:
        raise HTTPException(status_code=404, detail="No logs found in the last 24 hours")
    return report


@router.get("/summary/{user_id}", response_model=ExposureReportResponse)
def get_daily_summary(user_id: int, db: Session = Depends(get_db)):
    report = service.get_exposure_report(db, user_id)
    if report["avg_pm25"] == 0.0:
        raise HTTPException(status_code=404, detail="No logs found in the last 24 hours")
    return report
