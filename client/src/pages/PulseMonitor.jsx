import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import "./PulseMonitor.css";

function computeFFT(signal) {
  const n = signal.length;
  let size = 1;
  while (size < n) size <<= 1;

  const real = new Float64Array(size);
  const imag = new Float64Array(size);
  for (let i = 0; i < n; i++) {
    const w = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / Math.max(n - 1, 1));
    real[i] = signal[i] * w;
  }

  for (let i = 1, j = 0; i < size; i++) {
    let bit = size >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [real[i], real[j]] = [real[j], real[i]];
      [imag[i], imag[j]] = [imag[j], imag[i]];
    }
  }

  for (let len = 2; len <= size; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < size; i += len) {
      let cr = 1;
      let ci = 0;
      for (let j = 0; j < len / 2; j++) {
        const ur = real[i + j];
        const ui = imag[i + j];
        const vr = real[i + j + len / 2] * cr - imag[i + j + len / 2] * ci;
        const vi = real[i + j + len / 2] * ci + imag[i + j + len / 2] * cr;
        real[i + j] = ur + vr;
        imag[i + j] = ui + vi;
        real[i + j + len / 2] = ur - vr;
        imag[i + j + len / 2] = ui - vi;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }

  const mags = new Float64Array(size / 2);
  for (let i = 0; i < size / 2; i++) mags[i] = Math.hypot(real[i], imag[i]);
  return { mags, size };
}

function linearDetrend(signal) {
  const n = signal.length;
  const xm = (n - 1) / 2;
  const ym = signal.reduce((a, b) => a + b, 0) / Math.max(n, 1);
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xm) * (signal[i] - ym);
    den += (i - xm) ** 2;
  }
  const slope = den ? num / den : 0;
  const intercept = ym - slope * xm;
  return signal.map((v, i) => v - (slope * i + intercept));
}

function movingAvg(signal, w) {
  const hw = Math.floor(w / 2);
  return signal.map((_, i) => {
    const s = Math.max(0, i - hw);
    const e = Math.min(signal.length, i + hw + 1);
    const slice = signal.slice(s, e);
    return slice.reduce((a, b) => a + b, 0) / Math.max(slice.length, 1);
  });
}

function refinePeakFreq(mags, peakBin, freqRes) {
  if (peakBin <= 0 || peakBin >= mags.length - 1) return peakBin * freqRes;
  const a = mags[peakBin - 1];
  const b = mags[peakBin];
  const c = mags[peakBin + 1];
  const d = a - 2 * b + c;
  if (Math.abs(d) < 1e-10) return peakBin * freqRes;
  const o = 0.5 * (a - c) / d;
  return (peakBin + o) * freqRes;
}

export default function PulseMonitor() {
  const { user, updateUserProfile } = useAuth();
  const { t } = useLanguage();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const graphCanvasRef = useRef(null);
  const rafRef = useRef(null);
  const bpmHistoryRef = useRef([]);
  const rawRef = useRef([]);
  const tsRef = useRef([]);
  const startTsRef = useRef(0);

  const [bpm, setBpm] = useState(0);
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [signalQuality, setSignalQuality] = useState("");
  const [fingerDetected, setFingerDetected] = useState(false);
  const [error, setError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

  const SAMPLE_MS = 15000;
  const TARGET_FPS = 30;

  useEffect(() => {
    let stream;
    (async () => {
      try {
        if (!navigator?.mediaDevices?.getUserMedia) {
          setError("Camera API is not available in this browser.");
          return;
        }
        const constraints = [
          { video: { width: 320, height: 240, frameRate: { ideal: TARGET_FPS }, facingMode: "environment" } },
          { video: { width: 320, height: 240, frameRate: { ideal: TARGET_FPS } } },
        ];
        for (const c of constraints) {
          try {
            stream = await navigator.mediaDevices.getUserMedia(c);
            if (videoRef.current) videoRef.current.srcObject = stream;
            break;
          } catch (_) {}
        }
        if (!stream) setError("Unable to access camera. Please allow camera permission.");
      } catch (e) {
        setError("Unable to initialize camera.");
      }
    })();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      stream?.getTracks?.().forEach((t) => t.stop());
    };
  }, []);

  const drawGraph = (data) => {
    const canvas = graphCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "rgba(15,23,42,0.15)";
    ctx.fillRect(0, 0, W, H);
    if (data.length < 2) return;

    const mn = Math.min(...data);
    const mx = Math.max(...data);
    const rng = Math.max(mx - mn, 1e-6);
    const step = W / Math.max(data.length - 1, 1);
    const toY = (v) => H - ((v - mn) / rng) * H;

    ctx.beginPath();
    ctx.strokeStyle = "#0ea5e9";
    ctx.lineWidth = 2;
    data.forEach((v, i) => (i === 0 ? ctx.moveTo(0, toY(v)) : ctx.lineTo(i * step, toY(v))));
    ctx.stroke();
  };

  const finalise = (rawSignal, timestamps) => {
    if (rawSignal.length < 120) {
      setBpm(0);
      setSignalQuality("Low");
      return;
    }
    const durSec = (timestamps[timestamps.length - 1] - timestamps[0]) / 1000;
    const fps = rawSignal.length / Math.max(durSec, 1);
    const processed = movingAvg(linearDetrend(rawSignal), 3);
    const { mags, size } = computeFFT(processed);
    const freqRes = fps / size;
    const binMin = Math.max(1, Math.floor(0.67 / freqRes));
    const binMax = Math.min(mags.length - 2, Math.ceil(3.0 / freqRes));
    let peakBin = binMin;
    let peakMag = 0;
    for (let i = binMin; i <= binMax; i++) {
      if (mags[i] > peakMag) {
        peakMag = mags[i];
        peakBin = i;
      }
    }
    const peakHz = refinePeakFreq(mags, peakBin, freqRes);
    const bpmVal = Math.max(40, Math.min(180, Math.round(peakHz * 60)));
    bpmHistoryRef.current = [...bpmHistoryRef.current, bpmVal].slice(-3);
    const smoothed = Math.round(bpmHistoryRef.current.reduce((a, b) => a + b, 0) / bpmHistoryRef.current.length);
    setBpm(smoothed);
    if (peakMag > 4500) setSignalQuality("Excellent");
    else if (peakMag > 2500) setSignalQuality("Good");
    else if (peakMag > 1200) setSignalQuality("Fair");
    else setSignalQuality("Low");

    // Persist a short history in user profile for dashboard trends.
    if (user?.uid && typeof updateUserProfile === "function") {
      const nowIso = new Date().toISOString();
      const prev = Array.isArray(user?.bpm_history) ? user.bpm_history : [];
      const next = [
        ...prev,
        {
          bpm: smoothed,
          quality: peakMag > 4500 ? "Excellent" : peakMag > 2500 ? "Good" : peakMag > 1200 ? "Fair" : "Low",
          measured_at: nowIso,
        },
      ].slice(-20);
      updateUserProfile({ bpm_history: next }).then(
        () => setSaveMessage(t("pulse.saved")),
        () => setSaveMessage(t("pulse.saveFailed"))
      );
    }
  };

  const stopMeasurement = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setIsMeasuring(false);
    const raw = rawRef.current || [];
    const ts = tsRef.current || [];
    if (raw.length >= 120) {
      finalise(raw, ts);
      setShowResults(true);
    }
  };

  const startMeasurement = () => {
    if (!videoRef.current || !canvasRef.current) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setIsMeasuring(true);
    setShowResults(false);
    setBpm(0);
    setSaveMessage("");

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const raw = [];
    const ts = [];
    rawRef.current = raw;
    tsRef.current = ts;
    const t0 = performance.now();
    startTsRef.current = t0;

    const tick = () => {
      const elapsed = performance.now() - t0;
      if (elapsed >= SAMPLE_MS) {
        finalise(raw, ts);
        setIsMeasuring(false);
        setShowResults(true);
        return;
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const rx = Math.floor(canvas.width * 0.25);
      const ry = Math.floor(canvas.height * 0.25);
      const rw = Math.floor(canvas.width * 0.5);
      const rh = Math.floor(canvas.height * 0.5);
      const pixels = ctx.getImageData(rx, ry, rw, rh).data;
      let sumR = 0;
      let sumG = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        sumR += pixels[i];
        sumG += pixels[i + 1];
      }
      const count = pixels.length / 4;
      const avgR = sumR / Math.max(count, 1);
      const avgG = sumG / Math.max(count, 1);
      const finger = avgR > 80;
      setFingerDetected(finger);
      raw.push(finger ? avgR : avgG);
      ts.push(performance.now());
      drawGraph(movingAvg(linearDetrend(raw.slice(-150)), 3));
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  };

  const progressPct = isMeasuring
    ? Math.min(100, Math.round(((performance.now() - startTsRef.current) / SAMPLE_MS) * 100))
    : 0;

  return (
    <div className="pulse-container">
      <h1 className="pulse-title">{t("pulse.title")}</h1>
      <p className="pulse-subtitle">{t("pulse.subtitle")}</p>

      <div className="pulse-card">
        <video ref={videoRef} autoPlay muted playsInline className="pulse-video" />
        <canvas ref={canvasRef} width="160" height="120" style={{ display: "none" }} />
        <canvas ref={graphCanvasRef} width="600" height="180" className="pulse-graph" />
        <div className="pulse-meta">
          <span className={`pulse-pill ${isMeasuring ? "active" : ""}`}>{isMeasuring ? t("pulse.measuring") : t("pulse.ready")}</span>
          <span className={`pulse-pill ${fingerDetected ? "ok" : "warn"}`}>{fingerDetected ? t("pulse.fingerDetected") : t("pulse.placeFinger")}</span>
        </div>
        {error ? <p className="pulse-error">{error}</p> : null}
      </div>

      <button className="pulse-btn" onClick={isMeasuring ? stopMeasurement : startMeasurement} disabled={!!error}>
        {isMeasuring ? t("pulse.stop") : t("pulse.start")}
      </button>
      {isMeasuring ? (
        <div className="pulse-meta" style={{ marginTop: "0.5rem" }}>
          <span className="pulse-pill active">{t("pulse.complete", { pct: progressPct })}</span>
        </div>
      ) : null}

      {showResults && bpm > 0 ? (
        <div className="pulse-result">
          <div className="bpm">{bpm}</div>
          <div className="unit">BPM</div>
          <div className="quality">{t("pulse.signalQuality")}: {signalQuality}</div>
          {saveMessage ? <div className="quality">{saveMessage}</div> : null}
        </div>
      ) : null}
    </div>
  );
}

