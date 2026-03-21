import { openSafe } from './utils.js';

// Dynamic Wind Game card rendering + iframe host
const GAMES = [
    {
        id: 'tankbattle',
        title: 'Tank Battle',
        desc: 'Trò chơi chiến đấu xe tăng PvP',
        thumb: './games/tankbattle/thumnail.png',
        url: './games/tankbattle/index.html'
    }
    // future games can be appended here
];

export function initWindGame() {
    renderGameCards();
}

function renderGameCards() {
    const grid = document.getElementById('windgame-grid');
    if (!grid) return;
    grid.innerHTML = '';
    GAMES.forEach(g => {
        const card = document.createElement('div');
        card.className = 'game-card';

        // derive domain for favicon fallback
        let thumb = g.thumb || '';
        try {
            const urlObj = new URL(g.url);
            const domain = urlObj.hostname;
            if (!thumb) thumb = `https://www.google.com/s2/favicons?sz=256&domain=${domain}`;
        } catch (e) {
            if (!thumb) thumb = 'https://via.placeholder.com/400x200.png?text=Game';
        }

        card.innerHTML = `
            <img src="${thumb}" class="game-thumb" alt="${escapeHtml(g.title)}" />
            <div class="game-title">${escapeHtml(g.title)}</div>
            <div class="game-desc">${escapeHtml(g.desc)}</div>
            <div class="game-actions">
                <button class="btn-play" data-url="${g.url}">Chơi Ngay</button>
            </div>`;
        // 1. Gán sự kiện cho toàn bộ thẻ game (Card)
        card.onclick = () => {
            launchGame(g.url);
        };

        // 2. Gán sự kiện riêng cho nút "Chơi Ngay" để chặn bong bóng sự kiện (Event Bubbling)
        const btnPlay = card.querySelector('.btn-play');
        if (btnPlay) {
            btnPlay.onclick = (ev) => {
                ev.stopPropagation(); // Ngăn chặn sự kiện click lan truyền ngược lên thẻ card
                launchGame(g.url);
            };
        }

        grid.appendChild(card);
    });
}

export function launchGame(url) {
    // 1. Kiểm tra xem người dùng có đang dùng thiết bị di động (Mobile/Tablet) không
    // (Màn hình dưới 768px hoặc trình duyệt báo là thiết bị di động)
    const isMobile = window.innerWidth <= 768 || /Mobi|Android/i.test(navigator.userAgent);
    
    // 2. Nếu là Mobile, kích hoạt chế độ toàn màn hình
    if (isMobile) {
        requestMobileFullscreen();
    }

    const isLocalGame = url.includes('/games/');
    if (isLocalGame) {
        // Mark that we're launching a game so we can restore on return
        sessionStorage.setItem('returnToWindGame', 'true');
        console.log('Launching game - sessionStorage.returnToWindGame = true');
        // Navigate to local game
        window.location.href = url;
    } else {
        // For future online games - could embed in iframe
        openSafe(url);
    }

    function requestMobileFullscreen() {
    const elem = document.documentElement; // Lấy thẻ HTML gốc của trang web
    try {
        if (elem.requestFullscreen) {
            elem.requestFullscreen(); // Chuẩn chung
        } else if (elem.webkitRequestFullscreen) { 
            elem.webkitRequestFullscreen(); // Dành cho Safari (iOS) / Chrome cũ
        } else if (elem.msRequestFullscreen) { 
            elem.msRequestFullscreen(); // Dành cho Edge/IE cũ
        }
    } catch (error) {
        console.log("Không thể bật fullscreen:", error);
    }
}
}

// (removed open-in-new-tab button — games launch in current context)

// closeWindGame is deprecated
export function closeWindGame() {
    // This function is no longer needed as games now open in new context
    console.log('Games now open in new context - no iframe cleanup needed');
}
    // small helpers
    function escapeHtml(s) { return (s+'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
    function escapeJs(s) { return (s+'').replace(/'/g, "\\'").replace(/\n/g,'\\n'); }
