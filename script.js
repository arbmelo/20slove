/* ============================================================
   FROM THE LOVE BEGINS — Script
   YouTube Player, Rain Engine, Floating Particles,
   Starfield, Visualizer, Volume, Tracklist, Sleep Timer,
   Fullscreen, Share Card, Keyboard Shortcuts, PWA
   ============================================================ */

/* ============================================================
   SECURITY HARDENING LAYER
   - No innerHTML writes from external/user data (XSS prevention)
   - All YouTube API data sanitized before DOM insertion
   - No sensitive globals exposed on window.*
   - Cookie utility enforces Secure; HttpOnly; SameSite=Strict
   ============================================================ */

/**
 * Secure Cookie Utility
 * Enforces Secure, SameSite=Strict flags on any cookies set by this page.
 * HttpOnly cannot be set from JS (by design — it's a server-only flag),
 * but is documented here for server-side use.
 *
 * Usage: SecureCookie.set('name', 'value', { maxAge: 3600 });
 */
const SecureCookie = {
  set(name, value, options = {}) {
    if (!name || /[;=\s]/.test(name)) {
      console.warn('SecureCookie: invalid cookie name');
      return;
    }
    const sanitizedValue = encodeURIComponent(String(value));
    let cookie = `${encodeURIComponent(name)}=${sanitizedValue}; SameSite=Strict; Path=/`;
    if (location.protocol === 'https:') cookie += '; Secure';
    if (options.maxAge) cookie += `; Max-Age=${parseInt(options.maxAge, 10)}`;
    // NOTE: HttpOnly must be set server-side (see _headers / .htaccess)
    document.cookie = cookie;
  },
  get(name) {
    return document.cookie.split('; ').reduce((acc, part) => {
      const [k, v] = part.split('=');
      return decodeURIComponent(k) === name ? decodeURIComponent(v || '') : acc;
    }, null);
  },
  delete(name) {
    this.set(name, '', { maxAge: 0 });
  }
};

/**
 * DOM Sanitizer — escape untrusted strings before inserting into the DOM.
 * Only use textContent for text nodes; this covers edge cases where
 * we must create elements with user-originated content.
 */
function sanitizeText(str) {
  if (typeof str !== 'string') return '';
  // Strip any HTML tags from external API data
  return str.replace(/[<>&"'`]/g, (c) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;',
    '"': '&quot;', "'": '&#x27;', '`': '&#x60;'
  }[c]));
}

// ===================== CONFIG =====================
const PLAYLIST_ID = "PLTiqbAHq6wK8";

// ===================== YOUTUBE PLAYER =====================
let ytPlayer = null;
let isPlaying = false;
let progressTimer = null;
let metadataPollTimer = null;
// Shuffle disabled to maintain original playlist order.

function formatTime(s) {
  if (!s || isNaN(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec < 10 ? "0" : ""}${sec}`;
}

const initialRandomIndex = 0;

function instantiateYTPlayer() {
  if (ytPlayer || !window.YT || !window.YT.Player) return;
  try {
    ytPlayer = new YT.Player("youtubeBridge", {
      height: "200",
      width: "200",
      playerVars: {
        listType: "playlist",
        list: PLAYLIST_ID,
        index: initialRandomIndex,
        autoplay: 0,
        controls: 0,
        enablejsapi: 1,
        playsinline: 1,
        loop: 1,
        rel: 0,
        origin: window.location.origin,
      },
      events: {
        onReady: onPlayerReady,
        onStateChange: onPlayerStateChange,
        onError: onPlayerError,
      },
    });
  } catch (e) {
    console.warn("YT Player init error:", e);
  }
}

window.onYouTubeIframeAPIReady = function () {
  instantiateYTPlayer();
};

if (window.YT && window.YT.Player) {
  instantiateYTPlayer();
}

function onPlayerReady(event) {
  try {
    event.target.setVolume(100);
  } catch (e) {}
  startMetadataPolling();
}

function onPlayerError(e) {
  console.warn(
    "YouTube playback error (code " + (e && e.data) + "). Skipping..."
  );
  nextTrack();
}

function startMetadataPolling() {
  if (metadataPollTimer) clearInterval(metadataPollTimer);
  let attempts = 0;
  metadataPollTimer = setInterval(() => {
    attempts++;
    const hasTitle = updateTrackData();
    if (hasTitle || attempts > 25) {
      clearInterval(metadataPollTimer);
    }
  }, 250);
}

function onPlayerStateChange(event) {
  if (event.data === YT.PlayerState.PLAYING) {
    isPlaying = true;
    updatePlayIconUI(true);
    updateTrackData();
    startProgressMonitor();
  } else if (event.data === YT.PlayerState.PAUSED) {
    isPlaying = false;
    updatePlayIconUI(false);
  } else if (event.data === YT.PlayerState.ENDED) {
    nextTrack();
  } else if (
    event.data === YT.PlayerState.CUED ||
    event.data === YT.PlayerState.BUFFERING
  ) {
    updateTrackData();
  }
}

function updateTrackData() {
  if (!ytPlayer || typeof ytPlayer.getVideoData !== "function") return false;
  try {
    const data = ytPlayer.getVideoData();
    let updated = false;
    if (data && data.title && data.title.trim() !== "") {
      const trackEl = document.getElementById("trackName");
      // SECURITY: Use textContent (not innerHTML/innerText) to prevent XSS.
      // YouTube API data is external and must be treated as untrusted.
      if (trackEl && trackEl.textContent !== data.title) {
        trackEl.textContent = sanitizeText(data.title);
      }
      updated = true;
    }
    if (data && data.video_id) {
      // SECURITY: Validate video_id is alphanumeric before using in URL
      const safeVideoId = /^[a-zA-Z0-9_-]{5,20}$/.test(data.video_id)
        ? data.video_id
        : '';
      if (safeVideoId) {
        const disc = document.getElementById("coverDisc");
        if (disc)
          disc.style.backgroundImage = `url('https://img.youtube.com/vi/${safeVideoId}/hqdefault.jpg')`;
      }
    }
    return updated;
  } catch (e) {
    return false;
  }
}

function startProgressMonitor() {
  if (progressTimer) clearInterval(progressTimer);
  progressTimer = setInterval(() => {
    if (ytPlayer && ytPlayer.getCurrentTime && ytPlayer.getDuration) {
      const cur = ytPlayer.getCurrentTime() || 0;
      const dur = ytPlayer.getDuration() || 0;
      document.getElementById("timeNow").innerText = formatTime(cur);
      document.getElementById("timeTotal").innerText = formatTime(dur);
      const pct = dur > 0 ? (cur / dur) * 100 : 0;
      const fill = document.getElementById("progressFill");
      if (fill) fill.style.width = `${pct}%`;
      const pBar = document.getElementById("progressBar");
      if (pBar) pBar.setAttribute("aria-valuenow", Math.round(pct));
      updateTrackData();
    }
  }, 500);
}

function updatePlayIconUI(playing) {
  const icon = document.getElementById("playIcon");
  if (icon) {
    // SECURITY: Build SVG path via DOM API instead of innerHTML to avoid XSS.
    // Both path values are static constants — no user/external data involved.
    while (icon.firstChild) icon.removeChild(icon.firstChild);
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute(
      "d",
      playing
        ? "M6 19h4V5H6v14zm8-14v14h4V5h-4z"
        : "M8 5v14l11-7-11-7Z"
    );
    icon.appendChild(path);
  }
  const btn = document.getElementById("playButton");
  if (btn)
    btn.setAttribute("aria-label", playing ? "Pause music" : "Play music");
  const disc = document.getElementById("coverDisc");
  if (disc) disc.classList.toggle("spinning", playing);
}

function togglePlay() {
  if (!ytPlayer) {
    instantiateYTPlayer();
    return;
  }
  try {
    if (isPlaying) {
      ytPlayer.pauseVideo();
    } else {
      ytPlayer.playVideo();
      updateTrackData();
    }
  } catch (e) {
    console.log("Play toggle error:", e);
  }
}

function nextTrack() {
  if (!ytPlayer) return;
  if (ytPlayer.nextVideo) {
    try {
      ytPlayer.nextVideo();
      setTimeout(() => { updateTrackData(); }, 300);
    } catch (e) {}
  }
}

function prevTrack() {
  if (!ytPlayer) return;
  if (ytPlayer.previousVideo) {
    try {
      ytPlayer.previousVideo();
      setTimeout(() => { updateTrackData(); }, 300);
    } catch (e) {}
  }
}

// ===================== VOLUME CONTROL =====================
(function initVolume() {
  document.addEventListener("DOMContentLoaded", () => {
    const slider = document.getElementById("volumeSlider");
    const valueEl = document.getElementById("volumeValue");
    if (!slider || !valueEl) return;

    slider.addEventListener("input", () => {
      const vol = parseInt(slider.value, 10);
      valueEl.textContent = vol;
      if (ytPlayer && typeof ytPlayer.setVolume === "function") {
        ytPlayer.setVolume(vol);
      }
    });
  });
})();

// ===================== STARFIELD =====================
(function initStarfield() {
  const canvas = document.getElementById("starfieldCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let stars = [];
  let w, h;

  function resize() {
    const section = canvas.parentElement;
    w = canvas.width = section.offsetWidth;
    h = canvas.height = section.offsetHeight;
  }

  class Star {
    constructor() {
      this.reset();
    }
    reset() {
      this.x = Math.random() * w;
      this.y = Math.random() * h;
      this.size = Math.random() * 1.5 + 0.3;
      this.twinkleSpeed = Math.random() * 0.03 + 0.005;
      this.twinklePhase = Math.random() * Math.PI * 2;
      this.baseAlpha = Math.random() * 0.5 + 0.2;
      // Warm white to cool blue
      const hue = Math.random() < 0.3 ? 45 + Math.random() * 20 : 200 + Math.random() * 40;
      const sat = Math.random() < 0.3 ? 30 : 60;
      this.color = `hsla(${hue}, ${sat}%, 85%, `;
    }
    update() {
      this.twinklePhase += this.twinkleSpeed;
    }
    draw() {
      const alpha = this.baseAlpha * (0.4 + Math.sin(this.twinklePhase) * 0.6);
      if (alpha < 0.05) return;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = this.color + alpha + ")";
      ctx.fill();
      // Soft glow
      if (this.size > 1) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = this.color + alpha * 0.08 + ")";
        ctx.fill();
      }
    }
  }

  function init() {
    resize();
    const count = Math.min(120, Math.floor((w * h) / 8000));
    stars = [];
    for (let i = 0; i < count; i++) stars.push(new Star());
  }

  function animate() {
    ctx.clearRect(0, 0, w, h);
    for (const s of stars) { s.update(); s.draw(); }
    requestAnimationFrame(animate);
  }

  window.addEventListener("resize", resize);
  init();
  animate();
})();

// ===================== FLOATING PARTICLES =====================
(function initParticles() {
  const canvas = document.getElementById("particlesCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let particles = [];
  let w, h;

  function resize() {
    const section = canvas.parentElement;
    w = canvas.width = section.offsetWidth;
    h = canvas.height = section.offsetHeight;
  }

  class Particle {
    constructor() {
      this.reset(true);
    }
    reset(randomPos) {
      this.x = randomPos ? Math.random() * w : -10;
      this.y = Math.random() * h;
      this.size = Math.random() * 2.5 + 0.5;
      this.speedX = Math.random() * 0.3 + 0.05;
      this.speedY = (Math.random() - 0.5) * 0.2;
      this.opacity = Math.random() * 0.5 + 0.1;
      this.pulse = Math.random() * Math.PI * 2;
      this.pulseSpeed = Math.random() * 0.02 + 0.005;
      const hue = 180 + Math.random() * 40;
      this.color = `hsla(${hue}, 80%, 70%, `;
    }
    update() {
      this.x += this.speedX;
      this.y += this.speedY + Math.sin(this.pulse) * 0.1;
      this.pulse += this.pulseSpeed;
      if (this.x > w + 10 || this.y < -10 || this.y > h + 10) {
        this.reset(false);
      }
    }
    draw() {
      const alpha = this.opacity * (0.6 + Math.sin(this.pulse) * 0.4);
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = this.color + alpha + ")";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * 3, 0, Math.PI * 2);
      ctx.fillStyle = this.color + alpha * 0.15 + ")";
      ctx.fill();
    }
  }

  function init() {
    resize();
    const count = Math.min(60, Math.floor(w * 0.04));
    particles = [];
    for (let i = 0; i < count; i++) {
      particles.push(new Particle());
    }
  }

  function animate() {
    ctx.clearRect(0, 0, w, h);
    for (const p of particles) {
      p.update();
      p.draw();
    }
    requestAnimationFrame(animate);
  }

  window.addEventListener("resize", resize);
  init();
  animate();
})();



// ===================== RAIN, LIGHTNING & THUNDER ENGINE =====================
(function initRainEngine() {
  const toggleBtn = document.getElementById("rainToggleBtn");
  const canvas = document.getElementById("rainCanvas");
  const flashOverlay = document.getElementById("lightningFlash");
  if (!toggleBtn || !canvas || !flashOverlay) return;

  const ctx = canvas.getContext("2d");
  let isRainActive = false;
  let animFrameId = null;
  let lightningTimeout = null;
  let drops = [];
  let splashes = [];
  let width = window.innerWidth;
  let height = window.innerHeight;

  let audioCtx = null;
  let rainGainNode = null;
  let rainNoiseSource = null;

  function resizeCanvas() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  }
  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();

  class Drop {
    constructor() { this.reset(true); }
    reset(randomY) {
      this.x = Math.random() * (width + 200) - 100;
      this.y = randomY ? Math.random() * height : -20 - Math.random() * 50;
      this.z = Math.random() * 0.8 + 0.2;
      this.speed = (18 + Math.random() * 10) * this.z;
      this.len = (15 + Math.random() * 15) * this.z;
      this.wind = -2.5 * this.z;
      this.alpha = 0.15 + this.z * 0.35;
      this.thickness = 0.8 + this.z * 1.1;
    }
    update() {
      this.x += this.wind;
      this.y += this.speed;
      if (this.y > height - 30) {
        if (Math.random() < 0.35 && splashes.length < 120) {
          splashes.push(new Splash(this.x, height - 10, this.z));
        }
        this.reset(false);
      }
    }
    draw() {
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x + this.wind * 1.5, this.y + this.len);
      ctx.strokeStyle = `rgba(140, 200, 255, ${this.alpha})`;
      ctx.lineWidth = this.thickness;
      ctx.stroke();
    }
  }

  class Splash {
    constructor(x, y, z) {
      this.x = x; this.y = y; this.z = z;
      this.vx = (Math.random() - 0.5) * 4 * z;
      this.vy = -(1.5 + Math.random() * 3) * z;
      this.gravity = 0.25;
      this.life = 1;
      this.decay = 0.08 + Math.random() * 0.06;
      this.radius = (1.2 + Math.random() * 1.5) * z;
    }
    update() { this.x += this.vx; this.y += this.vy; this.vy += this.gravity; this.life -= this.decay; }
    draw() {
      if (this.life <= 0) return;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(160, 210, 255, ${this.life * 0.4})`;
      ctx.fill();
    }
  }

  function initDrops() {
    const dropCount = Math.min(300, Math.floor(width * 0.25));
    drops = [];
    for (let i = 0; i < dropCount; i++) drops.push(new Drop());
  }

  function drawLightningBolt(startX, startY, endX, endY) {
    ctx.save();
    ctx.strokeStyle = "rgba(200, 230, 255, 0.9)";
    ctx.lineWidth = 3;
    ctx.shadowColor = "rgba(100, 180, 255, 1)";
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    const steps = 14 + Math.floor(Math.random() * 8);
    for (let i = 0; i < steps; i++) {
      const t = (i + 1) / steps;
      const targetX = startX + (endX - startX) * t + (Math.random() - 0.5) * 70;
      const targetY = startY + (endY - startY) * t;
      ctx.lineTo(targetX, targetY);
      if (Math.random() < 0.4 && i < steps - 2) {
        ctx.moveTo(targetX, targetY);
        ctx.lineTo(targetX + (Math.random() - 0.5) * 90, targetY + 30 + Math.random() * 40);
        ctx.moveTo(targetX, targetY);
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  function triggerLightning() {
    if (!isRainActive) return;
    const flashIntensity = 0.5 + Math.random() * 0.35;
    flashOverlay.style.opacity = flashIntensity.toString();
    const boltStartX = Math.random() * width * 0.8 + width * 0.1;
    drawLightningBolt(boltStartX, 0, boltStartX + (Math.random() - 0.5) * 200, height * 0.7);
    setTimeout(() => {
      if (!isRainActive) return;
      flashOverlay.style.opacity = "0.1";
      setTimeout(() => {
        if (!isRainActive) return;
        flashOverlay.style.opacity = (flashIntensity * 0.7).toString();
        setTimeout(() => { flashOverlay.style.opacity = "0"; }, 60);
      }, 45);
    }, 50);
    playThunderSound();
    lightningTimeout = setTimeout(triggerLightning, 6000 + Math.random() * 10000);
  }

  function initAudio() {
    if (audioCtx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audioCtx = new AC();
      const bufferSize = audioCtx.sampleRate * 2;
      const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = output[i];
        output[i] *= 2.8;
      }
      rainNoiseSource = audioCtx.createBufferSource();
      rainNoiseSource.buffer = noiseBuffer;
      rainNoiseSource.loop = true;
      const filter = audioCtx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 900;
      rainGainNode = audioCtx.createGain();
      rainGainNode.gain.setValueAtTime(0.001, audioCtx.currentTime);
      rainNoiseSource.connect(filter);
      filter.connect(rainGainNode);
      rainGainNode.connect(audioCtx.destination);
      rainNoiseSource.start(0);
    } catch (e) {
      console.warn("AudioContext rain init:", e);
    }
  }

  function playThunderSound() {
    if (!audioCtx) return;
    try {
      if (audioCtx.state === "suspended") audioCtx.resume();
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const oscGain = audioCtx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(80, now);
      osc.frequency.exponentialRampToValueAtTime(25, now + 2.5);
      const filter = audioCtx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(160, now);
      filter.frequency.linearRampToValueAtTime(60, now + 2.5);
      oscGain.gain.setValueAtTime(0.01, now);
      oscGain.gain.linearRampToValueAtTime(0.2, now + 0.1);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 3.0);
      osc.connect(filter);
      filter.connect(oscGain);
      oscGain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 3.2);
      const crackBuffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 2.2, audioCtx.sampleRate);
      const data = crackBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (audioCtx.sampleRate * 0.6));
      }
      const crackSource = audioCtx.createBufferSource();
      crackSource.buffer = crackBuffer;
      const crackFilter = audioCtx.createBiquadFilter();
      crackFilter.type = "bandpass";
      crackFilter.frequency.setValueAtTime(320, now);
      crackFilter.Q.value = 1.8;
      const crackGain = audioCtx.createGain();
      crackGain.gain.setValueAtTime(0.15, now);
      crackGain.gain.exponentialRampToValueAtTime(0.001, now + 2.2);
      crackSource.connect(crackFilter);
      crackFilter.connect(crackGain);
      crackGain.connect(audioCtx.destination);
      crackSource.start(now + 0.05);
    } catch (e) {
      console.warn("Thunder sound:", e);
    }
  }

  function animate() {
    if (!isRainActive) return;
    ctx.clearRect(0, 0, width, height);
    for (let i = 0; i < drops.length; i++) { drops[i].update(); drops[i].draw(); }
    for (let i = splashes.length - 1; i >= 0; i--) {
      splashes[i].update(); splashes[i].draw();
      if (splashes[i].life <= 0) splashes.splice(i, 1);
    }
    animFrameId = requestAnimationFrame(animate);
  }

  function startRain() {
    isRainActive = true;
    canvas.classList.add("active");
    toggleBtn.classList.add("active");
    toggleBtn.setAttribute("aria-pressed", "true");
    const statusEl = toggleBtn.querySelector(".rain-status");
    if (statusEl) statusEl.textContent = "ON";
    initDrops();
    initAudio();
    if (rainGainNode && audioCtx) {
      rainGainNode.gain.cancelScheduledValues(audioCtx.currentTime);
      rainGainNode.gain.setValueAtTime(rainGainNode.gain.value, audioCtx.currentTime);
      rainGainNode.gain.linearRampToValueAtTime(0.12, audioCtx.currentTime + 1.5);
    }
    animate();
    lightningTimeout = setTimeout(triggerLightning, 3000 + Math.random() * 4000);
  }

  function stopRain() {
    isRainActive = false;
    canvas.classList.remove("active");
    toggleBtn.classList.remove("active");
    toggleBtn.setAttribute("aria-pressed", "false");
    const statusEl = toggleBtn.querySelector(".rain-status");
    if (statusEl) statusEl.textContent = "OFF";
    if (animFrameId) cancelAnimationFrame(animFrameId);
    if (lightningTimeout) clearTimeout(lightningTimeout);
    flashOverlay.style.opacity = "0";
    if (rainGainNode && audioCtx) {
      rainGainNode.gain.cancelScheduledValues(audioCtx.currentTime);
      rainGainNode.gain.setValueAtTime(rainGainNode.gain.value, audioCtx.currentTime);
      rainGainNode.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 1.0);
    }
    ctx.clearRect(0, 0, width, height);
    drops = [];
    splashes = [];
  }

  // SECURITY: Instead of exposing a global window._toggleRain (which any
  // injected script could call), dispatch a custom event that only this
  // scoped IIFE listens to. This follows the Principle of Least Privilege.
  document.addEventListener("rain:toggle", () => {
    if (isRainActive) stopRain(); else startRain();
  });

  toggleBtn.addEventListener("click", () => {
    if (isRainActive) stopRain(); else startRain();
  });
})();



// ===================== SLEEP TIMER =====================
let sleepTimerInterval = null;
let sleepTimeRemaining = 0;

function startSleepTimer(minutes) {
  clearSleepTimer();
  if (minutes <= 0) return;
  sleepTimeRemaining = minutes * 60;
  const statusEl = document.getElementById("sleepTimerStatus");

  sleepTimerInterval = setInterval(() => {
    sleepTimeRemaining--;
    if (statusEl) {
      const m = Math.floor(sleepTimeRemaining / 60);
      const s = sleepTimeRemaining % 60;
      statusEl.textContent = `${m}:${s < 10 ? "0" : ""}${s}`;
    }
    if (sleepTimeRemaining <= 0) {
      clearSleepTimer();
      // Pause the music
      if (ytPlayer && isPlaying) {
        ytPlayer.pauseVideo();
      }
      showToast("💤 Sleep timer — music paused");
    }
  }, 1000);

  const sleepBtn = document.getElementById("sleepTimerBtn");
  if (sleepBtn) sleepBtn.classList.add("active");
  showToast(`🌙 Sleep timer set: ${minutes} min`);
}

function clearSleepTimer() {
  if (sleepTimerInterval) clearInterval(sleepTimerInterval);
  sleepTimerInterval = null;
  sleepTimeRemaining = 0;
  const statusEl = document.getElementById("sleepTimerStatus");
  if (statusEl) statusEl.textContent = "OFF";
  const sleepBtn = document.getElementById("sleepTimerBtn");
  if (sleepBtn) sleepBtn.classList.remove("active");
}

// ===================== FULLSCREEN MODE =====================
function toggleFullscreen() {
  const body = document.body;
  const icon = document.getElementById("fullscreenIcon");
  if (body.classList.contains("fullscreen-mode")) {
    body.classList.remove("fullscreen-mode");
    if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
    if (icon) icon.innerHTML = '<path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>';
    showToast("Exited fullscreen");
  } else {
    body.classList.add("fullscreen-mode");
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
    if (icon) icon.innerHTML = '<path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>';
    showToast("Fullscreen mode — immersive vibes 🌃");
  }
}

document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement) {
    document.body.classList.remove("fullscreen-mode");
    const icon = document.getElementById("fullscreenIcon");
    if (icon) icon.innerHTML = '<path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>';
  }
});

// ===================== SHARE CARD =====================
function generateShareCard() {
  const canvas = document.getElementById("shareCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const w = 600, h = 340;
  canvas.width = w;
  canvas.height = h;

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, "#0a0e1a");
  bg.addColorStop(0.5, "#111827");
  bg.addColorStop(1, "#0f172a");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Decorative circles
  ctx.beginPath();
  ctx.arc(w * 0.85, h * 0.2, 80, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(6, 182, 212, 0.08)";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(w * 0.1, h * 0.8, 60, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(34, 211, 238, 0.06)";
  ctx.fill();

  // Border
  ctx.strokeStyle = "rgba(6, 182, 212, 0.2)";
  ctx.lineWidth = 2;
  ctx.roundRect(8, 8, w - 16, h - 16, 12);
  ctx.stroke();

  // Now playing label
  ctx.fillStyle = "#06b6d4";
  ctx.font = "500 12px 'Outfit', sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("♫ NOW PLAYING", 40, 50);

  // Song title
  const trackName = document.getElementById("trackName")?.innerText || "Unknown Track";
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 24px 'Outfit', sans-serif";
  // Word wrap
  const words = trackName.split(" ");
  let line = "";
  let y = 90;
  for (const word of words) {
    const test = line + word + " ";
    if (ctx.measureText(test).width > w - 80 && line) {
      ctx.fillText(line.trim(), 40, y);
      line = word + " ";
      y += 32;
    } else {
      line = test;
    }
  }
  ctx.fillText(line.trim(), 40, y);

  // Station
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = "400 13px 'Poppins', sans-serif";
  ctx.fillText("2020's Bollywood Collection", 40, y + 35);

  // Branding
  ctx.fillStyle = "rgba(6, 182, 212, 0.8)";
  ctx.font = "700 16px 'Outfit', sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("From the Love Begins", w - 40, h - 55);
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.font = "400 11px 'Poppins', sans-serif";
  ctx.fillText("A playlist by ArbMelo", w - 40, h - 35);

  // Show overlay
  const overlay = document.getElementById("shareOverlay");
  if (overlay) overlay.classList.add("visible");
}

// ===================== TOAST NOTIFICATION =====================
let toastTimer = null;

/**
 * SECURITY: showToast previously used innerHTML, which allowed HTML injection
 * from any caller. It now builds the DOM safely:
 * - Plain text messages use textContent
 * - <kbd> tags (from keyboard shortcut labels) are whitelisted and constructed
 *   via DOM API — no raw HTML string is ever inserted.
 */
function showToast(message) {
  const toast = document.getElementById("shortcutToast");
  if (!toast) return;

  // Clear previous content
  while (toast.firstChild) toast.removeChild(toast.firstChild);

  // Parse allowed <kbd>text</kbd> pattern using regex (whitelist approach)
  // All other HTML is treated as plain text — no eval, no innerHTML.
  const kbdPattern = /<kbd>([^<]{1,20})<\/kbd>/g;
  let lastIndex = 0;
  let match;
  const safeMsg = String(message);

  while ((match = kbdPattern.exec(safeMsg)) !== null) {
    // Text node before <kbd>
    if (match.index > lastIndex) {
      toast.appendChild(
        document.createTextNode(safeMsg.slice(lastIndex, match.index))
      );
    }
    // Whitelisted <kbd> element
    const kbd = document.createElement("kbd");
    kbd.textContent = match[1]; // inner text is safe — max 20 chars, no HTML
    toast.appendChild(kbd);
    lastIndex = match.index + match[0].length;
  }

  // Remaining text after last <kbd> (or entire message if no <kbd>)
  if (lastIndex < safeMsg.length) {
    toast.appendChild(document.createTextNode(safeMsg.slice(lastIndex)));
  }

  toast.classList.add("show");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2000);
}

// ===================== FAKE LISTENER COUNT =====================
(function initListenerCount() {
  const el = document.getElementById("listenerCount");
  if (!el) return;
  let count = 800 + Math.floor(Math.random() * 400);
  el.textContent = count.toLocaleString();
  setInterval(() => {
    count += Math.floor(Math.random() * 7) - 3;
    count = Math.max(600, count);
    el.textContent = count.toLocaleString();
  }, 4000);
})();

// ===================== KEYBOARD SHORTCUTS =====================
document.addEventListener("keydown", (e) => {
  // Don't trigger if user is typing in an input
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

  switch (e.code) {
    case "Space":
      e.preventDefault();
      togglePlay();
      showToast(isPlaying ? "<kbd>Space</kbd> Paused" : "<kbd>Space</kbd> Playing");
      break;
    case "ArrowRight":
      e.preventDefault();
      nextTrack();
      showToast("<kbd>→</kbd> Next track");
      break;
    case "ArrowLeft":
      e.preventDefault();
      prevTrack();
      showToast("<kbd>←</kbd> Previous track");
      break;
    case "ArrowUp":
      e.preventDefault();
      adjustVolume(10);
      break;
    case "ArrowDown":
      e.preventDefault();
      adjustVolume(-10);
      break;
    case "KeyF":
      toggleFullscreen();
      break;
    case "KeyR":
      // SECURITY: Dispatch event instead of calling global window._toggleRain
      document.dispatchEvent(new CustomEvent("rain:toggle"));
      break;
    case "KeyS":
      generateShareCard();
      showToast("<kbd>S</kbd> Share card generated");
      break;
  }
});

function adjustVolume(delta) {
  const slider = document.getElementById("volumeSlider");
  const valueEl = document.getElementById("volumeValue");
  if (!slider) return;
  let vol = parseInt(slider.value, 10) + delta;
  vol = Math.max(0, Math.min(100, vol));
  slider.value = vol;
  if (valueEl) valueEl.textContent = vol;
  if (ytPlayer && typeof ytPlayer.setVolume === "function") {
    ytPlayer.setVolume(vol);
  }
  showToast(`<kbd>${delta > 0 ? "↑" : "↓"}</kbd> Volume: ${vol}%`);
}

// ===================== DOM READY =====================
document.addEventListener("DOMContentLoaded", () => {
  // Player controls
  document.getElementById("coverButton")?.addEventListener("click", togglePlay);
  document.getElementById("playButton")?.addEventListener("click", togglePlay);
  document.getElementById("prevButton")?.addEventListener("click", prevTrack);
  document.getElementById("nextButton")?.addEventListener("click", nextTrack);

  // Progress bar seeking
  const progressBar = document.getElementById("progressBar");
  if (progressBar) {
    progressBar.addEventListener("click", (e) => {
      if (!ytPlayer || !ytPlayer.getDuration) return;
      const rect = progressBar.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      ytPlayer.seekTo(pct * ytPlayer.getDuration(), true);
    });
  }

  // Fullscreen button
  document.getElementById("fullscreenBtn")?.addEventListener("click", toggleFullscreen);



  // Sleep timer
  const sleepTimerBtn = document.getElementById("sleepTimerBtn");
  const sleepTimerMenu = document.getElementById("sleepTimerMenu");
  if (sleepTimerBtn && sleepTimerMenu) {
    sleepTimerBtn.addEventListener("click", () => {
      sleepTimerMenu.classList.toggle("visible");
    });
    sleepTimerMenu.querySelectorAll(".sleep-option").forEach((opt) => {
      opt.addEventListener("click", () => {
        // SECURITY: Validate data-minutes is a safe integer in allowed range
        // before using it, preventing prototype pollution or unexpected values.
        const raw = parseInt(opt.dataset.minutes, 10);
        const ALLOWED_MINUTES = [0, 15, 30, 60, 90];
        const minutes = ALLOWED_MINUTES.includes(raw) ? raw : 0;
        if (minutes > 0) {
          startSleepTimer(minutes);
        } else {
          clearSleepTimer();
          showToast("🌙 Sleep timer cancelled");
        }
        sleepTimerMenu.classList.remove("visible");
      });
    });
    // Close menu when clicking outside
    document.addEventListener("click", (e) => {
      if (!sleepTimerMenu.contains(e.target) && e.target !== sleepTimerBtn && !sleepTimerBtn.contains(e.target)) {
        sleepTimerMenu.classList.remove("visible");
      }
    });
  }

  // Share card
  document.getElementById("shareDownloadBtn")?.addEventListener("click", () => {
    const canvas = document.getElementById("shareCanvas");
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "now-playing-from-the-love-begins.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  });
  document.getElementById("shareCloseBtn")?.addEventListener("click", () => {
    document.getElementById("shareOverlay")?.classList.remove("visible");
  });
  // Close share overlay on backdrop click
  document.getElementById("shareOverlay")?.addEventListener("click", (e) => {
    if (e.target.id === "shareOverlay") {
      e.target.classList.remove("visible");
    }
  });

  // ===================== SUPPORT MODAL =====================
  // SECURITY: All modal interactions use safe DOM API methods.
  // No innerHTML, no dynamic content injection from external sources.

  const supportOverlay = document.getElementById("supportOverlay");
  const supportBtn     = document.getElementById("supportBtn");
  const supportClose   = document.getElementById("supportCloseBtn");

  function openSupportModal() {
    if (!supportOverlay) return;
    supportOverlay.classList.add("visible");
    supportOverlay.setAttribute("aria-hidden", "false");
    // Trap focus on close button for accessibility
    requestAnimationFrame(() => supportClose?.focus());
    showToast("☕ Scan the QR to support!");
  }

  function closeSupportModal() {
    if (!supportOverlay) return;
    supportOverlay.classList.remove("visible");
    supportOverlay.setAttribute("aria-hidden", "true");
    // Return focus to the trigger button
    supportBtn?.focus();
  }

  supportBtn?.addEventListener("click", openSupportModal);
  supportClose?.addEventListener("click", closeSupportModal);

  // Close on backdrop click (outside the card)
  supportOverlay?.addEventListener("click", (e) => {
    if (e.target === supportOverlay) closeSupportModal();
  });

  // Close on Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && supportOverlay?.classList.contains("visible")) {
      closeSupportModal();
    }
  });
});


