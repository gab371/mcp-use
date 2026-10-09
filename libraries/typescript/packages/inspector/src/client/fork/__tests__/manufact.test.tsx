// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isManufactDisabled } from "../manufact";
import { HostedUserMenu } from "../../components/HostedUserMenu";
import { InspectorProvider, useInspector } from "../../context/InspectorContext";

describe("isManufactDisabled", () => {
  afterEach(() => {
    delete (window as Window & { __FORK_DISABLE_MANUFACT__?: boolean }).__FORK_DISABLE_MANUFACT__;
  });

  it("defaults to true", () => {
    expect(isManufactDisabled()).toBe(true);
  });

  it("honors window override when set to false", () => {
    (window as Window & { __FORK_DISABLE_MANUFACT__?: boolean }).__FORK_DISABLE_MANUFACT__ = false;
    expect(isManufactDisabled()).toBe(false);
  });
});

describe("Manufact Cloud disabled integration", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
      root = null;
    }
    if (container) {
      container.remove();
      container = null;
    }
    delete (window as Window & { __FORK_DISABLE_MANUFACT__?: boolean }).__FORK_DISABLE_MANUFACT__;
  });

  it("HostedUserMenu renders null when Manufact is disabled", () => {
    act(() => {
      root!.render(<HostedUserMenu chatApiUrl="https://cloud.manufact.com/api/v1/inspector/chat/stream" />);
    });
    expect(container!.innerHTML).toBe("");
  });

  it("InspectorContext does not default to cloud.manufact.com chat URL when disabled", () => {
    let contextValue: ReturnType<typeof useInspector> | null = null;
    function Probe() {
      contextValue = useInspector();
      return null;
    }

    act(() => {
      root!.render(
        <InspectorProvider>
          <Probe />
        </InspectorProvider>
      );
    });

    expect(contextValue).not.toBeNull();
    expect(contextValue!.embeddedConfig.chatApiUrl).toBeUndefined();
    expect(contextValue!.embeddedConfig.chatEnableFreeTierUpgrade).toBe(false);
  });
});
