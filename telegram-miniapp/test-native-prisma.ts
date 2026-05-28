import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: "file:./dev.db",
      },
    },
  });
  console.log("Connecting...");
  const users = await prisma.user.findMany();
  console.log("Users:", users.length);
}

main().catch(console.error);
