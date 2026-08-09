import { useState, useEffect } from 'react';

export const OnboardingModal = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Show only on first visit
    const hasSeen = localStorage.getItem('novascrow_onboarding');
    if (!hasSeen) {
      setIsOpen(true);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem('novascrow_onboarding', 'true');
    setIsOpen(false);
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert('Copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-[#12162B] border border-slate-700 rounded-3xl p-6 md:p-8 max-w-xl shadow-2xl relative my-8">
        <button onClick={handleClose} className="absolute top-4 right-6 text-2xl text-slate-400 hover:text-white">&times;</button>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-tr from-[#5B4FE8] to-[#37C6FF] flex items-center justify-center font-bold text-white shadow-lg text-xl md:text-2xl">
            N
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-white">Welcome to Novascrow</h2>
        </div>
        
        <div className="space-y-5 text-slate-300 text-sm">
          <p>
            Novascrow is a decentralized crowdfunding platform built on the Stellar Soroban testnet.
            Follow these steps to get started:
          </p>
          
          <div className="bg-[#0A0D1C] border border-slate-800 p-4 rounded-xl space-y-3">
            <h4 className="font-bold text-[#FFC15E] mb-2 flex items-center gap-2">
              <span className="bg-[#FFC15E] text-[#0A0D1C] w-5 h-5 rounded-full inline-flex items-center justify-center text-xs">1</span>
              Install Freighter Wallet
            </h4>
            <p className="pl-7">
              You need a Stellar wallet to interact with the blockchain. Download and install the <a href="https://freighter.app/" target="_blank" rel="noreferrer" className="text-[#37C6FF] underline font-semibold hover:text-[#37C6FF]/80">Freighter Extension</a>.
            </p>
          </div>

          <div className="bg-[#0A0D1C] border border-slate-800 p-4 rounded-xl space-y-3">
            <h4 className="font-bold text-[#FFC15E] mb-2 flex items-center gap-2">
              <span className="bg-[#FFC15E] text-[#0A0D1C] w-5 h-5 rounded-full inline-flex items-center justify-center text-xs">2</span>
              Get Testnet XLM
            </h4>
            <div className="pl-7 space-y-2">
              <p>
                Switch your Freighter wallet to <strong>Testnet</strong> in the settings. Then, copy your wallet address and use Friendbot to get free test tokens.
              </p>
              <a href="https://laboratory.stellar.org/#account-creator?network=test" target="_blank" rel="noreferrer" className="inline-block bg-[#12162B] border border-slate-700 text-[#37C6FF] px-3 py-1.5 rounded-lg text-xs font-semibold hover:border-[#37C6FF] transition">
                Open Friendbot ↗
              </a>
            </div>
          </div>

          <div className="bg-[#0A0D1C] border border-slate-800 p-4 rounded-xl space-y-3">
            <h4 className="font-bold text-[#FFC15E] mb-2 flex items-center gap-2">
              <span className="bg-[#FFC15E] text-[#0A0D1C] w-5 h-5 rounded-full inline-flex items-center justify-center text-xs">3</span>
              Connect & Donate
            </h4>
            <p className="pl-7">
              Click <strong>Connect Wallet</strong> at the top right, select a donation amount, and make your first contribution to receive a Soulbound Reward Badge!
              <br/><br/>
              <span className="text-xs text-slate-400">Escrow Contract:</span>
              <button onClick={() => handleCopy('CC43AJ4EAYAG6GCST46WZEFCL4SJFQFCZBWQYI7R4SW2KD7VKTQ2GAOC')} className="ml-2 font-mono text-[#37C6FF] hover:underline bg-[#12162B] px-2 py-1 rounded">
                CC43...GAOC 📋
              </button>
            </p>
          </div>
        </div>

        <button 
          onClick={handleClose}
          className="w-full mt-6 bg-gradient-to-r from-[#5B4FE8] to-[#37C6FF] hover:scale-[1.02] active:scale-[0.98] text-white font-bold py-3 px-6 rounded-2xl transition-all duration-200"
        >
          Got it, let's explore!
        </button>
      </div>
    </div>
  );
};
