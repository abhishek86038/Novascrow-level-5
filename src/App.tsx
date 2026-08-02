import React, { useState, useEffect, useRef } from "react";
import {
  isConnected,
  getAddress,
  requestAccess,
  signTransaction
} from "@stellar/freighter-api";
import {
  getXlmBalance,
  getCampaignGoal,
  getCampaignTotalRaised,
  getUserBadgeTier,
  getCurrentLedger,
  prepareDonateTransaction,
  submitAndPollTransaction,
  getCampaignEvents,
  CROWDFUNDING_CONTRACT_ID,
  REWARDS_BADGE_CONTRACT_ID,
  getMilestoneStatus
} from "./stellar";
import type { CampaignEvent } from "./stellar";
import { MilestoneDashboard } from "./components/MilestoneDashboard";
import { OnboardingModal } from "./components/OnboardingModal";
import { FeedbackForm } from "./components/FeedbackForm";
import { trackEvent } from "./services/analytics";

export default function App() {
  // Wallet state
  const [walletConnected, setWalletConnected] = useState(false);
  const [userAddress, setUserAddress] = useState("");
  const [userBalance, setUserBalance] = useState("0");
  const [userBadgeTier, setUserBadgeTier] = useState(0);

  // Campaign state
  const [goal, setGoal] = useState<number>(1000);
  const [raised, setRaised] = useState<number>(0);
  const [events, setEvents] = useState<CampaignEvent[]>([]);
  const [currentLedger, setCurrentLedger] = useState<number>(0);
  const [milestones, setMilestones] = useState<any[]>([]);

  // Shooting star animation state
  interface ShootingStar {
    id: string;
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    color: string;
  }
  const [shootingStars, setShootingStars] = useState<ShootingStar[]>([]);

  // Action states
  const [donateAmount, setDonateAmount] = useState<string>("50");
  const [loadingAction, setLoadingAction] = useState<string>(""); // "", "preparing", "freighter", "chain", "success", "error"
  const [errorMessage, setErrorMessage] = useState("");
  const [successTxHash, setSuccessTxHash] = useState("");

  // UI States
  const [activeTab, setActiveTab] = useState<"all" | "donations" | "badges">("all");
  const [lightMode, setLightMode] = useState(false);

  // Toast state
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`${label} copied to clipboard!`, "success");
  };

  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Fetch campaign details and events
  const loadCampaignData = async () => {
    try {
      const liveGoal = await getCampaignGoal();
      const liveRaised = await getCampaignTotalRaised();
      if (liveGoal > 0) setGoal(liveGoal);
      setRaised(liveRaised);

      const liveEvents = await getCampaignEvents();
      setEvents(liveEvents);

      const ledger = await getCurrentLedger();
      if (ledger > 0) setCurrentLedger(ledger);

      // Fetch milestones
      const ms = [];
      for (let i = 1; i <= 4; i++) {
        const status = await getMilestoneStatus(i);
        if (status) ms.push(status);
      }
      setMilestones(ms);
    } catch (e) {
      console.error("Error loading campaign data:", e);
    }
  };

  // Fetch user details
  const loadUserData = async (address: string) => {
    if (!address) return;
    try {
      const balance = await getXlmBalance(address);
      setUserBalance(balance);

      const tier = await getUserBadgeTier(address);
      setUserBadgeTier(tier);
    } catch (e) {
      console.error("Error loading user data:", e);
    }
  };

  // Check if wallet already connected or Freighter exists on mount
  useEffect(() => {
    const initWallet = async () => {
      try {
        const hasFreighter = await isConnected();
        if (hasFreighter && hasFreighter.isConnected) {
          const keyResult = await getAddress();
          if (keyResult && keyResult.address) {
            setUserAddress(keyResult.address);
            setWalletConnected(true);
            loadUserData(keyResult.address);
          }
        }
      } catch (err) {
        console.error("Failed to initialize wallet:", err);
      }
    };

    initWallet();
    loadCampaignData();
  }, []);

  // Poll events and campaign raised amount every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadCampaignData();
      if (userAddress) {
        loadUserData(userAddress);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [userAddress]);

  // Constellation coordinate positions
  const nodes = [
    { label: "10%", amount: goal * 0.1, x: 60, y: 150 },
    { label: "25%", amount: goal * 0.25, x: 130, y: 70 },
    { label: "50%", amount: goal * 0.5, x: 200, y: 160 },
    { label: "75%", amount: goal * 0.75, x: 270, y: 60 },
    { label: "100%", amount: goal * 1.0, x: 340, y: 130 }
  ];

  // Helper for computing partially drawn lines between constellation nodes
  const getLineCoords = (
    nodeA: typeof nodes[0],
    nodeB: typeof nodes[0],
    startPct: number,
    endPct: number,
    currentPct: number
  ) => {
    if (currentPct <= startPct) {
      return { x2: nodeA.x, y2: nodeA.y, opacity: 0 };
    }
    if (currentPct >= endPct) {
      return { x2: nodeB.x, y2: nodeB.y, opacity: 1 };
    }
    const ratio = (currentPct - startPct) / (endPct - startPct);
    const x2 = nodeA.x + (nodeB.x - nodeA.x) * ratio;
    const y2 = nodeA.y + (nodeB.y - nodeA.y) * ratio;
    return { x2, y2, opacity: 1 };
  };

  // Parametric star generator
  const drawStarPath = (cx: number, cy: number, rOuter: number, rInner: number) => {
    let path = "";
    for (let i = 0; i < 5; i++) {
      const angleOuter = (i * 72 - 90) * (Math.PI / 180);
      const xOuter = cx + rOuter * Math.cos(angleOuter);
      const yOuter = cy + rOuter * Math.sin(angleOuter);

      const angleInner = ((i + 0.5) * 72 - 90) * (Math.PI / 180);
      const xInner = cx + rInner * Math.cos(angleInner);
      const yInner = cy + rInner * Math.sin(angleInner);

      if (i === 0) {
        path += `M ${xOuter} ${yOuter} L ${xInner} ${yInner} `;
      } else {
        path += `L ${xOuter} ${yOuter} L ${xInner} ${yInner} `;
      }
    }
    path += "Z";
    return path;
  };

  // Listen for new transactions to fire shooting stars
  const prevEventsRef = useRef<CampaignEvent[]>([]);
  useEffect(() => {
    if (prevEventsRef.current.length === 0) {
      prevEventsRef.current = events;
      return;
    }

    const newEvents = events.filter(
      (ev) => !prevEventsRef.current.some((prev) => prev.id === ev.id)
    );

    if (newEvents.length > 0) {
      const newStars: ShootingStar[] = newEvents.map((ev) => {
        const targetNode = nodes[Math.floor(Math.random() * nodes.length)];
        const badgeTier = events.find(
          (b) => b.type === "badge_mint" && b.actor === ev.actor && Math.abs(b.ledger - ev.ledger) <= 1
        )?.tier;

        let color = "#A855F7"; // Default nebula cyan
        if (badgeTier === "Bronze") color = "#C084FC"; // Spark gold
        if (badgeTier === "Silver") color = "#7E86A3"; // Glow silver
        if (badgeTier === "Gold") color = "#C084FC"; // Supernova gold

        return {
          id: `${ev.id}-${Date.now()}-${Math.random()}`,
          fromX: Math.random() > 0.5 ? 0 : 400 * Math.random(),
          fromY: 220,
          toX: targetNode.x,
          toY: targetNode.y,
          color,
        };
      });

      // Skip animations if user has prefers-reduced-motion active
      const prefersReducedMotion =
        typeof window !== "undefined" && window.matchMedia
          ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
          : false;
      if (!prefersReducedMotion) {
        setShootingStars((prev) => [...prev, ...newStars]);
        setTimeout(() => {
          setShootingStars((prev) => prev.filter((star) => !newStars.some((ns) => ns.id === star.id)));
        }, 1200);
      }
    }

    prevEventsRef.current = events;
  }, [events]);

  const handleConnectWallet = async () => {
    try {
      const hasFreighter = await isConnected();
      if (!hasFreighter || !hasFreighter.isConnected) {
        alert("Freighter Wallet is not installed or disabled. Please install it to interact with this dApp.");
        return;
      }
      const keyResult = await requestAccess();
      if (keyResult && keyResult.address) {
        setUserAddress(keyResult.address);
        setWalletConnected(true);
        loadUserData(keyResult.address);
        showToast("Wallet connected successfully!", "success");
      } else if (keyResult && keyResult.error) {
        alert(`Failed to retrieve address: ${keyResult.error}`);
      }
    } catch (err: any) {
      console.error("Wallet connection failed:", err);
      alert("Failed to retrieve public key from Freighter.");
    }
  };

  const handleDisconnectWallet = () => {
    setUserAddress("");
    setWalletConnected(false);
    setUserBalance("0");
    setUserBadgeTier(0);
    showToast("Wallet disconnected.", "info");
  };

  const handleDonate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletConnected || !userAddress) {
      handleConnectWallet();
      return;
    }

    const amountNum = parseFloat(donateAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setErrorMessage("Please enter a valid donation amount greater than 0.");
      setLoadingAction("error");
      return;
    }

    if (amountNum > parseFloat(userBalance)) {
      setErrorMessage(`Insufficient balance. You only have ${userBalance} XLM.`);
      setLoadingAction("error");
      return;
    }

    setLoadingAction("preparing");
    setErrorMessage("");
    setSuccessTxHash("");

    try {
      const unsignedTxXdr = await prepareDonateTransaction(userAddress, amountNum);

      setLoadingAction("freighter");
      const signResult = await signTransaction(unsignedTxXdr, {
        networkPassphrase: "Test SDF Network ; September 2015",
      });

      if (signResult.error) {
        throw new Error(`Freighter signing error: ${signResult.error}`);
      }

      const signedTxXdr = signResult.signedTxXdr;

      setLoadingAction("chain");
      const txHash = await submitAndPollTransaction(signedTxXdr);

      setSuccessTxHash(txHash);
      setLoadingAction("success");
      setDonateAmount("50");
      showToast(`Donation of ${amountNum} XLM successful!`, "success");
      trackEvent("donate", { amount: amountNum });

      await loadCampaignData();
      await loadUserData(userAddress);

      setTimeout(async () => {
        await loadCampaignData();
        await loadUserData(userAddress);
      }, 2500);
    } catch (err: any) {
      console.error("Donation failed:", err);
      setErrorMessage(err.message || "An unexpected error occurred during transaction execution.");
      setLoadingAction("error");
    }
  };

  // Rebranded badge ("Light Tier") helper details
  const getBadgeDetails = (tier: number) => {
    switch (tier) {
      case 1:
        return { name: "Spark", color: "from-amber-600 to-amber-800", text: "Flickering Light" };
      case 2:
        return { name: "Glow", color: "from-slate-400 to-slate-500", text: "Steady Starlight" };
      case 3:
        return { name: "Supernova", color: "from-yellow-400 to-yellow-600 animate-pulse", text: "Infinite Radiance" };
      default:
        return { name: "No Badge", color: "from-gray-700 to-gray-800", text: "Backer" };
    }
  };

  const currentBadge = getBadgeDetails(userBadgeTier);

  // Calculate upcoming badge tier based on current tier & entered amount
  const getUpcomingBadgeInfo = () => {
    const currentDonate = parseFloat(donateAmount) || 0;
    if (userBadgeTier >= 3) return null; // Already maxed out
    
    if (userBadgeTier === 0) {
      if (currentDonate >= 500) return { tier: "Supernova", next: 500 };
      if (currentDonate >= 200) return { tier: "Glow", next: 200 };
      if (currentDonate >= 50) return { tier: "Spark", next: 50 };
      return { tier: "Spark", next: 50, diff: 50 - currentDonate };
    } else if (userBadgeTier === 1) {
      if (currentDonate >= 450) return { tier: "Supernova", next: 500 };
      if (currentDonate >= 150) return { tier: "Glow", next: 200 };
      return { tier: "Glow", next: 200, diff: 150 - currentDonate };
    } else if (userBadgeTier === 2) {
      if (currentDonate >= 300) return { tier: "Supernova", next: 500 };
      return { tier: "Supernova", next: 500, diff: 300 - currentDonate };
    }
    return null;
  };

  const upcomingBadge = getUpcomingBadgeInfo();

  // Progress calculations
  const progressPercent = Math.min(100, Math.floor((raised / goal) * 100));

  const filteredEvents = events.filter((ev) => {
    if (activeTab === "all") return true;
    if (activeTab === "donations") return ev.type === "donation";
    if (activeTab === "badges") return ev.type === "badge_mint";
    return true;
  });

  return (
    <div className={`min-h-screen bg-[#080510] text-[#F4F6FF] font-sans antialiased relative transition-colors duration-300 ${lightMode ? 'light-mode bg-slate-50 text-slate-900' : ''}`}>
      <OnboardingModal />
      <FeedbackForm />
      
      {/* Parallax Starfield */}
      <div className="starfield-container">
        <div className="star-layer star-layer-1" />
        <div className="star-layer star-layer-2" />
      </div>

      {/* Navigation Header */}
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-[#140E28]/80 border-b border-slate-800/80 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#6366F1] to-[#A855F7] flex items-center justify-center font-bold text-[#F4F6FF] shadow-lg shadow-purple-500/25 font-display text-xl">
              N
            </div>
            <div>
              <span className="text-xl font-extrabold tracking-tight font-display bg-gradient-to-r from-[#6366F1] to-[#A855F7] bg-clip-text text-transparent">
                NovaTrust
              </span>
              <span className="ml-2 px-2 py-0.5 text-[10px] font-semibold bg-[#080510] text-[#A855F7] rounded-full border border-[#6366F1]/50 uppercase tracking-widest font-mono">
                Testnet
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                setLightMode(!lightMode);
                showToast(`Switched to ${!lightMode ? "Light" : "Dark"} Mode`, "info");
              }}
              className="p-2 rounded-full border border-slate-800 bg-[#080510]/80 hover:bg-[#140E28] text-slate-400 hover:text-slate-200 transition cursor-pointer"
              title="Toggle Light/Dark Mode"
            >
              {lightMode ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
            {walletConnected ? (
              <div className="flex items-center gap-3 bg-[#080510]/90 border border-slate-800 rounded-full px-4 py-1.5 shadow-inner">
                <span className="w-2.5 h-2.5 rounded-full bg-[#34D399] animate-ping" />
                <span className="text-sm font-medium text-[#7E86A3] font-mono flex items-center gap-1.5">
                  {userAddress.slice(0, 6)}...{userAddress.slice(-6)}
                  <button
                    onClick={() => copyToClipboard(userAddress, "Wallet Address")}
                    className="text-slate-500 hover:text-slate-300 p-0.5 rounded-md transition cursor-pointer"
                    title="Copy Wallet Address"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                  </button>
                </span>
                <button
                  onClick={handleDisconnectWallet}
                  className="text-xs text-[#F87171] hover:text-[#F87171]/80 font-semibold transition ml-2 border-l border-slate-800 pl-3 py-0.5 cursor-pointer"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={handleConnectWallet}
                className="relative group overflow-hidden rounded-full p-[1px] focus:outline-hidden cursor-pointer"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-[#6366F1] to-[#A855F7] rounded-full transition group-hover:scale-105 duration-300" />
                <div className="px-6 py-2 bg-[#080510] rounded-full relative group-hover:bg-[#140E28] transition duration-300">
                  <span className="text-sm font-bold bg-gradient-to-r from-[#A855F7] to-[#C084FC] bg-clip-text text-transparent group-hover:text-white font-display">
                    Connect Wallet
                  </span>
                </div>
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 py-10 relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Side: Campaign details, Donate & Badge tiers (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-8">
          
          {/* Campaign Info & Progress Card */}
          <div className="bg-[#140E28]/60 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
              <div>
                <h1 className="text-4xl font-black tracking-tight mb-2 font-display text-[#F4F6FF] flex items-center gap-3">
                  NovaTrust Crowdfunding
                  <button
                    onClick={() => {
                      copyToClipboard(window.location.href, "Campaign Link");
                    }}
                    className="p-1.5 rounded-full border border-slate-805 bg-[#080510]/80 hover:bg-[#140E28] text-slate-400 hover:text-[#A855F7] transition cursor-pointer shrink-0"
                    title="Share Campaign"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 10.742l4.632-2.316m0 0a3 3 0 100-4.243 3 3 0 000 4.243zm0 4.243L8.684 14.26m0 0a3 3 0 100 4.243 3 3 0 000-4.243z" />
                    </svg>
                  </button>
                </h1>
                <p className="text-[#7E86A3] text-sm max-w-xl font-sans">
                  Support the development of NovaTrust. Every contribution helps shape the future of Stellar and lights up the constellation grid.
                </p>
              </div>
              <div className="bg-[#080510]/90 border border-slate-800 rounded-2xl px-5 py-4 flex flex-col items-end shrink-0 shadow-inner">
                <span className="text-xs text-[#7E86A3] font-semibold uppercase tracking-wider font-sans">Campaign ID</span>
                <div className="flex items-center gap-1.5 mt-1">
                  <a
                    href={`https://stellar.expert/explorer/testnet/contract/${CROWDFUNDING_CONTRACT_ID}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-[#C084FC] hover:text-[#C084FC]/80 font-mono transition underline decoration-dashed"
                  >
                    {CROWDFUNDING_CONTRACT_ID.slice(0, 10)}...{CROWDFUNDING_CONTRACT_ID.slice(-10)}
                  </a>
                  <button
                    onClick={() => copyToClipboard(CROWDFUNDING_CONTRACT_ID, "Campaign ID")}
                    className="text-slate-500 hover:text-slate-300 p-0.5 rounded-md transition cursor-pointer"
                    title="Copy Campaign ID"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* The Constellation Map */}
            <div className="mb-6 bg-[#080510]/95 rounded-2xl border border-slate-800/80 p-5 relative overflow-hidden">
              <div className="absolute inset-0 bg-radial from-[#6366F1]/5 to-transparent pointer-events-none" />
              
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs uppercase tracking-wider text-[#7E86A3] font-bold font-sans">
                  Campaign Grid Constellation
                </span>
                <span className="text-xs text-[#C084FC] font-bold font-mono">
                  {progressPercent}% Illuminated
                </span>
              </div>

              {/* Constellation SVG */}
              <div className="w-full flex justify-center">
                <svg
                  width="100%"
                  height="220"
                  viewBox="0 0 400 220"
                  className="max-w-[400px] overflow-visible"
                >
                  <defs>
                    <radialGradient id="starGlow" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#C084FC" stopOpacity="1" />
                      <stop offset="30%" stopColor="#C084FC" stopOpacity="0.5" />
                      <stop offset="100%" stopColor="#C084FC" stopOpacity="0" />
                    </radialGradient>
                    <linearGradient id="nebulaLine" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#6366F1" />
                      <stop offset="100%" stopColor="#A855F7" />
                    </linearGradient>
                  </defs>

                  {/* Starfield Backdrop inside SVG */}
                  <g opacity="0.3">
                    <circle cx="30" cy="40" r="0.7" fill="#FFF" />
                    <circle cx="150" cy="180" r="0.5" fill="#FFF" />
                    <circle cx="280" cy="30" r="0.8" fill="#FFF" />
                    <circle cx="370" cy="90" r="0.6" fill="#FFF" />
                    <circle cx="90" cy="200" r="0.5" fill="#FFF" />
                  </g>

                  {/* Draw Connecting Lines */}
                  {nodes.slice(0, -1).map((node, i) => {
                    const nextNode = nodes[i + 1];
                    const lineInfo = getLineCoords(
                      node,
                      nextNode,
                      i === 0 ? 10 : i === 1 ? 25 : i === 2 ? 50 : 75,
                      i === 0 ? 25 : i === 1 ? 50 : i === 2 ? 75 : 100,
                      progressPercent
                    );
                    
                    return (
                      <g key={`line-${i}`}>
                        {/* Dotted Unfilled Background Line */}
                        <line
                          x1={node.x}
                          y1={node.y}
                          x2={nextNode.x}
                          y2={nextNode.y}
                          stroke="#1E2342"
                          strokeWidth="2"
                          strokeDasharray="4 4"
                        />
                        {/* Animated Glowing Filled Line */}
                        {lineInfo.opacity > 0 && (
                          <line
                            x1={node.x}
                            y1={node.y}
                            x2={lineInfo.x2}
                            y2={lineInfo.y2}
                            stroke="url(#nebulaLine)"
                            strokeWidth="3.5"
                            strokeLinecap="round"
                            opacity={lineInfo.opacity}
                            className="transition-all duration-700 ease-out"
                          />
                        )}
                      </g>
                    );
                  })}

                  {/* Draw Constellation Nodes */}
                  {nodes.map((node) => {
                    const isLit = progressPercent >= parseInt(node.label);
                    
                    return (
                      <g key={node.label}>
                        {/* Glow Circle behind star */}
                        {isLit && (
                          <circle
                            cx={node.x}
                            cy={node.y}
                            r="20"
                            fill="url(#starGlow)"
                            className="transition duration-500"
                          />
                        )}

                        {/* Unlit Dot or Glowing Star */}
                        {isLit ? (
                          <path
                            d={drawStarPath(node.x, node.y, 8, 3.5)}
                            fill="#C084FC"
                            className="glowing-star cursor-pointer transition-all duration-350"
                          />
                        ) : (
                          <circle
                            cx={node.x}
                            cy={node.y}
                            r="4.5"
                            fill="#7E86A3"
                            opacity="0.4"
                            className="hover:opacity-85 transition"
                          />
                        )}

                        {/* Label */}
                        <text
                          x={node.x}
                          y={node.y + 20}
                          textAnchor="middle"
                          fill={isLit ? "#C084FC" : "#7E86A3"}
                          fontSize="9"
                          fontWeight="bold"
                          className="font-mono tracking-widest select-none transition"
                        >
                          {node.label}
                        </text>
                      </g>
                    );
                  })}

                  {/* Render Shooting Stars */}
                  {shootingStars.map((star) => (
                    <g key={star.id}>
                      <path
                        d={`M ${star.fromX} ${star.fromY} Q ${(star.fromX + star.toX) / 2} ${(star.fromY + star.toY) / 2 - 30} ${star.toX} ${star.toY}`}
                        fill="none"
                        stroke={star.color}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        className="shooting-star-path"
                      />
                      <circle cx={star.toX} cy={star.toY} r="3" fill={star.color} className="animate-ping" />
                    </g>
                  ))}
                </svg>
              </div>

              {/* Progress values */}
              <div className="flex justify-between items-baseline mt-4 border-t border-slate-800/50 pt-4">
                <div>
                  <span className="text-4xl font-extrabold tracking-tight font-display text-[#C084FC]">
                    {raised.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-[#7E86A3] font-medium ml-2 font-display text-sm">
                    Lumens of light contributed
                  </span>
                </div>
                <div className="text-right flex flex-col items-end">
                  <span className="text-sm font-semibold font-display text-[#7E86A3]">
                    Milestone: {goal.toLocaleString()} XLM
                  </span>
                  <span className="text-[10px] text-slate-500 font-semibold mt-1">
                    Active Network: Stellar Testnet
                  </span>
                </div>
              </div>
            </div>

            {/* Recent Donations Section */}
            <div className="border-t border-slate-800/60 pt-6 mt-6">
              <div className="mb-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-[#7E86A3] flex items-center gap-2 font-display">
                  <span className="w-2 h-2 rounded-full bg-[#C084FC] animate-pulse" />
                  Recent Contributions
                </h3>
              </div>

              <div className="max-h-[220px] overflow-y-auto pr-1.5 custom-scrollbar flex flex-col gap-3">
                {events.filter((e) => e.type === "donation").length > 0 ? (
                  events
                    .filter((e) => e.type === "donation")
                    .map((ev) => {
                      const actorStr = ev.actor ? String(ev.actor) : "";
                      const ledgerDiff = currentLedger - ev.ledger;
                      const secondsDiff = Math.max(0, ledgerDiff * 5.2);

                      let relativeTime = "Just now";
                      if (secondsDiff >= 86400) {
                        relativeTime = `${Math.round(secondsDiff / 86400)}d ago`;
                      } else if (secondsDiff >= 3600) {
                        relativeTime = `${Math.round(secondsDiff / 3600)}h ago`;
                      } else if (secondsDiff >= 60) {
                        relativeTime = `${Math.round(secondsDiff / 60)}m ago`;
                      } else if (secondsDiff > 0) {
                        relativeTime = `${Math.round(secondsDiff)}s ago`;
                      }

                      // Find if a badge was minted in the same ledger/tx context
                      const badgeTier = events.find(
                        (badge) =>
                          badge.type === "badge_mint" &&
                          badge.actor === ev.actor &&
                          Math.abs(badge.ledger - ev.ledger) <= 1
                      )?.tier;

                      let badgeTag = null;
                      let tierDotColor = "bg-slate-600";
                      let tierDotClass = "";
                      
                      if (badgeTier === "Bronze") {
                        tierDotColor = "bg-[#C084FC]";
                        tierDotClass = "spark-effect";
                        badgeTag = (
                          <span className="px-2 py-0.5 rounded-md text-[9px] font-black tracking-wider uppercase bg-[#C084FC]/10 border border-[#C084FC]/30 text-[#C084FC]">
                            Spark
                          </span>
                        );
                      } else if (badgeTier === "Silver") {
                        tierDotColor = "bg-slate-300";
                        tierDotClass = "glow-effect";
                        badgeTag = (
                          <span className="px-2 py-0.5 rounded-md text-[9px] font-black tracking-wider uppercase bg-slate-300/10 border border-slate-300/30 text-slate-300">
                            Glow
                          </span>
                        );
                      } else if (badgeTier === "Gold") {
                        tierDotColor = "bg-[#C084FC]";
                        tierDotClass = "supernova-effect";
                        badgeTag = (
                          <span className="px-2 py-0.5 rounded-md text-[9px] font-black tracking-wider uppercase bg-[#C084FC]/20 border border-[#C084FC]/40 text-[#C084FC] animate-pulse">
                            Supernova
                          </span>
                        );
                      }

                      return (
                        <div
                          key={ev.id}
                          className="bg-[#080510]/60 border border-slate-850/80 rounded-xl p-3 flex items-center justify-between gap-4 hover:border-slate-800 transition"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="relative flex items-center justify-center shrink-0">
                              <div className={`w-2.5 h-2.5 rounded-full ${tierDotColor} ${tierDotClass}`} />
                            </div>
                            <div className="truncate">
                              <span className="font-mono text-xs text-[#F4F6FF] font-medium">
                                {actorStr ? `${actorStr.slice(0, 6)}...${actorStr.slice(-6)}` : "Anonymous"}
                              </span>
                              <span className="text-[10px] text-[#7E86A3] font-semibold block mt-0.5 font-mono">
                                Ledger #{ev.ledger}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            {badgeTag}
                            <span className="font-mono text-xs text-[#C084FC] font-bold">
                              +{ev.amount ?? 0} XLM
                            </span>
                            <span className="text-[10px] text-[#7E86A3] font-medium w-16 text-right font-sans">
                              {relativeTime}
                            </span>
                          </div>
                        </div>
                      );
                    })
                ) : (
                  <div className="text-center py-8 text-slate-500 text-xs font-semibold font-sans flex flex-col items-center gap-2">
                    <span className="text-xl animate-pulse">🌌</span>
                    <span>No contributions yet. Be the first to illuminate this campaign!</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Interactive Action Forms & Rewards Badge Tiers */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Donation Form Card */}
            <div className="bg-[#140E28]/60 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 flex flex-col justify-between shadow-2xl relative">
              <div>
                <h3 className="text-lg font-bold tracking-tight mb-4 flex items-center gap-2 font-display">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#C084FC]" />
                  Contribute Lumens
                </h3>

                <form onSubmit={handleDonate} className="flex flex-col gap-4">
                  {/* Quick-select options */}
                  <div className="grid grid-cols-4 gap-2">
                    {[10, 50, 200, 500].map((amount) => (
                      <button
                        key={amount}
                        type="button"
                        onClick={() => setDonateAmount(amount.toString())}
                        className={`py-2 px-1 text-xs font-bold rounded-xl transition border cursor-pointer font-mono ${
                          donateAmount === amount.toString()
                            ? "bg-[#C084FC]/15 text-[#C084FC] border-[#C084FC] shadow-[0_0_10px_rgba(255,193,94,0.15)]"
                            : "bg-[#080510]/65 text-[#7E86A3] border-slate-800 hover:bg-[#140E28] hover:text-white"
                        }`}
                      >
                        {amount} XLM
                      </button>
                    ))}
                  </div>

                  {/* Input field */}
                  <div className="relative">
                    <input
                      type="number"
                      value={donateAmount}
                      onChange={(e) => setDonateAmount(e.target.value)}
                      placeholder="Enter custom amount..."
                      min="0.0000001"
                      step="any"
                      required
                      className="w-full bg-[#080510]/90 border border-slate-800 focus:border-[#A855F7] rounded-2xl py-3.5 pl-4 pr-16 text-[#F4F6FF] font-bold focus:outline-hidden transition shadow-inner font-mono"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-[#7E86A3] font-bold font-mono">
                      XLM
                    </span>
                  </div>

                  {/* Dynamic Reward Estimator */}
                  {upcomingBadge && (
                    <div className="bg-[#080510]/80 border border-slate-800/80 rounded-2xl p-4 text-xs font-sans">
                      <div className="flex items-center justify-between font-semibold text-[#F4F6FF]">
                        <span>Target Badge Reward:</span>
                        <span className="text-[#C084FC]">{upcomingBadge.tier} Tier</span>
                      </div>
                      {upcomingBadge.diff ? (
                        <div className="text-[#7E86A3] mt-1">
                          Add <span className="font-bold text-[#F4F6FF] font-mono">{upcomingBadge.diff.toFixed(1)} XLM</span> more to hit this milestone.
                        </div>
                      ) : (
                        <div className="text-[#34D399] mt-1 flex items-center gap-1 font-medium">
                          ✔ Donation qualifies for the {upcomingBadge.tier} tier!
                        </div>
                      )}
                    </div>
                  )}

                   {/* Donate Button */}
                  <button
                    type="submit"
                    disabled={loadingAction !== "" && loadingAction !== "success" && loadingAction !== "error"}
                    className="w-full cursor-pointer bg-gradient-to-r from-[#6366F1] to-[#A855F7] hover:scale-[1.02] active:scale-[0.98] text-[#F4F6FF] font-bold py-3.5 px-6 rounded-2xl transition-all duration-200 shadow-lg shadow-[#6366F1]/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2.5 font-display"
                  >
                    {loadingAction !== "" && loadingAction !== "success" && loadingAction !== "error" && (
                      <div className="w-4 h-4 rounded-full border-2 border-t-transparent border-[#C084FC] animate-spin shrink-0" />
                    )}
                    {!walletConnected
                      ? "Connect Wallet to Contribute"
                      : loadingAction === "preparing"
                      ? "Preparing transaction..."
                      : loadingAction === "freighter"
                      ? "Approve in Freighter Wallet..."
                      : loadingAction === "chain"
                      ? "Confirming on Ledger..."
                      : `Contribute ${donateAmount} Lumens`}
                  </button>
                </form>
              </div>

              {/* Status Message Blocks */}
              <div className="mt-4 font-sans">
                {loadingAction === "success" && (
                  <div className="bg-[#34D399]/10 border border-[#34D399]/30 rounded-2xl p-4 text-xs text-[#34D399]">
                    <p className="font-bold mb-1">✔ Contribution Complete!</p>
                    <p className="mb-2 text-[#7E86A3]">Your light source has been mapped onto the ledger.</p>
                    <a
                      href={`https://stellar.expert/explorer/testnet/tx/${successTxHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-[#A855F7] hover:text-[#A855F7]/80 underline font-semibold break-all"
                    >
                      TX: {successTxHash.slice(0, 18)}...
                    </a>
                  </div>
                )}

                {loadingAction === "error" && (
                  <div className="bg-[#F87171]/10 border border-[#F87171]/30 rounded-2xl p-4 text-xs text-[#F87171]">
                    <p className="font-bold mb-1">❌ Transmission Disrupted</p>
                    <p className="font-medium break-words text-[#7E86A3]">{errorMessage}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Badge Info & Tiers */}
            <div className="bg-[#140E28]/60 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 flex flex-col justify-between shadow-2xl relative">
              <div>
                <h3 className="text-lg font-bold tracking-tight mb-4 flex items-center gap-2 text-[#F4F6FF] font-display">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#C084FC]" />
                  Light Tiers System
                </h3>

                <p className="text-xs text-[#7E86A3] mb-5 leading-relaxed font-sans">
                  Earn permanent on-chain Light Tiers based on your cumulative contribution volume. Badges are held in our rewards contract:
                </p>

                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between bg-[#080510]/80 border border-slate-800/60 rounded-xl px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-md bg-amber-600/20 border border-amber-600/40 flex items-center justify-center text-xs font-bold text-amber-500 spark-effect">
                        ✸
                      </span>
                      <span className="text-xs font-bold text-[#F4F6FF] font-sans">Spark Tier</span>
                    </div>
                    <span className="text-xs font-semibold text-[#7E86A3] font-mono">50+ XLM</span>
                  </div>

                  <div className="flex items-center justify-between bg-[#080510]/80 border border-slate-800/60 rounded-xl px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-md bg-slate-400/20 border border-slate-400/40 flex items-center justify-center text-xs font-bold text-slate-300 glow-effect">
                        ❂
                      </span>
                      <span className="text-xs font-bold text-[#F4F6FF] font-sans">Glow Tier</span>
                    </div>
                    <span className="text-xs font-semibold text-[#7E86A3] font-mono">200+ XLM</span>
                  </div>

                  <div className="flex items-center justify-between bg-[#080510]/80 border border-slate-800/60 rounded-xl px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-md bg-yellow-400/20 border border-yellow-400/40 flex items-center justify-center text-xs font-bold text-yellow-400 supernova-effect">
                        ★
                      </span>
                      <span className="text-xs font-bold text-[#F4F6FF] font-sans">Supernova Tier</span>
                    </div>
                    <span className="text-xs font-semibold text-[#7E86A3] font-mono">500+ XLM</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-800/80 font-sans">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[#7E86A3] font-semibold">Badge Contract</span>
                  <div className="flex items-center gap-1.5">
                    <a
                      href={`https://stellar.expert/explorer/testnet/contract/${REWARDS_BADGE_CONTRACT_ID}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-[#A855F7] hover:text-[#A855F7]/80 font-mono transition underline"
                    >
                      {REWARDS_BADGE_CONTRACT_ID.slice(0, 6)}...{REWARDS_BADGE_CONTRACT_ID.slice(-6)}
                    </a>
                    <button
                      onClick={() => copyToClipboard(REWARDS_BADGE_CONTRACT_ID, "Badge Contract ID")}
                      className="text-slate-500 hover:text-slate-300 p-0.5 rounded-md transition cursor-pointer"
                      title="Copy Badge Contract ID"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
          </div>

        </div>

        {/* Right Side: User Profile & Live Activity Feed (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-8">
          
          {/* User Profile Card with Nebula Border-Glow */}
          <div className="bg-[#140E28]/60 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
            <h3 className="text-lg font-bold tracking-tight mb-4 flex items-center gap-2 text-[#F4F6FF] font-display">
              <span className="w-2.5 h-2.5 rounded-full bg-[#6366F1]" />
              Contributor Profile
            </h3>

            {walletConnected ? (
              <div className="flex flex-col gap-4">
                {/* Balance display */}
                <div className="bg-[#080510]/80 border border-slate-800 rounded-2xl p-4 flex justify-between items-center shadow-inner">
                  <div>
                    <span className="text-xs text-[#7E86A3] font-semibold block uppercase tracking-wider font-sans">Your Balance</span>
                    <span className="text-2xl font-bold tracking-tight text-[#F4F6FF] font-mono">
                      {parseFloat(userBalance).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                    </span>
                    <span className="text-[#7E86A3] font-medium ml-1.5 text-sm font-sans">XLM</span>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-[#140E28] flex items-center justify-center border border-slate-850 font-extrabold text-sm text-[#C084FC] shadow-sm font-mono">
                    ¤
                  </div>
                </div>

                {/* Badge card display with nebula gradient border-glow */}
                <div className="relative overflow-hidden rounded-2xl p-[1.5px] mt-1 bg-gradient-to-r from-[#6366F1] to-[#A855F7] border-nebula-glow">
                  <div className="bg-[#140E28] relative rounded-2xl p-4 flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${currentBadge.color} flex items-center justify-center text-xl font-black text-[#F4F6FF] shadow-md`}>
                      {userBadgeTier === 1 ? "✸" : userBadgeTier === 2 ? "❂" : userBadgeTier === 3 ? "★" : "Ø"}
                    </div>
                    <div>
                      <span className="text-xs text-[#7E86A3] font-semibold block uppercase tracking-wider font-sans">Active Light Tier</span>
                      <span className="text-base font-extrabold text-[#F4F6FF] font-display">
                        {currentBadge.name}
                      </span>
                      <span className="block text-[10px] text-[#7E86A3] font-semibold mt-0.5 font-sans">
                        {currentBadge.text}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-[#080510]/80 border border-slate-800 rounded-2xl p-6 text-center shadow-inner flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[#140E28] border border-slate-800 flex items-center justify-center text-xl text-slate-500 font-mono">
                  ?
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-300 font-sans">Wallet Not Connected</p>
                  <p className="text-xs text-[#7E86A3] mt-1 max-w-[200px] mx-auto font-sans">
                    Please connect Freighter to view your XLM balance and active Light Tier.
                  </p>
                </div>
                <button
                  onClick={handleConnectWallet}
                  className="mt-2 cursor-pointer bg-[#140E28] hover:bg-slate-850 border border-slate-800 text-xs font-bold px-4 py-2 rounded-xl text-[#A855F7] hover:text-[#A855F7]/80 transition font-display"
                >
                  Connect Wallet
                </button>
              </div>
            )}
          </div>

          {/* Live Feed Event Card */}
          <div className="bg-[#140E28]/60 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 shadow-2xl flex flex-col grow min-h-[400px]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold tracking-tight flex items-center gap-2 text-[#F4F6FF] font-display">
                <span className="w-2.5 h-2.5 rounded-full bg-[#34D399] animate-pulse" />
                Live Campaign Feed
              </h3>
              <button
                onClick={loadCampaignData}
                className="text-xs font-bold text-[#A855F7] hover:text-[#A855F7]/80 transition cursor-pointer font-sans"
              >
                Refresh
              </button>
            </div>

            {/* Filter Tabs */}
            <div className="grid grid-cols-3 bg-[#080510]/90 border border-slate-800 rounded-xl p-1 mb-4 shadow-inner">
              {(["all", "donations", "badges"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`text-[10px] font-bold rounded-lg py-1 px-0.5 cursor-pointer uppercase tracking-wider transition font-sans ${
                    activeTab === tab
                      ? "bg-[#140E28] text-[#A855F7] shadow-sm"
                      : "text-[#7E86A3] hover:text-slate-300"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Feed Scroll List */}
            <div className="grow overflow-y-auto max-h-[420px] flex flex-col gap-3 pr-1.5 custom-scrollbar">
              {filteredEvents.length > 0 ? (
                filteredEvents.map((ev) => {
                  try {
                    const actorStr = ev.actor ? String(ev.actor) : "";
                    const ledgerDiff = currentLedger - ev.ledger;
                    const secondsDiff = Math.max(0, ledgerDiff * 5.2);

                    let relativeTime = "Just now";
                    if (secondsDiff >= 86400) {
                      relativeTime = `${Math.round(secondsDiff / 86400)}d ago`;
                    } else if (secondsDiff >= 3600) {
                      relativeTime = `${Math.round(secondsDiff / 3600)}h ago`;
                    } else if (secondsDiff >= 60) {
                      relativeTime = `${Math.round(secondsDiff / 60)}m ago`;
                    } else if (secondsDiff > 0) {
                      relativeTime = `${Math.round(secondsDiff)}s ago`;
                    }

                    // Check if it has a matched light tier badge
                    const badgeTier = events.find(
                      (b) => b.type === "badge_mint" && b.actor === ev.actor && Math.abs(b.ledger - ev.ledger) <= 1
                    )?.tier;

                    let dotColor = "bg-slate-600";
                    let dotClass = "";
                    if (badgeTier === "Bronze") {
                      dotColor = "bg-[#C084FC]";
                      dotClass = "spark-effect";
                    } else if (badgeTier === "Silver") {
                      dotColor = "bg-slate-300";
                      dotClass = "glow-effect";
                    } else if (badgeTier === "Gold") {
                      dotColor = "bg-[#C084FC]";
                      dotClass = "supernova-effect";
                    }

                    return (
                      <div
                        key={ev.id}
                        className="bg-[#080510]/70 border border-slate-850 rounded-xl p-3.5 hover:border-slate-800 transition flex flex-col gap-2 relative overflow-hidden group animate-fade-in"
                      >
                        <div className="flex justify-between items-center border-b border-slate-900 pb-1.5 mb-1.5">
                          <span className="text-[10px] font-bold text-[#7E86A3] tracking-wider font-mono">
                            LEDGER #{ev.ledger}
                          </span>
                          <a
                            href={`https://stellar.expert/explorer/testnet/tx/${ev.id.split("-")[0]}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] text-[#A855F7] hover:text-[#A855F7]/80 hover:underline font-bold transition font-sans"
                          >
                            Details ↗
                          </a>
                        </div>

                        <div className="text-xs">
                          {ev.type === "donation" ? (
                            <div className="text-[#F4F6FF] leading-normal flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${dotColor} ${dotClass} inline-block`} />
                                <span className="font-mono font-bold text-[#C084FC]">
                                  +{ev.amount ?? 0} XLM
                                </span>
                                <span className="text-[#7E86A3] text-[10px] font-mono">
                                  by {actorStr ? `${actorStr.slice(0, 6)}...${actorStr.slice(-6)}` : "Unknown"}
                                </span>
                              </div>
                              <span className="text-[10px] text-[#7E86A3] font-medium font-sans">
                                {relativeTime}
                              </span>
                            </div>
                          ) : (
                            <div className="text-[#F4F6FF] leading-normal flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${dotColor} ${dotClass} inline-block`} />
                                <span className="font-sans font-bold text-purple-400">
                                  ★ {ev.tier ?? "Spark"} Tier Awarded
                                </span>
                                <span className="text-[#7E86A3] text-[10px] font-mono">
                                  to {actorStr ? `${actorStr.slice(0, 6)}...${actorStr.slice(-6)}` : "Unknown"}
                                </span>
                              </div>
                              <span className="text-[10px] text-[#7E86A3] font-medium font-sans">
                                {relativeTime}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  } catch (err: any) {
                    return (
                      <div
                        key={ev.id}
                        className="bg-rose-950/60 border border-rose-800/80 rounded-xl p-3 text-xs text-rose-200"
                      >
                        <p className="font-bold">Error rendering event:</p>
                        <p className="font-mono text-[10px] mt-1">{err.message}</p>
                      </div>
                    );
                  }
                })
              ) : (
                <div className="text-center py-10 text-slate-500 text-xs font-semibold font-sans flex flex-col items-center gap-2">
                  <span className="text-xl animate-pulse">📡</span>
                  <span>No recent events found. Be the first to start the stream!</span>
                </div>
              )}
            </div>

          </div>

          <div className="lg:col-span-12">
            <MilestoneDashboard 
              milestones={milestones}
              userAddress={userAddress}
              walletConnected={walletConnected}
              reloadData={loadCampaignData}
              goal={goal}
            />
          </div>

        </div>

      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-6 py-8 border-t border-slate-900/60 mt-16 text-center text-xs text-[#7E86A3] font-semibold font-sans">
        <p>NovaTrust Crowdfunding Campaign. Deployed on Stellar Testnet.</p>
        <p className="mt-1 font-mono text-[10px] text-slate-600">
          Crowdfunding: {CROWDFUNDING_CONTRACT_ID} | Rewards: {REWARDS_BADGE_CONTRACT_ID}
        </p>
      </footer>
      {/* Toast Notification Container */}
      {toast && (
        <div className="fixed bottom-5 left-5 z-55 animate-fade-in-up">
          <div className={`px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border text-sm font-sans ${
            toast.type === "success" 
              ? "bg-[#34D399]/15 border-[#34D399]/30 text-[#34D399]" 
              : toast.type === "error"
              ? "bg-[#F87171]/15 border-[#F87171]/30 text-[#F87171]"
              : "bg-[#A855F7]/15 border-[#A855F7]/30 text-[#A855F7]"
          }`}>
            <span>{toast.type === "success" ? "✔" : toast.type === "error" ? "❌" : "ℹ"}</span>
            <span className="font-semibold">{toast.message}</span>
          </div>
        </div>
      )}
      {/* Scroll To Top Button */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-5 right-5 z-55 p-3 rounded-full bg-gradient-to-tr from-[#6366F1] to-[#A855F7] text-white hover:scale-110 transition cursor-pointer shadow-lg shadow-purple-500/30"
          title="Scroll to Top"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
        </button>
      )}
    </div>
  );
}
