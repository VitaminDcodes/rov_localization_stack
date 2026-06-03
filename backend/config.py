from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings."""
    
    # FastAPI
    app_name: str = "ROV Localization Stack"
    debug: bool = True
    
    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    
    # WebSocket
    ws_url: str = "ws://localhost:8000/ws"
    
    # ROS2 (optional for future integration)
    ros_domain_id: Optional[int] = None
    localization_topic: str = "/localization/pose"
    
    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
