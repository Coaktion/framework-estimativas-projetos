from typing import Optional, List
from sqlmodel import SQLModel, Field, create_engine, Session, select
from datetime import datetime
import json

# Enums (using strings for simplicity in SQLite)
class UserRole:
    SC = "SC" # Super Admin
    DEV = "DEV" # Admin Dev
    CONSULTING = "CONSULTING" # Admin Consultoria
    USER = "USER" # AE, PM, Gestores (Default)

class FrameworkType:
    SC_AE = "SC_AE"
    DEV = "DEV"
    CONSULTING = "CONSULTING"

class ProjectStatus:
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    ARCHIVED = "ARCHIVED"

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(unique=True, index=True)
    name: Optional[str] = None
    picture: Optional[str] = None
    role: str = Field(default=UserRole.USER)
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Package(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    hours: float
    scope_included: str = Field(default="")
    scope_excluded: str = Field(default="")
    category: Optional[str] = None # e.g., Support, Knowledge, etc.
    skill: str = Field(default="Implantação") # Implantação, GP, Solution Design, Desenvolvimento, Design
    link: Optional[str] = Field(default=None) # Link for Marketplace apps or documentation
    is_active: bool = Field(default=True) # Soft delete
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Variable(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    key: str = Field(unique=True, index=True)
    value: str
    category: Optional[str] = None
    is_active: bool = Field(default=True) # Soft delete
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class FrameworkVersion(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    version_name: str
    type: str = Field(default=FrameworkType.SC_AE) # SC_AE, DEV, CONSULTING
    data: str # JSON string of all active packages and variables at this time
    created_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: Optional[int] = Field(default=None, foreign_key="user.id")

class Project(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    owner_id: int = Field(foreign_key="user.id")
    status: str = Field(default=ProjectStatus.DRAFT)
    is_private: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class ProjectVersion(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id")
    version_name: str
    data: str # JSON string of the estimate (areas, items, totals)
    technical_scope_link: Optional[str] = None
    
    # Overrides and percentages
    gp_percent: float = Field(default=25.0)
    discovery_percent: float = Field(default=0.0)
    validation_percent: float = Field(default=0.0)
    
    gp_override: Optional[float] = None
    discovery_override: Optional[float] = None
    validation_override: Optional[float] = None
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: Optional[int] = Field(default=None, foreign_key="user.id")

# Old models kept for migration/compatibility if needed, or we can drop them
# SaveState and Spreadsheet might be obsolete or repurposed. 
# Keeping Spreadsheet for now as requested "Salvar planilhas dentro do sistema" might still apply to simple CSVs.
class Spreadsheet(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    content: str # CSV/XLSX content or path
    project_id: Optional[int] = Field(default=None, foreign_key="project.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)

sqlite_file_name = "database.db"
sqlite_url = f"sqlite:///{sqlite_file_name}"
engine = create_engine(sqlite_url, echo=False) # Turn off echo for cleaner logs

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)
