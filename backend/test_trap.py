import asyncio
from pysnmp.hlapi.asyncio import *

async def send_traps():
    snmpEngine = SnmpEngine()
    # ชี้เป้าหมายไปที่เครื่องตัวเอง (127.0.0.1) พอร์ต 162
    transport = await UdpTransportTarget.create(('127.0.0.1', 162))
    
    print("Sending LinkDown Trap (Port 1)...")
    await send_notification(
        snmpEngine, 
        CommunityData('public'), 
        transport, 
        ContextData(), 
        'trap', 
        NotificationType(ObjectIdentity('1.3.6.1.6.3.1.1.5.3')).add_varbinds(('1.3.6.1.2.1.2.2.1.1.1', Integer32(1)))
    )
    
    await asyncio.sleep(2)
    
    print("Sending LinkUp Trap (Port 1)...")
    await send_notification(
        snmpEngine, 
        CommunityData('public'), 
        transport, 
        ContextData(), 
        'trap', 
        NotificationType(ObjectIdentity('1.3.6.1.6.3.1.1.5.4')).add_varbinds(('1.3.6.1.2.1.2.2.1.1.1', Integer32(1)))
    )
    
    await asyncio.sleep(2)
    
    print("Sending ColdStart Trap...")
    await send_notification(
        snmpEngine, 
        CommunityData('public'), 
        transport, 
        ContextData(), 
        'trap', 
        NotificationType(ObjectIdentity('1.3.6.1.6.3.1.1.5.1'))
    )

    print("Test Traps Sent Successfully!")

asyncio.run(send_traps())
