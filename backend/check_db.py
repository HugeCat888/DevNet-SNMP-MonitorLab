import sqlite3
c = sqlite3.connect('network_monitor.db').cursor()
c.execute("UPDATE events SET event_type='SyslogMessage' WHERE raw_oid LIKE '%1.3.6.1.4.1.9.9.41.2.0.1%'")
c.execute("UPDATE events SET event_type='ConfigChanged' WHERE raw_oid LIKE '%1.3.6.1.4.1.9.9.43.2.0.1%'")
c.execute("UPDATE events SET event_type='CustomTrap' WHERE event_type='Unknown'")
c.connection.commit()
c.connection.close()
print("Updated database.")
