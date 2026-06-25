import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const db = new PrismaClient();
const hash = await bcrypt.hash('KDExpress2024!', 10);
try {
  const r = await db.user.create({
    data: { name: 'Test Migration', email: 'testmigrate888@test.com', password: hash, role: 'CLIENT', userCode: 'TM88', isActive: true },
    select: { id: true, email: true }
  });
  console.log('OK:', JSON.stringify(r));
} catch(e) {
  console.error('FAIL:', e.message);
}
await db.$disconnect();
