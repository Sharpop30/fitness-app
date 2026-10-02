// Unit tests for the CORS of the Endpoint (security review 1, finding 6; stage 7 plan, task 10).
import { assertEquals } from "jsr:@std/assert@1";
import { corsFor } from "../cors.ts";

const SITE = "https://sharpop30.github.io/fitness-app/";
const allowOf = (origin: string | null, site: string | undefined = SITE) => corsFor(origin, site)["Access-Control-Allow-Origin"] ?? null;

Deno.test("the site's origin, and a development server on this computer, may read the reply", () => {
  assertEquals(allowOf("https://sharpop30.github.io"), "https://sharpop30.github.io");
  for (const dev of ["http://localhost:5174", "http://localhost:5175", "http://127.0.0.1:5174", "http://localhost"]) assertEquals(allowOf(dev), dev);
});

Deno.test("any other origin gets no Allow-Origin, and never a wildcard", () => {
  for (const other of ["https://evil.example", "https://sharpop30.github.io.evil.example", "http://sharpop30.github.io",
    "http://localhost.evil.example", "https://localhost:5174", "null", ""]) {
    assertEquals(allowOf(other), null, other);
  }
  assertEquals(allowOf(null), null);
  assertEquals(Object.values(corsFor("https://evil.example", SITE)).includes("*"), false);
});

Deno.test("with SITE_URL missing or not a URL, only the development servers are allowed", () => {
  const allow = (origin: string, site: string | undefined) => corsFor(origin, site)["Access-Control-Allow-Origin"] ?? null;
  assertEquals(allow("https://sharpop30.github.io", undefined), null);
  assertEquals(allow("https://sharpop30.github.io", "not a url"), null);
  assertEquals(allow("http://localhost:5174", undefined), "http://localhost:5174");
});

Deno.test("the reply varies by Origin, for caches", () => {
  assertEquals(corsFor("https://evil.example", SITE).Vary, "Origin");
});
