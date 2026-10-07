const ExcelJS = require('exceljs');
const { db } = require('./db'); // เรียกใช้ฐานข้อมูลเดิมของเรา

async function runImport() {
  console.log('⏳ กำลังอ่านไฟล์ Excel และค้นหา Note ที่ซ่อนอยู่...');
  
  const workbook = new ExcelJS.Workbook();
  // ระบุชื่อไฟล์ Excel ให้ตรงกับที่มีอยู่ในเครื่อง
  await workbook.xlsx.readFile('Database รายชื่อราชวิทย์ UpDate ถึง176.xlsx'); 
  const worksheet = workbook.worksheets[0]; // ใช้ชีตแรก (Data)

  // เคลียร์ข้อมูลเก่าทั้งหมดเพื่อนำเข้าใหม่แบบคลีนๆ
  db.prepare('DELETE FROM members').run();
  db.prepare('DELETE FROM handicap_history').run();
  db.prepare("DELETE FROM sqlite_sequence WHERE name='members'").run(); // รีเซ็ต ID ให้เริ่มที่ 1 (แก้จุดที่ Error แล้ว)

  const insertMember = db.prepare(`
    INSERT INTO members (member_code, title, first_name, last_name, base_flight, handicap, alumni_batch, house, privilege, note) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertHistory = db.prepare(`
    INSERT INTO handicap_history (member_id, old_hdcp, new_hdcp, reason, changed_by) 
    VALUES (?, ?, ?, ?, ?)
  `);

  let count = 0;
  let historyCount = 0;

  db.transaction(() => {
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // ข้ามบรรทัดที่ 1 (หัวตาราง)

      const member_code = row.getCell(1).text.trim();
      const title = row.getCell(2).text.trim();
      const first_name = row.getCell(3).text.trim();
      const last_name = row.getCell(4).text.trim();
      
      if (!first_name) return; // ถ้าไม่มีชื่อ ให้ข้ามไป

      const base_flight = row.getCell(5).text.trim();
      const handicap = parseFloat(row.getCell(6).value) || 24;
      const alumni_batch = row.getCell(7).text.trim();
      const house = row.getCell(8).text.trim();
      const privilege = row.getCell(9).text.trim();

      // 🎯 ไฮไลต์สำคัญ: ดึง Note (Comment) ที่ซ่อนอยู่ในคอลัมน์ Handicap (ช่องที่ 6)
      const hdcpCell = row.getCell(6);
      let noteText = null;
      if (hdcpCell.note) {
        // ExcelJS อาจเก็บ note เป็นข้อความตรงๆ หรือเป็น object ที่มีการจัด Format
        noteText = typeof hdcpCell.note === 'string' 
          ? hdcpCell.note 
          : hdcpCell.note.texts.map(t => t.text).join('').trim();
      }

      // 1. บันทึกเข้าตารางสมาชิก
      const info = insertMember.run(
        member_code, title, first_name, last_name, 
        base_flight, handicap, alumni_batch, house, privilege, noteText
      );
      count++;

      // 2. ถ้าช่องนั้นมี Note ซ่อนอยู่ ให้เอาไปบันทึกในตารางประวัติด้วย!
      if (noteText) {
        insertHistory.run(info.lastInsertRowid, null, handicap, noteText, 'SYSTEM_IMPORT');
        historyCount++;
      }
    });
  })();

  console.log('========================================');
  console.log(`✅ นำเข้าข้อมูลสมาชิกสำเร็จ: ${count} รายการ`);
  console.log(`✅ ค้นพบและบันทึกประวัติ Handicap จาก Note สำเร็จ: ${historyCount} รายการ`);
  console.log('========================================');
}

// สั่งรันการทำงาน
runImport().catch(err => console.error('❌ เกิดข้อผิดพลาด:', err));