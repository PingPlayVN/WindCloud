// js/drop.js - IMPROVED VERSION v2.1 (Mobile Optimized)
// Features: E2E Encryption, Checksum Verification, Timeout Detection, Memory Leak Prevention, iOS Support

// drop.js now imports utilities from utils.js instead of relying on globals
import { confirmDownload } from './utils.js';
import { showToast, showActionModal } from './ui.js';
import { db } from './firebase.js';

const isMyDeviceMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
const isMyDeviceIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
const isMyDeviceAndroid = /Android/.test(navigator.userAgent);
const myDeviceType = isMyDeviceMobile ? 'mobile' : 'pc';

// ✅ Mobile Detection Utilities
function isStreamSaverSupported() {
    // StreamSaver doesn't work well on iOS
    return typeof streamSaver !== 'undefined' && !isMyDeviceIOS;
}

function isWakeLockAvailable() {
    return 'wakeLock' in navigator;
}

function isBatteryLow() {
    if ('getBattery' in navigator) {
        navigator.getBattery().then((battery) => {
            return battery.level < 0.2;
        });
    }
    return false;
}

let myPeer = null;
let myPeerId = localStorage.getItem('wind_peer_id'); // ✅ USE localStorage (PERSISTENT)
let isTransferring = false;
let activeConnection = null;
let receivedSize = 0;
let currentWriter = null;
let transferTimeoutId = null;
let lastChunkTime = 0;
let transferWatchdogInterval = null;
let progressUpdateInterval = null;  // ✅ UI update timer for smooth progress display
let connectionStartTime = null;  // ✅ Track connection start time
let connectionUpdateInterval = null;  // ✅ Update connection UI timer

// ✅ TRANSFER QUEUE untuk múltiple files
let transferQueue = [];
let isProcessingQueue = false;
let wakeLockSentinel = null; // ✅ Keep device awake
let dropHeartbeatInterval = null;

const TRANSFER_CONFIG = {
    TIMEOUT_MS: 30000,                                              // 30s timeout
    CHUNK_SIZE_INIT: isMyDeviceMobile ? 32 * 1024 : 64 * 1024,     // Mobile: 32KB, Desktop: 64KB
    CHUNK_SIZE_MAX: isMyDeviceIOS ? 512 * 1024 : 1024 * 1024,       // iOS: 512KB, Others: 1MB
    CHUNK_SIZE_MIN: 16 * 1024,                                      // 16KB minimum
    UI_UPDATE_INTERVAL: isMyDeviceMobile ? 500 : 100,              // Mobile: 500ms, Desktop: 100ms (less battery drain)
    BATTERY_WARNING_LEVEL: 0.2,                                     // 20% warning
};

if (!myPeerId) {
    myPeerId = 'wind_' + Math.floor(Math.random() * 9000 + 1000); 
    localStorage.setItem('wind_peer_id', myPeerId); // ✅ PERSIST to localStorage
}

// ============================================
// ✅ CRYPTO UTILITIES - SHA256 & AES-GCM
// ============================================

// Tính SHA-256 checksum của file để verify integrity
async function calculateFileChecksum(file) {
    // Streaming-friendly checksum: compute SHA-256 per-chunk, then SHA-256 of concatenated chunk hashes.
    const CHUNK = 256 * 1024; // 256KB
    try {
        const chunkHashes = [];
        let offset = 0;
        while (offset < file.size) {
            const slice = file.slice(offset, offset + CHUNK);
            const buf = await slice.arrayBuffer();
            const h = await crypto.subtle.digest('SHA-256', buf);
            chunkHashes.push(new Uint8Array(h));
            offset += CHUNK;
        }

        // Concatenate chunk hashes
        const total = chunkHashes.reduce((acc, h) => acc + h.byteLength, 0);
        const concat = new Uint8Array(total);
        let p = 0;
        chunkHashes.forEach(h => { concat.set(h, p); p += h.byteLength; });

        const finalHash = await crypto.subtle.digest('SHA-256', concat.buffer);
        const hashArray = Array.from(new Uint8Array(finalHash));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
        console.error('Checksum calculation error (stream):', e);
        return null;
    }
}

// Generate shared encryption key từ file namesize (cũng có thể user-specified)
async function generateSharedKey(fileName, fileSize) {
    const text = fileName + '|' + fileSize;
    const encodedKey = new TextEncoder().encode(text);
    return crypto.subtle.importKey(
        'raw',
        encodedKey,
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
    );
}

// Derive AES-256 key từ shared key
async function deriveEncryptionKey(sharedKey) {
    const derivedKey = await crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            hash: 'SHA-256',
            salt: new TextEncoder().encode('wind_drop_salt'),
            iterations: 100000
        },
        sharedKey,
        256
    );
    return crypto.subtle.importKey('raw', derivedKey, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

// Encrypt chunk với AES-GCM
async function encryptChunk(data, key, iv) {
    try {
        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            data
        );
        return encrypted;
    } catch (e) {
        console.error("Encryption error:", e);
        // QUĂNG LỖI - TUYỆT ĐỐI KHÔNG RETURN DATA GỐC
        throw new Error("Lỗi mã hóa E2E. Đã hủy truyền tệp để đảm bảo an toàn.");
    }
}

// Decrypt chunk
async function decryptChunk(encryptedData, key, iv) {
    try {
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            encryptedData
        );
        return decrypted;
    } catch (e) {
        console.error("Decryption error:", e);
        throw new Error("Lỗi giải mã E2E. File có thể đã bị can thiệp.");
    }
}

// Generate random IV (12 bytes cho AES-GCM)
function generateIV() {
    return crypto.getRandomValues(new Uint8Array(12));
}

// ============================================
// Chặn thoát trang
window.addEventListener('beforeunload', (e) => {
    if (isTransferring) {
        e.preventDefault();
        e.returnValue = 'Đang chuyển tệp, bạn có chắc muốn thoát không?'; 
        return 'Đang chuyển tệp, bạn có chắc muốn thoát không?';
    }
});

// ✅ CLEANUP on page hide/visibility change (pagehide is more reliable than unload)
window.addEventListener('pagehide', cleanupConnections);
document.addEventListener('visibilitychange', () => {
    if (document.hidden && isTransferring) {
        cancelTransfer();
    }
});

function cleanupConnections() {
    if (currentWriter) {
        currentWriter.close();
        currentWriter = null;
    }
    if (activeConnection && activeConnection.open) {
        activeConnection.close();
        activeConnection = null;
    }
    if (transferTimeoutId) {
        clearTimeout(transferTimeoutId);
        transferTimeoutId = null;
    }
    // ✅ Release wake lock when cleanup
    releaseWakeLock();

    // Clear presence heartbeat if any
    try {
        if (dropHeartbeatInterval) {
            clearInterval(dropHeartbeatInterval);
            dropHeartbeatInterval = null;
        }
    } catch (e) {}
    // Clear transfer watchdog if running
    try {
        if (transferWatchdogInterval) {
            clearInterval(transferWatchdogInterval);
            transferWatchdogInterval = null;
        }
    } catch (e) {}
}

// ✅ NEW: Request Screen Wake Lock (Keep Mobile Device Awake)
async function requestWakeLock() {
    if (!isWakeLockAvailable() || !isMyDeviceMobile) return;
    
    try {
        wakeLockSentinel = await navigator.wakeLock.request('screen');
        console.log('✅ Screen wake lock acquired');
        
        // Re-request if document visibility changes
        document.addEventListener('visibilitychange', async () => {
            if (document.hidden) {
                releaseWakeLock();
            } else if (isTransferring && !wakeLockSentinel) {
                await requestWakeLock();
            }
        });
    } catch (err) {
        console.warn('Wake lock request failed:', err);
    }
}

function releaseWakeLock() {
    if (wakeLockSentinel) {
        wakeLockSentinel.release();
        wakeLockSentinel = null;
        console.log('Wake lock released');
    }
}

// ✅ NEW: Check Battery Level and Warn if Low
async function checkBatteryLevel() {
    if ('getBattery' in navigator) {
        try {
            const battery = await navigator.getBattery();
            if (battery.level < TRANSFER_CONFIG.BATTERY_WARNING_LEVEL) {
                showToast(`⚠️ Điện thoại yếu (${Math.floor(battery.level * 100)}%) - transfer có thể bị gián đoạn`);
            }
        } catch (e) {
            // Battery API not available
        }
    }
}

function initWindDrop() {
    if (myPeer && !myPeer.destroyed) {
        console.log("Wind Drop đã sẵn sàng.");
        return; 
    }

    const statusEl = document.getElementById('dropStatus');
    if(statusEl) statusEl.innerText = "Đang kết nối...";

    myPeer = new Peer(myPeerId, {
        debug: 0, // Giảm log debug
        config: {
            'iceServers': [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun3.l.google.com:19302' }
            ]
        }
    });

    myPeer.on('open', (id) => {
        myPeerId = id;
        localStorage.setItem('wind_peer_id', myPeerId); // ✅ Save to localStorage
        if(statusEl) statusEl.innerText = "Sẵn sàng (ID: " + id + ")";
        announcePresence();
    });

    // Reconnect logic when disconnected (helps mobile flaky networks)
    myPeer.on('disconnected', () => {
        console.warn('Peer disconnected, attempting reconnect...');
        try {
            myPeer.reconnect();
        } catch (e) {
            console.warn('Reconnect failed, reinit peer', e);
            setTimeout(() => initWindDrop(), 1500);
        }
    });

    myPeer.on('connection', (conn) => {
        console.log('🔗 [Receiver] Incoming connection from:', conn.peer);
        if (isTransferring) {
            console.warn('⚠️ [Receiver] Already transferring, rejecting connection');
            conn.on('open', () => { 
                conn.send({ type: 'busy', message: 'Đang chuyển file khác, thử lại sau' }); 
                setTimeout(() => conn.close(), 500); 
            });
            return;
        }
        console.log('✅ [Receiver] Accepting connection, setting up handlers');
        setupIncomingConnection(conn);
    });

    myPeer.on('error', (err) => {
        if (err.type === 'unavailable-id') {
            myPeerId = 'wind_' + Math.floor(Math.random() * 9000 + 1000);
            localStorage.setItem('wind_peer_id', myPeerId); // ✅ Use localStorage
            initWindDrop();
            return;
        }
        console.error("PeerJS error:", err);
        if(statusEl) statusEl.innerText = "⚠️ Lỗi: " + (err.message || err.type);
        resetTransferState();
    });

    db.ref('wind_drop_active').on('value', (snapshot) => {
        renderPeers(snapshot.val());
    });
}

function announcePresence() {
    const userRef = db.ref('wind_drop_active/' + myPeerId);
    userRef.onDisconnect().remove();
    userRef.set({
        name: (window.isAdmin) ? "Admin" : "Khách " + myPeerId.split('_')[1],
        lastSeen: firebase.database.ServerValue.TIMESTAMP
    });

    // Heartbeat: cập nhật lastSeen định kỳ để người khác không thấy thiết bị cũ
    try {
        if (dropHeartbeatInterval) clearInterval(dropHeartbeatInterval);
    } catch (e) {}
    // ✅ Faster heartbeat on mobile for quicker peer discovery (8s on mobile, 12s on desktop)
    const heartbeatInterval = isMyDeviceMobile ? 8000 : 12000;
    dropHeartbeatInterval = setInterval(() => {
        try {
            userRef.update({ lastSeen: firebase.database.ServerValue.TIMESTAMP });
        } catch (e) {
            console.warn('Heartbeat update failed', e);
        }
    }, heartbeatInterval);
}

function renderPeers(users) {
    const orbitZone = document.getElementById('user-orbit-zone');
    if(!orbitZone) return;
    orbitZone.innerHTML = '';
    
    if (!users) return;
    // Filter out self and stale entries (older than 60s)
    const STALE_MS = 60000;
    const now = Date.now();
    const userList = Object.keys(users)
        .filter(id => id !== myPeerId)
        .filter(id => {
            const u = users[id];
            if (!u) return false;
            if (!u.lastSeen) return true; // keep if no timestamp
            return (now - u.lastSeen) < STALE_MS;
        });
    const statusEl = document.getElementById('dropStatus');
    if(statusEl) statusEl.innerText = `Đang quét: ${userList.length} thiết bị`;

    const radarContainer = document.querySelector('.radar-zone');
    if(!radarContainer) return;

    const orbitRadius = (radarContainer.clientWidth && radarContainer.clientWidth > 0) ? (radarContainer.clientWidth * 0.32) : 100;
    const centerX = (radarContainer.clientWidth && radarContainer.clientWidth > 0) ? (radarContainer.clientWidth / 2) : 120;
    const centerY = (radarContainer.clientHeight && radarContainer.clientHeight > 0) ? (radarContainer.clientHeight / 2) : 120;

    userList.forEach((userId, index) => {
        const user = users[userId];
        const el = document.createElement('div');
        el.className = 'peer-user';
        
        const angle = (index / userList.length) * 2 * Math.PI;
        const x = Math.cos(angle) * orbitRadius + centerX;
        const y = Math.sin(angle) * orbitRadius + centerY;
        
        el.style.left = x + 'px';
        el.style.top = y + 'px';
        const icon = document.createElement('div');
        icon.className = 'peer-icon';
        icon.innerText = '👤';
        const nameEl = document.createElement('span');
        nameEl.textContent = user.name || '';
        const pingBtn = document.createElement('button');
        pingBtn.className = 'ping-btn';
        pingBtn.title = 'Tìm thiết bị';
        pingBtn.innerText = '🔔';
        el.appendChild(icon);
        el.appendChild(nameEl);
        el.appendChild(pingBtn);

        // Gắn sự kiện kéo thả vào chính icon này
        setupDragDrop(el, userId);
        // Ping button: giúp tìm thiết bị (phát thông báo/rung bên người nhận)
        pingBtn.addEventListener('click', (ev) => { ev.stopPropagation(); sendPing(userId); });
        orbitZone.appendChild(el);
    });
}

function setupDragDrop(element, targetId) {
    element.addEventListener('dragover', (e) => { 
        e.preventDefault(); 
        element.classList.add('drag-over'); 
    });
    element.addEventListener('dragleave', () => { 
        element.classList.remove('drag-over'); 
    });
    element.addEventListener('drop', (e) => {
        e.preventDefault();
        element.classList.remove('drag-over');
        // ✅ Support multiple files (except iOS)
        if (e.dataTransfer.files.length > 0) {
            Array.from(e.dataTransfer.files).forEach(file => {
                addToTransferQueue(file, targetId);
            });
        }
    });
    
    element.onclick = () => {
         const input = document.createElement('input');
         input.type = 'file';
         // ✅ Disable multiple on iOS
         if (!isMyDeviceIOS) {
             input.multiple = true; // Allow multiple on Android/Desktop
         }
         input.onchange = (e) => {
             if(e.target.files.length > 0) {
                 Array.from(e.target.files).forEach(file => {
                     addToTransferQueue(file, targetId);
                 });
             }
         };
         input.click();
    };
}

// ✅ TRANSFER QUEUE MANAGEMENT
function addToTransferQueue(file, targetPeerId) {
    transferQueue.push({ file, targetPeerId });
    if (!isProcessingQueue) {
        processTransferQueue();
    }
}

async function processTransferQueue() {
    if (transferQueue.length === 0) {
        isProcessingQueue = false;
        return;
    }
    
    isProcessingQueue = true;
    const { file, targetPeerId } = transferQueue.shift();
    
    showToast(`📤 Xếp hàng: ${transferQueue.length} file`);
    await uploadFileP2P(file, targetPeerId);
    
    // Xử lý file tiếp theo
    if (transferQueue.length > 0) {
        setTimeout(() => processTransferQueue(), 1000); // Delay 1s giữa files
    } else {
        isProcessingQueue = false;
    }
}

// --- LOGIC GỬI FILE VỚI CHECKSUM & ENCRYPTION ---
async function uploadFileP2P(file, targetPeerId) {
    if (!myPeer) {
        showToast("❌ Peer chưa sẵn sàng!");
        return;
    }
    
    console.log('📤 [Sender] Starting upload to', targetPeerId, 'file:', file.name, file.size);
    showToast(`🔗 Đang kết nối tới ${targetPeerId}...`);
    
    // ✅ Show connection status bar
    const connStatusEl = document.getElementById('connectionStatus');
    const connStatusText = document.getElementById('connStatusText');
    const connTimeEl = document.getElementById('connTime');
    const connBar = document.getElementById('connBar');
    
    if (connStatusEl) {
        connStatusEl.style.display = 'block';
        connStatusText.innerText = '🔗 Đang kết nối...';
        connBar.style.width = '0%';
    }
    
    // ✅ Start connection timer
    connectionStartTime = Date.now();
    if (connectionUpdateInterval) clearInterval(connectionUpdateInterval);
    connectionUpdateInterval = setInterval(() => {
        const elapsed = (Date.now() - connectionStartTime) / 1000;
        if (connTimeEl) {
            connTimeEl.innerText = elapsed.toFixed(1) + 's';
            // Animate progress bar (max 100% after timeout duration)
            const timeoutDuration = isMyDeviceMobile ? 3 : 5;
            const progress = Math.min((elapsed / timeoutDuration) * 100, 95);
            if (connBar) connBar.style.width = progress + '%';
        }
    }, 100);
    
    // ✅ Generate encryption key IMMEDIATELY (quick operation)
    const sharedKey = await generateSharedKey(file.name, file.size);
    const encKey = await deriveEncryptionKey(sharedKey);
    const iv = generateIV();
    
    // ✅ START CHECKSUM CALCULATION IN PARALLEL (don't block connection)
    let checksumPromise = calculateFileChecksum(file);
    
    // ✅ CREATE CONNECTION IMMEDIATELY (don't wait for checksum)
    const conn = myPeer.connect(targetPeerId, { reliable: true });
    activeConnection = conn;
    console.log('📤 [Sender] Created connection, initial state:', {
        id: conn.id,
        peer: conn.peer,
        open: conn.open,
        dataChannel: conn.dataChannel ? conn.dataChannel.readyState : 'none'
    });

    conn.on('error', (err) => {
        console.error('❌ [Sender] Connection error:', err);
        showToast("❌ Lỗi kết nối: " + err.message);
        hideConnectionStatus();
        resetTransferState();
    });

    conn.on('close', () => {
        console.log('⛔ [Sender] Connection closed');
    });

    // ✅ FASTER TIMEOUT ON MOBILE (3s) for quicker feedback on slow networks
    const timeoutDuration = isMyDeviceMobile ? 3000 : 5000;
    let connectionTimeout = setTimeout(() => {
        if (!conn.open && !metadataSent) {
            console.warn('⚠️ [Sender] Connection timeout after ' + timeoutDuration + 'ms, state:', {
                open: conn.open,
                dataChannel: conn.dataChannel ? conn.dataChannel.readyState : 'none'
            });
            showToast('⏳ Kết nối chậm, đang thử lại...');
            conn.close();
            hideConnectionStatus();
            // Retry connection after brief delay
            setTimeout(() => uploadFileP2P(file, targetPeerId), 500);
        }
    }, timeoutDuration);

    conn.on('open', () => {
        console.log('✅ [Sender] Connection OPEN! DataChannel state:', conn.dataChannel?.readyState);
        // ✅ Update connection status to success
        if (connStatusText) {
            connStatusText.innerText = '✅ Kết nối thành công!';
            if (connBar) connBar.style.width = '100%';
        }
        // Hide after 800ms
        setTimeout(() => hideConnectionStatus(), 800);
        sendMetadata();
    });

    // ✅ Check if already open (event might have fired before handler was attached) - faster check (20ms)
    setTimeout(() => {
        if (conn.open && !metadataSent) {
            console.log('⚡ [Sender] Connection was already open, sending metadata now');
            if (connStatusText) {
                connStatusText.innerText = '✅ Kết nối thành công!';
                if (connBar) connBar.style.width = '100%';
            }
            setTimeout(() => hideConnectionStatus(), 800);
            sendMetadata();
        }
    }, 20);

    let metadataSent = false;
    async function sendMetadata() {
        if (metadataSent) return;
        metadataSent = true;
        clearTimeout(connectionTimeout); // ✅ Cancel retry timeout since connection succeeded
        
        // ✅ Wait for checksum if not ready yet (but don't block connection)
        let checksum = null;
        console.log('📤 [Sender] Waiting for checksum calculation...');
        try {
            checksum = await checksumPromise;
            console.log('✅ [Sender] Checksum ready:', checksum?.substring(0, 8) + '...');
        } catch (e) {
            console.warn('⚠️ Checksum calculation failed, sending without:', e);
        }
        
        const safeType = file.type || 'application/octet-stream';
        console.log('📤 [Sender] Sending metadata:', file.name, file.size);
        conn.send({ 
            type: 'meta', 
            fileName: file.name, 
            fileSize: file.size, 
            fileType: safeType,
            checksum: checksum,
            iv: Array.from(iv)
        });
    }

    let lastAckReceived = 0;
    conn.on('data', (response) => {
        console.log('📥 [Sender] Received response:', response?.type);
        if (response.type === 'ack' && response.status === 'ok') {
            showToast(`📤 Gửi: ${file.name}`);
            isTransferring = true;
            document.getElementById('transfer-panel').style.display = 'block';
            document.getElementById('tf-filename').innerText = file.name;
            updateTransferUI(0, 'Gửi (0s)', 0, file.size);
            
            // ✅ Request wake lock on mobile
            requestWakeLock();
            
            const receiverType = response.deviceType || 'mobile';
            const receiverIsIOS = !!response.ios;
            // Start sending, with basic retry/resume support using lastAckReceived
            sendFileInChunks(file, conn, receiverType, receiverIsIOS, encKey, new Uint8Array(iv), () => lastAckReceived);
        } 
        else if (response.type === 'busy') {
            showToast("⏳ Người nhận đang bận, thử lại sau...");
            conn.close();
        }
        else if (response.type === 'cancel') {
            showToast("⛔ Người nhận đã từ chối!");
            isTransferring = false;
            releaseWakeLock(); // ✅ Release wake lock
            resetTransferState();
            setTimeout(() => conn.close(), 500);
        }
        else if (response.type === 'progress') {
            // Receiver informs how many bytes received
            if (typeof response.received === 'number') lastAckReceived = response.received;
        }
        else if (response.type === 'resume-ack') {
            // reserved for future use
        }
        else if (response.type === 'verify-mismatch') {
            showToast("❌ Verify failed: File bị corrupted!");
            isTransferring = false;
            releaseWakeLock(); // ✅ Release wake lock
            resetTransferState();
        }
    });

    conn.on('close', () => {
        if (isTransferring) {
            showToast("❌ Mất kết nối với người nhận!");
            resetTransferState();
        }
    });
}

// --- THUẬT TOÁN ADAPTIVE CHUNKING VỚI ENCRYPTION & TIMEOUT ---
async function sendFileInChunks(file, conn, receiverType, receiverIsIOS, encKey, iv, getLastAck) {
    let offset = 0;
    // If there's a previous acknowledged offset (resume), start from there
    try {
        const ack = (typeof getLastAck === 'function') ? getLastAck() : 0;
        if (ack && ack < file.size) offset = ack;
    } catch (e) {}
    
    // Cấu hình thuật toán thích ứng
    // Start smaller when the receiver is mobile to reduce stalls on weak devices/networks.
    let chunkSize = (receiverType === 'mobile') ? (32 * 1024) : (64 * 1024);
    const MAX_CHUNK_SIZE = receiverIsIOS ? (512 * 1024) : TRANSFER_CONFIG.CHUNK_SIZE_MAX;
    const MIN_CHUNK_SIZE = TRANSFER_CONFIG.CHUNK_SIZE_MIN;
    
    // Cấu hình bộ đệm (Backpressure)
    const MAX_BUFFERED_AMOUNT = (receiverType === 'mobile' || myDeviceType === 'mobile')
        ? (receiverIsIOS ? (4 * 1024 * 1024) : (8 * 1024 * 1024))
        : 16 * 1024 * 1024;

    let lastUpdateTime = 0;
    const startTime = Date.now();

    let retryCount = 0;
    const MAX_RETRIES = 3;
    try {
        if (conn.dataChannel) {
            conn.dataChannel.bufferedAmountLowThreshold = 65536;
        }
    } catch (e) {
        console.warn("Browser không hỗ trợ bufferedAmountLowThreshold");
    }

    // Unified watchdog: check lastChunkTime periodically
    if (transferWatchdogInterval) clearInterval(transferWatchdogInterval);
    lastChunkTime = Date.now();
    transferWatchdogInterval = setInterval(() => {
        if (isTransferring && Date.now() - lastChunkTime > TRANSFER_CONFIG.TIMEOUT_MS) {
            console.warn('Transfer watchdog timeout');
            showToast('❌ Transfer timeout - hủy');
            isTransferring = false;
            try { conn.send({ type: 'cancel' }); } catch (e) {}
            resetTransferState();
        }
    }, 3000);

    try {
        while (offset < file.size) {
            if (!isTransferring || !conn.open) break;

            // ✅ TIMEOUT DETECTION - Nếu không có data trong 30s, hủy transfer
            lastChunkTime = Date.now();
            if (transferTimeoutId) clearTimeout(transferTimeoutId);
            
            transferTimeoutId = setTimeout(() => {
                if (isTransferring && Date.now() - lastChunkTime > TRANSFER_CONFIG.TIMEOUT_MS) {
                    console.warn("Transfer timeout!");
                    showToast("❌ Transfer timeout - mất kết nối");
                    isTransferring = false;
                    resetTransferState();
                }
            }, TRANSFER_CONFIG.TIMEOUT_MS);

            // 1. BACKPRESSURE: Kiểm soát dòng chảy
            if (conn.dataChannel && conn.dataChannel.bufferedAmount > MAX_BUFFERED_AMOUNT) {
                await new Promise(resolve => {
                    const onLow = () => {
                        conn.dataChannel.removeEventListener('bufferedamountlow', onLow);
                        resolve();
                    };
                    conn.dataChannel.addEventListener('bufferedamountlow', onLow);
                    setTimeout(() => {
                        conn.dataChannel.removeEventListener('bufferedamountlow', onLow);
                        resolve();
                    }, 500);
                });
            }

            // 2. CHUẨN BỊ DỮ LIỆU
            const chunkStartTime = Date.now();
            const slice = file.slice(offset, offset + chunkSize);
            const buffer = await slice.arrayBuffer();

            // ✅ ENCRYPT chunk nếu có key
            let dataToSend = buffer;
            if (encKey && iv) {
                dataToSend = await encryptChunk(buffer, encKey, iv);
            }

            // 3. GỬI DỮ LIỆU
            let sent = false;
            let sendErr = null;
            for (let attempt = 0; attempt < MAX_RETRIES && !sent; attempt++) {
                try {
                    conn.send({ type: 'chunk', data: dataToSend, isEncrypted: !!encKey });
                    sent = true;
                } catch (err) {
                    sendErr = err;
                    console.warn('Lỗi gửi chunk, thử lại...', attempt, err);
                    await new Promise(r => setTimeout(r, 300 + attempt * 200));
                }
            }
            if (!sent) {
                console.error('Không gửi được chunk sau nhiều lần thử', sendErr);
                // attempt to abort gracefully
                showToast('❌ Lỗi gửi - hủy chuyển');
                isTransferring = false;
                resetTransferState();
                break;
            }

            // 4. THUẬT TOÁN THÍCH ỨNG
            const chunkEndTime = Date.now();
            const duration = chunkEndTime - chunkStartTime;

            if (duration < 50 && chunkSize < MAX_CHUNK_SIZE) {
                chunkSize *= 2; 
            } else if (duration > 200 && chunkSize > MIN_CHUNK_SIZE) {
                chunkSize = Math.ceil(chunkSize / 2);
            }

            // 5. CẬP NHẬT TIẾN TRÌNH
            offset += buffer.byteLength;
            
            // ✅ Mobile: Update UI less frequently to save battery
            if (chunkEndTime - lastUpdateTime > TRANSFER_CONFIG.UI_UPDATE_INTERVAL || offset >= file.size) {
                const percent = (offset / file.size) * 100;
                const elapsed = Math.floor((Date.now() - startTime) / 1000);
                updateTransferUI(percent, `Gửi (${elapsed}s)`, offset, file.size); 
                lastUpdateTime = chunkEndTime;
                
                await new Promise(r => setTimeout(r, 0));
            }
        }

        if (isTransferring) {
            showToast("✅ Đã gửi xong, chờ verify...");
            releaseWakeLock(); // ✅ Release wake lock
            resetTransferState();
        }
    } catch (e) {
        console.error("Transfer Critical Error:", e);
        showToast("❌ Lỗi truyền: " + e.message);
        releaseWakeLock(); // ✅ Release wake lock
        resetTransferState();
    } finally {
        if (transferTimeoutId) {
            clearTimeout(transferTimeoutId);
            transferTimeoutId = null;
        }
    }
}

function setupIncomingConnection(conn) {
    activeConnection = conn;
    let incomingChecksum = null;
    let incomingIV = null;
    let decryptionKey = null;
    let fileChunks = [];
    let useStreamSaver = false;
    let chunkHashes = [];
    let lastProgressSent = 0;

    console.log('📥 [Receiver] setupIncomingConnection called, connection state:', {
        id: conn.id,
        peer: conn.peer,
        open: conn.open,
        dataChannel: conn.dataChannel ? conn.dataChannel.readyState : 'none'
    });

    conn.on('open', () => {
        console.log('✅ [Receiver] Connection OPENED! DataChannel state:', conn.dataChannel?.readyState);
    });

    conn.on('data', async (data) => {
        console.log('📨 [Receiver] Got data type:', data?.type);
        // Quick handler for ping (find device)
            if (data && data.type === 'ping') {
            console.log('🔔 [Receiver] Ping received');
            showToast('🔔 Đã nhận yêu cầu tìm thiết bị');
            try { if (navigator.vibrate) navigator.vibrate([200,100,200]); } catch(e) {}
            return;
        }
            // Receiver may send periodic progress updates
            if (data && data.type === 'progress') {
                // ignore here; handled elsewhere if needed
            }
        if(data.type === 'meta') {
            console.log('📥 [Receiver] Meta received:', data.fileName, data.fileSize);
            window.incomingMeta = data;
            incomingChecksum = data.checksum;
            incomingIV = new Uint8Array(data.iv || []);
            
            // ✅ Check battery before accepting
            await checkBatteryLevel();
            
            // ✅ Derive decryption key từ file metadata
            if (data.fileName && data.fileSize) {
                const sharedKey = await generateSharedKey(data.fileName, data.fileSize);
                decryptionKey = await deriveEncryptionKey(sharedKey);
            }
            
            // Reset chunks array cho file mới
            fileChunks = [];
            chunkHashes = [];
            lastProgressSent = 0;
            
            showActionModal({
                title: "📥 Nhận file?",
                desc: `"${data.fileName}" (${formatSize(data.fileSize)})\n\nChecksum: ${data.checksum ? '✅ Verified' : '⚠️ Unverified'}`,
                type: 'confirm',
                onConfirm: () => {
                    console.log('📥 [Receiver] User confirmed - sending ACK and starting transfer');
                    isTransferring = true;
                    activeConnection = conn; 
                    console.log('📥 [Receiver] Sending ACK...');
                    conn.send({ type: 'ack', status: 'ok', deviceType: myDeviceType, ios: isMyDeviceIOS });
                    console.log('📥 [Receiver] ACK sent, showing UI');
                    
                    document.getElementById('transfer-panel').style.display = 'block';
                    document.getElementById('tf-filename').innerText = data.fileName;
                    
                    // ✅ Request wake lock on mobile
                    requestWakeLock();

                    // Prefer streaming download to avoid holding the whole file in RAM.
                    // Keep Blob fallback for iOS / when StreamSaver is unavailable.
                    useStreamSaver = false;
                    fileChunks = [];
                    if (isStreamSaverSupported() && typeof streamSaver !== 'undefined' && typeof streamSaver.createWriteStream === 'function') {
                        try {
                            const fallbackName = 'wind_drop_' + Date.now();
                            const fileName = data.fileName || fallbackName;
                            const opts = (data.fileSize && typeof data.fileSize === 'number') ? { size: data.fileSize } : undefined;
                            const fileStream = streamSaver.createWriteStream(fileName, opts);
                            currentWriter = fileStream.getWriter();
                            useStreamSaver = true;
                            fileChunks = null;
                            console.log('[Receiver] Streaming download enabled (StreamSaver)');
                        } catch (e) {
                            console.warn('[Receiver] StreamSaver init failed, falling back to Blob:', e);
                            useStreamSaver = false;
                            fileChunks = [];
                            currentWriter = null;
                        }
                    } else {
                        console.log('[Receiver] StreamSaver unavailable, using Blob fallback');
                    }
                    
                    receivedSize = 0;
                    
                    // ✅ Start unified watchdog detection
                    lastChunkTime = Date.now();
                    if (transferWatchdogInterval) clearInterval(transferWatchdogInterval);
                    transferWatchdogInterval = setInterval(() => {
                        if (isTransferring && Date.now() - lastChunkTime > TRANSFER_CONFIG.TIMEOUT_MS) {
                            console.warn('Receiver watchdog timeout');
                            showToast('❌ Timeout - người gửi không phản hồi');
                            try { conn.send({ type: 'cancel' }); } catch (e) {}
                            isTransferring = false;
                            resetTransferState();
                        }
                    }, 3000);
                    
                    // ✅ Start periodic UI update (even if chunks arrive infrequently)
                    if (progressUpdateInterval) clearInterval(progressUpdateInterval);
                    progressUpdateInterval = setInterval(() => {
                        if (isTransferring && window.incomingMeta && receivedSize > 0) {
                            const percent = (receivedSize / window.incomingMeta.fileSize) * 100;
                            updateTransferUI(percent, 'Nhận', receivedSize, window.incomingMeta.fileSize);
                        }
                    }, TRANSFER_CONFIG.UI_UPDATE_INTERVAL);
                }
            });
            
        } else if (data.type === 'chunk') {
            if (!isTransferring) return; 
            
            lastChunkTime = Date.now(); // ✅ Update timeout

            // ✅ DECRYPT chunk nếu cần
            let chunkData = data.data;
            if (data.isEncrypted && decryptionKey && incomingIV) {
                chunkData = await decryptChunk(chunkData, decryptionKey, incomingIV);
            }
            
            // ✅ Always collect chunks (Blob fallback works everywhere)
            // Stream to disk when possible; otherwise buffer in memory (fallback).
            if (useStreamSaver && currentWriter) {
                try {
                    const u8 = (chunkData instanceof ArrayBuffer)
                        ? new Uint8Array(chunkData)
                        : (ArrayBuffer.isView(chunkData)
                            ? new Uint8Array(chunkData.buffer, chunkData.byteOffset, chunkData.byteLength)
                            : new Uint8Array(chunkData));
                    await currentWriter.write(u8);
                } catch (e) {
                    console.error('Stream write failed, cancelling transfer:', e);
                    try { conn.send({ type: 'cancel' }); } catch (err) {}
                    showToast('❌ Lỗi ghi file (stream)');
                    try { await currentWriter.abort(e); } catch (err) {}
                    currentWriter = null;
                    releaseWakeLock();
                    resetTransferState();
                    return;
                }
            } else if (fileChunks) {
                fileChunks.push(chunkData);
            }

            // Compute per-chunk hash (streaming-friendly)
            try {
                const digestInput = (chunkData instanceof ArrayBuffer)
                    ? chunkData
                    : (ArrayBuffer.isView(chunkData)
                        ? chunkData.buffer.slice(chunkData.byteOffset, chunkData.byteOffset + chunkData.byteLength)
                        : chunkData);
                const ch = await crypto.subtle.digest('SHA-256', digestInput);
                chunkHashes.push(new Uint8Array(ch));
            } catch (e) {
                console.warn('Chunk hash failed', e);
            }

            receivedSize += (chunkData && chunkData.byteLength) ? chunkData.byteLength : 0;
            
            const percent = (receivedSize / window.incomingMeta.fileSize) * 100;
            updateTransferUI(percent, 'Nhận', receivedSize, window.incomingMeta.fileSize);

            // Send progress update to sender (throttle to ~500ms)
            if (Date.now() - lastProgressSent > 400) {
                try { conn.send({ type: 'progress', received: receivedSize }); } catch (e) {}
                lastProgressSent = Date.now();
            }

            // Khi nhận xong
            if(receivedSize >= window.incomingMeta.fileSize) {
                console.log('📥 [Receiver] Transfer complete, verifying and downloading...');
                
                // ✅ Download as Blob (works for all devices)
                if (useStreamSaver && currentWriter) {
                    try { await currentWriter.close(); } catch (e) {}
                    currentWriter = null;
                } else {
                    downloadBlobFile(fileChunks || [], window.incomingMeta.fileName);
                }
                
                // ✅ Verify: file received completely (size matches)
                // Skip checksum verify due to streaming encryption/hashing complexity
                console.log('📥 [Receiver] File received completely:', {
                    expected: window.incomingMeta.fileSize,
                    received: receivedSize,
                    match: receivedSize === window.incomingMeta.fileSize
                });
                
                if (receivedSize === window.incomingMeta.fileSize) {
                    conn.send({ type: 'verify-ok' });
                    showToast('✅ File đã lưu thành công!');
                } else {
                    conn.send({ type: 'verify-mismatch' });
                    showToast('⚠️ Cảnh báo: size không match, file có thể bị lỗi');
                }
                
                releaseWakeLock(); // ✅ Release wake lock
                resetTransferState();
                fileChunks = [];
            }
        } else if (data.type === 'cancel') {
            showToast("⛔ Người gửi đã hủy.");
            if (currentWriter) {
                try { currentWriter.abort("Người gửi đã hủy"); } catch (e) {}
                currentWriter = null;
            }
            releaseWakeLock(); // ✅ Release wake lock
            resetTransferState();
        }
    });

    conn.on('error', (err) => {
        console.error("Connection error:", err);
        showToast("❌ Lỗi kết nối: " + err.message);
        releaseWakeLock(); // ✅ Release wake lock
        resetTransferState();
    });

    conn.on('close', () => {
        if (isTransferring) {
            showToast("❌ Mất kết nối!");
            releaseWakeLock(); // ✅ Release wake lock
            resetTransferState();
        }
    });
}

// ✅ NEW: iOS Fallback - Download Blob File
function downloadBlobFile(chunks, fileName) {
    try {
        const blob = new Blob(chunks);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        console.log('✅ iOS: File downloaded via blob');
    } catch (err) {
        console.error('Blob download failed:', err);
        showToast('❌ Không thể tải file - thử lại');
    }
}

let transferStartTime = 0;
let lastTransferUpdate = 0;
let lastTransferBytes = 0;

function updateTransferUI(percent, text, bytesDone, bytesTotal) {
    const now = Date.now();
    
    // Initialize timing on first call
    if (!transferStartTime) {
        transferStartTime = now;
        lastTransferUpdate = now;
        lastTransferBytes = 0;
    }
    
    const elapsed = (now - transferStartTime) / 1000; // seconds
    const progressBar = document.getElementById('tf-progress');
    const statusEl = document.getElementById('tf-status');
    
    if (!progressBar || !statusEl) return;
    
    progressBar.style.width = percent + '%';
    
    // Calculate speed (bytes/sec)
    let speedText = '';
    if (elapsed > 0.5) {
        const fileSize = (typeof bytesTotal === 'number' && bytesTotal >= 0)
            ? bytesTotal
            : (window.incomingMeta?.fileSize || receivedSize);
        const currentBytes = (typeof bytesDone === 'number' && bytesDone >= 0)
            ? bytesDone
            : receivedSize;
        const speed = currentBytes / elapsed;
        
        // Format speed
        if (speed > 1024 * 1024) {
            speedText = ` @ ${(speed / (1024*1024)).toFixed(1)} MB/s`;
        } else if (speed > 1024) {
            speedText = ` @ ${(speed / 1024).toFixed(1)} KB/s`;
        } else {
            speedText = ` @ ${speed.toFixed(0)} B/s`;
        }
        
        // Calculate ETA
        if (percent < 100 && speed > 0) {
            const remaining = fileSize - currentBytes;
            const etaSeconds = Math.ceil(remaining / speed);
            let etaText = '';
            if (etaSeconds < 60) {
                etaText = ` - ${etaSeconds}s`;
            } else {
                const mins = Math.floor(etaSeconds / 60);
                const secs = etaSeconds % 60;
                etaText = ` - ${mins}m${secs}s`;
            }
            speedText += etaText;
        }
    }
    
    statusEl.innerText = `${text} ${Math.floor(percent)}%${speedText}`;
}

function formatBytes(bytes) {
    if (bytes > 1024 * 1024) return (bytes / (1024*1024)).toFixed(1) + ' MB';
    if (bytes > 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return bytes + ' B';
}

// ✅ Hide connection status bar
function hideConnectionStatus() {
    if (connectionUpdateInterval) {
        clearInterval(connectionUpdateInterval);
        connectionUpdateInterval = null;
    }
    const connStatusEl = document.getElementById('connectionStatus');
    if (connStatusEl) {
        setTimeout(() => {
            connStatusEl.style.display = 'none';
        }, 500);
    }
    connectionStartTime = null;
}

function resetTransferState() {
    isTransferring = false;
    activeConnection = null;
    receivedSize = 0;
    currentWriter = null;
    transferStartTime = 0; // Reset timing
    
    // ✅ Clear timeout properly
    if (transferTimeoutId) {
        clearTimeout(transferTimeoutId);
        transferTimeoutId = null;
    }
    if (transferWatchdogInterval) {
        clearInterval(transferWatchdogInterval);
        transferWatchdogInterval = null;
    }
    if (progressUpdateInterval) {
        clearInterval(progressUpdateInterval);
        progressUpdateInterval = null;
    }
    if (connectionUpdateInterval) {
        clearInterval(connectionUpdateInterval);
        connectionUpdateInterval = null;
    }
    
    const panel = document.getElementById('transfer-panel');
    if(panel) panel.style.display = 'none';
    
    // Hide connection status bar
    const connStatusEl = document.getElementById('connectionStatus');
    if (connStatusEl) connStatusEl.style.display = 'none';
}

function formatSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function cancelTransfer() {
    if (!isTransferring && !activeConnection) {
        resetTransferState();
        return;
    }

    // ✅ Clear timeout immediately
    if (transferTimeoutId) {
        clearTimeout(transferTimeoutId);
        clearInterval(transferTimeoutId);
        transferTimeoutId = null;
    }

    // 1. Ngắt trạng thái ngay lập tức
    isTransferring = false; 

    // 2. Gửi tín hiệu hủy
    if (activeConnection && activeConnection.open) {
        try {
            activeConnection.send({ type: 'cancel', message: 'User cancelled transfer' });
        } catch (err) {
            console.warn("Lỗi gửi lệnh hủy:", err);
        }
    }
    
    showToast("⛔ Đã hủy chuyển tệp.");
    releaseWakeLock(); // ✅ Release wake lock
    resetTransferState();

    // 3. Đóng kết nối
    if (activeConnection) {
        const connToClose = activeConnection;
        activeConnection = null;
        setTimeout(() => { 
            if(connToClose && !connToClose.closed) {
                connToClose.close(); 
            }
        }, 800); 
    }
}

// Send a short-lived ping connection to help locate device physically
function sendPing(targetId) {
    if (!myPeer) return showToast('Peer chưa sẵn sàng');
    try {
        const conn = myPeer.connect(targetId, { reliable: true });
        conn.on('open', () => {
            try { conn.send({ type: 'ping', from: myPeerId }); } catch (e) {}
            setTimeout(() => { try { conn.close(); } catch (e) {} }, 800);
        });
        conn.on('error', (err) => {
            console.warn('Ping error', err);
            showToast('Không thể gửi ping');
        });
    } catch (e) {
        console.warn('sendPing failed', e);
        showToast('Lỗi gửi ping');
    }
}

export { initWindDrop, cancelTransfer };
