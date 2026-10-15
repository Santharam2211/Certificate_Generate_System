# 🎓 CertifyPro — Complete User Guide

> **CertifyPro** is a full-stack web application that automates bulk digital certificate generation, preview, and email delivery. It accepts an image template, a data spreadsheet, and rich text content — then produces personalized certificates as high-resolution PDFs or PNGs.

---

## 📋 Table of Contents

1. [System Overview](#1-system-overview)
2. [Tech Stack at a Glance](#2-tech-stack-at-a-glance)
3. [Project Structure](#3-project-structure)
4. [Local Setup & Running](#4-local-setup--running)
5. [Preparing Your Files](#5-preparing-your-files)
6. [Using the Web Interface — Step by Step](#6-using-the-web-interface--step-by-step)
7. [Placeholders & Dynamic Content](#7-placeholders--dynamic-content)
8. [Superscript & Subscript Typography](#8-superscript--subscript-typography)
9. [Text Positioning Controls](#9-text-positioning-controls)
10. [Output & Download](#10-output--download)
11. [Email Delivery](#11-email-delivery)
12. [Filename Patterns](#12-filename-patterns)
13. [API Reference](#13-api-reference)
14. [Email Setup (Brevo)](#14-email-setup-brevo)
15. [Cloud Hosting](#15-cloud-hosting)
16. [Troubleshooting](#16-troubleshooting)

---

## 1. System Overview

CertifyPro works in three stages:

```
┌─────────────────────────────────────────────────────────────────────┐
│  1. CONFIGURE   →   2. GENERATE   →   3. DELIVER                    │
│                                                                       │
│  Upload template   Backend renders    Download ZIP or               │
│  Upload Excel      one cert per row   send via email                 │
│  Write content     (PDF or PNG)                                      │
└─────────────────────────────────────────────────────────────────────┘
```

| Component  | Role |
|------------|------|
| **Frontend** | React + Vite UI — configuration, live preview, email dispatch |
| **Backend**  | FastAPI (Python) — image rendering, batch generation, ZIP packaging |

---

## 2. Tech Stack at a Glance

| Layer | Technology |
|-------|-----------|
| UI Framework | React 18 + Vite 4 |
| Styling | Vanilla CSS with CSS variables (glassmorphism dark theme) |
| Icons | `lucide-react` |
| Backend | FastAPI + Uvicorn |
| Image Processing | Pillow (PIL) |
| Data Reading | pandas + openpyxl |
| Email (Cloud) | Brevo (formerly Sendinblue) API |
| Email (Local) | SMTP via Google App Password |
| Hosting | Vercel (frontend) + Render (backend) |

---

## 3. Project Structure

```
Certificate generate/
├── backend/
│   ├── main.py              ← FastAPI app — all API endpoints
│   ├── fonts/               ← Place your .ttf / .otf font files here
│   ├── temp_uploads/        ← Temporary storage for uploaded files
│   └── generated_certs/     ← Output certificates + ZIP archives
│
├── frontend/
│   ├── index.html           ← App entry point
│   ├── src/
│   │   ├── App.jsx          ← Main UI component
│   │   └── index.css        ← All styles (dark glassmorphism theme)
│   └── package.json         ← Frontend dependencies
│
├── requirements.txt         ← Python dependencies
├── .env.example             ← Template for environment variables
├── email_setup.md           ← Brevo email configuration guide
├── hosting.md               ← Vercel + Render deployment guide
└── USER_GUIDE.md            ← This file
```

---

## 4. Local Setup & Running

### Prerequisites
- **Python 3.10+** installed
- **Node.js 18+** installed

### Step 1 — Clone / Open the project
Open a terminal in the `Certificate generate` folder.

### Step 2 — Set up the Backend

```powershell
# Install Python dependencies
pip install -r requirements.txt

# Create your environment config
copy .env.example backend\.env
# Edit backend\.env and fill in your API keys if needed
```

### Step 3 — Start the Backend

```powershell
# From the project root:
python -m uvicorn backend.main:app --reload --port 8000
```

The API will be live at: **`http://localhost:8000`**
Verify it works by opening `http://localhost:8000/` — you should see:
```json
{"status": "ok", "message": "CertifyPro API is live!"}
```

### Step 4 — Set up the Frontend

```powershell
cd frontend
npm install
```

### Step 5 — Start the Frontend

```powershell
npm run dev
```

The app will be running at: **`http://localhost:5173`**

> **Note:** The frontend automatically connects to `http://localhost:8000` by default. To point to a different backend, create a `.env` file inside `frontend/` and add:
> ```
> VITE_API_URL=http://your-backend-url
> ```

---

## 5. Preparing Your Files

### 🖼️ Certificate Template (PNG or JPG)

- Design your certificate background image in any tool (Canva, Photoshop, etc.)
- Export as **PNG** (recommended for quality) or **JPG**
- The text will be printed *on top* of this image
- Leave a blank area where the certificate text should appear

### 📊 Excel Dataset (XLSX)

Your spreadsheet must have **column headers in the first row**. Required columns:

| Column Name | Description | Example |
|-------------|-------------|---------|
| `Name` | Full name of the recipient | `Arjun Kumar` |
| `Gender` | Used for auto-prefix | `Male` or `Female` |
| `Email` | Recipient's email address | `arjun@example.com` |
| `RollNumber` (or `Roll Number`) | Used in filename patterns | `21CSE042` |
| `Year&Department` | Any custom column you use as placeholder | `II CSE` |

> ✅ You can add **any custom columns** — they can all be used as `{Placeholders}` in your content.

**Example spreadsheet layout:**

| Name | Gender | Email | RollNumber | Year&Department |
|------|--------|-------|------------|-----------------|
| Ananya Raj | Female | ananya@mail.com | 21CSE001 | II CSE |
| Karthik M | Male | karthik@mail.com | 21CSE002 | II CSE |

### 🔤 Custom Fonts

Place your `.ttf` or `.otf` font files in:
```
backend/fonts/
```

The system will automatically detect and list them in the **Font Family** dropdown.
For bold support, include a bold variant with the suffix `Bold` or `b` in the filename (e.g., `Alice-Regular.ttf` and `Alice-Bold.ttf`).

---

## 6. Using the Web Interface — Step by Step

The interface is divided into two panels:
- **Left Panel** — Configuration & Content
- **Right Panel** — Live Preview & Actions

### 🔷 Step 1: Upload Files

Click the dashed upload zones to select:
- **Template (PNG/JPG)** — your certificate background
- **Dataset (XLSX)** — your recipients spreadsheet

### 🔷 Step 2: Choose a Font

Click the **Font Family** button to open a searchable dropdown of all fonts in the `backend/fonts/` folder. Type to filter and click to select.

### 🔷 Step 3: Write Body Content

In the **Body Content** textarea, type the text that will appear on every certificate.
Use `{ColumnName}` placeholders where you want dynamic data from Excel.

**Example:**
```
This is to certify that {Prefix} {Name} of {Year&Department} has successfully
participated in DigiFest 2k26 held on 24<sup>th</sup> March 2026.
```

> `{Prefix}` is automatically set to **Selvan** (Male) or **Selvi** (Female) based on the `Gender` column — no extra column needed.

### 🔷 Step 4: Set Typography

| Setting | Description |
|---------|-------------|
| **Base Font Size (px)** | Size of the main body text in pixels |
| **Text Color** | Default color for non-placeholder text (color picker) |

### 🔷 Step 5: Set Generation Options

| Setting | Description | Example |
|---------|-------------|---------|
| **Starting Serial #** | First serial number assigned to certificates | `215` |
| **Output Format** | Choose PDF or PNG output | `PDF` |
| **Filename Pattern** | Template for output filenames (see [Section 12](#12-filename-patterns)) | `{serial}_CSE_{roll}_AWS` |

### 🔷 Step 6: Configure Placeholders (Styling)

Under **Placeholders & Highlight Styling**, each placeholder row allows you to:
- Set the **Key** — must match exactly what you use in `{Key}` in content
- Pick a **Color** — the color this placeholder text renders on the certificate
- Toggle **Bold** — whether this placeholder renders in bold

Click **+ Add Placeholder** to add new rows. Click 🗑️ to remove.

### 🔷 Step 7: Preview

Click **Update Preview** to see a live rendered image of the certificate with sample data.
Use the **X Coordinate**, **Y Coordinate**, and **Text Width** controls to position text.

### 🔷 Step 8: Generate

Click **1. Generate & Verify All** to batch-generate certificates for every row in the Excel file.

After generation, a recipient table appears showing Name, Email, and file for each certificate.

---

## 7. Placeholders & Dynamic Content

Placeholders let you insert per-row data from your Excel file into the certificate text.

**Syntax:** `{ColumnName}` — case-sensitive, must match the Excel column header exactly.

### Built-in Placeholders

| Placeholder | Source | Notes |
|-------------|--------|-------|
| `{Name}` | `Name` column in Excel | Standard recipient name |
| `{Prefix}` | Auto-generated from `Gender` column | `Selvan` / `Selvi` (no column needed) |
| `{Year&Department}` | `Year&Department` column in Excel | Any custom column works |

### Custom Placeholders

You can add **any column from your Excel file** as a placeholder. For example, if your Excel has a `Course` column, use `{Course}` in your content — the system will substitute it automatically.

### Placeholder Styling

Each placeholder can have:
- **Custom text color** (e.g., dark red for names)
- **Bold text** (great for emphasizing names)

These styles only apply to the substituted text in the final certificate.

---

## 8. Superscript & Subscript Typography

CertifyPro supports professional typographic super/subscript in three ways:

### Method 1: HTML Tags
```
24<sup>th</sup> March    →  24ᵗʰ March
H<sub>2</sub>O           →  H₂O
```

### Method 2: Markdown Notation
```
24^th^    →  24ᵗʰ
H~2~O     →  H₂O
```

### Method 3: Unicode Characters
Type or paste native Unicode super/subscript characters directly:
```
E=mc²     →  E=mc² (² is a Unicode superscript)
H₂O       →  H₂O  (₂ is a Unicode subscript)
```

All three methods produce identical output on the final rendered certificate.

### Toolbar Buttons

| Button | Action |
|--------|--------|
| **Superscript** | Wraps selected text in `<sup>...</sup>` |
| **Subscript** | Wraps selected text in `<sub>...</sub>` |
| **✨ Auto Ordinals** | Finds all unformatted ordinals (1st, 2nd, 24th) and auto-converts them |
| **Quick Insert chips** | Click `st`, `nd`, `rd`, `th` to insert common ordinal suffixes instantly |

### Live Typography Preview

Below the content textarea, a **Live Preview** box shows your text rendered in real-time with:
- Superscripts shown in **purple**
- Subscripts shown in **blue**
- Placeholders highlighted in their configured colors

---

## 9. Text Positioning Controls

The text block position on the certificate image is controlled by three values found in the **right panel**:

| Control | Description | Tips |
|---------|-------------|------|
| **X Coordinate** | Horizontal start position (pixels from left edge) | Increase to move text right |
| **Y Coordinate** | Vertical start position (pixels from top edge) | Increase to move text down |
| **Text Width** | Maximum width of the text block (pixels) | Text wraps at this width. Justify is automatic. |

> 💡 **Tip:** Use **Update Preview** frequently while adjusting coordinates to find the perfect placement. The image coordinates are in pixels relative to the original template image size.

### Text Rendering Features
- **Justified alignment** — the last line is left-aligned; all other lines span full width
- **Auto word-wrap** — text wraps within the defined width
- **Baseline alignment** — super/subscripts are pixel-perfectly aligned to the text baseline
- **High-resolution output** — PDF exported at 300 DPI

---

## 10. Output & Download

After clicking **Generate & Verify All**:

1. A **recipient table** appears listing every certificate generated.
2. A **Download ZIP** button appears — click to download all certificates in a single `.zip` file.
3. Each file inside the ZIP is named according to your **Filename Pattern**.

### Output Formats

| Format | Best For |
|--------|----------|
| **PDF** | Printing, formal distribution, archiving |
| **PNG** | Social media, web display, WhatsApp sharing |

---

## 11. Email Delivery

After generating, you can send certificates directly to recipients via email.

### Smart Selection

Before sending, choose which recipients to include:

| Method | How |
|--------|-----|
| **Select All / Deselect All** | Toggle button above the table |
| **Individual checkboxes** | Check/uncheck per row in the recipient table |
| **Range input** | Type patterns like `1-10, 15, 20-25` and click **Apply** |

### Email Configuration

Fill in the **Email Delivery** section (left panel):

| Field | Description |
|-------|-------------|
| **Google App Password / SMTP Key** | 16-character App Password from your Google account |
| **Subject** | Email subject line |
| **Mail Body** | Email body text (supports `{Name}` placeholder) |

> The `{Name}` placeholder in the email body is replaced with each recipient's name automatically.

### Sending

Click **2. Send Selected (N)** to send to all checked recipients. The button shows a live count of selected recipients.

> ⚠️ **Important:** For local sending, use a **Google App Password** (not your regular password). See [email_setup.md](email_setup.md) for cloud/Brevo setup.

---

## 12. Filename Patterns

The **Filename Pattern** field controls how each output file is named.

### Available Tokens

| Token | Value |
|-------|-------|
| `{serial}` | Serial number (starts from **Starting Serial #**) |
| `{name}` | Recipient's name from Excel |
| `{roll}` | Roll number from Excel |
| `{index}` | Row index (0-based) |

### Examples

| Pattern | Example Output |
|---------|---------------|
| `{serial}_CSE_{roll}_AWS` | `215_CSE_21CSE001_AWS.pdf` |
| `{name}_{roll}` | `Ananya_Raj_21CSE001.pdf` |
| `Certificate_{serial}` | `Certificate_215.pdf` |

Click the **+ {token}** chips below the input field to append tokens quickly.

---

## 13. API Reference

The backend exposes these REST endpoints:

### `GET /`
Health check — confirms the API is running.

**Response:**
```json
{"status": "ok", "message": "CertifyPro API is live!"}
```

---

### `GET /fonts`
Returns a list of all available font files from the `backend/fonts/` directory.

**Response:**
```json
{"fonts": ["Alice-Regular.ttf", "arialbd.ttf", "...more"]}
```

---

### `POST /preview`
Renders a single preview image with sample placeholder data.

| Form Field | Type | Description |
|------------|------|-------------|
| `template` | File | Certificate background image |
| `content` | string | Certificate body text with placeholders |
| `font_name` | string | Font filename (e.g. `Alice-Regular.ttf`) |
| `font_size` | int | Font size in pixels |
| `font_color` | string | Hex color (e.g. `#000000`) |
| `placeholders` | JSON string | `{"Name": {"color": "#960000", "bold": true}}` |
| `x` | int | X coordinate of text start |
| `y` | int | Y coordinate of text start |
| `width` | int | Maximum text block width |

**Response:** PNG image stream

---

### `POST /generate`
Generates a certificate for every row in the Excel file and packages them in a ZIP.

| Form Field | Type | Description |
|------------|------|-------------|
| `template` | File | Certificate background image |
| `excel` | File | Excel dataset (.xlsx) |
| `content` | string | Certificate body text |
| `font_name` | string | Font filename |
| `font_size` | int | Font size |
| `font_color` | string | Hex color |
| `placeholders` | JSON string | Placeholder styling config |
| `start_serial_number` | int | Starting serial number |
| `output_format` | string | `PDF` or `PNG` |
| `filename_pattern` | string | Filename template with tokens |
| `x` | int | X coordinate |
| `y` | int | Y coordinate |
| `width` | int | Text block width |

**Response:**
```json
{
  "session_id": "uuid-string",
  "zip_url": "/download/uuid-string",
  "recipients": [
    {"index": 0, "name": "Ananya Raj", "email": "ananya@mail.com", "file": "215_CSE_21CSE001_AWS.pdf"}
  ]
}
```

---

### `GET /download/{session_id}`
Downloads the ZIP archive of generated certificates.

**Response:** ZIP file download

---

## 14. Email Setup (Brevo)

For cloud deployments (Render), use **Brevo (Sendinblue)** for reliable email delivery.

### Quick Setup

1. Create a free account at [brevo.com](https://www.brevo.com/)
2. Go to **Account → SMTP & API → API Keys** and generate a key starting with `xkeysib-`
3. Go to **Senders** and verify your sender email address
4. Add these to your environment:

```env
BREVO_API_KEY=xkeysib-your-actual-key-here
SENDER_EMAIL=your-verified@email.com
```

**For local development** — edit `backend/.env`:
```env
BREVO_API_KEY=xkeysib-...
SENDER_EMAIL=you@gmail.com
```

**For Render cloud** — add as Environment Variables in the Render dashboard.

> 💡 Brevo's free tier allows **300 emails/day** — more than enough for most events.

See [email_setup.md](email_setup.md) for the complete walkthrough.

---

## 15. Cloud Hosting

### Backend → Render

1. Push your full project to **GitHub** (including `backend/fonts/`)
2. In [Render](https://render.com/), create a **New Web Service**
3. Connect your GitHub repository
4. Set these fields:

| Setting | Value |
|---------|-------|
| **Environment** | Python 3 |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `gunicorn -k uvicorn.workers.UvicornWorker backend.main:app` |

5. Add Environment Variables:
   - `PORT` = `10000`
   - `BREVO_API_KEY` = your key
   - `SENDER_EMAIL` = your verified email
   - `PYTHON_VERSION` = `3.11.9` (recommended)

6. Note your Render URL (e.g. `https://certifypro-api.onrender.com`)

### Frontend → Vercel

1. In [Vercel](https://vercel.com/), create a **New Project**
2. Import the same GitHub repository
3. Set:
   - **Root Directory**: `frontend`
   - **Framework Preset**: `Vite`
4. Add Environment Variable:
   - `VITE_API_URL` = your Render backend URL
5. Click **Deploy**

See [hosting.md](hosting.md) for the complete checklist.

---

## 16. Troubleshooting

### ❌ "Please upload a Certificate Template first"
You clicked **Preview** or **Generate** without uploading a template image. Use the upload zone in the left panel.

---

### ❌ "Both Certificate Template and Excel Dataset are required!"
You must upload both the background image and the Excel file before generating.

---

### ❌ Preview shows wrong text position
Adjust **X**, **Y**, and **Text Width** in the right panel, then click **Update Preview** to refresh.

---

### ❌ Placeholder shows as literal text (e.g. `{Name}` not replaced)
- Ensure the placeholder `Key` in the **Placeholders** section exactly matches the Excel column header (case-sensitive)
- The curly-brace syntax in content must match: `{Name}`, not `{name}` or `{ Name }`

---

### ❌ Font not showing in dropdown
Place your `.ttf` or `.otf` file in `backend/fonts/` and restart the backend server. Then refresh the frontend.

---

### ❌ Bold not working for a placeholder
Ensure the bold variant font file exists in `backend/fonts/`. Naming convention: `MyFont-Regular.ttf` → `MyFont-Bold.ttf`. If unavailable, the system falls back to `arialbd.ttf`.

---

### ❌ Email sending fails (local)
- Use a **Google App Password** (not your regular Gmail password)
- Enable 2-Step Verification in Google, then generate an App Password under **Security → App Passwords**
- Paste the 16-character key in the password field

---

### ❌ Certificates not downloading (cloud)
- Check that the backend is live on Render (visit its URL directly)
- Ensure `VITE_API_URL` in Vercel points to the correct Render URL (no trailing slash)
- Render free-tier services sleep after 15 minutes of inactivity — the first request may take ~30 seconds

---

### ❌ Superscript/subscript not rendering on certificate
The `<sup>` and `<sub>` tags are parsed server-side during generation. Ensure:
- Tags are properly closed: `<sup>th</sup>` not `<sup>th`
- Or use markdown: `^th^` instead

---

*Made with ❤️ by the CertifyPro team. For issues, check the backend terminal output for detailed Python tracebacks.*
