import { db } from "./src/db";
import { users } from "./src/db/schema";
import { eq } from "drizzle-orm";

async function run() {
  try {
    console.log("Querying first user...");
    const profile = await db.query.users.findFirst({
      where: eq(users.telegramId, "162613929"),
    });
    console.log("Success! Profile:", profile);
  } catch (err) {
    console.error("Drizzle query failed:", err);
  }
}

run();
