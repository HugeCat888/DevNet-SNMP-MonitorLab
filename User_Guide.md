# คู่มือการใช้งานระบบ SNMP Network Monitoring (Assignment 3)

ระบบนี้ถูกพัฒนาขึ้นมาเพื่อใช้มอนิเตอร์และจัดการอุปกรณ์เครือข่าย ทั้งอุปกรณ์จริงและอุปกรณ์ที่รันอยู่ใน EVE-NG โดยใช้โปรโตคอล SNMP (Simple Network Management Protocol) อย่างเต็มรูปแบบ ครอบคลุมทั้งการดึงข้อมูล (GET/WALK) การสั่งการ (SET) และการรับแจ้งเตือน (TRAP)

## 📌 โครงสร้างของระบบ
- **Frontend**: พัฒนาด้วย React, Vite, Tailwind CSS, และ DaisyUI
- **Backend**: พัฒนาด้วย FastAPI (Python), SQLAlchemy, และไลบรารี `pysnmp` สำหรับจัดการกระบวนการของ SNMP
- **Database**: ใช้ SQLite (`network_monitor.db`) 

---

## 🚀 ฟีเจอร์ทั้งหมดที่ระบบสามารถทำได้

### 1. 📊 Dashboard & Device Management
- **เพิ่มอุปกรณ์ (Add Device)**: รองรับทั้ง **SNMP v2c** (Community String) และ **SNMP v3** (USM Auth/Priv)
- **ดึงข้อมูลระบบ (System Info)**: ดึงค่าพื้นฐานอัตโนมัติ เช่น `sysDescr`, `sysObjectID` (ระบบจะแปลง OID เป็นชื่ออุปกรณ์ที่อ่านเข้าใจง่ายให้ เช่น Cisco Router), และ `sysUpTime`
- **ระบบ Check & Discover**: ตรวจสอบสถานะและค้นหา Interface ในอุปกรณ์อัตโนมัติ

### 2. 🔌 Auto Discovery & Interface Control
- **ค้นหา Interfaces ทั้งหมดอัตโนมัติ**: เมื่อเพิ่มอุปกรณ์แล้ว ระบบสามารถทำ SNMP Walk อัตโนมัติไปยัง `ifEntry` เพื่อค้นหาพอร์ตทั้งหมด ดึงชื่อความเร็ว และ MAC Address ออกมาให้ครบถ้วน รวมถึงมีการลบพอร์ตเก่าทิ้งหากพอร์ตนั้นไม่มีบนเร้าเตอร์แล้ว (Stale Cleanup)
- **การเปิด/ปิดพอร์ต (UP/DOWN)**: สั่งเปลี่ยนสถานะของพอร์ตอุปกรณ์เครือข่ายบนหน้าเว็บได้ทันที โดยระบบจะส่ง SNMP SET เพื่อแก้ค่า `ifAdminStatus`

### 3. 📈 Live Traffic Monitoring
- **กราฟแบบเรียลไทม์**: ดูปริมาณการส่งข้อมูลเข้า-ออกบน Interface แบบสดๆ ด้วย Live Polling
- **คำนวณ Bandwidth อัตโนมัติ**: ระบบแปลงข้อมูล Counter (32-bit `ifInOctets`/`ifOutOctets`) ให้กลายเป็น Traffic แบบ Mbps อัตโนมัติ และมีการจัดการ Counter Wrap เวลาค่าทะลุเกินขีดจำกัดด้วย

### 4. 🕸️ Network Topology (CDP Discovery)
- **วาดแผนผังเครือข่ายอัตโนมัติ**: หน้า Topology สามารถวาดโครงสร้างเชื่อมต่อของเน็ตเวิร์กออกมาเป็นกราฟเชื่อมต่อ (ReactFlow) ได้อัตโนมัติ
- **อ่านข้อมูล CDP ผ่าน SNMP**: อาศัยเทคนิคการกวาด OID ของ `cdpCacheDeviceId` และ `cdpCacheDevicePort` ทำให้ระบบรู้ว่าสายเชื่อมอยู่จากพอร์ตใดไปหาเร้าเตอร์ตัวใด

### 5. 🚨 SNMP Traps & Smart Alerts
- **Trap Receiver พื้นหลัง**: มีสคริปต์ `trap_receiver.py` ทำงานแยกเป็น Service รับฟัง SNMP Trap (UDP Port 162) ไว้ตลอดเวลา
- **Events Log**: บันทึก Trap อัตโนมัติลงในหน้า Events เช่น `LinkUp`, `LinkDown`, `ColdStart` พร้อม Live Polling หน้าเว็บให้เห็นเหตุการณ์ใหม่ทันที
- **Smart Active Alerts**: ระบบแจ้งเตือนจะวิเคราะห์ข้อมูลเอง หากเร้าเตอร์ OFFLINE จะแจ้งเตือนระดับ Critical และถ้าพอร์ตเกิด LinkDown แจ้งเตือนระดับ Warning จะโผล่ขึ้น และ **แจ้งเตือนจะหายไปอัตโนมัติหากมี Trap LinkUp กลับมา**

### 6. 📜 เหตุการณ์และประวัติ (Events & SNMP Traps Log)
หน้าต่าง **Events** เป็นศูนย์รวมบันทึกเหตุการณ์ทั้งหมดที่ถูกส่งมาจากตัวเร้าเตอร์ในรูปแบบ SNMP Trap โดยมีรายละเอียดการแสดงผลดังนี้:
- **Time**: แสดงเวลาที่เกิดเหตุการณ์ขึ้นจริง (อ้างอิงตามเวลาโซนไทย UTC+7 ของเครื่องเซิร์ฟเวอร์) 
- **Source IP**: ระบุว่ามาจากอุปกรณ์เครือข่ายหมายเลข IP ใด
- **Event Type**: ระบบจะทำการแกะข้อมูล (Parse) จากตัวเลขอ่านยากๆ ออกมาเป็นคำที่เข้าใจง่าย เช่น:
  - `LinkUp` 🟢 (พอร์ตเชื่อมต่อสำเร็จ)
  - `LinkDown` 🔴 (พอร์ตสายหลุดหรือโดนปิด)
  - `ColdStart` / `WarmStart` 🔄 (เครื่องถูกเปิดใหม่หรือรีบูต)
- **Interface Index**: หากเหตุการณ์นั้นเกี่ยวกับพอร์ต (เช่นพอร์ตดับ) ระบบจะบอกตัวเลข Index ของพอร์ตนั้นๆ ได้อย่างแม่นยำ
- **Raw Trap OID**: แสดงรหัส OID ดั้งเดิมที่ส่งมากับ Trap เพื่อให้ Network Admin สามารถนำไปตรวจสอบเพิ่มเติมหรืออ้างอิงในเอกสาร MIB ได้
- *หน้าเพจนี้ทำงานด้วยระบบ **Live Polling** ซึ่งจะดึงข้อมูลใหม่ๆ มาแสดงผลแบบอัตโนมัติทุกๆ 5 วินาที ทำให้คุณไม่ต้องกด Refresh หน้าจอเองเพื่อรอดูเหตุการณ์ใหม่เลย*

---

## 🛠️ การเตรียมการเชื่อมต่อและตั้งค่าบน EVE-NG Router

### การตั้งค่าให้รองรับการดึงข้อมูลและสั่งปิดพอร์ตได้ (SNMP GET/SET)
เพื่อให้เราสั่ง Shutdown พอร์ตบนเว็บได้ ต้องให้สิทธิ์ Read-Write (RW)

**สำหรับ SNMP v2c:**
```text
Router(config)# snmp-server community public RO
Router(config)# snmp-server community private RW
```
**สำหรับ SNMP v3:**
```text
Router(config)# snmp-server group MyGroup v3 auth write v1default
Router(config)# snmp-server user admin MyGroup v3 auth sha MyAuthPass priv aes 128 MyPrivPass
```

### การตั้งค่าให้เร้าเตอร์ส่ง SNMP TRAP (เวลาพอร์ตดับ/ติด) กลับมาระบบ
เปิดฟีเจอร์ Trap เพื่อให้เร้าเตอร์วิ่งมารายงานตัวกับระบบ (IP 192.168.x.x คือ IP ของเครื่องเราที่รันโปรแกรม)
```text
Router(config)# snmp-server host 192.168.215.1 version 2c public
Router(config)# snmp-server enable traps snmp linkdown linkup coldstart warmstart
```

### การตั้งค่าให้รองรับ Network Topology (เปิด CDP)
ต้องมีคำสั่งเปิด CDP บนเร้าเตอร์ทุกตัว
```text
Router(config)# cdp run
```

---

## 💻 วิธีการรันระบบเพื่อทดสอบ

### 1. การรัน Backend (FastAPI & Trap Receiver)
เปิด Terminal ที่โฟลเดอร์ `backend`
```bash
# 1. รัน API Server
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# 2. เปิด Terminal อีกแท็บรัน Trap Receiver ควบคู่กัน (สำคัญมาก! สำหรับรับ Event LinkDown/Up)
python trap_receiver.py
```
*(ถ้ารัน Trap Receiver แล้วขึ้น Permission Error แสดงว่า Port 162 อาจโดนโปรแกรมอื่นใช้ ให้ลองรันในฐานะ Administrator หรือสลับพอร์ต)*

### 2. การรัน Frontend (React)
เปิด Terminal ที่โฟลเดอร์ `frontend`
```bash
npm install
npm run dev
```
เข้าใช้งานได้ผ่าน `http://localhost:5173`

---

## 📂 ศูนย์รวมคำสั่ง SNMP ภายในโค้ด

หากต้องการแก้ไขหรือเพิ่ม OID การจัดการ SNMP ทั้งหมดถูกรวมศูนย์ไว้ที่ **`backend/snmp_core.py`**:
- `get_sys_info()` : ดึงข้อมูลเครื่อง
- `walk_interfaces()` : ค้นหาพอร์ตและดึงตาราง `ifEntry` 
- `set_interface_status()` : สั่งเปิดปิดพอร์ต (`ifAdminStatus`)
- `get_interface_traffic()` : คำนวณ Bandwidth (`ifInOctets`/`ifOutOctets`)
- `get_cdp_neighbors()` : ดึงการเชื่อมต่อเครือข่าย

ส่วนการรับ Trap จะอยู่ที่ **`backend/trap_receiver.py`** ซึ่งใช้ไลบรารี PySNMP ในการแยกแยะ Event Type ตาม OID มาตรฐาน (1.3.6.1.6.3.1.1.4.1.0) ครับ
