import os
import time
import pandas as pd
import numpy as np

def clean_online_retail_data(excel_path: str, output_parquet: str = "clean_online_retail.parquet", output_csv: str = "clean_online_retail.csv"):
    start_time = time.time()
    print("=" * 65)
    print("🚀 BẮT ĐẦU QUY TRÌNH LÀM SẠCH DỮ LIỆU ONLINE RETAIL II (2 SHEETS)")
    print("=" * 65)

    if not os.path.exists(excel_path):
        raise FileNotFoundError(f"❌ Không tìm thấy file tại đường dẫn: {excel_path}")

    # 1. ĐỌC CẢ 2 SHEET VÀ NỐI LẠI (CONCAT)
    print(f"[*] Đang nạp dữ liệu từ: {excel_path}...")
    print("    (Đọc 2 sheet: 'Year 2009-2010' và 'Year 2010-2011')")
    
    # Chỉ định kiểu dữ liệu thô ban đầu để tối ưu đọc
    dtype_dict = {
        'Invoice': str,
        'StockCode': str,
        'Description': str,
        'Quantity': np.float64,
        'Price': np.float64,
        'Customer ID': float,
        'Country': str
    }

    try:
        sheets_dict = pd.read_excel(
            excel_path, 
            sheet_name=['Year 2009-2010', 'Year 2010-2011'], 
            dtype=dtype_dict,
            engine='openpyxl'
        )
        df_raw = pd.concat([sheets_dict['Year 2009-2010'], sheets_dict['Year 2010-2011']], ignore_index=True)
    except Exception as e:
        print(f"[!] Thử đọc toàn bộ sheet tự động do lỗi tên sheet: {e}")
        sheets_dict = pd.read_excel(excel_path, sheet_name=None, engine='openpyxl')
        df_raw = pd.concat(sheets_dict.values(), ignore_index=True)

    initial_rows = len(df_raw)
    print(f"✅ Đã tải thành công: {initial_rows:,} dòng dữ liệu thô.\n")

    # 2. BƯỚC 1: XỬ LÝ KHUYẾT THIẾU CUSTOMER ID
    # Với bài toán RFM & phân khúc AI, không có Customer ID thì không phân tích được
    print("[*] Bước 1: Lọc bỏ dòng thiếu 'Customer ID'...")
    df_step1 = df_raw.dropna(subset=['Customer ID']).copy()
    rows_dropped_na_cust = initial_rows - len(df_step1)
    print(f"    -> Đã loại bỏ {rows_dropped_na_cust:,} dòng không có Customer ID.")

    # 3. BƯỚC 2: XỬ LÝ ĐƠN HÀNG HỦY / HOÀN TRẢ
    # Các hóa đơn bắt đầu bằng 'C' (Cancellation) hoặc Quantity <= 0
    print("[*] Bước 2: Lọc bỏ các đơn hủy / hoàn trả (Quantity <= 0 hoặc Invoice bắt đầu bằng 'C')...")
    df_step1['Invoice'] = df_step1['Invoice'].astype(str).str.strip()
    is_cancellation = df_step1['Invoice'].str.startswith('C', na=False)
    is_invalid_qty = df_step1['Quantity'] <= 0
    df_step2 = df_step1[~(is_cancellation | is_invalid_qty)].copy()
    rows_dropped_cancel = len(df_step1) - len(df_step2)
    print(f"    -> Đã loại bỏ {rows_dropped_cancel:,} dòng đơn hủy và số lượng âm.")

    # 4. BƯỚC 3: XỬ LÝ ĐƠN GIÁ BẤT THƯỜNG (PRICE <= 0)
    print("[*] Bước 3: Lọc bỏ giao dịch có đơn giá không hợp lệ (Price <= 0)...")
    df_step3 = df_step2[df_step2['Price'] > 0].copy()
    rows_dropped_price = len(df_step2) - len(df_step3)
    print(f"    -> Đã loại bỏ {rows_dropped_price:,} dòng có Price <= 0.")

    # 5. BƯỚC 4: LỌC BỎ CÁC MÃ DỊCH VỤ / KẾ TOÁN (PHI HÀNG HÓA)
    # Ví dụ: POST (bưu phí), D (chiết khấu), M (thủ công), BANK CHARGES, AMAZON FEE,...
    print("[*] Bước 4: Lọc bỏ mã chi phí hệ thống/dịch vụ (POST, D, M, BANK CHARGES...)...")
    service_codes = {'POST', 'D', 'M', 'PADS', 'DOT', 'CRUK', 'BANK CHARGES', 'AMAZON FEE'}
    df_step3['StockCode'] = df_step3['StockCode'].astype(str).str.strip().str.upper()
    df_step4 = df_step3[~df_step3['StockCode'].isin(service_codes)].copy()
    rows_dropped_codes = len(df_step3) - len(df_step4)
    print(f"    -> Đã loại bỏ {rows_dropped_codes:,} dòng mã dịch vụ phi hàng hóa.")

    # 6. BƯỚC 5: CHUẨN HÓA KIỂU DỮ LIỆU & TẠO TRƯỜNG PHÁI SINH
    print("[*] Bước 5: Chuẩn hóa kiểu dữ liệu & tính 'TotalAmount'...")
    df_clean = df_step4.copy()
    df_clean['Customer ID'] = df_clean['Customer ID'].astype(np.int64) # Chuyển 12345.0 thành 12345
    df_clean['Quantity'] = df_clean['Quantity'].astype(np.int32)
    df_clean['Price'] = df_clean['Price'].astype(np.float32)
    df_clean['InvoiceDate'] = pd.to_datetime(df_clean['InvoiceDate'])
    df_clean['Country'] = df_clean['Country'].astype(str).str.strip()
    df_clean['Description'] = df_clean['Description'].astype(str).str.strip()

    # Tạo cột tổng tiền cho từng dòng
    df_clean['TotalAmount'] = (df_clean['Quantity'] * df_clean['Price']).round(2)

    # 7. XUẤT FILE ĐẦU RA
    final_rows = len(df_clean)
    print(f"\n[*] Đang lưu file dữ liệu sạch...")
    
    # Xuất định dạng Parquet (cực nhanh, dung lượng nén nhỏ, giữ nguyên kiểu dữ liệu)
    df_clean.to_parquet(output_parquet, index=False, engine='pyarrow')
    print(f"    -> Đã lưu Parquet: {output_parquet} (Dành cho FastAPI nạp siêu tốc)")

    # Xuất định dạng CSV (nếu muốn mở xem thủ công)
    df_clean.to_csv(output_csv, index=False, encoding='utf-8')
    print(f"    -> Đã lưu CSV: {output_csv}")

    elapsed_time = round(time.time() - start_time, 2)

    # 8. BÁO CÁO TỔNG KẾT
    total_revenue = df_clean['TotalAmount'].sum()
    unique_customers = df_clean['Customer ID'].nunique()
    unique_countries = df_clean['Country'].nunique()

    print("\n" + "=" * 65)
    print("📊 BÁO CÁO TỔNG KẾT QUÁ TRÌNH LÀM SẠCH (DATA CLEANING REPORT)")
    print("=" * 65)
    print(f"• Số dòng dữ liệu gốc          : {initial_rows:,} dòng")
    print(f"• Số dòng dữ liệu sạch còn lại : {final_rows:,} dòng ({round(final_rows/initial_rows * 100, 2)}%)")
    print(f"• Tổng số khách hàng hợp lệ    : {unique_customers:,} khách hàng")
    print(f"• Số lượng quốc gia có đơn     : {unique_countries} quốc gia")
    print(f"• Tổng doanh thu hợp lệ        : ${total_revenue:,.2f} USD")
    print(f"• Thời gian xử lý hoàn tất     : {elapsed_time} giây")
    print("=" * 65)

    return df_clean

if __name__ == "__main__":
    EXCEL_FILE = os.path.join("data", "online_retail_II.xlsx")
    OUTPUT_PARQUET = os.path.join("data", "clean_online_retail.parquet")
    OUTPUT_CSV = os.path.join("data", "clean_online_retail.csv")

    clean_online_retail_data(
        excel_path=EXCEL_FILE,
        output_parquet=OUTPUT_PARQUET,
        output_csv=OUTPUT_CSV
    )