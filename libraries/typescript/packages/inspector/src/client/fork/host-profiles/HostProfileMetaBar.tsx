import React, { useState } from "react";
import { ChevronDown, ChevronUp, Globe, MapPin, RotateCcw, ShieldCheck, User } from "lucide-react";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { Switch } from "@/client/components/ui/switch";
import { cn } from "@/client/lib/utils";
import { useHostProfile } from "./HostProfileContext";

export function HostProfileMetaBar({ className }: { className?: string }) {
  const {
    activeProfile,
    clientToolCallMeta,
    isLocationEnabled,
    setLocationEnabled,
    updateClientToolCallMeta,
    resetClientToolCallMeta,
  } = useHostProfile();

  const [isExpanded, setIsExpanded] = useState(false);

  if (!clientToolCallMeta) {
    return null;
  }

  const locale = (clientToolCallMeta["openai/locale"] as string) || "en-US";
  const location = clientToolCallMeta["openai/userLocation"] || {};
  const city = location.city || "San Francisco";
  const country = location.country || "US";
  const region = location.region || "CA";
  const timezone = location.timezone || "America/Los_Angeles";
  const latitude = location.latitude ?? 37.7749;
  const longitude = location.longitude ?? -122.4194;
  const subject = (clientToolCallMeta["openai/subject"] as string) || "";
  const session = (clientToolCallMeta["openai/session"] as string) || "";
  const organization = (clientToolCallMeta["openai/organization"] as string) || "";

  return (
    <div
      data-testid="host-profile-meta-bar"
      className={cn(
        "rounded-lg border border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/20 text-xs transition-all mb-4",
        className
      )}
    >
      <div
        className="flex items-center justify-between p-2.5 sm:px-3 cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsExpanded(!isExpanded);
          }
        }}
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>{activeProfile.label} Client Metadata</span>
            <code className="text-[10px] bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 px-1 py-0.5 rounded font-mono">
              _meta
            </code>
          </span>
          <span className="text-gray-400 dark:text-gray-600">|</span>
          <span className="text-muted-foreground flex items-center gap-1">
            <Globe className="h-3 w-3" />
            <span className="font-mono">{locale}</span>
          </span>
          <span className="text-gray-400 dark:text-gray-600">|</span>
          <span className="text-muted-foreground flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            <span>
              {isLocationEnabled ? `${city}, ${country}` : "Location disabled"}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground hover:text-foreground">
            {isExpanded ? "Collapse" : "Configure"}
          </span>
          {isExpanded ? (
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-emerald-500/20 p-3 sm:p-4 space-y-4 bg-background/50 backdrop-blur-xs rounded-b-lg">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Injected automatically in tool call{" "}
            <code className="font-mono text-[10px] bg-muted px-1 py-0.5 rounded">
              params._meta
            </code>{" "}
            per{" "}
            <a
              href="https://developers.openai.com/plugins/reference#_meta-fields-the-client-provides"
              target="_blank"
              rel="noreferrer"
              className="text-emerald-600 dark:text-emerald-400 underline hover:no-underline"
            >
              OpenAI client metadata specification
            </a>
            . Servers read these fields to localize responses or locate users.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-[11px] font-medium flex items-center gap-1 mb-1">
                <Globe className="h-3 w-3" />
                Locale (<code>openai/locale</code> & <code>webplus/i18n</code>)
              </Label>
              <Input
                data-testid="input-meta-locale"
                size="sm"
                className="h-7 text-xs font-mono"
                value={locale}
                onChange={(e) =>
                  updateClientToolCallMeta({
                    "openai/locale": e.target.value,
                    "webplus/i18n": e.target.value,
                  })
                }
                placeholder="e.g. en-US, fr-FR"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-[11px] font-medium flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  User Location (<code>openai/userLocation</code>)
                </Label>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground">
                    {isLocationEnabled ? "Active" : "Omit"}
                  </span>
                  <Switch
                    data-testid="switch-meta-location"
                    checked={isLocationEnabled}
                    onCheckedChange={setLocationEnabled}
                    aria-label="Toggle userLocation metadata"
                  />
                </div>
              </div>
              <div
                className={cn(
                  "grid grid-cols-2 gap-2 transition-opacity",
                  !isLocationEnabled && "opacity-40 pointer-events-none"
                )}
              >
                <Input
                  data-testid="input-meta-city"
                  size="sm"
                  className="h-7 text-xs"
                  placeholder="City"
                  value={city}
                  onChange={(e) =>
                    updateClientToolCallMeta({
                      "openai/userLocation": { city: e.target.value },
                    })
                  }
                />
                <Input
                  data-testid="input-meta-country"
                  size="sm"
                  className="h-7 text-xs font-mono"
                  placeholder="Country (ISO)"
                  value={country}
                  onChange={(e) =>
                    updateClientToolCallMeta({
                      "openai/userLocation": { country: e.target.value },
                    })
                  }
                />
              </div>
            </div>
          </div>

          {isLocationEnabled && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-border/40">
              <div>
                <Label className="text-[10px] text-muted-foreground mb-0.5 block">
                  Region
                </Label>
                <Input
                  data-testid="input-meta-region"
                  size="sm"
                  className="h-6 text-xs"
                  value={region}
                  onChange={(e) =>
                    updateClientToolCallMeta({
                      "openai/userLocation": { region: e.target.value },
                    })
                  }
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground mb-0.5 block">
                  Timezone
                </Label>
                <Input
                  data-testid="input-meta-timezone"
                  size="sm"
                  className="h-6 text-xs font-mono"
                  value={timezone}
                  onChange={(e) =>
                    updateClientToolCallMeta({
                      "openai/userLocation": { timezone: e.target.value },
                    })
                  }
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground mb-0.5 block">
                  Latitude
                </Label>
                <Input
                  data-testid="input-meta-latitude"
                  type="number"
                  step="any"
                  size="sm"
                  className="h-6 text-xs font-mono"
                  value={latitude}
                  onChange={(e) =>
                    updateClientToolCallMeta({
                      "openai/userLocation": {
                        latitude: parseFloat(e.target.value) || 0,
                      },
                    })
                  }
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground mb-0.5 block">
                  Longitude
                </Label>
                <Input
                  data-testid="input-meta-longitude"
                  type="number"
                  step="any"
                  size="sm"
                  className="h-6 text-xs font-mono"
                  value={longitude}
                  onChange={(e) =>
                    updateClientToolCallMeta({
                      "openai/userLocation": {
                        longitude: parseFloat(e.target.value) || 0,
                      },
                    })
                  }
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-border/40">
            <div>
              <Label className="text-[10px] text-muted-foreground flex items-center gap-1 mb-0.5">
                <User className="h-2.5 w-2.5" />
                Subject (<code>openai/subject</code>)
              </Label>
              <Input
                data-testid="input-meta-subject"
                size="sm"
                className="h-6 text-xs font-mono"
                value={subject}
                onChange={(e) =>
                  updateClientToolCallMeta({ "openai/subject": e.target.value })
                }
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground mb-0.5 block">
                Session (<code>openai/session</code>)
              </Label>
              <Input
                data-testid="input-meta-session"
                size="sm"
                className="h-6 text-xs font-mono"
                value={session}
                onChange={(e) =>
                  updateClientToolCallMeta({ "openai/session": e.target.value })
                }
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground mb-0.5 block">
                Organization (<code>openai/organization</code>)
              </Label>
              <Input
                data-testid="input-meta-organization"
                size="sm"
                className="h-6 text-xs font-mono"
                value={organization}
                onChange={(e) =>
                  updateClientToolCallMeta({
                    "openai/organization": e.target.value,
                  })
                }
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border/40">
            <span className="text-[10px] text-muted-foreground">
              User Agent:{" "}
              <span className="font-mono truncate inline-block max-w-[280px] sm:max-w-[420px] align-bottom">
                {(clientToolCallMeta["openai/userAgent"] as string) || ""}
              </span>
            </span>
            <Button
              data-testid="button-reset-client-meta"
              variant="ghost"
              size="sm"
              onClick={resetClientToolCallMeta}
              className="h-6 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3" />
              Reset defaults
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
