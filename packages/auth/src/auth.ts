import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import Credentials from "next-auth/providers/credentials";

const tokens = new Map<string, { token: string; expires: Date }>();
const users = new Map<string, { id: string; email: string; emailVerified: Date | null }>();

const customAdapter: any = {
  createUser: async (user: any) => {
    const newUser = { ...user, id: user.id || Math.random().toString(), emailVerified: user.emailVerified || null };
    users.set(newUser.email, newUser);
    return newUser;
  },
  getUser: async (id: string) => {
    for (const user of users.values()) {
      if (user.id === id) return user;
    }
    return null;
  },
  getUserByEmail: async (email: string) => {
    return users.get(email) || { id: email, email, emailVerified: new Date() };
  },
  getUserByAccount: async () => null,
  createVerificationToken: async (verificationToken: any) => {
    tokens.set(`${verificationToken.identifier}:${verificationToken.token}`, {
      token: verificationToken.token,
      expires: verificationToken.expires,
    });
    return verificationToken;
  },
  useVerificationToken: async ({ identifier, token }: any) => {
    const key = `${identifier}:${token}`;
    const stored = tokens.get(key);
    if (stored) {
      tokens.delete(key);
      return { identifier, token, expires: stored.expires };
    }
    return null;
  },
};

const authResult = NextAuth({
  adapter: customAdapter,
  providers: [
    Resend({
      from: process.env.AUTH_RESEND_FROM!,
    }),
    ...(process.env.E2E_TEST || process.env.NODE_ENV === "development" ? [
      Credentials({
        id: "test-e2e",
        name: "E2E Test",
        credentials: {
          password: { label: "Password", type: "password" },
        },
        async authorize(credentials) {
          if (credentials?.password === "test") {
            return { id: "e2e-test-user", name: "E2E Tester", email: "e2e@test.me" };
          }
          return null;
        },
      }),
    ] : []),
    Credentials({
      id: "telegram",
      name: "Telegram",
      credentials: {
        id: { label: "Telegram ID", type: "text" },
        username: { label: "Username", type: "text" },
        firstName: { label: "First Name", type: "text" },
        lastName: { label: "Last Name", type: "text" },
        photoUrl: { label: "Photo URL", type: "text" },
        authDate: { label: "Auth Date", type: "text" },
        hash: { label: "Hash", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.id || !credentials?.hash) return null;
        return {
          id: credentials.id as string,
          name: [credentials.firstName, credentials.lastName].filter(Boolean).join(" "),
          email: `${credentials.id}@telegram.rabbitty`,
          image: (credentials.photoUrl as string) ?? undefined,
        };
      },
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
    async jwt({ token }) {
      return token;
    },
  },
}) as any;

export const auth = authResult.auth;
export const handlers = authResult.handlers;
export const signIn = authResult.signIn;
export const signOut = authResult.signOut;
