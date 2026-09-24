import asyncio
from pysnmp.hlapi.asyncio import *

async def test_snmp():
    snmp_engine = SnmpEngine()
    transport = UdpTransportTarget.create(("192.168.215.129", 161), timeout=2.0, retries=1)
    if asyncio.iscoroutine(transport):
        transport = await transport
        
    errorIndication, errorStatus, errorIndex, varBinds = await get_cmd(
        snmp_engine,
        CommunityData("public"),
        transport,
        ContextData(),
        ObjectType(ObjectIdentity('1.3.6.1.2.1.1.1.0'))
    )
    print("Success get_cmd")

if __name__ == "__main__":
    asyncio.run(test_snmp())
