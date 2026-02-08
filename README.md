# 🌬️ Wind Cloud - Multi-Purpose Web App Suite

**Wind Cloud** là một ứng dụng web đa chức năng hiện đại, được thiết kế để cung cấp trải nghiệm người dùng mượt mà và trực quan. Nó kết hợp nhiều công cụ hữu ích trong một platform duy nhất.

## 🎯 Các Tính Năng Chính

### 1. ☁️ **Cloud Storage**
- Quản lý và lưu trữ video, hình ảnh, tài liệu, và các loại file khác
- Tích hợp Google Drive để nhúng các file trực tiếp
- Hỗ trợ tìm kiếm nhanh và sắp xếp linh hoạt
- Giao diện lưới và danh sách có thể chuyển đổi
- Hỗ trợ tạo thư mục để tổ chức file hiệu quả

**Tính năng:**
- 📁 Tạo thư mục lồng nhau
- 🔍 Tìm kiếm file nhanh chóng
- 📋 Sắp xếp: Theo ngày, tên, loại file
- ✂️ Sao chép, cắt, dán file
- 🗑️ Xóa vĩnh viễn

---

### 2. 🎨 **Color Studio Pro**
- Tạo bảng màu chuyên nghiệp từ một màu chủ đạo
- Hỗ trợ nhiều quy tắc phối màu:
  - **Tương đồng (Analogous)** - Các màu liền kề trên bánh xe màu
  - **Đơn sắc (Monochromatic)** - Các sắc thái và độ sáng của một màu
  - **Bổ túc (Complementary)** - Màu đối diện trên bánh xe màu
  - **Bổ túc kề (Split Complementary)** - Màu bổ túc + hai màu liền kề
  - **Bộ ba (Triadic)** - Ba màu cách đều nhau 120°
  - **Bộ bốn (Tetradic)** - Bốn màu tạo thành hình chữ nhật

**Tính năng:**
- 🎲 Tạo màu ngẫu nhiên
- 📋 Copy toàn bộ bảng màu
- 💾 Xuất bảng màu (CSS, JSON)
- 🌓 Hỗ trợ chế độ sáng/tối

---

### 3. 📡 **Wind Drop - Chia Sẻ File Tức Thì**
- Chia sẻ file với người dùng khác trên cùng mạng một cách tức thì
- Giao diện radar trực quan hiển thị các thiết bị gần đó
- Thao tác kéo & thả (Drag & Drop) để gửi file
- Hiển thị tiến trình chuyển file real-time

**Tính năng:**
- 🎯 Phát hiện thiết bị gần đó
- 📊 Hiển thị tiến trình chuyển gói
- ⏱️ Hiển thị thời gian kết nối
- 🔗 Kết nối P2P bằng PeerJS
- 💨 Tốc độ truyền tệp cao

---

### 4. 🕹️ **Wind Game - Trò Chơi Tích Hợp**
- Chơi các trò chơi trực tiếp trong ứng dụng
- Hỗ trợ chế độ toàn màn hình
- Mở game trong tab mới (fullscreen)
- Chế độ nhúng iframe hay mở ngoài theo lựa chọn

**Trò Chơi Hiện Tại:**
- 🎮 **Tank Battle** - Trò chơi chiến đấu xe tăng PvP trên Replit

---

## 🎨 Giao Diện & Ux

### 📚 Sidebar Navigation
- Menu dễ dàng chuyển đổi giữa các ứng dụng
- Responsive design - tự động ẩn trên thiết bị di động
- Admin Access để quản lý nội dung

### 🌓 Chế độ Sáng/Tối
- Hỗ trợ chế độ giao diện sáng và tối
- Lưu trữ tùy chọn trong localStorage
- Màu sắc được tối ưu hóa cho cả hai chế độ

### 🎬 Animation & Hiệu Ứng
- **Entrance animations** - Các thành phần xuất hiện mượt mà
- **Hover effects** - Phản hồi trực quan khi tương tác
- **Staggered transitions** - Hiệu ứng animation tiến độ cho các card
- **Smooth transitions** - Toàn bộ ứng dụng sử dụng CSS transitions

### 📱 Responsive Design
- Optimized cho desktop, tablet, và mobile
- Responsive grid layout
- Touch-friendly buttons và controls
- Adaptive layout cho màn hình nhỏ

---

## 🛠️ Công Nghệ Sử Dụng

### Frontend
- **HTML5** - Cấu trúc trang web
- **CSS3** - Styling với Grid, Flexbox, Animations
- **JavaScript (Vanilla)** - Không sử dụng framework, code thuần

### Backend & Services
- **Firebase** - Xác thực người dùng (Auth) và cơ sở dữ liệu (RTDB)
- **PeerJS** - Kết nối P2P cho Wind Drop
- **StreamSaver.js** - Hỗ trợ tải xuống file lớn

### Deployment
- **PWA (Progressive Web App)** - Hỗ trợ cài đặt như ứng dụng native
- **Service Worker** - Hỗ trợ offline functionality

---

## 📁 Cấu Trúc Dự Án

```
test/
├── index.html              # Trang chính chứa tất cả tab
├── style.css              # Stylesheet toàn cục
├── manifest.json          # PWA manifest
├── sw.js                  # Service Worker
├── js/
│   ├── core.js           # Logic chia sẻ chung
│   ├── cloud.js          # Cloud Storage logic
│   ├── palette.js        # Color Studio logic
│   ├── drop.js           # Wind Drop logic
│   └── windgame.js       # Wind Game logic
├── images/               # Thư mục ảnh & thumbnails
│   └── tankbattle.png    # Thumbnail Tank Battle game
├── icon.png              # App icon
└── README.md             # Tài liệu này
```

---

## 🚀 Cách Sử Dụng

### 1. **Cloud Storage**
- Mở ứng dụng
- Nhấp vào tab "Cloud Storage"
- Dán link Google Drive vào ô input
- Nhập tên hiển thị (tuỳ chọn)
- Nhấn "Lưu Tệp"
- Sắp xếp và tìm kiếm file theo nhu cầu

### 2. **Color Studio**
- Mở tab "Color Studio Pro"
- Chọn màu chủ đạo bằng color picker
- Chọn quy tắc phối màu từ dropdown
- Xem bảng màu tự sinh
- Nhấn "Copy Cả Bảng" để sao chép giá trị màu

### 3. **Wind Drop**
- Mở tab "Wind Drop"
- Đợi ứng dụng phát hiện thiết bị gần đó
- Kéo file vào vùng radar
- Chọn thiết bị nhận
- Theo dõi tiến trình chuyển file

### 4. **Wind Game**
- Mở tab "Wind Game"
- Chọn game từ danh sách
- Nhấn "Chơi" để chơi trong ứng dụng
- Nhấn "Toàn màn hình" để chơi fullscreen
- Nhấn "Mở ngoài" để chơi trong tab riêng

---

## 🔑 Tính Năng Admin

Nhấn vào "Admin Access" để đăng nhập với tư cách quản trị viên:
- Thêm, chỉnh sửa, xóa file
- Quản lý thư mục
- Xem thống kê sử dụng

> **Ghi chú:** Yêu cầu email và password admin hợp lệ được lưu trữ trên Firebase

---

## 🌐 Links Liên Quan

- **Tank Battle Game:** https://tankbattle--Pingplay.replit.app
- **Firebase Console:** https://console.firebase.google.com
- **PeerJS Demo:** https://peerjs.com/

---

## 📱 PWA Installation

Ứng dụng hỗ trợ cài đặt như PWA (Progressive Web App):

**Trên Desktop (Chrome/Edge):**
1. Mở ứng dụng trong trình duyệt
2. Nhấp vào nút "Install" ở thanh địa chỉ
3. Ứng dụng sẽ được cài đặt như ứng dụng native

**Trên Mobile:**
1. Mở ứng dụng trong trình duyệt Mobile
2. Nhấn menu (⋮) → "Cài đặt" hoặc "Add to Home Screen"
3. Ứng dụng sẽ xuất hiện trên màn hình chính

---

## 🎯 Roadmap Tương Lai

- [ ] Thêm các games khác (Flappy Bird, 2048, etc.)
- [ ] Hỗ trợ chia sẻ files trực tiếp với link URLs
- [ ] Thêm tính năng nhạc nền và sound effects
- [ ] Tích hợp WebRTC cho video call
- [ ] Thêm bộ lọc ảnh nâng cao
- [ ] Hỗ trợ đa ngôn ngữ (i18n)
- [ ] Thêm tùy chọn theme màu tùy chỉnh

---

## 📝 Ghi Chú Phát Triển

### Local Development
```bash
# Không cần npm install - ứng dụng sử dụng CDN
# Chỉ cần mở index.html trong trình duyệt
open index.html

# Hoặc dùng HTTP server
python -m http.server 8000
# Sau đó mở: http://localhost:8000
```

### Browser Requirements
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers hỗ trợ ES6+

---

## 📄 License

Trang web thuộc sở hữu của **Trịnh Gia Phong** © 2026

---

## 📞 Liên Hệ & Hỗ Trợ

Nếu bạn gặp vấn đề hoặc có câu hỏi, vui lòng:
1. Kiểm tra console (F12) để xem thông báo lỗi
2. Thử refresh trang (Ctrl+F5 để clear cache)
3. Kiểm tra kết nối internet

---

**Phiên bản hiện tại:** 2.1  
**Cập nhập lần cuối:** Tháng 2 năm 2026

---

🎉 Cảm ơn bạn đã sử dụng **Wind Cloud**! Muốn góp ý hoặc báo lỗi? Hãy liên hệ!
