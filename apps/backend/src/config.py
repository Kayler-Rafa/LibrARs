from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    JWT_SECRET: str = "dev-secret-change-me-in-production"
    CORS_ORIGIN: str = "http://localhost:5173"
    PORT: int = 3001

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
