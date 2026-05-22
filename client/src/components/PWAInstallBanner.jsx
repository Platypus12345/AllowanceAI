import { useState, useEffect } from 'react';

export function PWAInstallBanner() {
  const [prompt, setPrompt] = useState(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setPrompt(e);
      setShown(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!shown || !prompt) return null;

  return (
    <div className="fixed bottom-6 left-4 right-4 z-50 glass-card rounded-2xl p-4 flex items-center gap-4 shadow-[0_8px_32px_rgba(128,131,255,0.3)] border border-indigo-500/30">
      <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center text-2xl flex-shrink-0">
        💰
      </div>
      <div className="flex-1">
        <p className="font-bold text-white text-sm">Install AllowanceAI</p>
        <p className="text-xs text-[#c7c4d7]">Add to home screen for quick access</p>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setShown(false)}
          className="text-xs text-slate-400 px-3 py-2 rounded-lg hover:bg-white/5"
        >
          Not now
        </button>
        <button
          type="button"
          onClick={async () => {
            prompt.prompt();
            await prompt.userChoice;
            setShown(false);
          }}
          className="text-xs bg-indigo-500 text-white px-4 py-2 rounded-lg font-bold"
        >
          Install
        </button>
      </div>
    </div>
  );
}
