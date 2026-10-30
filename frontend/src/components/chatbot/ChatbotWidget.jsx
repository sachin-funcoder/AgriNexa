import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  MessageSquare, Sparkles, X, RotateCcw, Volume2, Square,
  Mic, MicOff, Send, ArrowRight, Copy, Check, Maximize2,
  Minimize2, ShieldCheck, AlertCircle, Bot, User
} from 'lucide-react';
import mandiApi from '../../services/mandiApi';
import {
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  createSpeechRecognizer,
  speakText,
  stopSpeech
} from '../../utils/speechUtils';

const DEFAULT_QUESTIONS_KN = [
  '🍅 ಇಂದಿನ ಟೊಮೇಟೊ ಬೆಲೆ ಎಷ್ಟು?',
  '📊 ಕೋಲಾರ ಮತ್ತು ಬೆಂಗಳೂರಿನ ಬೆಲೆ ಹೋಲಿಕೆ',
  '📈 ಮುಂದಿನ 7 ದಿನಗಳ ಬೆಲೆ ಭವಿಷ್ಯ',
  '🚜 100 ಕ್ವಿಂಟಾಲ್ ಆಲೂಗಡ್ಡೆ ಹೇಗೆ ಮಾರಾಟ ಮಾಡಲಿ?'
];

const DEFAULT_QUESTIONS_EN = [
  "🍅 What is today's tomato price in Kolar?",
  '📊 Compare onion prices in Bengaluru and Kolar',
  '📈 What is the expected potato price next week?',
  '🚜 How should I sell 100 quintals of potato?'
];

const ChatbotWidget = ({ isFullPage = false }) => {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  // Floating popup visibility
  const [isOpen, setIsOpen] = useState(isFullPage);
  const [isMinimized, setIsMinimized] = useState(false);

  // Active language mode: 'auto' | 'kn' | 'en'
  const [chatLang, setChatLang] = useState(() => (i18n.language.startsWith('kn') ? 'kn' : 'en'));

  // Session ID for conversation context
  const [conversationId, setConversationId] = useState(() => {
    const existing = localStorage.getItem('agrinexa_chat_session_id');
    if (existing) return existing;
    const newId = `sess_${Math.random().toString(36).substring(2, 12)}`;
    localStorage.setItem('agrinexa_chat_session_id', newId);
    return newId;
  });

  // Messages list
  const [messages, setMessages] = useState([]);
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState('');
  const [copiedMsgId, setCopiedMsgId] = useState(null);

  // Voice state
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [activeSpeechMsgId, setActiveSpeechMsgId] = useState(null);
  const [speechWarning, setSpeechWarning] = useState('');
  const recognizerRef = useRef(null);

  const messagesEndRef = useRef(null);

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen, isLoading]);

  // Load chat history on mount
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const hist = await mandiApi.getChatHistory(conversationId);
        if (hist.messages && hist.messages.length > 0) {
          setMessages(hist.messages);
        } else {
          // Initialize with friendly welcome message
          setMessages([getWelcomeMessage(chatLang)]);
        }
      } catch (err) {
        console.warn('Could not load chat history:', err);
        setMessages([getWelcomeMessage(chatLang)]);
      }
    };

    loadHistory();
  }, [conversationId]);

  // Update welcome message if chat language changes and no real conversation started
  useEffect(() => {
    if (messages.length <= 1 && messages[0]?.sender === 'assistant') {
      setMessages([getWelcomeMessage(chatLang)]);
    }
  }, [chatLang]);

  function getWelcomeMessage(lang) {
    const isKn = lang === 'kn';
    return {
      message_id: 'welcome_init',
      sender: 'assistant',
      text: isKn
        ? 'ನಮಸ್ಕಾರ! ನಾನು **AgriNexa AI ಕೃಷಿ ಸಹಾಯಕ**.\n\nನಿಮ್ಮ ಬೆಳೆಗೆ ಇಂದಿನ ಮಾರುಕಟ್ಟೆ ಬೆಲೆ, ಸಾರಿಗೆ ವೆಚ್ಚ ಕಳೆದು ಅತ್ಯುತ್ತಮ ನಿವ್ವಳ ಲಾಭ ನೀಡುವ ಮಂಡಿ, ಮತ್ತು ಮಾರಾಟ ನಿರ್ಧಾರಗಳ ಬಗ್ಗೆ ಧ್ವನಿ 🎤 ಅಥವಾ ಪಠ್ಯ ⌨️ ಮೂಲಕ ನನ್ನನ್ನು ಕೇಳಿ.'
        : "Namaskara! I am **AgriNexa AI**, your smart farming assistant.\n\nAsk me about today's APMC mandi prices, price projections, net returns after transport, or harvest selling strategies using voice 🎤 or text ⌨️.",
      language: isKn ? 'kn' : 'en',
      action_chips: [
        { label: isKn ? 'ಮಂಡಿ ಹೋಲಿಕೆ →' : 'Compare Mandis →', route: '/mandi-compare' },
        { label: isKn ? 'ಲಾಭ ಲೆಕ್ಕಾಚಾರ →' : 'Profit Calculator →', route: '/calculator' }
      ],
      created_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  }

  // Handle message sending
  const handleSendMessage = async (textToSend) => {
    const query = (textToSend || inputQuery).trim();
    if (!query || isLoading) return;

    setErrorBanner('');
    setSpeechWarning('');
    setInputQuery('');

    // Append user message immediately
    const userMsg = {
      message_id: `usr_${Date.now()}`,
      sender: 'user',
      text: query,
      language: chatLang,
      created_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const response = await mandiApi.sendChatMessage({
        message: query,
        language: chatLang,
        conversation_id: conversationId
      });

      const assistantMsg = {
        message_id: response.message_id,
        sender: 'assistant',
        text: response.response,
        spoken_text: response.spoken_text,
        language: response.detected_language,
        action_chips: response.action_chips || [],
        created_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages((prev) => [...prev, assistantMsg]);

      // If user submitted via voice, automatically speak the response!
      if (isListening) {
        handleSpeakMessage(assistantMsg);
      }
    } catch (err) {
      setErrorBanner(err.message || 'Failed to receive answer. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Clear conversation history
  const handleClearChat = async () => {
    if (!window.confirm(chatLang === 'kn' ? 'ಸಂಭಾಷಣೆಯನ್ನು ತೆರವುಗೊಳಿಸಬೇಕೇ?' : 'Clear conversation history?')) {
      return;
    }
    stopSpeaking();
    try {
      await mandiApi.clearChatHistory(conversationId);
      const newId = `sess_${Math.random().toString(36).substring(2, 12)}`;
      localStorage.setItem('agrinexa_chat_session_id', newId);
      setConversationId(newId);
      setMessages([getWelcomeMessage(chatLang)]);
    } catch (err) {
      console.warn('Error clearing history:', err);
      setMessages([getWelcomeMessage(chatLang)]);
    }
  };

  // Voice Input (Speech-to-Text)
  const handleToggleVoiceInput = () => {
    if (isListening) {
      stopListening();
      return;
    }

    if (!isSpeechRecognitionSupported()) {
      setSpeechWarning(
        chatLang === 'kn'
          ? 'ನಿಮ್ಮ ಬ್ರೌಸರ್‌ನಲ್ಲಿ ಧ್ವನಿ ಗುರುತಿಸುವಿಕೆ ಲಭ್ಯವಿಲ್ಲ. ದಯವಿಟ್ಟು ಟೈಪ್ ಮಾಡಿ.'
          : 'Speech recognition is not supported on this browser. Please type your query.'
      );
      return;
    }

    const targetLang = chatLang === 'kn' ? 'kn-IN' : 'en-IN';
    const recognizer = createSpeechRecognizer({
      lang: targetLang,
      onResult: (transcript, isFinal) => {
        setInputQuery(transcript);
        if (isFinal) {
          stopListening();
        }
      },
      onError: (err) => {
        console.warn('Speech recognition error:', err);
        setIsListening(false);
        if (err === 'not-allowed') {
          setSpeechWarning(
            chatLang === 'kn'
              ? 'ಮೈಕ್ರೊಫೋನ್ ಅನುಮತಿ ನಿರಾಕರಿಸಲಾಗಿದೆ. ಬ್ರೌಸರ್ ಸೆಟ್ಟಿಂಗ್ಸ್‌ನಲ್ಲಿ ಅನುಮತಿ ನೀಡಿ.'
              : 'Microphone permission denied. Please allow microphone access in browser settings.'
          );
        } else {
          setSpeechWarning(
            chatLang === 'kn'
              ? 'ಧ್ವನಿ ಸರಿಯಾಗಿ ಕೇಳಿಸಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಪುನಃ ಮಾತನಾಡಿ.'
              : 'Speech not detected clearly. Please try speaking again.'
          );
        }
      },
      onEnd: () => {
        setIsListening(false);
      }
    });

    if (recognizer) {
      try {
        recognizer.start();
        recognizerRef.current = recognizer;
        setIsListening(true);
        setSpeechWarning('');
      } catch (err) {
        console.warn('Failed to start speech recognition:', err);
        setIsListening(false);
      }
    }
  };

  const stopListening = () => {
    if (recognizerRef.current) {
      try {
        recognizerRef.current.stop();
      } catch (e) {}
      recognizerRef.current = null;
    }
    setIsListening(false);
  };

  // Voice Output (Text-to-Speech)
  const handleSpeakMessage = (msg) => {
    if (isSpeaking && activeSpeechMsgId === msg.message_id) {
      stopSpeaking();
      return;
    }

    if (!isSpeechSynthesisSupported()) {
      setSpeechWarning(
        chatLang === 'kn'
          ? 'ಧ್ವನಿ ಪ್ಲೇಬ್ಯಾಕ್ ಈ ಸಾಧನದಲ್ಲಿ ಲಭ್ಯವಿಲ್ಲ.'
          : 'Speech playback is not supported on this device.'
      );
      return;
    }

    stopSpeaking();
    setIsSpeaking(true);
    setActiveSpeechMsgId(msg.message_id);

    const textToRead = msg.spoken_text || msg.text;
    speakText(
      textToRead,
      msg.language || chatLang,
      () => setIsSpeaking(true),
      () => {
        setIsSpeaking(false);
        setActiveSpeechMsgId(null);
      },
      (err) => {
        console.warn('TTS error:', err);
        setIsSpeaking(false);
        setActiveSpeechMsgId(null);
        setSpeechWarning(
          chatLang === 'kn'
            ? 'ಕನ್ನಡ ಧ್ವನಿ ಪ್ಯಾಕ್ ಸಾಧನದಲ್ಲಿ ಲಭ್ಯವಿಲ್ಲ.'
            : 'Voice output unavailable on this device.'
        );
      }
    );
  };

  const stopSpeaking = () => {
    stopSpeech();
    setIsSpeaking(false);
    setActiveSpeechMsgId(null);
  };

  // Copy text to clipboard
  const handleCopyMessage = (msgId, text) => {
    navigator.clipboard.writeText(text);
    setCopiedMsgId(msgId);
    setTimeout(() => setCopiedMsgId(null), 2000);
  };

  // Action chip navigation or prompt submission
  const handleChipClick = (chip) => {
    if (chip.route) {
      setIsOpen(false);
      navigate(chip.route);
    } else if (chip.prompt) {
      handleSendMessage(chip.prompt);
    }
  };

  const suggestedQuestions = chatLang === 'kn' ? DEFAULT_QUESTIONS_KN : DEFAULT_QUESTIONS_EN;

  // Don't render floating widget if we are on the dedicated full-page /chat route and this instance is the floating one
  if (!isFullPage && location.pathname === '/chat') {
    return null;
  }

  return (
    <>
      {/* ── FLOATING LAUNCHER BUTTON ───────────────────────────────────── */}
      {!isFullPage && !isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 group flex items-center space-x-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-emerald-600 via-agri-600 to-teal-700 text-white shadow-2xl hover:scale-105 transition-all duration-300 border border-emerald-400/40 focus:outline-none"
          title="Open AgriNexa AI Voice Assistant"
        >
          <div className="relative">
            <Bot className="w-5 h-5 text-white" />
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
            </span>
          </div>
          <span className="text-sm font-bold tracking-tight">
            {i18n.language.startsWith('kn') ? 'ಕೃಷಿ AI' : 'AgriNexa AI'}
          </span>
        </button>
      )}

      {/* ── CHAT PANEL (POPUP OR FULL PAGE) ───────────────────────────── */}
      {(isOpen || isFullPage) && (
        <div
          className={
            isFullPage
              ? 'max-w-4xl mx-auto w-full h-[85vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden my-4'
              : `fixed z-50 transition-all duration-200 shadow-2xl flex flex-col overflow-hidden ${
                  isMinimized
                    ? 'bottom-6 right-6 w-80 h-14 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800'
                    : 'bottom-4 right-4 sm:bottom-6 sm:right-6 w-[94vw] sm:w-[420px] h-[600px] max-h-[90vh] rounded-3xl bg-white/95 dark:bg-slate-950/95 border border-slate-200 dark:border-slate-800/90 backdrop-blur-xl'
                }`
          }
        >
          {/* ── HEADER ─────────────────────────────────────────────────── */}
          <div className="px-4 py-3 bg-gradient-to-r from-slate-50 via-white to-emerald-50/60 dark:from-slate-900 dark:via-slate-900 dark:to-emerald-950 border-b border-slate-200 dark:border-slate-800/90 flex items-center justify-between flex-shrink-0 shadow-sm">
            {/* Brand Title */}
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-md">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-1.5">
                  <span className="text-sm font-extrabold text-slate-900 dark:text-white">AgriNexa AI</span>
                  <span className="px-1.5 py-0.2 text-[9px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-agri-950 text-emerald-800 dark:text-agri-300 border border-emerald-300 dark:border-agri-800 rounded shadow-sm">
                    KRISHI
                  </span>
                </div>
                <div className="flex items-center space-x-1 text-[10px] text-slate-500 dark:text-slate-400">
                  <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-agri-400" />
                  <span>Simulated APMC Dataset</span>
                </div>
              </div>
            </div>

            {/* Header Controls */}
            <div className="flex items-center space-x-1.5">
              {/* Language Switcher Pill */}
              <div className="flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] font-bold shadow-sm">
                <button
                  onClick={() => setChatLang('en')}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    chatLang === 'en'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  EN
                </button>
                <button
                  onClick={() => setChatLang('kn')}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    chatLang === 'kn'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  ಕನ್ನಡ
                </button>
              </div>

              {/* Clear conversation */}
              <button
                onClick={handleClearChat}
                className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
                title="Restart Conversation / ಹೊಸ ಸಂಭಾಷಣೆ"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              {/* Fullscreen toggle on floating mode */}
              {!isFullPage && (
                <button
                  onClick={() => {
                    setIsOpen(false);
                    navigate('/chat');
                  }}
                  className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
                  title="Expand to Fullscreen / ಪೂರ್ಣ ಪರದೆ"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              )}

              {/* Close Button on floating mode */}
              {!isFullPage && (
                <button
                  onClick={() => {
                    stopSpeaking();
                    stopListening();
                    setIsOpen(false);
                  }}
                  className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
                  title="Close / ಮುಚ್ಚಿ"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* ── NOTIFICATIONS & WARNINGS ────────────────────────────────── */}
          {errorBanner && (
            <div className="px-4 py-2 bg-red-50 dark:bg-red-950/80 border-b border-red-300 dark:border-red-800 text-red-800 dark:text-red-200 text-xs flex items-center justify-between">
              <span className="flex items-center space-x-1.5">
                <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
                <span>{errorBanner}</span>
              </span>
              <button onClick={() => setErrorBanner('')}>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {speechWarning && (
            <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950/80 border-b border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs flex items-center justify-between">
              <span className="flex items-center space-x-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                <span>{speechWarning}</span>
              </span>
              <button onClick={() => setSpeechWarning('')}>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* ── MESSAGE LIST ────────────────────────────────────────────── */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 text-xs bg-slate-50/50 dark:bg-transparent">
            {messages.map((msg) => {
              const isAssistant = msg.sender === 'assistant';

              return (
                <div
                  key={msg.message_id}
                  className={`flex flex-col ${isAssistant ? 'items-start' : 'items-end'}`}
                >
                  {/* Bubble Container */}
                  <div
                    className={`max-w-[88%] rounded-2xl p-3.5 shadow-sm ${
                      isAssistant
                        ? 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-sm'
                        : 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-tr-sm shadow-md'
                    }`}
                  >
                    {/* Message Body */}
                    <div className="whitespace-pre-line leading-relaxed text-[12.5px]">
                      {msg.text}
                    </div>

                    {/* Action Chips */}
                    {isAssistant && msg.action_chips?.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap gap-1.5">
                        {msg.action_chips.map((chip, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleChipClick(chip)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-agri-950/80 hover:bg-emerald-100 dark:hover:bg-agri-900 text-emerald-800 dark:text-agri-300 border border-emerald-300 dark:border-agri-700/60 text-[11px] font-semibold transition-colors flex items-center space-x-1 shadow-sm"
                          >
                            <span>{chip.label}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Assistant Footer: Demo Tag, Speaker & Copy buttons */}
                    {isAssistant && (
                      <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                        <div className="flex items-center space-x-1 text-emerald-700 dark:text-agri-400 font-medium">
                          <ShieldCheck className="w-3 h-3" />
                          <span>Simulated Demo Data</span>
                        </div>

                        <div className="flex items-center space-x-1">
                          {/* Text-to-speech button */}
                          <button
                            onClick={() => handleSpeakMessage(msg)}
                            className={`p-1 rounded transition-colors flex items-center space-x-1 ${
                              isSpeaking && activeSpeechMsgId === msg.message_id
                                ? 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800'
                                : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
                            }`}
                            title="Listen Aloud / ಧ್ವನಿ ಕೇಳಿ"
                          >
                            {isSpeaking && activeSpeechMsgId === msg.message_id ? (
                              <>
                                <Square className="w-3 h-3 fill-current text-red-600 dark:text-red-400" />
                                <span className="text-[10px]">
                                  {chatLang === 'kn' ? 'ನಿಲ್ಲಿಸಿ' : 'Stop'}
                                </span>
                              </>
                            ) : (
                              <>
                                <Volume2 className="w-3 h-3 text-emerald-600 dark:text-agri-400" />
                                <span className="text-[10px]">
                                  {chatLang === 'kn' ? 'ಆಲಿಸಿ' : 'Listen'}
                                </span>
                              </>
                            )}
                          </button>

                          {/* Copy button */}
                          <button
                            onClick={() => handleCopyMessage(msg.message_id, msg.text)}
                            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                            title="Copy Response"
                          >
                            {copiedMsgId === msg.message_id ? (
                              <Check className="w-3 h-3 text-emerald-600 dark:text-agri-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Timestamp & Avatar */}
                  <div
                    className={`flex items-center space-x-1.5 mt-1 px-1 text-[10px] text-slate-500 ${
                      isAssistant ? 'justify-start' : 'justify-end'
                    }`}
                  >
                    {isAssistant && <Bot className="w-3 h-3 text-emerald-600 dark:text-agri-400" />}
                    <span>{msg.created_at}</span>
                  </div>
                </div>
              );
            })}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex items-start space-x-2">
                <div className="w-7 h-7 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-emerald-600 dark:text-agri-400 shadow-sm">
                  <Bot className="w-4 h-4 animate-spin" />
                </div>
                <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl rounded-tl-sm text-slate-600 dark:text-slate-400 text-xs flex items-center space-x-1.5 shadow-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce"></div>
                  <div
                    className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce"
                    style={{ animationDelay: '0.2s' }}
                  ></div>
                  <div
                    className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce"
                    style={{ animationDelay: '0.4s' }}
                  ></div>
                  <span className="ml-1 text-[11px]">
                    {chatLang === 'kn' ? 'ಉತ್ತರಿಸಲಾಗುತ್ತಿದೆ...' : 'AgriNexa AI is thinking...'}
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* ── FOOTER: SUGGESTIONS & INPUT ────────────────────────────── */}
          <div className="p-3 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800/80 flex-shrink-0 space-y-2.5 shadow-sm">
            {/* Suggested Question Chips (Horizontally Scrollable) */}
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none">
              <span className="text-[10px] font-semibold text-emerald-700 dark:text-agri-400 flex items-center space-x-1 flex-shrink-0">
                <Sparkles className="w-3 h-3" />
                <span>{chatLang === 'kn' ? 'ಪ್ರಶ್ನೆಗಳು:' : 'Suggestions:'}</span>
              </span>
              {suggestedQuestions.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(q)}
                  disabled={isLoading}
                  className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 whitespace-nowrap transition-colors flex-shrink-0 shadow-sm"
                >
                  {q}
                </button>
              ))}
            </div>

            {/* Input Bar with Microphone & Send */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center space-x-2"
            >
              {/* Voice Input Button */}
              <button
                type="button"
                onClick={handleToggleVoiceInput}
                className={`flex-shrink-0 flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border shadow-sm ${
                  isListening
                    ? 'bg-red-600 text-white border-red-500 animate-pulse shadow-lg shadow-red-950'
                    : 'bg-emerald-50 dark:bg-emerald-950/70 hover:bg-emerald-100 dark:hover:bg-emerald-900/90 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700/60'
                }`}
                title={chatLang === 'kn' ? 'ಧ್ವನಿ ಮೂಲಕ ಮಾತನಾಡಿ' : 'Speak via voice'}
              >
                {isListening ? (
                  <>
                    <MicOff className="w-4 h-4 animate-spin text-white" />
                    <span className="text-[11px] font-semibold">
                      {chatLang === 'kn' ? 'ಆಲಿಸುತ್ತಿದೆ...' : 'Listening...'}
                    </span>
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-[11px] font-semibold">
                      {chatLang === 'kn' ? 'ಮಾತನಾಡಿ' : 'Speak'}
                    </span>
                  </>
                )}
              </button>

              {/* Text Input */}
              <input
                type="text"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                placeholder={
                  chatLang === 'kn'
                    ? 'ಕನ್ನಡ ಅಥವಾ ಇಂಗ್ಲಿಷ್‌ನಲ್ಲಿ ಕೇಳಿ...'
                    : 'Ask in Kannada or English...'
                }
                className="flex-1 px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 shadow-sm"
              />

              {/* Send Button */}
              <button
                type="submit"
                disabled={isLoading || !inputQuery.trim()}
                className={`p-2 rounded-xl text-white transition-colors flex-shrink-0 ${
                  inputQuery.trim() && !isLoading
                    ? 'bg-emerald-600 hover:bg-emerald-500 shadow-md shadow-emerald-950/20'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                }`}
                title="Send Message"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatbotWidget;

