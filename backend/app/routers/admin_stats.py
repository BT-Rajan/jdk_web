from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_admin
from app.models import AdminUser, Lead

router = APIRouter(prefix="/admin/api/stats", tags=["admin-stats"])


@router.get("/overview")
def overview(admin: AdminUser = Depends(get_current_admin), db: Session = Depends(get_db)):
    leads_by_status = dict(db.execute(select(Lead.status, func.count()).group_by(Lead.status)).all())

    recent_leads = db.scalars(select(Lead).order_by(Lead.created_at.desc()).limit(5)).all()

    return {
        "leads_total": sum(leads_by_status.values()),
        "leads_by_status": leads_by_status,
        "recent_leads": [
            {"id": l.id, "name": l.name, "email": l.email, "source": l.source,
             "status": l.status, "created_at": l.created_at.isoformat()}
            for l in recent_leads
        ],
    }
