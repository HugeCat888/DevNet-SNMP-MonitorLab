from sqlalchemy import Column, Integer, String, Boolean, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from database import Base
import datetime

class Device(Base):
    __tablename__ = "devices"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    ip = Column(String, unique=True, index=True)
    snmp_version = Column(String, default="v2c")
    community_read = Column(String, default="public")
    community_write = Column(String, nullable=True)
    
    # v3 fields
    v3_username = Column(String, nullable=True)
    v3_sec_level = Column(String, nullable=True)
    v3_auth_proto = Column(String, nullable=True)
    v3_auth_pass = Column(String, nullable=True)
    v3_priv_proto = Column(String, nullable=True)
    v3_priv_pass = Column(String, nullable=True)
    
    status = Column(String, default="UNKNOWN")
    snmp_status = Column(String, default="UNKNOWN")
    uptime = Column(String, nullable=True)
    sys_object_id = Column(String, nullable=True)
    sys_object_id_resolved = Column(String, nullable=True)
    sys_descr = Column(String, nullable=True)

    interfaces = relationship("Interface", back_populates="device")

class Interface(Base):
    __tablename__ = "interfaces"
    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id"))
    if_index = Column(Integer)
    name = Column(String)
    description = Column(String, nullable=True)
    type = Column(String, nullable=True)
    admin_status = Column(String)
    oper_status = Column(String)
    speed_bps = Column(Integer, nullable=True)
    mac_address = Column(String, nullable=True)

    device = relationship("Device", back_populates="interfaces")
    traffic = relationship("TrafficSample", back_populates="interface")

class TrafficSample(Base):
    __tablename__ = "traffic_samples"
    id = Column(Integer, primary_key=True, index=True)
    interface_id = Column(Integer, ForeignKey("interfaces.id"))
    timestamp = Column(DateTime, default=datetime.datetime.now)
    in_octets = Column(Integer)
    out_octets = Column(Integer)
    in_rate_bps = Column(Float, default=0.0)
    out_rate_bps = Column(Float, default=0.0)

    interface = relationship("Interface", back_populates="traffic")

class Event(Base):
    __tablename__ = "events"
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.datetime.now)
    device_ip = Column(String)
    event_type = Column(String)
    if_index = Column(Integer, nullable=True)
    raw_oid = Column(String)
    details = Column(String, nullable=True)
