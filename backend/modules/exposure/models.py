from datetime import datetime, date as date_type
from decimal import Decimal
from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column
from backend.db.database import Base

class UserHealthProfile(Base):
    __tablename__ = "users_health_profile"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, unique=True, index=True, nullable=False)
    age: Mapped[int] = mapped_column(Integer, nullable=False)
    asthma: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    heart_disease: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    commute_type: Mapped[str] = mapped_column(String(50), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class UserLocationLog(Base):
    __tablename__ = "user_location_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    latitude: Mapped[Decimal] = mapped_column(Numeric(9, 6), nullable=False)
    longitude: Mapped[Decimal] = mapped_column(Numeric(9, 6), nullable=False)
    aqi_value: Mapped[int] = mapped_column(Integer, nullable=False)
    pm25: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)


class DailyExposureSummary(Base):
    __tablename__ = "daily_exposure_summary"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    date: Mapped[date_type] = mapped_column(Date, index=True, nullable=False)
    avg_aqi: Mapped[float] = mapped_column(Float, nullable=False)
    max_aqi: Mapped[int] = mapped_column(Integer, nullable=False)
    min_aqi: Mapped[int] = mapped_column(Integer, nullable=False)
    pm25_total: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    exposure_score: Mapped[float] = mapped_column(Float, nullable=False)
    cigarette_equivalent: Mapped[float] = mapped_column(Float, nullable=False)
    risk_level: Mapped[str] = mapped_column(String(50), nullable=False)
