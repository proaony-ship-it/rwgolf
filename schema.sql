-- 1. ตารางสมาชิก (Members)
CREATE TABLE IF NOT EXISTS members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  nickname TEXT,
  phone TEXT,
  email TEXT,
  birth_date DATE,
  gender TEXT DEFAULT 'M',
  alumni_type TEXT DEFAULT 'RAJAWIT',
  alumni_batch TEXT,
  house TEXT,
  handicap REAL DEFAULT 24,
  base_flight TEXT,
  status TEXT DEFAULT 'ACTIVE',
  note TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. ประวัติการปรับเปลี่ยน Handicap
CREATE TABLE IF NOT EXISTS handicap_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER NOT NULL,
  old_hdcp REAL,
  new_hdcp REAL,
  reason TEXT,
  changed_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
);

-- 3. ตารางสนามกอล์ฟ (Courses)
CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  province TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. ตารางคอร์สย่อย/วน (Course Combos)
CREATE TABLE IF NOT EXISTS course_combos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL,
  combo_name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

-- 5. ตารางหลุมกอล์ฟ (Course Holes - 9 หลุม พร้อม Par, SI, และระยะหมุด)
CREATE TABLE IF NOT EXISTS course_holes (
  combo_id INTEGER NOT NULL,
  hole_no INTEGER NOT NULL,
  par INTEGER NOT NULL DEFAULT 4,
  stroke_index INTEGER NOT NULL DEFAULT 1,
  dist_black INTEGER DEFAULT 0,
  dist_blue INTEGER DEFAULT 0,
  dist_white INTEGER DEFAULT 0,
  dist_red INTEGER DEFAULT 0,
  PRIMARY KEY (combo_id, hole_no),
  FOREIGN KEY (combo_id) REFERENCES course_combos(id) ON DELETE CASCADE
);

-- 6. ตารางรายการแข่งขัน (Events)
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  event_date DATE NOT NULL,
  course_id INTEGER NOT NULL,
  out_combo_id INTEGER,
  in_combo_id INTEGER,
  tee_box TEXT DEFAULT 'Blue',
  scoring_mode TEXT DEFAULT 'NET_STROKE',
  fee_default REAL DEFAULT 0,
  lady_min INTEGER DEFAULT 5,
  status TEXT DEFAULT 'OPEN',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id)
);

-- 7. ตารางการลงทะเบียน / เช็กอิน (Registrations - รองรับบันทึกผู้จ่ายแทนและสถานะสกอร์)
CREATE TABLE IF NOT EXISTS registrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  member_id INTEGER NOT NULL,
  hdcp_used REAL,
  flight TEXT,
  secondary_flight TEXT,
  declared_flight_a INTEGER DEFAULT 0,
  played_before INTEGER DEFAULT 0,
  fee_amount REAL DEFAULT 0,
  checked_in INTEGER DEFAULT 0,
  pay_method TEXT DEFAULT 'CASH',
  pay_ref TEXT,
  paid_at DATETIME,
  paid_by_name TEXT,
  sticker_printed INTEGER DEFAULT 0,
  score_status TEXT DEFAULT 'PENDING', -- PENDING, SUBMITTED, VERIFIED
  submitted_by TEXT,                  -- บันทึกว่าใครเป็นคนกรอกสกอร์ (Self หรือ Committee)
  status TEXT DEFAULT 'REGISTERED',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(event_id, member_id),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
);

-- 8. ตารางคะแนนรายหลุม (Scores - 1 ถึง 18 หลุม)
CREATE TABLE IF NOT EXISTS scores (
  registration_id INTEGER NOT NULL,
  hole_no INTEGER NOT NULL,
  strokes INTEGER DEFAULT 0,
  putts INTEGER DEFAULT 0,
  PRIMARY KEY (registration_id, hole_no),
  FOREIGN KEY (registration_id) REFERENCES registrations(id) ON DELETE CASCADE
);

-- 9. ตารางผลการแข่งขัน (Results)
CREATE TABLE IF NOT EXISTS results (
  registration_id INTEGER PRIMARY KEY,
  gross INTEGER,
  net REAL,
  stableford INTEGER,
  s36_hdcp REAL,
  cb_last9 INTEGER,
  cb_last6 INTEGER,
  cb_last3 INTEGER,
  cb_hole18 INTEGER,
  rank_in_flight INTEGER,
  trophy_eligible INTEGER DEFAULT 1,
  trophy_note TEXT,
  trophy_awarded TEXT,
  FOREIGN KEY (registration_id) REFERENCES registrations(id) ON DELETE CASCADE
);

-- 10. Audit Logs (เก็บประวัติการทำงานของระบบ)
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor TEXT,
  action TEXT,
  target_id INTEGER,
  detail TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 11. View นับรอบที่เคยเข้าแข่งสะสม (v_played_count)
DROP VIEW IF EXISTS v_played_count;
CREATE VIEW v_played_count AS
SELECT 
  member_id, 
  COUNT(DISTINCT event_id) AS played_lifetime,
  COUNT(DISTINCT event_id) AS played_count
FROM registrations
WHERE checked_in = 1
GROUP BY member_id;