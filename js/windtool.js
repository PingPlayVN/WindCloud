import { openSafe } from './utils.js';

const TOOLS = [
    {
        id: 'tuvi',
        title: 'Tử Vi',
        desc: 'Lập lá số tử vi trực tuyến',
        thumb: './apps/tu_vi/thumbnail.svg',
        url: './apps/tu_vi/index.html'
    }
    // future tools can be appended here
];

export function initWindTool() {
    renderToolCards();
    registerToolFrameControls();
    registerToolExitListeners();
}

function renderToolCards() {
    const grid = document.getElementById('windtool-grid');
    if (!grid) return;
    grid.innerHTML = '';

    TOOLS.forEach((t) => {
        const card = document.createElement('div');
        card.className = 'game-card';

        const thumb = t.thumb || 'https://via.placeholder.com/400x200.png?text=Tool';
        card.innerHTML = `
            <img src="${thumb}" class="game-thumb" alt="${escapeHtml(t.title)}" />
            <div class="game-title">${escapeHtml(t.title)}</div>
            <div class="game-desc">${escapeHtml(t.desc)}</div>
            <div class="game-actions">
                <button class="btn-play" type="button">Mở</button>
            </div>`;

        card.onclick = () => openTool(t);

        const btn = card.querySelector('.btn-play');
        if (btn) {
            btn.onclick = (ev) => {
                ev.stopPropagation();
                openTool(t);
            };
        }

        grid.appendChild(card);
    });
}

function openTool(tool) {
    // Open as a fullscreen overlay (similar to Wind Game experience)
    openToolInFullscreenIframe(tool.url);
}

function closeTool() {
    const grid = document.getElementById('windtool-grid');
    const frameArea = document.getElementById('windtool-frame-area');
    const iframe = document.getElementById('windtoolFrame');
    const openTabBtn = document.getElementById('btnWindToolOpenTab');

    if (iframe && iframe.tagName === 'IFRAME') iframe.setAttribute('src', 'about:blank');
    if (openTabBtn) delete openTabBtn.dataset.url;

    if (frameArea) frameArea.style.display = 'none';
    if (grid) grid.style.display = '';
}

function registerToolFrameControls() {
    if (window.__windtoolControlsRegistered) return;
    window.__windtoolControlsRegistered = true;

    const backBtn = document.getElementById('btnWindToolBack');
    if (backBtn) backBtn.onclick = () => closeTool();

    const openTabBtn = document.getElementById('btnWindToolOpenTab');
    if (openTabBtn) {
        openTabBtn.onclick = () => {
            const url = openTabBtn.dataset.url;
            if (url) openSafe(url);
        };
    }
}

function registerToolExitListeners() {
    if (window.__windtoolExitListenersRegistered) return;
    window.__windtoolExitListenersRegistered = true;

    // Allow embedded tools to request closing the overlay via postMessage
    window.addEventListener('message', (ev) => {
        const data = ev && ev.data;
        if (!data || typeof data !== 'object') return;
        if (data.type !== 'windtool:exit') return;
        closeFullscreenToolOverlay();
    });
}

function openToolInFullscreenIframe(url) {
    closeFullscreenToolOverlay();

    const overlay = document.createElement('div');
    overlay.id = 'windtool-fullscreen-overlay';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.zIndex = '999999';
    overlay.style.background = '#000';

    const iframe = document.createElement('iframe');
    iframe.id = 'windtool-fullscreen-iframe';
    iframe.src = url;
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = '0';
    iframe.setAttribute('allowfullscreen', '');
    iframe.setAttribute('webkitallowfullscreen', '');
    iframe.setAttribute('allow', 'fullscreen; clipboard-read; clipboard-write');

    overlay.appendChild(iframe);
    document.body.appendChild(overlay);

    // Prevent background scroll while overlay is shown
    if (document.body.dataset.windtoolOverflow === undefined) {
        document.body.dataset.windtoolOverflow = document.body.style.overflow || '';
    }
    document.body.style.overflow = 'hidden';
}

function closeFullscreenToolOverlay() {
    const iframe = document.getElementById('windtool-fullscreen-iframe');
    const overlay = document.getElementById('windtool-fullscreen-overlay');

    if (iframe) iframe.src = 'about:blank';
    if (overlay) overlay.remove();

    // Restore background scroll
    if (document.body.dataset.windtoolOverflow !== undefined) {
        document.body.style.overflow = document.body.dataset.windtoolOverflow;
        delete document.body.dataset.windtoolOverflow;
    }

    try {
        if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen();
        else if (document.webkitFullscreenElement && document.webkitExitFullscreen) document.webkitExitFullscreen();
    } catch (e) {
        // ignore
    }
}

function escapeHtml(s) {
    return (s + '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
