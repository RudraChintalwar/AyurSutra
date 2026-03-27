"use client";

import React, { useEffect, useRef, useState } from "react";
import "./PulseMonitor.css";

// ─────────────────────────────────────────────
//  SIGNAL PROCESSING UTILITIES
// ─────────────────────────────────────────────

/**
 * In-place Cooley-Tukey FFT.
 * Pads input to the next power of 2 and applies a Hamming window.
 * Returns magnitude spectrum (first half only).
 */
function computeFFT(signal) {
  const n = signal.length;

  // Next power of 2
  let size = 1;
  while (size < n) size <<= 1;

  const real = new Float64Array(size);
  const imag = new Float64Array(size);

  // Copy with Hamming window to reduce spectral leakage
  for (let i = 0; i < n; i++) {
    const w = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (n - 1));
    real[i] = signal[i] * w;
  }

  // Bit-reversal permutation
  for (let i = 1, j = 0; i < size; i++) {
    let bit = size >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [real[i], real[j]] = [real[j], real[i]];
      [imag[i], imag[j]] = [imag[j], imag[i]];
    }
  }

  // Butterfly passes
  for (let len = 2; len <= size; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wR = Math.cos(ang);
    const wI = Math.sin(ang);
    for (let i = 0; i < size; i += len) {
      let cR = 1,
        cI = 0;
      for (let j = 0; j < len / 2; j++) {
        const uR = real[i + j];
        const uI = imag[i + j];
        const vR =
          real[i + j + len / 2] * cR - imag[i + j + len / 2] * cI;
        const vI =
          real[i + j + len / 2] * cI + imag[i + j + len / 2] * cR;
        real[i + j] = uR + vR;
        imag[i + j] = uI + vI;
        real[i + j + len / 2] = uR - vR;
        imag[i + j + len / 2] = uI - vI;
        const nR = cR * wR - cI * wI;
        cI = cR * wI + cI * wR;
        cR = nR;
      }
    }
  }

  // Magnitude spectrum (positive frequencies only)
  const mags = new Float64Array(size / 2);
  for (let i = 0; i < size / 2; i++) {
    mags[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
  }
  return { mags, size };
}

/**
 * Removes linear trend from a signal (better than mean subtraction).
 * Prevents DC drift from biasing the FFT.
 */
function linearDetrend(signal) {
  const n = signal.length;
  const xMean = (n - 1) / 2;
  const yMean = signal.reduce((a, b) => a + b, 0) / n;
  let num = 0,
    den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (signal[i] - yMean);
    den += (i - xMean) ** 2;
  }
  const slope = num / den;
  const intercept = yMean - slope * xMean;
  return signal.map((v, i) => v - (slope * i + intercept));
}

/** Symmetric moving-average (low-pass) filter to suppress shot noise. */
function movingAvg(signal, w) {
  return signal.map((_, i) => {
    const s = Math.max(0, i - Math.floor(w / 2));
    const e = Math.min(signal.length, i + Math.ceil(w / 2));
    const slice = signal.slice(s, e);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

/**
 * Quadratic interpolation around an FFT peak bin.
 * Gives sub-bin frequency accuracy without needing a much longer FFT.
 */
function refinePeakFreq(mags, peakBin, freqRes) {
  if (peakBin <= 0 || peakBin >= mags.length - 1)
    return peakBin * freqRes;
  const alpha = mags[peakBin - 1];
  const beta = mags[peakBin];
  const gamma = mags[peakBin + 1];
  const denom = alpha - 2 * beta + gamma;
  if (Math.abs(denom) < 1e-10) return peakBin * freqRes;
  const offset = 0.5 * (alpha - gamma) / denom;
  return (peakBin + offset) * freqRes;
}

// ─────────────────────────────────────────────
//  COMPONENT
// ─────────────────────────────────────────────

const PulseMonitor = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const graphCanvasRef = useRef(null);
  const rafRef = useRef(null);
  const bpmHistoryRef = useRef([]); // last few readings for temporal smoothing

  const [bpm, setBpm] = useState(0);
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [signalQuality, setSignalQuality] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [liveData, setLiveData] = useState([]);
  const [fingerDetected, setFingerDetected] = useState(false);

  // 15 s gives ~450 samples at 30 fps → good FFT resolution (~0.067 Hz/bin)
  const SAMPLE_MS = 15000;
  const TARGET_FPS = 30;

  // ── Camera init ──────────────────────────────────────────────────────────
  useEffect(() => {
    let stream;
    (async () => {
      const constraints = [
        // Prefer rear camera (has torch)
        { video: { width: 320, height: 240, frameRate: { ideal: TARGET_FPS, max: TARGET_FPS }, facingMode: "environment" } },
        // Fallback: any camera
        { video: { width: 320, height: 240, frameRate: { ideal: TARGET_FPS } } },
      ];
      for (const c of constraints) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(c);
          if (videoRef.current) videoRef.current.srcObject = stream;
          break;
        } catch (_) {}
      }
    })();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // ── Live waveform renderer ────────────────────────────────────────────────
  const drawGraph = (data, peaks = []) => {
    const canvas = graphCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(0, 0, W, H);

    if (data.length < 2) {
      ctx.fillStyle = "#64748b";
      ctx.font = "12px Inter";
      ctx.textAlign = "center";
      ctx.fillText("Waiting for signal…", W / 2, H / 2);
      return;
    }

    // Grid
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 6; i++) {
      const x = (W / 6) * i;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let i = 0; i <= 4; i++) {
      const y = (H / 4) * i;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    const pad = H * 0.1;
    const dH = H - 2 * pad;
    const mn = Math.min(...data);
    const mx = Math.max(...data);
    const rng = Math.max(mx - mn, 1e-6);
    const toY = (v) => pad + dH - ((v - mn) / rng) * dH;
    const step = W / Math.max(data.length - 1, 1);

    // Fill under curve
    ctx.beginPath();
    ctx.moveTo(0, H);
    data.forEach((v, i) => ctx.lineTo(i * step, toY(v)));
    ctx.lineTo((data.length - 1) * step, H);
    ctx.closePath();
    ctx.fillStyle = "rgba(59,130,246,0.12)";
    ctx.fill();

    // Signal line
    const grad = ctx.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, "rgba(96,165,250,0.6)");
    grad.addColorStop(1, "#60a5fa");
    ctx.beginPath();
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    data.forEach((v, i) => {
      i === 0 ? ctx.moveTo(0, toY(v)) : ctx.lineTo(i * step, toY(v));
    });
    ctx.stroke();

    // Peak markers
    peaks.forEach((pi) => {
      if (pi < 0 || pi >= data.length) return;
      const px = pi * step;
      const py = toY(data[pi]);
      const glow = ctx.createRadialGradient(px, py, 0, px, py, 9);
      glow.addColorStop(0, "rgba(239,68,68,0.7)");
      glow.addColorStop(1, "rgba(239,68,68,0)");
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(px, py, 9, 0, 2 * Math.PI); ctx.fill();
      ctx.beginPath(); ctx.arc(px, py, 3, 0, 2 * Math.PI);
      ctx.fillStyle = "#ef4444"; ctx.fill();
      ctx.beginPath(); ctx.arc(px, py, 1.5, 0, 2 * Math.PI);
      ctx.fillStyle = "white"; ctx.fill();
    });
  };

  // ── Main measurement loop ─────────────────────────────────────────────────
  const measurePulse = () => {
    setIsMeasuring(true);
    setShowResults(false);
    setLiveData([]);
    setFingerDetected(false);

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    const rawRed = [];          // signal samples
    const ts = [];              // timestamps (ms)
    let livePeaks = [];         // absolute frame indices of detected peaks
    let lastPeakFrame = -20;    // prevent peak double-counting

    const t0 = performance.now();

    const tick = () => {
      const elapsed = performance.now() - t0;

      if (elapsed >= SAMPLE_MS) {
        finalise(rawRed, ts);
        setIsMeasuring(false);
        setShowResults(true);
        return;
      }

      // Capture frame
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // 50 % centre ROI – wider = more stable average
      const rx = Math.floor(canvas.width * 0.25);
      const ry = Math.floor(canvas.height * 0.25);
      const rw = Math.floor(canvas.width * 0.5);
      const rh = Math.floor(canvas.height * 0.5);
      const pixels = ctx.getImageData(rx, ry, rw, rh).data;
      const count = pixels.length / 4;

      let sumR = 0, sumG = 0, sumB = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        sumR += pixels[i];
        sumG += pixels[i + 1];
        sumB += pixels[i + 2];
      }
      const avgR = sumR / count;
      const avgG = sumG / count;

      // ── Finger detection heuristic ──────────────────────────────────────
      // When a finger covers the lens with torch on, red channel saturates
      // (avgR > 100) and image is nearly monochromatic (R >> G,B)
      const isFingerOn = avgR > 80;
      setFingerDetected(isFingerOn);

      // ── Signal selection ────────────────────────────────────────────────
      // Red channel is optimal for fingertip PPG (torch, red light penetrates
      // tissue best and has maximum absorption contrast with haemoglobin).
      // Fall back to green for face-based rPPG (ambient light scenario).
      const sample = isFingerOn ? avgR : avgG;

      rawRed.push(sample);
      ts.push(performance.now());

      // ── Live display (last 150 samples, detrended + smoothed) ───────────
      const WIN = 150;
      if (rawRed.length > 5) {
        const slice = rawRed.slice(-WIN);
        const proc = movingAvg(linearDetrend(slice), 3);

        // Simple live peak detection (for visualisation only – not used for BPM)
        const n = proc.length;
        if (n > 10) {
          const recent = proc.slice(-20);
          const rm = recent.reduce((a, b) => a + b, 0) / recent.length;
          const rs = Math.sqrt(recent.reduce((s, v) => s + (v - rm) ** 2, 0) / recent.length);
          const thr = rm + rs * 0.6;
          const curr = proc[n - 1];
          const p1 = proc[n - 2];
          const p2 = proc[n - 3];
          if (curr > thr && curr > p1 && p1 >= p2 && rawRed.length - lastPeakFrame > 12) {
            livePeaks.push(rawRed.length - 1);
            lastPeakFrame = rawRed.length;
          }
        }

        // Keep only peaks inside current display window
        const offset = Math.max(0, rawRed.length - WIN);
        livePeaks = livePeaks.filter((p) => p >= offset);
        const relPeaks = livePeaks.map((p) => p - offset);

        setLiveData(proc);
        drawGraph(proc, relPeaks);
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  };

  // ── Final FFT-based BPM calculation ──────────────────────────────────────
  const finalise = (rawSignal, timestamps) => {
    if (rawSignal.length < 150) {
      setBpm(0);
      setSignalQuality("Poor – try again");
      return;
    }

    // Actual capture rate (accounts for dropped frames, browser throttling)
    const durSec =
      (timestamps[timestamps.length - 1] - timestamps[0]) / 1000;
    const fps = rawSignal.length / durSec;

    // 1. Linear detrend  →  removes slow illumination drift
    // 2. Light smoothing →  kills sensor shot-noise above ~8 Hz
    const processed = movingAvg(linearDetrend(rawSignal), 3);

    // 3. FFT
    const { mags, size } = computeFFT(processed);
    const freqRes = fps / size; // Hz per bin

    // 4. Search for dominant frequency in 40–180 BPM (0.67–3.0 Hz)
    const binMin = Math.max(1, Math.floor(0.67 / freqRes));
    const binMax = Math.min(mags.length - 2, Math.ceil(3.0 / freqRes));

    let peakBin = binMin;
    let peakMag = 0;
    for (let i = binMin; i <= binMax; i++) {
      if (mags[i] > peakMag) { peakMag = mags[i]; peakBin = i; }
    }

    // 5. Sub-bin refinement via quadratic interpolation
    const peakHz = refinePeakFreq(mags, peakBin, freqRes);
    let bpmVal = Math.round(peakHz * 60);
    bpmVal = Math.max(40, Math.min(180, bpmVal));

    // 6. Temporal smoothing: average last 3 measurements
    bpmHistoryRef.current = [...bpmHistoryRef.current, bpmVal].slice(-3);
    const finalBpm = Math.round(
      bpmHistoryRef.current.reduce((a, b) => a + b, 0) /
        bpmHistoryRef.current.length
    );
    setBpm(finalBpm);

    // 7. Signal quality via SNR in heart-rate band
    //    SNR = (peak power) / (mean band power)
    const band = Array.from(mags.subarray(binMin, binMax + 1));
    const bandMean = band.reduce((s, v) => s + v * v, 0) / band.length;
    const snr = bandMean > 0 ? (peakMag * peakMag) / bandMean : 0;

    if (snr > 18) setSignalQuality("Excellent");
    else if (snr > 9) setSignalQuality("Good");
    else if (snr > 4) setSignalQuality("Fair");
    else setSignalQuality("Low (Estimated)");
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const getQualityColor = () => {
    const map = { Excellent: "#10b981", Good: "#3b82f6", Fair: "#f59e0b" };
    return map[signalQuality] ?? "#ef4444";
  };

  const getBpmStatus = () => {
    if (bpm > 0 && bpm < 60) return { text: "Athlete Range", color: "#10b981" };
    if (bpm >= 60 && bpm <= 80) return { text: "Optimal", color: "#3b82f6" };
    if (bpm > 80 && bpm <= 100) return { text: "Elevated", color: "#f59e0b" };
    if (bpm > 100) return { text: "High", color: "#ef4444" };
    return { text: "", color: "#94a3b8" };
  };

  const status = getBpmStatus();

  // ── JSX ───────────────────────────────────────────────────────────────────
  return (
    <div className="pulse-container">
      {/* Header */}
      <div className="header">
        <h1 className="title">
          <span className="heart-icon">❤️</span>
          Heart-Sutra
        </h1>
        <p className="subtitle">Real-time Heart Rate Monitor · FFT Signal Analysis</p>
      </div>

      {/* Camera Feed */}
      <div className="webcam-section">
        <div className="webcam-card">
          <div className="webcam-header">
            <div className="webcam-title">
              <span className="camera-icon">📹</span>
              <h3>Camera Feed</h3>
            </div>
            <div className="status-indicators">
              <div className="live-indicator">
                <span className="live-dot"></span>
                <span>LIVE</span>
              </div>
              {isMeasuring && (
                <div className={`finger-indicator ${fingerDetected ? "detected" : "missing"}`}>
                  <span>{fingerDetected ? "👆 Finger OK" : "👆 Place finger"}</span>
                </div>
              )}
            </div>
          </div>
          <div className="webcam-wrapper">
            <video ref={videoRef} autoPlay muted playsInline className="webcam-feed" />
            {/* Hidden canvas for pixel capture */}
            <canvas ref={canvasRef} style={{ display: "none" }} width="160" height="120" />
          </div>
          <div className="webcam-instruction">
            <span className="instruction-icon">👆</span>
            <p>Cover the camera lens with your fingertip &amp; enable torch/flash</p>
          </div>
        </div>
      </div>

      {/* Live Waveform */}
      <div className="graph-section">
        <div className="graph-card">
          <div className="graph-header">
            <div className="graph-title">
              <span className="graph-icon">📈</span>
              <h3>Live PPG Waveform</h3>
            </div>
            {isMeasuring && (
              <div className="recording-badge">
                <span className="recording-dot"></span>
                <span>Recording</span>
              </div>
            )}
          </div>
          <div className="graph-wrapper">
            <canvas
              ref={graphCanvasRef}
              width={600}
              height={200}
              className="live-graph"
              style={{ width: "100%", height: "200px" }}
            />
          </div>
          <div className="graph-footer">
            <div className="graph-stats">
              <span>📊 Red-channel PPG</span>
              <span>🔴 Peak markers</span>
              <span>⚡ {liveData.length} samples</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action */}
      <div className="action-section">
        <button
          className={`measure-btn ${isMeasuring ? "measuring" : ""}`}
          onClick={measurePulse}
          disabled={isMeasuring}
        >
          {isMeasuring ? (
            <>
              <span className="spinner"></span>
              Analyzing Signal…
            </>
          ) : (
            <>
              <span className="btn-icon">🫀</span>
              Start Measurement
            </>
          )}
        </button>
        {isMeasuring && (
          <div className="progress-bar">
            <div className="progress-fill" style={{ animationDuration: `${SAMPLE_MS}ms` }}></div>
            <span>Sampling for {SAMPLE_MS / 1000} seconds (FFT analysis)…</span>
          </div>
        )}
      </div>

      {/* Results */}
      {showResults && bpm > 0 && typeof bpm === "number" && (
        <div className="results-section">
          <div className="bpm-card">
            <div className="bpm-header">
              <span className="bpm-label">Heart Rate</span>
              {signalQuality && (
                <div className="quality-badge" style={{ backgroundColor: getQualityColor() }}>
                  {signalQuality}
                </div>
              )}
            </div>
            <div className="bpm-value-wrapper">
              <span className="bpm-value">{bpm}</span>
              <span className="bpm-unit">BPM</span>
            </div>
            <div className="bpm-status" style={{ color: status.color }}>{status.text}</div>
            <div className="bpm-description">
              {bpm < 60 && "Excellent cardiovascular fitness. Your heart is efficient and strong."}
              {bpm >= 60 && bpm <= 80 && "Your heart rate is within the optimal resting range."}
              {bpm > 80 && bpm <= 100 && "Slightly elevated. Try deep breathing and re-measure."}
              {bpm > 100 && "Elevated rate detected. Rest for 5 minutes then re-measure."}
            </div>
          </div>

          {/* Signal Quality */}
          <div className="signal-card">
            <div className="signal-header">
              <span>📶 Signal Quality</span>
              <div className="signal-bars">
                <div className={`bar ${["Fair","Good","Excellent"].includes(signalQuality) ? "active" : ""}`}></div>
                <div className={`bar ${["Good","Excellent"].includes(signalQuality) ? "active" : ""}`}></div>
                <div className={`bar ${signalQuality === "Excellent" ? "active" : ""}`}></div>
              </div>
            </div>
            <div className="signal-value" style={{ color: getQualityColor() }}>{signalQuality}</div>
            <div className="signal-tip">
              {signalQuality === "Excellent" && "✓ Perfect placement. Reading is highly reliable."}
              {signalQuality === "Good" && "ℹ Solid signal. Minor movement may cause small errors."}
              {signalQuality === "Fair" && "⚠ Moderate signal. Press firmly and stay still."}
              {signalQuality === "Low (Estimated)" && "⚠ Weak signal. Ensure torch is on and finger is steady."}
            </div>
          </div>

          {/* Insights */}
          <div className="insights-card">
            <div className="insights-header"><span>💡 Health Insights</span></div>
            <div className="insights-list">
              <div className="insight-item">
                <span className="insight-icon">❤️</span>
                <span>
                  {bpm >= 60 && bpm <= 80
                    ? "Your heart rate is in the ideal range for adults at rest."
                    : bpm < 60
                    ? "A lower resting heart rate often indicates better cardiovascular fitness."
                    : "Relaxation techniques like box breathing can help lower your resting heart rate."}
                </span>
              </div>
              <div className="insight-item">
                <span className="insight-icon">🔬</span>
                <span>This reading uses FFT frequency analysis of red-channel PPG — the same principle used in clinical pulse oximeters.</span>
              </div>
              <div className="insight-item">
                <span className="insight-icon">🎯</span>
                <span>For best accuracy, measure at the same time daily in a relaxed, seated position.</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tips */}
      <div className="tips-section">
        <div className="tips-header"><span>📋 Tips for Best Results</span></div>
        <div className="tips-grid">
          <div className="tip-card">
            <span className="tip-emoji">🔦</span>
            <p>Enable your phone's torch / flashlight before measuring</p>
          </div>
          <div className="tip-card">
            <span className="tip-emoji">👆</span>
            <p>Cover the lens fully — no gaps around the finger</p>
          </div>
          <div className="tip-card">
            <span className="tip-emoji">🤚</span>
            <p>Rest your elbow on a surface to keep hand perfectly still</p>
          </div>
          <div className="tip-card">
            <span className="tip-emoji">❄️</span>
            <p>Warm your hands first — cold fingers reduce signal strength</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="footer">
        <p>For informational purposes only. Not a medical device.</p>
        <p className="disclaimer">Always consult a healthcare professional for medical advice.</p>
      </div>
    </div>
  );
};

export default PulseMonitor;
