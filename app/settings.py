from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    fred_api_key: str | None = None
    timezone: str = "America/New_York"
    
    # LLM config
    llm_provider: str | None = None  # e.g., "openai", "anthropic", "mock"
    llm_api_key: str | None = None
    llm_model: str | None = None
    openrouter_api_key: str | None = None
    llm_base_url: str | None = None
    
    # Cache config
    cache_disabled: bool = False  # set CACHE_DISABLED=true to disable
    cache_ttl_seconds: int = 3600  # 1 hour default
    cache_dir: str = "./cache"  # directory for CSV cache files
    
    # CORS (comma-separated list of allowed origins)
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    class Config:
        env_file = ".env"
        env_prefix = ""


settings = Settings()
