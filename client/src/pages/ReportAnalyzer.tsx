import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './ReportAnalyzer.css';
import { useLanguage } from '@/contexts/LanguageContext';

const ReportAnalyzer = () => {
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { language } = useLanguage();
  const tx = (en: string, hi: string) => (language === 'hi' ? hi : en);

  /* ================== File Handlers ================== */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setError(null);
      console.log('File selected:', selectedFile.name);
    } else {
      setError(tx('Please select a valid PDF file', 'कृपया वैध PDF फ़ाइल चुनें'));
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
      setError(tx('Please drop a valid PDF file', 'कृपया वैध PDF फ़ाइल ड्रॉप करें'));
    }
  };

  /* ================== API Call ================== */
  const handleAnalyze = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!file) {
      setError(tx('Please select a PDF file first', 'पहले एक PDF फ़ाइल चुनें'));
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
        setError(tx('Cannot connect to the analysis server. Please make sure the backend server is running.', 'विश्लेषण सर्वर से कनेक्ट नहीं हो सका। कृपया बैकएंड सर्वर चालू करें।'));
      } else if (err.message.includes('NetworkError')) {
        setError(tx('Network error. Please check your internet connection and try again.', 'नेटवर्क त्रुटि। कृपया इंटरनेट कनेक्शन जांचकर पुनः प्रयास करें।'));
      } else {
        setError(err.message || tx('Failed to analyze report. Please try again.', 'रिपोर्ट विश्लेषण विफल। कृपया पुनः प्रयास करें।'));
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
          ← {tx('Back', 'वापस')}
        </button>
        <div className="ra-title-section">
          <h1 className="ra-main-title">{tx('Ayurvedic Report Analyzer', 'आयुर्वेदिक रिपोर्ट विश्लेषक')}</h1>
          <p className="ra-subtitle">
            {tx('Upload your medical reports for personalized Ayurvedic insights and recommendations', 'व्यक्तिगत आयुर्वेदिक अंतर्दृष्टि और सुझावों के लिए अपनी रिपोर्ट अपलोड करें')}
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
              <h2 className="ra-upload-title">{tx('Upload Medical Report', 'मेडिकल रिपोर्ट अपलोड करें')}</h2>
              <p className="ra-upload-description">
                {tx('Upload your PDF medical report to receive personalized Ayurvedic analysis, dosha imbalance insights, and natural remedy recommendations.', 'व्यक्तिगत आयुर्वेदिक विश्लेषण, दोष असंतुलन अंतर्दृष्टि और प्राकृतिक उपचार सुझाव पाने के लिए PDF रिपोर्ट अपलोड करें।')}
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
                    {file ? tx('File Selected', 'फ़ाइल चयनित') : tx('Drag & Drop your PDF here', 'अपनी PDF यहां ड्रैग और ड्रॉप करें')}
                  </h3>
                  <p className="ra-drop-subtitle">
                    {file ? file.name : tx('or click to browse files', 'या फ़ाइल चुनने के लिए क्लिक करें')}
                  </p>
                  {!file && <button type="button" className="ra-browse-btn">{tx('Browse Files', 'फ़ाइल ब्राउज़ करें')}</button>}
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
                  <><span className="ra-loading-spinner"></span> {tx('Analyzing Report...', 'रिपोर्ट विश्लेषण हो रहा है...')}</>
                ) : (
                  <><span className="ra-analyze-icon">🔍</span> {tx('Analyze Report', 'रिपोर्ट विश्लेषित करें')}</>
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
                  <h2>{tx('Ayurvedic Analysis Complete', 'आयुर्वेदिक विश्लेषण पूर्ण')}</h2>
                  <p>{tx('Personalized insights based on your medical report', 'आपकी मेडिकल रिपोर्ट पर आधारित व्यक्तिगत अंतर्दृष्टि')}</p>
                </div>
                <button className="ra-new-analysis" onClick={resetAnalysis}>
                  {tx('Analyze New Report', 'नई रिपोर्ट विश्लेषित करें')}
                </button>
              </div>

              <div className="ra-analysis-grid">
                <div className="ra-analysis-card">
                  <div className="ra-card-header">
                    <span className="ra-card-icon">⚖️</span>
                    <h3>{tx('Dosha Imbalance', 'दोष असंतुलन')}</h3>
                  </div>
                  <div className="ra-card-content">
                    <p className="ra-dosha-text text-primary font-medium">{analysis.dosha_imbalance}</p>
                  </div>
                </div>

                <div className="ra-analysis-card">
                  <div className="ra-card-header">
                    <span className="ra-card-icon">💊</span>
                    <h3>{tx('Condition Analysis', 'स्थिति विश्लेषण')}</h3>
                  </div>
                  <div className="ra-card-content">
                    <p>{analysis.condition}</p>
                  </div>
                </div>

                <div className="ra-analysis-card">
                  <div className="ra-card-header">
                    <span className="ra-card-icon">💡</span>
                    <h3>{tx('Recommendations', 'सुझाव')}</h3>
                  </div>
                  <div className="ra-card-content">
                    <p>{analysis.recommendations}</p>
                  </div>
                </div>

                <div className="ra-analysis-card">
                  <div className="ra-card-header">
                    <span className="ra-card-icon">🌱</span>
                    <h3>{tx('Herbal Remedies', 'हर्बल उपचार')}</h3>
                  </div>
                  <div className="ra-card-content">
                    <p>{analysis.herbal_remedies}</p>
                  </div>
                </div>

                <div className="ra-analysis-card">
                  <div className="ra-card-header">
                    <span className="ra-card-icon">🧘</span>
                    <h3>{tx('Lifestyle Changes', 'जीवनशैली परिवर्तन')}</h3>
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
                  {tx('Download Analysis Report', 'विश्लेषण रिपोर्ट डाउनलोड करें')}
                </button>
                <button className="ra-book-appointment-btn flex items-center justify-center gap-2 bg-ayur-sage text-white px-4 py-2 rounded-md hover:bg-ayur-olive transition-colors" onClick={() => navigate('/patient/sessions')}>
                  <span className="ra-book-icon">📅</span>
                  {tx('Book Ayurvedic Consultation', 'आयुर्वेदिक परामर्श बुक करें')}
                </button>
              </div>
            </div>
          </div>
        )}

        {analysis?.error && (
          <div className="ra-error-section mt-8 flex justify-center">
            <div className="ra-error-card bg-red-50 text-red-800 p-6 rounded-lg border border-red-200 text-center w-full max-w-md">
              <div className="ra-error-icon text-4xl mb-4">❌</div>
              <h3 className="text-xl font-bold mb-2">{tx('Analysis Failed', 'विश्लेषण विफल')}</h3>
              <p className="mb-4">{analysis.error}</p>
              <button className="ra-retry-btn bg-red-600 text-white px-6 py-2 rounded-md font-medium hover:bg-red-700 transition-colors" onClick={resetAnalysis}>
                {tx('Try Again', 'पुनः प्रयास करें')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportAnalyzer;
