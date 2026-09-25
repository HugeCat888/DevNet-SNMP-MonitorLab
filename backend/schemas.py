from pydantic import BaseModel, ConfigDict
from typing import List, Optional

class DeviceBase(BaseModel):
    name: str
    ip: str
    snmp_version: str = "v2c"
    community_read: Optional[str] = "public"
    community_write: Optional[str] = None
    v3_username: Optional[str] = None
    v3_sec_level: Optional[str] = None
    v3_auth_proto: Optional[str] = None
    v3_auth_pass: Optional[str] = None
    v3_priv_proto: Optional[str] = None
    v3_priv_pass: Optional[str] = None
    cli_username: Optional[str] = None
    cli_password: Optional[str] = None
    cli_protocol: Optional[str] = None

class DeviceCreate(DeviceBase):
    pass

class DeviceUpdate(BaseModel):
    name: Optional[str] = None
    ip: Optional[str] = None
    snmp_version: Optional[str] = None
    community_read: Optional[str] = None
    community_write: Optional[str] = None
    cli_username: Optional[str] = None
    cli_password: Optional[str] = None
    cli_protocol: Optional[str] = None

class Device(DeviceBase):
    id: int
    status: str
    snmp_status: str
    uptime: Optional[str] = None
    sys_object_id: Optional[str] = None
    sys_object_id_resolved: Optional[str] = None
    sys_descr: Optional[str] = None
    sys_name: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)

class InterfaceBase(BaseModel):
    if_index: int
    name: str
    description: Optional[str] = None
    type: Optional[str] = None
    admin_status: str
    oper_status: str
    speed_bps: Optional[int] = None
    mac_address: Optional[str] = None
    ip_address: Optional[str] = None

class Interface(InterfaceBase):
    id: int
    device_id: int
    
    model_config = ConfigDict(from_attributes=True)

class TrafficPoint(BaseModel):
    time: str
    in_mbps: float
    out_mbps: float
    in_octets: int
    out_octets: int

class EventBase(BaseModel):
    device_ip: str
    event_type: str
    if_index: Optional[int] = None
    raw_oid: str
    details: Optional[str] = None

class Event(EventBase):
    id: int
    timestamp: str

    model_config = ConfigDict(from_attributes=True)
