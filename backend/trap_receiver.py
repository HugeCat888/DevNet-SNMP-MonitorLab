import asyncio
from pysnmp.hlapi.asyncio import *
from pysnmp.entity import engine, config
from pysnmp.carrier.asyncio.dgram import udp
from pysnmp.entity.rfc3413 import ntfrcv
import sqlite3
import datetime
import json

# Database path
DB_PATH = 'network_monitor.db'

def save_event(device_ip, event_type, if_index, raw_oid, details=""):
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute(
            "INSERT INTO events (timestamp, device_ip, event_type, if_index, raw_oid, details) VALUES (?, ?, ?, ?, ?, ?)",
            (datetime.datetime.now(), device_ip, event_type, if_index, raw_oid, details)
        )
        conn.commit()
        conn.close()
        print(f"[{datetime.datetime.now()}] Saved event: {event_type} from {device_ip} (ifIndex: {if_index})")
    except Exception as e:
        print(f"Failed to save event: {e}")

# Callback function for receiving notifications
def cbFun(snmpEngine, stateReference, contextEngineId, contextName, varBinds, cbCtx):
    try:
        transportDomain, transportAddress = snmpEngine.message_dispatcher.get_transport_info(stateReference)
    except AttributeError:
        transportDomain, transportAddress = snmpEngine.msgAndPduDsp.getTransportInfo(stateReference)
        
    device_ip = transportAddress[0]
    
    print(f"Notification from {device_ip}:")
    
    event_type = 'Unknown'
    if_index = None
    raw_oid = ""
    
    varbinds_dict = {}
    short_detail = ""
    
    for name, val in varBinds:
        oid_str = name.prettyPrint()
        val_str = val.prettyPrint()
        print(f'{oid_str} = {val_str}')
        varbinds_dict[oid_str] = val_str
        
        # Check for linkUp/linkDown
        if '1.3.6.1.6.3.1.1.4.1.0' in oid_str: # snmpTrapOID
            raw_oid = val_str
            if 'linkUp' in val_str or '1.3.6.1.6.3.1.1.5.4' in val_str:
                event_type = 'LinkUp'
            elif 'linkDown' in val_str or '1.3.6.1.6.3.1.1.5.3' in val_str:
                event_type = 'LinkDown'
            elif 'coldStart' in val_str or '1.3.6.1.6.3.1.1.5.1' in val_str:
                event_type = 'ColdStart'
            elif 'warmStart' in val_str or '1.3.6.1.6.3.1.1.5.2' in val_str:
                event_type = 'WarmStart'
            elif 'authenticationFailure' in val_str or '1.3.6.1.6.3.1.1.5.5' in val_str:
                event_type = 'AuthFailure'
            elif '1.3.6.1.4.1.9.9.41.2.0.1' in val_str:
                event_type = 'SyslogMessage'
            elif '1.3.6.1.4.1.9.9.43.2.0.1' in val_str:
                event_type = 'ConfigChanged'
            else:
                event_type = 'CustomTrap'
        
        # Check for ifIndex
        if '1.3.6.1.2.1.2.2.1.1.' in oid_str:
            try:
                if_index = int(val_str)
            except:
                pass
                
        # Extract specific short descriptions
        if '1.3.6.1.4.1.9.9.41.1.2.3.1.5' in oid_str: # clogHistMsgText
            short_detail = val_str
            
    # Combine short detail and full JSON varbinds
    details_payload = json.dumps({
        "short_desc": short_detail,
        "varbinds": varbinds_dict
    })
                
    save_event(device_ip, event_type, if_index, raw_oid, details_payload)

async def run_trap_receiver():
    snmpEngine = engine.SnmpEngine()
    
    # Configure UDP listener on port 162
    try:
        config.add_transport(
            snmpEngine,
            udp.DOMAIN_NAME,
            udp.UdpTransport().open_server_mode(('0.0.0.0', 162))
        )
    except AttributeError:
        # Fallback for older pysnmp
        config.addTransport(
            snmpEngine,
            udp.domainName,
            udp.UdpTransport().openServerMode(('0.0.0.0', 162))
        )

    # Configure community "public"
    config.addV1System(snmpEngine, 'my-area', 'public')

    # Register callback
    ntfrcv.NotificationReceiver(snmpEngine, cbFun)

    print("SNMP Trap Receiver listening on UDP 162...")
    
    # Keep the asyncio loop running
    while True:
        await asyncio.sleep(1)

if __name__ == '__main__':
    try:
        asyncio.run(run_trap_receiver())
    except KeyboardInterrupt:
        print("Trap receiver stopped.")
