from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.db.database import get_db
from backend.modules.health.schemas import HealthRiskResponse
from backend.modules.health.service import HealthService
from backend.modules.exposure.schemas import UserHealthProfileCreate, UserHealthProfileResponse
from backend.modules.exposure.service import ExposureService

router = APIRouter(prefix="/health", tags=["health"])
service = HealthService()
exposure_service = ExposureService()

@router.post("/profile", response_model=UserHealthProfileResponse)
def create_or_update_health_profile(profile_data: UserHealthProfileCreate, db: Session = Depends(get_db)):
    # Reuse exposure service logic for profile persistence
    existing = exposure_service.get_health_profile(db, profile_data.user_id)
    if existing:
        for key, value in profile_data.model_dump().items():
            setattr(existing, key, value)
        db.commit()
        db.refresh(existing)
        return existing
    
    from backend.modules.exposure.models import UserHealthProfile
    new_profile = UserHealthProfile(**profile_data.model_dump())
    db.add(new_profile)
    db.commit()
    db.refresh(new_profile)
    return new_profile

@router.get("/risk/{user_id}", response_model=HealthRiskResponse)
def get_health_risk(user_id: int, db: Session = Depends(get_db)):
    try:
        return service.get_user_risk_prediction(db, user_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal Error: {str(e)}")
