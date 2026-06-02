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
  const [placeholders, setPlaceholders] = useState([
    { key: "Name", color: "#960000" },
    { key: "Year&Department", color: "#960000" },
    { key: "Role", color: "#0046a0" }
  ]);
  const [pos, setPos] = useState({ x: 260, y: 815, width: 1500 });

  // Email States
  const [emailConfig, setEmailConfig] = useState({
    senderEmail: "santharamsenthilkumar17@gmail.com",
    senderPassword: "",
    subject: "Your Digital Certificate - DigiFest 2K26",
    body: "Dear {Name},\n\nCongratulations! Please find your certificate attached.\n\nBest Regards,\nTeam DigiFlash"
  });

  const [status, setStatus] = useState({ loading: false, session_id: null, zip_url: null, step: 'init' });
  const [previewUrl, setPreviewUrl] = useState(null);
  const [showFontList, setShowFontList] = useState(false);
  const [emailStatus, setEmailStatus] = useState({ sending: false, success: null, errors: [] });

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

  useEffect(() => {
    fetch(`${API_URL}/fonts`)
      .then(res => res.json())
      .then(data => setFonts(data.fonts))
      .catch(console.error);
  }, [API_URL]);

  const handlePreview = async () => {
    if (!template) return;
    const formData = new FormData();
    formData.append("template", template);
    formData.append("content", content);
    formData.append("font_name", selectedFont);
    formData.append("font_size", fontSize);
    formData.append("font_color", fontColor);

    const phObj = {};
    placeholders.forEach(p => { if (p.key) phObj[p.key] = p.color; });
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
    placeholders.forEach(p => { if (p.key) phObj[p.key] = p.color; });
    formData.append("placeholders", JSON.stringify(phObj));
    formData.append("x", pos.x);
    formData.append("y", pos.y);
    formData.append("width", pos.width);

    try {
      const res = await fetch(`${API_URL}/generate`, { method: "POST", body: formData });
      const data = await res.json();
      if (data.session_id) {
        setStatus({ loading: false, session_id: data.session_id, zip_url: data.zip_url, step: 'verified' });
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
    if (!emailConfig.senderPassword) {
      alert("Please enter Sender App Password");
      return;
    }
    setEmailStatus({ sending: true, success: null, errors: [] });
    
    const formData = new FormData();
    formData.append("session_id", status.session_id);
    formData.append("sender_email", emailConfig.senderEmail);
    formData.append("sender_password", emailConfig.senderPassword);
    formData.append("subject", emailConfig.subject);
    formData.append("body", emailConfig.body);

    try {
      const res = await fetch(`${API_URL}/send-emails`, { method: "POST", body: formData });
      const data = await res.json();
      setEmailStatus({ sending: false, success: data.success, errors: data.errors });
    } catch (err) {
      setEmailStatus({ sending: false, success: 0, errors: ["Network error"] });
    }
  };

  const filteredFonts = fonts.filter(f => f.toLowerCase().includes(fontSearch.toLowerCase()));

  return (
    <div className="container">
      <header>
        <h1>CertifyPro</h1>
        <p style={{ color: 'var(--text-dim)' }}>Premium Digital Certificate Automation</p>
      </header>

      <div className="grid">
        {/* Left Panel: Configuration */}
        <div className="glass-card">
          <section>
            <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Settings size={18} /> 1. Configuration
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Search size={14} /> {selectedFont}
                  </div>
                </div>
                {showFontList && (
                  <div className="glass-card" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, padding: '10px', marginTop: '5px' }}>
                    <input autoFocus placeholder="Find font..." value={fontSearch} onChange={e => setFontSearch(e.target.value)} style={{ marginBottom: '5px' }} />
                    <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                      {filteredFonts.map(f => (
                        <div key={f} className="btn" style={{ width: '100%', justifyContent: 'flex-start', background: f === selectedFont ? 'var(--primary)' : 'transparent' }} onClick={() => { setSelectedFont(f); setShowFontList(false); }}>
                          {f}
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
              <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input placeholder="Key" value={ph.key} onChange={e => {
                  const n = [...placeholders]; n[idx].key = e.target.value; setPlaceholders(n);
                }} />
                <input className="color-input" type="color" value={ph.color} style={{ width: '40px' }} onChange={e => {
                  const n = [...placeholders]; n[idx].color = e.target.value; setPlaceholders(n);
                }} />
                <button className="btn btn-secondary" onClick={() => setPlaceholders(placeholders.filter((_, i) => i !== idx))}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button className="btn btn-secondary" style={{ width: '100%', fontSize: '0.8rem' }} onClick={() => setPlaceholders([...placeholders, { key: "", color: "#000000" }])}>
              <Plus size={14} /> Add Placeholder
            </button>
          </section>

          <section style={{ marginTop: '2rem', borderTop: '1px solid var(--glass-border)', paddingTop: '1rem' }}>
            <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Mail size={18} /> Email Delivery
            </h3>
            <div className="form-group">
              <label>Google App Password</label>
              <input type="password" placeholder="xxxx xxxx xxxx xxxx" value={emailConfig.senderPassword} onChange={e => setEmailConfig({ ...emailConfig, senderPassword: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Subject</label>
              <input value={emailConfig.subject} onChange={e => setEmailConfig({ ...emailConfig, subject: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Mail Body</label>
              <textarea rows={3} value={emailConfig.body} onChange={e => setEmailConfig({ ...emailConfig, body: e.target.value })} />
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
                      disabled={emailStatus.sending}
                    >
                      {emailStatus.sending ? "Sending..." : "2. Send All Emails"}
                    </button>
                  </div>

                  {emailStatus.success !== null && (
                    <div className="glass-card" style={{ marginTop: '1rem', border: '1px solid var(--success)', background: 'rgba(34, 197, 94, 0.1)' }}>
                      <p style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
                        <CheckCircle2 size={16} /> Sent Successfully: {emailStatus.success}
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
