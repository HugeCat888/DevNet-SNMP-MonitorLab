import asyncio
from pysnmp.hlapi.asyncio import *

# Common sysObjectID to vendor/model mapping
SYS_OID_MAP = {
    '1.3.6.1.4.1.9.1.1': 'Cisco Router (Generic)',
    '1.3.6.1.4.1.9.1.46': 'Cisco 3600 Router',
    '1.3.6.1.4.1.9.1.108': 'Cisco 7206 Router',
    '1.3.6.1.4.1.9.1.122': 'Cisco 3640 Router',
    '1.3.6.1.4.1.9.1.208': 'Cisco Catalyst Switch',
    '1.3.6.1.4.1.9.1.283': 'Cisco 2600 Router',
    '1.3.6.1.4.1.9.1.516': 'Cisco 2811 Router',
    '1.3.6.1.4.1.9.1.620': 'Cisco 2821 Router',
    '1.3.6.1.4.1.9.1.525': 'Cisco ASR 1000',
    '1.3.6.1.4.1.9.1.1045': 'Cisco ISR 4000',
    '1.3.6.1.4.1.9.12.3.1.3': 'Cisco IOS-XE',
    '1.3.6.1.4.1.2636': 'Juniper Networks',
    '1.3.6.1.4.1.25506': 'HPE/H3C',
    '1.3.6.1.4.1.8072.3.2.10': 'Linux (net-snmp)',
    '1.3.6.1.4.1.311.1.1.3.1.1': 'Microsoft Windows',
}

def resolve_sys_object_id(oid_str):
    """Resolve sysObjectID OID to a human-readable vendor/model name."""
    # Try exact match first
    if oid_str in SYS_OID_MAP:
        return SYS_OID_MAP[oid_str]
    # Try prefix match (longest match first)
    best_match = None
    best_len = 0
    for prefix, name in SYS_OID_MAP.items():
        if oid_str.startswith(prefix) and len(prefix) > best_len:
            best_match = name
            best_len = len(prefix)
    if best_match:
        return best_match
    # Identify vendor by enterprise OID prefix
    if oid_str.startswith('1.3.6.1.4.1.9.'):
        return f'Cisco Device ({oid_str})'
    if oid_str.startswith('1.3.6.1.4.1.2636.'):
        return f'Juniper Device ({oid_str})'
    return oid_str

async def get_sys_info(ip, community="public"):
    snmp_engine = SnmpEngine()
    transport = await UdpTransportTarget.create((ip, 161), timeout=2.0, retries=1)
    
    errorIndication, errorStatus, errorIndex, varBinds = await get_cmd(
        snmp_engine,
        CommunityData(community),
        transport,
        ContextData(),
        ObjectType(ObjectIdentity('1.3.6.1.2.1.1.1.0')),
        ObjectType(ObjectIdentity('1.3.6.1.2.1.1.2.0')),
        ObjectType(ObjectIdentity('1.3.6.1.2.1.1.3.0'))
    )
    
    if errorIndication:
        return {"error": str(errorIndication)}
    elif errorStatus:
        return {"error": f"{errorStatus.prettyPrint()} at {errorIndex}"}
    else:
        raw_oid = str(varBinds[1][1])
        return {
            "sysDescr": str(varBinds[0][1]),
            "sysObjectID": raw_oid,
            "sysObjectIDResolved": resolve_sys_object_id(raw_oid),
            "sysUpTime": str(varBinds[2][1])
        }

async def set_interface_admin_status(ip, community, if_index, status):
    snmp_engine = SnmpEngine()
    transport = await UdpTransportTarget.create((ip, 161), timeout=2.0, retries=1)
    val = Integer(1) if status.lower() == 'up' else Integer(2)
    
    errorIndication, errorStatus, errorIndex, varBinds = await set_cmd(
        snmp_engine,
        CommunityData(community),
        transport,
        ContextData(),
        ObjectType(ObjectIdentity(f'1.3.6.1.2.1.2.2.1.7.{if_index}'), val)
    )
    if errorIndication:
        return {"error": str(errorIndication)}
    elif errorStatus:
         return {"error": f"{errorStatus.prettyPrint()} at {errorIndex}"}
    return {"status": "success", "message": f"Interface {if_index} set to {status}"}


async def walk_interfaces(ip, community='public'):
    snmp_engine = SnmpEngine()
    transport = await UdpTransportTarget.create((ip, 161), timeout=2.0, retries=1)
    iterator = walk_cmd(
        snmp_engine,
        CommunityData(community),
        transport,
        ContextData(),
        ObjectType(ObjectIdentity('1.3.6.1.2.1.2.2.1')),
        lexicographicMode=False
    )
    # IANA ifType mapping (common types)
    IF_TYPE_MAP = {
        1: 'other', 6: 'ethernetCsmacd', 24: 'softwareLoopback',
        53: 'propVirtual', 131: 'tunnel', 135: 'l2vlan',
        136: 'l3ipvlan', 150: 'mplsTunnel', 161: 'ieee8023adLag',
    }
    interfaces = {}
    try:
        async for errorIndication, errorStatus, errorIndex, varBinds in iterator:
            if errorIndication:
                print(f'Walk errorIndication: {errorIndication}')
                break
            if errorStatus:
                print(f'Walk errorStatus: {errorStatus.prettyPrint()} at {errorIndex}')
                break
            for varBind in varBinds:
                oid_tuple = varBind[0].asTuple()
                if len(oid_tuple) >= 11:
                    col = oid_tuple[9]
                    idx = oid_tuple[10]
                    if idx not in interfaces:
                        interfaces[idx] = {
                            'if_index': idx,
                            'name': f'Interface {idx}',
                            'description': '',
                            'mac_address': '',
                            'speed_bps': 0,
                            'admin_status': 'unknown',
                            'oper_status': 'unknown',
                            'type': 'other',
                        }
                    val = varBind[1]
                    if col == 1:
                        # ifIndex (confirm)
                        pass
                    elif col == 2:
                        # ifDescr
                        interfaces[idx]['name'] = str(val)
                        interfaces[idx]['description'] = str(val)
                    elif col == 3:
                        # ifType
                        try:
                            type_id = int(val)
                            interfaces[idx]['type'] = IF_TYPE_MAP.get(type_id, f'type({type_id})')
                        except (ValueError, TypeError):
                            interfaces[idx]['type'] = str(val)
                    elif col == 5:
                        # ifSpeed
                        try:
                            interfaces[idx]['speed_bps'] = int(val)
                        except (ValueError, TypeError):
                            interfaces[idx]['speed_bps'] = 0
                    elif col == 6:
                        # ifPhysAddress (MAC)
                        mac = val.prettyPrint()
                        if mac.startswith('0x'): mac = mac[2:]
                        interfaces[idx]['mac_address'] = ':'.join(mac[i:i+2] for i in range(0, len(mac), 2)) if mac else ''
                    elif col == 7:
                        # ifAdminStatus: 1=up, 2=down, 3=testing
                        try:
                            status_val = int(val)
                            interfaces[idx]['admin_status'] = {1: 'up', 2: 'down', 3: 'testing'}.get(status_val, 'unknown')
                        except (ValueError, TypeError):
                            interfaces[idx]['admin_status'] = 'unknown'
                    elif col == 8:
                        # ifOperStatus: 1=up, 2=down, 3=testing, etc.
                        try:
                            status_val = int(val)
                            interfaces[idx]['oper_status'] = {1: 'up', 2: 'down', 3: 'testing', 4: 'unknown', 5: 'dormant', 6: 'notPresent', 7: 'lowerLayerDown'}.get(status_val, 'unknown')
                        except (ValueError, TypeError):
                            interfaces[idx]['oper_status'] = 'unknown'
        return list(interfaces.values())
    except Exception as e:
        print('Walk error:', e)
        import traceback
        traceback.print_exc()
        return []


async def get_interface_traffic(ip, if_index, community='public'):
    """Get ifInOctets and ifOutOctets for a specific interface."""
    snmp_engine = SnmpEngine()
    transport = await UdpTransportTarget.create((ip, 161), timeout=2.0, retries=1)
    
    # OID 1.3.6.1.2.1.2.2.1.10.{if_index} = ifInOctets
    # OID 1.3.6.1.2.1.2.2.1.16.{if_index} = ifOutOctets
    errorIndication, errorStatus, errorIndex, varBinds = await get_cmd(
        snmp_engine,
        CommunityData(community),
        transport,
        ContextData(),
        ObjectType(ObjectIdentity(f'1.3.6.1.2.1.2.2.1.10.{if_index}')),
        ObjectType(ObjectIdentity(f'1.3.6.1.2.1.2.2.1.16.{if_index}'))
    )
    
    if errorIndication:
        return {"error": str(errorIndication)}
    elif errorStatus:
        return {"error": f"{errorStatus.prettyPrint()} at {errorIndex}"}
    else:
        return {
            "if_index": if_index,
            "in_octets": int(varBinds[0][1]),
            "out_octets": int(varBinds[1][1])
        }

async def get_cdp_neighbors(ip, community='public'):
    """Fetch CDP neighbors from a device to build topology."""
    snmp_engine = SnmpEngine()
    transport = await UdpTransportTarget.create((ip, 161), timeout=2.0, retries=1)
    
    # cdpCacheDeviceId (1.3.6.1.4.1.9.9.23.1.2.1.1.6)
    iterator_id = walk_cmd(
        snmp_engine, CommunityData(community), transport, ContextData(),
        ObjectType(ObjectIdentity('1.3.6.1.4.1.9.9.23.1.2.1.1.6')), lexicographicMode=False
    )
    
    neighbors = {}
    
    try:
        async for errorIndication, errorStatus, errorIndex, varBinds in iterator_id:
            if errorIndication or errorStatus: break
            for varBind in varBinds:
                oid_tuple = varBind[0].asTuple()
                if len(oid_tuple) >= 16:
                    if_index = oid_tuple[14]
                    device_index = oid_tuple[15]
                    device_id = str(varBind[1])
                    if if_index not in neighbors:
                        neighbors[if_index] = {}
                    neighbors[if_index][device_index] = {'remote_device': device_id, 'remote_port': ''}
                    
        # cdpCacheDevicePort (1.3.6.1.4.1.9.9.23.1.2.1.1.7)
        iterator_port = walk_cmd(
            snmp_engine, CommunityData(community), transport, ContextData(),
            ObjectType(ObjectIdentity('1.3.6.1.4.1.9.9.23.1.2.1.1.7')), lexicographicMode=False
        )
        async for errorIndication, errorStatus, errorIndex, varBinds in iterator_port:
            if errorIndication or errorStatus: break
            for varBind in varBinds:
                oid_tuple = varBind[0].asTuple()
                if len(oid_tuple) >= 16:
                    if_index = oid_tuple[14]
                    device_index = oid_tuple[15]
                    port_id = str(varBind[1])
                    if if_index in neighbors and device_index in neighbors[if_index]:
                        neighbors[if_index][device_index]['remote_port'] = port_id
                        
        # Flatten dictionary to list
        result = []
        for if_idx, devs in neighbors.items():
            for dev_idx, data in devs.items():
                result.append({
                    'local_if_index': if_idx,
                    'remote_device': data['remote_device'],
                    'remote_port': data['remote_port']
                })
        return result
    except Exception as e:
        print('CDP walk error:', e)
        return []
