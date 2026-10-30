/**
 * Speech Processing Utilities for AgriNexa Multilingual Voice Chatbot.
 * Provides browser Web Speech API wrappers for SpeechRecognition and SpeechSynthesis.
 */

// Strip markdown characters and URLs for natural speech synthesis
export const sanitizeForSpeech = (markdownText) => {
  if (!markdownText) return '';
  return markdownText
    .replace(/[*_#`~>]/g, '')           // Remove formatting symbols
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Extract link text
    .replace(/•/g, ', ')                // Replace bullets with pauses
    .replace(/\n+/g, '. ')              // Replace newlines with sentence pauses
    .replace(/\s+/g, ' ')               // Collapse whitespace
    .trim();
};

// Check if browser Speech Recognition is supported
export const isSpeechRecognitionSupported = () => {
  return typeof window !== 'undefined' && (
    'SpeechRecognition' in window || 'webkitSpeechRecognition' in window
  );
};

// Check if Speech Synthesis is supported
export const isSpeechSynthesisSupported = () => {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
};

// Create a configured SpeechRecognition instance
export const createSpeechRecognizer = ({
  lang = 'kn-IN',
  onResult,
  onError,
  onEnd
}) => {
  if (!isSpeechRecognitionSupported()) {
    return null;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();

  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = lang; // 'kn-IN' for Kannada, 'en-IN' for Indian English

  recognition.onresult = (event) => {
    let transcript = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
    }
    if (onResult) {
      onResult(transcript, event.results[event.results.length - 1].isFinal);
    }
  };

  recognition.onerror = (event) => {
    if (onError) {
      onError(event.error);
    }
  };

  recognition.onend = () => {
    if (onEnd) {
      onEnd();
    }
  };

  return recognition;
};

// Speak text using browser SpeechSynthesis with appropriate language voice
export const speakText = (text, language = 'kn', onStart, onEnd, onError) => {
  if (!isSpeechSynthesisSupported() || !text) {
    if (onError) onError('Speech synthesis not supported on this browser.');
    return;
  }

  // Cancel any currently playing speech
  window.speechSynthesis.cancel();

  const cleanText = sanitizeForSpeech(text);
  const utterance = new SpeechSynthesisUtterance(cleanText);

  // Set target language locale
  const targetLocale = language.startsWith('kn') ? 'kn-IN' : 'en-IN';
  utterance.lang = targetLocale;
  utterance.rate = 0.95; // Slightly slower for clarity in rural agriculture terminology
  utterance.pitch = 1.0;

  // Find matching voice
  const voices = window.speechSynthesis.getVoices();
  const matchedVoice = voices.find(v => v.lang === targetLocale || v.lang.startsWith(language));
  if (matchedVoice) {
    utterance.voice = matchedVoice;
  }

  if (onStart) utterance.onstart = onStart;
  if (onEnd) utterance.onend = onEnd;
  if (onError) utterance.onerror = onError;

  window.speechSynthesis.speak(utterance);
};

// Stop speech synthesis
export const stopSpeech = () => {
  if (isSpeechSynthesisSupported()) {
    window.speechSynthesis.cancel();
  }
};

