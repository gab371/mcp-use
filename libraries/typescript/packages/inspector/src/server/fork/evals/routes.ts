import { Hono } from "hono";
import { EvalsStorage } from "./storage";
import { forwardRunToSplunk } from "./splunk";
import type { RunResult } from "@/client/fork/evals/engine/verdict";

export function createEvalRoutes(storage: EvalsStorage = new EvalsStorage()): Hono {
  const router = new Hono();

  // List suites
  router.get("/suites", async (c) => {
    const suites = await storage.listSuites();
    return c.json({ suites });
  });

  // Get suite by id (or golden file: /suites/:id/golden/:file)
  router.get("/suites/:id{.+}", async (c) => {
    const rawId = c.req.param("id");

    if (rawId.includes("/golden/")) {
      const idx = rawId.indexOf("/golden/");
      const suiteId = rawId.slice(0, idx);
      const relPath = rawId.slice(idx + 1); // "golden/..."
      const content = await storage.getGoldenFile(suiteId, relPath);
      if (content === null) {
        return c.json({ error: "Golden file not found" }, 404);
      }
      return c.text(content);
    }

    const detail = await storage.getSuiteDetail(rawId);
    if (!detail) {
      return c.json({ error: "Suite not found" }, 404);
    }
    return c.json(detail);
  });

  // Save suite draft by id or golden file
  router.put("/suites/:id{.+}", async (c) => {
    const rawId = c.req.param("id");

    if (rawId.includes("/golden/")) {
      const idx = rawId.indexOf("/golden/");
      const suiteId = rawId.slice(0, idx);
      const relPath = rawId.slice(idx + 1); // "golden/..."
      const body = await c.req.json<{ content: string }>().catch(() => null);
      if (!body || typeof body.content !== "string") {
        return c.json({ error: "Missing content in request body" }, 400);
      }
      try {
        await storage.saveGoldenFile(suiteId, relPath, body.content);
        return c.json({ ok: true, file: relPath });
      } catch (err: unknown) {
        return c.json({ error: err instanceof Error ? err.message : String(err) }, 500);
      }
    }

    const body = await c.req.json<{ yaml: string }>().catch(() => null);
    if (!body || typeof body.yaml !== "string") {
      return c.json({ error: "Missing yaml in request body" }, 400);
    }
    await storage.saveSuite(rawId, body.yaml);
    return c.json({ ok: true, id: rawId });
  });

  // Delete golden file
  router.delete("/suites/:id{.+}", async (c) => {
    const rawId = c.req.param("id");
    if (rawId.includes("/golden/")) {
      const idx = rawId.indexOf("/golden/");
      const suiteId = rawId.slice(0, idx);
      const relPath = rawId.slice(idx + 1);
      try {
        await storage.deleteGoldenFile(suiteId, relPath);
        return c.json({ ok: true, deleted: relPath });
      } catch (err: unknown) {
        return c.json({ error: err instanceof Error ? err.message : String(err) }, 500);
      }
    }
    return c.json({ error: "Deletion not supported for this resource" }, 400);
  });

  // List runs
  router.get("/runs", async (c) => {
    const runs = await storage.listRuns();
    return c.json({ runs });
  });

  // Get run detail by id
  router.get("/runs/:id", async (c) => {
    const id = c.req.param("id");
    const run = await storage.getRun(id);
    if (!run) {
      return c.json({ error: "Run not found" }, 404);
    }
    return c.json({ run });
  });

  // Save completed run
  router.post("/runs", async (c) => {
    const body = await c.req.json<RunResult>();
    if (!body || !body.id) {
      return c.json({ error: "Invalid run payload" }, 400);
    }
    await storage.saveRun(body);

    // Forward to Splunk if configured (async fire-and-forget)
    forwardRunToSplunk(body).catch((err) => {
      console.warn("[Evals] Splunk forward error:", err);
    });

    return c.json({ ok: true, id: body.id });
  });

  return router;
}

/**
 * Mounts the eval routes onto a Hono application instance at basePath.
 */
export function mountEvalRoutes(app: Hono, basePath = ""): void {
  const router = createEvalRoutes();
  const mountPrefix = `${basePath}/inspector/api/fork/evals`;
  app.route(mountPrefix, router);
}
