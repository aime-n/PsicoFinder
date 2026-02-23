from pydantic import BaseModel


class ScrapeRunResponse(BaseModel):
    fetched: int
    created: int
    updated: int

