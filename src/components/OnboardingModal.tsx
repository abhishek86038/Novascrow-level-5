import { useState, useEffect } from 'react';

export const OnboardingModal = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Show only on first visit
    const hasSeen = localStorage.getItem('novatrust_onboarding');
    if (!isOpen && !hasSeen) {
      setIsOpen(true);
    }
  }, [isOpen]);

  const handleClose = () => {
    localStorage.setItem('novatrust_onboarding', 'true');
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm">
      <div className="bg-[#140E28] border border-slate-700/60 rounded-3xl p-8 max-w-lg shadow-2xl relative">
        <button onClick={handleClose} className="absolute top-4 right-6 text-2xl text-slate-400 hover:text-white">&times;</button>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-[#6366F1] to-[#A855F7] flex items-center justify-center font-bold text-white shadow-lg text-2xl">
            N
          </div>
          <h2 className="text-2xl font-bold text-white">Welcome to NovaTrust Escrow</h2>
        </div>
        
        <div className="space-y-4 text-slate-300 text-sm">
          <p>
            NovaTrust is a decentralized crowdfunding platform built on the Stellar Soroban testnet.
          </p>
          
          <div className="bg-[#080510] border border-slate-800/80 p-4 rounded-xl">
            <h4 className="font-bold text-[#A855F7] mb-1">How it Works:</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>Your funds are locked in an <strong>Escrow Smart Contract</strong>.</li>
              <li>The project is divided into 4 milestones (25% each).</li>
              <li>When a milestone is reached, the creator submits proof of work.</li>
              <li>Donors vote to <strong>Approve</strong> or <strong>Reject</strong> the proof.</li>
              <li>Funds are released to the creator ONLY if the majority approves!</li>
            </ul>
          </div>

          <div className="bg-[#080510] border border-slate-800/80 p-4 rounded-xl">
            <h4 className="font-bold text-[#C084FC] mb-1">Getting Started:</h4>
            <p className="mb-3">
              You need the <a href="https://freighter.app/" target="_blank" className="text-[#C084FC] underline">Freighter Wallet</a> to interact. Make sure you are connected to the <strong>Testnet</strong>.
            </p>
            <div className="flex gap-2.5">
              <a
                href="https://laboratory.stellar.org/#account-creator?network=test"
                target="_blank"
                rel="noreferrer"
                className="flex-1 bg-gradient-to-r from-purple-700 to-indigo-800 hover:from-purple-600 hover:to-indigo-700 text-white text-center text-xs font-bold py-2.5 px-4 rounded-xl transition duration-200"
              >
                Fund Wallet (Friendbot Faucet) ↗
              </a>
            </div>
          </div>
        </div>

        <button 
          onClick={handleClose}
          className="w-full mt-6 bg-gradient-to-r from-[#6366F1] to-[#A855F7] hover:scale-[1.02] active:scale-[0.98] text-white font-bold py-3 px-6 rounded-2xl transition-all duration-200"
        >
          Got it, let's explore!
        </button>
      </div>
    </div>
  );
};
