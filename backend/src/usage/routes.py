"""API usage tracking routes."""
from typing import List, Optional
from datetime import datetime
from collections import defaultdict

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..database import get_db, ApiUsage, User
from ..auth.deps import get_current_user
from ..utils.cost_calculator import usd_to_dkk, get_exchange_rate

router = APIRouter(prefix="/api/usage", tags=["usage"])


class UsageResponse(BaseModel):
    id: int
    provider: str
    model: str
    operation: str
    api_tier: Optional[str] = None
    audio_seconds: Optional[float] = None
    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None
    images_generated: Optional[int] = None
    image_resolution: Optional[str] = None
    cost_usd: float
    cost_dkk: float
    transcription_id: Optional[int] = None
    style_guide_id: Optional[int] = None
    image_generation_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


class OperationSummary(BaseModel):
    operation: str
    count: int
    total_cost_usd: float
    total_cost_dkk: float


class MonthlySummary(BaseModel):
    month: str  # YYYY-MM format
    total_cost_usd: float
    total_cost_dkk: float
    count: int


class UsageSummaryResponse(BaseModel):
    total_cost_usd: float
    total_cost_dkk: float
    exchange_rate: float
    total_requests: int
    by_operation: List[OperationSummary]
    by_month: List[MonthlySummary]


def usage_to_response(usage: ApiUsage) -> UsageResponse:
    """Convert database model to response with DKK conversion."""
    return UsageResponse(
        id=usage.id,
        provider=usage.provider,
        model=usage.model,
        operation=usage.operation,
        api_tier=usage.api_tier,
        audio_seconds=usage.audio_seconds,
        input_tokens=usage.input_tokens,
        output_tokens=usage.output_tokens,
        images_generated=usage.images_generated,
        image_resolution=usage.image_resolution,
        cost_usd=usage.cost_usd,
        cost_dkk=usd_to_dkk(usage.cost_usd),
        transcription_id=usage.transcription_id,
        style_guide_id=usage.style_guide_id,
        image_generation_id=usage.image_generation_id,
        created_at=usage.created_at
    )


@router.get("", response_model=List[UsageResponse])
def list_usage(
    skip: int = 0,
    limit: int = 100,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all API usage for the current user, newest first."""
    usage_records = db.query(ApiUsage).filter(
        ApiUsage.user_id == user.id
    ).order_by(ApiUsage.created_at.desc()).offset(skip).limit(limit).all()

    return [usage_to_response(u) for u in usage_records]


@router.get("/summary", response_model=UsageSummaryResponse)
def get_usage_summary(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get aggregated usage summary for the current user."""
    # Get all usage records for this user
    usage_records = db.query(ApiUsage).filter(
        ApiUsage.user_id == user.id
    ).all()

    # Calculate totals
    total_cost_usd = sum(u.cost_usd for u in usage_records)
    total_requests = len(usage_records)

    # Group by operation
    by_operation_dict = defaultdict(lambda: {"count": 0, "cost": 0.0})
    for u in usage_records:
        by_operation_dict[u.operation]["count"] += 1
        by_operation_dict[u.operation]["cost"] += u.cost_usd

    by_operation = [
        OperationSummary(
            operation=op,
            count=data["count"],
            total_cost_usd=data["cost"],
            total_cost_dkk=usd_to_dkk(data["cost"])
        )
        for op, data in sorted(by_operation_dict.items())
    ]

    # Group by month
    by_month_dict = defaultdict(lambda: {"count": 0, "cost": 0.0})
    for u in usage_records:
        month_key = u.created_at.strftime("%Y-%m")
        by_month_dict[month_key]["count"] += 1
        by_month_dict[month_key]["cost"] += u.cost_usd

    by_month = [
        MonthlySummary(
            month=month,
            count=data["count"],
            total_cost_usd=data["cost"],
            total_cost_dkk=usd_to_dkk(data["cost"])
        )
        for month, data in sorted(by_month_dict.items(), reverse=True)
    ]

    return UsageSummaryResponse(
        total_cost_usd=total_cost_usd,
        total_cost_dkk=usd_to_dkk(total_cost_usd),
        exchange_rate=get_exchange_rate(),
        total_requests=total_requests,
        by_operation=by_operation,
        by_month=by_month
    )
