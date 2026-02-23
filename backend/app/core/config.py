from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "PsicoFinder API"
    app_env: str = "development"
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    api_v1_prefix: str = "/api/v1"
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/psicofinder"
    database_direct_url: str | None = None
    database_echo: bool = False
    database_pool_size: int = 5
    database_max_overflow: int = 10
    scraper_source_url: str = (
        "https://www.doctoralia.com.br/pesquisa?q=Psic%C3%B3logo&loc="
        "&filters%5Bspecializations%5D%5B%5D=76&filters%5Bonline_only%5D=1&page={page}"
    )
    scraper_user_agent: str = "PsicoFinderBot/1.0"
    scraper_max_pages: int = 2
    scraper_profile_concurrency: int = 6

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False)

    @property
    def alembic_database_url(self) -> str:
        return self.database_direct_url or self.database_url


settings = Settings()
