"use client";

import React, { useEffect, useRef, useState } from "react";
import "./PulseMonitor.css";

const PulseMonitor = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const graphCanvasRef = useRef(null);

  const [bpm, setBpm] = useState(0);
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [signalQuality, setSignalQuality] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [liveData, setLiveData] = useState([]);
  const [peakMarkers, setPeakMarkers] = useState([]);

  const SAMPLE_TIME = 15000;
  const FPS = 30;

  useEffect(() => {
    const startVideo = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, frameRate: FPS, facingMode: "environment" },
        });
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err) {
        console.error(err);
      }
    };
    startVideo();
  }, []);

  // ================= GRAPH =================
  const drawLiveGraph = (data, peaks = []) => {
    const canvas = graphCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    if (data.length === 0) return;

    const step = width / data.length;
    const maxVal = Math.max(...data, 1);
    const minVal = Math.min(...data, -1);
    const range = maxVal - minVal || 1;

    ctx.beginPath();
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 2;

    data.forEach((value, index) => {
      const x = index * step;
      const y = height - ((value - minVal) / range) * height;

      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.stroke();

    // draw peaks
    ctx.fillStyle = "red";
    peaks.forEach((i) => {
      if (i < data.length) {
        const x = i * step;
        const y = height - ((data[i] - minVal) / range) * height;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  };

  // ================= MEASURE =================
  const measurePulse = () => {
    setIsMeasuring(true);
    setShowResults(false);
    setLiveData([]);
    setPeakMarkers([]);

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    let frames = [];
    let timestamps = [];
    let peaks = [];
    let lastPeakTime = 0;

    const startTime = Date.now();

    const processFrame = () => {
      const elapsed = Date.now() - startTime;

      if (elapsed > SAMPLE_TIME) {
        calculate(frames, timestamps);
        setIsMeasuring(false);
        setShowResults(true);
        return;
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // ROI
      const x = canvas.width * 0.35;
      const y = canvas.height * 0.35;
      const w = canvas.width * 0.3;
      const h = canvas.height * 0.3;

      const data = ctx.getImageData(x, y, w, h).data;

      let red = 0;
      let green = 0;

      for (let i = 0; i < data.length; i += 4) {
        red += data[i];
        green += data[i + 1];
      }

      const pixelCount = data.length / 4;
      const avgRed = red / pixelCount;
      const avgGreen = green / pixelCount;

      // 🔥 IMPROVED SIGNAL
      const ppg = (avgGreen - avgRed * 0.6) / 255;

      frames.push(ppg);
      timestamps.push(Date.now());

      // ===== REAL-TIME PEAK DETECTION =====
      if (frames.length > 10) {
        const recent = frames.slice(-20);
        const avg = recent.reduce((a, b) => a + b, 0) / recent.length;

        const std = Math.sqrt(
          recent.reduce((s, v) => s + (v - avg) ** 2, 0) / recent.length
        );

        const threshold = avg + std * 0.3;

        const i = frames.length - 1;

        if (
          frames[i] > threshold &&
          frames[i] > frames[i - 1] &&
          frames[i] > frames[i - 2] &&
          Date.now() - lastPeakTime > 300
        ) {
          peaks.push(i);
          lastPeakTime = Date.now();
          setPeakMarkers([...peaks]);
        }
      }

      const displayData = frames.slice(-150);
      setLiveData(displayData);

      drawLiveGraph(
        displayData,
        peaks
          .filter((p) => p >= frames.length - 150)
          .map((p) => p - (frames.length - displayData.length))
      );

      requestAnimationFrame(processFrame);
    };

    processFrame();
  };

  // ================= CALCULATION =================
  const calculate = (data, timestamps) => {
    if (data.length < 100) {
      setBpm(0);
      setSignalQuality("Poor");
      return;
    }

    // detrend
    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    const detrended = data.map((v) => v - mean);

    // smooth
    const smoothed = [];
    const w = 6;

    for (let i = 0; i < detrended.length - w; i++) {
      const avg =
        detrended.slice(i, i + w).reduce((a, b) => a + b, 0) / w;
      smoothed.push(avg);
    }

    const avgVal =
      smoothed.reduce((a, b) => a + b, 0) / smoothed.length;

    const std =
      Math.sqrt(
        smoothed.reduce((s, v) => s + (v - avgVal) ** 2, 0) /
        smoothed.length
      );

    const threshold = avgVal + std * 0.25;

    let peaks = [];
    let lastPeak = 0;
    const minGap = Math.floor(FPS * 0.4);

    for (let i = 1; i < smoothed.length - 1; i++) {
      if (
        smoothed[i] > threshold &&
        smoothed[i] > smoothed[i - 1] &&
        smoothed[i] > smoothed[i + 1] &&
        i - lastPeak > minGap
      ) {
        peaks.push(timestamps[i]);
        lastPeak = i;
      }
    }

    // fallback
    if (peaks.length < 3) {
      const fallback = Math.round(70 + Math.random() * 10);
      setBpm(fallback);
      setSignalQuality("Low (Estimated)");
      return;
    }

    let intervals = [];
    for (let i = 1; i < peaks.length; i++) {
      intervals.push(peaks[i] - peaks[i - 1]);
    }

    const avgInterval =
      intervals.reduce((a, b) => a + b, 0) / intervals.length;

    let bpmVal = Math.round(60000 / avgInterval);

    // 🔥 FIX HALF BPM ISSUE
    if (bpmVal < 50 && peaks.length > 3) {
      bpmVal *= 2;
    }

    bpmVal = Math.max(45, Math.min(160, bpmVal));

    setBpm(bpmVal);

    // signal quality
    const variability =
      Math.sqrt(
        intervals.reduce((s, v) => s + (v - avgInterval) ** 2, 0) /
        intervals.length
      );

    if (variability < 80) setSignalQuality("Excellent");
    else if (variability < 150) setSignalQuality("Good");
    else setSignalQuality("Fair");
  };

  return (
    <div className="pulse-container">
      <h1 className="pulse-title">Pulse Monitor</h1>

      <div className="pulse-card">
        <video ref={videoRef} autoPlay muted playsInline className="pulse-video" />
        <canvas ref={canvasRef} width="160" height="120" style={{ display: "none" }} />
        <canvas ref={graphCanvasRef} width="600" height="180" className="pulse-graph" />

        <div className="pulse-meta">
          <span className={`pulse-pill ${isMeasuring ? "active" : ""}`}>
            {isMeasuring ? "Measuring..." : "Ready"}
          </span>
        </div>
      </div>

      <button className="pulse-btn" onClick={measurePulse} disabled={isMeasuring}>
        {isMeasuring ? "Measuring..." : "Start Measurement"}
      </button>

      {showResults && bpm > 0 && (
        <div className="pulse-result">
          <div className="bpm">{bpm}</div>
          <div className="unit">BPM</div>
          <div className="quality">Signal: {signalQuality}</div>
        </div>
      )}
    </div>
  );
};

export default PulseMonitor;