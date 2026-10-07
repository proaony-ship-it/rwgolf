const { db } = require('./db');

console.log('⏳ กำลังอัปเดตโครงสร้างฐานข้อมูล...');

// สั่งเพิ่มคอลัมน์ใหม่เข้าไปในตาราง members และ handicap_history
const queries = [
  'ALTER TABLE members ADD COLUMN member_code TEXT',
  'ALTER TABLE members ADD COLUMN title TEXT',
  'ALTER TABLE members ADD COLUMN privilege TEXT',
  'ALTER TABLE handicap_history ADD COLUMN event_id INTEGER',
  'ALTER TABLE handicap_history ADD COLUMN old_flight TEXT',
  'ALTER TABLE handicap_history ADD COLUMN new_flight TEXT'
];

let successCount = 0;
for (const sql of queries) {
  try {
    db.prepare(sql).run();
    successCount++;
  } catch (err) {
    // ถ้าคอลัมน์ไหนมีอยู่แล้วมันจะข้ามไป ไม่ต้องสนใจครับ
  }
}

// อัปเดต View สำหรับคำนวณถ้วยรางวัล
db.prepare('DROP VIEW IF EXISTS v_member_stats').run();
db.prepare(`
  CREATE VIEW v_member_stats AS
  SELECT 
    m.id AS member_id, 
    m.base_flight,
    COUNT(r.id) AS played_count,
    CASE 
      WHEN m.base_flight = 'A' THEN 1 
      WHEN COUNT(r.id) >= 2 THEN 1    
      ELSE 0                          
    END AS is_trophy_eligible
  FROM members m
  LEFT JOIN registrations r ON r.member_id = m.id AND r.checked_in = 1
  GROUP BY m.id
`).run();

console.log('✅ อัปเดตโครงสร้างฐานข้อมูลและตารางคำนวณถ้วยรางวัลเรียบร้อยแล้ว!');