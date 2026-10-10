/**
 * Make a MoorMove admin account (or turn an existing account into one):
 *   npm run create-admin -- --email you@example.com --name "Your Name" --phone 09171234567
 * The password is asked for on screen (it never goes in the command or a file).
 */
const readline = require('readline');
const bcrypt = require('bcryptjs');
const prisma = require('../src/lib/prisma');

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};

const askHidden = (question) => new Promise((resolve) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.stdoutMuted = true;
  rl._writeToOutput = (s) => { if (!rl.stdoutMuted || s.includes(question)) rl.output.write(s); };
  rl.question(question, (answer) => { rl.close(); process.stdout.write('\n'); resolve(answer); });
});

(async () => {
  const email = String(arg('email') || '').trim().toLowerCase();
  const fullName = String(arg('name') || '').trim();
  const phone = String(arg('phone') || '').trim();
  if (!email || !fullName || !phone) {
    console.error('Usage: npm run create-admin -- --email you@example.com --name "Your Name" --phone 09171234567');
    process.exit(1);
  }
  const password = await askHidden('Password (8+ characters): ');
  if (password.length < 8) {
    console.error('The password needs at least 8 characters.');
    process.exit(1);
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email },
    create: { email, fullName, phone, passwordHash, role: 'ADMIN' },
    update: { fullName, phone, passwordHash, role: 'ADMIN', isActive: true },
  });
  console.log(`Admin ready: ${user.email}`);
  await prisma.$disconnect();
})().catch(async (err) => {
  console.error(err.message);
  await prisma.$disconnect();
  process.exit(1);
});
