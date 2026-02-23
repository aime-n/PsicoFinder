from fastapi import APIRouter

from app.api.routes import scrape, therapists

api_router = APIRouter()
api_router.include_router(therapists.router, prefix="/therapists", tags=["therapists"])
api_router.include_router(scrape.router, prefix="/scrape", tags=["scrape"])

