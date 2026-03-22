from typing import List, Optional
from pydantic import BaseModel
from datetime import date

class HealthRiskResponse(BaseModel):
    user_id: int
    risk_score: float
    exposure_score: float
    risk_level: str
    predicted_symptoms: List[str]
    short_term_warning: str
    long_term_warning: str
    recommendations: List[str]

    class Config:
        from_attributes = True

class SymptomProbability(BaseModel):
    symptom: str
    probability: int # Percentage 0-100
