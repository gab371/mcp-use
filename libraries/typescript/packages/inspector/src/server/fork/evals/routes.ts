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

  // Get suite by id
  router.get("/suites/:id", async (c) => {
    const id = c.req.param("id");
    const yaml = await storage.getSuite(id);
    if (yaml === null) {
      return c.json({ error: "Suite not found" }, 404);
    }
    return c.json({ id, yaml });
  });

  // Save suite draft by id
  router.put("/suites/:id", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json<{ yaml: string }>();
    if (!body || typeof body.yaml !== "string") {
      return c.json({ error: "Missing yaml in request body" }, 400);
    }
    await storage.saveSuite(id, body.yaml);
    return c.json({ ok: true, id });
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
