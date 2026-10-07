const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'golfclub.db');
const db = new Database(DB_FILE);
db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

// สำรองข้อมูลอัตโนมัติ — เก็บ 30 ไฟล์ล่าสุด
function backup() {
  const dir = path.join(__dirname, 'backup');
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  db.backup(path.join(dir, `golfclub-${stamp}.db`)).then(() => {
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.db')).sort();
    while (files.length > 30) fs.unlinkSync(path.join(dir, files.shift()));
    console.log('สำรองข้อมูลเรียบร้อย:', stamp);
  }).catch(e => console.error('สำรองข้อมูลล้มเหลว:', e.message));
}

backup();                          // สำรองทันทีที่เปิดโปรแกรม
setInterval(backup, 60 * 60 * 1000); // และทุก 1 ชั่วโมง
process.on('SIGINT', () => { backup(); setTimeout(() => process.exit(0), 1500); });

function log(actor, action, target, detail) {
  db.prepare('INSERT INTO audit_log (actor,action,target,detail) VALUES (?,?,?,?)')
    .run(actor || 'system', action, String(target || ''), JSON.stringify(detail || {}));
}

module.exports = { db, backup, log };