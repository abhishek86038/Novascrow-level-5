import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import App from "./App";

// Mock Freighter API
vi.mock("@stellar/freighter-api", () => {
  return {
    isConnected: vi.fn(() => Promise.resolve({ isConnected: true })),
    getAddress: vi.fn(() => Promise.resolve({ address: "GCYMLCJTY6KNGGWRXHNMPDVQIPJZDQKHU45W4TA3QUELIPCFKY3ARHF5" })),
    requestAccess: vi.fn(() => Promise.resolve({ address: "GCYMLCJTY6KNGGWRXHNMPDVQIPJZDQKHU45W4TA3QUELIPCFKY3ARHF5" })),
    signTransaction: vi.fn(),
  };
});

// Mock Stellar operations
vi.mock("./stellar", () => {
  return {
    getXlmBalance: vi.fn(() => Promise.resolve("1250.5000")),
    getCampaignGoal: vi.fn(() => Promise.resolve(1000)),
    getCampaignTotalRaised: vi.fn(() => Promise.resolve(250)),
    getUserBadgeTier: vi.fn(() => Promise.resolve(1)), // Bronze
    getCurrentLedger: vi.fn(() => Promise.resolve(104235)),
    prepareDonateTransaction: vi.fn(),
    submitAndPollTransaction: vi.fn(),
    getCampaignEvents: vi.fn(() =>
      Promise.resolve([
        {
          id: "tx-hash-1",
          type: "donation",
          actor: "GCYMLCJTY6KNGGWRXHNMPDVQIPJZDQKHU45W4TA3QUELIPCFKY3ARHF5",
          amount: 50,
          ledger: 104230,
        },
      ])
    ),
    CROWDFUNDING_CONTRACT_ID: "CAIMIW3QWDDNPCVWMPTAKLTRFEELB4DLQY6ZFUG5EG6EGCZ3N4TH2EH3",
    REWARDS_BADGE_CONTRACT_ID: "CAJAQWB4MUJ3VPG4EIL2TEKGEW7BCKFK6AN6A6CRNKBXPRPDYCZGN433",
    XLM_NATIVE_CONTRACT_ID: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
  };
});

describe("NovaTrust Frontend Dashboard", () => {
  beforeEach(() => {
    vi.stubGlobal("alert", vi.fn());
  });

  it("renders the campaign info and progress correctly", async () => {
    render(<App />);

    expect(screen.getByText("NovaTrust Crowdfunding")).toBeDefined();
    expect(screen.getByText("Milestone: 1,000 XLM")).toBeDefined();
    expect(screen.getByText("Active Network: Stellar Testnet")).toBeDefined();

    await waitFor(() => {
      const elements = screen.getAllByText((_, element) => {
        const normalized = element?.textContent?.replace(/\s+/g, "").toLowerCase() || "";
        return normalized === "+50xlm";
      });
      expect(elements.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("auto-connects wallet on mount and allows disconnect", async () => {
    render(<App />);

    // Wait for navbar to show connected address and disconnect button
    await waitFor(() => {
      const navbar = screen.getByRole("navigation");
      expect(navbar.textContent).toContain("GCYMLC");
      expect(navbar.textContent).toContain("3ARHF5");
    });

    // Check that profile card shows correct balance
    const balanceTitle = screen.getByText("Your Balance");
    expect(balanceTitle).toBeDefined();
    const balanceContainer = balanceTitle.parentElement;
    expect(balanceContainer?.textContent).toContain("1,250.5");

    // Click disconnect button in navbar
    const disconnectBtn = screen.getByText("Disconnect");
    expect(disconnectBtn).toBeDefined();
    fireEvent.click(disconnectBtn);

    // It should now show "Connect Wallet"
    await waitFor(() => {
      const connectBtns = screen.getAllByText("Connect Wallet");
      expect(connectBtns.length).toBeGreaterThan(0);
    });
  });

  it("updates upcoming badge estimator when typing custom donation values", async () => {
    render(<App />);

    const input = screen.getByPlaceholderText("Enter custom amount...") as HTMLInputElement;

    // Change donation amount to 300
    fireEvent.change(input, { target: { value: "300" } });
    expect(input.value).toBe("300");

    await waitFor(() => {
      expect(screen.getByText(/Target Badge Reward:/i)).toBeDefined();
    });
  });
});
