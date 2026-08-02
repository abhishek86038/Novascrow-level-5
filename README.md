# 🌌 NovaTrust

### Trustless Crowdfunding and Milestone-Based Reward Badges on Stellar Soroban
*A production-ready decentralized crowdfunding suite built for Level 4 (Green Belt) of the Stellar Builder Challenge.*

[![CI/CD Pipeline](https://github.com/Abhishek86038/NovaTrust3.1/actions/workflows/ci.yml/badge.svg)](https://github.com/Abhishek86038/NovaTrust3.1/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 1. Title & Tagline

**NovaTrust: Escrow-Driven Crowdfunding on Stellar**
*Don't just trust the creator—trust the smart contract. Milestone-gated funding secured by the community.*

---

## 2. Overview

NovaTrust evolves traditional crowdfunding into a fully decentralized, milestone-based Escrow system on the Stellar network using Soroban smart contracts. 

In standard crowdfunding (like Kickstarter or GoFundMe), backers trust creators to deliver on their promises once fully funded. Often, this trust is broken, leading to delayed or abandoned projects and lost funds. NovaTrust Escrow solves this:
- Funds are **locked in a Soroban smart contract escrow** instead of being instantly released.
- Projects are divided into **4 core milestones** (25%, 50%, 75%, 100%).
- Creators must submit **cryptographic proof** of progress (e.g., IPFS hash or URL) to unlock the next tranche of funds.
- Donors **vote** to approve or reject the submitted proof. Voting power is weighted by their cumulative donation amount.
- If a milestone is approved, 25% of the funds are released. If rejected, donors can **claim a refund** for the remaining balance.

This creates a high-trust environment: creators get incremental funding to build, and donors maintain control over their unspent capital if the project goes off track. This project represents the evolution from the Level 1-3 baseline into a robust, production-ready MVP.

---

## 3. Problem Statement & Why Stellar

### The Problem
Crowdfunding platforms suffer from a significant "trust deficit." Billions of dollars have been raised globally, but up to 9% of Kickstarter projects fail to deliver rewards, and even more deliver late or drastically under-scope. Donors bear 100% of the risk once the campaign goal is met.

### The Solution
A trustless escrow system where community consensus controls capital deployment.

### Why Stellar?
Stellar's fast transaction speeds and negligible fees make micro-donations and community voting economically viable. Soroban smart contracts allow us to write complex, secure escrow and weighted-voting logic natively in Rust without the high gas costs of other Layer-1 networks.

---

## 4. Architecture

### Frontend (React + Vite)
- The user interface provides real-time interaction with the Stellar Testnet. 
- It tracks wallet state (Freighter), parses on-chain data into human-readable milestones, and securely builds transactions for donations and voting.
- Built using React, TailwindCSS, and `@stellar/freighter-api`.

### Smart Contracts (Soroban/Rust)
1. **Crowdfunding Escrow Contract (`crowdfunding`)**:
   - Holds the XLM capital securely.
   - Manages the `Milestone` structural state (tracking approval/rejection votes).
   - Dynamically calculates vote weight based on donor history.
2. **Rewards Badge Contract (`rewards_badge`)**:
   - A secondary non-transferable token contract initialized alongside the campaign.
   - Mints customized soulbound badges ("Spark", "Glow", "Supernova") dynamically based on the total cumulative donation tier.

### Data Flow
1. **Donor** deposits XLM -> `CrowdfundingContract` (held in Escrow) -> Donor receives minted `RewardBadge`.
2. **Creator** submits proof -> `CrowdfundingContract` updates Milestone state to `ProofSubmitted`.
3. **Donors** submit votes -> `CrowdfundingContract` tallies weighted votes.
4. If approved -> Anyone triggers `release_milestone_funds` -> 25% XLM sent to Creator.
5. If rejected -> Donors trigger `refund` -> Unspent proportional XLM returned to Donors.

---

## 5. Features

- **Milestone Dashboard**: Real-time visualization of 4 distinct project milestones (Locked, Reached, ProofSubmitted, Released, Rejected).
- **Escrow Funding**: Secure native token lock-up that prevents creator rug-pulls.
- **Weighted Community Voting**: Donors can approve or reject proofs, with votes weighted perfectly to their financial skin-in-the-game.
- **Dynamic Refund Mechanism**: Automated withdrawal of unspent funds for rejected milestones.
- **Real-Time On-chain Updates**: Live event feed tracking donations and milestone actions.
- **Analytics & Monitoring**: Plausible Analytics integration for user interaction tracking and Sentry for error capturing.
- **Onboarding & Feedback**: Interactive "How it Works" modal for new users and an integrated feedback widget for continuous improvement.
- **Glassmorphic UI**: Premium, mobile-responsive, star-themed design tailored for the Stellar ecosystem.

---

## 6. Tech Stack

- **Smart Contracts**: Rust, Soroban SDK `v22.0.11`
- **Frontend Framework**: React 19, TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS v4, Vanilla CSS
- **Stellar Integration**: `@stellar/stellar-sdk` v16, `@stellar/freighter-api` v6
- **Testing**: Cargo test (Rust), Vitest/JSDOM (Frontend)
- **Monitoring/Analytics**: `@sentry/react`, Plausible Analytics (Mock wrappers integrated)
- **Linting**: Oxlint

---

## 7. Smart Contracts

### Crowdfunding Escrow Contract
**Deployed Contract ID:** `CAIMIW3QWDDNPCVWMPTAKLTRFEELB4DLQY6ZFUG5EG6EGCZ3N4TH2EH3`
- `initialize(campaign_owner, goal_amount, token, badge_contract)`: Sets up the campaign.
- `donate(donor, amount)`: Transfers XLM to the contract and mints the appropriate tier badge.
- `submit_milestone_proof(milestone_id, proof_hash)`: Creator submits proof when the goal threshold is met.
- `vote_on_milestone(donor, milestone_id, approve)`: Casts a weighted vote.
- `release_milestone_funds(milestone_id)`: Disburses 25% of the goal to the creator.
- `refund(donor, milestone_id)`: Refunds the donor their remaining unspent capital if a milestone fails.

### Rewards Badge Contract
**Deployed Contract ID:** `CAJAQWB4MUJ3VPG4EIL2TEKGEW7BCKFK6AN6A6CRNKBXPRPDYCZGN433`
- `initialize(admin, name, symbol)`: Sets up the soulbound token.
- `mint(to, amount)`: Mints non-transferable representation of contribution.
- `balance(id)`: Returns the badge balance/tier.

---

## 8. Live Demo & Video

- **Live Demo URL:** [NovaTrust Live Website](https://novatrust-a5.vercel.app/)
- **Demo Video Link:** [Watch the Video on YouTube](https://youtu.be/WZeQO9A-DmE)
- **Sample Transaction Hash:** `61260bd49d3b17dae5c33210e50e80dbfd57142f08efd78ec04279087fc883d1`

---

## 9. Prerequisites & Setup & Installation

### Prerequisites
1. **Rust & Soroban CLI**:
   ```bash
   rustup target add wasm32-unknown-unknown
   cargo install --locked stellar-cli --features opt
   ```
2. **Node.js**: v18+
3. **Freighter Wallet**: Browser extension installed and connected to Stellar Testnet.

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/Abhishek86038/NovaTrust.git
   cd NovaTrust
   ```
2. Install frontend dependencies:
   ```bash
   npm install
   ```
3. Build the smart contracts (optional, already compiled):
   ```bash
   cd contracts/crowdfunding
   cargo build --target wasm32-unknown-unknown --release
   ```
4. Start the frontend:
   ```bash
   npm run dev
   ```

---

## 10. How to Use

1. **Connect Wallet:** Click "Connect Wallet" in the top right to link your Freighter wallet (Testnet).
2. **Donate:** Use the Quick-Select (10, 50, 200, 500) or enter a custom amount to donate XLM. Sign the transaction in Freighter. Your funds are now in Escrow and you've minted a Reward Badge.
3. **View Milestones:** Scroll down to the Milestone Dashboard. As funding hits 25%, 50%, etc., milestones will change from "Locked" to "Reached".
4. **Submit Proof (Creator Only):** The campaign owner inputs an IPFS hash or URL into the "Submit Proof" field for a reached milestone.
5. **Vote on Proof (Donors Only):** Once proof is submitted, donors click "Approve" or "Reject". 
6. **Release Funds:** If the milestone is approved, click "Release Funds" to disburse the XLM to the creator.
7. **Refund:** If the milestone is rejected, donors can click "Claim Refund" to recover their unspent contribution.

---

## 11. Running Tests

### Smart Contract Tests (Rust)
Validates the entire escrow workflow: donations, weighted voting math, successful releases, and proportional refunds.
```bash
cd contracts/crowdfunding
cargo test
```

### Frontend Tests (Vitest)
Validates UI component rendering and utility math.
```bash
npm run test
```

---

## 12. Analytics & Monitoring

- **Analytics (Plausible):** Wrapped in `src/services/analytics.ts`. Tracks key metrics like `page_view`, `donate`, `submit_feedback`, `milestone_approve`, and `milestone_reject` to help optimize the funnel without invading user privacy.
- **Monitoring (Sentry):** Wrapped in `src/services/monitoring.ts` and integrated via `ErrorBoundary.tsx`. Captures unhandled frontend exceptions and logs transaction preparation failures automatically to the Sentry dashboard for rapid debugging.
- **Analytics Dashboard Link:** `<ANALYTICS_DASHBOARD_LINK>`

---

## 13. User Onboarding & Feedback Summary

### Onboarding Flow
First-time visitors are greeted with the `OnboardingModal` which succinctly explains the concept of "Escrow Smart Contracts" and "Milestone Voting". It guides them to install Freighter and use the Friendbot to obtain Testnet XLM.

### Feedback Loop
Users can click the persistent "Feedback" widget to leave a 1-5 star rating and comment, seamlessly tracked via our Analytics wrapper.

**Feedback Summary from Beta Testing:**

We collected real feedback from our beta users. Here is the list of user responses:

### 1. Collected Beta Feedback (Raw Data)

| Name | Email | Wallet Address | Suggestion / Feedback |
| --- | --- | --- | --- |
| (Placeholder for Tester 1) | (Email 1) | (Wallet Address 1) | (August feedback suggestion will go here) |
| (Placeholder for Tester 2) | (Email 2) | (Wallet Address 2) | (August feedback suggestion will go here) |

### 2. Implementation & Commit ID Mapping

| Name | Wallet Address | Suggestion / Feedback | Commit ID |
| --- | --- | --- | --- |
| (Placeholder for Tester 1) | (Wallet Address 1) | (August feedback suggestion will go here) | (August Commit ID) |
| (Placeholder for Tester 2) | (Wallet Address 2) | (August feedback suggestion will go here) | (August Commit ID) |



---

## 14. User Growth & Proof of Users

NovaTrust actively tracks its user growth using Plausible Analytics and on-chain interaction metrics. Below is the record of unique wallets that successfully performed transactions on the Stellar Testnet in August:

📄 **Download Full CSV:** [user_growth_proof.csv](user_growth_proof.csv) — Contains all on-chain donation and interaction records (Wallet Address, Action, Transaction Hash)

<details>
<summary>Click to view August User Interactions</summary>

| Wallet Address | Action | Transaction Hash |
| --- | --- | --- |
| (August wallet address placeholder) | (August action placeholder) | (August transaction hash placeholder) |
| (August wallet address placeholder) | (August action placeholder) | (August transaction hash placeholder) |

</details>

---

## 15. User Data Collection & Excel Export

To build a robust pipeline for future Mainnet launch and marketing, user details including Wallet Address, Email, Name, Rating, and Comments are actively collected via our in-app feedback widget powered by a Google Form integration.

- **Google Form Link:** [NovaTrust Feedback Form](https://docs.google.com/forms/d/e/1FAIpQLScvfle5MlnZAbLOeaP6W7vX33h0hTYXVwyyJQWPmuBhTgftqQ/viewform?pli=1&pli=1)
- **Google Sheet Link (Exported Data):** [NovaTrust Feedback Sheets Data](https://docs.google.com/spreadsheets/d/1ZDsFvUHNoKn2T-9BPVVMjSmlpU2ciXB8jStX7FzXY3Q/edit?usp=sharing)
- *Note: Exported responses are also available as a CSV/XLSX (`user_growth_proof.csv`) in this repository for review.*

---

## 16. CI/CD Pipeline

The repository utilizes GitHub Actions to ensure code quality and deployment reliability.
- **On Push/PR:**
  - Runs `cargo test` for Soroban smart contracts.
  - Runs `oxlint` for frontend code quality.
  - Runs `npm run build` to verify Vite compilation.
  - Runs `npm run test` for frontend unit tests.

---

## 17. Screenshots (Level 5)

Please add new screenshots for the August NovaTrust submission in the `./screenshots/` directory:

- **Analytics Dashboard:**
  <!-- Save your new analytics screenshot as screenshots/analytics.png and embed here -->
  *Placeholder: Add screenshot of August Analytics Dashboard here*
  
- **Improved Onboarding Flow (New onboarding modal):**
  <!-- Save your new onboarding screenshot as screenshots/onboarding.png and embed here -->
  *Placeholder: Add screenshot of August Onboarding Modal here*

---

## 18. Project Structure

```text
NovaTrust/
├── contracts/
│   ├── crowdfunding/
│   │   ├── src/
│   │   │   ├── lib.rs          # Escrow & Milestone logic
│   │   │   └── test.rs         # Comprehensive Rust tests
│   │   └── Cargo.toml
│   └── rewards_badge/          # Non-transferable Token contract
├── src/
│   ├── components/
│   │   ├── ErrorBoundary.tsx   # Sentry Integration
│   │   ├── FeedbackForm.tsx    # User Feedback Widget
│   │   ├── MilestoneDashboard.tsx # Escrow UI 
│   │   └── OnboardingModal.tsx # How-It-Works modal
│   ├── services/
│   │   ├── analytics.ts        # Plausible wrapper
│   │   └── monitoring.ts       # Sentry wrapper
│   ├── App.tsx                 # Main application logic
│   ├── stellar.ts              # Stellar RPC & Freighter integrations
│   ├── main.tsx                # React entry point
│   └── index.css               # Tailwind & Custom styling
├── package.json
└── vite.config.ts
```

---

## 19. Error Handling Implemented

1. **Smart Contract Validations:** Strict checks (e.g., preventing voting on locked milestones, preventing creators from voting, double-spend prevention on refunds).
2. **Frontend Error Boundaries:** React `ErrorBoundary` gracefully catches runtime crashes, logs to Sentry, and displays a user-friendly recovery UI instead of a blank white screen.
3. **Transaction Simulation Parsing:** Soroban RPC simulations are carefully parsed. If simulation fails, human-readable error messages (e.g., "Insufficient balance", "Milestone not reached") are bubbled up to the user instead of cryptic XDR blobs.
4. **Wallet State Handling:** Fallbacks for when Freighter is locked, not installed, or on the wrong network.

---

## 20. Known Limitations / Mainnet Roadmap

- **Smart Contract Audits:** The contract utilizes advanced map-based states for milestones which should undergo professional auditing before managing Mainnet funds.
- **Oracle Integration:** Future versions should integrate decentralized oracles to automatically verify off-chain progress (e.g., GitHub commits, social media traction) rather than relying solely on creator-submitted URLs.
- **Tiered Milestone Percentages:** Currently hardcoded to 25% tranches. Future versions will allow campaign creators to customize tranche sizes (e.g., 10%, 40%, 50%) during contract initialization.
- **Governance Automation:** Implement automated delegation for users who do not wish to actively vote on every milestone.

---

## 21. License

This project is licensed under the [MIT License](LICENSE).
