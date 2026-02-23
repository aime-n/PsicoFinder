from app.db.session import SessionLocal
from scraper.pipeline import run_daily_scrape


def main() -> None:
    with SessionLocal() as db:
        result = run_daily_scrape(db)
        print(result)


if __name__ == "__main__":
    main()
