from datetime import datetime, date as date_type
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field
from typing import Optional


class UserHealthProfileBase(BaseModel):
    user_id: int
    age: int
    asthma: bool = False
    heart_disease: bool = False
    commute_type: str


class UserHealthProfileCreate(UserHealthProfileBase):
    pass


class UserHealthProfileResponse(UserHealthProfileBase):
    id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class LocationLogBase(BaseModel):
    user_id: int
    latitude: Decimal = Field(..., max_digits=9, decimal_places=6)
    longitude: Decimal = Field(..., max_digits=9, decimal_places=6)
    aqi_value: int
    pm25: Decimal = Field(..., max_digits=10, decimal_places=2)


class LocationLogCreate(BaseModel):
    user_id: int
    latitude: Decimal = Field(..., max_digits=9, decimal_places=6)
    longitude: Decimal = Field(..., max_digits=9, decimal_places=6)
    aqi_value: Optional[int] = None
    pm25: Optional[Decimal] = None


class LocationLogResponse(LocationLogBase):
    id: int
    timestamp: datetime
    alert: bool = False
    message: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class DailyExposureSummaryResponse(BaseModel):
    user_id: int
    date: date_type
    avg_aqi: float
    max_aqi: int
    min_aqi: int
    pm25_total: Decimal
    exposure_score: float
    cigarette_equivalent: float
    risk_level: str
    model_config = ConfigDict(from_attributes=True)


class DailyExposureReportResponse(DailyExposureSummaryResponse):
    pass
