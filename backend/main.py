from fastapi import FastAPI, Depends, HTTPException, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import models
import schemas
from database import engine, get_db
import snmp_core
import asyncio
import datetime
from database import engine, get_db, SessionLocal

models.Base.metadata.create_all(bind=engine)

async def background_traffic_poller():
    """Constantly polls traffic for all active interfaces every 10 seconds in the background."""
    while True:
        try:
            db = SessionLocal()
            devices = db.query(models.Device).filter(models.Device.status == "ONLINE").all()
            for device in devices:
                # Only poll interfaces that are 'up' to save SNMP requests
                interfaces = db.query(models.Interface).filter(
                    models.Interface.device_id == device.id, 
                    models.Interface.oper_status == 'up'
                ).all()
                
                for interface in interfaces:
                    try:
                        result = await snmp_core.get_interface_traffic(device.ip, interface.if_index, device.community_read)
                        if "error" in result:
                            continue
                        
                        now = datetime.datetime.now()
                        in_octets = result["in_octets"]
                        out_octets = result["out_octets"]
                        
                        in_rate_bps = 0.0
                        out_rate_bps = 0.0
                        prev_sample = db.query(models.TrafficSample).filter(
                            models.TrafficSample.interface_id == interface.id
                        ).order_by(models.TrafficSample.timestamp.desc()).first()
                        
                        if prev_sample:
                            elapsed = (now - prev_sample.timestamp).total_seconds()
                            if elapsed > 0:
                                delta_in = in_octets - prev_sample.in_octets
                                delta_out = out_octets - prev_sample.out_octets
                                if delta_in < 0: delta_in += 2**32
                                if delta_out < 0: delta_out += 2**32
                                in_rate_bps = (delta_in * 8) / elapsed
                                out_rate_bps = (delta_out * 8) / elapsed
                        
                        sample = models.TrafficSample(
                            interface_id=interface.id,
                            timestamp=now,
                            in_octets=in_octets,
                            out_octets=out_octets,
                            in_rate_bps=in_rate_bps,
                            out_rate_bps=out_rate_bps
                        )
                        db.add(sample)
                    except Exception as e:
                        print(f"Error polling traffic for {device.ip} ifIndex {interface.if_index}: {e}")
            db.commit()
            db.close()
        except Exception as e:
            print("Background poller error:", e)
        
        await asyncio.sleep(10)

app = FastAPI(title="SNMP Network Monitor API")

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(background_traffic_poller())

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"message": "SNMP Network Monitor API is running"}

@app.post("/devices/", response_model=schemas.Device)
def create_device(device: schemas.DeviceCreate, db: Session = Depends(get_db)):
    db_device = db.query(models.Device).filter(models.Device.ip == device.ip).first()
    if db_device:
        raise HTTPException(status_code=400, detail="Device with this IP already exists")
    
    db_device = models.Device(**device.model_dump())
    db.add(db_device)
    db.commit()
    db.refresh(db_device)
    return db_device

@app.get("/devices/", response_model=list[schemas.Device])
def read_devices(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    devices = db.query(models.Device).offset(skip).limit(limit).all()
    return devices

@app.get("/devices/{device_id}", response_model=schemas.Device)
def read_device(device_id: int, db: Session = Depends(get_db)):
    device = db.query(models.Device).filter(models.Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    return device

@app.delete("/devices/{device_id}")
def delete_device(device_id: int, db: Session = Depends(get_db)):
    device = db.query(models.Device).filter(models.Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    # Delete associated traffic samples first (FK constraint), then interfaces
    iface_ids = [i.id for i in db.query(models.Interface).filter(models.Interface.device_id == device_id).all()]
    if iface_ids:
        db.query(models.TrafficSample).filter(models.TrafficSample.interface_id.in_(iface_ids)).delete(synchronize_session=False)
    db.query(models.Interface).filter(models.Interface.device_id == device_id).delete(synchronize_session=False)
    db.delete(device)
    db.commit()
    return {"message": "Device deleted successfully"}

@app.post("/devices/{device_id}/check")
async def check_device(device_id: int, db: Session = Depends(get_db)):
    device = db.query(models.Device).filter(models.Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    result = await snmp_core.get_sys_info(device.ip, device.community_read)
    
    if "error" in result:
        device.snmp_status = "FAIL"
        device.status = "OFFLINE"
    else:
        device.snmp_status = "OK"
        device.status = "ONLINE"
        device.uptime = result.get("sysUpTime")
        device.sys_object_id = result.get("sysObjectID")
        device.sys_object_id_resolved = result.get("sysObjectIDResolved")
        device.sys_descr = result.get("sysDescr")
        
        # Auto-discover interfaces
        discovery_count = 0
        try:
            discovered_interfaces = await snmp_core.walk_interfaces(device.ip, device.community_read)
            discovered_indexes = set()
            
            for iface_data in discovered_interfaces:
                if_index = iface_data['if_index']
                discovered_indexes.add(if_index)
                
                # Check if interface already exists
                existing_iface = db.query(models.Interface).filter(
                    models.Interface.device_id == device.id,
                    models.Interface.if_index == if_index
                ).first()
                
                if existing_iface:
                    # Update existing interface with latest SNMP data
                    existing_iface.name = iface_data.get('name', existing_iface.name)
                    existing_iface.description = iface_data.get('description', existing_iface.description)
                    existing_iface.mac_address = iface_data.get('mac_address', existing_iface.mac_address)
                    existing_iface.speed_bps = iface_data.get('speed_bps', existing_iface.speed_bps)
                    existing_iface.admin_status = iface_data.get('admin_status', existing_iface.admin_status)
                    existing_iface.oper_status = iface_data.get('oper_status', existing_iface.oper_status)
                    existing_iface.type = iface_data.get('type', existing_iface.type)
                else:
                    # Create new interface — only pass fields that exist in the model
                    new_iface = models.Interface(
                        device_id=device.id,
                        if_index=iface_data['if_index'],
                        name=iface_data.get('name', f'Interface {if_index}'),
                        description=iface_data.get('description', ''),
                        mac_address=iface_data.get('mac_address', ''),
                        speed_bps=iface_data.get('speed_bps', 0),
                        admin_status=iface_data.get('admin_status', 'unknown'),
                        oper_status=iface_data.get('oper_status', 'unknown'),
                        type=iface_data.get('type', 'other'),
                    )
                    db.add(new_iface)
                    discovery_count += 1
            
            # Remove stale interfaces that no longer exist on the device
            if discovered_indexes:
                stale_interfaces = db.query(models.Interface).filter(
                    models.Interface.device_id == device.id,
                    ~models.Interface.if_index.in_(discovered_indexes)
                ).all()
                for stale_iface in stale_interfaces:
                    # Delete associated traffic samples first
                    db.query(models.TrafficSample).filter(
                        models.TrafficSample.interface_id == stale_iface.id
                    ).delete(synchronize_session=False)
                    db.delete(stale_iface)
                    
        except Exception as e:
            print("Auto-discovery failed:", e)
            import traceback
            traceback.print_exc()

    db.commit()
    db.refresh(device)
    
    # Return device info with interface count
    iface_count = db.query(models.Interface).filter(models.Interface.device_id == device.id).count()
    return {
        **schemas.Device.model_validate(device).model_dump(),
        "interfaces_count": iface_count,
        "new_interfaces_discovered": discovery_count
    }

@app.get("/interfaces/{device_id}", response_model=list[schemas.Interface])
def read_interfaces(device_id: int, db: Session = Depends(get_db)):
    device = db.query(models.Device).filter(models.Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    # Return from DB for now
    interfaces = db.query(models.Interface).filter(models.Interface.device_id == device_id).all()
    return interfaces

@app.post("/interfaces/{device_id}/{if_index}/admin-status")
async def set_admin_status(device_id: int, if_index: int, status: str, db: Session = Depends(get_db)):
    device = db.query(models.Device).filter(models.Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    if not device.community_write:
        raise HTTPException(status_code=400, detail="Write community not configured for this device")

    result = await snmp_core.set_interface_admin_status(device.ip, device.community_write, if_index, status)
    if "error" in result:
         raise HTTPException(status_code=500, detail=result["error"])
    
    # Update local DB
    interface = db.query(models.Interface).filter(models.Interface.device_id == device_id, models.Interface.if_index == if_index).first()
    if interface:
        interface.admin_status = status.lower()
        db.commit()

    return result


@app.post("/traffic/{device_id}/{if_index}/poll")
async def poll_traffic(device_id: int, if_index: int, db: Session = Depends(get_db)):
    """Poll SNMP ifInOctets/ifOutOctets for a specific interface and calculate rate."""
    device = db.query(models.Device).filter(models.Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    interface = db.query(models.Interface).filter(
        models.Interface.device_id == device_id,
        models.Interface.if_index == if_index
    ).first()
    if not interface:
        raise HTTPException(status_code=404, detail="Interface not found")
    
    result = await snmp_core.get_interface_traffic(device.ip, if_index, device.community_read)
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    
    now = datetime.datetime.now()
    in_octets = result["in_octets"]
    out_octets = result["out_octets"]
    
    # Calculate rate from previous sample
    in_rate_bps = 0.0
    out_rate_bps = 0.0
    prev_sample = db.query(models.TrafficSample).filter(
        models.TrafficSample.interface_id == interface.id
    ).order_by(models.TrafficSample.timestamp.desc()).first()
    
    if prev_sample:
        elapsed = (now - prev_sample.timestamp).total_seconds()
        if elapsed > 0:
            # Calculate bits per second: (delta_octets * 8) / elapsed_seconds
            delta_in = in_octets - prev_sample.in_octets
            delta_out = out_octets - prev_sample.out_octets
            # Handle counter wrap (32-bit counter)
            if delta_in < 0:
                delta_in += 2**32
            if delta_out < 0:
                delta_out += 2**32
            in_rate_bps = (delta_in * 8) / elapsed
            out_rate_bps = (delta_out * 8) / elapsed
    
    sample = models.TrafficSample(
        interface_id=interface.id,
        timestamp=now,
        in_octets=in_octets,
        out_octets=out_octets,
        in_rate_bps=in_rate_bps,
        out_rate_bps=out_rate_bps
    )
    db.add(sample)
    db.commit()
    
    return {
        "time": now.strftime("%H:%M:%S"),
        "in_octets": in_octets,
        "out_octets": out_octets,
        "in_mbps": round(in_rate_bps / 1_000_000, 4),
        "out_mbps": round(out_rate_bps / 1_000_000, 4)
    }


@app.get("/traffic/{device_id}/{if_index}/history")
def get_traffic_history(device_id: int, if_index: int, date: str = None, limit: int = 8640, db: Session = Depends(get_db)):
    """Get traffic history for graphing, filtered by date."""
    interface = db.query(models.Interface).filter(
        models.Interface.device_id == device_id,
        models.Interface.if_index == if_index
    ).first()
    if not interface:
        raise HTTPException(status_code=404, detail="Interface not found")
    
    query = db.query(models.TrafficSample).filter(
        models.TrafficSample.interface_id == interface.id
    )
    
    if date:
        try:
            target_date = datetime.datetime.strptime(date, "%Y-%m-%d").date()
            query = query.filter(
                models.TrafficSample.timestamp >= datetime.datetime.combine(target_date, datetime.time.min),
                models.TrafficSample.timestamp <= datetime.datetime.combine(target_date, datetime.time.max)
            )
        except ValueError:
            pass
            
    samples = query.order_by(models.TrafficSample.timestamp.desc()).limit(limit).all()
    
    # Reverse so oldest is first (for chart display)
    samples.reverse()
    
    return [
        {
            "time": s.timestamp.strftime("%H:%M:%S"),
            "in_mbps": round(s.in_rate_bps / 1_000_000, 4) if s.in_rate_bps else 0,
            "out_mbps": round(s.out_rate_bps / 1_000_000, 4) if s.out_rate_bps else 0,
            "in_octets": s.in_octets,
            "out_octets": s.out_octets
        }
        for s in samples
    ]

@app.get("/topology")
async def get_topology(db: Session = Depends(get_db)):
    """Discover network topology using CDP across all devices."""
    devices = db.query(models.Device).all()
    
    nodes = []
    edges = []
    
    # Track created edges to avoid duplicates (A->B and B->A)
    edge_set = set()
    
    # 1. Add all devices as nodes
    # We use a simple layout for x,y positions for now
    for i, dev in enumerate(devices):
        nodes.append({
            "id": str(dev.id),
            "position": {"x": 100 + (i * 250), "y": 150},
            "data": {
                "label": dev.name,
                "ip": dev.ip,
                "status": dev.status
            },
            # styling can be applied here or on frontend
        })
        
    # 2. Discover links using CDP
    for dev in devices:
        if dev.status != "ONLINE":
            continue
            
        try:
            neighbors = await snmp_core.get_cdp_neighbors(dev.ip, dev.community_read)
            for neighbor in neighbors:
                # Find local interface name
                local_iface = db.query(models.Interface).filter(
                    models.Interface.device_id == dev.id,
                    models.Interface.if_index == neighbor['local_if_index']
                ).first()
                local_port_name = local_iface.name if local_iface else f"if({neighbor['local_if_index']})"
                
                # Match remote_device name (CDP usually sends hostname or hostname.domain)
                remote_name = neighbor['remote_device'].split('.')[0].lower() # e.g. "Router2.router2.com" -> "router2"
                remote_port = neighbor['remote_port']
                
                # Find remote device in DB
                target_dev = None
                for t in devices:
                    if t.id != dev.id and t.name.lower() == remote_name:
                        target_dev = t
                        break
                        
                if target_dev:
                    # Create edge ID ensuring consistency regardless of direction
                    edge_id = tuple(sorted([str(dev.id), str(target_dev.id)]))
                    if edge_id not in edge_set:
                        edge_set.add(edge_id)
                        edges.append({
                            "id": f"e{edge_id[0]}-{edge_id[1]}",
                            "source": edge_id[0],
                            "target": edge_id[1],
                            "label": f"{local_port_name} <-> {remote_port}",
                            "type": "straight",
                            "animated": True,
                            "style": {"stroke": "#3b82f6", "strokeWidth": 2}
                        })
        except Exception as e:
            print(f"Failed to get topology for {dev.ip}: {e}")
            
    return {"nodes": nodes, "edges": edges}


@app.get("/events")
def get_events(date: str = None, limit: int = 100, db: Session = Depends(get_db)):
    """Get recent SNMP traps and events, keeping only 1 week of data."""
    # 1. Cleanup events older than 7 days
    one_week_ago = datetime.datetime.now() - datetime.timedelta(days=7)
    db.query(models.Event).filter(models.Event.timestamp < one_week_ago).delete(synchronize_session=False)
    db.commit()

    # 2. Query events with optional date filter
    query = db.query(models.Event)
    if date:
        try:
            target_date = datetime.datetime.strptime(date, "%Y-%m-%d").date()
            query = query.filter(
                models.Event.timestamp >= datetime.datetime.combine(target_date, datetime.time.min),
                models.Event.timestamp <= datetime.datetime.combine(target_date, datetime.time.max)
            )
        except ValueError:
            pass # ignore invalid date format

    events = query.order_by(models.Event.timestamp.desc()).limit(limit).all()
    
    # Format the timestamp for the frontend
    result = []
    for ev in events:
        result.append({
            "id": ev.id,
            "time": ev.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            "device_ip": ev.device_ip,
            "event_type": ev.event_type,
            "if_index": ev.if_index,
            "raw_oid": ev.raw_oid,
            "details": ev.details
        })
    return result


@app.get("/dashboard/stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    total_devices = db.query(models.Device).count()
    online_devices = db.query(models.Device).filter(models.Device.status == "ONLINE").count()
    offline_devices = total_devices - online_devices
    
    total_interfaces = db.query(models.Interface).count()
    up_interfaces = db.query(models.Interface).filter(models.Interface.oper_status == "up").count()
    down_interfaces = total_interfaces - up_interfaces
    
    # Recent traps in last 24 hours
    yesterday = datetime.datetime.now() - datetime.timedelta(days=1)
    recent_traps = db.query(models.Event).filter(models.Event.timestamp >= yesterday).count()
    
    # Active alerts calculation
    devices = db.query(models.Device).all()
    events = db.query(models.Event).order_by(models.Event.timestamp.desc()).all()
    
    active_alerts = 0
    # 1. Offline devices
    for dev in devices:
        if dev.status == 'OFFLINE' or dev.snmp_status == 'ERROR':
            active_alerts += 1
            
    # 2. Unresolved LinkDown
    link_down_events = [e for e in events if e.event_type == 'LinkDown']
    link_up_events = [e for e in events if e.event_type == 'LinkUp']
    
    for down_ev in link_down_events:
        resolved = any(up_ev.device_ip == down_ev.device_ip and 
                       up_ev.if_index == down_ev.if_index and 
                       up_ev.timestamp > down_ev.timestamp for up_ev in link_up_events)
        if not resolved:
            active_alerts += 1

    return {
        "totalDevices": total_devices,
        "onlineDevices": online_devices,
        "offlineDevices": offline_devices,
        "activeAlerts": active_alerts,
        "totalInterfaces": total_interfaces,
        "upInterfaces": up_interfaces,
        "downInterfaces": down_interfaces,
        "recentTraps": recent_traps
    }
