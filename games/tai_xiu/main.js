// ==========================================
// 0. CẤU HÌNH FIREBASE VÀ ĐĂNG NHẬP
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyDqwbmR12PavR1OrXHEx3PE39NK8XxFevY",
  authDomain: "taixiu-143ac.firebaseapp.com",
  projectId: "taixiu-143ac",
  storageBucket: "taixiu-143ac.firebasestorage.app",
  messagingSenderId: "306908951695",
  appId: "1:306908951695:web:d89d19f9b238ef53f06cfa",
  measurementId: "G-8JNZCYV228",
  databaseURL: "https://taixiu-143ac-default-rtdb.asia-southeast1.firebasedatabase.app/"
};

// Khởi tạo Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const rtdb = firebase.database();
let nguoiDungHienTai = null;

// Xử lý nút Đăng nhập (Dùng Redirect thay cho Popup)
document.getElementById('btn-login').addEventListener('click', () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    // Đổi từ Redirect sang Popup
    auth.signInWithPopup(provider).then((result) => {
        console.log("Đăng nhập thành công!");
    }).catch((error) => {
        console.error("Lỗi đăng nhập:", error);
        alert("Lỗi: " + error.message);
    });
});

// Lắng nghe trạng thái đăng nhập
// Các biến hỗ trợ Điểm danh
let chuoiDiemDanh = 0;
let ngayDiemDanhCuoi = "";
let homNayDaDiemDanh = false;
const PHAN_THUONG_DIEM_DANH = [10000, 20000, 50000, 100000, 200000, 500000, 1000000];

// Hàm lấy ngày chuẩn (YYYY-MM-DD)
function layNgayChuan(lechNgay = 0) {
    const d = new Date();
    d.setDate(d.getDate() + lechNgay);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// Lắng nghe trạng thái đăng nhập
auth.onAuthStateChanged(async (user) => {
    const loginScreen = document.getElementById('login-screen'); // Lấy element ra biến để kiểm tra
    
    if (user) {
        nguoiDungHienTai = user;
        
        // ẨN MÀN HÌNH ĐĂNG NHẬP (Thêm kiểm tra để chắc chắn không lỗi)
        const loginScreen = document.getElementById('login-screen');
        if (loginScreen) {
            loginScreen.style.setProperty('display', 'none', 'important');
        }

        // Cập nhật ảnh đại diện
        const avatarBox = document.querySelector('.user-avatar');
        if (avatarBox && user.photoURL) {
            avatarBox.innerHTML = `<img src="${user.photoURL}" style="width:100%; height:100%; border-radius:50%;">`;
        }
        
        hienThongBao(`Chào mừng ${user.displayName}!`, "yellow");

        const docRef = db.collection('nguoi_choi').doc(user.uid);
        const docSnap = await docRef.get();
        
        if (docSnap.exists) {
            const data = docSnap.data();
            soDuTien = data.soDu || 0; 
            chuoiDiemDanh = data.chuoiDiemDanh || 0;
            ngayDiemDanhCuoi = data.ngayDiemDanhCuoi || "";
        } else {
            soDuTien = 50000; 
            await docRef.set({ soDu: soDuTien, ten: user.displayName, chuoiDiemDanh: 0, ngayDiemDanhCuoi: "" }); 
        }

        // KIỂM TRA CHUỖI ĐIỂM DANH KHI VỪA VÀO GAME
        const homNay = layNgayChuan(0);
        const homQua = layNgayChuan(-1);

        if (ngayDiemDanhCuoi === homNay) {
            // Đã nhận rồi
            homNayDaDiemDanh = true;
            document.getElementById('badge-diem-danh').style.display = 'none';
        } else {
            // Chưa nhận hôm nay -> Hiện dấu chấm đỏ
            homNayDaDiemDanh = false;
            document.getElementById('badge-diem-danh').style.display = 'block';
            
            // Xử lý mất chuỗi (nghỉ game 1 ngày) hoặc Đã xong 7 ngày
            if (ngayDiemDanhCuoi !== homQua || chuoiDiemDanh >= 7) {
                chuoiDiemDanh = 0; // Reset về ngày 1
            }
        }

        capNhatUIDongTien(); 
    } else {
        document.getElementById('login-screen').style.display = 'flex';
    }
});

// Xử lý kết quả sau khi quay lại từ trang đăng nhập Google
auth.getRedirectResult().then((result) => {
    if (result.user) {
        console.log("Đăng nhập thành công qua Redirect");
    }
}).catch((error) => {
    console.error("Lỗi đăng nhập Redirect:", error);
    hienThongBao("Đăng nhập thất bại, vui lòng thử lại!", "red");
});

// Hàm lưu tiền lên DB (gọi mỗi khi tiền thay đổi)
async function luuTienLenDatabase() {
    if (nguoiDungHienTai) {
        await db.collection('nguoi_choi').doc(nguoiDungHienTai.uid).update({ soDu: soDuTien });
        taiBangXepHang(); // Gọi load lại BXH ngay lập tức
    }
}

// ==========================================
// 1. CẤU HÌNH API CLOUDFLARE WORKER
// ==========================================
const API_URL = "https://taixiu-api.trinhgiaphong2k9.workers.dev/"; 

// ==========================================
// 2. BIẾN TRẠNG THÁI GAME & TIỀN TỆ
// ==========================================
let idPhienHienTai = 0;
let giayConLai = 0;
let xucXacKetQua = [0, 0, 0];
let ketQuaPhien = "";
let phienTruocDo = -1;
let isFetching = false;

let soDuTien = 0;
let menhGiaĐangChon = 10000; 
let choPhepCuoc = false; 

let cuocTaiXacNhan = 0;
let cuocXiuXacNhan = 0;
let cuocTaiTam = 0;
let cuocXiuTam = 0;

// ==========================================
// 3. QUẢN LÝ GIAO DIỆN (UI) CƯỢC
// ==========================================
function dinhDangTien(soTien) {
    if (soTien === 0) return "0đ";
    
    // Xử lý tiền hàng Triệu (M)
    if (soTien >= 1000000) {
        let m = soTien / 1000000;
        // Nếu chẵn thì để nguyên (VD: 5M), lẻ thì cắt gọn 2 số thập phân (VD: 5.12M)
        return Number.isInteger(m) ? m + 'M' : m.toFixed(2) + 'M';
    } 
    // Xử lý tiền hàng Nghìn (K)
    else if (soTien >= 1000) {
        let k = soTien / 1000;
        return Number.isInteger(k) ? k + 'K' : k.toFixed(1) + 'K';
    }
    
    // Tiền quá nhỏ thì để số đ (dành cho đánh ALL IN số lẻ tẻ)
    return soTien + 'đ';
}

function capNhatUIDongTien() {
    document.getElementById('balance').innerText = soDuTien.toLocaleString('vi-VN') + 'đ';

    const uiPendingTai = document.getElementById('pending-tai');
    if (cuocTaiTam > 0) {
        uiPendingTai.innerText = "+" + dinhDangTien(cuocTaiTam);
        uiPendingTai.style.display = "block";
    } else {
        uiPendingTai.style.display = "none";
    }
    document.getElementById('confirmed-tai').innerText = dinhDangTien(cuocTaiXacNhan);

    const uiPendingXiu = document.getElementById('pending-xiu');
    if (cuocXiuTam > 0) {
        uiPendingXiu.innerText = "+" + dinhDangTien(cuocXiuTam);
        uiPendingXiu.style.display = "block";
    } else {
        uiPendingXiu.style.display = "none";
    }
    document.getElementById('confirmed-xiu').innerText = dinhDangTien(cuocXiuXacNhan);

    const coCuocTam = (cuocTaiTam > 0 || cuocXiuTam > 0);
    document.getElementById('btn-confirm').disabled = !coCuocTam;
    document.getElementById('btn-cancel').disabled = !coCuocTam;
}

function hienThongBao(noiDung, mauSac = "white") {
    const noti = document.getElementById('noti');
    noti.innerText = noiDung;
    noti.style.color = mauSac;
    noti.style.border = `1px solid ${mauSac}`;
}

function chonChip(giaTri, theHTML) {
    if (!choPhepCuoc) return;
    menhGiaĐangChon = giaTri;
    let chips = document.querySelectorAll('.chip');
    chips.forEach(chip => chip.classList.remove('active'));
    theHTML.classList.add('active');
}

function chonCua(cuaCuoc) {
    if (!choPhepCuoc) {
        hienThongBao("Đã hết thời gian cược hoặc đang chờ Server!", "red");
        return;
    }
    
    let soTienCuoc = menhGiaĐangChon;
    
    // Xử lý logic khi người chơi chọn nút ALL IN
    if (menhGiaĐangChon === 'ALL') {
        // Lấy tổng số dư trừ đi các cược đang treo (chưa xác nhận)
        soTienCuoc = soDuTien - cuocTaiTam - cuocXiuTam; 
        if (soTienCuoc <= 0) {
            hienThongBao("Bạn không còn đủ số dư để Tất tay!", "red");
            return;
        }
    }
    
    // Kiểm tra xem tiền có bị âm không
    const tongDuKien = cuocTaiTam + cuocXiuTam + soTienCuoc;
    if (soDuTien < tongDuKien) {
        hienThongBao("Số dư không đủ để đặt thêm!", "red");
        return;
    }
    
    if (cuaCuoc === 'TÀI') cuocTaiTam += soTienCuoc;
    if (cuaCuoc === 'XỈU') cuocXiuTam += soTienCuoc;

    let chuoiThongBao = menhGiaĐangChon === 'ALL' ? `TẤT TAY (${dinhDangTien(soTienCuoc)})` : dinhDangTien(soTienCuoc);
    hienThongBao(`Đang chọn ${chuoiThongBao} vào ${cuaCuoc}. Hãy bấm Xác nhận!`, "yellow");
    capNhatUIDongTien();
}

function xacNhanCuoc() {
    if (!choPhepCuoc) return;
    const tongTam = cuocTaiTam + cuocXiuTam;
    if (tongTam === 0) return;

    soDuTien -= tongTam;
    cuocTaiXacNhan += cuocTaiTam;
    cuocXiuXacNhan += cuocXiuTam;
    ghiNhanBienDong("Đặt cược Tài/Xỉu", -tongTam, soDuTien);
    cuocTaiTam = 0;
    cuocXiuTam = 0;

    hienThongBao("ĐẶT CƯỢC THÀNH CÔNG!", "#2ecc71");
    capNhatUIDongTien();
    luuTienLenDatabase();
}

function huyCuoc() {
    if (!choPhepCuoc) return;
    cuocTaiTam = 0;
    cuocXiuTam = 0;
    hienThongBao("Đã hủy các cược chưa xác nhận.", "white");
    capNhatUIDongTien();
}

// ==========================================
// 4. KẾT NỐI SERVER CLOUDFLARE BẰNG API
// ==========================================
async function dongBoVoiMayChu(laLucTraThuong = false) {
    if (isFetching) return;
    isFetching = true;
    try {
        const response = await fetch(API_URL);
        const data = await response.json();
        
        // Cập nhật ID phiên và Giây còn lại
        if (data && data.current_round) {
            idPhienHienTai = data.current_round.id;
            giayConLai = data.current_round.time_remaining_seconds;
        }

        // Lấy kết quả ván cũ khi hết giờ
        if (laLucTraThuong && data.previous_round) {
            xucXacKetQua = data.previous_round.dice;
            ketQuaPhien = data.previous_round.result;
            xuLyTraThuong(); 
        }

        // VẼ LỊCH SỬ TỪ API
        if (data.history && Array.isArray(data.history)) {
            veBangSoiCau(data.history);
        }

    } catch (error) {
        console.error("Lỗi:", error);
    }
    isFetching = false;
}

// ==========================================
// 5. HÀM XỬ LÝ TRẢ THƯỞNG
// ==========================================
function xuLyTraThuong() {
    const tong = xucXacKetQua[0] + xucXacKetQua[1] + xucXacKetQua[2];
    
    document.getElementById('dice1').innerText = xucXacKetQua[0];
    document.getElementById('dice2').innerText = xucXacKetQua[1];
    document.getElementById('dice3').innerText = xucXacKetQua[2];
    document.getElementById('totalResult').innerText = `TỔNG: ${tong} - ${ketQuaPhien.toUpperCase()}`;

    document.getElementById('zone-tai').classList.remove('win');
    document.getElementById('zone-xiu').classList.remove('win');
    if (ketQuaPhien.toUpperCase() === "TÀI") document.getElementById('zone-tai').classList.add('win');
    if (ketQuaPhien.toUpperCase() === "XỈU") document.getElementById('zone-xiu').classList.add('win');

    let tienThang = 0;
    if (ketQuaPhien.toUpperCase() === "TÀI" && cuocTaiXacNhan > 0) {
        tienThang = cuocTaiXacNhan * 2; 
        hienThongBao(`BẠN THẮNG ${tienThang.toLocaleString('vi-VN')}đ!`, "#2ecc71");
    } else if (ketQuaPhien.toUpperCase() === "XỈU" && cuocXiuXacNhan > 0) {
        tienThang = cuocXiuXacNhan * 2;
        hienThongBao(`BẠN THẮNG ${tienThang.toLocaleString('vi-VN')}đ!`, "#2ecc71");
    } else if (cuocTaiXacNhan > 0 || cuocXiuXacNhan > 0) {
        hienThongBao("Rất tiếc! Chúc bạn may mắn ván sau.", "#e74c3c");
    } else {
        hienThongBao("Bắt đầu phiên cược mới!", "white");
    }

    if (tienThang > 0) {
        soDuTien += tienThang;
        ghiNhanBienDong("Thắng cược", tienThang, soDuTien);
    }
    
    cuocTaiXacNhan = 0;
    cuocXiuXacNhan = 0;
    capNhatUIDongTien();
    luuTienLenDatabase();
}

// ==========================================
// 6. GAME LOOP (ĐẾM NGƯỢC NỘI BỘ MỖI GIÂY)
// ==========================================
function capNhatGame() {
    if (idPhienHienTai === 0 || idPhienHienTai === undefined) {
        document.getElementById('totalResult').innerText = "ĐANG KẾT NỐI...";
        return; 
    }

    document.getElementById('sessionId').innerText = '#' + idPhienHienTai;
    document.getElementById('countdown').innerText = giayConLai < 10 ? '0' + giayConLai : giayConLai;

    if (giayConLai <= 5 && giayConLai > 0) {
        if (choPhepCuoc) {
            choPhepCuoc = false;
            if (cuocTaiTam > 0 || cuocXiuTam > 0) {
                huyCuoc(); 
                hienThongBao("Hết thời gian! Đã hủy cược chưa xác nhận.", "#e74c3c");
            } else {
                hienThongBao("KHÓA CƯỢC! ĐANG LẮC...", "#e74c3c");
            }
            document.getElementById('btn-confirm').disabled = true;
            document.getElementById('btn-cancel').disabled = true;
        }
        document.getElementById('totalResult').innerText = "ĐANG LẮC...";
        document.querySelector('.plate').classList.add('shake'); 
        
        document.getElementById('dice1').innerText = "?";
        document.getElementById('dice2').innerText = "?";
        document.getElementById('dice3').innerText = "?";
        document.getElementById('zone-tai').classList.remove('win');
        document.getElementById('zone-xiu').classList.remove('win');
    } 
    else if (giayConLai <= 0) {
        if (phienTruocDo !== idPhienHienTai) {
            document.querySelector('.plate').classList.remove('shake');
            phienTruocDo = idPhienHienTai;
            setTimeout(() => { dongBoVoiMayChu(true); }, 1500);
        }
    } 
    else {
        choPhepCuoc = true;
        document.querySelector('.plate').classList.remove('shake');
        if(giayConLai > 55) {
            document.getElementById('totalResult').innerText = "VUI LÒNG ĐẶT CƯỢC";
        }
    }

    if (giayConLai > 0) giayConLai--;
}

// Khởi chạy
capNhatUIDongTien();
dongBoVoiMayChu(false); 
setInterval(capNhatGame, 1000);

// ==========================================
// 8. CÁC HÀM VẼ BẢNG SOI CẦU VÀ ĐỒ THỊ
// ==========================================
function veBangSoiCau(historyArray) {
    // 1. CHUẨN HÓA DỮ LIỆU TỪ API ("Tài" -> "TÀI")
    let duLieuChuan = historyArray.map(item => {
        return item.toUpperCase() === 'TÀI' ? 'TÀI' : 'XỈU';
    });

    // (Đã xóa phần vẽ bảng lịch sử ở ngoài trang chủ)

    // 2. Vẽ Cầu Điểm (Hình 1 - Lấy 20 ván gần nhất để bi không dính vào nhau)
    veCauDiem(duLieuChuan.slice(-20));

    // 3. Vẽ Cầu Bệt (Hình 2 - Dùng toàn bộ 50 ván)
    veCauBet(duLieuChuan);
}

// ==========================================
// THUẬT TOÁN VẼ CẦU ĐIỂM (HÌNH 1 - CANVAS)
// ==========================================
function veCauDiem(duLieuChuan) {
    const canvas = document.getElementById('canvas-cau-diem');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    ctx.clearRect(0, 0, width, height);

    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    for(let i = 0; i <= 4; i++) {
        let y = i * (height / 4);
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }

    // Tính toán khoảng cách đều nhau dựa trên số lượng bi thực tế
    const stepX = width / Math.max(duLieuChuan.length, 10); 
    
    ctx.beginPath();
    ctx.strokeStyle = '#f1c40f'; 
    ctx.lineWidth = 2;

    let pointsToDraw = [];

    duLieuChuan.forEach((kq, index) => {
        // Mô phỏng điểm số (Vì API mảng history của bạn hiện tại chưa trả về con số cụ thể)
        let diemXucXac = kq === 'TÀI' ? (Math.floor(Math.random() * 7) + 11) : (Math.floor(Math.random() * 7) + 4);
        
        let x = index * stepX + (stepX / 2);
        let y = height - ((diemXucXac - 3) / 15) * (height - 40) - 20; 

        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);

        pointsToDraw.push({x, y, kq, diemXucXac});
    });
    ctx.stroke(); 

    // Vẽ bi
    pointsToDraw.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = p.kq === 'TÀI' ? '#e74c3c' : '#2c3e50'; 
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'white';
        ctx.stroke();

        ctx.fillStyle = 'white';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.diemXucXac, p.x, p.y);
    });
}

// ==========================================
// THUẬT TOÁN VẼ CẦU BỆT (HÌNH 2)
// ==========================================
function veCauBet(duLieuChuan) {
    const container = document.getElementById('bang-cau-bet');
    if (!container) return;
    container.innerHTML = '';

    let mangCacCot = [];
    let cotHienTai = [];
    let ketQuaTruocDo = null;

    duLieuChuan.forEach(kq => {
        if (kq !== ketQuaTruocDo && ketQuaTruocDo !== null) {
            mangCacCot.push(cotHienTai);
            cotHienTai = []; 
        }
        cotHienTai.push(kq);
        ketQuaTruocDo = kq;
    });
    if (cotHienTai.length > 0) mangCacCot.push(cotHienTai);

    mangCacCot.forEach(cotDuLieu => {
        let divCot = document.createElement('div');
        divCot.className = 'cau-bet-col';
        
        cotDuLieu.forEach(kq => {
            let dot = document.createElement('div');
            dot.className = `history-dot ${kq === 'TÀI' ? 'dot-tai' : 'dot-xiu'}`;
            dot.innerText = kq === 'TÀI' ? 'T' : 'X';
            divCot.appendChild(dot);
        });
        
        container.appendChild(divCot);
    });

    setTimeout(() => { container.scrollLeft = container.scrollWidth; }, 100);
}

// ==========================================
// 9. XỬ LÝ GIAO DIỆN BẢNG LỊCH SỬ (MODAL)
// ==========================================
function moBangLichSu() {
    document.getElementById('modal-lich-su').style.display = 'flex';
}

function dongBangLichSu() {
    document.getElementById('modal-lich-su').style.display = 'none';
}

function chuyenTab(idTabCanMo, theNutBam) {
    let cacTabContent = document.querySelectorAll('.tab-content');
    cacTabContent.forEach(tab => tab.style.display = 'none');

    let cacNutTab = document.querySelectorAll('.tab-btn');
    cacNutTab.forEach(nut => nut.classList.remove('active'));

    document.getElementById(idTabCanMo).style.display = 'block';
    theNutBam.classList.add('active');

    if (idTabCanMo === 'tab-cau-bet') {
        const container = document.getElementById('bang-cau-bet');
        if (container) container.scrollLeft = container.scrollWidth;
    }
}

// ==========================================
// 10. XỬ LÝ BẢNG XẾP HẠNG TOP 10
// ==========================================
async function taiBangXepHang() {
    const listContainer = document.getElementById('leaderboard-list');
    if (!listContainer) return;

    try {
        // Lấy 10 người có số dư (soDu) cao nhất từ Firestore
        const snapshot = await db.collection('nguoi_choi')
                                 .orderBy('soDu', 'desc')
                                 .limit(10)
                                 .get();
        
        listContainer.innerHTML = ''; // Xóa chữ "Đang tải"
        let rank = 1;

        snapshot.forEach(doc => {
            const data = doc.data();
            const ten = data.ten || "Ẩn danh";
            const soTien = data.soDu || 0;

            let rankClass = '';
            if (rank === 1) rankClass = 'rank-1';
            else if (rank === 2) rankClass = 'rank-2';
            else if (rank === 3) rankClass = 'rank-3';

            const itemHTML = `
                <div class="lb-item ${rankClass}">
                    <div class="lb-rank">#${rank}</div>
                    <div class="lb-name">${ten}</div>
                    <div class="lb-balance">${dinhDangTien(soTien)}</div>
                </div>
            `;
            listContainer.innerHTML += itemHTML;
            rank++;
        });

    } catch (error) {
        console.error("Lỗi khi tải bảng xếp hạng:", error);
        listContainer.innerHTML = '<div style="color:red; text-align:center;">Lỗi kết nối BXH</div>';
    }
}

// Chạy tải Bảng xếp hạng lần đầu tiên
taiBangXepHang();

// Cứ mỗi 30 giây sẽ tải lại BXH một lần để cập nhật tiền mới nhất
setInterval(taiBangXepHang, 30000);

// ==========================================
// 11. XỬ LÝ KHUNG CHAT (FIREBASE REALTIME DATABASE - MIỄN PHÍ CAO)
// ==========================================
function khoiTaoChat() {
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const btnSend = document.getElementById('btn-send-chat');

    // 1. LẮNG NGHE TIN NHẮN (Dùng 'value' để quét sạch và vẽ lại đúng 20 tin nhắn)
    rtdb.ref('chat_tong').limitToLast(20).on('value', (snapshot) => {
        chatMessages.innerHTML = ''; // Quét sạch khung chat hiện tại trên màn hình
        
        snapshot.forEach(childSnap => {
            const data = childSnap.val();
            const msgDiv = document.createElement('div');
            msgDiv.className = 'chat-msg';
            
            let mauTen = '#3498db';
            if (nguoiDungHienTai && data.uid === nguoiDungHienTai.uid) mauTen = '#f1c40f';

            msgDiv.innerHTML = `
                <div class="chat-name" style="color: ${mauTen};">${data.ten}</div>
                <div class="chat-content">${data.noidung}</div>
            `;
            chatMessages.appendChild(msgDiv);
        });
        
        // Tự động cuộn xuống dòng chat mới nhất
        chatMessages.scrollTop = chatMessages.scrollHeight; 
    });

    // 2. HÀM GỬI TIN NHẮN VÀ DỌN RÁC DATABASE
    async function guiTinNhan() {
        const text = chatInput.value.trim();
        if (!text) return;
        
        if (!nguoiDungHienTai) {
            hienThongBao("Vui lòng đăng nhập để chat!", "red");
            return;
        }

        chatInput.value = ''; // Xóa khung nhập ngay để tạo cảm giác mượt
        
        try {
            // A. Gửi tin nhắn mới lên DB
            await rtdb.ref('chat_tong').push({
                uid: nguoiDungHienTai.uid,
                ten: nguoiDungHienTai.displayName || "Ẩn danh",
                noidung: text,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            });

            // B. TỰ ĐỘNG DỌN RÁC DATABASE (Xóa vĩnh viễn tin nhắn cũ trên máy chủ)
            rtdb.ref('chat_tong').once('value', snap => {
                const tongSoTinNhan = snap.numChildren();
                if (tongSoTinNhan > 25) { // Nếu máy chủ đang lưu quá 25 tin
                    let soLuongCanXoa = tongSoTinNhan - 20; // Giữ lại đúng 20 tin
                    let daXoa = 0;
                    snap.forEach(child => {
                        if (daXoa < soLuongCanXoa) {
                            // Tiêu diệt tin nhắn cũ nhất khỏi Firebase
                            rtdb.ref('chat_tong/' + child.key).remove();
                            daXoa++;
                        }
                    });
                }
            });

        } catch (error) {
            console.error("Lỗi gửi tin nhắn:", error);
            hienThongBao("Lỗi khi gửi tin nhắn", "red");
        }
    }

    // Bắt sự kiện bấm nút Gửi và bấm Enter
    btnSend.addEventListener('click', guiTinNhan);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') guiTinNhan();
    });
}

// Chạy hàm khởi tạo chat
khoiTaoChat();

// ==========================================
// 12. XỬ LÝ BIẾN ĐỘNG SỐ DƯ
// ==========================================

// Hàm lưu biến động vào Database
async function ghiNhanBienDong(loaiGiaoDich, soTienThayDoi, soDuMoi) {
    if (!nguoiDungHienTai) return;
    try {
        await db.collection('nguoi_choi').doc(nguoiDungHienTai.uid).collection('bien_dong').add({
            loai: loaiGiaoDich, // "Đặt cược" hoặc "Thắng cược"
            soTien: soTienThayDoi, // Âm hoặc dương
            soDuMoi: soDuMoi,
            thoiGian: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error("Lỗi ghi biến động:", error);
    }
}

// Mở và tải dữ liệu lên Modal
async function moBangBienDong() {
    document.getElementById('modal-bien-dong').style.display = 'flex';
    const container = document.getElementById('danh-sach-bien-dong');
    
    if (!nguoiDungHienTai) {
        container.innerHTML = '<div style="text-align:center; padding: 20px; color:#e74c3c;">Vui lòng đăng nhập!</div>';
        return;
    }

    container.innerHTML = '<div style="text-align:center; padding: 20px; color:#ccc;">Đang tải dữ liệu...</div>';

    try {
        // Lấy 20 biến động mới nhất
        const snapshot = await db.collection('nguoi_choi').doc(nguoiDungHienTai.uid).collection('bien_dong')
            .orderBy('thoiGian', 'desc')
            .limit(20)
            .get();

        container.innerHTML = '';
        if (snapshot.empty) {
            container.innerHTML = '<div style="text-align:center; padding: 20px; color:#888;">Chưa có giao dịch nào.</div>';
            return;
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            const laCongTien = data.soTien > 0;
            const mauSac = laCongTien ? '#2ecc71' : '#e74c3c'; // Xanh lá nếu cộng, đỏ nếu trừ
            const dau = laCongTien ? '+' : '';
            
            // Format ngày giờ
            let thoiGianStr = "Vừa xong";
            if (data.thoiGian) {
                const date = data.thoiGian.toDate();
                thoiGianStr = date.toLocaleTimeString('vi-VN') + ' - ' + date.toLocaleDateString('vi-VN');
            }

            container.innerHTML += `
                <div style="display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #333;">
                    <div>
                        <div style="font-weight: bold; color: #ddd; font-size: 15px;">${data.loai}</div>
                        <div style="font-size: 11px; color: #888; margin-top: 3px;">${thoiGianStr}</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-weight: bold; font-size: 15px; color: ${mauSac};">${dau}${dinhDangTien(data.soTien)}</div>
                        <div style="font-size: 11px; color: #aaa; margin-top: 3px;">SD: ${dinhDangTien(data.soDuMoi)}</div>
                    </div>
                </div>
            `;
        });
    } catch (error) {
        console.error(error);
        container.innerHTML = '<div style="text-align:center; padding: 20px; color:red;">Lỗi tải dữ liệu</div>';
    }
}

function dongBangBienDong() {
    document.getElementById('modal-bien-dong').style.display = 'none';
}

// ==========================================
// 13. XỬ LÝ ĐIỂM DANH HÀNG NGÀY
// ==========================================
function moBangDiemDanh() {
    document.getElementById('modal-diem-danh').style.display = 'flex';
    veBangDiemDanh();
}

function dongBangDiemDanh() {
    document.getElementById('modal-diem-danh').style.display = 'none';
}

function veBangDiemDanh() {
    const container = document.getElementById('danh-sach-ngay');
    container.innerHTML = '';
    
    for (let i = 0; i < 7; i++) {
        let statusClass = 'locked';
        let icon = '🔒';
        let onclick = '';
        
        if (i < chuoiDiemDanh) {
            // Ngày đã nhận
            statusClass = 'claimed';
            icon = '✅';
        } else if (i === chuoiDiemDanh && !homNayDaDiemDanh) {
            // Ngày hiện tại có thể nhận
            statusClass = 'current';
            icon = '🎁';
            onclick = `onclick="nhanThuongDiemDanh(${i})"`;
        }
        
        container.innerHTML += `
            <div class="day-box ${statusClass}" ${onclick}>
                <div class="day-title">Ngày ${i + 1}</div>
                <div class="day-reward">${dinhDangTien(PHAN_THUONG_DIEM_DANH[i])}</div>
                <div class="day-status">${icon}</div>
            </div>
        `;
    }
}

async function nhanThuongDiemDanh(ngayIndex) {
    if (homNayDaDiemDanh || !nguoiDungHienTai) return;
    if (ngayIndex !== chuoiDiemDanh) return; // Bấm sai ngày
    
    // Cộng tiền
    const tienThuong = PHAN_THUONG_DIEM_DANH[ngayIndex];
    soDuTien += tienThuong;
    
    // Tăng chuỗi và cập nhật ngày
    chuoiDiemDanh++;
    ngayDiemDanhCuoi = layNgayChuan(0); // Hôm nay
    homNayDaDiemDanh = true;
    
    // Cập nhật UI
    capNhatUIDongTien();
    document.getElementById('badge-diem-danh').style.display = 'none'; // Tắt chấm đỏ
    veBangDiemDanh(); // Vẽ lại để đổi icon thành dấu tích
    
    hienThongBao(`ĐIỂM DANH THÀNH CÔNG! Bạn nhận được ${dinhDangTien(tienThuong)}`, "#2ecc71");
    
    // Lưu vào Firebase
    await ghiNhanBienDong(`Điểm danh Ngày ${chuoiDiemDanh}`, tienThuong, soDuTien);
    await db.collection('nguoi_choi').doc(nguoiDungHienTai.uid).update({ 
        soDu: soDuTien,
        chuoiDiemDanh: chuoiDiemDanh,
        ngayDiemDanhCuoi: ngayDiemDanhCuoi
    });
    taiBangXepHang();
}

// ==========================================
// 14. XỬ LÝ NHẠC NỀN (BACKGROUND MUSIC)
// ==========================================
const bgMusic = document.getElementById('bg-music');
const btnMusic = document.getElementById('btn-music');
let isMusicPlaying = false;

// Đặt âm lượng nhạc nền xuống 40% để người chơi không bị giật mình
bgMusic.volume = 0.4; 

function toggleMusic() {
    if (isMusicPlaying) {
        bgMusic.pause();
        btnMusic.innerText = "🔇";
        isMusicPlaying = false;
    } else {
        bgMusic.play().then(() => {
            btnMusic.innerText = "🔊";
            isMusicPlaying = true;
        }).catch(err => {
            console.log("Lỗi phát nhạc:", err);
            hienThongBao("Không thể phát nhạc, vui lòng thử lại!", "red");
        });
    }
}

// Tuyệt chiêu: Tự động phát nhạc khi người dùng bấm vào web lần đầu tiên
document.body.addEventListener('click', function autoPlayMusic() {
    if (!isMusicPlaying) {
        bgMusic.play().then(() => {
            btnMusic.innerText = "🔊";
            isMusicPlaying = true;
            // Bỏ lắng nghe sự kiện này sau khi nhạc đã phát thành công
            document.body.removeEventListener('click', autoPlayMusic);
        }).catch(e => {
            // Trình duyệt chưa cho phép
            console.log("Trình duyệt chặn autoplay:", e);
        });
    }
}, { once: true }); // once: true giúp sự kiện này chỉ chực chờ chạy đúng 1 lần