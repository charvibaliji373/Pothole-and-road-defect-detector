/**
 * RoadVision AI - Real-Time Dashcam HUD Simulator & Cockpit Proximity Warning System
 */

class LiveHudController {
  constructor() {
    this.videoElement = null;
    this.canvasElement = null;
    this.stream = null;
    this.isStreaming = false;
    this.isSimulating = false;
    this.audioAlertsEnabled = true;
    this.audioCtx = null;
    this.speed = 38;
    this.speedInterval = null;
    this.detectionInterval = null;
    this.init();
  }

  init() {
    this.videoElement = document.getElementById('hud-video');
    this.canvasElement = document.getElementById('hud-canvas');

    const btnStartCamera = document.getElementById('btn-start-camera');
    const btnSimulateDrive = document.getElementById('btn-simulate-drive');
    const btnStopStream = document.getElementById('btn-stop-stream');
    const toggleAudioBtn = document.getElementById('btn-toggle-hud-audio');

    if (btnStartCamera) {
      btnStartCamera.addEventListener('click', () => this.startWebcam());
    }

    if (btnSimulateDrive) {
      btnSimulateDrive.addEventListener('click', () => this.startSimulation());
    }

    if (btnStopStream) {
      btnStopStream.addEventListener('click', () => this.stopStream());
    }

    if (toggleAudioBtn) {
      toggleAudioBtn.addEventListener('click', () => {
        this.audioAlertsEnabled = !this.audioAlertsEnabled;
        toggleAudioBtn.innerHTML = this.audioAlertsEnabled
          ? `<i class="fa-solid fa-volume-high text-cyan-400"></i> <span class="text-xs">Hazard Sound: ON</span>`
          : `<i class="fa-solid fa-volume-xmark text-slate-500"></i> <span class="text-xs">Hazard Sound: MUTED</span>`;
      });
    }

    this.startSpeedometerSimulation();
  }

  getAudioContext() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  playHazardBeep(severity = 'CRITICAL') {
    if (!this.audioAlertsEnabled) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(severity === 'CRITICAL' ? 880 : 660, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(severity === 'CRITICAL' ? 1200 : 880, ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch (e) {
      // Audio autoplay policy fallback
    }
  }

  startSpeedometerSimulation() {
    const speedEl = document.getElementById('hud-speed-value');
    if (!speedEl) return;

    this.speedInterval = setInterval(() => {
      if (this.isStreaming || this.isSimulating) {
        // Natural speed variation around 35 - 55 mph
        const delta = (Math.random() - 0.48) * 3;
        this.speed = Math.max(20, Math.min(65, Math.round(this.speed + delta)));
        speedEl.textContent = this.speed;
      }
    }, 1200);
  }

  async startWebcam() {
    this.stopStream();
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'environment' },
        audio: false
      });
      this.videoElement.srcObject = this.stream;
      this.videoElement.play();
      this.isStreaming = true;
      this.isSimulating = false;
      this.updateHudState(true, 'Live Dashcam (Webcam Active)');
      this.startRealtimeLoop();
    } catch (err) {
      console.warn('Webcam not accessible, launching simulator fallback:', err);
      window.app.showToast('Webcam not detected. Switching to AI Road Patrol Simulator mode.', 'info');
      this.startSimulation();
    }
  }

  startSimulation() {
    this.stopStream();
    this.isSimulating = true;
    this.isStreaming = false;

    // Use pre-loaded road loop video or animated synthetic road frames
    this.videoElement.srcObject = null;
    this.videoElement.src = "https://assets.mixkit.co/videos/preview/mixkit-driving-on-a-highway-road-42643-large.mp4";
    this.videoElement.loop = true;
    this.videoElement.muted = true;
    this.videoElement.play().catch(e => console.log('Sim video auto-play prevented:', e));

    this.updateHudState(true, 'Road Patrol Simulation Mode');
    this.startRealtimeLoop();
  }

  stopStream() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.videoElement) {
      this.videoElement.pause();
      this.videoElement.srcObject = null;
      this.videoElement.src = '';
    }
    clearInterval(this.detectionInterval);
    this.isStreaming = false;
    this.isSimulating = false;
    this.updateHudState(false, 'Standby');
  }

  updateHudState(active, modeText) {
    const statusText = document.getElementById('hud-mode-badge');
    const startCamBtn = document.getElementById('btn-start-camera');
    const startSimBtn = document.getElementById('btn-simulate-drive');
    const stopBtn = document.getElementById('btn-stop-stream');
    const alertBanner = document.getElementById('hud-alert-banner');

    if (statusText) statusText.textContent = modeText;
    if (startCamBtn) startCamBtn.disabled = active;
    if (startSimBtn) startSimBtn.disabled = active;
    if (stopBtn) stopBtn.disabled = !active;
    if (!active && alertBanner) alertBanner.style.display = 'none';
  }

  startRealtimeLoop() {
    const alertBanner = document.getElementById('hud-alert-banner');
    const alertText = document.getElementById('hud-alert-text');
    const radarBlip = document.getElementById('hud-radar-blip');
    const hazardMeter = document.getElementById('hud-hazard-meter');

    this.detectionInterval = setInterval(async () => {
      if (!this.isStreaming && !this.isSimulating) return;

      // Draw current video frame to hidden canvas
      if (!this.canvasElement || !this.videoElement) return;
      const ctx = this.canvasElement.getContext('2d');
      this.canvasElement.width = 416;
      this.canvasElement.height = 416;

      ctx.drawImage(this.videoElement, 0, 0, 416, 416);

      // Convert to blob and call backend
      this.canvasElement.toBlob(async (blob) => {
        if (!blob) return;

        const formData = new FormData();
        formData.append('file', blob, 'hud_frame.jpg');
        formData.append('confidence', 0.22);

        try {
          const res = await fetch('/api/detect/image', {
            method: 'POST',
            body: formData
          });

          if (!res.ok) return;
          const data = await res.json();

          const m = data.metrics;
          if (m && m.defect_count > 0) {
            // Trigger Visual & Acoustic HUD Proximity Warning!
            if (alertBanner && alertText) {
              alertBanner.style.display = 'block';
              alertText.textContent = `WARNING: ${m.defect_count} POTHOLE(S) DETECTED - ${m.severity} RISK!`;
            }

            if (radarBlip) {
              radarBlip.style.display = 'block';
              radarBlip.style.top = `${35 + Math.random() * 30}%`;
              radarBlip.style.left = `${35 + Math.random() * 30}%`;
            }

            if (hazardMeter) {
              hazardMeter.style.width = `${Math.min(100, m.hazard_index)}%`;
            }

            this.playHazardBeep(m.severity);
          } else {
            if (alertBanner) alertBanner.style.display = 'none';
            if (radarBlip) radarBlip.style.display = 'none';
            if (hazardMeter) hazardMeter.style.width = `12%`;
          }
        } catch (e) {
          // Frame skip on network delay
        }
      }, 'image/jpeg', 0.7);
    }, 1800);
  }
}

window.liveHudController = new LiveHudController();
