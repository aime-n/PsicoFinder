from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.scrape import ScrapeRunResponse
from app.services.scrape import run_scrape

router = APIRouter()


@router.post("/run", response_model=ScrapeRunResponse)
def trigger_scrape(db: Session = Depends(get_db)) -> ScrapeRunResponse:
    result = run_scrape(db)
    return ScrapeRunResponse(**result)

