import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.NODE_ENV === "development" ? "file:./dev.db" : (process.env.DATABASE_URL || "file:./dev.db"),
  },
});
