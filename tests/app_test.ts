// Basic tests for mklv.tech warming service
import { assertEquals } from "@std/assert";
import { app } from "../src/app.ts";

Deno.test("health endpoint returns OK", async () => {
  const req = new Request("http://localhost/health");
  const res = await app.fetch(req);

  assertEquals(res.status, 200);
  assertEquals(await res.text(), "OK");
});

Deno.test("root serves index.html", async () => {
  const req = new Request("http://localhost/");
  const res = await app.fetch(req);

  assertEquals(res.status, 200);
  const text = await res.text();
  assertEquals(text.includes("mklv.tech"), true);
});
