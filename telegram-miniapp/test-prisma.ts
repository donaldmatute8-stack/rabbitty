import { createClient } from "@libsql/client";
try {
  const client = createClient({ url: "undefined" });
  console.log("Client created");
  await client.execute("SELECT 1");
} catch (e) {
  console.error("Error with undefined:", e);
}

try {
  const client2 = createClient({ url: "file:./dev.db" });
  console.log("Client2 created");
  await client2.execute("SELECT 1");
} catch (e) {
  console.error("Error with file:./dev.db:", e);
}
