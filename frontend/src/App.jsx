import React, { useState, useEffect } from 'react';
import { Upload, Download, Send, Plus, Trash2, Settings, Mail, Eye, Search, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

function App() {
  const [template, setTemplate] = useState(null);
  const [excel, setExcel] = useState(null);
  const [content, setContent] = useState("This is to certify that {Prefix} {Name} of {Year&Department} has Participated in the event Idea Wins in DigiFest 2k26, an Intra-College Technical Symposium organized by DIGIFLASH - CSE Department Association held on 24.03.2026");
  const [fontSize, setFontSize] = useState(38);
  const [fontColor, setFontColor] = useState("#000000");
  const [selectedFont, setSelectedFont] = useState("Alice-Regular.ttf");
  const [fonts, setFonts] = useState([]);
  const [fontSearch, setFontSearch] = useState("");
  const [startSerialNumber, setStartSerialNumber] = useState(215);
  const [outputFormat, setOutputFormat] = useState("PDF");
  const [filenamePattern, setFilenamePattern] = useState("{serial}_CSE_{roll}_AWS");
  const [placeholders, setPlaceholders] = useState([
    { key: "Name", color: "#960000", bold: true },
    { key: "Year&Department", color: "#960000", bold: false }
  ]);
  const [pos, setPos] = useState({ x: 260, y: 815, width: 1500 });

  // Email States
  const [emailConfig, setEmailConfig] = useState({
    senderEmail: "",
    senderPassword: "",
    subject: "Your Digital Certificate - DigiFest 2K26",
    body: "Dear {Name},\n\nCongratulations! Please find your certificate attached.\n\nBest Regards,\nTeam DigiFlash"
  });

  const [status, setStatus] = useState({ loading: false, session_id: null, zip_url: null, step: 'init' });
  const [recipients, setRecipients] = useState([]);
  const [selectedIndices, setSelectedIndices] = useState([]);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [showFontList, setShowFontList] = useState(false);
  const [emailStatus, setEmailStatus] = useState({ sending: false, success: null, errors: [], progress: "idle" });

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

  useEffect(() => {
    fetch(`${API_URL}/fonts`)
      .then(res => res.json())
      .then(data => setFonts(data.fonts))
      .catch(console.error);
  }, [API_URL]);

  // Polling for email status
  useEffect(() => {
    let interval;
    if (emailStatus.progress === "sending" && status.session_id) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`${API_URL}/email-status/${status.session_id}`);
          const data = await res.json();
          if (data.status === "completed") {
            setEmailStatus(prev => ({ ...prev, progress: "completed", success: "🎉 All selected certificates have been successfully sent!" }));
            clearInterval(interval);
          } else if (data.status === "failed") {
            setEmailStatus(prev => ({ ...prev, progress: "failed", errors: ["Background process encountered an error."] }));
            clearInterval(interval);
          }
        } catch (err) {
          console.error("Polling error:", err);
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [emailStatus.progress, status.session_id, API_URL]);

  const handlePreview = async () => {
    if (!template) return;
    setIsPreviewLoading(true);
    const formData = new FormData();
    formData.append("template", template);
    formData.append("content", content);
    formData.append("font_name", selectedFont);
    formData.append("font_size", fontSize);
    formData.append("font_color", fontColor);

    const phObj = {};
    placeholders.forEach(p => { if (p.key) phObj[p.key] = { color: p.color, bold: !!p.bold }; });
    formData.append("placeholders", JSON.stringify(phObj));
    formData.append("x", pos.x);
    formData.append("y", pos.y);
    formData.append("width", pos.width);

    try {
      const res = await fetch(`${API_URL}/preview`, {
        method: "POST",
        body: formData,
      });
      const blob = await res.blob();
      setPreviewUrl(URL.createObjectURL(blob));
    } catch (err) {
      console.error(err);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!template || !excel) {
      alert("Template and Excel required!");
      return;
    }

    setStatus({ ...status, loading: true, step: 'generating' });
    const formData = new FormData();
    formData.append("template", template);
    formData.append("excel", excel);
    formData.append("content", content);
    formData.append("font_name", selectedFont);
    formData.append("font_size", fontSize);
    formData.append("font_color", fontColor);

    const phObj = {};
    placeholders.forEach(p => { if (p.key) phObj[p.key] = { color: p.color, bold: !!p.bold }; });
    formData.append("placeholders", JSON.stringify(phObj));
    formData.append("start_serial_number", startSerialNumber);
    formData.append("output_format", outputFormat);
    formData.append("filename_pattern", filenamePattern);
    formData.append("x", pos.x);
    formData.append("y", pos.y);
    formData.append("width", pos.width);

    try {
      const res = await fetch(`${API_URL}/generate`, { method: "POST", body: formData });
      const data = await res.json();
      if (data.session_id) {
        setStatus({ loading: false, session_id: data.session_id, zip_url: data.zip_url, step: 'verified' });
        setRecipients(data.recipients);
        setSelectedIndices(data.recipients.map(r => r.index));
      } else {
        alert("Generation Error: " + data.error);
        setStatus({ ...status, loading: false });
      }
    } catch (err) {
      console.error(err);
      setStatus({ ...status, loading: false });
    }
  };

  const handleSendEmails = async () => {
    // Note: If you leave the password/email fields blank, the backend will 
    // attempt to use environment variables set on the server (e.g., Render Env Vars).
    if (selectedIndices.length === 0) {
      alert("Please select at least one recipient");
      return;
    }
    setEmailStatus({ sending: true, success: null, errors: [], progress: "sending" });

    const formData = new FormData();
    formData.append("session_id", status.session_id);
    formData.append("sender_email", emailConfig.senderEmail);
    formData.append("sender_password", emailConfig.senderPassword);
    formData.append("subject", emailConfig.subject);
    formData.append("body", emailConfig.body);
    formData.append("selected_indices", JSON.stringify(selectedIndices));

    try {
      const res = await fetch(`${API_URL}/send-emails`, { method: "POST", body: formData });
      const data = await res.json();
      if (data.status === "success") {
        setEmailStatus(prev => ({ ...prev, sending: false, success: "Background sending started... Please wait.", errors: [] }));
      } else {
        setEmailStatus({ sending: false, success: null, errors: [data.error || "Failed to start"], progress: "failed" });
      }
    } catch (err) {
      setEmailStatus({ sending: false, success: null, errors: ["Network error"], progress: "failed" });
    }
  };

  const filteredFonts = fonts.filter(f => f.toLowerCase().includes(fontSearch.toLowerCase()));

  // Map backend font filenames to CSS font-family for live preview
  const fontFamilyMap = {
    'Times-New-Roman-Regular.ttf': "'Times New Roman', Times, serif",
    'Times-New-Roman-Bold.ttf':    "'Times New Roman', Times, serif",
    'Times-New-Roman-Italic.ttf':  "'Times New Roman', Times, serif",
    'Times-New-Roman-BoldItalic.ttf': "'Times New Roman', Times, serif",
    'Lora-Regular.ttf': "'Lora', Georgia, serif",
  };

  const getFontLabel = (filename) => filename.replace(/\.ttf$/i, '').replace(/\.otf$/i, '');
  const getFontPreviewStyle = (filename) => {
    const family = fontFamilyMap[filename];
    return family ? { fontFamily: family, fontSize: '1rem' } : {};
  };

  const Loader = ({ message }) => (
    <div className="loading-overlay">
      <div className="loader-container">
        <div className="spinner"></div>
        <p className="loading-text">{message}</p>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginTop: '1rem' }}>Please wait while we craft your perfection...</p>
      </div>
    </div>
  );

  return (
    <div className="container">
      {(status.loading || emailStatus.sending || isPreviewLoading) && (
        <Loader message={
          isPreviewLoading ? "Generating Preview..." :
            status.loading ? "Generating Certificates..." :
              "Initiating Email Delivery..."
        } />
      )}
      <header>
        <h1>CertifyPro</h1>
        <p style={{ color: 'var(--text-dim)' }}>Premium Digital Certificate Automation</p>
      </header>

      <div className="grid">
        {/* Left Panel: Configuration */}
        <div className="glass-card">
          <section>
            <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Settings size={18} /> Configuration
            </h3>
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label>Template (PNG/JPG)</label>
                <div className="file-upload-zone" onClick={() => document.getElementById('t-in').click()}>
                  <Upload size={20} />
                  <p style={{ fontSize: '0.7rem' }}>{template ? template.name : "Select"}</p>
                  <input id="t-in" type="file" hidden onChange={e => setTemplate(e.target.files[0])} />
                </div>
              </div>
              <div className="form-group">
                <label>Dataset (XLSX)</label>
                <div className="file-upload-zone" onClick={() => document.getElementById('e-in').click()}>
                  <Download size={20} />
                  <p style={{ fontSize: '0.7rem' }}>{excel ? excel.name : "Select"}</p>
                  <input id="e-in" type="file" hidden onChange={e => setExcel(e.target.files[0])} />
                </div>
              </div>
            </div>

            <div className="form-group">
              <label>Font Family</label>
              <div style={{ position: 'relative' }}>
                <div className="btn btn-secondary" style={{ width: '100%', justifyContent: 'space-between' }} onClick={() => setShowFontList(!showFontList)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', ...getFontPreviewStyle(selectedFont) }}>
                    <Search size={14} style={{ flexShrink: 0, fontFamily: 'inherit' }} /> {getFontLabel(selectedFont)}
                  </div>
                </div>
                {showFontList && (
                  <div className="glass-card" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, padding: '10px', marginTop: '5px' }}>
                    <input autoFocus placeholder="Find font..." value={fontSearch} onChange={e => setFontSearch(e.target.value)} style={{ marginBottom: '5px' }} />
                    <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                      {filteredFonts.map(f => (
                        <div key={f} className="btn" style={{ width: '100%', justifyContent: 'flex-start', background: f === selectedFont ? 'var(--primary)' : 'transparent', ...getFontPreviewStyle(f) }} onClick={() => { setSelectedFont(f); setShowFontList(false); }}>
                          {getFontLabel(f)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="form-group">
              <label>Body Content (use {'{Prefix}, {Name}'} etc)</label>
              <textarea rows={4} value={content} onChange={e => setContent(e.target.value)} />
            </div>

            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label>Starting Serial Number</label>
                <input type="number" value={startSerialNumber} onChange={e => setStartSerialNumber(parseInt(e.target.value) || 0)} />
              </div>
              <div className="form-group">
                <label>Output Format</label>
                <select value={outputFormat} onChange={e => setOutputFormat(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--glass-border)', background: 'transparent', color: 'inherit', width: '100%' }}>
                  <option value="PDF" style={{ color: '#000' }}>PDF (.pdf)</option>
                  <option value="PNG" style={{ color: '#000' }}>Image (.png)</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Output Filename Pattern</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>extension added automatically</span>
              </label>
              <input
                value={filenamePattern}
                onChange={e => setFilenamePattern(e.target.value)}
                placeholder="e.g. {serial}_CSE_{roll}_AWS"
              />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                {['{serial}', '{name}', '{roll}', '{index}'].map(token => (
                  <button
                    key={token}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.7rem', padding: '3px 10px', borderRadius: '999px', cursor: 'pointer' }}
                    onClick={() => setFilenamePattern(prev => prev + token)}
                  >
                    {token}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label>Size</label>
                <input type="number" value={fontSize} onChange={e => setFontSize(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Color</label>
                <input className="color-input" type="color" value={fontColor} onChange={e => setFontColor(e.target.value)} />
              </div>
            </div>

            <h4 style={{ margin: '1rem 0 0.5rem', fontSize: '0.8rem' }}>Custom Placeholders</h4>
            {placeholders.map((ph, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                <input placeholder="Key" value={ph.key} style={{ flex: 1 }} onChange={e => {
                  const n = [...placeholders]; n[idx].key = e.target.value; setPlaceholders(n);
                }} />
                <input className="color-input" type="color" value={ph.color} style={{ width: '40px', flexShrink: 0 }} onChange={e => {
                  const n = [...placeholders]; n[idx].color = e.target.value; setPlaceholders(n);
                }} />
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', margin: 0, cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!ph.bold} onChange={e => {
                    const n = [...placeholders]; n[idx].bold = e.target.checked; setPlaceholders(n);
                  }} style={{ width: 'auto', height: 'auto', margin: 0 }} />
                  Bold
                </label>
                <button className="btn btn-secondary" onClick={() => setPlaceholders(placeholders.filter((_, i) => i !== idx))}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button className="btn btn-secondary" style={{ width: '100%', fontSize: '0.8rem' }} onClick={() => setPlaceholders([...placeholders, { key: "", color: "#000000", bold: false }])}>
              <Plus size={14} /> Add Placeholder
            </button>
          </section>

          <section style={{ marginTop: '2rem', borderTop: '1px solid var(--glass-border)', paddingTop: '1rem' }}>
            <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Mail size={18} /> Email Delivery
            </h3>

            <div className="form-group-1">
              <label>Subject</label>
              <input value={emailConfig.subject} onChange={e => setEmailConfig({ ...emailConfig, subject: e.target.value })} />
            </div>
            <div className="form-group-2">
              <label>Mail Body</label>
              <textarea rows={6} value={emailConfig.body} onChange={e => setEmailConfig({ ...emailConfig, body: e.target.value })} />
            </div>
          </section>
        </div>

        {/* Right Panel: Preview & Actions */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, minHeight: '350px', background: 'rgba(0,0,0,0.4)', borderRadius: '1rem', border: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
            {previewUrl ? (
              <img src={previewUrl} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '2rem' }}>
                <p>Preview will appear here</p>
                <button className="btn btn-secondary" style={{ marginTop: '1rem' }} onClick={handlePreview}>Try Preview</button>
              </div>
            )}
            <button className="btn btn-secondary" style={{ position: 'absolute', bottom: '10px', right: '10px' }} onClick={handlePreview}>
              <RefreshCw size={14} /> Update
            </button>
          </div>

          <div style={{ marginTop: '1.5rem' }}>
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '1.5rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}><label>X</label><input type="number" value={pos.x} onChange={e => setPos({ ...pos, x: parseInt(e.target.value) })} /></div>
              <div className="form-group" style={{ marginBottom: 0 }}><label>Y</label><input type="number" value={pos.y} onChange={e => setPos({ ...pos, y: parseInt(e.target.value) })} /></div>
              <div className="form-group" style={{ marginBottom: 0 }}><label>Width</label><input type="number" value={pos.width} onChange={e => setPos({ ...pos, width: parseInt(e.target.value) })} /></div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                className={`btn ${status.step === 'verified' ? 'btn-secondary' : 'btn-primary'}`}
                onClick={handleGenerate}
                disabled={status.loading}
              >
                {status.loading ? "Processing..." : status.step === 'verified' ? "Regenerate All" : "1. Generate & Verify All"}
              </button>

              {status.step === 'verified' && (
                <>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <a href={`${API_URL}${status.zip_url}`} className="btn btn-secondary" style={{ flex: 1 }}>
                      <Download size={16} /> Download ZIP
                    </a>
                    <button
                      className="btn btn-primary"
                      style={{ flex: 1, background: '#ec4899', borderColor: '#db2777' }}
                      onClick={handleSendEmails}
                      disabled={emailStatus.sending || emailStatus.progress === "sending"}
                    >
                      {emailStatus.progress === "sending" ? "Processing Batch..." : `2. Send Selected (${selectedIndices.length})`}
                    </button>
                  </div>

                  {recipients.length > 0 && (
                    <div className="glass-card" style={{ marginTop: '1.5rem', padding: '1.5rem', maxHeight: '500px', overflowY: 'auto' }}>
                      <div style={{ marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--glass-border)' }}>
                        <h4 style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>Smart Selection</h4>
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <input
                            placeholder="Enter range (e.g. 1-10, 15, 20-25)"
                            style={{ flex: 1, fontSize: '0.8rem' }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const val = e.target.value;
                                const indices = [];
                                val.split(',').forEach(part => {
                                  if (part.includes('-')) {
                                    const [s, e] = part.split('-').map(n => parseInt(n.trim()) - 1);
                                    for (let i = s; i <= e; i++) if (i >= 0 && i < recipients.length) indices.push(i);
                                  } else {
                                    const n = parseInt(part.trim()) - 1;
                                    if (n >= 0 && n < recipients.length) indices.push(n);
                                  }
                                });
                                setSelectedIndices([...new Set(indices)]);
                              }
                            }}
                          />
                          <button className="btn btn-secondary" style={{ fontSize: '0.8rem' }} onClick={(e) => {
                            const val = e.target.previousSibling.value;
                            const indices = [];
                            val.split(',').forEach(part => {
                              if (part.includes('-')) {
                                const [s, e] = part.split('-').map(n => parseInt(n.trim()) - 1);
                                for (let i = s; i <= e; i++) if (i >= 0 && i < recipients.length) indices.push(i);
                              } else {
                                const n = parseInt(part.trim()) - 1;
                                if (n >= 0 && n < recipients.length) indices.push(n);
                              }
                            });
                            setSelectedIndices([...new Set(indices)]);
                          }}>Apply Range</button>
                        </div>
                        <p style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '5px' }}>Tip: Use 1-based indexing as shown in the table.</p>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h4 style={{ fontSize: '0.9rem' }}>Recipient Selection ({selectedIndices.length}/{recipients.length})</h4>
                        <button className="btn btn-secondary" style={{ fontSize: '0.7rem', padding: '4px 8px' }} onClick={() => {
                          if (selectedIndices.length === recipients.length) setSelectedIndices([]);
                          else setSelectedIndices(recipients.map(r => r.index));
                        }}>
                          {selectedIndices.length === recipients.length ? "Deselect All" : "Select All"}
                        </button>
                      </div>
                      <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--glass-border)' }}>
                            <th style={{ padding: '8px' }}>#</th>
                            <th style={{ padding: '8px' }}>Send?</th>
                            <th style={{ padding: '8px' }}>Name</th>
                            <th style={{ padding: '8px' }}>Email</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recipients.map((r, idx) => (
                            <tr key={r.index} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                              <td style={{ padding: '8px', color: 'var(--text-dim)' }}>{idx + 1}</td>
                              <td style={{ padding: '8px' }}>
                                <input type="checkbox" checked={selectedIndices.includes(r.index)} onChange={() => {
                                  if (selectedIndices.includes(r.index)) setSelectedIndices(selectedIndices.filter(i => i !== r.index));
                                  else setSelectedIndices([...selectedIndices, r.index]);
                                }} style={{ width: '16px', height: '16px' }} />
                              </td>
                              <td style={{ padding: '8px' }}>{r.name}</td>
                              <td style={{ padding: '8px', color: 'var(--text-dim)' }}>{r.email}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {emailStatus.success !== null && (
                    <div className="glass-card" style={{ marginTop: '1rem', border: '1px solid var(--success)', background: 'rgba(34, 197, 94, 0.1)' }}>
                      <p style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
                        <CheckCircle2 size={16} /> {emailStatus.success}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
