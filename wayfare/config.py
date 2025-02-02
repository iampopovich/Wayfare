from functools import lru_cache
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # API Keys
    OPENAI_API_KEY: str
    GOOGLE_MAPS_API_KEY: str
    
    # OpenAI Configuration
    OPENAI_MODEL_NAME: str = "gpt-3.5-turbo"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

@lru_cache()
def get_settings() -> Settings:
    return Settings()
