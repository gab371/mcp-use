import { useState } from "react";
import type { McpServer } from "@mcp-use/client/react";
import type { LLMConfig } from "@/client/components/chat/types";
import { EvalsRunView } from "./components/EvalsRunView";
import { EvalsHistoryView } from "./components/EvalsHistoryView";
import { SuiteEditorView } from "./components/SuiteEditorView";
import { useConfig } from "@/client/components/chat/useConfig";
import { scopeFolders, useEvalScope } from "./scope";

export interface EvalsTabProps {
  connection?: McpServer;
  llmConfig?: LLMConfig | null;
}

export function EvalsTab({ connection, llmConfig }: EvalsTabProps) {
  const [activeView, setActiveView] = useState<"run" | "history" | "editor">("run");
  const { llmConfig: localConfig } = useConfig({ mcpServerUrl: connection?.url ?? "" });
  const effectiveConfig = llmConfig || localConfig;
  const configuredFolders = scopeFolders(useEvalScope(connection?.id));
  const [showAll, setShowAll] = useState(false);
  const folders = showAll ? [] : configuredFolders;

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      {/* Top Tab Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/20">
        <div className="flex items-center gap-3">
          <div className="font-semibold text-sm flex items-center gap-2">
            <span className="text-primary font-bold">🧪</span>
            <span>MCP Evaluations</span>
          </div>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            Verify real LLM tool routing, argument accuracy, and behavior against live tools.
          </span>
          {configuredFolders.length > 0 ? (
            <button
              onClick={() => setShowAll((v) => !v)}
              data-testid="evals-scope-toggle"
              title="Toggle between this MCP's suites and all suites"
              className="rounded border border-border bg-muted/60 px-2 py-0.5 text-[11px] font-medium hover:bg-muted"
            >
              {showAll ? "All suites" : `Scope: ${configuredFolders.join(", ")} + global`}
            </button>
          ) : (
            <span className="text-[11px] text-muted-foreground italic">
              All suites (set folders in Connection Settings)
            </span>
          )}
        </div>

        {/* Sub-view navigation buttons */}
        <div className="flex items-center rounded-md bg-muted/60 p-1 text-xs">
          <button
            onClick={() => setActiveView("run")}
            className={`px-3 py-1 rounded transition-colors font-medium ${
              activeView === "run"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            ▶ Run
          </button>
          <button
            onClick={() => setActiveView("history")}
            className={`px-3 py-1 rounded transition-colors font-medium ${
              activeView === "history"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            📊 History & Diff
          </button>
          <button
            onClick={() => setActiveView("editor")}
            className={`px-3 py-1 rounded transition-colors font-medium ${
              activeView === "editor"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            📝 Suites & Drafts
          </button>
        </div>
      </div>

      {/* Main View Container */}
      <div className="flex-1 overflow-hidden">
        {activeView === "run" && (
          <EvalsRunView
            connection={connection}
            llmConfig={effectiveConfig}
            folders={folders}
            onNavigateToHistory={() => setActiveView("history")}
            onNavigateToEditor={() => setActiveView("editor")}
          />
        )}
        {activeView === "history" && <EvalsHistoryView folders={folders} />}
        {activeView === "editor" && (
          <SuiteEditorView folders={folders} createFolders={configuredFolders} />
        )}
      </div>
    </div>
  );
}
