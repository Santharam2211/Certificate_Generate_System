from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
import pandas as pd
from PIL import Image, ImageDraw, ImageFont
import os
import io
import re
import zipfile
import shutil
import uuid
import json
import traceback
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(BASE_DIR, "temp_uploads")
OUTPUT_DIR = os.path.join(BASE_DIR, "generated_certs")
FONTS_DIR = os.path.join(BASE_DIR, "fonts")

for d in [UPLOAD_DIR, OUTPUT_DIR, FONTS_DIR]:
    if not os.path.exists(d): os.makedirs(d)

# =========================================================
# 🛠️ UTILITIES
# =========================================================

def parse_color(color_str):
    if color_str.startswith("#"):
        color_str = color_str.lstrip('#')
        return tuple(int(color_str[i:i+2], 16) for i in (0, 2, 4))
    return (0, 0, 0)

def draw_justified_text(draw, text, font, color, container_width, x, y, placeholders_config=None, row_data=None):
    tokens = []
    parts = re.split(r'(\{[a-zA-Z0-9 \&]+\})', text)
    
    for p in parts:
        if p.startswith('{') and p.endswith('}'):
            key = p[1:-1]
            val = str(row_data.get(key, p))
            tokens.append((val, True, key))
        else:
            tokens.append((p, False, None))
            
    lines = []
    current_line = []
    current_width = 0
    space_width = draw.textlength(" ", font=font)
    
    for text_val, is_ph, ph_key in tokens:
        words_in_token = text_val.split(' ')
        for i, word in enumerate(words_in_token):
            if not word and i > 0: continue
            word_w = draw.textlength(word, font=font)
            if current_width + word_w <= container_width:
                current_line.append((word, is_ph, ph_key))
                current_width += word_w + space_width
            else:
                if current_line: lines.append(current_line)
                current_line = [(word, is_ph, ph_key)]
                current_width = word_w + space_width
    if current_line: lines.append(current_line)
        
    for i, line in enumerate(lines):
        if i == len(lines) - 1 or len(line) == 1:
            curr_x = x
            for word, is_ph, ph_key in line:
                c = parse_color(placeholders_config.get(ph_key, "#000000")) if is_ph else color
                draw.text((curr_x, y), word, font=font, fill=c)
                curr_x += draw.textlength(word, font=font) + space_width
        else:
            total_words_width = sum(draw.textlength(w[0], font=font) for w in line)
            gap = (container_width - total_words_width) / (len(line) - 1)
            curr_x = x
            for word, is_ph, ph_key in line:
                c = parse_color(placeholders_config.get(ph_key, "#000000")) if is_ph else color
                draw.text((curr_x, y), word, font=font, fill=c)
                curr_x += draw.textlength(word, font=font) + gap
        y += font.size * 1.5

def get_font(font_name, size):
    path = os.path.join(FONTS_DIR, font_name)
    try:
        if os.path.exists(path) and os.path.isfile(path):
            return ImageFont.truetype(path, size)
    except Exception:
        print(f"Error loading {font_name}, falling back...")
        
    # Robust fallback for cloud environments
    try:
        fonts = [f for f in os.listdir(FONTS_DIR) if f.lower().endswith(('.ttf', '.otf'))]
        for f in fonts:
            try:
                return ImageFont.truetype(os.path.join(FONTS_DIR, f), size)
            except: continue
    except: pass
    return ImageFont.load_default()

# =========================================================
# 🚀 ENDPOINTS
# =========================================================

@app.get("/")
async def health_check():
    return {"status": "ok", "message": "CertifyPro API is live!"}

@app.get("/fonts")
async def list_fonts():
    fonts = [f for f in os.listdir(FONTS_DIR) if f.endswith(('.ttf', '.otf'))]
    return {"fonts": fonts}

@app.post("/preview")
async def preview_certificate(
    template: UploadFile = File(...),
    content: str = Form(...),
    font_name: str = Form("Alice-Regular.ttf"),
    font_size: int = Form(20),
    font_color: str = Form("#000000"),
    placeholders: str = Form("{}"),
    x: int = Form(300),
    y: int = Form(800),
    width: int = Form(1400)
):
    try:
        ph_config = json.loads(placeholders)
        base_img = Image.open(io.BytesIO(await template.read())).convert("RGB")
        font = get_font(font_name, font_size)
        main_color = parse_color(font_color)
        
        # Row data for preview - just show the keys as examples
        dummy_row = {k: k for k in ph_config.keys()}
        # Add common ones
        for k in ["Name", "Prefix", "Year&Department"]:
            if k not in dummy_row: dummy_row[k] = f"[{k}]"
        
        if dummy_row["Prefix"] == "[Prefix]":
            dummy_row["Prefix"] = "Selvan/Selvi"
            
        draw = ImageDraw.Draw(base_img)
        draw_justified_text(draw, content, font, main_color, width, x, y, ph_config, dummy_row)
        
        buf = io.BytesIO()
        base_img.save(buf, format='PNG')
        buf.seek(0)
        return StreamingResponse(buf, media_type="image/png")
    except Exception:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": "Preview failed"})

@app.post("/generate")
async def generate_certificates(
    template: UploadFile = File(...),
    excel: UploadFile = File(...),
    content: str = Form(...),
    font_name: str = Form("Alice-Regular.ttf"),
    font_size: int = Form(20),
    font_color: str = Form("#000000"),
    placeholders: str = Form("{}"),
    x: int = Form(300),
    y: int = Form(800),
    width: int = Form(1400)
):
    try:
        ph_config = json.loads(placeholders)
        s_id = str(uuid.uuid4())
        s_dir = os.path.join(OUTPUT_DIR, s_id)
        os.makedirs(s_dir)
        
        # Save Excel for email mapping later
        excel_bytes = await excel.read()
        excel_path = os.path.join(s_dir, "data.xlsx")
        with open(excel_path, "wb") as f: f.write(excel_bytes)
        
        df = pd.read_excel(io.BytesIO(excel_bytes))
        base_img = Image.open(io.BytesIO(await template.read())).convert("RGB")
        font = get_font(font_name, font_size)
        main_color = parse_color(font_color)
        
        generated = []
        for i, row in df.iterrows():
            img = base_img.copy()
            row_dict = row.to_dict()
            
            # --- Gender Logic ---
            gender = str(row.get("Gender", "")).lower().strip()
            prefix = ""
            if "female" in gender: prefix = "Selvi"
            elif "male" in gender: prefix = "Selvan"
            row_dict["Prefix"] = prefix
            
            draw_justified_text(ImageDraw.Draw(img), content, font, main_color, width, x, y, ph_config, row_dict)
            
            # Save mapping info
            name_val = str(row.get("Name", f"Cert_{i}"))
            safe_name = re.sub(r'[^a-zA-Z0-9]', '_', name_val)
            file_name = f"{i}_{safe_name}.png"
            img.save(os.path.join(s_dir, file_name))
            generated.append({
                "index": i,
                "name": name_val,
                "email": str(row.get("Email", "")),
                "file": file_name
            })
            
        zip_path = os.path.join(OUTPUT_DIR, f"{s_id}.zip")
        with zipfile.ZipFile(zip_path, 'w') as z:
            for item in generated: z.write(os.path.join(s_dir, item["file"]), item["file"])
            
        return {
            "session_id": s_id, 
            "zip_url": f"/download/{s_id}", 
            "recipients": generated
        }
    except Exception:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": "Generation failed"})

@app.get("/download/{s_id}")
async def download(s_id: str):
    path = os.path.join(OUTPUT_DIR, f"{s_id}.zip")
    if os.path.exists(path): return FileResponse(path, filename="certificates.zip")
    return JSONResponse(status_code=404, content={"error": "Not found"})

from fastapi import BackgroundTasks
# Global status tracker
tasks_status = {}

def email_task(session_id, sender_email, sender_password, subject, body, selected_indices=None):
    tasks_status[session_id] = "sending"
    try:
        s_dir = os.path.join(OUTPUT_DIR, session_id)
        excel_path = os.path.join(s_dir, "data.xlsx")
        if not os.path.exists(excel_path): 
            tasks_status[session_id] = "failed"
            return
            
        df = pd.read_excel(excel_path)
        context = ssl.create_default_context()
        
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=context) as server:
            server.login(sender_email, sender_password)
            for i, row in df.iterrows():
                # Selective filter
                if selected_indices is not None and i not in selected_indices:
                    continue
                    
                email_to = row.get("Email")
                if pd.isna(email_to) or not str(email_to).strip(): continue
                
                name_val = str(row.get("Name", f"Cert_{i}"))
                safe_name = re.sub(r'[^a-zA-Z0-9]', '_', name_val)
                file_name = f"{i}_{safe_name}.png"
                file_path = os.path.join(s_dir, file_name)
                
                if not os.path.exists(file_path): continue
                
                msg = MIMEMultipart()
                msg['From'] = sender_email
                msg['To'] = str(email_to)
                msg['Subject'] = subject
                msg.attach(MIMEText(body.format(Name=name_val), 'plain'))
                
                with open(file_path, "rb") as f:
                    part = MIMEBase('application', 'octet-stream')
                    part.set_payload(f.read())
                    encoders.encode_base64(part)
                    part.add_header('Content-Disposition', f"attachment; filename={file_name}")
                    msg.attach(part)
                
                try:
                    server.send_message(msg)
                except: pass
        tasks_status[session_id] = "completed"
    except:
        traceback.print_exc()
        tasks_status[session_id] = "failed"

@app.post("/send-emails")
async def send_emails(
    background_tasks: BackgroundTasks,
    session_id: str = Form(...),
    sender_email: str = Form(...),
    sender_password: str = Form(...),
    subject: str = Form(...),
    body: str = Form(...),
    selected_indices: str = Form("[]")  # JSON string of indices
):
    s_dir = os.path.join(OUTPUT_DIR, session_id)
    if not os.path.exists(s_dir):
        return JSONResponse(status_code=404, content={"error": "Session not found"})
        
    try:
        indices = json.loads(selected_indices)
    except:
        indices = None
        
    background_tasks.add_task(email_task, session_id, sender_email, sender_password, subject, body, indices)
    return {"message": "Background sending started", "status": "success"}

@app.get("/email-status/{session_id}")
async def get_email_status(session_id: str):
    status = tasks_status.get(session_id, "unknown")
    return {"status": status}

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
