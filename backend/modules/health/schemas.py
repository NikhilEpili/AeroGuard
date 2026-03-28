from typing import Dict, List
from pydantic import BaseModel

class HealthRiskResponse(BaseModel):
    risk_score: float
    risk_category: str
    symptoms: List[str]
    probabilities: Dict[str, float]
    risk_level: str

    class Config:
        from_attributes = True
