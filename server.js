const express = require('express');
const path    = require('path');
const os      = require('os');
const { db }  = require('./db');

const app  = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const q   = (sql, ...p) => db.prepare(sql).all(...p);
const q1  = (sql, ...p) => db.prepare(sql).get(...p);
const run = (sql, ...p) => db.prepare(sql).run(...p);

function log(actor, action, target_id, detail) {
  try { run(`INSERT INTO audit_logs (actor, action, target_id, detail) VALUES (?, ?, ?, ?)`, actor || 'system', action, target_id || null, JSON.stringify(detail || {})); } catch(e) {}
}

/* =========================================
   1. API สมาชิก (Members & Profile Updates)
========================================= */
app.get('/api/members', (req, res) => {
  try {
    const s = `%${(req.query.q || '').trim()}%`;
    const rows = q(`
      SELECT m.*, 
             IFNULL(v.played_count, 0) AS played_count, 
             IFNULL(v.is_trophy_eligible, 0) AS is_trophy_eligible
      FROM members m 
      LEFT JOIN v_member_stats v ON v.member_id = m.id
      WHERE m.status = 'ACTIVE' 
        AND (m.first_name LIKE ? OR m.last_name LIKE ? OR IFNULL(m.nickname, '') LIKE ? OR IFNULL(m.member_code, '') LIKE ?)
      ORDER BY m.first_name ASC LIMIT 200
    `, s, s, s, s);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/members', (req, res) => {
  const b = { nickname:null, phone:null, email:null, birth_date:null, gender:'M', alumni_type:'RAJAWIT', alumni_batch:null, house:null, handicap:24, base_flight:null, note:null, ...req.body };
  if (!b.first_name || !b.last_name) return res.status(400).json({ error:'ต้องมีชื่อและนามสกุล' });
  try {
    const info = run(`INSERT INTO members (first_name,last_name,nickname,phone,email,birth_date,gender,alumni_type,alumni_batch,house,handicap,base_flight,note)
      VALUES (@first_name,@last_name,@nickname,@phone,@email,@birth_date,@gender,@alumni_type,@alumni_batch,@house,@handicap,@base_flight,@note)`, b);
    res.json({ id: info.lastInsertRowid });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/members/:id', (req, res) => {
  const m = req.body;
  try {
    run(`
      UPDATE members 
      SET first_name = @first_name, last_name = @last_name, nickname = @nickname, 
          birth_date = @birth_date, gender = @gender, alumni_type = @alumni_type, 
          alumni_batch = @alumni_batch, house = @house, phone = @phone, email = @email,
          handicap = @handicap, base_flight = @base_flight, note = @note 
      WHERE id = @id
    `, {
      id: req.params.id,
      first_name: m.first_name || '', last_name: m.last_name || '', nickname: m.nickname || null,
      birth_date: m.birth_date || null, gender: m.gender || 'M', alumni_type: m.alumni_type || 'RAJAWIT',
      alumni_batch: m.alumni_batch || null, house: m.house || null, phone: m.phone || null, email: m.email || null,
      handicap: m.handicap !== undefined ? Number(m.handicap) : 24, base_flight: m.base_flight || 'C', note: m.note || null
    });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/members/:id', (req, res) => {
  try { run("UPDATE members SET status='INACTIVE' WHERE id=?", req.params.id); res.json({ ok: true }); } catch (err) { res.status(500).json({ error: err.message }); }
});

/* =========================================
   2. API สนามกอล์ฟ (Courses & Holes)
========================================= */
app.get('/api/courses', (_, res) => {
  try {
    const courses = q('SELECT * FROM courses ORDER BY id DESC');
    courses.forEach(c => {
      c.combos = q('SELECT * FROM course_combos WHERE course_id=? ORDER BY id', c.id);
      c.combos.forEach(cb => { cb.holes = q('SELECT * FROM course_holes WHERE combo_id=? ORDER BY hole_no', cb.id); });
    });
    res.json(courses);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* =========================================
   3. API รายการแข่งขัน (Events) & ลงทะเบียน
========================================= */
app.get('/api/events', (_, res) => {
  try {
    const rows = q(`
      SELECT e.*, c.name AS course_name, 
        (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id) AS reg_count, 
        (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.checked_in = 1) AS checkin_count 
      FROM events e 
      LEFT JOIN courses c ON c.id = e.course_id 
      ORDER BY e.event_date DESC, e.id DESC
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/events/:id/registrations', (req, res) => {
  try {
    const rows = q(`
      SELECT r.*, m.first_name, m.last_name, m.nickname, m.gender, m.handicap, m.alumni_type, m.alumni_batch, m.house, m.phone 
      FROM registrations r 
      JOIN members m ON m.id = r.member_id 
      WHERE r.event_id = ? 
      ORDER BY r.checked_in DESC, m.first_name ASC
    `, req.params.id);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* =========================================
   4. API คะแนน (Score Entry & Leaderboard)
========================================= */
app.get('/api/registrations/:id/scores', (req, res) => {
  try {
    const scores = q('SELECT hole_no, strokes FROM scores WHERE registration_id = ? ORDER BY hole_no', req.params.id);
    res.json(scores);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/registrations/:id/scores', (req, res) => {
  const regId = req.params.id;
  const { scores, submitted_by } = req.body;
  try {
    db.transaction(() => {
      const stmt = db.prepare('INSERT INTO scores (registration_id, hole_no, strokes) VALUES (?, ?, ?) ON CONFLICT(registration_id, hole_no) DO UPDATE SET strokes = ?');
      for (const s of scores) {
        let st = Number(s.strokes) || 0;
        stmt.run(regId, s.hole_no, st, st);
      }
      run("UPDATE registrations SET score_status = 'SUBMITTED', submitted_by = ? WHERE id = ?", submitted_by || 'Committee', regId);
    })();
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/events/:id/missing-scores', (req, res) => {
  try {
    const rows = q(`
      SELECT r.id, m.first_name, m.last_name, m.nickname, m.phone, r.score_status
      FROM registrations r
      JOIN members m ON m.id = r.member_id
      WHERE r.event_id = ? AND r.checked_in = 1 AND (r.score_status = 'PENDING' OR r.score_status IS NULL)
      ORDER BY m.first_name ASC
    `, req.params.id);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ============ เริ่มทำงานเซิร์ฟเวอร์ ============ */
function lanIPs() { return Object.values(os.networkInterfaces()).flat().filter(i => i && i.family === 'IPv4' && !i.internal).map(i => i.address); }
app.listen(PORT, '0.0.0.0', () => {
  console.log('\n===================================================\n  ระบบจัดการแข่งขันกอล์ฟ พร้อมใช้งานแล้ว\n---------------------------------------------------');
  lanIPs().forEach(ip => console.log('  เข้าใช้งาน :  http://' + ip + ':' + PORT));
  console.log('===================================================\n');
});
/* =========================================
   5. API โปรไฟล์สมาชิก (Profile Self-Service)
========================================= */
// ดึงข้อมูลสมาชิกรายคน พร้อมประวัติการแข่งและสิทธิถ้วยรางวัล
app.get('/api/profile/:id', (req, res) => {
  try {
    const memberId = req.params.id;
    const member = q1(`
      SELECT m.*, 
             IFNULL(v.played_count, 0) AS played_count, 
             IFNULL(v.is_trophy_eligible, 0) AS is_trophy_eligible
      FROM members m 
      LEFT JOIN v_member_stats v ON v.member_id = m.id
      WHERE m.id = ?
    `, memberId);

    if (!member) return res.status(404).json({ error: 'ไม่พบข้อมูลสมาชิก' });

    // ดึงประวัติการแข่งขันย้อนหลังของสมาชิกคนนี้
    const history = q(`
      SELECT e.name AS event_name, e.event_date, r.flight, r.hdcp_used, res.gross, res.net
      FROM registrations r
      JOIN events e ON e.id = r.event_id
      LEFT JOIN results res ON res.registration_id = r.id
      WHERE r.member_id = ? AND r.checked_in = 1
      ORDER BY e.event_date DESC
    `, memberId);

    res.json({ member, history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// สมาชิกบันทึกแก้ไขข้อมูลส่วนตัว (เบอร์โทร, อีเมล, ชื่อเล่น, วันเกิด)
app.put('/api/profile/:id', (req, res) => {
  const memberId = req.params.id;
  const { nickname, phone, email, birth_date } = req.body;
  try {
    run(`
      UPDATE members 
      SET nickname = ?, phone = ?, email = ?, birth_date = ?
      WHERE id = ?
    `, nickname || null, phone || null, email || null, birth_date || null, memberId);
    
    res.json({ ok: true, message: 'บันทึกข้อมูลเรียบร้อยแล้ว' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});