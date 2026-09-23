from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import Field
from sqlalchemy.orm import Session

from app import booking_service
from app.config import settings
from app.db import get_db
from app.rate_limit import limiter
from app.schema_base import CamelModel
from app.settings_service import get_setting

router = APIRouter(prefix="/api/booking", tags=["public-booking"])


class AnswerIn(CamelModel):
    question_id: str
    answer: str = Field(default="", max_length=2000)


class CreateAppointmentRequest(CamelModel):
    date: str
    slot: str
    name: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=3, max_length=254)
    phone: str = Field(default="", max_length=40)
    service: str = Field(default="", max_length=200)
    notes: str = Field(default="", max_length=1000)
    lang: str = Field(default="en", max_length=8)
    service_id: str | None = None
    answers: list[AnswerIn] = Field(default_factory=list)


class LookupRequest(CamelModel):
    id: str = Field(max_length=16)
    email: str = Field(max_length=254)


class CancelRequest(CamelModel):
    id: str = Field(max_length=16)
    email: str = Field(max_length=254)


class RescheduleRequest(CamelModel):
    id: str = Field(max_length=16)
    email: str = Field(max_length=254)
    date: str
    time: str


@router.get("/services")
def list_services(db: Session = Depends(get_db)):
    """Active services only — a service becomes visible here the moment
    an admin activates it (services_service.py), with no
    features.bookingEnabled gate: browsing what's offered is harmless
    even while booking itself is switched off."""
    from app import services_service
    return [
        {
            "id": s.id, "name": s.name, "slug": s.slug, "durationMinutes": s.duration_minutes,
            "locationType": s.location_type,
            "questions": [
                {"id": q.id, "kind": q.kind, "label": q.label, "required": q.required}
                for q in s.questions
            ],
        }
        for s in services_service.list_services(db, active_only=True)
    ]


@router.get("/slots")
def get_slots(date: str, service_id: str | None = Query(default=None, alias="serviceId"), db: Session = Depends(get_db)):
    if not get_setting(db, "features.bookingEnabled"):
        return {"slots": []}
    try:
        slots = booking_service.available_slots(db, date, service_id=service_id)
    except ValueError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid date")
    except booking_service.InvalidServiceError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown or inactive service")
    # Otherwise read-only, but Pass 12's calendar sync can refresh and
    # cache a Google access token as a side effect of computing these
    # slots (calendar_sync_service._ensure_fresh_access_token) — commit
    # so that refresh is actually persisted rather than silently
    # discarded when this session closes, which would otherwise force
    # a fresh token refresh on every single slots request.
    db.commit()
    return {"slots": slots}


@router.post("/appointments")
@limiter.limit(settings.RATE_LIMIT_APPOINTMENT)
def create_appointment(request: Request, body: CreateAppointmentRequest, db: Session = Depends(get_db)):
    if not get_setting(db, "features.bookingEnabled"):
        return {"ok": False, "error": "booking_disabled"}
    result = booking_service.create_appointment(
        db, date_str=body.date, time_str=body.slot, name=body.name, email=body.email,
        phone=body.phone, service=body.service, notes=body.notes, lang=body.lang,
        service_id=body.service_id, answers=[a.model_dump() for a in body.answers],
    )
    return booking_service.finalize_created_appointment(db, result)


@router.post("/appointments/lookup")
@limiter.limit(settings.RATE_LIMIT_LOOKUP)
def lookup_appointment(request: Request, body: LookupRequest, db: Session = Depends(get_db)):
    return booking_service.lookup_appointment(db, body.id, body.email)


@router.post("/appointments/cancel")
@limiter.limit(settings.RATE_LIMIT_APPOINTMENT)
def cancel_appointment(request: Request, body: CancelRequest, db: Session = Depends(get_db)):
    result = booking_service.cancel_appointment(db, body.id, body.email)
    return booking_service.finalize_cancelled_appointment(db, result, body.id)


@router.post("/appointments/reschedule")
@limiter.limit(settings.RATE_LIMIT_APPOINTMENT)
def reschedule_appointment(request: Request, body: RescheduleRequest, db: Session = Depends(get_db)):
    result = booking_service.reschedule_appointment(db, body.id, body.email, body.date, body.time)
    return booking_service.finalize_rescheduled_appointment(db, result, body.id)
