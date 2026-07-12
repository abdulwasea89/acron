"""Application configuration.

Settings are loaded from environment variables (and an optional .env file) via
pydantic-settings. Every external integration degrades to a deterministic local
"stub" mode when its credentials are absent, so the backend runs end-to-end with
zero external accounts. Provide real keys to activate real calls.
"""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

import os 

from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # ------------------------------------------------------------------ app
    app_env: str = "development"
    app_name: str = "Gym Operations Platform"
    api_v1_prefix: str = "/api/v1"
    debug: bool = True

    # --------------------------------------------------------------- security
    secret_key: str = "dev-insecure-change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7
    remember_device_days: int = 30
    email_code_expire_minutes: int = 10
    magic_link_expire_minutes: int = 15
    password_reset_expire_minutes: int = 60

    max_login_attempts: int = 10
    login_lockout_minutes: int = 30
    failed_login_window_minutes: int = 15

    # --------------------------------------------------------------- database
    # Defaults to a local async SQLite file so the app runs with no services.
    # In production set DATABASE_URL to a postgresql+asyncpg URL.
    # database_url: str = "sqlite+aiosqlite:///./gym_platform.db"
    database_url: str = os.getenv("DATABASE_URL") or "sqlite+aiosqlite:///./gym_platform.db"
    db_echo: bool = False

    # ------------------------------------------------------------------ redis
    redis_url: str = "redis://localhost:6379/0"

    # ----------------------------------------------------------------- stripe
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_connect_webhook_secret: str = ""
    stripe_connect_client_id: str = ""

    # ------------------------------------------------------ email / push / ai
    email_from: str = "no-reply@example.com"
    smtp_url: str = ""
    # SMTP (e.g. Gmail): sends real mail to any recipient without a verified
    # sending domain. Set these to enable; takes precedence over Resend.
    smtp_host: str = os.getenv("SMTP_HOST", "")
    smtp_port: int = int(os.getenv("SMTP_PORT", "587"))
    smtp_user: str = os.getenv("SMTP_USER", "")
    smtp_password: str = os.getenv("SMTP_PASSWORD", "")
    smtp_from: str = os.getenv("SMTP_FROM", "")
    smtp_use_tls: bool = os.getenv("SMTP_USE_TLS", "1") != "0"
    resend_api_key: str | None = os.getenv("RESEND_API_KEY")
    expo_push_url: str = "https://exp.host/--/api/v2/push/send"
    ocr_provider_api_key: str = ""
    openai_api_key: str = ""

    # ------------------------------------------------------------------- hibp
    hibp_api_url: str = "https://api.pwnedpasswords.com"
    hibp_enabled: bool = True

    # -------------------------------------------------------- business limits
    signup_max_per_ip_per_hour: int = 3
    signup_max_per_email_per_day: int = 2
    signup_max_per_org_code_per_day: int = 50
    email_resend_max_per_hour: int = 3

    receipt_auto_approve_threshold: int = 95
    receipt_review_threshold: int = 70
    receipt_spot_audit_rate: float = 0.05

    idempotency_stuck_seconds: int = 30

    tier_starter_cap: int = 25
    tier_pro_cap: int = 100

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")

    @property
    def stripe_live(self) -> bool:
        """True when a real Stripe key is configured (else stub mode)."""
        return bool(self.stripe_secret_key) and self.stripe_secret_key != "sk_test_xxx"

    @property
    def smtp_active(self) -> bool:
        """True when SMTP creds are configured (real delivery to any recipient)."""
        return bool(self.smtp_host and self.smtp_user and self.smtp_password)

    @property
    def smtp_sender(self) -> str:
        """From address for SMTP: explicit smtp_from, else the SMTP username."""
        return self.smtp_from or self.smtp_user

    @property
    def email_active(self) -> bool:
        """True when any real email provider (SMTP or Resend) is configured."""
        return self.smtp_active or bool(self.resend_api_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
