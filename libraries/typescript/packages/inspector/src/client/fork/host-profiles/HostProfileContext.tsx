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
import { setActiveToolCallMeta } from "./meta-transport";
import type {
  HostProfile,
  HostProfileClientMeta,
  HostProfileId,
} from "./types";

const STORAGE_KEY = "mcp-inspector-host-profile";
const META_STORAGE_KEY_PREFIX = "mcp-inspector-host-meta-";

export interface HostProfileContextValue {
  activeProfileId: HostProfileId;
  activeProfile: HostProfile;
  setActiveProfileId: (id: HostProfileId) => void;
  profiles: Record<HostProfileId, HostProfile>;
  /** Effective client tool call metadata (_meta) injected for the current profile. */
  clientToolCallMeta?: HostProfileClientMeta;
  /** Whether openai/userLocation is included in client metadata. */
  isLocationEnabled: boolean;
  setLocationEnabled: (enabled: boolean) => void;
  updateClientToolCallMeta: (patch: Partial<HostProfileClientMeta>) => void;
  resetClientToolCallMeta: () => void;
  /** Helper returning the exact _meta object to inject into tool calls (or undefined if empty/none). */
  getToolCallMeta: () => Record<string, unknown> | undefined;
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
        try {
          localStorage.setItem(STORAGE_KEY, urlHost);
        } catch {
          // ignore localStorage errors
        }
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

  const [metaOverrides, setMetaOverrides] = useState<
    Record<string, Partial<HostProfileClientMeta>>
  >({});
  const [locationEnabledMap, setLocationEnabledMap] = useState<
    Record<string, boolean>
  >({});

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

  const isLocationEnabled = locationEnabledMap[activeProfileId] ?? true;

  const clientToolCallMeta = useMemo<HostProfileClientMeta | undefined>(() => {
    const baseMeta = activeProfile.clientToolCallMeta;
    if (!baseMeta) return undefined;

    const override = metaOverrides[activeProfileId] || {};
    const merged: HostProfileClientMeta = {
      ...baseMeta,
      ...override,
    };

    if (override["openai/userLocation"] || baseMeta["openai/userLocation"]) {
      merged["openai/userLocation"] = {
        ...(baseMeta["openai/userLocation"] || {}),
        ...(override["openai/userLocation"] || {}),
      };
    }

    return merged;
  }, [activeProfile, activeProfileId, metaOverrides]);

  const updateClientToolCallMeta = useCallback(
    (patch: Partial<HostProfileClientMeta>) => {
      setMetaOverrides((prev) => {
        const current = prev[activeProfileId] || {};
        return {
          ...prev,
          [activeProfileId]: {
            ...current,
            ...patch,
            ...(patch["openai/locale"] && !patch["webplus/i18n"]
              ? { "webplus/i18n": patch["openai/locale"] }
              : {}),
            ...(patch["openai/userLocation"]
              ? {
                  "openai/userLocation": {
                    ...(current["openai/userLocation"] || {}),
                    ...patch["openai/userLocation"],
                  },
                }
              : {}),
          },
        };
      });
    },
    [activeProfileId]
  );

  const setLocationEnabled = useCallback(
    (enabled: boolean) => {
      setLocationEnabledMap((prev) => ({
        ...prev,
        [activeProfileId]: enabled,
      }));
    },
    [activeProfileId]
  );

  const resetClientToolCallMeta = useCallback(() => {
    setMetaOverrides((prev) => {
      const next = { ...prev };
      delete next[activeProfileId];
      return next;
    });
    setLocationEnabledMap((prev) => {
      const next = { ...prev };
      delete next[activeProfileId];
      return next;
    });
  }, [activeProfileId]);

  const getToolCallMeta = useCallback((): Record<string, unknown> | undefined => {
    if (!clientToolCallMeta) return undefined;
    const result: Record<string, unknown> = { ...clientToolCallMeta };
    if (!isLocationEnabled) {
      delete result["openai/userLocation"];
    }
    return result;
  }, [clientToolCallMeta, isLocationEnabled]);

  useEffect(() => {
    setActiveToolCallMeta(getToolCallMeta());
  }, [getToolCallMeta]);

  const value = useMemo<HostProfileContextValue>(
    () => ({
      activeProfileId,
      activeProfile,
      setActiveProfileId,
      profiles: BUILT_IN_PROFILES,
      clientToolCallMeta,
      isLocationEnabled,
      setLocationEnabled,
      updateClientToolCallMeta,
      resetClientToolCallMeta,
      getToolCallMeta,
    }),
    [
      activeProfileId,
      activeProfile,
      setActiveProfileId,
      clientToolCallMeta,
      isLocationEnabled,
      setLocationEnabled,
      updateClientToolCallMeta,
      resetClientToolCallMeta,
      getToolCallMeta,
    ]
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
      clientToolCallMeta: undefined,
      isLocationEnabled: true,
      setLocationEnabled: () => {},
      updateClientToolCallMeta: () => {},
      resetClientToolCallMeta: () => {},
      getToolCallMeta: () => undefined,
    };
  }
  return context;
}
