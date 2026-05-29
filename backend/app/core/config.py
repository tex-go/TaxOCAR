from pydantic_settings import BaseSettings
from typing import List
import json


class Settings(BaseSettings):
    DATABASE_URL: str
    REDIS_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    MINIO_ENDPOINT: str
    MINIO_ACCESS_KEY: str
    MINIO_SECRET_KEY: str
    MINIO_BUCKET: str = "taxocr-invoices"
    MINIO_SECURE: bool = False
    # Public URL used in presigned links sent to the browser.
    # Must be reachable from the user's machine (not the internal Docker hostname).
    MINIO_PUBLIC_URL: str = "http://localhost:9000"

    CORS_ORIGINS: str = '["http://localhost:3000"]'
    ENVIRONMENT: str = "development"

    def get_cors_origins(self) -> List[str]:
        return json.loads(self.CORS_ORIGINS)

    class Config:
        env_file = ".env"


settings = Settings()
