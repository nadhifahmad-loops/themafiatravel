import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id?: string;
      phone?: string | null;
      role?: string;
      provider?: string | null;
      emailVerified?: boolean;
    } & DefaultSession['user'];
  }

  interface User {
    id?: string;
    phone?: string | null;
    role?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    phone?: string | null;
    role?: string;
    provider?: string | null;
    emailVerified?: boolean;
  }
}

export {};
