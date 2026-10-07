const { db } = require('./db');

const c = db.prepare('INSERT INTO courses (name,province) VALUES (?,?)')
            .run('สนามตัวอย่าง คันทรีคลับ','สมุทรปราการ').lastInsertRowid;

const par = [4,4,3,5,4,4,3,5,4, 4,3,5,4,4,3,4,5,4];
const idx = [7,3,15,1,11,5,17,9,13, 8,16,2,10,6,18,4,12,14];
const ih = db.prepare('INSERT INTO course_holes VALUES (?,?,?,?)');
par.forEach((p,i)=>ih.run(c,i+1,p,idx[i]));

const ev = db.prepare(`INSERT INTO events (name,event_date,course_id,fee_default)
                       VALUES (?,?,?,?)`)
  .run('ชิงถ้วยชมรมกอล์ฟราชวิทย์ ครั้งที่ 1/2568','2568-01-12',c,1500).lastInsertRowid;

const im = db.prepare(`INSERT INTO members
  (first_name,last_name,phone,birth_date,gender,alumni_type,alumni_batch,house,handicap)
  VALUES (?,?,?,?,?,?,?,?,?)`);
const data = [
  ['สมชาย','ใจดี','0811111111','1980-05-10','M','RAJAWIT','35','แดง',8],
  ['ธีรพงษ์','ศรีสุข','0812222222','1975-02-20','M','RAJAWIT','30','ฟ้า',6],
  ['ประเสริฐ','มั่นคง','0813333333','1978-08-01','M','RAJAWIT','32','เขียว',14],
  ['วิทยา','สุขใจ','0814444444','1985-11-11','M','RAJAWIT','40','เหลือง',16],
  ['อนันต์','พูนสุข','0815555555','1990-03-03','M','GUEST',null,null,21],
  ['ชูชาติ','เจริญ','0816666666','1960-01-15','M','RAJAWIT','20','แดง',12],
  ['มานพ','ทองดี','0817777777','1958-07-07','M','RAJAWIT','18','ฟ้า',18],
  ['สุดา','งามวงศ์','0818888888','1982-09-09','F','RAJAWIT','36','เขียว',22],
  ['ปราณี','มีสุข','0819999999','1979-04-04','F','GUEST',null,null,20],
  ['นงนุช','ศรีทอง','0820000000','1988-12-12','F','RAJAWIT','42','เหลือง',19],
  ['วรรณา','ใจงาม','0821111111','1984-06-06','F','GUEST',null,null,24],
  ['อารีย์','สว่าง','0822222222','1986-10-10','F','RAJAWIT','38','แดง',17]
];
data.forEach(d=>im.run(...d));
console.log(`สร้างข้อมูลตัวอย่างเรียบร้อย — รายการแข่งรหัส ${ev}, สมาชิก ${data.length} คน`);