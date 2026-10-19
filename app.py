from fastapi import FastAPI, Request, Form, UploadFile, File
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import joblib
import pandas as pd
import numpy as np
import io
import os

app = FastAPI(title="AI Customer Strategy - Enterprise Web")

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

try:
    model = joblib.load('models/best_ecommerce_model.joblib')
except Exception as e:
    model = None

segment_dict = {0: 'Khách Hàng Thường', 1: 'Khách Ngủ Đông', 2: 'Khách VIP (Cá Mập)'}

# ---------------------------------------------------------
# API QUAN TRỌNG MỚI: ĐỔ DỮ LIỆU THẬT LÊN QUẢ ĐỊA CẦU VÀ KPI
# ---------------------------------------------------------
DATA_CLEAN_PATH = os.path.join("data", "clean_online_retail.parquet")
market_insights_cache = None

def get_market_insights():
    global market_insights_cache
    if market_insights_cache is not None:
        return market_insights_cache

    if not os.path.exists(DATA_CLEAN_PATH):
        return None

    # Đọc nhanh file parquet
    df = pd.read_parquet(DATA_CLEAN_PATH)

    # Từ điển tọa độ thủ đô/trung tâm các quốc gia thường gặp
    geo_coords = {
        'United Kingdom': {'lat': 55.3781, 'lon': -3.4360},
        'EIRE': {'lat': 53.1424, 'lon': -7.6921},
        'Germany': {'lat': 51.1657, 'lon': 10.4515},
        'France': {'lat': 46.2276, 'lon': 2.2137},
        'Netherlands': {'lat': 52.1326, 'lon': 5.2913},
        'Australia': {'lat': -25.2744, 'lon': 133.7751},
        'Spain': {'lat': 40.4637, 'lon': -3.7492},
        'Switzerland': {'lat': 46.8182, 'lon': 8.2275},
        'Belgium': {'lat': 50.5039, 'lon': 4.4699},
        'Sweden': {'lat': 60.1282, 'lon': 18.6435},
        'Japan': {'lat': 36.2048, 'lon': 138.2529},
        'Portugal': {'lat': 39.3999, 'lon': -8.2245},
        'USA': {'lat': 37.0902, 'lon': -95.7129},
        'Norway': {'lat': 60.4720, 'lon': 8.4689},
        'Italy': {'lat': 41.8719, 'lon': 12.5674},
        'Channel Islands': {'lat': 49.3723, 'lon': -2.3644},
        'Finland': {'lat': 61.9241, 'lon': 25.7482},
        'Cyprus': {'lat': 35.1264, 'lon': 33.4299},
        'Austria': {'lat': 47.5162, 'lon': 14.5501},
        'Denmark': {'lat': 56.2639, 'lon': 9.5018},
        'Poland': {'lat': 51.9194, 'lon': 19.1451},
        'Greece': {'lat': 39.0742, 'lon': 21.8243},
        'Singapore': {'lat': 1.3521, 'lon': 103.8198},
        'Lebanon': {'lat': 33.8547, 'lon': 35.8623},
        'Canada': {'lat': 56.1304, 'lon': -106.3468},
        'Israel': {'lat': 31.0461, 'lon': 34.8516},
        'Iceland': {'lat': 64.9631, 'lon': -19.0208},
        'Brazil': {'lat': -14.2350, 'lon': -51.9253},
        'RSA': {'lat': -30.5595, 'lon': 22.9375},
        'Bahrain': {'lat': 26.0667, 'lon': 50.5577},
        'United Arab Emirates': {'lat': 23.4241, 'lon': 53.8478},
        'Malta': {'lat': 35.9375, 'lon': 14.3754},
        'Lithuania': {'lat': 55.1694, 'lon': 23.8813},
        'Czech Republic': {'lat': 49.8175, 'lon': 15.4730},
        'European Community': {'lat': 50.8503, 'lon': 4.3517},
        'Saudi Arabia': {'lat': 23.8859, 'lon': 45.0792}
    }

    # Tổng hợp theo quốc gia
    country_grp = df.groupby('Country').agg(
        revenue=('TotalAmount', 'sum'),
        orders=('Invoice', 'nunique'),
        customers=('Customer ID', 'nunique')
    ).reset_index()

    total_revenue = float(df['TotalAmount'].sum())
    total_orders = int(df['Invoice'].nunique())
    total_countries = int(df['Country'].nunique())

    # Tính tỷ lệ và sắp xếp doanh thu giảm dần
    country_grp['percentage'] = (country_grp['revenue'] / total_revenue) * 100
    country_grp = country_grp.sort_values(by='revenue', ascending=False)

    top_country = country_grp.iloc[0]['Country']
    intl_revenue = float(total_revenue - country_grp.iloc[0]['revenue'])
    intl_ratio = round((intl_revenue / total_revenue) * 100, 1)

    # Tạo danh sách các điểm cho quả địa cầu 3D
    globe_points = []
    max_rev = country_grp['revenue'].max()
    for _, row in country_grp.iterrows():
        c_name = row['Country']
        coords = geo_coords.get(c_name, {'lat': 0.0, 'lon': 0.0})
        # Kích thước chấm co giãn từ 8 đến 28
        size = 8 + int((row['revenue'] / max_rev) * 20)
        globe_points.append({
            'name': c_name,
            'lat': coords['lat'],
            'lon': coords['lon'],
            'rev': round(row['revenue'], 2),
            'orders': int(row['orders']),
            'percentage': round(row['percentage'], 2),
            'size': size
        })

    # Top 6 hiển thị bảng
    top_table = []
    for _, row in country_grp.head(6).iterrows():
        top_table.append({
            'country': row['Country'],
            'revenue': round(row['revenue'], 2),
            'percentage': round(row['percentage'], 1)
        })

    market_insights_cache = {
        'kpi': {
            'total_countries': total_countries,
            'top_country': top_country,
            'total_revenue_str': f"${round(total_revenue / 1_000_000, 2)}M USD",
            'intl_ratio_str': f"{intl_ratio}% Tổng Lượng"
        },
        'globe_points': globe_points,
        'top_table': top_table
    }
    return market_insights_cache

@app.get("/api/market-insights")
def api_market_insights():
    data = get_market_insights()
    if not data:
        return JSONResponse({"status": "error", "message": "Chưa tìm thấy file clean_online_retail.parquet"}, status_code=404)
    return JSONResponse(data)

# ---------------------------------------------------------
# API ROUTES SẴN CÓ
# ---------------------------------------------------------
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