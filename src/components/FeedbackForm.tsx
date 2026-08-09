import React, { useState } from 'react';
import { trackEvent } from '../services/analytics';

export const FeedbackForm = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    trackEvent("submit_feedback", { rating, comment });
    setSubmitted(true);
    setTimeout(() => { setIsOpen(false); setSubmitted(false); }, 3000);
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-[#6366F1] hover:bg-[#6366F1]/80 text-white px-4 py-2 rounded-full shadow-lg text-xs font-bold flex items-center gap-2 z-50 transition"
      >
        <span>💬</span> Feedback
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-[#140E28] border border-slate-700/60 rounded-xl p-5 shadow-2xl z-50 w-72">
      {!submitted ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex justify-between items-center mb-1">
            <h4 className="font-bold text-white text-sm">How was your experience?</h4>
            <button type="button" onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white">&times;</button>
          </div>
          <div className="flex gap-2">
            {[1,2,3,4,5].map(star => (
              <button 
                key={star} 
                type="button" 
                onClick={() => setRating(star)}
                className={`text-xl ${rating >= star ? 'text-[#C084FC]' : 'text-slate-600'}`}
              >
                ★
              </button>
            ))}
          </div>
          <textarea 
            className="bg-[#080510] border border-slate-700/60 rounded p-2 text-xs text-white resize-none"
            rows={3}
            placeholder="Tell us what you think..."
            value={comment}
            onChange={e => setComment(e.target.value)}
          />
          <button type="submit" className="bg-[#A855F7] text-white font-bold text-xs py-2 rounded mt-1 hover:bg-[#A855F7]/90 transition">
            Submit
          </button>
        </form>
      ) : (
        <div className="text-center py-4 text-[#34D399] font-bold text-sm">
          Thank you for your feedback! 🚀
        </div>
      )}
    </div>
  );
};
// Feedback widgets for user suggestions
