# 🌬️ Wind Cloud

> **Một suite ứng dụng web đa chức năng cho chia sẻ file, quản lý màu sắc, và giải trí**

Wind Cloud là nền tảng web hiện đại kết hợp các công cụ đa dụng: lưu trữ đám mây, studio thiết kế màu sắc, chia sẻ file P2P tức thì, và các trò chơi trực tuyến - tất cả trong một ứng dụng duy nhất.

---

## ✨ Tính Năng Chính

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
WindCloud-main/
├── index.html                    # Trang chính
├── style.css                     # [Deprecated] Stylesheet cũ (sử dụng css/ thay thế)
├── manifest.json                 # PWA manifest
├── package.json                  # Thông tin dự án
├── sw.js                         # Service Worker
│
├── 📂 css/                       # ✨ CSS modules (organized & modular)
│   ├── variables.css             # CSS variables, themes, colors
│   ├── base.css                  # Base styles, body, container
│   ├── header.css                # Header, toolbar, navigation
│   ├── media-grid.css            # Cards, grid layout, media
│   ├── modal.css                 # Modals, dialogs, previews
│   ├── context-menu.css          # Context menus
│   ├── admin.css                 # Admin panel, login
│   ├── sidebar.css               # Sidebar navigation
│   ├── theme-switch.css          # Theme switcher component
│   ├── palette.css               # Color Studio UI
│   ├── drop.css                  # Wind Drop app styles
│   ├── windgame.css              # Wind Game styles
│   ├── mobile.css                # Mobile responsive styles
│   └── utilities.css             # Animations, utilities
│
├── 📂 js/                        # JavaScript modules
│   ├── core.js                   # Shared utilities
│   ├── router.js                 # App routing & navigation
│   ├── ui.js                     # UI components
│   ├── cloud.js                  # Cloud Storage logic
│   ├── cloudAdapters.js          # Cloud adapters (Google Drive, etc)
│   ├── palette.js                # Color Studio logic
│   ├── drop.js                   # Wind Drop logic
│   ├── windgame.js               # Wind Game logic
│   ├── eventManager.js           # Event handling
│   ├── firebase.js               # Firebase integration
│   ├── network.js                # Network utilities
│   ├── game-exit.js              # Game exit handlers
│   ├── installPrompt.js          # PWA installation prompt
│   ├── mobileContextMenu.js      # Mobile context menu
│   └── utils.js                  # Utility functions
│
├── 📂 games/                     # Integrated games
│   └── tankbattle/               # Tank Battle game
│       ├── index.html
│       ├── 📂 css/
│       │   └── style.css
│       └── 📂 js/
│           ├── classes.js
│           ├── constants.js
│           ├── game.js
│           ├── interface.js
│           └── network.js
│
├── icon.png                      # App icon (512x512)
├── README.md                     # Tài liệu này
└── CHANGELOG.md                  # (Optional) Lịch sử thay đổi
```

**🎯 Cách tổ chức:**
- **CSS modules** được tách nhỏ theo chức năng để dễ bảo trì
- **JS modules** theo tính năng của từng ứng dụng
- **Games** được isolate trong thư mục riêng

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

## 📝 Hướng Dẫn Phát Triển

### ⚙️ Setup Cục Bộ

Không cần npm hoặc build tools - Wind Cloud là vanilla JavaScript PWA:

```bash
# Option 1: Mở trực tiếp
open index.html

# Option 2: Dùng HTTP Server (khuyến nghị)
cd WindCloud-main
python -m http.server 8000
# Truy cập: http://localhost:8000
```

### 🏗️ Cấu Trúc CSS Modular

Wind Cloud sử dụng kiến trúc CSS modular để dễ bảo trì:

| File CSS | Mục Đích |
|----------|----------|
| `variables.css` | CSS variables, color schemes, themes |
| `base.css` | Base styles, layout, typography |
| `header.css` | Header, navigation, toolbar |
| `media-grid.css` | Card layouts, grid system |
| `modal.css` | Modal dialogs, previews |
| `context-menu.css` | Right-click context menus |
| `admin.css` | Admin panel, login forms |
| `sidebar.css` | Sidebar navigation |
| `theme-switch.css` | Theme toggle component |
| `palette.css` | Color Studio UI |
| `drop.css` | Wind Drop radar interface |
| `windgame.css` | Game frames & cards |
| `mobile.css` | Responsive breakpoints |
| `utilities.css` | Animations, helpers |

**Import order in index.html: Luôn tuân thủ thứ tự để tránh CSS conflicts!**

### 🎯 Thêm Tính Năng Mới

1. **Tạo module JS mới** trong `js/` folder
2. **Tạo CSS mới** trong `css/` folder nếu cần
3. **Import CSS** vào `index.html` theo thứ tự logic
4. **Import JS** vào `router.js` hoặc `index.html`
5. **Test** trên desktop + mobile

### 🧪 Testing

```bash
# Desktop Browser Console (F12)
- Kiểm tra Network tab cho failed resources
- Kiểm tra Console tab cho JS errors
- Kiểm tra Application tab cho ServiceWorker

# Mobile Testing
# Chrome DevTools → Toggle device toolbar (Ctrl+Shift+M)
# Test responsive design trên các breakpoints:
# - 375px (iPhone SE)
# - 768px (Tablet)
# - 1024px+ (Desktop)
```

### 🔧 Firebase Configuration

Cần update Firebase config trong `js/firebase.js`:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  databaseURL: "https://your-project.firebaseio.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};
```

### ☑️ Pre-Deployment Checklist

- [ ] Test trên Chrome, Firefox, Safari
- [ ] Test responsive (375px, 768px, 1024px, 1440px)
- [ ] Kiểm tra PWA installation
- [ ] Test ServiceWorker (offline mode)
- [ ] Minify CSS & JS (nếu deploy)
- [ ] Optimize images
- [ ] Kiểm tra lighthouse scores

---

## 📦 Dependencies

Wind Cloud sử dụng **CDN resources** (no node_modules):

```html
<!-- Frameworks -->
<script src="https://unpkg.com/peerjs@1.5.2/dist/peerjs.min.js"></script>

<!-- Firebase SDK (tự tải từ cdn.jsdelivr.net) -->
<script src="https://www.gstatic.com/firebasejs/10.0.0/firebase-app.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.0.0/firebase-database.js"></script>

<!-- Utilities -->
<script src="https://cdn.jsdelivr.net/npm/streamsaver@2.0.6/StreamSaver.min.js"></script>
```

---

## 🌐 Browser Support

| Browser | Min Version | Status |
|---------|-----------|--------|
| Chrome | 90+ | ✅ Full support |
| Firefox | 88+ | ✅ Full support |
| Safari | 14+ | ✅ Full support |
| Edge | 90+ | ✅ Full support |
| Mobile Chrome | Latest | ✅ Full support |
| Mobile Safari | 14+ | ✅ Full support |

---

## 🎨 Color Scheme

Wind Cloud sử dụng CSS variables cho theme support:

```css
/* Light Mode (Default) */
--primary: #1a73e8
--bg-body: #f0f2f5
--bg-surface: #ffffff
--text-main: #1f1f1f
--text-sub: #5f6368

/* Dark Mode */
--primary: #8ab4f8
--bg-body: #121212
--bg-surface: #1e1e1e
--text-main: #e8eaed
--text-sub: #9aa0a6
```

Tất cả components tự động support cả 2 themes!

---

## 🚀 Performance Tips

1. **CSS Modules**: Mỗi module chỉ load styles cần thiết
2. **Lazy Loading**: Games load on-demand
3. **Service Worker**: Offline caching
4. **Code Splitting**: JS modules separate by feature
5. **Image Optimization**: SVG icons, WebP images

---

## 🐛 Troubleshooting

### Problem: "Cannot read property 'database' of undefined"
**Solution:** Kiểm tra Firebase config trong `js/firebase.js`

### Problem: Wind Drop không phát hiện peers
**Solution:** Kiểm tra STUN/TURN servers trong PeerJS config

### Problem: "User gesture required" khi install PWA
**Solution:** Click vào install button từ user interaction

### Problem: CSS không apply
**Solution:** 
1. Clear cache (Ctrl+Shift+Delete)
2. Hard refresh (Ctrl+Shift+R)
3. Kiểm tra CSS import order trong index.html

---

## 📄 License

© 2026 **Trịnh Gia Phong**. All rights reserved.

---

## 📞 Support & Feedback

Gặp vấn đề? Hãy:
1. **Console Check**: Mở DevTools (F12) xem errors
2. **Cache Clear**: Hard refresh (Ctrl+Shift+R)
3. **Network**: Kiểm tra connection
4. **Report Issue**: Describe steps to reproduce + screenshot

---

## 🎯 Roadmap v3.0

**Planned Features:**
- 🎮 Thêm 5+ games (Flappy Bird, 2048, Snake, Tetris, Phỏng đoán số)
- 🎵 Audio visualizer & music rhythm game
- 📹 WebRTC video chat integration
- 🖼️ Advanced image editor (filters, effects)
- 🌍 Multi-language support (i18n)
- 🎨 Custom theme creator
- 💾 Cloud sync for game saves
- 📊 Analytics dashboard
- 🤝 Collaborative features
- 🔒 Enhanced security & encryption

---

**Version:** 2.1.0  
**Last Updated:** March 2026  
**Status:** 🟢 Active & Maintained

⭐ **Star this repo nếu bạn thích dự án này!**
git add .
git commit -m "Ghi chú ngắn gọn về những gì bạn vừa sửa"
git push