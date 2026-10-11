from fastapi import FastAPI, Request, Form, UploadFile, File
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import joblib
import pandas as pd
import numpy as np
import io

app = FastAPI(title="AI Customer Strategy - Enterprise Web")

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

try:
    model = joblib.load('models/best_ecommerce_model.joblib')
except Exception as e:
    model = None

segment_dict = {0: 'Khách Hàng Thường', 1: 'Khách Ngủ Đông', 2: 'Khách VIP (Cá Mập)'}

@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.post("/predict-single-json")
async def predict_single_json(recency: float = Form(...), frequency: float = Form(...), monetary: float = Form(...)):
    """API chuyên xử lý dự báo ngầm bằng AJAX, không làm refresh trang"""
    if model is None:
        return JSONResponse({"error": "Chưa tải được mô hình AI!"}, status_code=500)
    
    input_data = pd.DataFrame({'Recency': [recency], 'Frequency': [frequency], 'Monetary': [monetary]})
    pred_code = int(model.predict(input_data)[0])
    segment_name = segment_dict.get(pred_code, "Không xác định")
    
    strategies = {
        0: "Phân bổ vào danh sách Email Marketing hàng tháng. Giữ nhịp độ tương tác vừa phải.",
        1: "Kích hoạt lại cấp tốc! Gửi SMS kèm Voucher Flash Sale giảm 30% trong 24 giờ tới.",
        2: "Phân quyền chăm sóc 1-1 cho Account Manager. Mời trải nghiệm sản phẩm đặc quyền VIP."
    }
    
    return {
        "code": pred_code,
        "segment": segment_name,
        "strategy": strategies.get(pred_code, "")
    }

@app.post("/predict-batch", response_class=HTMLResponse)
async def predict_batch(request: Request, file: UploadFile = File(...)):
    if model is None:
        return templates.TemplateResponse("index.html", {"request": request, "batch_error": "Chưa tải được mô hình AI!"})
    
    try:
        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents))
        
        required_cols = ['Recency', 'Frequency', 'Monetary']
        if not all(col in df.columns for col in required_cols):
            return templates.TemplateResponse("index.html", {"request": request, "batch_error": "File CSV thiếu các cột: Recency, Frequency, Monetary"})
        
        predictions = model.predict(df[required_cols])
        df['Phân Khúc AI'] = [segment_dict[int(p)] for p in predictions]
        summary = df['Phân Khúc AI'].value_counts().to_dict()
        
        return templates.TemplateResponse("index.html", {
            "request": request, 
            "batch_success": True, 
            "total_records": len(df),
            "summary": summary,
            "table_html": df.head(10).to_html(classes="table table-dark table-striped", index=False)
        })
    except Exception as e:
        return templates.TemplateResponse("index.html", {"request": request, "batch_error": f"Lỗi đọc file: {str(e)}"})