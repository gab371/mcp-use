import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { BUILT_IN_PROFILES, getHostProfile } from "./built-ins";
import type { HostProfile, HostProfileId } from "./types";

const STORAGE_KEY = "mcp-inspector-host-profile";

export interface HostProfileContextValue {
  activeProfileId: HostProfileId;
  activeProfile: HostProfile;
  setActiveProfileId: (id: HostProfileId) => void;
  profiles: Record<HostProfileId, HostProfile>;
}

export const HostProfileContext = createContext<HostProfileContextValue | null>(
  null
);

function getInitialProfileId(): HostProfileId {
  if (typeof window !== "undefined") {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const urlHost = urlParams.get("host");
      if (urlHost && urlHost in BUILT_IN_PROFILES) {
        return urlHost as HostProfileId;
      }
    } catch {
      // ignore URL parse errors
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && stored in BUILT_IN_PROFILES) {
        return stored as HostProfileId;
      }
    } catch {
      // ignore localStorage errors
    }
  }

  return "mcp-use";
}

export function HostProfileProvider({
  children,
  initialProfileId,
}: {
  children: ReactNode;
  initialProfileId?: HostProfileId;
}) {
  const [activeProfileId, setProfileIdState] = useState<HostProfileId>(
    () => initialProfileId ?? getInitialProfileId()
  );

  const setActiveProfileId = useCallback((id: HostProfileId) => {
    if (id in BUILT_IN_PROFILES) {
      setProfileIdState(id);
      try {
        localStorage.setItem(STORAGE_KEY, id);
      } catch {
        // ignore storage errors
      }
    }
  }, []);

  const activeProfile = useMemo(
    () => getHostProfile(activeProfileId),
    [activeProfileId]
  );

  const value = useMemo(
    () => ({
      activeProfileId,
      activeProfile,
      setActiveProfileId,
      profiles: BUILT_IN_PROFILES,
    }),
    [activeProfileId, activeProfile, setActiveProfileId]
  );

  return (
    <HostProfileContext.Provider value={value}>
      {children}
    </HostProfileContext.Provider>
  );
}

export function useHostProfile(): HostProfileContextValue {
  const context = useContext(HostProfileContext);
  if (!context) {
    const defaultProfile = BUILT_IN_PROFILES["mcp-use"];
    return {
      activeProfileId: "mcp-use",
      activeProfile: defaultProfile,
      setActiveProfileId: () => {},
      profiles: BUILT_IN_PROFILES,
    };
  }
  return context;
}
