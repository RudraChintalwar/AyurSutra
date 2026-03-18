import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './ReportAnalyzer.css';

const ReportAnalyzer = () => {
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  /* ================== File Handlers ================== */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setError(null);
      console.log('File selected:', selectedFile.name);
    } else {
      setError('Please select a valid PDF file');
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && droppedFile.type === 'application/pdf') {
      setFile(droppedFile);
      setError(null);
      console.log('File dropped:', droppedFile.name);
    } else {
      setError('Please drop a valid PDF file');
    }
  };

  /* ================== API Call ================== */
  const handleAnalyze = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!file) {
      setError('Please select a PDF file first');
      return;
    }

    setLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const ML_URL = import.meta.env.VITE_ML_API_URL || 'http://127.0.0.1:8000';
      const response = await fetch(`${ML_URL}/analyze_ayurveda_report/`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      setAnalysis(data);
      
    } catch (err: any) {
      console.error('Error analyzing report:', err);
      if (err.message.includes('Failed to fetch')) {
        setError('Cannot connect to the analysis server. Please make sure the backend server is running.');
      } else if (err.message.includes('NetworkError')) {
        setError('Network error. Please check your internet connection and try again.');
      } else {
        setError(err.message || 'Failed to analyze report. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  /* ================== Reset ================== */
  const resetAnalysis = () => {
    setFile(null);
    setAnalysis(null);
    setError(null);
  };

  /* ================== Download Report ================== */
  const handleDownloadReport = () => {
    if (!analysis) return;
    
    let reportText = `AYURSUTRA - AYURVEDIC ANALYSIS REPORT
=====================================

DOSHA IMBALANCE: ${analysis.dosha_imbalance || 'N/A'}

CONDITION ANALYSIS: ${analysis.condition || 'N/A'}

RECOMMENDATIONS: ${analysis.recommendations || 'N/A'}

HERBAL REMEDIES: ${analysis.herbal_remedies || 'N/A'}

LIFESTYLE CHANGES:
${(analysis.lifestyle_changes || []).map((change: string, idx: number) => `${idx + 1}. ${change}`).join('\n')}

RECOMMENDED PRACTITIONERS:
${(analysis.recommended_practitioners || []).map((p: any, idx: number) => `${idx + 1}. ${p.name} - ${p.specialty} (${p.location})`).join('\n')}

Generated on: ${new Date().toLocaleDateString()}`;

    const blob = new Blob([reportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ayurvedic-analysis-${new Date().getTime()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="report-analyzer-container">
      <div className="ra-background">
        <div className="ra-bg-element ra-bg-1">🌿</div>
        <div className="ra-bg-element ra-bg-2">🍃</div>
        <div className="ra-bg-element ra-bg-3">🌸</div>
        <div className="ra-bg-element ra-bg-4">✨</div>
        <div className="ra-bg-element ra-bg-5">🌱</div>
      </div>

      <div className="ra-header">
        <button className="ra-back-btn" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <div className="ra-title-section">
          <h1 className="ra-main-title">Ayurvedic Report Analyzer</h1>
          <p className="ra-subtitle">
            Upload your medical reports for personalized Ayurvedic insights and recommendations
          </p>
        </div>
        <div className="ra-logo">
          <span className="ra-logo-icon">🌿</span>
          <span className="ra-logo-text">AYURSUTRA</span>
        </div>
      </div>

      <div className="ra-content">
        {!analysis && (
          <div className="ra-upload-section">
            <div className="ra-upload-card">
              <div className="ra-upload-icon">
                <span className="ra-upload-main-icon">📄</span>
                <span className="ra-upload-accent-icon">🌿</span>
              </div>
              <h2 className="ra-upload-title">Upload Medical Report</h2>
              <p className="ra-upload-description">
                Upload your PDF medical report to receive personalized Ayurvedic analysis,
                dosha imbalance insights, and natural remedy recommendations.
              </p>

              <div
                className={`ra-drop-zone ${dragActive ? 'ra-drop-zone-active' : ''} ${file ? 'ra-drop-zone-has-file' : ''}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="ra-drop-content">
                  <span className="ra-drop-icon">📤</span>
                  <h3 className="ra-drop-title">
                    {file ? 'File Selected' : 'Drag & Drop your PDF here'}
                  </h3>
                  <p className="ra-drop-subtitle">
                    {file ? file.name : 'or click to browse files'}
                  </p>
                  {!file && <button type="button" className="ra-browse-btn">Browse Files</button>}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="ra-file-input"
                  style={{ display: 'none' }}
                />
              </div>

              {file && (
                <div className="ra-file-info">
                  <div className="ra-file-details">
                    <span className="ra-file-icon">📄</span>
                    <div className="ra-file-text">
                      <p className="ra-file-name">{file.name}</p>
                      <p className="ra-file-size">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                    </div>
                    <button className="ra-remove-file" onClick={() => setFile(null)}>×</button>
                  </div>
                </div>
              )}

              {error && (
                <div className="ra-error-message">
                  <span className="ra-error-icon">⚠️</span>
                  {error}
                </div>
              )}

              <button
                type="button"
                className="ra-analyze-btn"
                onClick={handleAnalyze}
                disabled={!file || loading}
                style={{
                  pointerEvents: 'auto',
                  cursor: (!file || loading) ? 'not-allowed' : 'pointer',
                  zIndex: 10,
                  position: 'relative'
                }}
              >
                {loading ? (
                  <><span className="ra-loading-spinner"></span> Analyzing Report...</>
                ) : (
                  <><span className="ra-analyze-icon">🔍</span> Analyze Report</>
                )}
              </button>
            </div>
          </div>
        )}

        {analysis && !analysis.error && (
          <div className="ra-results-section">
            <div className="ra-results-card text-left">
              <div className="ra-results-header">
                <div className="ra-results-icon">
                  <span className="ra-results-main-icon">📊</span>
                  <span className="ra-results-accent-icon">🌿</span>
                </div>
                <div className="ra-results-title">
                  <h2>Ayurvedic Analysis Complete</h2>
                  <p>Personalized insights based on your medical report</p>
                </div>
                <button className="ra-new-analysis" onClick={resetAnalysis}>
                  Analyze New Report
                </button>
              </div>

              <div className="ra-analysis-grid">
                <div className="ra-analysis-card">
                  <div className="ra-card-header">
                    <span className="ra-card-icon">⚖️</span>
                    <h3>Dosha Imbalance</h3>
                  </div>
                  <div className="ra-card-content">
                    <p className="ra-dosha-text text-primary font-medium">{analysis.dosha_imbalance}</p>
                  </div>
                </div>

                <div className="ra-analysis-card">
                  <div className="ra-card-header">
                    <span className="ra-card-icon">💊</span>
                    <h3>Condition Analysis</h3>
                  </div>
                  <div className="ra-card-content">
                    <p>{analysis.condition}</p>
                  </div>
                </div>

                <div className="ra-analysis-card">
                  <div className="ra-card-header">
                    <span className="ra-card-icon">💡</span>
                    <h3>Recommendations</h3>
                  </div>
                  <div className="ra-card-content">
                    <p>{analysis.recommendations}</p>
                  </div>
                </div>

                <div className="ra-analysis-card">
                  <div className="ra-card-header">
                    <span className="ra-card-icon">🌱</span>
                    <h3>Herbal Remedies</h3>
                  </div>
                  <div className="ra-card-content">
                    <p>{analysis.herbal_remedies}</p>
                  </div>
                </div>

                <div className="ra-analysis-card">
                  <div className="ra-card-header">
                    <span className="ra-card-icon">🧘</span>
                    <h3>Lifestyle Changes</h3>
                  </div>
                  <div className="ra-card-content">
                    <ul className="ra-lifestyle-list">
                      {analysis.lifestyle_changes?.map((change: string, index: number) => (
                        <li key={index} className="ra-lifestyle-item flex gap-2">
                          <span className="ra-list-icon">🌿</span>
                          {change}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              <div className="ra-results-actions flex gap-4 mt-6">
                <button className="ra-download-btn flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors" onClick={handleDownloadReport}>
                  <span className="ra-download-icon">📥</span>
                  Download Analysis Report
                </button>
                <button className="ra-book-appointment-btn flex items-center justify-center gap-2 bg-ayur-sage text-white px-4 py-2 rounded-md hover:bg-ayur-olive transition-colors" onClick={() => navigate('/patient/sessions')}>
                  <span className="ra-book-icon">📅</span>
                  Book Ayurvedic Consultation
                </button>
              </div>
            </div>
          </div>
        )}

        {analysis?.error && (
          <div className="ra-error-section mt-8 flex justify-center">
            <div className="ra-error-card bg-red-50 text-red-800 p-6 rounded-lg border border-red-200 text-center w-full max-w-md">
              <div className="ra-error-icon text-4xl mb-4">❌</div>
              <h3 className="text-xl font-bold mb-2">Analysis Failed</h3>
              <p className="mb-4">{analysis.error}</p>
              <button className="ra-retry-btn bg-red-600 text-white px-6 py-2 rounded-md font-medium hover:bg-red-700 transition-colors" onClick={resetAnalysis}>
                Try Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportAnalyzer;
