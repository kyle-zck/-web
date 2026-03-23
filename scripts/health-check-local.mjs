#!/usr/bin/env node
/**
 * Local health check:
 * - verifies key endpoints are reachable
 * - prints latency and pass/fail by threshold
 */

const baseUrl = process.env.HEALTH_BASE_URL || "http://localhost:3000";
const checks = [
  { name: "home", path: "/", warnMs: 2500 },
  { name: "api_app_config", path: "/api/app-config", warnMs: 2500 },
  { name: "api_series_lite", path: "/api/series?lite=1", warnMs: 2500 }
];

async function timedFetch(url) {
  const started = Date.now();
  const res = await fetch(url, { redirect: "follow" });
  const elapsedMs = Date.now() - started;
  return { ok: res.ok, status: res.status, elapsedMs };
}

async function main() {
  let failCount = 0;
  console.log(`Health check base: ${baseUrl}`);
  for (const c of checks) {
    try {
      const r = await timedFetch(`${baseUrl}${c.path}`);
      const slow = r.elapsedMs > c.warnMs;
      const icon = !r.ok ? "FAIL" : slow ? "WARN" : "PASS";
      if (!r.ok) failCount += 1;
      console.log(
        `${icon} ${c.name} status=${r.status} time=${r.elapsedMs}ms threshold=${c.warnMs}ms`
      );
    } catch (e) {
      failCount += 1;
      console.log(`FAIL ${c.name} error=${e instanceof Error ? e.message : String(e)}`);
    }
  }
  if (failCount > 0) process.exit(1);
}

main();
