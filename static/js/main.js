// ==============================================================
// 1. TÍNH NĂNG CHUYỂN TRANG MƯỢT MÀ SPA (Single Page Application)
// ==============================================================
function switchPage(event, pageId) {
    event.preventDefault(); 
    
    // Ẩn tất cả các khối nội dung
    document.querySelectorAll('.page-section').forEach(page => {
        page.classList.remove('active-page');
    });
    
    // Gỡ bỏ class active của toàn bộ các thẻ 'a' trong menu
    document.querySelectorAll('.sidebar .nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    // Hiển thị khối nội dung được chọn
    document.getElementById(pageId).classList.add('active-page');
    // Thêm class active vào thẻ 'a' vừa bấm
    event.currentTarget.classList.add('active');
    
    // Re-render Plotly chart (vì khi display:none Plotly có thể bị hụt kích thước)
    if(pageId === 'dashboard-page') {
        Plotly.Plots.resize(document.getElementById('featureImportanceChart'));
    }

    if (pageId === 'globe-page') {
        loadMarketInsightsAndGlobe();
    } else {
        stopGlobeRotation();
    }
}

// ==============================================================
// 2. KÍCH HOẠT CÁC THÀNH PHẦN GIAO DIỆN KHI TRANG TẢI XONG
// ==============================================================
document.addEventListener('DOMContentLoaded', () => {
    // Kích hoạt Bootstrap Tooltips
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));

    // Vẽ Biểu đồ Feature Importance ban đầu
    const impData = [{
        x: ['Recency', 'Frequency', 'Monetary'],
        y: [0.96, 0.02, 0.02],
        type: 'bar',
        marker: { color: ['#1f77b4', '#2ca02c', '#ff7f0e'] }
    }];
    const impLayout = {
        paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
        font: { color: '#f0f6fc' },
        margin: { t: 20, b: 30, l: 40, r: 20 },
        height: 300
    };
    Plotly.newPlot('featureImportanceChart', impData, impLayout, {responsive: true});

    // Gọi hàm lấy tin tức thời sự
    fetchLiveNews();

    fetchExpertQuotes();
});

// ==============================================================
// 3. XỬ LÝ ĐÓNG MỞ SIDEBAR MENU
// ==============================================================
const sidebar = document.getElementById('sidebar');
const mainContent = document.getElementById('mainContent');
const toggleInside = document.getElementById('toggleSidebarInside');
const toggleOutside = document.getElementById('toggleSidebarOutside');

function toggleMenu() { 
    sidebar.classList.toggle('collapsed'); 
    mainContent.classList.toggle('expanded'); 
}
if(toggleInside) toggleInside.addEventListener('click', toggleMenu); 
if(toggleOutside) toggleOutside.addEventListener('click', toggleMenu);

// ==============================================================
// 4. XỬ LÝ AJAX FORM CRM (DỰ BÁO KHÔNG REFRESH TRANG)
// ==============================================================
const crmForm = document.getElementById('crmForm');
if(crmForm) {
    const submitBtn = document.getElementById('submitBtn');
    const resultPlaceholder = document.getElementById('resultPlaceholder');
    const resultContent = document.getElementById('resultContent');

    crmForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Đang phân tích...';
        resultPlaceholder.style.display = "none";
        resultContent.innerHTML = `
            <div class="d-flex align-items-center text-info animate-fade-in mt-3">
                <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                <strong>Đang truyền tín hiệu vào XGBoost Engine...</strong>
            </div>`;
        document.getElementById('radarChart').innerHTML = '';

        const rVal = parseFloat(document.getElementById('recency').value);
        const fVal = parseFloat(document.getElementById('frequency').value);
        const mVal = parseFloat(document.getElementById('monetary').value);

        const formData = new URLSearchParams();
        formData.append('recency', rVal); formData.append('frequency', fVal); formData.append('monetary', mVal);

        try {
            const response = await fetch('/predict-single-json', {
                method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: formData
            });
            const data = await response.json();

            if (response.ok) {
                let alertClass = data.code === 2 ? 'alert-success border-success' : (data.code === 1 ? 'alert-danger border-danger' : 'alert-info border-info');
                let iconClass = data.code === 2 ? 'fa-crown' : (data.code === 1 ? 'fa-triangle-exclamation' : 'fa-user-check');
                
                resultContent.innerHTML = `
                    <div class="alert ${alertClass} animate-fade-in shadow-sm border-start border-4 mt-2">
                        <h4 class="alert-heading fw-bold mb-2"><i class="fa-solid ${iconClass}"></i> ${data.segment}</h4>
                        <p class="mb-0 text-dark"><strong><i class="fa-solid fa-chess-knight"></i> Chiến thuật đề xuất:</strong> ${data.strategy}</p>
                    </div>
                `;

                const radarData = [{
                    type: 'scatterpolar', r: [rVal, fVal, mVal], theta: ['Recency', 'Frequency', 'Monetary'],
                    fill: 'toself', name: 'Hồ sơ', marker: { color: data.code === 2 ? '#2ca02c' : (data.code === 1 ? '#d62728' : '#1f77b4') }
                }];
                const radarLayout = {
                    polar: { radialaxis: { visible: true, range: [0, Math.max(rVal, fVal, mVal) * 1.2], color: '#6c757d' }, angularaxis: { color: '#f0f6fc' }, bgcolor: 'transparent' },
                    paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', font: { color: '#f0f6fc' },
                    margin: { t: 20, b: 20, l: 30, r: 30 }, height: 260, showlegend: false
                };
                Plotly.newPlot('radarChart', radarData, radarLayout, {responsive: true});

            } else {
                resultContent.innerHTML = `<div class="alert alert-danger animate-fade-in">Lỗi: ${data.error}</div>`;
            }
        } catch (error) {
            resultContent.innerHTML = `<div class="alert alert-danger animate-fade-in"><i class="fa-solid fa-plug-circle-xmark"></i> Mất kết nối máy chủ AI!</div>`;
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-rocket"></i> Kết xuất Chiến lược AI';
        }
    });
}

// ==============================================================
// 5. CÀO TIN TỨC THỜI SỰ KINH TẾ (CÓ HỆ THỐNG DỰ PHÒNG FALLBACK)
// ==============================================================
async function fetchLiveNews() {
    const tickerContent = document.getElementById('newsTickerContent');
    if(!tickerContent) return;
    
    // TIN TỨC DỰ PHÒNG (Sẽ hiện ra nếu API bị chặn hoặc mất mạng)
    const fallbackNews = [
        { title: "Thị trường Thương mại Điện tử toàn cầu dự kiến đạt 8.1 nghìn tỷ USD vào năm 2026.", type: "HOT", color: "bg-danger" },
        { title: "Ứng dụng AI (XGBoost) trong phân tích khách hàng giúp tăng 35% doanh thu.", type: "CÔNG NGHỆ", color: "bg-primary" },
        { title: "Ngân hàng Trung ương (FED) giữ nguyên lãi suất, chứng khoán phản ứng tích cực.", type: "KINH TẾ", color: "bg-warning text-dark" },
        { title: "Vốn đầu tư toàn cầu đổ mạnh vào các Startup cung cấp giải pháp MLOps.", type: "TÀI CHÍNH", color: "bg-success" }
    ];

    // Hàm render HTML cho thanh tin tức
    const renderHTML = (articles, isFallback = false) => {
        let htmlContent = '';
        articles.forEach((item, index) => {
            const badges = ['bg-danger', 'bg-primary', 'bg-warning text-dark', 'bg-success', 'bg-info text-dark'];
            const badgeClass = isFallback ? item.color : badges[index % badges.length];
            const typeText = isFallback ? item.type : "MỚI NHẤT";
            
            htmlContent += `
                <span class="ticker-item" onclick="window.open('${item.link || '#'}', '_blank')">
                    <span class="badge ${badgeClass}">${typeText}</span> 
                    ${item.title}
                </span>
            `;
        });
        tickerContent.innerHTML = htmlContent;
    };

    // Gọi API RSS
    const rssUrl = 'https://vneconomy.vn/rss/tai-chinh.rss'; 
    const apiEndpoint = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;

    try {
        const response = await fetch(apiEndpoint);
        const data = await response.json();
        
        if (data.status === 'ok' && data.items.length > 0) {
            renderHTML(data.items.slice(0, 8)); // Hiện tin thật
        } else {
            renderHTML(fallbackNews, true); // Lỗi data -> Hiện tin dự phòng
        }
    } catch (error) {
        console.log("Bị chặn API, chuyển sang chế độ Tin tức dự phòng (Fallback).");
        renderHTML(fallbackNews, true); // Rớt mạng -> Hiện tin dự phòng
    }
}
// ==============================================================
// 5. CÀO TIN TỨC THỜI SỰ KINH TẾ QUỐC TẾ (REAL-TIME CNBC RSS)
// ==============================================================
async function fetchLiveNews() {
    const tickerContent = document.getElementById('newsTickerContent');
    if(!tickerContent) return;
    
    // TIN TỨC DỰ PHÒNG (Khi rớt mạng)
    const fallbackNews = [
        { title: "Global e-commerce market expected to reach $8.1 trillion by 2026.", type: "HOT", color: "bg-danger" },
        { title: "AI application (XGBoost) in customer segmentation increases revenue by 35%.", type: "TECHNOLOGY", color: "bg-primary" },
        { title: "US Federal Reserve maintains interest rates, tech stocks react positively.", type: "ECONOMY", color: "bg-warning text-dark" },
        { title: "Global investment capital pours heavily into MLOps solution startups.", type: "FINANCE", color: "bg-success" }
    ];

    const renderHTML = (articles, isFallback = false) => {
        let htmlContent = '';
        articles.forEach((item, index) => {
            const badges = ['bg-danger', 'bg-primary', 'bg-warning text-dark', 'bg-success', 'bg-info text-dark'];
            const badgeClass = isFallback ? item.color : badges[index % badges.length];
            // Đổi chữ MỚI NHẤT thành LATEST cho đồng bộ tiếng Anh
            const typeText = isFallback ? item.type : "LATEST"; 
            
            htmlContent += `
                <span class="ticker-item" onclick="window.open('${item.link || '#'}', '_blank')">
                    <span class="badge ${badgeClass}">${typeText}</span> 
                    ${item.title}
                </span>
            `;
        });
        tickerContent.innerHTML = htmlContent;
    };

    // Đổi sang RSS của hãng thông tấn Mỹ CNBC (Chuyên trang Tài chính, Kinh doanh toàn cầu)
    const rssUrl = 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10001147'; 
    const apiEndpoint = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;

    try {
        const response = await fetch(apiEndpoint);
        const data = await response.json();
        
        if (data.status === 'ok' && data.items.length > 0) {
            console.log("✅ Đã lấy thành công tin tức thật từ CNBC!");
            renderHTML(data.items.slice(0, 8)); 
        } else {
            console.warn("⚠️ API trả về lỗi, hệ thống tự động chuyển sang tin dự phòng.", data);
            renderHTML(fallbackNews, true);
        }
    } catch (error) {
        console.error("❌ Mất kết nối hoặc bị chặn API, bật chế độ Fallback:", error);
        renderHTML(fallbackNews, true); 
    }
}

// ==============================================================
// 6. QUẢ ĐỊA CẦU 3D (CANVAS + D3-GEO) + BẢNG THỊ TRƯỜNG TỪ API THẬT
//    - Kéo chuột: xoay | Lăn chuột: zoom | Nhấp đúp: về cỡ ban đầu
//    - Dữ liệu cập nhật vào quả cầu đang chạy, KHÔNG dựng lại -> không phập phồng
// ==============================================================
const GLOBE_SPEED = 10;          // độ / giây
const GLOBE_FILL = 0.86;         // quả cầu chiếm 86% cạnh ngắn của khung
const GLOBE_MIN_ZOOM = 0.6;
const GLOBE_MAX_ZOOM = 4;
const GLOBE_LABEL_FADE_MS = 400;    // thời gian fade-in khi bản đồ vừa tải xong
const GLOBE_LABEL_FONT_PX = 11;     // cỡ chữ gốc dùng để đo độ rộng tên (chữ thật co giãn nhẹ theo zoom)
const GLOBE_LABEL_FIT = 0.22;       // nước có bề ngang >= 22% độ rộng tên mới được gắn nhãn (nước càng nhỏ càng cần zoom sâu)

const globeState = {
    inited: false, running: false, raf: null, last: null,
    container: null, canvas: null, ctx: null, tip: null, ro: null,
    proj: null, path: null, graticule: null,
    land: null, borders: null,
    countries: [],               // dữ liệu thật từ /api/market-insights
    w: 0, h: 0, dpr: 1, base: 100,
    zoom: 1, zoomTarget: 1, lon: 10, lat: 20,
    labelAlpha: 0,
    countryLabels: [],           // tên + tâm + diện tích của MỌI quốc gia trên bản đồ
    dragging: false, dragX: 0, dragY: 0, resumeAt: 0,
    markers: [],

    selectedCountry: null,
    hudAlpha: 0,
    hudTargetAlpha: 0
};

// --- BẢNG ÁNH XẠ TÊN QUỐC GIA -> MÃ ISO ĐỂ LẤY CỜ EMOJI ---
const COUNTRY_CODES = {
    'United Kingdom': 'GB', 'EIRE': 'IE', 'Germany': 'DE', 'France': 'FR', 'Netherlands': 'NL',
    'Australia': 'AU', 'Spain': 'ES', 'Switzerland': 'CH', 'Belgium': 'BE', 'Sweden': 'SE',
    'Japan': 'JP', 'Portugal': 'PT', 'USA': 'US', 'Norway': 'NO', 'Italy': 'IT',
    'Channel Islands': 'JE', 'Finland': 'FI', 'Cyprus': 'CY', 'Austria': 'AT', 'Denmark': 'DK',
    'Poland': 'PL', 'Greece': 'GR', 'Singapore': 'SG', 'Lebanon': 'LB', 'Canada': 'CA',
    'Israel': 'IL', 'Iceland': 'IS', 'Brazil': 'BR', 'RSA': 'ZA', 'Bahrain': 'BH',
    'United Arab Emirates': 'AE', 'Malta': 'MT', 'Lithuania': 'LT', 'Czech Republic': 'CZ',
    'European Community': 'EU', 'Saudi Arabia': 'SA'
};

// Hàm chuyển mã Alpha-2 (vd: 'GB') thành Emoji cờ (🇬🇧)
function getFlagEmoji(countryName) {
    const code = COUNTRY_CODES[countryName];
    if (!code) return '🌐'; // Fallback nếu không có
    return code.toUpperCase().replace(/./g, char => String.fromCodePoint(char.charCodeAt(0) + 127397));
}

let globeRetry = 0;
let globeFetchTimer = null;

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, ch => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
    ));
}

function stopGlobeRotation() {
    globeState.running = false;
    if (globeState.raf) {
        cancelAnimationFrame(globeState.raf);
        globeState.raf = null;
    }
}

// ---------- Tải dữ liệu thị trường thật + cập nhật KPI + đẩy dữ liệu vào quả cầu ----------
function loadMarketInsightsAndGlobe() {
    // Dựng khung quả cầu NGAY (không chờ API) để người dùng thấy nó xoay liền
    renderGlobe3D();

    clearTimeout(globeFetchTimer);
    fetch('/api/market-insights', { cache: 'no-store' })
        .then(res => {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.json();
        })
        .then(resData => {
            if (!resData || !Array.isArray(resData.globe_points)) return;
            globeRetry = 0;

            // 1. CẬP NHẬT 4 THẺ KPI TRÊN GIAO DIỆN (Nếu có gắn ID)
            const k = resData.kpi || {};
            const elCountries = document.getElementById('kpiTotalCountries');
            const elTopCountry = document.getElementById('kpiTopCountry');
            const elTotalRev = document.getElementById('kpiTotalRevenue');
            const elIntlRatio = document.getElementById('kpiIntlRatio');

            if (elCountries && k.total_countries !== undefined) elCountries.innerText = `${k.total_countries} Quốc Gia`;
            if (elTopCountry && k.top_country !== undefined) elTopCountry.innerText = k.top_country;
            if (elTotalRev && k.total_revenue_str !== undefined) elTotalRev.innerText = k.total_revenue_str;
            if (elIntlRatio && k.intl_ratio_str !== undefined) elIntlRatio.innerText = k.intl_ratio_str;

            // 2. ĐẨY DATA THẬT VÀO QUẢ ĐỊA CẦU
            renderGlobeWithData(resData.globe_points);
        })
        .catch(err => {
            console.error('Lỗi khi tải dữ liệu thị trường:', err);
            // Thử lại tối đa 3 lần (cách nhau 3s, 6s, 9s), và chỉ khi đang ở trang quả địa cầu
            const page = document.getElementById('globe-page');
            if (globeRetry < 3 && page && page.classList.contains('active-page')) {
                globeRetry++;
                globeFetchTimer = setTimeout(loadMarketInsightsAndGlobe, 3000 * globeRetry);
            }
        });
}

function renderGlobeWithData(countries) {
    // Chuẩn hóa dữ liệu 1 lần ở đây, lúc vẽ không phải tính lại
    const clean = countries
        .filter(c => c && isFinite(c.lat) && isFinite(c.lon))
        .map(c => {
            const pct = Number(c.percentage) || 0;
            return {
                name: String(c.name),
                lat: Number(c.lat),
                lon: Number(c.lon),
                rev: Number(c.rev) || 0,
                percentage: pct,
                size: Math.max(6, Math.min(40, Number(c.size) || 10)),
                color: pct > 50 ? '#2CA02C' : (pct > 2 ? '#1f77b4' : '#ff7f0e')
            };
        })
        .sort((a, b) => b.size - a.size);   // chấm lớn vẽ trước, chấm nhỏ nằm trên -> luôn rê chuột vào được

    globeState.countries = clean;
    if (!globeState.inited) renderGlobe3D();
}

// ---------- Canvas: kích thước, vẽ, vòng lặp ----------
function globeResize() {
    const s = globeState;
    const w = s.container.clientWidth;
    const h = s.container.clientHeight;
    if (!w || !h) return false;                       // trang đang ẩn
    const dpr = window.devicePixelRatio || 1;
    if (w === s.w && h === s.h && dpr === s.dpr) return true;

    s.w = w; s.h = h; s.dpr = dpr;
    s.canvas.width = Math.round(w * dpr);
    s.canvas.height = Math.round(h * dpr);
    s.canvas.style.width = w + 'px';
    s.canvas.style.height = h + 'px';
    s.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    s.base = Math.min(w, h) / 2 * GLOBE_FILL;         // bán kính gốc luôn vừa khung
    s.proj.translate([w / 2, h / 2]);
    return true;
}

function globeDraw() {
    const s = globeState, ctx = s.ctx, proj = s.proj, path = s.path;
    const cx = s.w / 2, cy = s.h / 2, r = s.base * s.zoom;

    proj.scale(r).rotate([-s.lon, -s.lat]);
    ctx.clearRect(0, 0, s.w, s.h);

    // Đại dương (hình cầu)
    ctx.beginPath(); path({ type: 'Sphere' });
    const ocean = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
    ocean.addColorStop(0, '#0d1420');
    ocean.addColorStop(1, '#05080e');
    ctx.fillStyle = ocean;
    ctx.fill();

    // Lưới kinh vĩ tuyến mờ
    ctx.beginPath(); path(s.graticule);
    ctx.strokeStyle = 'rgba(59, 74, 94, 0.18)';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Đất liền + đường bờ biển
    if (s.land) {
        ctx.beginPath(); path(s.land);
        ctx.fillStyle = '#161d27';
        ctx.fill();
        ctx.strokeStyle = 'rgba(46, 160, 67, 0.4)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
    }

    // Biên giới quốc gia
    if (s.borders) {
        ctx.beginPath(); path(s.borders);
        ctx.strokeStyle = 'rgba(46, 160, 67, 0.75)';
        ctx.lineWidth = 0.6;
        ctx.stroke();
    }

    // Đổ bóng nhẹ ở rìa để có cảm giác khối cầu
    ctx.beginPath(); path({ type: 'Sphere' });
    const shade = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.25, r * 0.2, cx, cy, r);
    shade.addColorStop(0, 'rgba(255,255,255,0.04)');
    shade.addColorStop(1, 'rgba(0,0,0,0.38)');
    ctx.fillStyle = shade;
    ctx.fill();

    // Viền quả cầu phát sáng nhẹ
    ctx.save();
    ctx.shadowColor = 'rgba(44, 160, 44, 0.35)';
    ctx.shadowBlur = 16;
    ctx.strokeStyle = '#3b4a5e';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); path({ type: 'Sphere' });
    ctx.stroke();
    ctx.restore();

    // -------------------------------------------------------------
    // CÁC CHẤM QUỐC GIA + NHÃN TÊN (nhãn fade-in khi zoom vào, fade-out khi zoom ra)
    // -------------------------------------------------------------
    const center = [s.lon, s.lat];
    s.markers = [];
    const labels = [];

    for (const c of s.countries) {
        const dist = d3.geoDistance(center, [c.lon, c.lat]);
        if (dist >= Math.PI / 2 - 0.02) continue;            // nằm ở mặt sau quả cầu
        const p = proj([c.lon, c.lat]);
        if (!p || isNaN(p[0]) || isNaN(p[1])) continue;
        const rad = c.size / 2;

        ctx.save();                                           // bọc riêng để style không rò sang chấm khác
        ctx.beginPath();
        ctx.arc(p[0], p[1], rad, 0, Math.PI * 2);
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = c.color;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
        ctx.restore();

        s.markers.push({ c, x: p[0], y: p[1], r: rad });
        labels.push({ c, x: p[0], y: p[1], rad, dist });
    }

    // -------------------------------------------------------------
    // NHÃN TÊN QUỐC GIA (mọi nước trên bản đồ) - vẽ SAU các chấm để chữ nằm trên cùng
    //  * Nước lớn hiện ngay; nước nhỏ chỉ hiện khi zoom đủ sâu, mờ dần vào/ra theo kích thước trên màn hình
    //  * Tên không đè nhau, né các chấm dữ liệu, mờ dần khi gần rìa quả cầu
    // -------------------------------------------------------------
    const smooth = (v) => { v = Math.min(1, Math.max(0, v)); return v * v * (3 - 2 * v); };
    const fs = Math.min(13, Math.max(10, 10 + (s.zoom - 1) * 1.5));   // chữ to dần nhẹ khi zoom
    const th = fs + 1;
    const queue = [];                                                  // đã xếp theo ưu tiên: nước lớn trước

    if (s.countryLabels.length) {
        const fade = smooth(s.labelAlpha);
        if (fade > 0.02) {
            for (const f of s.countryLabels) {
                const dist = d3.geoDistance(center, [f.lon, f.lat]);
                if (dist >= Math.PI / 2 - 0.05) continue;
                const facing = Math.min(1, (Math.PI / 2 - dist) / 0.35);
                const tw = f.tw * fs / GLOBE_LABEL_FONT_PX;
                const onScreen = Math.sqrt(f.area) * r;                // bề ngang gần đúng của nước trên màn hình (px)
                const lod = smooth((onScreen / tw - GLOBE_LABEL_FIT) / 0.12);
                const a = fade * facing * lod;
                if (a < 0.02) continue;
                const p = proj([f.lon, f.lat]);
                if (!p || isNaN(p[0]) || isNaN(p[1])) continue;
                queue.push({ name: f.name, x: p[0], y: p[1], tw, a, dot: null });
            }
        }
    } else {
        // Dự phòng (bản đồ không có tên nước): chỉ gắn tên cho các chấm dữ liệu, hiện dần khi zoom vào
        const zA = smooth((s.zoom - 1.15) / 0.15);
        if (zA > 0.02) {
            ctx.save();
            ctx.font = `bold ${fs}px "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;
            for (const L of labels) {
                const facing = Math.min(1, Math.max(0, (Math.PI / 2 - L.dist) / 0.35));
                const a = zA * facing;
                if (a < 0.02) continue;
                queue.push({ name: L.c.name, x: L.x, y: L.y, tw: ctx.measureText(L.c.name).width, a, dot: L });
            }
            ctx.restore();
        }
    }

    if (queue.length) {
        ctx.save();
        ctx.font = `bold ${fs}px "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.lineJoin = 'round';

        // Các chấm dữ liệu là vật cản: nhãn không được đè lên chúng
        const placed = s.markers.map(m => [m.x - m.r - 1, m.y - m.r - 1, m.x + m.r + 1, m.y + m.r + 1]);
        const overlaps = (box) => placed.some(q => box[0] < q[2] && box[2] > q[0] && box[1] < q[3] && box[3] > q[1]);

        for (const Q of queue) {
            // Nước nào có chấm dữ liệu ngay tâm thì đặt tên ngay dưới (hoặc trên) chấm đó
            const dot = Q.dot || s.markers.find(m => Math.hypot(m.x - Q.x, m.y - Q.y) < m.r + 12) || null;
            const lx = dot ? dot.x : Q.x;
            const spots = dot ? [dot.y + dot.r + 4, dot.y - dot.r - 4 - th] : [Q.y - th / 2];

            let ty = null;
            for (const y of spots) {
                const box = [lx - Q.tw / 2 - 2, y - 1, lx + Q.tw / 2 + 2, y + th + 1];
                if (!overlaps(box)) { ty = y; placed.push(box); break; }
            }
            if (ty === null) continue;

            ctx.globalAlpha = Q.a;
            ctx.lineWidth = 2.5;
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';               // viền đen để chữ không chìm vào nền
            ctx.strokeText(Q.name, lx, ty);
            ctx.fillStyle = '#e6edf3';
            ctx.fillText(Q.name, lx, ty);
        }
        ctx.restore();
    }

    if (s.hudAlpha > 0.01 && s.selectedCountry) {
        const c = s.selectedCountry;
        
        // Tính vị trí chấm đang được chọn trên màn hình
        const p = proj([c.lon, c.lat]);
        
        // Nếu điểm đó khuất ở mặt sau, ẩn HUD đi (hoặc làm mờ)
        const distToCenter = d3.geoDistance(center, [c.lon, c.lat]);
        const isVisible = (distToCenter < Math.PI / 2 - 0.02) && p && !isNaN(p[0]);

        if (isVisible) {
            ctx.save();
            ctx.globalAlpha = s.hudAlpha;
            
            // Tọa độ gốc (ngay chấm)
            const sx = p[0];
            const sy = p[1];
            
            // Tọa độ bảng HUD (kéo xiên lên phía trên bên phải màn hình)
            // Cố định bảng lệch so với tâm quả cầu để không bị che khuất
            const targetX = sx > cx ? sx - 220 : sx + 80;
            const targetY = sy > cy ? sy - 150 : sy - 80;
            
            // 1. Vẽ tia Laser (Đường nối từ chấm tới bảng HUD)
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx, sy - 20); // Đi thẳng lên một chút
            ctx.lineTo(targetX, targetY); // Xiên ra bảng
            ctx.strokeStyle = 'rgba(46, 160, 67, 0.8)'; // Xanh neon
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 4]); // Nét đứt mang cảm giác công nghệ
            ctx.stroke();
            ctx.setLineDash([]); // Reset nét đứt

            // 2. Vẽ bảng HUD chính (Hologram Box)
            const boxWidth = 200;
            const boxHeight = 110;
            
            // Khung nền trong suốt
            ctx.beginPath();
            ctx.rect(targetX, targetY - boxHeight / 2, boxWidth, boxHeight);
            ctx.fillStyle = 'rgba(5, 8, 14, 0.85)'; // Đen mờ
            ctx.fill();
            
            // Viền phát sáng 
            ctx.lineWidth = 1;
            ctx.strokeStyle = 'rgba(46, 160, 67, 0.9)';
            ctx.shadowColor = 'rgba(46, 160, 67, 1)';
            ctx.shadowBlur = 10;
            ctx.stroke();
            
            // 4 góc ngắm (Corner brackets) phong cách Sci-Fi
            ctx.shadowBlur = 0;
            ctx.lineWidth = 2;
            const cornerSize = 10;
            const yTop = targetY - boxHeight / 2;
            const yBot = targetY + boxHeight / 2;
            
            ctx.beginPath();
            // Góc trên trái
            ctx.moveTo(targetX, yTop + cornerSize); ctx.lineTo(targetX, yTop); ctx.lineTo(targetX + cornerSize, yTop);
            // Góc trên phải
            ctx.moveTo(targetX + boxWidth - cornerSize, yTop); ctx.lineTo(targetX + boxWidth, yTop); ctx.lineTo(targetX + boxWidth, yTop + cornerSize);
            // Góc dưới phải
            ctx.moveTo(targetX + boxWidth, yBot - cornerSize); ctx.lineTo(targetX + boxWidth, yBot); ctx.lineTo(targetX + boxWidth - cornerSize, yBot);
            // Góc dưới trái
            ctx.moveTo(targetX + cornerSize, yBot); ctx.lineTo(targetX, yBot); ctx.lineTo(targetX, yBot - cornerSize);
            ctx.stroke();

            // 3. Đổ Text vào HUD
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            
            // Lấy cờ quốc gia
            const flag = getFlagEmoji(c.name);

            // Tên quốc gia (Vàng cam) + Cờ
            ctx.font = 'bold 15px "Segoe UI", Roboto, sans-serif';
            ctx.fillStyle = '#ff9a2e';
            ctx.fillText(`${flag}  ${c.name.toUpperCase()}`, targetX + 15, yTop + 15);
            
            // Line gạch ngang nhỏ
            ctx.beginPath();
            ctx.moveTo(targetX + 15, yTop + 35);
            ctx.lineTo(targetX + 80, yTop + 35);
            ctx.strokeStyle = '#3b4a5e';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Thông số
            ctx.font = '12px "Segoe UI", Roboto, sans-serif';
            ctx.fillStyle = '#8b949e';
            ctx.fillText("DOANH THU:", targetX + 15, yTop + 45);
            ctx.fillText("TỶ TRỌNG:", targetX + 15, yTop + 65);
            ctx.fillText("SỐ ĐƠN:", targetX + 15, yTop + 85);
            
            // Giá trị
            ctx.font = 'bold 12px "Segoe UI", Roboto, sans-serif';
            ctx.fillStyle = '#f0f6fc';
            ctx.fillText(`$${c.rev.toLocaleString()}`, targetX + 90, yTop + 45);
            ctx.fillText(`${c.percentage.toFixed(1)}%`, targetX + 90, yTop + 65);
            ctx.fillStyle = '#58a6ff';
            ctx.fillText((c.orders || 0).toLocaleString(), targetX + 90, yTop + 85);

            ctx.restore();
        }
    }    
}

function globeFrame(ts) {
    const s = globeState;
    if (!s.running) return;
    s.raf = requestAnimationFrame(globeFrame);

    if (!s.container.offsetParent || !globeResize()) { s.last = null; return; }

    if (s.last === null) s.last = ts;
    const dt = Math.min(ts - s.last, 100);
    s.last = ts;

    if (!s.dragging && ts >= s.resumeAt) {
        s.lon = (s.lon + GLOBE_SPEED * dt / 1000) % 360;
    }

    // Zoom mượt: tiến dần tới mức zoom đích thay vì nhảy bậc theo từng nấc lăn chuột
    s.zoom += (s.zoomTarget - s.zoom) * (1 - Math.exp(-dt / 90));
    s.hudAlpha += (s.hudTargetAlpha - s.hudAlpha) * (1 - Math.exp(-dt / 150));
    if (Math.abs(s.zoomTarget - s.zoom) < 0.0005) s.zoom = s.zoomTarget;

    // Tên quốc gia: fade-in mượt ngay khi dữ liệu bản đồ tải xong (phần fade theo zoom nằm trong globeDraw)
    if (s.countryLabels.length) s.labelAlpha = Math.min(1, s.labelAlpha + dt / GLOBE_LABEL_FADE_MS);

    globeDraw();
}

function startGlobeRotation() {
    if (globeState.running) return;            // đã chạy rồi thì thôi, không khởi động lại
    globeState.running = true;
    globeState.last = null;
    globeState.raf = requestAnimationFrame(globeFrame);
}

// Điểm đặt tên của một nước: tâm của mảnh đất LỚN NHẤT (tránh bị kéo lệch bởi các đảo xa, vd. Alaska/Hawaii của Mỹ)
function geoLabelPoint(f) {
    let g = f;
    if (f.geometry && f.geometry.type === 'MultiPolygon') {
        let bestArea = -1;
        for (const coords of f.geometry.coordinates) {
            const poly = { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: coords } };
            const area = d3.geoArea(poly);
            if (area > bestArea) { bestArea = area; g = poly; }
        }
    }
    return d3.geoCentroid(g);
}

function globeLoadWorld() {
    const s = globeState;
    const urls = [
        'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json',
        'https://cdn.plot.ly/world_110m.json'
    ];
    const tryLoad = (n) => {
        if (n >= urls.length) return;
        fetch(urls[n])
            .then(r => r.json())
            .then(world => {
                s.land = topojson.feature(world, world.objects.land);
                s.borders = topojson.mesh(world, world.objects.countries, (a, b) => a !== b);

                // Tên từng quốc gia (world-atlas có sẵn properties.name). Lỗi ở đây không làm mất đất liền/biên giới.
                try {
                    const ctx = s.ctx;
                    ctx.save();
                    ctx.font = `bold ${GLOBE_LABEL_FONT_PX}px "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;
                    s.countryLabels = topojson.feature(world, world.objects.countries).features
                        .filter(f => f.geometry && f.properties && f.properties.name)
                        .map(f => {
                            const c = geoLabelPoint(f);
                            return {
                                name: f.properties.name,
                                lon: c[0], lat: c[1],
                                area: d3.geoArea(f),
                                tw: ctx.measureText(f.properties.name).width
                            };
                        })
                        .filter(f => isFinite(f.lon) && isFinite(f.lat) && f.area > 0)
                        .sort((a, b) => b.area - a.area);        // nước lớn xếp trước = được ưu tiên đặt tên
                    ctx.restore();
                } catch (e) {
                    s.countryLabels = [];
                }
            })
            .catch(() => tryLoad(n + 1));
    };
    tryLoad(0);
}

function globeBindEvents() {
    const s = globeState, el = s.container;

    // Kéo chuột / vuốt để xoay
    el.addEventListener('pointerdown', (e) => {
        s.dragging = true;
        s.dragX = e.clientX; s.dragY = e.clientY;
        el.setPointerCapture(e.pointerId);
        if (s.tip) s.tip.style.display = 'none'; 
        s.hudTargetAlpha = 0; 
        el.style.cursor = 'grabbing';
    });

    el.addEventListener('pointermove', (e) => {
        const rect = el.getBoundingClientRect();
        const mx = e.clientX - rect.left, my = e.clientY - rect.top;

        if (s.dragging) {
            const k = (180 / Math.PI) / (s.base * s.zoom);   // px -> độ (khớp tốc độ tay với bề mặt)
            s.lon -= (e.clientX - s.dragX) * k;
            s.lat = Math.max(-90, Math.min(90, s.lat + (e.clientY - s.dragY) * k));
            s.dragX = e.clientX; s.dragY = e.clientY;
            return;
        }

        // Tooltip khi rê vào chấm quốc gia (duyệt từ chấm nằm trên cùng)
        let hit = null;
        for (let j = s.markers.length - 1; j >= 0; j--) {
            const m = s.markers[j];
            if (Math.hypot(mx - m.x, my - m.y) <= m.r + 3) { hit = m; break; }
        }
        if (hit) {
            const c = hit.c;
            s.tip.innerHTML = `<b>${escapeHtml(c.name)}</b><br>Doanh Thu: $${c.rev.toLocaleString()} USD<br>Tỷ trọng: ${c.percentage}%`;
            s.tip.style.display = 'block';
            const tw = s.tip.offsetWidth, th = s.tip.offsetHeight;
            let tx = mx + 14, ty = my + 14;
            if (tx + tw > s.w) tx = mx - tw - 14;
            if (ty + th > s.h) ty = my - th - 14;
            s.tip.style.left = Math.max(0, tx) + 'px';
            s.tip.style.top = Math.max(0, ty) + 'px';
            el.style.cursor = 'pointer';
        } else {
            s.tip.style.display = 'none';
            el.style.cursor = 'grab';
        }
    });

    const endDrag = (e) => {
        // Xử lý khi click vào 1 chấm (HUD) - Chỉ tính là click nếu chuột không di chuyển xa
        if (e && e.type === 'pointerup') {
            const dragDist = Math.hypot(e.clientX - s.dragX, e.clientY - s.dragY);
            if (dragDist < 5) { 
                const rect = el.getBoundingClientRect();
                const mx = e.clientX - rect.left, my = e.clientY - rect.top;
                
                let clickedMarker = null;
                for (let j = s.markers.length - 1; j >= 0; j--) {
                    const m = s.markers[j];
                    if (Math.hypot(mx - m.x, my - m.y) <= m.r + 8) { 
                        clickedMarker = m; break; 
                    }
                }

                if (clickedMarker) {
                    s.selectedCountry = clickedMarker.c;
                    s.hudTargetAlpha = 1; // Hiện HUD
                    
                    // -- HIỆU ỨNG FOCUS ZOOM: Xoay về tâm & Zoom sát vào --
                    s.lon = clickedMarker.c.lon;
                    s.lat = clickedMarker.c.lat;
                    s.zoomTarget = 2.2;  // Mức zoom đẹp để hiện rõ khu vực
                    
                } else {
                    s.hudTargetAlpha = 0; // Tắt HUD 
                    s.selectedCountry = null;
                    
                    // -- NHẢ ZOOM: Quay lại góc nhìn toàn cảnh --
                    s.zoomTarget = 1.0; 
                }
            }
        }

        if (!s.dragging) return;
        s.dragging = false;
        s.resumeAt = performance.now() + 1200;
        el.style.cursor = 'grab';
    };
    
    el.addEventListener('pointerup', endDrag);
    el.addEventListener('pointercancel', endDrag);
    el.addEventListener('pointerleave', () => { if (!s.dragging && s.tip) s.tip.style.display = 'none'; });

    // =========================================================
    // LĂN BÁNH XE CHUỘT (WHEEL) ĐỂ PHÓNG TO / THU NHỎ
    // =========================================================
    el.addEventListener('wheel', (e) => {
        e.preventDefault(); 
        
        s.zoomTarget = Math.max(GLOBE_MIN_ZOOM, Math.min(GLOBE_MAX_ZOOM, s.zoomTarget * Math.exp(-e.deltaY * 0.0015)));
        
        // Tự tắt HUD và nhả cờ chọn khi người dùng chủ động lăn chuột
        if (s.hudTargetAlpha > 0) {
            s.hudTargetAlpha = 0; 
            s.selectedCountry = null; 
        }
    }, { passive: false });

    // =========================================================
    // NHẤP ĐÚP CHUỘT (DBLCLICK) ĐỂ RESET VỀ BAN ĐẦU
    // =========================================================
    el.addEventListener('dblclick', () => { 
        s.zoomTarget = 1.0; 
        s.hudTargetAlpha = 0;
        s.selectedCountry = null;
    });
}

function renderGlobe3D() {
    const s = globeState;
    const container = document.getElementById('globe3DChart');
    if (!container) return;

    if (!s.inited) {
        container.innerHTML = '';
        container.style.position = 'relative';
        container.style.overflow = 'hidden';
        container.style.touchAction = 'none';
        container.style.cursor = 'grab';

        const canvas = document.createElement('canvas');
        canvas.style.cssText = 'position:absolute;top:0;left:0;display:block;';
        container.appendChild(canvas);

        const tip = document.createElement('div');
        tip.style.cssText = 'position:absolute;display:none;pointer-events:none;z-index:5;' +
            'background:rgba(22,26,34,0.96);border:1px solid #2d333b;color:#f0f6fc;' +
            'padding:6px 10px;border-radius:6px;font-size:13px;line-height:1.5;white-space:nowrap;' +
            'box-shadow:0 4px 12px rgba(0,0,0,0.5);';
        container.appendChild(tip);

        s.container = container;
        s.canvas = canvas;
        s.ctx = canvas.getContext('2d');
        s.tip = tip;
        s.proj = d3.geoOrthographic().clipAngle(90).precision(0.5);
        s.path = d3.geoPath(s.proj, s.ctx);
        s.graticule = d3.geoGraticule10();

        globeBindEvents();
        globeLoadWorld();
        s.inited = true;
    }

    globeResize();
    startGlobeRotation();
}

// ==============================================================
// 7. PING SERVER THỜI GIAN THỰC (THAY CHO "12ms" GÁN TĨNH)
//    ≤ 100ms: xanh lá (Hoạt động) | 101–300ms: cam (Chập chờn) | > 300ms / lỗi: đỏ
// ==============================================================
const PING_INTERVAL_MS = 5000;   // đo lại mỗi 5 giây
const PING_TIMEOUT_MS = 5000;    // quá 5 giây coi như mất kết nối
const PING_GOOD_MAX = 100;
const PING_MEDIUM_MAX = 300;
const pingSamples = [];          // giữ 3 lần đo gần nhất để số hiển thị ổn định, không nhảy loạn

const PING_COLORS = {
    checking: { color: '#e6edf3', glow: 'none' },
    good:     { color: '#3ddc3d', glow: '0 0 10px rgba(61, 220, 61, 0.6)' },
    medium:   { color: '#ff9a2e', glow: '0 0 10px rgba(255, 154, 46, 0.6)' },
    bad:      { color: '#ff4d5e', glow: '0 0 10px rgba(255, 77, 94, 0.6)' }
};

function setPingStatus(level, label) {
    const icon = document.getElementById('serverPingIcon');
    const text = document.getElementById('serverPingText');
    if (!icon || !text) return;
    ['ping-checking', 'ping-good', 'ping-medium', 'ping-bad'].forEach(c => {
        icon.classList.remove(c);
        text.classList.remove(c);
    });
    icon.classList.add('ping-' + level);
    text.classList.add('ping-' + level);

    // Tô màu trực tiếp để luôn sáng rõ, không phụ thuộc CSS có bị cache hay không
    const c = PING_COLORS[level] || PING_COLORS.checking;
    text.style.color = c.color;
    text.style.textShadow = c.glow;
    icon.style.color = c.color;
    icon.style.filter = c.glow === 'none' ? 'none' : `drop-shadow(${c.glow.replace(/^0 0 10px /, '0 0 5px ')})`;
    text.textContent = label;
}

async function measurePing() {
    if (!navigator.onLine) {
        pingSamples.length = 0;
        setPingStatus('bad', 'Mất kết nối');
        return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
    try {
        // HEAD tới chính server của bạn (file tĩnh nhỏ) + cache-busting để đo đúng độ trễ thật
        const start = performance.now();
        const res = await fetch('/static/js/main.js?ping=' + Date.now(), {
            method: 'HEAD',
            cache: 'no-store',
            signal: controller.signal
        });
        const ms = Math.round(performance.now() - start);
        if (!res.ok) throw new Error('HTTP ' + res.status);

        pingSamples.push(ms);
        if (pingSamples.length > 3) pingSamples.shift();
        const avg = Math.round(pingSamples.reduce((a, b) => a + b, 0) / pingSamples.length);

        if (avg <= PING_GOOD_MAX) setPingStatus('good', `Hoạt động (${avg}ms)`);
        else if (avg <= PING_MEDIUM_MAX) setPingStatus('medium', `Chập chờn (${avg}ms)`);
        else setPingStatus('bad', `Rất chậm (${avg}ms)`);
    } catch (err) {
        pingSamples.length = 0;
        setPingStatus('bad', 'Mất kết nối');
    } finally {
        clearTimeout(timer);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    measurePing();
    setInterval(() => {
        if (!document.hidden) measurePing();   // tab đang ẩn thì không ping cho đỡ tốn tài nguyên
    }, PING_INTERVAL_MS);
    window.addEventListener('online', measurePing);
    window.addEventListener('offline', measurePing);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) measurePing(); });
});

// ==============================================================
// 8. TẢI NHẬN ĐỊNH CHUYÊN GIA ĐỘNG TỪ BÁO CÁC BÁO (RSS FEED)
// ==============================================================
async function fetchExpertQuotes() {
    const quotesContainer = document.getElementById('expertQuotesContainer');
    if (!quotesContainer) return;

    // Danh sách quote dự phòng (Fallback) nếu API lỗi hoặc không có mạng
    const fallbackQuotes = [
        {
            title: "Phân tích RFM là chìa khóa để khai mở giá trị vòng đời khách hàng trong kỷ nguyên số.",
            desc: "Việc kết hợp mô hình học máy XGBoost với dữ liệu giao dịch không chỉ giúp dự báo chính xác mà còn tối ưu hóa chi phí tiếp thị mục tiêu lên đến 40%.",
            author: "Dr. Andrew Ng",
            time: "2 giờ trước",
            img: "https://i.pravatar.cc/150?img=11",
            link: "https://www.linkedin.com/"
        },
        {
            title: "Dòng tiền thương mại điện tử xuyên biên giới đang dịch chuyển mạnh mẽ.",
            desc: "Sự phân mảnh của chuỗi cung ứng toàn cầu đòi hỏi các hệ thống ERP phải có khả năng ra quyết định dựa trên luồng dữ liệu thời gian thực.",
            author: "Sarah Connor",
            time: "5 giờ trước",
            img: "https://i.pravatar.cc/150?img=33",
            link: "https://twitter.com/"
        }
    ];

    // Hàm render HTML động
    const renderQuotes = (quotesArray) => {
        let htmlContent = '';
        
        // Chỉ lấy tối đa 2 bài mới nhất để nhét vừa layout
        const displayItems = quotesArray.slice(0, 2); 

        displayItems.forEach((item, index) => {
            // Lấy thời gian xuất bản, nếu không có thì ghi ngẫu nhiên "X giờ trước"
            let timeAgo = item.time;
            if (!timeAgo) {
                const pubDate = new Date(item.pubDate);
                const now = new Date();
                const diffMs = now - pubDate;
                const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
                timeAgo = diffHrs > 0 ? `${diffHrs} giờ trước` : "Vừa xong";
                if(isNaN(diffHrs)) timeAgo = `${index + 2} giờ trước`;
            }

            // Sinh random avatar cho nó ngầu (dùng Pravatar)
            const randomAvatar = item.img || `https://i.pravatar.cc/150?u=${encodeURIComponent(item.author || item.title)}`;

            htmlContent += `
                <div class="commentary-card ${index === 0 ? 'mb-3' : ''}">
                    <div class="commentary-title">
                        <i class="fa-solid fa-quote-left quote-icon"></i> ${item.title}
                    </div>
                    ${item.desc && index === 0 ? `<div class="commentary-text">${item.desc.substring(0, 150)}...</div>` : ''}
                    <a href="${item.link}" target="_blank" class="expert-profile ${index === 1 ? 'mt-3' : ''}">
                        <img src="${randomAvatar}" alt="Avatar" class="expert-avatar">
                        <div class="expert-info">
                            <span class="expert-name">${item.author || "Chuyên gia Phân tích"}</span>
                            <span class="expert-time">${timeAgo}</span>
                        </div>
                    </a>
                </div>
            `;
        });
        quotesContainer.innerHTML = htmlContent;
    };

    // Sử dụng RSS chuyên mục Góc nhìn / Kinh doanh của báo mạng
    // Ví dụ dùng VNExpress Góc nhìn
    const rssUrl = 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664'; // Mục "Finance" của CNBC
    const apiEndpoint = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;

    try {
        const response = await fetch(apiEndpoint);
        const data = await response.json();
        
        if (data.status === 'ok' && data.items.length >= 2) {
            // Chuyển đổi format data từ RSS cho chuẩn khớp
            const mappedQuotes = data.items.map(item => {
                
                // Lấy tên tác giả (nếu CNBC có trả về trường author) hoặc dùng tạm chữ "Financial Analyst"
                let authorName = item.author || "Financial Analyst";
                if (authorName.length > 30) authorName = "CNBC Analyst"; // Tránh tên tác giả bị quá dài
                
                // Xử lý loại bỏ các thẻ HTML rác trong description (nếu có)
                let descText = "";
                if (item.description) {
                   descText = item.description.replace(/(<([^>]+)>)/gi, "").trim();
                }

                return {
                    title: item.title,
                    desc: descText,
                    author: authorName,
                    pubDate: item.pubDate,
                    link: item.link
                };
            });
            renderQuotes(mappedQuotes);
        } else {
            renderQuotes(fallbackQuotes); // Nếu RSS không trả về đủ 2 bài
        }
    } catch (error) {
        console.error("Lỗi khi tải Quote chuyên gia:", error);
        renderQuotes(fallbackQuotes); // Rớt mạng / chặn API
    }
}