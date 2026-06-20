import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, JSON, DateTime, Enum as SAEnum, Boolean, Text, ForeignKey
from database import Base


class JobStatus(enum.Enum):
    WAITING = "Waiting"
    GENERATING_SCRIPT = "Generating Script"
    GENERATING_METADATA = "Generating Metadata"
    GENERATING_SCENES = "Generating Scenes"
    GENERATING_IMAGES = "Generating Images"
    GENERATING_VOICE = "Generating Voice"
    GENERATING_SUBTITLES = "Generating Subtitles"
    GENERATING_THUMBNAIL = "Generating Thumbnail"
    EDITING_VIDEO = "Editing Video"
    RENDERING = "Rendering"
    GENERATING_SHORTS = "Generating Shorts"
    UPLOADING = "Uploading"
    COMPLETED = "Completed"
    FAILED = "Failed"
    RETRYING = "Retrying"
    CANCELLED = "Cancelled"
    ARCHIVED = "Archived"

    @classmethod
    def from_string(cls, s: str):
        for member in cls:
            if member.value == s or member.name == s:
                return member
        return cls.WAITING


class PluginType(enum.Enum):
    LLM = "llm"
    IMAGE = "image"
    VOICE = "voice"
    VIDEO = "video"
    UPLOAD = "upload"


class LogLevel(enum.Enum):
    INFO = "INFO"
    WARN = "WARN"
    ERROR = "ERROR"
    DEBUG = "DEBUG"


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    topic = Column(String, index=True, nullable=False)
    summary = Column(Text, default="")
    language = Column(String, default="auto")
    target_audience = Column(String, default="general")
    duration = Column(String, default="medium")
    voice_style = Column(String, default="neutral")
    story_style = Column(String, default="narrative")

    status = Column(SAEnum(JobStatus), default=JobStatus.WAITING)
    progress = Column(Integer, default=0)
    project_dir = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    metadata_json = Column(JSON, nullable=True)
    logs = Column(JSON, nullable=True, default=list)
    video_path = Column(String, nullable=True)
    short_path = Column(String, nullable=True)
    thumbnail_path = Column(String, nullable=True)
    scheduled_at = Column(DateTime, nullable=True)
    voice_over_path = Column(String, nullable=True)
    subtitle_paths_json = Column(JSON, nullable=True)

    checkpoint = Column(String, nullable=True)


class Setting(Base):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, index=True, nullable=False)
    value = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Plugin(Base):
    __tablename__ = "plugins"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    type = Column(SAEnum(PluginType), nullable=False)
    enabled = Column(Boolean, default=True)
    config = Column(JSON, default=dict)
    priority = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


class UploadLog(Base):
    __tablename__ = "upload_logs"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="SET NULL"), nullable=True)
    platform = Column(String, default="youtube")
    video_id = Column(String, nullable=True)
    video_url = Column(String, nullable=True)
    status = Column(String, default="pending")
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    response_json = Column(JSON, nullable=True)


class Schedule(Base):
    __tablename__ = "schedules"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    topic = Column(String, nullable=False)
    summary = Column(Text, default="")
    language = Column(String, default="auto")
    target_audience = Column(String, default="general")
    duration = Column(String, default="medium")
    voice_style = Column(String, default="neutral")
    story_style = Column(String, default="narrative")
    cron_expression = Column(String, nullable=False)
    enabled = Column(Boolean, default=True)
    next_run = Column(DateTime, nullable=True)
    last_run = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Log(Base):
    __tablename__ = "logs"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True)
    level = Column(SAEnum(LogLevel), default=LogLevel.INFO)
    source = Column(String, default="system")
    message = Column(Text, nullable=False)
    details = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
