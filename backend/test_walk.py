import asyncio
from pysnmp.hlapi.asyncio import *

async def test_walk_table():
    snmp_engine = SnmpEngine()
    transport = await UdpTransportTarget.create(("192.168.215.132", 161), timeout=2.0, retries=1)
    
    # Using walk_cmd
    iterator = walk_cmd(
        snmp_engine,
        CommunityData("public"),
        transport,
        ContextData(),
        ObjectType(ObjectIdentity('1.3.6.1.2.1.2.2.1')), # ifEntry
        lexicographicMode=False
    )
    
    try:
        async for errorIndication, errorStatus, errorIndex, varBinds in iterator:
            if errorIndication:
                break
            elif errorStatus:
                break
            else:
                for varBind in varBinds:
                    print(varBind[0].prettyPrint(), "=", varBind[1].prettyPrint())
    except Exception as e:
        pass
        
if __name__ == "__main__":
    asyncio.run(test_walk_table())
