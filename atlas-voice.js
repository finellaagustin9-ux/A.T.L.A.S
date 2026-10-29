
(() => {
  "use strict";

  const STORAGE_KEY = "atlasVoiceSettings";

  const profiles = {
    jarvis: {
      name: "J.A.R.V.I.S.",
      lang: "en-GB",
      rate: 0.88,
      pitch: 0.78,
      preferredVoices: /daniel|george|oliver|male/i,
      sample:
        "Good evening. I am Atlas. All systems are ready. How may I assist you?"
    },

    edith: {
      name: "E.D.I.T.H.",
      lang: "en-GB",
      rate: 0.96,
      pitch: 1.08,
      preferredVoices: /female|serena|kate|victoria|samantha/i,
      sample:
        "Hello. I am Atlas. Your systems are ready. How can I help you today?"
    }
  };

  let voices = [];
  let currentUtterance = null;

  function loadSettings() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch {
      return {};
    }
  }

  let settings = loadSettings();

  function saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // La voz sigue funcionando aunque el almacenamiento no esté disponible.
    }
  }

  function getVoices() {
    if (!("speechSynthesis" in window)) return [];

    voices = window.speechSynthesis.getVoices();
    return voices;
  }

  function findVoice(profileId) {
    const profile = profiles[profileId];
    const list = getVoices();

    const matchingLanguage = list.filter(voice =>
      voice.lang.toLowerCase() === profile.lang.toLowerCase()
    );

    const preferred = matchingLanguage.find(voice =>
      profile.preferredVoices.test(voice.name)
    );

    return preferred || matchingLanguage[0] || list[0] || null;
  }

  function speak(text, profileId = settings.profile || "jarvis") {
    if (!("speechSynthesis" in window)) {
      return {
        ok: false,
        error: "Este navegador no admite voz sintetizada."
      };
    }

    if (!text || !String(text).trim()) {
      return {
        ok: false,
        error: "No hay texto para reproducir."
      };
    }

    const profile = profiles[profileId] || profiles.jarvis;
    const voice = findVoice(profileId);

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(String(text));
    utterance.lang = voice?.lang || profile.lang;
    utterance.rate = Number(settings.rate ?? profile.rate);
    utterance.pitch = Number(settings.pitch ?? profile.pitch);

    if (voice) utterance.voice = voice;

    currentUtterance = utterance;

    utterance.onend = () => {
      currentUtterance = null;
      window.dispatchEvent(new CustomEvent("atlas-voice-ended"));
    };

    utterance.onerror = event => {
      currentUtterance = null;
      window.dispatchEvent(
        new CustomEvent("atlas-voice-error", {
          detail: { error: event.error }
        })
      );
    };

    window.speechSynthesis.speak(utterance);

    return { ok: true, voice: voice?.name || "Voz predeterminada" };
  }

  function stop() {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    currentUtterance = null;
  }

  function setProfile(profileId) {
    if (!profiles[profileId]) {
      throw new Error("Perfil de voz desconocido.");
    }

    settings.profile = profileId;
    saveSettings();

    window.dispatchEvent(
      new CustomEvent("atlas-voice-profile-changed", {
        detail: { profile: profileId }
      })
    );

    return profiles[profileId];
  }

  function setRate(rate) {
    settings.rate = Math.min(1.3, Math.max(0.65, Number(rate)));
    saveSettings();
  }

  function setPitch(pitch) {
    settings.pitch = Math.min(1.3, Math.max(0.7, Number(pitch)));
    saveSettings();
  }

  function getProfiles() {
    return Object.keys(profiles).map(id => ({
      id,
      name: profiles[id].name,
      language: profiles[id].lang
    }));
  }

  function getStatus() {
    return {
      supported: "speechSynthesis" in window,
      voicesAvailable: getVoices().length,
      profile: settings.profile || "jarvis",
      selectedVoice: findVoice(settings.profile || "jarvis")?.name || null,
      rate: settings.rate ?? profiles[settings.profile || "jarvis"].rate,
      pitch: settings.pitch ?? profiles[settings.profile || "jarvis"].pitch
    };
  }

  window.ATLASVoice = Object.freeze({
    speak,
    stop,
    setProfile,
    setRate,
    setPitch,
    getProfiles,
    getStatus
  });

  if ("speechSynthesis" in window) {
    getVoices();
    window.speechSynthesis.addEventListener("voiceschanged", getVoices);
  }
})();
