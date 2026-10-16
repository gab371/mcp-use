import { useState } from "react";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/client/components/ui/dialog";
import { Button } from "@/client/components/ui/button";
import { Badge } from "@/client/components/ui/badge";
import { cn } from "@/client/lib/utils";
import { copyToClipboard } from "@/client/utils/browser";
import {
  Check,
  Copy,
  ExternalLink,
  HelpCircle,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import { toast } from "sonner";

interface LocalProxyHelpModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
  onApplyProxyAddress?: (address: string) => void;
  currentProxyAddress?: string;
}

export function LocalProxyHelpModal({
  open,
  onOpenChange,
  trigger,
  onApplyProxyAddress,
  currentProxyAddress,
}: LocalProxyHelpModalProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = async (key: string, text: string) => {
    try {
      await copyToClipboard(text);
      setCopiedKey(key);
      toast.success("Command copied!");
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      toast.error("Failed to copy command.");
    }
  };

  const macCommand = "./scripts/fork/run-cors-proxy.sh";
  const winCmdCommand = "scripts\\fork\\run-cors-proxy.bat";
  const winPsCommand = ".\\scripts\\fork\\run-cors-proxy.ps1";

  const defaultProxyUrl = "http://localhost:3020";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger render={trigger} nativeButton />}
      <DialogContent scrollable className="w-[calc(100vw-2rem)] sm:w-full max-w-2xl max-h-[85vh]">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <DialogTitle className="text-lg font-semibold flex items-center gap-2">
              <Terminal className="w-5 h-5 text-sky-500" />
              Local CORS Proxy (Standalone Mode)
            </DialogTitle>
            <Badge variant="outline" className="text-emerald-500 border-emerald-500/30 bg-emerald-500/10 text-xs">
              <ShieldCheck className="w-3 h-3 mr-1" />
              100% Local
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Bypass browser CORS and Private Network Access (PNA) restrictions without sending data outside your machine.
          </p>
        </DialogHeader>

        <DialogBody className="space-y-4 pt-2 text-sm">
          {/* Explanation Banner */}
          <div className="rounded-lg border border-sky-500/20 bg-sky-500/10 p-3.5 text-xs text-sky-200 space-y-1.5">
            <div className="font-medium text-sky-300 flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 flex-shrink-0" />
              Why is this proxy required in Standalone mode?
            </div>
            <p className="leading-relaxed">
              In static / GitLab Pages hosting, the Inspector runs entirely inside your browser.
              When connecting to a local server (e.g. <code className="bg-black/30 px-1 py-0.5 rounded text-sky-100">https://localhost:8443</code> or Ollama <code className="bg-black/30 px-1 py-0.5 rounded text-sky-100">http://localhost:11434</code>), browser Same-Origin Policy blocks direct requests, and Chromium enforces Private Network Access (PNA) checks from public origins.
            </p>
            <p className="leading-relaxed">
              The included local Node proxy runs on loopback (<code className="bg-black/30 px-1 py-0.5 rounded text-sky-100">127.0.0.1:3020</code>) with zero external npm dependencies, returns permissive CORS headers, and relays traffic directly.
            </p>
          </div>

          {/* Quick Launch Commands */}
          <div className="space-y-3">
            <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
              1. Start the proxy on your machine
            </h4>

            {/* macOS / Linux */}
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-foreground flex items-center justify-between">
                <span>macOS / Linux (Bash / Zsh):</span>
                <span className="text-[11px] text-muted-foreground">Default port: 3020</span>
              </div>
              <div className="flex items-center justify-between bg-black/60 dark:bg-zinc-950 border border-border rounded-md px-3 py-2 font-mono text-xs">
                <span className="text-emerald-400 select-all">{macCommand}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => handleCopy("mac", macCommand)}
                >
                  {copiedKey === "mac" ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </div>

            {/* Windows Command Prompt */}
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-foreground flex items-center justify-between">
                <span>Windows (Command Prompt / Double-click):</span>
                <span className="text-[11px] text-muted-foreground">Double-clickable</span>
              </div>
              <div className="flex items-center justify-between bg-black/60 dark:bg-zinc-950 border border-border rounded-md px-3 py-2 font-mono text-xs">
                <span className="text-sky-300 select-all">{winCmdCommand}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => handleCopy("wincmd", winCmdCommand)}
                >
                  {copiedKey === "wincmd" ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </div>

            {/* Windows PowerShell */}
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-foreground flex items-center justify-between">
                <span>Windows (PowerShell):</span>
              </div>
              <div className="flex items-center justify-between bg-black/60 dark:bg-zinc-950 border border-border rounded-md px-3 py-2 font-mono text-xs">
                <span className="text-sky-300 select-all">{winPsCommand}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => handleCopy("winps", winPsCommand)}
                >
                  {copiedKey === "winps" ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </div>
          </div>

          {/* Configuration in Inspector */}
          <div className="space-y-2 pt-2 border-t border-border">
            <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
              2. Configure the Inspector
            </h4>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3 bg-muted/40 rounded-lg border border-border">
              <div className="space-y-0.5 text-xs">
                <div className="font-medium text-foreground">Recommended Proxy Endpoint:</div>
                <div className="font-mono text-sky-400">{defaultProxyUrl}</div>
              </div>
              {onApplyProxyAddress && (
                <Button
                  size="sm"
                  variant={currentProxyAddress === defaultProxyUrl ? "outline" : "default"}
                  className="text-xs"
                  onClick={() => {
                    onApplyProxyAddress(defaultProxyUrl);
                    toast.success(`Proxy address applied: ${defaultProxyUrl}`);
                  }}
                >
                  {currentProxyAddress === defaultProxyUrl ? "Active Address" : "Apply :3020"}
                </Button>
              )}
            </div>
          </div>

          {/* Documentation Links */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground border-t border-border">
            <span>Markdown Documentation: <code className="text-foreground">docs/fork/local-cors-proxy.md</code></span>
            <a
              href="https://gitlab.disney.com/GABRIEL.BENETOUX/mcp-use-fork/-/blob/fork/main/docs/fork/local-cors-proxy.md"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300 underline font-medium"
            >
              Open Documentation
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

export function LocalProxyButton({
  buttonClassName,
  onApplyProxyAddress,
  currentProxyAddress,
}: {
  buttonClassName?: string;
  onApplyProxyAddress?: (address: string) => void;
  currentProxyAddress?: string;
}) {
  return (
    <LocalProxyHelpModal
      trigger={
        <Button
          data-testid="connection-form-local-proxy-button"
          variant="outline"
          className={cn(
            "w-full justify-center hover:text-white cursor-pointer",
            buttonClassName
          )}
        >
          <Terminal className="w-4 h-4" />
          Local Proxy
        </Button>
      }
      onApplyProxyAddress={onApplyProxyAddress}
      currentProxyAddress={currentProxyAddress}
    />
  );
}
