// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { LocalProxyButton, LocalProxyAlert } from "../index";

describe("Local CORS Proxy Components", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("renders LocalProxyButton with correct test-id and label", async () => {
    await act(async () => {
      root.render(
        <LocalProxyButton
          onApplyProxyAddress={vi.fn()}
          currentProxyAddress=""
        />
      );
    });

    const button = container.querySelector('[data-testid="connection-form-local-proxy-button"]');
    expect(button).not.toBeNull();
    expect(button?.textContent).toContain("Local Proxy");
  });

  it("renders LocalProxyAlert with help and default endpoint button", async () => {
    const handleSet = vi.fn();
    await act(async () => {
      root.render(
        <LocalProxyAlert
          connectionMode="direct"
          proxyAddress="http://custom-proxy:8080"
          setProxyAddress={handleSet}
        />
      );
    });

    expect(container.textContent).toContain("Local CORS Proxy (Standalone Mode)");
    expect(container.textContent).toContain("Help & Commands");
    expect(container.textContent).toContain("Set default endpoint");
  });
});
