from sqlalchemy.orm import Session

from scraper.pipeline import run_daily_scrape


def run_scrape(db: Session) -> dict[str, int]:
    return run_daily_scrape(db=db)

