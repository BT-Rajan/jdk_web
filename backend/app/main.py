from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.rate_limit import limiter
from app.routers import (
    admin_auth,
    admin_availability,
    admin_booking,
    admin_calendar_events,
    admin_calendar_sync,
    admin_content,
    admin_knowledge,
    admin_leads,
    admin_services,
    admin_settings,
    admin_stats,
    admin_uploads,
    admin_webhooks,
    public_booking,
    public_chat,
    public_config,
    public_content,
)

# repo_root/backend/app/main.py -> repo_root
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
# `npm run build` output — one Vite app now covers both the public
# site and the admin dashboard (mounted client-side at /admin/*, see
# src/App.jsx), so there's a single dist/ to serve instead of two.
FRONTEND_DIST = PROJECT_ROOT / "dist"


def create_app() -> FastAPI:
    app = FastAPI(
        title="JDK API",
        version="0.1.0",
        docs_url="/api/docs" if not settings.is_production else None,
        redoc_url=None,
    )

    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    if settings.allowed_origins_list:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.allowed_origins_list,
            allow_credentials=True,
            allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
            allow_headers=["Content-Type", "X-CSRF-Token"],
        )

    @app.middleware("http")
    async def security_headers(request: Request, call_next):
        resp = await call_next(request)
        resp.headers["X-Content-Type-Options"] = "nosniff"
        resp.headers["X-Frame-Options"] = "DENY"
        resp.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        if settings.is_production:
            resp.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
        return resp

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        # Never leak stack traces / internals to the client — log server
        # side (Pass 10 wires structured logging), return a flat 500.
        import logging
        logging.getLogger("jdk").exception("Unhandled error on %s %s", request.method, request.url.path)
        return JSONResponse(status_code=500, content={"detail": "Internal server error"})

    app.include_router(admin_auth.router)
    app.include_router(admin_settings.router)
    app.include_router(admin_content.router)
    app.include_router(admin_uploads.router)
    app.include_router(admin_booking.router)
    app.include_router(admin_calendar_sync.router)
    app.include_router(admin_calendar_events.router)
    app.include_router(admin_services.router)
    app.include_router(admin_availability.router)
    app.include_router(admin_webhooks.router)
    app.include_router(admin_leads.router)
    app.include_router(admin_stats.router)
    app.include_router(admin_knowledge.router)
    app.include_router(public_config.router)
    app.include_router(public_content.router)
    app.include_router(public_booking.router)
    app.include_router(public_chat.router)

    app.mount("/uploads", StaticFiles(directory=str(settings.UPLOADS_DIR)), name="uploads")

    @app.on_event("startup")
    def _start_background_jobs() -> None:
        # Skipped entirely under pytest — the suite spins up a fresh
        # temp-file SQLite DB per run and doesn't want a background
        # thread polling it (or Google) alongside the tests themselves.
        import sys
        if "pytest" in sys.modules:
            return
        from app.db import sync_schema
        sync_schema()
        from app import scheduler
        scheduler.start()

    @app.on_event("shutdown")
    def _stop_background_jobs() -> None:
        import sys
        if "pytest" in sys.modules:
            return
        from app import scheduler
        scheduler.stop()

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    # ── Single-port production serving ──────────────────────────────
    # If the frontend has been built (`npm run build` at the repo
    # root), serve it straight from this FastAPI process so the whole
    # app — public site, admin dashboard (client-side routes under
    # /admin/*, see src/App.jsx), and API — runs behind one port.
    # Falls back to nothing (404) if dist/ isn't there yet, e.g. in a
    # dev checkout that only runs `npm run dev` separately. Registered
    # last so it never shadows the /api/* and /admin/api/* routers
    # above.
    if FRONTEND_DIST.is_dir():
        assets_dir = FRONTEND_DIST / "assets"
        if assets_dir.is_dir():
            app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

        @app.get("/", include_in_schema=False)
        @app.get("/{full_path:path}", include_in_schema=False)
        async def spa(full_path: str = "") -> FileResponse:
            candidate = FRONTEND_DIST / full_path
            if full_path and candidate.is_file():
                return FileResponse(candidate)
            return FileResponse(FRONTEND_DIST / "index.html")

    return app


app = create_app()
