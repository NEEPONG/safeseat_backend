// สคริปต์สร้าง bcrypt hash สำหรับรหัสผ่านของ Mock Data
// รันด้วย: node hash_passwords.js

const bcrypt = require('bcrypt');

// ใส่รหัสผ่านของแต่ละบัญชีที่ต้องการ hash ที่นี่ ---
const passwords = [
  { username: 'test1',     password: 'test01' },
  { username: 'test123123', password: 'test_123' },
  { username: 'test1234',  password: 'test_1234' },
  { username: 'test2',     password: 'test2' },
  { username: 'test33333', password: 'test_33333' },
  { username: 'test45678', password: 'test_45678' },
];

async function hashAll() {
  for (const item of passwords) {
    const hash = await bcrypt.hash(item.password, 10);
    console.log(`\n-- username: ${item.username}`);
    console.log(`UPDATE pub SET password = '${hash}' WHERE username = '${item.username}';`);
  }
  console.log('\n-- คัดลอก SQL ด้านบนไปรันใน Supabase SQL Editor ได้เลยครับ');
}

hashAll();
