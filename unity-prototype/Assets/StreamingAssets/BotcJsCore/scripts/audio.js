const DEFAULT_AUDIO_SETTINGS = {
  masterVolume: 1,
  sfxVolume: 1,
  musicVolume: 0.35,
};

let audioCtx = null;
let settings = { ...DEFAULT_AUDIO_SETTINGS };
let masterGain = null;
let sfxGain = null;
let musicGain = null;
let musicNodes = [];
let currentMood = "";
let mediaTracks = null;
let currentMediaTrack = null;

const MUSIC_TRACKS = {
  day: [
    "./When_the_Clock_Stops.mp3",
    "./When the Clock Stops.mp3",
    "./when the clock stops.mp4",
    "./when_the_clock_stops.mp4",
  ],
  night: [
    "./Where_Shadows_Scratch_Stone.mp3",
    "./Where Shadows Scratch Stone.mp3",
    "./where shadows scratch stone.mp4",
    "./where_shadows_scratch_stone.mp4",
  ],
  ceremony: [
    "./Gavel_in_the_Square.mp3",
    "./Gavel in the Square.mp3",
    "./gavel in the square.mp4",
    "./gavel_in_the_square.mp4",
  ],
};

function clamp01(value, fallback = 1) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(0, Math.min(1, parsed));
}

function ensureAudioContext() {
  if (audioCtx) {
    return audioCtx;
  }
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) {
    return null;
  }
  audioCtx = new AudioCtor();
  masterGain = audioCtx.createGain();
  sfxGain = audioCtx.createGain();
  musicGain = audioCtx.createGain();
  sfxGain.connect(masterGain);
  musicGain.connect(masterGain);
  masterGain.connect(audioCtx.destination);
  applyGainSettings();
  return audioCtx;
}

function applyGainSettings() {
  if (!audioCtx || !masterGain || !sfxGain || !musicGain) {
    applyMediaVolume();
    return;
  }
  const t = audioCtx.currentTime;
  masterGain.gain.setTargetAtTime(settings.masterVolume, t, 0.02);
  sfxGain.gain.setTargetAtTime(settings.sfxVolume, t, 0.02);
  musicGain.gain.setTargetAtTime(settings.musicVolume, t, 0.08);
  applyMediaVolume();
}

function stopMusicNodes() {
  musicNodes.forEach((node) => {
    try {
      node.stop?.();
      node.disconnect?.();
    } catch {
      // The placeholder music graph is disposable; failed stop calls are harmless.
    }
  });
  musicNodes = [];
}

function applyMediaVolume() {
  if (!mediaTracks) {
    return;
  }
  const volume = clamp01(settings.masterVolume * settings.musicVolume, 0.35);
  Object.values(mediaTracks).forEach((audio) => {
    audio.volume = volume;
    audio.muted = volume <= 0;
  });
}

function createTrackElement(src) {
  const audio = new Audio(src);
  audio.loop = true;
  audio.preload = "auto";
  audio.crossOrigin = "anonymous";
  audio.volume = clamp01(settings.masterVolume * settings.musicVolume, 0.35);
  audio.addEventListener("error", () => {
    if (currentMediaTrack === audio) {
      currentMediaTrack = null;
      stopMediaTracks();
      startPlaceholderMusic(currentMood || "day");
    }
  });
  return audio;
}

function ensureMediaTracks() {
  if (mediaTracks) {
    return mediaTracks;
  }
  mediaTracks = {};
  Object.entries(MUSIC_TRACKS).forEach(([mood, candidates]) => {
    const source = candidates.find(Boolean);
    if (source) {
      mediaTracks[mood] = createTrackElement(source);
    }
  });
  applyMediaVolume();
  return mediaTracks;
}

function stopMediaTracks(except = null) {
  if (!mediaTracks) {
    return;
  }
  Object.values(mediaTracks).forEach((audio) => {
    if (audio === except) {
      return;
    }
    audio.pause();
    audio.currentTime = 0;
  });
}

function playMediaMood(mood) {
  const tracks = ensureMediaTracks();
  const audio = tracks[mood] ?? tracks.day;
  if (!audio || settings.masterVolume <= 0 || settings.musicVolume <= 0) {
    return false;
  }
  if (currentMediaTrack === audio && !audio.paused) {
    return true;
  }
  stopMusicNodes();
  stopMediaTracks(audio);
  currentMediaTrack = audio;
  audio.currentTime = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
  const started = audio.play();
  if (started?.catch) {
    started.catch(() => {
      if (currentMediaTrack === audio) {
        currentMediaTrack = null;
        startPlaceholderMusic(mood);
      }
    });
  }
  return true;
}

function startPlaceholderMusic(mood = "day") {
  const ctx = ensureAudioContext();
  if (!ctx || !musicGain || settings.masterVolume <= 0 || settings.musicVolume <= 0) {
    return;
  }
  stopMusicNodes();

  const nextMood = `${mood ?? "day"}`;
  const base = nextMood === "night" ? 73.42 : nextMood === "ceremony" ? 82.41 : 98;
  const fifth = base * 1.5;
  const oscA = ctx.createOscillator();
  const oscB = ctx.createOscillator();
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  const padGain = ctx.createGain();

  oscA.type = "sine";
  oscB.type = nextMood === "ceremony" ? "sawtooth" : "triangle";
  lfo.type = "sine";
  oscA.frequency.value = base;
  oscB.frequency.value = fifth;
  lfo.frequency.value = nextMood === "night" ? 0.06 : 0.045;
  lfoGain.gain.value = 0.025;
  padGain.gain.value = nextMood === "ceremony" ? 0.055 : 0.075;

  lfo.connect(lfoGain);
  lfoGain.connect(padGain.gain);
  oscA.connect(padGain);
  oscB.connect(padGain);
  padGain.connect(musicGain);

  const start = ctx.currentTime;
  oscA.start(start);
  oscB.start(start);
  lfo.start(start);
  musicNodes = [oscA, oscB, lfo, lfoGain, padGain];
}

function tone({ frequency = 440, duration = 0.12, type = "sine", gain = 0.08, delay = 0 }) {
  const ctx = ensureAudioContext();
  if (!ctx || !sfxGain || settings.masterVolume <= 0 || settings.sfxVolume <= 0) {
    return;
  }
  const start = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const envelope = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, start);
  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), start + 0.012);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(envelope);
  envelope.connect(sfxGain);
  osc.start(start);
  osc.stop(start + duration + 0.03);
}

export function configureAudio(nextSettings = {}) {
  settings = {
    masterVolume: clamp01(nextSettings.masterVolume, settings.masterVolume),
    sfxVolume: clamp01(nextSettings.sfxVolume, settings.sfxVolume),
    musicVolume: clamp01(nextSettings.musicVolume, settings.musicVolume),
  };
  applyGainSettings();
}

export function primeAudio() {
  const ctx = ensureAudioContext();
  if (ctx?.state === "suspended") {
    ctx.resume().catch(() => {});
  }
}

export function playCue(name = "click") {
  primeAudio();
  const cue = `${name ?? "click"}`;
  if (cue === "night") {
    tone({ frequency: 164, duration: 0.22, type: "triangle", gain: 0.07 });
    tone({ frequency: 246, duration: 0.18, type: "sine", gain: 0.04, delay: 0.08 });
    return;
  }
  if (cue === "storyteller") {
    tone({ frequency: 392, duration: 0.16, type: "sine", gain: 0.07 });
    tone({ frequency: 523, duration: 0.18, type: "triangle", gain: 0.055, delay: 0.09 });
    return;
  }
  if (cue === "whisper") {
    tone({ frequency: 330, duration: 0.08, type: "sine", gain: 0.045 });
    tone({ frequency: 294, duration: 0.1, type: "sine", gain: 0.035, delay: 0.06 });
    return;
  }
  if (cue === "public") {
    tone({ frequency: 262, duration: 0.08, type: "square", gain: 0.035 });
    tone({ frequency: 392, duration: 0.11, type: "triangle", gain: 0.045, delay: 0.06 });
    return;
  }
  if (cue === "phase") {
    tone({ frequency: 220, duration: 0.12, type: "triangle", gain: 0.04 });
    tone({ frequency: 330, duration: 0.16, type: "triangle", gain: 0.045, delay: 0.08 });
    return;
  }
  tone({ frequency: 520, duration: 0.055, type: "sine", gain: 0.032 });
}

export function setMusicMood(mood = "day") {
  const nextMood = `${mood ?? "day"}`;
  if (currentMood === nextMood && (musicNodes.length > 0 || (currentMediaTrack && !currentMediaTrack.paused))) {
    return;
  }
  currentMood = nextMood;
  if (!playMediaMood(nextMood)) {
    startPlaceholderMusic(nextMood);
  }
}

export function stopBackgroundMusic() {
  currentMood = "";
  currentMediaTrack = null;
  stopMediaTracks();
  stopMusicNodes();
}
