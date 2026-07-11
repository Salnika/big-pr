import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vite-plus/test";
import { renderWithProviders } from "../../test/render-with-providers";
import { SettingsContainer } from "./SettingsContainer";
import { SETTINGS_STORAGE_KEY, useSettingsStore } from "./settings-store";

describe("SettingsContainer", () => {
  test("renders the initial setup state", async () => {
    mockStatusResponse({
      authenticated: true,
      cliAvailable: true,
      host: "github.com",
      login: "alexis",
      message: "Connected locally as @alexis through gh.",
    });

    renderWithProviders(<SettingsContainer mode="setup" />);

    expect(screen.getByText("Connect a GitHub repository")).toBeTruthy();
    expect(screen.getByLabelText("Repository")).toBeTruthy();
    expect(await screen.findByText(/Connected locally as @alexis through gh\./)).toBeTruthy();
  });

  test("shows a validation error when the repository is missing", async () => {
    const user = userEvent.setup();
    mockStatusResponse({
      authenticated: false,
      cliAvailable: true,
      host: "github.com",
      login: null,
      message: "Run `gh auth login -h github.com` in a terminal, then reload this page.",
    });

    renderWithProviders(<SettingsContainer mode="setup" />);
    await user.click(screen.getByRole("button", { name: "Save settings" }));

    expect(screen.getByText("A GitHub repository is required.")).toBeTruthy();
  });

  test("saves a valid repository to the store and localStorage", async () => {
    const user = userEvent.setup();
    mockStatusResponse({
      authenticated: true,
      cliAvailable: true,
      host: "github.com",
      login: "alexis",
      message: "Connected locally as @alexis through gh.",
    });

    renderWithProviders(<SettingsContainer mode="setup" />);
    await user.type(screen.getByLabelText("Repository"), "openai/pr-status");
    await user.click(screen.getByRole("button", { name: "Save settings" }));

    expect(useSettingsStore.getState().settings.owner).toBe("openai");
    expect(useSettingsStore.getState().settings.repo).toBe("pr-status");
    expect(window.localStorage.getItem(SETTINGS_STORAGE_KEY)).toContain('"repo":"pr-status"');
  });
});

function mockStatusResponse(payload: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }),
    ),
  );
}
