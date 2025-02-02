from typing import List
from pydantic_settings import BaseSettings
from pydantic import AnyHttpUrl, validator


class Settings(BaseSettings):
    # API Configuration
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    ALLOWED_ORIGINS: List[str] = ["*"]

    # OpenAI Configuration
    OPENAI_API_KEY: str
    OPENAI_MODEL_NAME: str = "gpt-3.5-turbo"

    # Maps API Keys
    GOOGLE_MAPS_API_KEY: str
    MAPSME_API_KEY: str

    # Travel API Keys
    BOOKING_API_KEY: str
    TRIP_API_KEY: str
    AIRBNB_API_KEY: str

    # Optional Redis Configuration
    REDIS_URL: str = "redis://localhost:6379/0"

    # Environment name
    ENVIRONMENT: str = "development"

    @validator("ALLOWED_ORIGINS", pre=True)
    def assemble_cors_origins(cls, v: str | List[str]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)

    class Config:
        case_sensitive = True
        env_file = ".env"


settings = Settings()
