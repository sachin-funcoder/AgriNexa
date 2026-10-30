import React from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, Sparkles, Mic, Globe2, ShieldCheck } from 'lucide-react';
import ChatbotWidget from '../components/chatbot/ChatbotWidget';

const ChatPage = () => {
  const { t, i18n } = useTranslation();
  const isKn = i18n.language.startsWith('kn');

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 flex flex-col min-h-[calc(100vh-80px)]">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
        <div>
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-2 shadow-sm">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isKn ? 'ಧ್ವನಿ ಮತ್ತು ಪಠ್ಯ ಕೃಷಿ AI' : 'Multilingual Voice & Text Assistant'}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {isKn ? 'AgriNexa AI — ಕೃಷಿ ಸಹಾಯಕ' : 'AgriNexa AI — Smart Farming Assistant'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
            {isKn
              ? 'ಕರ್ನಾಟಕದ APMC ಮಾರುಕಟ್ಟೆ ದರಗಳು, 14 ದಿನಗಳ ಭವಿಷ್ಯ ಮತ್ತು ಮಾರಾಟ ತಂತ್ರಗಳ ಬಗ್ಗೆ ಕನ್ನಡ ಅಥವಾ ಇಂಗ್ಲಿಷ್‌ನಲ್ಲಿ ಮಾತನಾಡಿ ಅಥವಾ ಟೈಪ್ ಮಾಡಿ.'
              : 'Ask real-time questions about Karnataka APMC mandi spot rates, 14-day price forecasts, and harvest split strategies.'}
          </p>
        </div>

        <div className="flex items-center space-x-2 text-xs text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl shadow-sm">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-agri-400" />
          <span>{isKn ? 'ಪಾರದರ್ಶಕ ಸಿಂಥೆಟಿಕ್ ಡೇಟಾ' : 'Verified Synthetic APMC Dataset'}</span>
        </div>
      </div>

      {/* Embedded Full-Page Chat Window */}
      <div className="flex-1 w-full">
        <ChatbotWidget isFullPage={true} />
      </div>
    </div>
  );
};

export default ChatPage;

