from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier


@dataclass(frozen=True)
class HealthModelBundle:
    model: RandomForestClassifier


MODEL_PATH = Path(__file__).resolve().parent / "model.pkl"


def _build_synthetic_dataset(sample_size: int = 1200, seed: int = 42) -> tuple[np.ndarray, np.ndarray]:
    rng = np.random.default_rng(seed)

    age = rng.integers(18, 85, sample_size)
    pm25 = rng.uniform(10, 180, sample_size)
    no2 = rng.uniform(8, 120, sample_size)
    co = rng.uniform(0.2, 15.0, sample_size)
    asthma = rng.integers(0, 2, sample_size)
    heart_disease = rng.integers(0, 2, sample_size)
    exposure_duration = rng.uniform(0.25, 24.0, sample_size)

    base = (
        0.45 * pm25
        + 0.25 * no2
        + 1.8 * co
        + 0.25 * age
        + 18 * asthma
        + 15 * heart_disease
        + 1.4 * exposure_duration
    )

    noise = rng.normal(0, 8, sample_size)
    risk_signal = base + noise

    target = np.where(risk_signal < 65, 0, np.where(risk_signal < 110, 1, 2))

    features = np.column_stack(
        [age, pm25, no2, co, asthma, heart_disease, exposure_duration]
    )
    return features, target


def train_and_save_model(model_path: Path = MODEL_PATH) -> Path:
    features, target = _build_synthetic_dataset()

    model = RandomForestClassifier(
        n_estimators=120,
        max_depth=8,
        min_samples_leaf=3,
        random_state=42,
    )
    model.fit(features, target)

    model_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, model_path)
    return model_path


def load_or_train_model(model_path: Path = MODEL_PATH) -> HealthModelBundle:
    if not model_path.exists():
        train_and_save_model(model_path)

    model = joblib.load(model_path)
    return HealthModelBundle(model=model)


def predict_health_risk(input_data: dict[str, float | int], model_path: Path = MODEL_PATH) -> dict[str, object]:
    bundle = load_or_train_model(model_path)

    vector = np.array(
        [[
            float(input_data["age"]),
            float(input_data["pm25"]),
            float(input_data["no2"]),
            float(input_data["co"]),
            float(input_data["asthma"]),
            float(input_data["heart_disease"]),
            float(input_data["exposure_duration"]),
        ]],
        dtype=float,
    )

    probabilities = bundle.model.predict_proba(vector)[0]
    p_low, p_medium, p_high = [float(v) for v in probabilities]

    risk_score = (p_low * 20.0) + (p_medium * 55.0) + (p_high * 90.0)
    risk_score = max(0.0, min(100.0, risk_score))

    if risk_score < 40:
        risk_category = "LOW"
    elif risk_score < 70:
        risk_category = "MEDIUM"
    else:
        risk_category = "HIGH"

    return {
        "risk_score": round(risk_score, 2),
        "risk_category": risk_category,
        "probabilities": {
            "LOW": round(p_low, 4),
            "MEDIUM": round(p_medium, 4),
            "HIGH": round(p_high, 4),
        },
    }
