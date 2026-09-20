import { NextAuthOptions } from 'next-auth';
import type { DefaultSession } from 'next-auth';
import { getToken } from 'next-auth/jwt';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import type { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma';
import { checkRateLimit } from './rate-limit';
import { normalizeEmail, getRequestIp } from './security';
import { verifyTwoFactorBackupCode, verifyTwoFactorCode, consumeBackupCode } from './two-factor';

type ExtendedSessionUser = DefaultSession['user'] & {
  id?: string;
  phone?: string | null;
  provider?: string | null;
  role?: string;
  emailVerified?: boolean;
};

const isProd = process.env.NODE_ENV === 'production';

export const authOptions: NextAuthOptions = {
  // Adapter Prisma agar user dari Google otomatis masuk ke Database
  adapter: PrismaAdapter(prisma),

  providers: [
    // Provider Google — `allowDangerousEmailAccountLinking` DIHAPUS.
    // Nilai `true` memungkinkan akun email yang sama dibajak lewat OAuth (account takeover).
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    }),

    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        code: { label: 'Code', type: 'text' },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = normalizeEmail(credentials.email);
        const ip = getRequestIp(req?.headers);

        // Rate limit percobaan login — cegah brute force.
        // Kombinasi IP + email, plus batas global per IP.
        const perAccount = await checkRateLimit(`login:${ip}:${email}`, 'login');
        if (!perAccount.allowed) return null;
        const perIp = await checkRateLimit(`login-ip:${ip}`, 'loginIp');
        if (!perIp.allowed) return null;

        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            password: true,
            twoFactorEnabled: true,
            twoFactorSecret: true,
            twoFactorBackupCodes: true,
          },
        });
        if (!user || !user.password) return null;

        const valid = await bcrypt.compare(credentials.password, user.password);
        if (!valid) return null;

        if (user.twoFactorEnabled && user.twoFactorSecret) {
          const code = typeof credentials.code === 'string' ? credentials.code : '';
          if (!code) {
            throw new Error('2FA_REQUIRED');
          }

          const backupCodes = Array.isArray(user.twoFactorBackupCodes) ? user.twoFactorBackupCodes as string[] : [];
          const validBackup = verifyTwoFactorBackupCode(backupCodes, code);
          const validCode = verifyTwoFactorCode(user.twoFactorSecret, code);

          if (!validCode && !validBackup) {
            throw new Error('INVALID_2FA');
          }

          if (validBackup) {
            const remainingCodes = consumeBackupCode(backupCodes, code);
            await prisma.user.update({
              where: { id: user.id },
              data: { twoFactorBackupCodes: remainingCodes },
            });
          }
        }

        return { id: user.id, name: user.name, email: user.email, image: user.image };
      },
    }),
  ],

  session: {
    strategy: 'jwt',
    // Sesi berdasarkan WAKTU AKTIF (idle timeout):
    //  - maxAge  : batas waktu tanpa aktivitas. Setelah ini, pengguna harus login ulang
    //              (misal: buka website besok → login lagi).
    //  - updateAge: interval rolling/refresh. Selama pengguna masih aktif, sesi di-refresh
    //              sehingga TIDAK logout di tengah-tengah browsing.
    maxAge: 30 * 60,
    updateAge: 5 * 60,
  },

  pages: {
    signIn: '/login',
  },

  cookies: {
    sessionToken: {
      name: isProd ? `__Secure-next-auth.session-token` : `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: isProd,
      },
    },
    callbackUrl: {
      name: isProd ? `__Secure-next-auth.callback-url` : `next-auth.callback-url`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: isProd,
      },
    },
    csrfToken: {
      name: isProd ? `__Host-next-auth.csrf-token` : `next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: isProd,
      },
    },
  },

  callbacks: {
    async signIn({ user, account, profile }) {
      // Simpan foto profil dari Google jika login via Google
      if (account?.provider === 'google' && user?.id) {
        const googleImage = (profile as any)?.picture || (profile as any)?.image;
        if (googleImage) {
          await prisma.user.update({
            where: { id: user.id },
            data: { image: googleImage },
          }).catch(() => {});
        }
      }
      return true;
    },

    async jwt({ token, user, account, profile }) {
      // Saat pertama kali sign-in, simpan identitas dasar.
      if (user) {
        token.id = user.id;
        token.provider = account?.provider ?? 'credentials';
      }

      // Simpan foto dari Google saat login pertama kali
      if (account?.provider === 'google' && profile && typeof token.id === 'string') {
        const googleImage = (profile as any)?.picture || (profile as any)?.image;
        if (googleImage) {
          await prisma.user.update({
            where: { id: token.id },
            data: { image: googleImage },
          }).catch(() => {});
        }
      }

      // Validasi ulang ke database setiap request:
      //  - Role selalu fresh (perubahan role langsung berlaku).
      //  - Jika user sudah dihapus, sesi langsung dibatalkan (invalidated).
      if (typeof token.id === 'string') {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id },
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            phone: true,
            role: true,
            emailVerified: true,
            twoFactorEnabled: true,
            twoFactorSecret: true,
            twoFactorBackupCodes: true,
          },
        });

        // User dihapus / tidak ditemukan → kosongkan token agar dianggap tidak login.
        if (!dbUser) return {};

        token.id = dbUser.id;
        token.name = dbUser.name;
        token.email = dbUser.email;
        token.image = dbUser.image;
        token.phone = dbUser.phone;
        token.role = dbUser.role;
        token.emailVerified = !!dbUser.emailVerified;
        token.twoFactorEnabled = !!dbUser.twoFactorEnabled;
        token.twoFactorSecret = dbUser.twoFactorSecret ?? undefined;
      }

      return token;
    },

    async session({ session, token }) {
      const user = session.user as ExtendedSessionUser;

      // Token valid → isi user dari token (data terbaru sudah di-refresh di callback jwt).
      if (token?.id) {
        user.id = typeof token.id === 'string' ? token.id : undefined;
        user.role = typeof token.role === 'string' ? token.role : 'user';
        user.phone = typeof token.phone === 'string' ? token.phone : null;
        user.image = typeof token.image === 'string' ? token.image : null;
        user.provider = typeof token.provider === 'string' ? token.provider : 'credentials';
        user.emailVerified = !!token.emailVerified;
      }

      return session;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
};

// Register helper
export async function registerUser(name: string, email: string, password: string, phone?: string) {
  const normalizedEmail = normalizeEmail(email);

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (existingUser) {
    throw new Error('Email sudah terdaftar');
  }

  const hashed = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      name,
      email: normalizedEmail,
      password: hashed,
      phone,
    },
  });
  return { id: user.id, name: user.name, email: user.email };
}

/**
 * Drop-in replacement for `getServerSession(authOptions)` that reads the JWT
 * directly from request cookies via `getToken`. This avoids the internal
 * `fetch('/api/auth/session')` call made by `getServerSession`, which breaks
 * in Next.js 16 (returns HTML instead of JSON — CLIENT_FETCH_ERROR).
 */
export async function getSession(req: NextRequest) {
  const token = await getToken({
    req: req as any,
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie: process.env.NODE_ENV === 'production',
  });

  if (!token) return null;

  // Fetch fresh user data from DB (same as the jwt callback does)
  if (typeof token.id === 'string') {
    const dbUser = await prisma.user.findUnique({
      where: { id: token.id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        phone: true,
        role: true,
      },
    });
    if (!dbUser) return null;

    return {
      user: {
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        image: dbUser.image,
        phone: dbUser.phone,
        role: dbUser.role,
      },
    };
  }

  return { user: { id: token.sub, name: token.name, email: token.email } };
}
