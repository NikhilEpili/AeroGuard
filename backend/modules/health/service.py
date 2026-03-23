from datetime import date
from sqlalchemy.orm import Session
from backend.modules.exposure.models import UserHealthProfile, DailyExposureSummary
from backend.modules.health.schemas import HealthRiskResponse

class HealthService:
    def get_user_risk_prediction(self, db: Session, user_id: int) -> HealthRiskResponse:
        # 1. Fetch Health Profile
        profile = db.query(UserHealthProfile).filter(UserHealthProfile.user_id == user_id).first()
        if not profile:
            raise ValueError("User health profile not found. Please create one first.")

        # 2. Fetch Latest Exposure Summary (Today)
        today = date.today()
        summary = db.query(DailyExposureSummary).filter(
            DailyExposureSummary.user_id == user_id,
            DailyExposureSummary.date == today
        ).first()
        
        exposure_score = summary.exposure_score if (summary and hasattr(summary, 'exposure_score')) else 0.0
        print(f"DEBUG: user_id={user_id}, exposure_score={exposure_score}, profile_age={profile.age}")

        # 3. Rule-based ML Logic
        # Risk Score Formula: base = exposure * 0.6, age * 0.2, disease (+15 if asthma, +10 if heart)
        base_score = exposure_score * 0.6
        age_factor = profile.age * 0.2
        disease_factor = (15 if profile.asthma else 0) + (10 if profile.heart_disease else 0)
        
        risk_score = min(100.0, base_score + age_factor + disease_factor)

        # 4. Symptom Prediction
        predicted_symptoms = []
        short_term_warning = ""
        long_term_warning = ""
        recommendations = []

        if risk_score > 70:
            predicted_symptoms = ["Breathing Irritation (HIGH)", "Headache (40%)", "Asthma Trigger (HIGH)"]
            short_term_warning = "High risk of immediate respiratory distress."
            long_term_warning = "Frequent high exposure linked to chronic lung inflammation."
            recommendations = ["Avoid all outdoor activity", "Use N95 mask indoors if needed", "Keep inhaler ready"]
        elif 40 <= risk_score <= 70:
            predicted_symptoms = ["Mild Throat Irritation", "Fatigue (20%)"]
            short_term_warning = "Moderate exposure detected. Monitor for symptoms."
            long_term_warning = "Sustained moderate exposure may impact lung capacity over years."
            recommendations = ["Limit outdoor workout", "Use mask in high traffic zones", "Prefer metro commute"]
        else:
            predicted_symptoms = []
            short_term_warning = "Safe levels currently."
            long_term_warning = "Low risk, but prolonged exposure should always be monitored."
            recommendations = ["Outdoor activities safe", "Standard hydration recommended"]

        risk_level = "High" if risk_score > 70 else "Moderate" if risk_score >= 40 else "Low"

        return HealthRiskResponse(
            user_id=user_id,
            risk_score=round(risk_score, 2),
            exposure_score=round(exposure_score, 2),
            risk_level=risk_level,
            predicted_symptoms=predicted_symptoms,
            short_term_warning=short_term_warning,
            long_term_warning=long_term_warning,
            recommendations=recommendations
        )
