from __future__ import annotations
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field, ConfigDict, ValidationError
from typing import Any, Dict, List, Literal, Optional

Category = Literal["ops", "asset", "program"]

class SpendState(BaseModel):
    model_config = ConfigDict(extra="forbid")
    amount: Optional[float] = None
    category: Optional[Category] = None
    flags: List[str] = []
    requester: Optional[str] = None
    approver: Optional[str] = None
    required_steps: List[str] = []

class DelegationState(BaseModel):
    model_config = ConfigDict(extra="forbid")
    people: List[str] = []
    roles: List[str] = []
    assignments: Dict[str, Optional[str]] = {}
    acting: List[Dict[str, Any]] = []

class Violation(BaseModel):
    model_config = ConfigDict(extra="forbid")
    code: str
    message: str
    path: Optional[str] = None

class Citation(BaseModel):
    model_config = ConfigDict(extra="forbid")
    key: str
    href: Optional[str] = None
    snippet: Optional[str] = None

class Meta(BaseModel):
    model_config = ConfigDict(extra="allow")
    docName: str
    server_timestamp: Optional[float] = None

class AppState(BaseModel):
    model_config = ConfigDict(extra="forbid")
    meta: Meta
    panels: List[str]
    spend: SpendState
    delegation: DelegationState
    violations: List[Violation]
    citations: List[Citation]

class PanelConfigs(BaseModel):
    model_config = ConfigDict(extra="allow")

class AppState(BaseModel):
    model_config = ConfigDict(extra="forbid")
    meta: Meta
    panels: List[str]
    panel_configs: Dict[str, Any] = {}     
    spend: SpendState
    delegation: DelegationState
    violations: List[Violation]
    citations: List[Citation]