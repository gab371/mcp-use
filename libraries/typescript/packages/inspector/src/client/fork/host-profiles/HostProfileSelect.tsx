import React from "react";
import { ChevronDown } from "lucide-react";
import { useHostProfile } from "./HostProfileContext";
import { HOST_PROFILE_LIST } from "./built-ins";
import type { HostProfileId } from "./types";

export function HostProfileSelect({ compact = false }: { compact?: boolean }) {
  const { activeProfileId, setActiveProfileId } = useHostProfile();

  return (
    <div className="relative inline-flex items-center">
      <select
        data-testid="header-host-profile-select"
        aria-label="Host Profile"
        value={activeProfileId}
        onChange={(e) => setActiveProfileId(e.target.value as HostProfileId)}
        className={`h-8 ${
          compact ? "pl-2 pr-6 max-w-[120px]" : "pl-3 pr-7"
        } text-xs font-medium rounded-full border border-border bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring text-foreground transition-colors truncate`}
      >
        {HOST_PROFILE_LIST.map((profile) => (
          <option key={profile.id} value={profile.id}>
            {compact ? profile.label : `Host: ${profile.label}`}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 size-3 text-muted-foreground" />
    </div>
  );
}
