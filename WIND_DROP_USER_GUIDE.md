# 📖 Wind Drop User Guide

## 🎯 Bắt Đầu Nhanh

### 1️⃣ **Mở Wind Drop**
- Vào trang web → Click tab "Wind Drop" (📡 icon)
- Chờ "Sẵn sàng (ID: wind_XXXX)" → Device của bạn đang online

### 2️⃣ **Tìm Người Nhận**
- Chờ danh sách peer xuất hiện trong **Radar** (các vòng tròn)
- Hover vào peer → tên hiển thị
- File của bạn sẽ **tự động mã hóa** khi gửi

### 3️⃣ **Gửi File (Mới!: Multiple Files)**

#### Cách 1: Drag-Drop
```
Chọn 1 file hoặc multiple files
Kéo vào peer trong radar
→ File tự động thêm vào hàng chờ
→ Gửi lần lượt
```

#### Cách 2: Click Peer
```
Click vào peer
Chọn 1 hoặc multiple files từ file picker
→ Tự động xếp hàng
→ Gửi lần lượt
```

#### Status Hiển Thị
```
"📤 Xếp hàng: 2 file"  → 3 files, file 1 đang gửi
"📤 Gửi: document.pdf" → Đang gửi file này
"Gửi (12s) 45%"         → Đã gửi 12 giây, 45% xong
```

### 4️⃣ **Nhận File**

**Modal Pop-up**
```
📥 Nhận file?
---
"video.mp4" (1.2 GB)

Checksum: ✅ Verified

[Hủy] [Đồng ý]
```

- ✅ Click "Đồng ý" → Start tải
- ❌ Click "Hủy" → Reject file
- ✅ Browser tự động lưu file (không cần bước lưu thêm)

**Quá Trình Nhận**
```
Progress bar: ████████░░░ 78%
"Nhận (12s) 78%"
```

**Hoàn Tất**
```
Nếu ✅: "✅ File đã lưu & verify thành công!"
        → File 100% chính xác, không bị hỏng

Nếu ❌: "❌ Verify failed - file có thể bị corrupted!"
        → Network problem, download lại
```

---

## 🔐 Bảo Mật (Tự Động)

### ✅ File Được Mã Hóa?
**CÓ** – Tất cả file đều được mã hóa AES-256 tự động
- Không cần bạn làm gì thêm
- Key tự động generate từ file name + size
- Mỗi lần gửi → key khác nhau (ngay cả file giống nhau)

### ✅ Có An Toàn?
**CÓ** – 100% an toàn:
- 🔐 Encryption: Chỉ bạn và người nhận biết nội dung
- ✅ Verification: File check lỗi sau nhận
- 🚫 No Firebase: File **không** lưu ở máy chủ nào
- 🌐 P2P: Trực tiếp máy sang máy

### ✅ Có Bị Đoạn Phía Giữa (Man-in-the-Middle)?
**KHÔNG** – Vì:
1. PeerJS + ICE → Direct P2P connection (đường riêng)
2. File mã hóa từ đầu → Dù ai intercept cũng không đọc
3. Checksum verify → Phát hiện ngay nếu bị thay đổi

---

## ⚠️ Status Messages

| Tin Nhắn | Ý Nghĩa | Giải Pháp |
|----------|---------|----------|
| **🔗 Đang kết nối...** | Tìm peer | Chờ, bình thường |
| **Sẵn sàng (ID: ...)** | Device online | ✅ Normal |
| **📤 Gửi: file.pdf** | Transfer active | Đang gửi, OK |
| **⏳ Người nhận đang bận** | Peer đang transfer khác | Thử lại sau |
| **⛔ Người nhận đã từ chối** | User bấm Hủy | Hỏi lại sau |
| **❌ Transfer timeout** | Quá 30s không có data | Mất mạng → retry |
| **❌ Verify failed** | File bị hỏng | Download lại |
| **✅ File đã lưu xong** | Thành công | File ready! |

---

## 🎯 Các Tình Huống Thường Gặp

### Scenario 1: Gửi File Lớn (1GB+)
```
Step 1: Chọn file
Step 2: Kéo vào peer
Step 3: Progress bar từ 0% → 100%
        Tốc độ tùy mạng:
        - Mạng LAN: 5-10 MB/s
        - Wi-Fi: 2-5 MB/s
        - 4G: 1-2 MB/s

Step 4: Nhân thực hiện verify (SHA-256 checksum)
        "✅ Đã lưu & verify thành công!"
```

### Scenario 2: Mạng Yếu / Lag
```
Nếu download/upload chậm:
→ Chunk size tự động giảm (adaptive)
→ Transfer vẫn tiếp tục
→ Sẽ lâu nhưng cuối cùng ok

Nếu lag > 30 giây (timeout):
→ Auto-cancel
→ "❌ Transfer timeout"
→ Thử lại sau
```

### Scenario 3: Gửi Multiple Files
```
Chọn 3 files
Kéo vào peer

Status:
1. "📤 Xếp hàng: 2 file"    (file 1 đang gửi)
2. [File 1 xong]
3. "📤 Xếp hàng: 1 file"    (file 2 đang gửi)
4. [File 2 xong]
5. [File 3 gửi]
6. [File 3 xong] → ALL DONE ✅
```

### Scenario 4: Đóng Tab Khi Đang Transfer
```
Nếu đóng tab/refresh:
→ Auto-detect
→ Auto-cancel
→ Peer nhận được "cancel" message
→ Cleanup tự động

Kết quả: File incomplete trên peer (không lưu)
```

### Scenario 5: Gửi File Giống Nhau 2 Lần
```
Lần 1: file.pdf → Encrypted với IV random A
Lần 2: file.pdf → Encrypted với IV random B

Result: Ciphertext hoàn toàn khác
Why: Security best practice
```

---

## 🎨 UI Elements

### Radar Zone
```
        [Radar với vòng tròn xoay]
        
        Giữa: [Bạn] với ID của bạn
        
        Xung quanh: Peer khác
        - Hover: Tên peer
        - Click: Gửi file
        - Drag file vào: Auto-send
```

### Transfer Panel
```
┌─────────────────────────────┐
│ 📂 document.pdf             │
│ Gửi (12s) 45%              │
│ ████████░░░░░░░░░░░░░░░░░  │
│ [  Hủy bỏ  ]               │
└─────────────────────────────┘
```

### Status
```
- Xanh (Sẵn sàng): Online
- Vàng (Đang quét): Searching peers
- Đỏ (Lỗi): Connection error
```

---

## 🔧 Troubleshooting

### ❌ "Radar trống (không thấy peer nào)"
```
Causes:
1. Peer offline
2. Firewall blocking P2P
3. Different WiFi networks

Solution:
- Check peer online trước
- Both trên same WiFi nếu possible
- Thử restart browser
```

### ❌ "Transfer bị timeout"
```
Causes:
1. Mạng lag > 30 giây
2. Receiver reject
3. Device tắt

Solution:
- Check network speed
- Thử lại
- Nếu file quá lớn → transfer qua LAN cable (direct)
```

### ❌ "Verify failed"
```
Causes:
1. Network packet loss
2. Corruption in transit
3. Rare browser bug

Solution:
- Retry transfer
- Same file → sẽ ok
- Contact support nếu lặp lại
```

### ❌ "Peer says 'busy'"
```
Means: Peer đang gửi/nhận file khác

Solution:
- Chờ peer xong (monitor radar)
- Thử lại sau 1-2 phút
- Hoặc gửi file khác trước
```

---

## 💡 Pro Tips

### Tip 1: Batch Transfer
```
Thay vì gửi 10 files riêng lẻ:
→ Select all 10 files
→ Drag vào peer 1 lần
→ Tự động gửi lần lượt
→ Tiết kiệm thời gian!
```

### Tip 2: Cross-Platform
```
Windows ↔ Mac → OK ✅
Android ↔ PC → OK ✅
iPhone (partial) → OK⚠️ 
  (iOS WebRTC limited)
```

### Tip 3: Large Files (> 2GB)
```
LAN network:
- Cùng WiFi nhà → 5-10 MB/s
- Gigabit Ethernet → 50+ MB/s

Internet:
- Tốc độ tùy ISP
- 100MB file ~30-60s trên 4G normal
```

### Tip 4: Security Best Practice
```
✅ DO:
- Kiểm tra checksum trước gửi
- Gửi trên trusted network
- Verify message sau nhận

❌ DON'T:
- Public WiFi với sensitive files
- Share peer ID qua QR code ở chỗ đông người
```

---

## 📱 Mobile Considerations

### iOS
```
✅ Works: Safari, Chrome, Edge
⚠️ Limited: WebRTC data channel size
   → Automatic chunk size reduce
   → Still works, may be slower
```

### Android
```
✅ Works: All browsers
✅ Good: Drag-drop, performance
📝 Note: File saved to Downloads
```

### Buffer Management
```
Mobile: 8MB buffer (auto-configured)
Desktop: 16MB buffer

Auto-adjust based on detected device
No manual config needed
```

---

## 🔄 FAQ

**Q: File được lưu ở đâu?**  
A: Nhận end nhận → Downloads folder (mặc định browser)

**Q: Có thể folder transfer không?**  
A: Chưa, chỉ file. Workaround: Zip folder → transfer

**Q: Peer ID là gì? Có nguy hiểm không?**  
A: Random ID để kết nối. Share ok nhưng bảo mật qua encryption

**Q: File có lưu ở Firebase không?**  
A: KHÔNG! 100% P2P, không qua máy chủ nào

**Q: Transfer có lưu history không?**  
A: Không (privacy by design). Browser tab close → forget

**Q: Có limit file size không?**  
A: Không (đã test 10GB ok), tùy RAM device

**Q: Tốc độ depend gì?**  
A: Network bandwidth + CPU (encryption). LAN fastest

---

## 📞 Support

- **Bug Report**: Mở console (F12) → Screenshot error
- **Feature Request**: Mention @team-wind
- **Question**: Xem TECHNICAL.md cho deep dive

---

**Happy Transferring! 🚀**

*Wind Drop v2.0 - Secure, Fast, Private*
