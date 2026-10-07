const ExcelJS = require('exceljs');
const { db } = require('./db');

async function runImportHistory() {
  console.log('⏳ กำลังอ่านไฟล์ประวัติการแข่งขัน...');
  
  const workbook = new ExcelJS.Workbook();
  // ระบุชื่อไฟล์ให้ตรง
  await workbook.xlsx.readFile('Database รายชื่อราชวิทย์ การมารวมแข่งขัน.xlsx'); 
  const worksheet = workbook.worksheets[0]; // ใช้ชีตแรก

  let matchCount = 0;
  let recordCount = 0;
  let newMemberCount = 0;

  // 🎯 เตรียมคำสั่ง SQL (แก้ไขเครื่องหมายฟันหนู " เป็น ' เรียบร้อยแล้วเพื่อป้องกัน Error)
  const findMember = db.prepare("SELECT id FROM members WHERE REPLACE(first_name, ' ', '') = ? AND REPLACE(last_name, ' ', '') = ?");
  const insertMember = db.prepare("INSERT INTO members (title, first_name, last_name, status) VALUES (?, ?, ?, 'ACTIVE')");
  
  const findEvent = db.prepare("SELECT id FROM events WHERE name = ?");
  // สร้างแมตช์ย้อนหลัง โดยใช้วันที่ปัจจุบันไปก่อน (เพื่อเก็บประวัติ)
  const insertEvent = db.prepare("INSERT INTO events (name, event_date, course_id, status) VALUES (?, date('now'), ?, 'CLOSED')"); 
  
  const insertReg = db.prepare("INSERT INTO registrations (event_id, member_id, hdcp_used, flight, checked_in) VALUES (?, ?, ?, ?, 1)");
  const insertResult = db.prepare("INSERT INTO results (registration_id, gross, net) VALUES (?, ?, ?)");

  // สร้าง Course จำลองไว้เก็บประวัติเก่า ถ้ายังไม่มีสนามในระบบ
  let defaultCourse = db.prepare("SELECT id FROM courses LIMIT 1").get();
  if (!defaultCourse) {
    const cid = db.prepare("INSERT INTO courses (name) VALUES ('สนามประวัติศาสตร์ (Historical Data)')").run().lastInsertRowid;
    defaultCourse = { id: cid };
  }

  db.transaction(() => {
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // ข้ามบรรทัดหัวตาราง

      const title = row.getCell(1).text.trim();
      const fName = row.getCell(2).text.trim();
      const lName = row.getCell(3).text.trim();
      const gross = parseFloat(row.getCell(4).value) || 0;
      const flight = row.getCell(5).text.trim();
      const hc = parseFloat(row.getCell(6).value) || 0;
      const net = parseFloat(row.getCell(7).value) || 0;
      const matchNo = row.getCell(9).text.trim();

      if (!fName || !matchNo) return; // ถ้าข้อมูลไม่ครบ ข้ามไป

      // 1. ตรวจสอบและสร้างรายการแข่งขัน (Event)
      const eventName = `การแข่งขันครั้งที่ ${matchNo}`;
      let event = findEvent.get(eventName);
      if (!event) {
        event = { id: insertEvent.run(eventName, defaultCourse.id).lastInsertRowid };
        matchCount++;
      }

      // 2. ตรวจสอบและค้นหาสมาชิก (ตัดช่องว่างออกเพื่อให้ค้นหาแม่นยำขึ้น)
      let member = findMember.get(fName.replace(/\s/g, ''), lName.replace(/\s/g, ''));
      if (!member) {
        // ถ้าไม่เจอใน 176 คนแรก ให้สร้างสมาชิกใหม่เพิ่มเข้าไปเลย
        member = { id: insertMember.run(title, fName, lName).lastInsertRowid };
        newMemberCount++;
      }

      // 3. ลงทะเบียนและใส่คะแนน
      try {
         // บันทึกการลงทะเบียน (checked_in = 1 คือมาแข่งจริง)
         const regInfo = insertReg.run(event.id, member.id, hc, flight);
         
         // บันทึกผลสกอร์
         insertResult.run(regInfo.lastInsertRowid, gross, net);
         recordCount++;
      } catch(e) {
         // กรณีผู้เล่นคนนี้มีชื่อซ้ำในแมตช์เดียวกัน จะข้ามไป (ป้องกัน Error)
      }
    });
  })();

  console.log('========================================');
  console.log(`⛳ สร้างประวัติแมตช์ย้อนหลัง: ${matchCount} รายการ`);
  console.log(`👤 เพิ่มสมาชิกใหม่ที่ตกหล่นจากไฟล์หลัก: ${newMemberCount} คน`);
  console.log(`📝 บันทึกประวัติการแข่งขันและคะแนนสะสม: ${recordCount} รายการ`);
  console.log('========================================');
  console.log('🎉 เสร็จสิ้น! ระบบคำนวณสิทธิรับรางวัลอัปเดตเรียบร้อยแล้ว!');
}

runImportHistory().catch(err => console.error('❌ เกิดข้อผิดพลาด:', err));