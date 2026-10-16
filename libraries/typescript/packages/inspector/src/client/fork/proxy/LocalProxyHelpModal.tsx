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
import { cn } from "@/client/lib/utils";

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
      toast.success("Commande copiée !");
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      toast.error("Impossible de copier la commande.");
    }
  };

  const macCommand = "./scripts/fork/run-cors-proxy.sh";
  const winCmdCommand = "scripts\\fork\\run-cors-proxy.bat";
  const winPsCommand = ".\\scripts\\fork\\run-cors-proxy.ps1";

  const defaultProxyUrl = "http://localhost:3020";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger render={trigger} nativeButton={false} />}
      <DialogContent scrollable className="w-[calc(100vw-2rem)] sm:w-full max-w-2xl max-h-[85vh]">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <DialogTitle className="text-lg font-semibold flex items-center gap-2">
              <Terminal className="w-5 h-5 text-sky-500" />
              Local CORS Proxy (Mode Standalone)
            </DialogTitle>
            <Badge variant="outline" className="text-emerald-500 border-emerald-500/30 bg-emerald-500/10 text-xs">
              <ShieldCheck className="w-3 h-3 mr-1" />
              100% Local
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Bypass les blocages CORS et Private Network Access (PNA) sans fuite de données vers l'extérieur.
          </p>
        </DialogHeader>

        <DialogBody className="space-y-4 pt-2 text-sm">
          {/* Explanation Banner */}
          <div className="rounded-lg border border-sky-500/20 bg-sky-500/10 p-3.5 text-xs text-sky-200 space-y-1.5">
            <div className="font-medium text-sky-300 flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 flex-shrink-0" />
              Pourquoi ce proxy est-il nécessaire en mode Standalone ?
            </div>
            <p className="leading-relaxed">
              En mode statique / GitLab Pages, l'Inspector s'exécute directement dans le navigateur.
              Pour contacter un serveur local (ex: <code className="bg-black/30 px-1 py-0.5 rounded text-sky-100">https://localhost:8443</code> ou Ollama <code className="bg-black/30 px-1 py-0.5 rounded text-sky-100">http://localhost:11434</code>), le navigateur applique la politique CORS et Chrome bloque les requêtes vers le réseau privé (PNA).
            </p>
            <p className="leading-relaxed">
              Le proxy Node local inclus tourne en loopback (<code className="bg-black/30 px-1 py-0.5 rounded text-sky-100">127.0.0.1:3020</code>) sans dépendance npm externe, renvoie les headers CORS permissifs et achemine le trafic en direct.
            </p>
          </div>

          {/* Quick Launch Commands */}
          <div className="space-y-3">
            <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
              1. Lancer le proxy sur votre machine
            </h4>

            {/* macOS / Linux */}
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-foreground flex items-center justify-between">
                <span>macOS / Linux (Bash / Zsh) :</span>
                <span className="text-[11px] text-muted-foreground">Port par défaut : 3020</span>
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
                <span>Windows (Invite de commandes / Double-clic) :</span>
                <span className="text-[11px] text-muted-foreground">Double-cliquable</span>
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
                <span>Windows (PowerShell) :</span>
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
              2. Paramétrer l'Inspector
            </h4>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3 bg-muted/40 rounded-lg border border-border">
              <div className="space-y-0.5 text-xs">
                <div className="font-medium text-foreground">Proxy Endpoint recommandé :</div>
                <div className="font-mono text-sky-400">{defaultProxyUrl}</div>
              </div>
              {onApplyProxyAddress && (
                <Button
                  size="sm"
                  variant={currentProxyAddress === defaultProxyUrl ? "outline" : "default"}
                  className="text-xs"
                  onClick={() => {
                    onApplyProxyAddress(defaultProxyUrl);
                    toast.success(`Adresse proxy appliquée : ${defaultProxyUrl}`);
                  }}
                >
                  {currentProxyAddress === defaultProxyUrl ? "Adresse active" : "Appliquer 3020"}
                </Button>
              )}
            </div>
          </div>

          {/* Documentation Links */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground border-t border-border">
            <span>Documentation Markdown : <code className="text-foreground">docs/fork/local-cors-proxy.md</code></span>
            <a
              href="https://gitlab.disney.com/GABRIEL.BENETOUX/mcp-use-fork/-/blob/fork/main/docs/fork/local-cors-proxy.md"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300 underline font-medium"
            >
              Ouvrir la documentation
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
