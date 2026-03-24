import { openSafe } from './utils.js';

// Dynamic Wind Game card rendering + iframe host
const GAMES = [
    {
        id: 'tankbattle',
        title: 'Tank Battle',
        desc: 'Trò chơi chiến đấu xe tăng PvP',
        thumb: './games/tankbattle/thumnail.png',
        url: './games/tankbattle/index.html'
    },
    {
        id: 'tai_xiu',
        title: 'Tài Xỉu',
        desc: 'Game lắc xúc xắc Tài/Xỉu (card game)',
        thumb: './games/tai_xiu/thumnail.svg',
        url: './games/tai_xiu/index.html'
    }
    // future games can be appended here
];

export function initWindGame() {
    renderGameCards();
    registerGameExitListener();
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
            launchGame(g);
        };

        // 2. Gán sự kiện riêng cho nút "Chơi Ngay" để chặn bong bóng sự kiện (Event Bubbling)
        const btnPlay = card.querySelector('.btn-play');
        if (btnPlay) {
            btnPlay.onclick = (ev) => {
                ev.stopPropagation(); // Ngăn chặn sự kiện click lan truyền ngược lên thẻ card
                launchGame(g);
            };
        }

        grid.appendChild(card);
    });
}

export function launchGame(gameOrUrl) {
    const game = typeof gameOrUrl === 'string' ? { url: gameOrUrl, id: '' } : gameOrUrl;
    const url = game.url;
    const isLocalGame = url.includes('/games/');
    if (isLocalGame) {
        // Special case: on mobile, open Tai Xiu in a fullscreen iframe so fullscreen
        // can be triggered from the Play click (user gesture).
        if (game.id === 'tai_xiu' && isMobileDevice()) {
            openLocalGameInFullscreenIframe(url);
            return;
        }

        // Mark that we're launching a game so we can restore on return
        sessionStorage.setItem('returnToWindGame', 'true');
        console.log('Launching game - sessionStorage.returnToWindGame = true');
        // Navigate to local game
        window.location.href = url;
    } else {
        // For future online games - could embed in iframe
        openSafe(url);
    }
}

// (removed open-in-new-tab button — games launch in current context)

// closeWindGame is deprecated
export function closeWindGame() {
    // This function is no longer needed as games now open in new context
    console.log('Games now open in new context - no iframe cleanup needed');
}

function isMobileDevice() {
    try {
        const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
            navigator.userAgent
        );
        return isTouch || isMobileUA;
    } catch (e) {
        return false;
    }
}

function registerGameExitListener() {
    if (window.__windgameExitListenerRegistered) return;
    window.__windgameExitListenerRegistered = true;

    window.addEventListener('message', (ev) => {
        const data = ev && ev.data;
        if (!data || typeof data !== 'object') return;
        if (data.type !== 'windgame:exit') return;
        closeFullscreenGameOverlay();
    });

    document.addEventListener('fullscreenchange', () => {
        const overlay = document.getElementById('windgame-fullscreen-overlay');
        if (!overlay) return;
        // If user manually exits fullscreen, close overlay to return to Wind Game.
        if (!document.fullscreenElement) closeFullscreenGameOverlay();
    });
}

function openLocalGameInFullscreenIframe(url) {
    closeFullscreenGameOverlay();

    const overlay = document.createElement('div');
    overlay.id = 'windgame-fullscreen-overlay';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.zIndex = '999999';
    overlay.style.background = '#000';

    const iframe = document.createElement('iframe');
    iframe.id = 'windgame-fullscreen-iframe';
    iframe.src = url;
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = '0';
    iframe.setAttribute('allowfullscreen', '');
    iframe.setAttribute('webkitallowfullscreen', '');
    iframe.setAttribute('allow', 'fullscreen');

    // Fallback close button (top-right) in case the game fails to load / exit handler isn't reachable
    const closeBtn = document.createElement('button');
    closeBtn.id = 'windgame-fullscreen-exit';
    closeBtn.type = 'button';
    closeBtn.textContent = '×';
    closeBtn.style.position = 'fixed';
    closeBtn.style.top = '10px';
    closeBtn.style.right = '10px';
    closeBtn.style.zIndex = '1000000';
    closeBtn.style.background = 'rgba(0,0,0,0.85)';
    closeBtn.style.color = '#fff';
    closeBtn.style.border = '2px solid #ff6b6b';
    closeBtn.style.padding = '8px 14px';
    closeBtn.style.borderRadius = '999px';
    closeBtn.style.fontWeight = '700';
    closeBtn.style.fontSize = '22px';
    closeBtn.style.lineHeight = '1';
    closeBtn.style.cursor = 'pointer';
    closeBtn.onclick = () => closeFullscreenGameOverlay();

    overlay.appendChild(iframe);
    document.body.appendChild(overlay);
    document.body.appendChild(closeBtn);

    // Prevent background scroll while overlay is shown
    if (document.body.dataset.windgameOverflow === undefined) {
        document.body.dataset.windgameOverflow = document.body.style.overflow || '';
    }
    document.body.style.overflow = 'hidden';

    // Try to enter fullscreen from the click gesture.
    try {
        const request =
            iframe.requestFullscreen ||
            iframe.webkitRequestFullscreen ||
            overlay.requestFullscreen ||
            overlay.webkitRequestFullscreen;
        if (request) request.call(iframe.requestFullscreen ? iframe : overlay);
    } catch (e) {
        // Ignore: some mobile browsers (notably iOS Safari) do not support element fullscreen.
        // The overlay still provides an "app-like" full-viewport experience.
    }
}

function closeFullscreenGameOverlay() {
    const iframe = document.getElementById('windgame-fullscreen-iframe');
    const overlay = document.getElementById('windgame-fullscreen-overlay');
    const closeBtn = document.getElementById('windgame-fullscreen-exit');

    if (iframe) iframe.src = 'about:blank';
    if (overlay) overlay.remove();
    if (closeBtn) closeBtn.remove();

    // Restore background scroll
    if (document.body.dataset.windgameOverflow !== undefined) {
        document.body.style.overflow = document.body.dataset.windgameOverflow;
        delete document.body.dataset.windgameOverflow;
    }

    try {
        if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen();
        else if (document.webkitFullscreenElement && document.webkitExitFullscreen) document.webkitExitFullscreen();
    } catch (e) {
        // ignore
    }
}
    // small helpers
    function escapeHtml(s) { return (s+'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
    function escapeJs(s) { return (s+'').replace(/'/g, "\\'").replace(/\n/g,'\\n'); }
