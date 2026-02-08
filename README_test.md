Hướng dẫn kiểm thử Wind Drop (2 thiết bị, HTTPS)

Mục tiêu
- Test Wind Drop (P2P/WebRTC) trên hai thiết bị khác nhau qua HTTPS.

Tùy chọn triển khai HTTPS
1) GitHub Pages (khuyến nghị cho site tĩnh)
- Đẩy toàn bộ repository lên GitHub.
- Vào Settings > Pages của repo, chọn branch `main` (hoặc `gh-pages`) và root (hoặc `/docs`) làm nguồn.
- GitHub Pages sẽ cung cấp URL `https://<username>.github.io/<repo>` với HTTPS tự động.

2) Ngrok (nhanh, phục vụ local dev)
- Mở terminal trong thư mục project:

```bash
# nhanh: serve file tĩnh
npx http-server -p 8080
# hoặc
python -m http.server 8080

# mở tunnel HTTPS (cài/ngrok trước)
ngrok http 8080
```

- Dùng URL `https://xxxx.ngrok.io` trên cả 2 thiết bị.

3) Local HTTPS (mkcert) — nếu test trong LAN
- Tạo cert với `mkcert` rồi chạy server với cert.

Kiểm thử cơ bản (kịch bản)
1) Chuẩn bị
- Mở URL (GitHub Pages hoặc ngrok) trên cả 2 thiết bị (A: sender, B: receiver).
- Mở DevTools console (nếu cần debug).

2) Kiểm tra presence & ping
- Trên cả hai thiết bị, vào tab Wind Drop (app-drop).
- Đợi `dropStatus` hiển thị "Sẵn sàng".
- Trên A, nhấn nút 🔔 (ping) trên thiết bị B; B phải hiện toast và (nếu có) rung/vibrate.

3) Gửi file nhỏ
- A kéo-thả hoặc chọn file nhỏ (~1–5MB) tới B.
- Quan sát tiến trình trên cả 2 thiết bị; kiểm tra toast thông báo thành công.

4) Gửi file lớn & mô phỏng lỗi
- Gửi file lớn (≥100MB) để kiểm tra memory/streaming.
- Khi đang truyền, tắt mạng trên B -> kiểm tra timeout và thông báo hủy.
- Bật lại mạng và thử gửi lại file; sender nên resume từ offset đã ack (nếu có).

Kiểm tra thêm
- Console: xem lỗi PeerJS/ICE/turn/permission.
- Nếu hai thiết bị không kết nối (nhiều NAT), cần cấu hình TURN server.

Gợi ý cấu hình TURN (nếu cần)
- Cài `coturn` trên server có IP public; tạo username/credential.
- Thêm vào `iceServers` trong `js/drop.js`:

```js
{
  urls: 'turn:TURN_HOST:3478',
  username: 'user',
  credential: 'pass'
}
```

Lưu ý
- WebRTC và nhiều API chỉ hoạt động trên HTTPS (hoặc localhost). GitHub Pages đáp ứng yêu cầu này.
- Ngrok hữu ích cho dev nhanh nhưng không cố định lâu dài.

Muốn tôi hỗ trợ thêm: (A) tạo file test script `README_test.md` (đã tạo), (B) thêm hướng dẫn cấu hình TURN/coturn chi tiết, (C) thêm GitHub Action để deploy tự động — chọn 1 tuỳ chọn.