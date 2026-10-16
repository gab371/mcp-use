import { useState } from "react";
import { Button } from "@/client/components/ui/button";
import { Badge } from "@/client/components/ui/badge";
import { LocalProxyHelpModal } from "./LocalProxyHelpModal";
import { HelpCircle, Terminal, Wand2 } from "lucide-react";

interface LocalProxyAlertProps {
  connectionMode: string;
  proxyAddress: string;
  setProxyAddress: (value: string) => void;
  className?: string;
}

export function LocalProxyAlert({
  connectionMode,
  proxyAddress,
  setProxyAddress,
  className,
}: LocalProxyAlertProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const defaultProxyUrl = "http://localhost:3020";

  return (
    <div
      className={`rounded-lg border border-sky-500/25 bg-sky-500/5 dark:bg-sky-950/20 p-3 text-xs space-y-2 ${className || ""}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 font-medium text-sky-400">
          <Terminal className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Local CORS Proxy (Standalone Mode)</span>
          <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 border-sky-500/30 text-sky-400">
            100% Local
          </Badge>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-[11px] text-sky-400 hover:text-sky-300 hover:bg-sky-500/10 gap-1"
          onClick={() => setModalOpen(true)}
        >
          <HelpCircle className="w-3 h-3" />
          Help & Commands
        </Button>
      </div>

      <p className="text-muted-foreground text-[11px] leading-relaxed">
        To inspect local servers (Ollama, direct MCP) from this static page without CORS restrictions,
        run the local Node proxy on your machine (<code>./scripts/fork/run-cors-proxy.sh</code> or <code>scripts\fork\run-cors-proxy.bat</code>).
      </p>

      {proxyAddress.trim() !== defaultProxyUrl && (
        <div className="flex items-center gap-2 pt-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-6 text-[11px] border-sky-500/30 text-sky-300 hover:bg-sky-500/15 gap-1"
            onClick={() => setProxyAddress(defaultProxyUrl)}
          >
            <Wand2 className="w-3 h-3 text-sky-400" />
            Set default endpoint (<code>{defaultProxyUrl}</code>)
          </Button>
        </div>
      )}

      <LocalProxyHelpModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onApplyProxyAddress={setProxyAddress}
        currentProxyAddress={proxyAddress}
      />
    </div>
  );
}
