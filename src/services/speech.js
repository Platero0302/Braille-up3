let currentUtterance = null;

export function speak(text, options = {}) {
  if (!("speechSynthesis" in window) || !String(text || "").trim()) return false;

  const { interrupt = true, rate = 0.88, pitch = 1, volume = 1 } = options;

  if (interrupt) window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(String(text));
  utterance.lang = "pt-BR";
  utterance.rate = rate;
  utterance.pitch = pitch;
  utterance.volume = volume;

  const voices = window.speechSynthesis.getVoices();
  const ptVoice = voices.find((voice) => voice.lang?.toLowerCase().startsWith("pt-br"))
    || voices.find((voice) => voice.lang?.toLowerCase().startsWith("pt"));
  if (ptVoice) utterance.voice = ptVoice;

  currentUtterance = utterance;
  window.speechSynthesis.speak(utterance);
  return true;
}

export function stopSpeaking() {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    currentUtterance = null;
  }
}
