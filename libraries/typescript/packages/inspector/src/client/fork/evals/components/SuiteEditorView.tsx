import React, { useState, useEffect } from "react";
import { parseSuiteYaml, type EvalSuite } from "../engine/suite";

interface SuiteMeta {
  id: string;
  name: string;
  yaml: string;
  caseCount: number;
}

export function SuiteEditorView({
  onSelectSuite,
}: {
  onSelectSuite?: (suite: EvalSuite, yaml: string) => void;
}) {
  const [suites, setSuites] = useState<SuiteMeta[]>([]);
  const [selectedSuiteId, setSelectedSuiteId] = useState<string>("");
  const [yamlContent, setYamlContent] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const parsed = parseSuiteYaml(yamlContent);

  const fetchSuites = async () => {
    try {
      const res = await fetch("/inspector/api/fork/evals/suites");
      if (res.ok) {
        const data = await res.json();
        setSuites(data.suites || []);
        if (data.suites?.length > 0 && !selectedSuiteId) {
          setSelectedSuiteId(data.suites[0].id);
          setYamlContent(data.suites[0].yaml);
        }
      }
    } catch (e) {
      console.warn("Failed to fetch suites:", e);
    }
  };

  useEffect(() => {
    fetchSuites();
  }, []);

  const handleSelect = (id: string) => {
    setSelectedSuiteId(id);
    const suite = suites.find((s) => s.id === id);
    if (suite) {
      setYamlContent(suite.yaml);
    }
  };

  const handleSave = async () => {
    if (!selectedSuiteId || !yamlContent) return;
    setIsSaving(true);
    setSaveStatus(null);
    try {
      const res = await fetch(`/inspector/api/fork/evals/suites/${selectedSuiteId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yaml: yamlContent }),
      });
      if (res.ok) {
        setSaveStatus("Saved successfully!");
        setTimeout(() => setSaveStatus(null), 3000);
        fetchSuites();
        if (parsed.success && parsed.suite && onSelectSuite) {
          onSelectSuite(parsed.suite, yamlContent);
        }
      } else {
        setSaveStatus("Failed to save suite.");
      }
    } catch {
      setSaveStatus("Network error while saving.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleNew = () => {
    const newId = `suite-${Date.now().toString(36)}`;
    const template = `name: New Eval Suite\ndefaults:\n  iterations: 1\n  passThreshold: 1.0\n  temperature: 0\n  maxSteps: 5\ncases:\n  - id: sample-case-1\n    prompts:\n      - "Hello"\n    expect:\n      - noToolError: true\n`;
    setSelectedSuiteId(newId);
    setYamlContent(template);
  };

  const handleDownload = () => {
    const blob = new Blob([yamlContent], { type: "text/yaml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedSuiteId || "suite"}.yaml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full space-y-4 p-4">
      {/* Top action toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase">Suite:</label>
          <select
            className="rounded border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            value={selectedSuiteId}
            onChange={(e) => handleSelect(e.target.value)}
          >
            {suites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.id})
              </option>
            ))}
          </select>
          <button
            onClick={handleNew}
            className="rounded border border-border bg-muted/60 px-2.5 py-1 text-xs hover:bg-muted font-medium transition-colors"
          >
            + New Suite
          </button>
        </div>

        <div className="flex items-center gap-2">
          {saveStatus && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">{saveStatus}</span>
          )}
          <button
            onClick={handleDownload}
            className="rounded border border-border bg-muted/60 px-3 py-1 text-xs hover:bg-muted font-medium transition-colors"
          >
            Download YAML
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !parsed.success}
            className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground hover:bg-primary/90 font-medium transition-colors disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save Draft"}
          </button>
        </div>
      </div>

      {/* Editor & validation status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-[400px]">
        {/* YAML Textarea */}
        <div className="lg:col-span-2 flex flex-col rounded-lg border border-border overflow-hidden bg-background">
          <div className="bg-muted/40 px-3 py-1.5 text-[11px] font-mono border-b border-border text-muted-foreground">
            YAML Definition
          </div>
          <textarea
            value={yamlContent}
            onChange={(e) => setYamlContent(e.target.value)}
            className="flex-1 w-full resize-none p-3 font-mono text-xs bg-transparent focus:outline-none leading-relaxed"
            placeholder="Write evaluation suite YAML here..."
            spellCheck={false}
          />
        </div>

        {/* Validation & Preview */}
        <div className="flex flex-col rounded-lg border border-border overflow-hidden bg-muted/10 p-4 space-y-3">
          <div className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
            Validation & Structure
          </div>

          {parsed.success ? (
            <div className="space-y-3">
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                <span>✓</span> Valid YAML & Schema
              </div>
              <div className="text-xs space-y-1.5 rounded bg-background/80 p-3 border border-border/60">
                <div><strong>Suite Name:</strong> {parsed.suite?.name}</div>
                <div><strong>Cases:</strong> {parsed.suite?.cases.length}</div>
                <div><strong>Default Iterations:</strong> {parsed.suite?.defaults?.iterations ?? 1}</div>
                <div><strong>Pass Threshold:</strong> {((parsed.suite?.defaults?.passThreshold ?? 1) * 100).toFixed(0)}%</div>
              </div>

              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                <div className="text-[11px] font-semibold text-muted-foreground uppercase">Included Cases:</div>
                {parsed.suite?.cases.map((c) => (
                  <div key={c.id} className="text-xs p-2 rounded bg-background/50 border border-border/40">
                    <div className="font-mono font-medium text-primary">{c.id}</div>
                    <div className="text-[11px] text-muted-foreground">Checks: {c.expect.length}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded border border-destructive/30 bg-destructive/10 p-3 text-destructive text-xs space-y-2">
              <div className="font-semibold">Schema Error:</div>
              <div className="font-mono text-[11px] whitespace-pre-wrap">{parsed.error}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
