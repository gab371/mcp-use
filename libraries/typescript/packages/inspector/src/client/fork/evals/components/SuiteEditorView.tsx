import { useState, useEffect } from "react";
import { parseSuiteYaml, type EvalSuite } from "../engine/suite";
import { groupByScope, isSuiteInScope } from "../scope";

interface SuiteMeta {
  id: string;
  name: string;
  yaml: string;
  caseCount: number;
}

/** "My FAQ suite" -> "my-faq-suite" */
function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
}

export function SuiteEditorView({
  onSelectSuite,
  folders = [],
  createFolders = [],
}: {
  onSelectSuite?: (suite: EvalSuite, yaml: string) => void;
  /** feat 05: suite folders in scope; empty = all suites. */
  folders?: string[];
  /** feat 05: folders offered for new suites, default folder first. */
  createFolders?: string[];
}) {
  const [suites, setSuites] = useState<SuiteMeta[]>([]);
  const [selectedSuiteId, setSelectedSuiteId] = useState<string>("");
  const [yamlContent, setYamlContent] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Tabs: YAML Editor vs Golden Assets Editor
  const [activeTab, setActiveTab] = useState<"yaml" | "golden">("yaml");

  // Golden assets state
  const [goldenFiles, setGoldenFiles] = useState<Record<string, string>>({});
  const [selectedGoldenFile, setSelectedGoldenFile] = useState<string>("");
  const [goldenContent, setGoldenContent] = useState<string>("");
  const [isSavingGolden, setIsSavingGolden] = useState(false);
  const [goldenSaveStatus, setGoldenSaveStatus] = useState<string | null>(null);

  // New golden asset creator
  const [isCreatingGolden, setIsCreatingGolden] = useState(false);
  const [newGoldenName, setNewGoldenName] = useState("");
  const [newGoldenType, setNewGoldenType] = useState<"result" | "answer">("result");

  // New suite creator (feat 05)
  const [newSuite, setNewSuite] = useState<{ folder: string; name: string } | null>(null);

  const parsed = parseSuiteYaml(yamlContent);

  const fetchSuiteDetails = async (id: string) => {
    try {
      const res = await fetch(`/inspector/api/fork/evals/suites/${encodeURIComponent(id)}`);
      if (res.ok) {
        const detail = await res.json();
        const files: Record<string, string> = {};
        if (detail.goldenFiles) {
          for (const [k, v] of Object.entries(detail.goldenFiles as Record<string, string>)) {
            if (k.startsWith("golden/")) {
              files[k] = v;
            }
          }
        }
        setGoldenFiles(files);
        const keys = Object.keys(files);
        if (keys.length > 0) {
          setSelectedGoldenFile((prev) => (files[prev] !== undefined ? prev : keys[0]));
          setGoldenContent((prev) => (files[selectedGoldenFile] !== undefined ? files[selectedGoldenFile] : files[keys[0]]));
        } else {
          setSelectedGoldenFile("");
          setGoldenContent("");
        }
      }
    } catch (e) {
      console.warn("Failed to fetch suite details:", e);
    }
  };

  const fetchSuites = async () => {
    try {
      const res = await fetch("/inspector/api/fork/evals/suites");
      if (res.ok) {
        const data = await res.json();
        setSuites(data.suites || []);
      }
    } catch (e) {
      console.warn("Failed to fetch suites:", e);
    }
  };

  useEffect(() => {
    fetchSuites();
  }, []);

  const visibleSuites = suites.filter((s) => isSuiteInScope(s.id, folders));
  const visibleIds = visibleSuites.map((s) => s.id).join("|");
  const isUnsavedDraft = !!selectedSuiteId && !suites.some((s) => s.id === selectedSuiteId);

  // Keep the selection inside the scope (an unsaved new suite stays selected)
  useEffect(() => {
    if (isUnsavedDraft || visibleSuites.some((s) => s.id === selectedSuiteId)) return;
    const first = visibleSuites[0];
    setSelectedSuiteId(first?.id ?? "");
    setYamlContent(first?.yaml ?? "");
    if (first) fetchSuiteDetails(first.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleIds]);

  const handleSelect = (id: string) => {
    setSelectedSuiteId(id);
    const suite = suites.find((s) => s.id === id);
    if (suite) {
      setYamlContent(suite.yaml);
    }
    fetchSuiteDetails(id);
  };

  const handleSave = async () => {
    if (!selectedSuiteId || !yamlContent) return;
    setIsSaving(true);
    setSaveStatus(null);
    try {
      const res = await fetch(`/inspector/api/fork/evals/suites/${encodeURIComponent(selectedSuiteId)}`, {
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

  const handleCreateSuite = () => {
    if (!newSuite) return;
    const slug = slugify(newSuite.name);
    if (!slug) return;
    const newId = newSuite.folder ? `${newSuite.folder}/${slug}` : slug;
    const template = `name: ${newSuite.name.trim()}\ndefaults:\n  iterations: 1\n  passThreshold: 1.0\n  temperature: 0\n  maxSteps: 5\ncases:\n  - id: sample-case-1\n    prompts:\n      - "Hello"\n    expect:\n      - noToolError: true\n`;
    setSelectedSuiteId(newId);
    setYamlContent(template);
    setGoldenFiles({});
    setSelectedGoldenFile("");
    setGoldenContent("");
    setActiveTab("yaml");
    setNewSuite(null);
  };

  const handleDownload = () => {
    const blob = new Blob([yamlContent], { type: "text/yaml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedSuiteId.replace(/\//g, "-") || "suite"}.yaml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Golden asset operations
  const handleSelectGoldenFile = (fileKey: string) => {
    setSelectedGoldenFile(fileKey);
    setGoldenContent(goldenFiles[fileKey] || "");
    setGoldenSaveStatus(null);
  };

  const handleSaveGolden = async () => {
    if (!selectedSuiteId || !selectedGoldenFile) return;
    setIsSavingGolden(true);
    setGoldenSaveStatus(null);
    try {
      const fileNameOnly = selectedGoldenFile.replace(/^golden\//, "");
      const res = await fetch(
        `/inspector/api/fork/evals/suites/${encodeURIComponent(selectedSuiteId)}/golden/${encodeURIComponent(fileNameOnly)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: goldenContent }),
        }
      );
      if (res.ok) {
        setGoldenSaveStatus("Saved successfully!");
        setGoldenFiles((prev) => ({ ...prev, [selectedGoldenFile]: goldenContent }));
        setTimeout(() => setGoldenSaveStatus(null), 3000);
      } else {
        setGoldenSaveStatus("Failed to save golden asset.");
      }
    } catch {
      setGoldenSaveStatus("Network error while saving.");
    } finally {
      setIsSavingGolden(false);
    }
  };

  const handleDeleteGolden = async (fileKey: string) => {
    if (!selectedSuiteId) return;
    if (!confirm(`Delete ${fileKey}?`)) return;
    try {
      const fileNameOnly = fileKey.replace(/^golden\//, "");
      const res = await fetch(
        `/inspector/api/fork/evals/suites/${encodeURIComponent(selectedSuiteId)}/golden/${encodeURIComponent(fileNameOnly)}`,
        {
          method: "DELETE",
        }
      );
      if (res.ok) {
        await fetchSuiteDetails(selectedSuiteId);
      }
    } catch (e) {
      console.warn("Failed to delete golden file:", e);
    }
  };

  const handleCreateGolden = async () => {
    if (!selectedSuiteId || !newGoldenName.trim()) return;
    let fileName = newGoldenName.trim().replace(/^golden\//, "");
    if (newGoldenType === "result" && !fileName.endsWith(".json")) {
      fileName += ".json";
    } else if (newGoldenType === "answer" && !fileName.endsWith(".md")) {
      fileName += ".md";
    }

    const initialContent =
      newGoldenType === "result"
        ? '{\n  "items": [\n    {\n      "id": 1\n    }\n  ]\n}\n'
        : "# Golden Answer Reference\n\nWrite the expected agent response here...\n";

    try {
      const res = await fetch(
        `/inspector/api/fork/evals/suites/${encodeURIComponent(selectedSuiteId)}/golden/${encodeURIComponent(fileName)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: initialContent }),
        }
      );
      if (res.ok) {
        setIsCreatingGolden(false);
        setNewGoldenName("");
        await fetchSuiteDetails(selectedSuiteId);
        setSelectedGoldenFile(`golden/${fileName}`);
        setGoldenContent(initialContent);
      }
    } catch (e) {
      console.warn("Failed to create golden file:", e);
    }
  };

  const handleFormatJson = () => {
    try {
      const obj = JSON.parse(goldenContent);
      setGoldenContent(JSON.stringify(obj, null, 2));
    } catch {
      alert("Invalid JSON format. Please verify syntax.");
    }
  };

  const goldenKeys = Object.keys(goldenFiles);

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
            {isUnsavedDraft && <option value={selectedSuiteId}>{selectedSuiteId} (unsaved)</option>}
            {visibleSuites.length === 0 && !isUnsavedDraft && (
              <option value="">No suite in scope</option>
            )}
            {groupByScope(visibleSuites).map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.suites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.id})
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {newSuite ? (
            <form
              className="flex items-center gap-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                handleCreateSuite();
              }}
            >
              {createFolders.length > 0 && (
                <select
                  data-testid="new-suite-folder"
                  className="rounded border border-input bg-background px-2 py-1 text-xs"
                  value={newSuite.folder}
                  onChange={(e) => setNewSuite({ ...newSuite, folder: e.target.value })}
                >
                  {createFolders.map((f) => (
                    <option key={f} value={f}>
                      {f}/
                    </option>
                  ))}
                  <option value="">(global)</option>
                </select>
              )}
              <input
                autoFocus
                data-testid="new-suite-name"
                placeholder="suite name"
                className="rounded border border-input bg-background px-2 py-1 text-xs w-36"
                value={newSuite.name}
                onChange={(e) => setNewSuite({ ...newSuite, name: e.target.value })}
              />
              <button
                type="submit"
                disabled={!slugify(newSuite.name)}
                className="rounded bg-primary px-2.5 py-1 text-xs text-primary-foreground font-medium disabled:opacity-50"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => setNewSuite(null)}
                className="rounded px-1.5 py-1 text-xs text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </form>
          ) : (
            <button
              onClick={() => setNewSuite({ folder: createFolders[0] ?? "", name: "" })}
              className="rounded border border-border bg-muted/60 px-2.5 py-1 text-xs hover:bg-muted font-medium transition-colors"
            >
              + New Suite
            </button>
          )}
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5 text-xs">
          <button
            onClick={() => setActiveTab("yaml")}
            className={`px-3 py-1 rounded font-medium transition-colors ${
              activeTab === "yaml"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            📝 Suite YAML
          </button>
          <button
            onClick={() => setActiveTab("golden")}
            className={`px-3 py-1 rounded font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === "golden"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>⭐ Golden Assets</span>
            <span className="rounded-full bg-primary/20 text-primary px-1.5 py-0.2 text-[10px] font-mono">
              {goldenKeys.length}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === "yaml" && (
            <>
              {saveStatus && (
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  {saveStatus}
                </span>
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
            </>
          )}

          {activeTab === "golden" && (
            <>
              {goldenSaveStatus && (
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  {goldenSaveStatus}
                </span>
              )}
              {selectedGoldenFile && (
                <button
                  onClick={handleSaveGolden}
                  disabled={isSavingGolden}
                  className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground hover:bg-primary/90 font-medium transition-colors disabled:opacity-50"
                >
                  {isSavingGolden ? "Saving..." : "Save Asset"}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Main View Area: YAML Tab */}
      {activeTab === "yaml" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-[400px]">
          {/* YAML Textarea */}
          <div className="lg:col-span-2 flex flex-col rounded-lg border border-border overflow-hidden bg-background">
            <div className="bg-muted/40 px-3 py-1.5 text-[11px] font-mono border-b border-border text-muted-foreground flex justify-between items-center">
              <span>YAML Definition</span>
              <span>{yamlContent.split("\n").length} lines</span>
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
                  <div>
                    <strong>Suite Name:</strong> {parsed.suite?.name}
                  </div>
                  <div>
                    <strong>Cases:</strong> {parsed.suite?.cases.length}
                  </div>
                  <div>
                    <strong>Default Iterations:</strong> {parsed.suite?.defaults?.iterations ?? 1}
                  </div>
                  <div>
                    <strong>Pass Threshold:</strong>{" "}
                    {((parsed.suite?.defaults?.passThreshold ?? 1) * 100).toFixed(0)}%
                  </div>
                </div>

                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                  <div className="text-[11px] font-semibold text-muted-foreground uppercase">
                    Included Cases:
                  </div>
                  {parsed.suite?.cases.map((c) => (
                    <div
                      key={c.id}
                      className="text-xs p-2 rounded bg-background/50 border border-border/40"
                    >
                      <div className="font-mono font-medium text-primary">{c.id}</div>
                      <div className="text-[11px] text-muted-foreground">
                        Checks: {c.expect.length}
                      </div>
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
      )}

      {/* Main View Area: Golden Assets Tab */}
      {activeTab === "golden" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 min-h-[450px]">
          {/* Left Column: Golden Assets Explorer */}
          <div className="flex flex-col rounded-lg border border-border bg-background overflow-hidden">
            <div className="bg-muted/40 p-2.5 border-b border-border flex items-center justify-between">
              <span className="font-semibold text-xs text-muted-foreground uppercase">
                Assets ({goldenKeys.length})
              </span>
              <button
                onClick={() => setIsCreatingGolden(true)}
                className="rounded bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 text-xs font-medium hover:bg-primary/20 transition-colors"
              >
                + New Asset
              </button>
            </div>

            {/* Inline asset creation form */}
            {isCreatingGolden && (
              <div className="p-3 bg-muted/20 border-b border-border/60 space-y-2 text-xs">
                <div className="font-semibold text-[11px] text-foreground">Add Golden Asset:</div>
                <input
                  type="text"
                  placeholder="e.g. explorer-kids.result.json"
                  value={newGoldenName}
                  onChange={(e) => setNewGoldenName(e.target.value)}
                  className="w-full rounded border border-input bg-background p-1.5 text-xs font-mono"
                />
                <div className="flex items-center gap-3 text-[11px]">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="goldenType"
                      checked={newGoldenType === "result"}
                      onChange={() => setNewGoldenType("result")}
                    />
                    <span>Tool Result (.json)</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="goldenType"
                      checked={newGoldenType === "answer"}
                      onChange={() => setNewGoldenType("answer")}
                    />
                    <span>Answer (.md)</span>
                  </label>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={handleCreateGolden}
                    className="rounded bg-primary text-primary-foreground px-2.5 py-1 text-[11px] font-medium"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => {
                      setIsCreatingGolden(false);
                      setNewGoldenName("");
                    }}
                    className="rounded border border-border px-2.5 py-1 text-[11px] hover:bg-muted"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* List of files */}
            <div className="flex-1 overflow-y-auto divide-y divide-border/40">
              {goldenKeys.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground italic">
                  No golden files yet for this suite.
                  <br />
                  Click "+ New Asset" to create one.
                </div>
              ) : (
                goldenKeys.map((key) => {
                  const isSelected = selectedGoldenFile === key;
                  const isJson = key.endsWith(".json");
                  const isMd = key.endsWith(".md");

                  return (
                    <div
                      key={key}
                      onClick={() => handleSelectGoldenFile(key)}
                      className={`flex items-center justify-between p-2.5 text-xs cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-primary/10 border-l-2 border-primary text-foreground font-medium"
                          : "hover:bg-muted/30 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span
                          className={`text-[9px] px-1 py-0.2 rounded font-mono uppercase font-bold border ${
                            isJson
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                              : isMd
                              ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30"
                              : "bg-muted text-muted-foreground border-border"
                          }`}
                        >
                          {isJson ? "JSON" : isMd ? "MD" : "TXT"}
                        </span>
                        <span className="font-mono truncate">{key}</span>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteGolden(key);
                        }}
                        className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors text-[11px]"
                        title="Delete asset"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Asset Content Editor */}
          <div className="md:col-span-2 flex flex-col rounded-lg border border-border bg-background overflow-hidden">
            {selectedGoldenFile ? (
              <>
                <div className="bg-muted/40 px-3 py-2 border-b border-border flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 font-mono">
                    <span className="font-semibold text-foreground">{selectedGoldenFile}</span>
                    <span className="text-[11px] text-muted-foreground">
                      ({goldenContent.length} chars)
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {selectedGoldenFile.endsWith(".json") && (
                      <button
                        onClick={handleFormatJson}
                        className="rounded border border-border px-2 py-0.5 text-[11px] hover:bg-muted font-mono"
                      >
                        Format JSON
                      </button>
                    )}
                  </div>
                </div>

                <textarea
                  value={goldenContent}
                  onChange={(e) => setGoldenContent(e.target.value)}
                  className="flex-1 w-full resize-none p-3 font-mono text-xs bg-transparent focus:outline-none leading-relaxed min-h-[350px]"
                  placeholder="Asset content..."
                  spellCheck={false}
                />
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground italic">
                Select an asset from the list to view or edit its content.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
