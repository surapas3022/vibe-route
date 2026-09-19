from pydantic_settings import SettingsConfigDict

from app.config import Settings


class IsolatedSettings(Settings):
    model_config = SettingsConfigDict(env_file=None, extra="ignore")

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls,
        init_settings,
        env_settings,
        dotenv_settings,
        file_secret_settings,
    ):
        return (init_settings,)


def test_prefers_new_secret_key():
    settings = IsolatedSettings(
        supabase_secret_key="sb_secret_new",
        supabase_service_role_key="legacy_jwt",
    )
    assert settings.supabase_key == "sb_secret_new"


def test_falls_back_to_legacy_service_role():
    settings = IsolatedSettings(supabase_service_role_key="legacy_jwt")
    assert settings.supabase_key == "legacy_jwt"


def test_does_not_use_publishable_key():
    settings = IsolatedSettings(supabase_publishable_key="sb_publishable_public")
    assert settings.supabase_key == ""


def test_splits_multiple_gemini_keys():
    settings = IsolatedSettings(
        gemini_api_key="aaa, bbb",
        gemini_api_keys="bbb,ccc",
    )
    assert settings.gemini_key_list == ["aaa", "bbb", "ccc"]


def test_splits_nvidia_keys():
    settings = IsolatedSettings(nvidia_api_key="nv1, nv2")
    assert settings.nvidia_key_list == ["nv1", "nv2"]
    assert settings.embed_dims_nvidia == 2048
    assert settings.embed_dims_gemini == 768
