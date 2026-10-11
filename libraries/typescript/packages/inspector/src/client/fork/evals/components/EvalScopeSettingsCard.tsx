import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/client/components/ui/card";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { readEvalScope, writeEvalScope } from "../scope";

/** feat 05: per-MCP eval suites scope, rendered under the Connection Settings form. */
export function EvalScopeSettingsCard({ serverId }: { serverId: string }) {
  const [defaultFolder, setDefaultFolder] = useState("");
  const [foldersText, setFoldersText] = useState("");

  useEffect(() => {
    const scope = readEvalScope(serverId);
    setDefaultFolder(scope.defaultFolder);
    setFoldersText(scope.folders.join(", "));
  }, [serverId]);

  const save = (nextDefault: string, nextFolders: string) =>
    writeEvalScope(serverId, {
      defaultFolder: nextDefault.trim(),
      folders: nextFolders.split(",").map((f) => f.trim()).filter(Boolean),
    });

  return (
    <Card className="border mt-6" data-testid="fork-eval-scope-card">
      <CardHeader>
        <CardTitle className="text-base font-medium">Evaluation Suites</CardTitle>
        <CardDescription>
          Suite folders of this MCP in <code>.evals/suites/</code>. The Evals tab shows these
          folders plus global suites. Saved automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="fork-eval-default-folder">Default suite folder</Label>
          <Input
            id="fork-eval-default-folder"
            placeholder="e.g. my-mcp"
            value={defaultFolder}
            onChange={(e) => {
              setDefaultFolder(e.target.value);
              save(e.target.value, foldersText);
            }}
          />
          <p className="text-xs text-muted-foreground">New suites are created in this folder.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fork-eval-folders">Other suite folders</Label>
          <Input
            id="fork-eval-folders"
            placeholder="e.g. shared, regression"
            value={foldersText}
            onChange={(e) => {
              setFoldersText(e.target.value);
              save(defaultFolder, e.target.value);
            }}
          />
          <p className="text-xs text-muted-foreground">Comma-separated. Optional.</p>
        </div>
      </CardContent>
    </Card>
  );
}
