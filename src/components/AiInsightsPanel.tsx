"use client";

export default function AiInsightsPanel() {
  return (
    <div className="w-full mb-6">
      <div className="bg-gradient-to-r from-violet-900/40 to-indigo-900/40 rounded-xl border border-violet-500/30 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">
          एआई इनसाइट्स
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-black/30 rounded-lg p-4">
            <div className="text-sm text-zinc-400 mb-1">उपयोगकर्ता वृद्धि</div>
            <div className="text-2xl font-bold text-green-400">+२३%</div>
            <div className="text-xs text-zinc-500 mt-1">पिछले सप्ताह से</div>
          </div>
          <div className="bg-black/30 rounded-lg p-4">
            <div className="text-sm text-zinc-400 mb-1">सक्रिय सत्र</div>
            <div className="text-2xl font-bold text-blue-400">१,२४७</div>
            <div className="text-xs text-zinc-500 mt-1">अभी</div>
          </div>
          <div className="bg-black/30 rounded-lg p-4">
            <div className="text-sm text-zinc-400 mb-1">रूपांतरण दर</div>
            <div className="text-2xl font-bold text-violet-400">४.८%</div>
            <div className="text-xs text-zinc-500 mt-1">औसत</div>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-white/10">
          <p className="text-sm text-zinc-400">
            💡 सुझाव: आपके उपयोगकर्ता आधे से अधिक मोबाइल डिवाइस से आ रहे हैं। मोबाइल अनुभव को अनुकूलित करने पर विचार करें।
          </p>
        </div>
      </div>
    </div>
  );
}
