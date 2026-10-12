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
import traceback
import base64
import requests

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

def parse_subscript_superscript(text, base_font, base_color):
    """
    Parse text for <sub> and <sup> tags and return a list of segments.
    Each segment is (text, font, color, y_offset)
    y_offset: 0 for normal, positive for subscript, negative for superscript
    """
    segments = []
    # Pattern to match <sub>...</sub> and <sup>...</sup>
    pattern = r'(<(sub|sup)>(.*?)</\2>)'
    
    last_end = 0
    for match in re.finditer(pattern, text, re.DOTALL):
        # Add text before the tag
        if match.start() > last_end:
            normal_text = text[last_end:match.start()]
            if normal_text:
                segments.append((normal_text, base_font, base_color, 0))
        
        # Process the tag content
        tag_type = match.group(2)  # 'sub' or 'sup'
        tag_content = match.group(3)
        
        # Create smaller font for subscript/superscript (60% of base size)
        sub_sup_size = int(base_font.size * 0.6)
        # Try to use the base font's path if available, otherwise use font_variant
        try:
            if hasattr(base_font, 'path'):
                sub_sup_font = ImageFont.truetype(base_font.path, sub_sup_size)
            else:
                sub_sup_font = base_font.font_variant(size=sub_sup_size)
        except:
            # Fallback to base font
            sub_sup_font = base_font
        
        # Calculate y offset
        # Subscript: move down by 30% of base font size
        # Superscript: move up by 30% of base font size
        if tag_type == 'sub':
            y_offset = int(base_font.size * 0.3)
        else:  # sup
            y_offset = -int(base_font.size * 0.3)
        
        segments.append((tag_content, sub_sup_font, base_color, y_offset))
        
        last_end = match.end()
    
    # Add remaining text after last tag
    if last_end < len(text):
        remaining_text = text[last_end:]
        if remaining_text:
            segments.append((remaining_text, base_font, base_color, 0))
    
    # If no tags found, return entire text as normal
    if not segments:
        segments.append((text, base_font, base_color, 0))
    
    return segments

def draw_justified_text(draw, text, font, bold_font, color, container_width, x, y, placeholders_config=None, row_data=None):
    """
    Render justified text on a certificate image.
    Placeholders like {Name} are replaced from row_data and can have
    individual font/color overrides.
    Supports <sub> and <sup> tags for subscript and superscript.
    """
    if row_data is None: row_data = {}
    if placeholders_config is None: placeholders_config = {}

    # 1. Parse segments (placeholders first)
    segments = []
    parts = re.split(r'(\{[a-zA-Z0-9 \&]+\})', text)
    for part in parts:
        if not part: continue
        if part.startswith('{') and part.endswith('}'):
            key = part[1:-1]
            val = str(row_data.get(key, part))
            ph_cfg = placeholders_config.get(key, {})
            if isinstance(ph_cfg, dict):
                w_font = bold_font if ph_cfg.get('bold') else font
                w_color = parse_color(ph_cfg.get('color', '#000000'))
            else:
                w_font = font
                w_color = color
            # Parse subscript/superscript within the placeholder value
            sub_segments = parse_subscript_superscript(val, w_font, w_color)
            segments.extend(sub_segments)
        else:
            # Parse subscript/superscript within regular text
            sub_segments = parse_subscript_superscript(part, font, color)
            segments.extend(sub_segments)

    # 2. Group into Words (Word = list of (string, font, color, y_offset))
    items = []
    current_word = []
    for seg_text, seg_font, seg_color, y_offset in segments:
        tokens = re.split(r'(\s+)', seg_text)
        for tok in tokens:
            if not tok: continue
            if tok.isspace():
                if current_word:
                    items.append(current_word)
                    current_word = []
                items.append("SPACE")
            else:
                current_word.append((tok, seg_font, seg_color, y_offset))
    if current_word:
        items.append(current_word)

    # Filter consecutive spaces
    filtered_items = []
    for item in items:
        if item == "SPACE":
            if not filtered_items or filtered_items[-1] != "SPACE":
                filtered_items.append("SPACE")
        else:
            filtered_items.append(item)
    if filtered_items and filtered_items[0] == "SPACE": filtered_items.pop(0)
    if filtered_items and filtered_items[-1] == "SPACE": filtered_items.pop()

    # 3. Wrap lines
    space_w = draw.textlength(' ', font=font)
    def get_word_width(wg):
        return sum(draw.textlength(t, font=f) for t, f, c, y_off in wg)

    lines = []
    current_line = []
    current_line_width = 0

    for item in filtered_items:
        if item == "SPACE": continue
        wg = item
        w_width = get_word_width(wg)
        needed = w_width + (space_w if current_line else 0)
        
        if current_line_width + needed <= container_width or not current_line:
            current_line.append(wg)
            current_line_width += needed
        else:
            lines.append(current_line)
            current_line = [wg]
            current_line_width = w_width

    if current_line:
        lines.append(current_line)

    # 4. Draw
    for line_idx, line in enumerate(lines):
        is_last = (line_idx == len(lines) - 1)
        
        if is_last or len(line) == 1:
            curr_x = x
            for wg in line:
                for text_part, f, c, y_off in wg:
                    draw.text((curr_x, y + y_off), text_part, font=f, fill=c)
                    curr_x += draw.textlength(text_part, font=f)
                curr_x += space_w
        else:
            total_words_width = sum(get_word_width(wg) for wg in line)
            gap = (container_width - total_words_width) / (len(line) - 1)
            curr_x = x
            for wg_idx, wg in enumerate(line):
                for text_part, f, c, y_off in wg:
                    draw.text((curr_x, y + y_off), text_part, font=f, fill=c)
                    curr_x += draw.textlength(text_part, font=f)
                if wg_idx < len(line) - 1:
                    curr_x += gap
                    
        y += font.size * 1.5

def get_bold_font(font_name, size):
    # 1. Try standard Regular→Bold name substitution
    bold_name = font_name.replace('Regular', 'Bold').replace('regular', 'bold')
    if bold_name != font_name and os.path.exists(os.path.join(FONTS_DIR, bold_name)):
        return ImageFont.truetype(os.path.join(FONTS_DIR, bold_name), size)

    # 2. Try common bold suffix patterns on the base filename
    base, ext = os.path.splitext(font_name)
    for suffix in ['b', 'B', 'bd', 'Bold', '-Bold']:
        path = os.path.join(FONTS_DIR, base + suffix + ext)
        if os.path.exists(path):
            return ImageFont.truetype(path, size)

    # 3. Fall back to Arial Bold (guaranteed to look bold, consistent fallback)
    arialbd_path = os.path.join(FONTS_DIR, 'arialbd.ttf')
    if os.path.exists(arialbd_path):
        try:
            return ImageFont.truetype(arialbd_path, size)
        except Exception:
            pass

    # 4. Last resort: use whatever the regular font is
    return get_font(font_name, size)

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

def build_filename(pattern, serial, name, roll, index, ext):
    """Resolve filename pattern tokens and sanitize the result."""
    result = pattern
    result = result.replace("{serial}", str(serial))
    result = result.replace("{name}", str(name))
    result = result.replace("{roll}", str(roll))
    result = result.replace("{index}", str(index))
    # Strip characters that are illegal in filenames
    result = re.sub(r'[<>:"/\\|?*]', '_', result)
    return f"{result}.{ext.lower()}"



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
        bold_font = get_bold_font(font_name, font_size)
        main_color = parse_color(font_color)
        
        # Row data for preview - just show the keys as examples
        dummy_row = {k: k for k in ph_config.keys()}
        # Add common ones
        for k in ["Name", "Prefix", "Year&Department"]:
            if k not in dummy_row: dummy_row[k] = f"[{k}]"
        
        if dummy_row["Prefix"] == "[Prefix]":
            dummy_row["Prefix"] = "Selvan/Selvi"
            
        draw = ImageDraw.Draw(base_img)
        draw_justified_text(draw, content, font, bold_font, main_color, width, x, y, ph_config, dummy_row)
        
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
    start_serial_number: int = Form(215),
    x: int = Form(300),
    y: int = Form(800),
    width: int = Form(1400),
    output_format: str = Form("PDF"),
    filename_pattern: str = Form("{serial}_CSE_{roll}_AWS")
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
        bold_font = get_bold_font(font_name, font_size)
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
            
            draw_justified_text(ImageDraw.Draw(img), content, font, bold_font, main_color, width, x, y, ph_config, row_dict)
            
            # Save mapping info
            name_val = str(row.get("Name", f"Cert_{i}"))
            serial_number = start_serial_number + i
            roll_number = str(row.get("RollNumber", str(row.get("Roll Number", "UNKNOWN"))))
            
            if output_format.upper() == "PDF":
                file_name = build_filename(filename_pattern, serial_number, name_val, roll_number, i, "pdf")
                img.save(os.path.join(s_dir, file_name), format='PDF', resolution=300.0)
            else:
                file_name = build_filename(filename_pattern, serial_number, name_val, roll_number, i, "png")
                img.save(os.path.join(s_dir, file_name), format='PNG')
                
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



if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
