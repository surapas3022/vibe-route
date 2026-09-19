from functools import lru_cache

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(_ROOT / ".env", Path(".env"), Path("../.env")),
        extra="ignore",
    )

    gemini_api_key: str = ""
    gemini_api_keys: str = ""
    nvidia_api_key: str = ""
    supabase_url: str = ""
    supabase_secret_key: str = ""
    supabase_publishable_key: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    cors_origins: str = (
        "http://localhost:5173,http://127.0.0.1:5173,"
        "http://localhost:8080,http://127.0.0.1:8080,"
        "http://localhost:5500,http://127.0.0.1:5500,"
        "http://localhost,http://127.0.0.1,"
        "https://vibe-route-ten.vercel.app"
    )
    poc_region: str = "ภาคเหนือ"
    data_path: str = "data/attraction.json"
    port: int = 8000
    gemini_embed_model: str = "gemini-embedding-001"
    nvidia_embed_model: str = "nvidia/nemotron-3-embed-1b"
    embed_dims_gemini: int = 768
    embed_dims_nvidia: int = 2048
    retrieve_k: int = 12
    result_k: int = 6
    storage_bucket: str = "place-images"
    admin_emails: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        return [part.strip() for part in self.cors_origins.split(",") if part.strip()]

    @property
    def gemini_key_list(self) -> list[str]:
        return split_keys(self.gemini_api_key, self.gemini_api_keys)

    @property
    def nvidia_key_list(self) -> list[str]:
        return split_keys(self.nvidia_api_key)

    @property
    def supabase_key(self) -> str:
        return (
            self.supabase_secret_key
            or self.supabase_service_role_key
        )


def split_keys(*blobs: str) -> list[str]:
    keys: list[str] = []
    seen: set[str] = set()
    for blob in blobs:
        for part in blob.replace("\n", ",").split(","):
            key = part.strip()
            if key and key not in seen:
                seen.add(key)
                keys.append(key)
    return keys


@lru_cache
def get_settings() -> Settings:
    return Settings()
