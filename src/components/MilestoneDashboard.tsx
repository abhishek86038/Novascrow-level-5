import { useState } from 'react';
import { prepareSubmitProofTransaction, prepareVoteTransaction, prepareReleaseFundsTransaction, prepareRefundTransaction } from '../stellar';
import { trackEvent } from '../services/analytics';
import { signTransaction } from '@stellar/freighter-api';
import { submitAndPollTransaction } from '../stellar';

export const MilestoneDashboard = ({ milestones, userAddress, walletConnected, reloadData, goal }: any) => {
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [proofInput, setProofInput] = useState('');

  const handleAction = async (id: number, action: 'submit' | 'approve' | 'reject' | 'release' | 'refund') => {
    if (!walletConnected || !userAddress) {
      alert("Please connect your wallet first.");
      return;
    }
    setLoadingId(id);
    try {
      let xdr = '';
      if (action === 'submit') {
        if (!proofInput) throw new Error("Proof link cannot be empty");
        xdr = await prepareSubmitProofTransaction(userAddress, id, proofInput);
      } else if (action === 'approve') {
        xdr = await prepareVoteTransaction(userAddress, id, true);
      } else if (action === 'reject') {
        xdr = await prepareVoteTransaction(userAddress, id, false);
      } else if (action === 'release') {
        xdr = await prepareReleaseFundsTransaction(userAddress, id);
      } else if (action === 'refund') {
        xdr = await prepareRefundTransaction(userAddress, id);
      }

      const signResult = await signTransaction(xdr, { networkPassphrase: "Test SDF Network ; September 2015" });
      if (signResult.error) throw new Error(signResult.error as string);
      
      await submitAndPollTransaction(signResult.signedTxXdr);
      trackEvent(`milestone_${action}`, { milestoneId: id });
      
      alert(`Successfully completed ${action}!`);
      setProofInput('');
      await reloadData();
    } catch (err: any) {
      console.error(err);
      alert(`Action failed: ${err.message}`);
    } finally {
      setLoadingId(null);
    }
  };

  const statusMap = ["Locked", "Reached", "ProofSubmitted", "Released", "Rejected"];

  return (
    <div className="bg-[#12162B]/60 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 mt-8 shadow-2xl relative">
      <h3 className="text-xl font-bold tracking-tight mb-6 flex items-center gap-2 font-display">
        <span className="w-2.5 h-2.5 rounded-full bg-[#37C6FF]" />
        Campaign Milestones (Escrow)
      </h3>

      <div className="flex flex-col gap-4">
        {milestones.map((ms: any, idx: number) => {
          const id = idx + 1;
          const statusText = typeof ms.status === 'object' ? Object.keys(ms.status)[0] || statusMap[ms.status] : ms.status;
          
          let statusColor = "text-slate-400";
          if (statusText === "Reached") statusColor = "text-[#FFC15E]";
          if (statusText === "ProofSubmitted") statusColor = "text-[#37C6FF]";
          if (statusText === "Released") statusColor = "text-[#4ADE80]";
          if (statusText === "Rejected") statusColor = "text-[#FF6B6B]";

          const totalVotes = ms.approve_votes + ms.reject_votes;
          const approvePct = totalVotes > 0 ? Math.round((ms.approve_votes / totalVotes) * 100) : 0;

          return (
            <div key={id} className="bg-[#0A0D1C]/80 border border-slate-800 rounded-2xl p-5 shadow-inner">
              <div className="flex justify-between items-center mb-3">
                <div className="font-bold font-display text-lg">Milestone {id} ({id * 25}%)</div>
                <div className={`text-sm font-bold uppercase tracking-wider ${statusColor}`}>{statusText}</div>
              </div>

              <div className="text-xs text-slate-400 mb-4 flex justify-between">
                <span>Value: {goal * 0.25} XLM</span>
                {statusText === "ProofSubmitted" && (
                  <span>Votes: {totalVotes / 10000000} (Approve: {approvePct}%)</span>
                )}
              </div>

              {statusText === "ProofSubmitted" && ms.proof_hash && (
                <div className="mb-4 text-xs font-mono text-[#37C6FF] break-all bg-[#12162B] p-2 rounded">
                  Proof: {ms.proof_hash}
                </div>
              )}

              <div className="flex flex-wrap gap-2 mt-4">
                {statusText === "Reached" && (
                  <div className="flex gap-2 w-full">
                    <input 
                      type="text" 
                      placeholder="Enter Proof URL/Hash (Creator Only)"
                      className="flex-1 bg-[#12162B] border border-slate-700 rounded px-3 py-1.5 text-xs text-white"
                      value={proofInput}
                      onChange={e => setProofInput(e.target.value)}
                    />
                    <button 
                      onClick={() => handleAction(id, 'submit')}
                      disabled={loadingId === id}
                      className="bg-[#37C6FF]/20 text-[#37C6FF] hover:bg-[#37C6FF]/30 px-3 py-1.5 rounded text-xs font-bold"
                    >
                      {loadingId === id ? '...' : 'Submit Proof'}
                    </button>
                  </div>
                )}

                {statusText === "ProofSubmitted" && (
                  <>
                    <button 
                      onClick={() => handleAction(id, 'approve')}
                      disabled={loadingId === id}
                      className="bg-[#4ADE80]/20 text-[#4ADE80] hover:bg-[#4ADE80]/30 px-3 py-1.5 rounded text-xs font-bold"
                    >
                      Approve
                    </button>
                    <button 
                      onClick={() => handleAction(id, 'reject')}
                      disabled={loadingId === id}
                      className="bg-[#FF6B6B]/20 text-[#FF6B6B] hover:bg-[#FF6B6B]/30 px-3 py-1.5 rounded text-xs font-bold"
                    >
                      Reject
                    </button>
                    <button 
                      onClick={() => handleAction(id, 'release')}
                      disabled={loadingId === id}
                      className="ml-auto bg-slate-700 text-white hover:bg-slate-600 px-3 py-1.5 rounded text-xs font-bold"
                    >
                      Release Funds (If Approved)
                    </button>
                  </>
                )}

                {statusText === "Rejected" && (
                  <button 
                    onClick={() => handleAction(id, 'refund')}
                    disabled={loadingId === id}
                    className="bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 px-3 py-1.5 rounded text-xs font-bold"
                  >
                    Claim Refund
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
