# models.py
from sqlmodel import Field, SQLModel, Relationship
from typing import List, Optional
from datetime import datetime


class AssetItem(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    ctrl_no: str
    pn_1: str
    pn_2: Optional[str] = None
    name: Optional[str] = None
    description_1: Optional[str] = None
    description_2: Optional[str] = None
    use_for: Optional[str] = None
    location: Optional[str] = None
    first_in_date: Optional[str] = None
    remarks: Optional[str] = None
    has_image: bool = Field(default=False)
    is_stock: bool = Field(default=False)
    po_type: Optional[str] = None
    model: Optional[str] = None
    is_stop: bool = Field(default=False)
    is_no_use: bool = Field(default=False)

class AssetLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    date: str = Field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d"))
    ctrl_no: str
    pn_1: str
    pn_2: Optional[str] = None
    name: Optional[str] = None
    status: bool = Field(default=False)
    target_loc: str
    note: str

class AssetAuditRecord(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    asset_id: int
    ctrl_no: str
    pn_1: str
    pn_2: Optional[str] = None
    name: Optional[str] = None
    expected_location: Optional[str] = None
    actual_location: Optional[str] = None
    status: str = Field(default='Pending')
    scanned_at: Optional[str] = None
    scanned_by: Optional[str] = None

class AssetScrapRecord(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    ctrl_no: str
    pn_1: str
    pn_2: Optional[str] = None
    name: Optional[str] = None
    location: Optional[str] = None
    is_no_use: bool = Field(default=False)
    po_type: Optional[str] = None
    model: Optional[str] = None
    description_1: Optional[str] = None
    remarks: Optional[str] = None

class InventoryItem(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    pn_1: str
    pn_2: Optional[str] = None
    name: Optional[str] = None
    description_1: Optional[str] = None
    description_2: Optional[str] = None
    total_in: Optional[int] = None
    total_out: Optional[int] = None
    stock: Optional[int] = None
    warning_level: Optional[int] = 0
    location: Optional[str] = None
    first_in_date: Optional[str] = None
    remarks: Optional[str] = None
    usage_1y: Optional[int] = Field(default=0)
    usage_2y: Optional[int] = Field(default=0)
    usage_3y: Optional[int] = Field(default=0)
    has_image: bool = Field(default=False)
    is_mva: bool = Field(default=False)

class HistoryLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    date: str = Field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d"))
    pn_1: str
    pn_2: Optional[str] = None
    change_qty: int
    applicant: str
    department: str
    note: str

class AuditRecord(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    item_id: int
    pn_1: str
    pn_2: Optional[str] = None
    name: Optional[str] = None
    expected_stock: int
    expected_location: Optional[str] = None
    actual_stock: Optional[int] = None
    actual_location: Optional[str] = None
    status: str = "Pending"
    remarks: Optional[str] = None

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(unique=True)
    password_hash: str
    full_name: str
    role: str

class UserBookmark(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    username: str = Field(index=True)
    item_id: int = Field(index=True)

class OutboundRequest(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    item_id: int
    pn_1: str
    pn_2: Optional[str] = None
    item_name: Optional[str] = None
    req_qty: int
    applicant: str
    applicant_username: str
    department: str
    note: Optional[str] = None
    status: str = Field(default='Pending')
    created_at: str = Field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d %H:%M:%S"))

class AssetRequest(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    ctrl_no: Optional[str] = None
    pn_1: Optional[str] = None
    pn_2: Optional[str] = None
    asset_name: Optional[str] = None
    matter: str
    req_qty: Optional[int] = 0
    applicant: str
    applicant_username: str
    department: str
    note: Optional[str] = None
    status: str = Field(default='Pending')
    created_at: str = Field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d %H:%M:%S"))

class ChatMessage(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    sender: str
    sender_full_name: str
    role: str
    message: str
    timestamp: str = Field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d %H:%M:%S"))

class ModelTable(SQLModel, table=True):
    __tablename__ = "model_table"
    id: Optional[int] = Field(default=None, primary_key=True)
    code: str
    model_name: str

    productions: List['MonthlyProduction'] = Relationship(back_populates="model")

class MonthlyProduction(SQLModel, table=True):
    __tablename__ = "monthly_production"
    id: Optional[int] = Field(default=None, primary_key=True)
    model_id: int = Field(foreign_key='model_table.id', index=True)
    year_month: str = Field(index=True)
    quantity: int = Field(default=0)
    last_updated: datetime = Field(default_factory=datetime.now)

    model: Optional[ModelTable] = Relationship(back_populates="productions")

class PhysicalSimCard(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    icc_id: str
    carrier: Optional[str] = None
    phone_number: str
    is_active: bool = Field(default=False)
    is_stock: bool = Field(default=False)
    location: Optional[str] = None
    direct_user: Optional[str] = None
    project: Optional[str] = None
    note: Optional[str] = None

class PhysicalSimCardLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    date: str = Field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d"))
    icc_id: str
    phone_number: str
    target_loc: Optional[str] = None
    target_user: Optional[str] = None
    target_project: Optional[str] = None
    action: str

