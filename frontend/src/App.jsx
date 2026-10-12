import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  Download,
  Send,
  Plus,
  Trash2,
  Settings,
  Mail,
  Search,
  CheckCircle2,
  RefreshCw,
  Superscript,
  Subscript,
  Sparkles,
  HelpCircle,
  FileText
} from 'lucide-react';

function App() {
  const [template, setTemplate] = useState(null);
  const [excel, setExcel] = useState(null);
  const [content, setContent] = useState(
    "This is to certify that {Prefix} {Name} of {Year&Department} has Participated in the event Idea Wins in DigiFest 2k26, an Intra-College Technical Symposium organized by DIGIFLASH - CSE Department Association held on 24<sup>th</sup> March 2026"
  );
  const [fontSize, setFontSize] = useState(38);
  const [fontColor, setFontColor] = useState("#000000");
  const [selectedFont, setSelectedFont] = useState("Alice-Regular.ttf");
  const [fonts, setFonts] = useState([]);
  const [fontSearch, setFontSearch] = useState("");
  const [startSerialNumber, setStartSerialNumber] = useState(215);
  const [outputFormat, setOutputFormat] = useState("PDF");
  const [filenamePattern, setFilenamePattern] = useState("{serial}_CSE_{roll}_AWS");
  const [rangeInput, setRangeInput] = useState("");
  const [ordinalNotice, setOrdinalNotice] = useState(null);

  const [placeholders, setPlaceholders] = useState([
    { key: "Name", color: "#960000", bold: true },
    { key: "Year&Department", color: "#960000", bold: false },
    { key: "Role", color: "#0046a0", bold: false }
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
  const [recipients, setRecipients] = useState([]);
  const [selectedIndices, setSelectedIndices] = useState([]);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [showFontList, setShowFontList] = useState(false);
  const [emailStatus, setEmailStatus] = useState({ sending: false, success: null, errors: [] });

  const textareaRef = useRef(null);
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

  useEffect(() => {
    fetch(`${API_URL}/fonts`)
      .then(res => res.json())
      .then(data => setFonts(data.fonts || []))
      .catch(console.error);
  }, [API_URL]);

  // --- Subscript & Superscript Formatting Handlers ---
  const handleWrapTag = (tag) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);

    let replacement = "";
    let newCursorStart = start;
    let newCursorEnd = end;

    if (selectedText.length > 0) {
      replacement = `<${tag}>${selectedText}</${tag}>`;
      newCursorStart = start;
      newCursorEnd = start + replacement.length;
    } else {
      replacement = `<${tag}>text</${tag}>`;
      newCursorStart = start + `<${tag}>`.length;
      newCursorEnd = newCursorStart + 4; // Select "text"
    }

    const updated = content.substring(0, start) + replacement + content.substring(end);
    setContent(updated);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorStart, newCursorEnd);
    }, 10);
  };

  const handleFormatOrdinals = () => {
    const textarea = textareaRef.current;
    // Match ordinals not already wrapped in <sup> or <sub tags
    const regex = /\b(\d+)(st|nd|rd|th)\b(?![^<]*>)/gi;
    let matchCount = 0;
    const updated = content.replace(regex, (match, num, suffix) => {
      matchCount++;
      return `${num}<sup>${suffix}</sup>`;
    });

    if (matchCount > 0) {
      setContent(updated);
      setOrdinalNotice(`✨ Formatted ${matchCount} ordinal(s) into superscript!`);
    } else {
      setOrdinalNotice("ℹ️ No unformatted ordinals (e.g. 1st, 2nd, 3rd, 24th) found.");
    }

    setTimeout(() => setOrdinalNotice(null), 3500);
    if (textarea) textarea.focus();
  };

  const handleInsertPreset = (snippet) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setContent(prev => prev + snippet);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const updated = content.substring(0, start) + snippet + content.substring(end);
    setContent(updated);

    setTimeout(() => {
      textarea.focus();
      const pos = start + snippet.length;
      textarea.setSelectionRange(pos, pos);
    }, 10);
  };

  // Convert content for Live Preview: handles <sup>, <sub>, ^sup^, ~sub~, and {Placeholders}
  const renderLiveFormattedPreview = (rawText) => {
    if (!rawText) return <span style={{ color: "var(--text-dim)" }}>(Empty content)</span>;

    // First normalize markdown ^sup^ and ~sub~
    let html = rawText
      .replace(/\^([^^]+)\^/g, '<sup>$1</sup>')
      .replace(/~([^~]+)~/g, '<sub>$1</sub>');

    // Split by tags and placeholders: <sup>, <sub>, {Key}
    const parts = html.split(/(<\/?sup>|<\/?sub>|\{[^{}]+\})/gi);
    let isSup = false;
    let isSub = false;

    return parts.map((part, index) => {
      const lower = part.toLowerCase();
      if (lower === '<sup>') {
        isSup = true;
        return null;
      }
      if (lower === '</sup>') {
        isSup = false;
        return null;
      }
      if (lower === '<sub>') {
        isSub = true;
        return null;
      }
      if (lower === '</sub>') {
        isSub = false;
        return null;
      }

      // Check if it is a placeholder like {Name}
      if (part.startsWith('{') && part.endsWith('}')) {
        const key = part.slice(1, -1);
        const ph = placeholders.find(p => p.key === key);
        const style = {
          color: ph ? ph.color : '#ec4899',
          fontWeight: ph?.bold ? '700' : '600',
          backgroundColor: 'rgba(255, 255, 255, 0.08)',
          padding: '1px 5px',
          borderRadius: '4px',
          margin: '0 1px'
        };
        const el = <span key={index} style={style}>{part}</span>;
        if (isSup) return <sup key={index}>{el}</sup>;
        if (isSub) return <sub key={index}>{el}</sub>;
        return el;
      }

      if (isSup) {
        return <sup key={index}>{part}</sup>;
      }
      if (isSub) {
        return <sub key={index}>{part}</sub>;
      }
      return <span key={index}>{part}</span>;
    });
  };

  // --- API Handlers ---
  const handlePreview = async () => {
    if (!template) {
      alert("Please upload a Certificate Template first to generate preview!");
      return;
    }
    setIsPreviewLoading(true);
    const formData = new FormData();
    formData.append("template", template);
    formData.append("content", content);
    formData.append("font_name", selectedFont);
    formData.append("font_size", fontSize);
    formData.append("font_color", fontColor);

    const phObj = {};
    placeholders.forEach(p => {
      if (p.key) phObj[p.key] = { color: p.color, bold: !!p.bold };
    });
    formData.append("placeholders", JSON.stringify(phObj));
    formData.append("x", pos.x);
    formData.append("y", pos.y);
    formData.append("width", pos.width);

    try {
      const res = await fetch(`${API_URL}/preview`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const blob = await res.blob();
        setPreviewUrl(URL.createObjectURL(blob));
      } else {
        alert("Failed to render preview. Check backend logs.");
      }
    } catch (err) {
      console.error(err);
      alert("Network error while generating preview.");
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!template || !excel) {
      alert("Both Certificate Template and Excel Dataset are required!");
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
    placeholders.forEach(p => {
      if (p.key) phObj[p.key] = { color: p.color, bold: !!p.bold };
    });
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
        const recList = data.recipients || [];
        setRecipients(recList);
        setSelectedIndices(recList.map(r => r.index));
      } else {
        alert("Generation Error: " + (data.error || "Unknown"));
        setStatus({ ...status, loading: false });
      }
    } catch (err) {
      console.error(err);
      alert("Network error during certificate generation.");
      setStatus({ ...status, loading: false });
    }
  };

  const handleApplyRange = () => {
    if (!rangeInput.trim()) return;
    const selected = [];
    rangeInput.split(",").forEach(part => {
      if (part.includes("-")) {
        const [start, end] = part.split("-").map(n => parseInt(n.trim()) - 1);
        for (let i = start; i <= end; i++) {
          if (i >= 0 && i < recipients.length) selected.push(i);
        }
      } else {
        const single = parseInt(part.trim()) - 1;
        if (single >= 0 && single < recipients.length) selected.push(single);
      }
    });
    setSelectedIndices([...new Set(selected)]);
  };

  const handleSendEmails = async () => {
    if (selectedIndices.length === 0) {
      alert("Please select at least one recipient to send certificates to.");
      return;
    }
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
    formData.append("selected_indices", JSON.stringify(selectedIndices));

    try {
      const res = await fetch(`${API_URL}/send-emails`, { method: "POST", body: formData });
      const data = await res.json();
      setEmailStatus({
        sending: false,
        success: data.success !== undefined ? data.success : "Completed",
        errors: data.errors || []
      });
    } catch (err) {
      setEmailStatus({ sending: false, success: 0, errors: ["Network error"] });
    }
  };

  const filteredFonts = fonts.filter(f => f.toLowerCase().includes(fontSearch.toLowerCase()));

  return (
    <div className="container">
      <header>
        <h1>CertifyPro</h1>
        <p style={{ color: 'var(--text-dim)', fontSize: '1.05rem', marginTop: '0.25rem' }}>
          Premium Digital Certificate Automation with Advanced Typography
        </p>
      </header>

      <div className="grid">
        {/* Left Panel: Configuration */}
        <div className="glass-card">
          <section>
            <h3 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Settings size={18} /> 1. Configuration & Content
            </h3>

            {/* Template & Excel upload */}
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Template (PNG/JPG)</label>
                <div className="file-upload-zone" onClick={() => document.getElementById('t-in').click()}>
                  <Upload size={20} />
                  <p style={{ fontSize: '0.75rem', marginTop: '4px', wordBreak: 'break-all' }}>
                    {template ? template.name : "Select Template"}
                  </p>
                  <input id="t-in" type="file" accept="image/*" hidden onChange={e => setTemplate(e.target.files[0])} />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Dataset (XLSX)</label>
                <div className="file-upload-zone" onClick={() => document.getElementById('e-in').click()}>
                  <Download size={20} />
                  <p style={{ fontSize: '0.75rem', marginTop: '4px', wordBreak: 'break-all' }}>
                    {excel ? excel.name : "Select Excel"}
                  </p>
                  <input id="e-in" type="file" accept=".xlsx,.xls" hidden onChange={e => setExcel(e.target.files[0])} />
                </div>
              </div>
            </div>

            {/* Font Selector */}
            <div className="form-group">
              <label>Font Family</label>
              <div style={{ position: 'relative' }}>
                <div
                  className="btn btn-secondary"
                  style={{ width: '100%', justifyContent: 'space-between' }}
                  onClick={() => setShowFontList(!showFontList)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Search size={14} /> {selectedFont}
                  </div>
                </div>
                {showFontList && (
                  <div className="glass-card" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, padding: '10px', marginTop: '5px' }}>
                    <input
                      autoFocus
                      placeholder="Find font..."
                      value={fontSearch}
                      onChange={e => setFontSearch(e.target.value)}
                      style={{ marginBottom: '5px' }}
                    />
                    <div style={{ maxHeight: '160px', overflowY: 'auto' }}>
                      {filteredFonts.map(f => (
                        <div
                          key={f}
                          className="btn"
                          style={{
                            width: '100%',
                            justifyContent: 'flex-start',
                            background: f === selectedFont ? 'var(--primary)' : 'transparent',
                            padding: '6px 12px',
                            fontSize: '0.85rem'
                          }}
                          onClick={() => { setSelectedFont(f); setShowFontList(false); }}
                        >
                          {f}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Body Content with Subscript & Superscript Toolbar */}
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <label style={{ margin: 0 }}>Body Content (use {'{Prefix}, {Name}'} etc)</label>
              </div>

              {/* Subscript / Superscript Action Toolbar */}
              <div className="sub-sup-toolbar">
                <button
                  type="button"
                  className="sub-sup-btn"
                  title="Wrap selected text or insert superscript tag (e.g. 1st, 2nd, 24th, x²)"
                  onClick={() => handleWrapTag('sup')}
                >
                  <Superscript size={14} style={{ color: '#c084fc' }} />
                  <span>Superscript</span>
                </button>

                <button
                  type="button"
                  className="sub-sup-btn"
                  title="Wrap selected text or insert subscript tag (e.g. H₂O, CO₂)"
                  onClick={() => handleWrapTag('sub')}
                >
                  <Subscript size={14} style={{ color: '#38bdf8' }} />
                  <span>Subscript</span>
                </button>

                <button
                  type="button"
                  className="sub-sup-btn"
                  style={{ background: 'rgba(99, 102, 241, 0.18)', borderColor: 'rgba(99, 102, 241, 0.45)' }}
                  title="Auto-detect & convert all ordinals like 1st, 2nd, 3rd, 24th to superscript"
                  onClick={handleFormatOrdinals}
                >
                  <Sparkles size={14} style={{ color: '#fbbf24' }} />
                  <span>Auto Ordinals (1<sup>st</sup>, 24<sup>th</sup>)</span>
                </button>

                {/* Quick preset chips */}
                <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginLeft: 'auto' }}>Quick Insert:</span>
                <span className="sub-sup-chip" onClick={() => handleInsertPreset('<sup>st</sup>')}><sup>st</sup></span>
                <span className="sub-sup-chip" onClick={() => handleInsertPreset('<sup>nd</sup>')}><sup>nd</sup></span>
                <span className="sub-sup-chip" onClick={() => handleInsertPreset('<sup>rd</sup>')}><sup>rd</sup></span>
                <span className="sub-sup-chip" onClick={() => handleInsertPreset('<sup>th</sup>')}><sup>th</sup></span>
                <span className="sub-sup-chip" onClick={() => handleInsertPreset('<sub>2</sub>')}><sub>2</sub></span>
                <span className="sub-sup-chip" onClick={() => handleInsertPreset('^2^')}>^x^</span>
              </div>

              {ordinalNotice && (
                <div style={{ fontSize: '0.75rem', color: '#fbbf24', marginBottom: '0.4rem', fontWeight: 500 }}>
                  {ordinalNotice}
                </div>
              )}

              <textarea
                ref={textareaRef}
                rows={4}
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="Enter certificate content with placeholders..."
              />

              {/* Real-time WYSIWYG Formatted Preview */}
              <div className="live-preview-box">
                <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-dim)', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
                  Live Typography Preview:
                </div>
                <div>{renderLiveFormattedPreview(content)}</div>
              </div>

              {/* Informative Tip Box */}
              <div className="tip-banner">
                <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '3px' }}>
                  <HelpCircle size={13} />
                  <span>Superscript & Subscript Guide:</span>
                </div>
                <div>
                  • <strong>Superscript</strong>: Use <code>&lt;sup&gt;text&lt;/sup&gt;</code>, markdown <code>^text^</code>, or Unicode <code>1ˢᵗ, 2ⁿᵈ, E=mc²</code>.<br />
                  • <strong>Subscript</strong>: Use <code>&lt;sub&gt;text&lt;/sub&gt;</code>, markdown <code>~text~</code>, or Unicode <code>H₂O, CO₂</code>.<br />
                  • Features exact typographic baseline alignment rendered natively in both preview and high-res batch certificates.
                </div>
              </div>
            </div>

            {/* Typography Controls */}
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
              <div className="form-group">
                <label>Base Font Size (px)</label>
                <input type="number" value={fontSize} onChange={e => setFontSize(parseInt(e.target.value) || 20)} />
              </div>
              <div className="form-group">
                <label>Text Color</label>
                <input className="color-input" type="color" value={fontColor} onChange={e => setFontColor(e.target.value)} />
              </div>
            </div>

            {/* Generation settings */}
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label>Starting Serial #</label>
                <input
                  type="number"
                  value={startSerialNumber}
                  onChange={e => setStartSerialNumber(parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="form-group">
                <label>Output Format</label>
                <select
                  value={outputFormat}
                  onChange={e => setOutputFormat(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="PDF" style={{ color: '#000' }}>PDF Document (.pdf)</option>
                  <option value="PNG" style={{ color: '#000' }}>Image (.png)</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Filename Pattern</label>
              <input
                value={filenamePattern}
                onChange={e => setFilenamePattern(e.target.value)}
                placeholder="{serial}_CSE_{roll}_AWS"
              />
              <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                {["{serial}", "{name}", "{roll}", "{index}"].map(token => (
                  <button
                    key={token}
                    type="button"
                    className="sub-sup-chip"
                    onClick={() => setFilenamePattern(prev => prev + token)}
                  >
                    + {token}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Placeholders */}
            <h4 style={{ margin: '1.25rem 0 0.5rem', fontSize: '0.85rem' }}>Placeholders & Highlight Styling</h4>
            {placeholders.map((ph, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                <input
                  placeholder="Key (e.g. Name)"
                  value={ph.key}
                  style={{ flex: 1 }}
                  onChange={e => {
                    const n = [...placeholders];
                    n[idx].key = e.target.value;
                    setPlaceholders(n);
                  }}
                />
                <input
                  className="color-input"
                  type="color"
                  value={ph.color}
                  style={{ width: '38px', height: '38px' }}
                  onChange={e => {
                    const n = [...placeholders];
                    n[idx].color = e.target.value;
                    setPlaceholders(n);
                  }}
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', margin: 0, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  <input
                    type="checkbox"
                    checked={!!ph.bold}
                    onChange={e => {
                      const n = [...placeholders];
                      n[idx].bold = e.target.checked;
                      setPlaceholders(n);
                    }}
                    style={{ width: 'auto', margin: 0 }}
                  />
                  Bold
                </label>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '8px' }}
                  onClick={() => setPlaceholders(placeholders.filter((_, i) => i !== idx))}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn btn-secondary"
              style={{ width: '100%', fontSize: '0.8rem', marginTop: '0.25rem' }}
              onClick={() => setPlaceholders([...placeholders, { key: "", color: "#000000", bold: false }])}
            >
              <Plus size={14} /> Add Placeholder
            </button>
          </section>

          {/* Email Delivery */}
          <section style={{ marginTop: '2rem', borderTop: '1px solid var(--glass-border)', paddingTop: '1.25rem' }}>
            <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Mail size={18} /> Email Delivery
            </h3>
            <div className="form-group">
              <label>Google App Password / SMTP Key</label>
              <input
                type="password"
                placeholder="xxxx xxxx xxxx xxxx"
                value={emailConfig.senderPassword}
                onChange={e => setEmailConfig({ ...emailConfig, senderPassword: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Subject</label>
              <input
                value={emailConfig.subject}
                onChange={e => setEmailConfig({ ...emailConfig, subject: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Mail Body</label>
              <textarea
                rows={3}
                value={emailConfig.body}
                onChange={e => setEmailConfig({ ...emailConfig, body: e.target.value })}
              />
            </div>
          </section>
        </div>

        {/* Right Panel: Preview & Actions */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{
            flex: 1,
            minHeight: '380px',
            background: 'rgba(0,0,0,0.4)',
            borderRadius: '1rem',
            border: '1px solid var(--glass-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {isPreviewLoading ? (
              <div style={{ textAlign: 'center', color: 'var(--text)' }}>
                <RefreshCw size={28} className="animate-spin" style={{ marginBottom: '8px' }} />
                <p style={{ fontSize: '0.9rem' }}>Rendering certificate with typography...</p>
              </div>
            ) : previewUrl ? (
              <img src={previewUrl} alt="Certificate Preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '2rem' }}>
                <FileText size={36} style={{ marginBottom: '0.75rem', opacity: 0.6 }} />
                <p>Upload a template and click below to view preview</p>
                <button className="btn btn-secondary" style={{ marginTop: '1rem' }} onClick={handlePreview}>
                  Try Preview
                </button>
              </div>
            )}
            <button
              className="btn btn-secondary"
              style={{ position: 'absolute', bottom: '10px', right: '10px', backdropFilter: 'blur(8px)' }}
              onClick={handlePreview}
              disabled={isPreviewLoading}
            >
              <RefreshCw size={14} /> Update Preview
            </button>
          </div>

          <div style={{ marginTop: '1.5rem' }}>
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '1.5rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>X Coordinate</label>
                <input type="number" value={pos.x} onChange={e => setPos({ ...pos, x: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Y Coordinate</label>
                <input type="number" value={pos.y} onChange={e => setPos({ ...pos, y: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Text Width</label>
                <input type="number" value={pos.width} onChange={e => setPos({ ...pos, width: parseInt(e.target.value) || 100 })} />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                className={`btn ${status.step === 'verified' ? 'btn-secondary' : 'btn-primary'}`}
                onClick={handleGenerate}
                disabled={status.loading}
              >
                {status.loading ? "Generating Certificates..." : status.step === 'verified' ? "Regenerate All Certificates" : "1. Generate & Verify All"}
              </button>

              {status.step === 'verified' && (
                <>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <a href={`${API_URL}${status.zip_url}`} download className="btn btn-secondary" style={{ flex: 1 }}>
                      <Download size={16} /> Download ZIP
                    </a>
                    <button
                      className="btn btn-primary"
                      style={{ flex: 1, background: '#ec4899', borderColor: '#db2777' }}
                      onClick={handleSendEmails}
                      disabled={emailStatus.sending}
                    >
                      {emailStatus.sending ? "Sending..." : `2. Send Selected (${selectedIndices.length})`}
                    </button>
                  </div>

                  {recipients.length > 0 && (
                    <div className="glass-card" style={{ marginTop: '1.25rem', padding: '1.25rem', maxHeight: '420px', overflowY: 'auto' }}>
                      <div style={{ marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--glass-border)' }}>
                        <h4 style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>Smart Selection</h4>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input
                            placeholder="e.g. 1-10, 15, 20-25"
                            value={rangeInput}
                            onChange={e => setRangeInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleApplyRange(); }}
                            style={{ flex: 1, fontSize: '0.8rem' }}
                          />
                          <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '6px 12px' }} onClick={handleApplyRange}>
                            Apply
                          </button>
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                          Recipients ({selectedIndices.length} / {recipients.length})
                        </span>
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: '0.7rem', padding: '3px 8px' }}
                          onClick={() => {
                            if (selectedIndices.length === recipients.length) {
                              setSelectedIndices([]);
                            } else {
                              setSelectedIndices(recipients.map(r => r.index));
                            }
                          }}
                        >
                          {selectedIndices.length === recipients.length ? "Deselect All" : "Select All"}
                        </button>
                      </div>

                      <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--glass-border)' }}>
                            <th style={{ padding: '6px' }}>#</th>
                            <th style={{ padding: '6px' }}>Send</th>
                            <th style={{ padding: '6px' }}>Name</th>
                            <th style={{ padding: '6px' }}>Email</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recipients.map((r, i) => (
                            <tr key={r.index} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                              <td style={{ padding: '6px', color: 'var(--text-dim)' }}>{i + 1}</td>
                              <td style={{ padding: '6px' }}>
                                <input
                                  type="checkbox"
                                  checked={selectedIndices.includes(r.index)}
                                  onChange={() => {
                                    if (selectedIndices.includes(r.index)) {
                                      setSelectedIndices(selectedIndices.filter(idx => idx !== r.index));
                                    } else {
                                      setSelectedIndices([...selectedIndices, r.index]);
                                    }
                                  }}
                                  style={{ width: '15px', height: '15px', margin: 0 }}
                                />
                              </td>
                              <td style={{ padding: '6px' }}>{r.name}</td>
                              <td style={{ padding: '6px', color: 'var(--text-dim)' }}>{r.email}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {emailStatus.success !== null && (
                    <div className="glass-card" style={{ marginTop: '1rem', border: '1px solid var(--success)', background: 'rgba(34, 197, 94, 0.1)' }}>
                      <p style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
                        <CheckCircle2 size={16} /> Result: {JSON.stringify(emailStatus.success)}
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
