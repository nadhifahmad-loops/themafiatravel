import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const ADMIN_EMAIL    = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_NAME     = process.env.ADMIN_NAME || 'Admin TMT';

function requireAdminCredentials() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error(
      'ADMIN_EMAIL dan ADMIN_PASSWORD wajib disetel sebelum menjalankan seed. ' +
      'Lihat .env.example untuk referensi.'
    );
  }
}

async function main() {
  requireAdminCredentials();

  const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD!, 12);

  const admin = await prisma.user.upsert({
    where:  { email: ADMIN_EMAIL! },
    // Password TIDAK di-update pada seed ulang supaya admin yang sudah ada
    // tidak pernah ter-reset otomatis ke nilai seed.
    update: { role: 'admin', name: ADMIN_NAME },
    create: {
      email:    ADMIN_EMAIL!,
      name:     ADMIN_NAME,
      password: hashedPassword,
      role:     'admin',
    },
  });

  console.log('──────────────────────────────────────────');
  console.log('  Admin user ready!');
  console.log('──────────────────────────────────────────');
  console.log(`  Email    : ${admin.email}`);
  console.log(`  Role     : ${admin.role}`);
  console.log('  Password : (tersimpan, tidak ditampilkan)');
  console.log('──────────────────────────────────────────');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
