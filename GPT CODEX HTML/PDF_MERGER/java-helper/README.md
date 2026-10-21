# PDF Merger — Java Clipboard

ดับเบิลคลิก `START_PDF_MERGER.cmd` ที่โฟลเดอร์หลัก แล้วใช้หน้าที่เปิดขึ้น
ไม่ต้องติดตั้ง Java เพิ่ม: มี portable Java runtime รวมไว้แล้ว และไม่แก้ PATH ของ Windows

- ตัวช่วยรับการเชื่อมต่อเฉพาะ 127.0.0.1 ใช้พอร์ตและรหัสสุ่มใหม่เมื่อเริ่มทำงาน
- หน้า HTML ที่เปิดตรงจาก file:// ยังรวมและพรีวิวได้ แต่การคัดลอกผ่าน Java ต้องใช้หน้าที่เปิดจากตัวช่วย
- ปุ่มคัดลอกจะบันทึกสำเนา PDF แล้วใส่รายการไฟล์จริงลงใน Windows Clipboard รองรับไฟล์ไม่เกิน 512 MB
- วางด้วย Ctrl+V ใน File Explorer หรือแอปที่รองรับการรับไฟล์จาก Clipboard
- สำเนาไฟล์เก็บใน `clipboard-files/` ไม่อัปโหลดไปอินเทอร์เน็ต และไม่ลบทันที เพื่อให้วางไฟล์ซ้ำได้
- เมื่อต้องการคืนพื้นที่ ให้คัดลอกสิ่งอื่นลง Clipboard ก่อน แล้วลบไฟล์ภายใน `clipboard-files/` ที่ไม่ต้องการเอง
- หยุดตัวช่วยด้วย PowerShell: `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\PDF_MERGER\java-helper\STOP_PDF_MERGER.ps1`

Java source: `PdfMergerClipboard.java` (Java 21)
Runtime: Eclipse Temurin / OpenJDK 21; license and notices are included in `runtime/legal/`.
