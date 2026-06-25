/**
 * Migration: WordPress users + address book → PostgreSQL via Prisma
 * Run: node scripts/migrate-wp-data.mjs
 */
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
// Use Prisma client from the project
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const SQL_FILE    = 'c:\\Claude Code\\KDE Web\\backup_2026-06-16-db-utf8.sql';
const SHIPPER_CSV = 'c:\\Claude Code\\KDE Web\\wp-admin\\address-book-1748286730.csv';
const RECEIVER_CSV = 'c:\\Claude Code\\KDE Web\\wp-admin\\address-book-1772665281.csv';

const db = new PrismaClient();
const DEFAULT_PASS_HASH = await bcrypt.hash('KDExpress2024!', 10);

function decodeHtml(s) {
  return (s || '').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#039;/g,"'");
}
function generateUserCode() {
  const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({length:4}, () => c[Math.floor(Math.random()*c.length)]).join('');
}

// ── Parse wp_users ────────────────────────────────────────────────────────────
async function parseWpUsers() {
  console.log('Parsing wp_users…');
  const users = [];
  const rl = createInterface({ input: createReadStream(SQL_FILE, {encoding:'utf8'}), crlfDelay: Infinity });
  let inSection = false;

  for await (const line of rl) {
    if (line.includes('# Table: `wp_users`')) { inSection = true; continue; }
    if (inSection && line.startsWith('# Table:')) break;
    if (!inSection) continue;

    const t = line.trim();
    if (!t.match(/^\(\d+,/)) continue;

    // Tokenize the values row
    const row = t.replace(/[,;]$/, '').slice(1, -1); // strip outer parens
    const tokens = [];
    let i = 0, inStr = false, cur = '';
    while (i < row.length) {
      const ch = row[i];
      if (!inStr && ch === "'") { inStr = true; i++; continue; }
      if (inStr && ch === "'" && row[i+1] === "'") { cur += "'"; i += 2; continue; }
      if (inStr && ch === "'") { inStr = false; tokens.push(cur); cur = ''; i++; if (row[i]===',') i++; continue; }
      if (!inStr && ch === ',') { tokens.push(cur.trim()); cur = ''; i++; continue; }
      cur += ch; i++;
    }
    if (cur.trim()) tokens.push(cur.trim());

    if (tokens.length < 5) continue;
    const [idStr, login, passHash, , email, , , , , displayName] = tokens;
    const wpId = parseInt(idStr);
    if (!email?.includes('@')) continue;
    if (['wptaskforce','demobranch','democlient'].includes(login)) continue;

    users.push({
      wpId,
      email: email.trim().toLowerCase(),
      displayName: decodeHtml((displayName || login || '').trim()) || email,
      passHash: passHash.trim(),
    });
  }
  console.log(`  → ${users.length} users parsed`);
  return users;
}

// ── Parse CSV ─────────────────────────────────────────────────────────────────
function parseLine(line) {
  const out = []; let f = '', q = false;
  for (const c of line) {
    if (c === '"') { q = !q; continue; }
    if (c === ',' && !q) { out.push(f); f = ''; continue; }
    f += c;
  }
  out.push(f);
  return out.map(s => s.trim());
}

async function parseCsv(filePath, type) {
  const entries = [];
  const rl = createInterface({ input: createReadStream(filePath, {encoding:'utf8'}), crlfDelay: Infinity });
  let skip = true;
  for await (const line of rl) {
    if (skip) { skip = false; continue; }
    const f = parseLine(line);
    const wpUserId = parseInt(f[0]);
    if (!wpUserId) continue;
    const name = f[2]?.trim();
    if (!name || name.length < 2) continue;
    const address = f[3]?.trim() || '';
    const phone = f[4]?.trim() || '';
    const email = f[5]?.trim() || '';
    const country = /canada|ontario|\bbc\b|alberta|quebec|manitoba|burnaby|surrey|toronto|vancouver|winnipeg/i.test(address) ? 'CA'
                  : /usa|united states|california|new york/i.test(address) ? 'US' : 'VN';
    entries.push({ wpUserId, type, name, phone: phone || null, email: email || null, address: address || null, country });
  }
  console.log(`  → ${entries.length} ${type} entries`);
  return entries;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const wpUsers = await parseWpUsers();

  // Map email → existing user ID
  const existing = await db.user.findMany({ select: { id: true, email: true } });
  const byEmail = new Map(existing.map(u => [u.email.toLowerCase(), u.id]));
  console.log(`Existing users: ${existing.length}`);

  // ── Insert users ──
  let uInserted = 0, uSkipped = 0;
  const wpIdToNewId = new Map();

  // Pre-build set of existing user codes
  const existingCodes = new Set((await db.user.findMany({ select: { userCode: true } })).map(u => u.userCode).filter(Boolean));

  for (const u of wpUsers) {
    if (byEmail.has(u.email)) {
      wpIdToNewId.set(u.wpId, byEmail.get(u.email));
      uSkipped++;
      continue;
    }

    let passwordHash = u.passHash;
    if (passwordHash.startsWith('$wp$')) passwordHash = passwordHash.slice(4); // bcrypt-compatible
    else if (!passwordHash.startsWith('$2')) passwordHash = DEFAULT_PASS_HASH; // phpass → default

    let userCode;
    do { userCode = generateUserCode(); } while (existingCodes.has(userCode));
    existingCodes.add(userCode);

    try {
      const created = await db.user.create({
        data: { name: u.displayName, email: u.email, passwordHash, role: 'CLIENT', userCode, isActive: true },
        select: { id: true },
      });
      wpIdToNewId.set(u.wpId, created.id);
      byEmail.set(u.email, created.id);
      uInserted++;
      if (uInserted % 50 === 0) process.stdout.write(`  users: ${uInserted}…\r`);
    } catch {
      uSkipped++;
    }
  }
  console.log(`Users: ${uInserted} inserted, ${uSkipped} skipped/existing`);

  // ── Insert address book ──
  const shippers  = await parseCsv(SHIPPER_CSV,  'shipper');
  const receivers = await parseCsv(RECEIVER_CSV, 'receiver');
  let abInserted = 0, abSkipped = 0;

  for (const entry of [...shippers, ...receivers]) {
    const userId = wpIdToNewId.get(entry.wpUserId);
    if (!userId) { abSkipped++; continue; }

    try {
      await db.addressBook.create({
        data: { userId, type: entry.type, name: entry.name, phone: entry.phone, email: entry.email, address: entry.address, country: entry.country },
      });
      abInserted++;
      if (abInserted % 200 === 0) process.stdout.write(`  addresses: ${abInserted}…\r`);
    } catch {
      abSkipped++; // duplicate or constraint
    }
  }
  console.log(`Address book: ${abInserted} inserted, ${abSkipped} skipped`);

  await db.$disconnect();
  console.log('\n✓ Migration complete!');
}

main().catch(e => { console.error(e); process.exit(1); });
