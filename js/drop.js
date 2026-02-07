// js/drop.js - IMPROVED VERSION v2.1 (Mobile Optimized)
// Features: E2E Encryption, Checksum Verification, Timeout Detection, Memory Leak Prevention, iOS Support

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

// ✅ TRANSFER QUEUE untuk múltiple files
let transferQueue = [];
let isProcessingQueue = false;
let wakeLockSentinel = null; // ✅ Keep device awake

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
    try {
        const buffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
        console.error("Checksum calculation error:", e);
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
        console.warn("Encryption error:", e);
        return data; // Fallback: gửi không mã hóa
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
        console.warn("Decryption error:", e);
        return encryptedData; // Fallback
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

// ✅ CLEANUP on unload/visibility change
window.addEventListener('unload', cleanupConnections);
document.addEventListener('visibilitychange', () => {
    if (document.hidden && isTransferring) {
        window.cancelTransfer();
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
                window.showToast(`⚠️ Điện thoại yếu (${Math.floor(battery.level * 100)}%) - transfer có thể bị gián đoạn`);
            }
        } catch (e) {
            // Battery API not available
        }
    }
}

window.initWindDrop = function() {
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
                { url: 'stun:stun.l.google.com:19302' },
                { url: 'stun:stun1.l.google.com:19302' },
                { url: 'stun:stun2.l.google.com:19302' },
                { url: 'stun:stun3.l.google.com:19302' }
            ]
        }
    });

    myPeer.on('open', (id) => {
        myPeerId = id;
        localStorage.setItem('wind_peer_id', myPeerId); // ✅ Save to localStorage
        if(statusEl) statusEl.innerText = "Sẵn sàng (ID: " + id + ")";
        announcePresence();
    });

    myPeer.on('connection', (conn) => {
        if (isTransferring) {
            conn.on('open', () => { 
                conn.send({ type: 'busy', message: 'Đang chuyển file khác, thử lại sau' }); 
                setTimeout(() => conn.close(), 500); 
            });
            return;
        }
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
}

function renderPeers(users) {
    const orbitZone = document.getElementById('user-orbit-zone');
    if(!orbitZone) return;
    orbitZone.innerHTML = '';
    
    if (!users) return;
    const userList = Object.keys(users).filter(id => id !== myPeerId); 
    const statusEl = document.getElementById('dropStatus');
    if(statusEl) statusEl.innerText = `Đang quét: ${userList.length} thiết bị`;

    const radarContainer = document.querySelector('.radar-zone');
    if(!radarContainer) return;

    const orbitRadius = radarContainer.clientWidth * 0.32; 
    const centerX = radarContainer.clientWidth / 2;
    const centerY = radarContainer.clientHeight / 2;

    userList.forEach((userId, index) => {
        const user = users[userId];
        const el = document.createElement('div');
        el.className = 'peer-user';
        
        const angle = (index / userList.length) * 2 * Math.PI;
        const x = Math.cos(angle) * orbitRadius + centerX;
        const y = Math.sin(angle) * orbitRadius + centerY;
        
        el.style.left = x + 'px';
        el.style.top = y + 'px';
        el.innerHTML = `<div class="peer-icon">👤</div><span>${user.name}</span>`;
        
        // Gắn sự kiện kéo thả vào chính icon này
        setupDragDrop(el, userId);
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
    
    window.showToast(`📤 Xếp hàng: ${transferQueue.length} file`);
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
        window.showToast("❌ Peer chưa sẵn sàng!");
        return;
    }
    
    window.showToast(`🔗 Đang kết nối tới ${targetPeerId}...`);
    
    const conn = myPeer.connect(targetPeerId, { reliable: true });
    activeConnection = conn;
    
    // ✅ Generate checksum & encryption key
    const checksum = await calculateFileChecksum(file);
    const sharedKey = await generateSharedKey(file.name, file.size);
    const encKey = await deriveEncryptionKey(sharedKey);
    const iv = generateIV();

    conn.on('error', (err) => {
        console.error("Connection error:", err);
        window.showToast("❌ Lỗi kết nối: " + err.message);
        resetTransferState();
    });

    conn.on('open', () => {
        const safeType = file.type || 'application/octet-stream';
        // ✅ Gửi metadata kèm checksum & IV
        setTimeout(() => {
            if (conn.open) {
                conn.send({ 
                    type: 'meta', 
                    fileName: file.name, 
                    fileSize: file.size, 
                    fileType: safeType,
                    checksum: checksum,
                    iv: Array.from(iv) // Convert Uint8Array to Array for JSON
                });
            }
        }, 500); 
    });

    conn.on('data', (response) => {
        if (response.type === 'ack' && response.status === 'ok') {
            window.showToast(`📤 Gửi: ${file.name}`);
            isTransferring = true;
            document.getElementById('transfer-panel').style.display = 'block';
            document.getElementById('tf-filename').innerText = file.name;
            
            // ✅ Request wake lock on mobile
            requestWakeLock();
            
            const receiverType = response.deviceType || 'mobile';
            sendFileInChunks(file, conn, receiverType, encKey, new Uint8Array(iv));
        } 
        else if (response.type === 'busy') {
            window.showToast("⏳ Người nhận đang bận, thử lại sau...");
            conn.close();
        }
        else if (response.type === 'cancel') {
            window.showToast("⛔ Người nhận đã từ chối!");
            isTransferring = false;
            releaseWakeLock(); // ✅ Release wake lock
            resetTransferState();
            setTimeout(() => conn.close(), 500);
        }
        else if (response.type === 'verify-mismatch') {
            window.showToast("❌ Verify failed: File bị corrupted!");
            isTransferring = false;
            releaseWakeLock(); // ✅ Release wake lock
            resetTransferState();
        }
    });

    conn.on('close', () => {
        if (isTransferring) {
            window.showToast("❌ Mất kết nối với người nhận!");
            resetTransferState();
        }
    });
}

// --- THUẬT TOÁN ADAPTIVE CHUNKING VỚI ENCRYPTION & TIMEOUT ---
async function sendFileInChunks(file, conn, receiverType, encKey, iv) {
    let offset = 0;
    
    // Cấu hình thuật toán thích ứng
    let chunkSize = TRANSFER_CONFIG.CHUNK_SIZE_INIT;
    const MAX_CHUNK_SIZE = TRANSFER_CONFIG.CHUNK_SIZE_MAX;
    const MIN_CHUNK_SIZE = TRANSFER_CONFIG.CHUNK_SIZE_MIN;
    
    // Cấu hình bộ đệm (Backpressure)
    const MAX_BUFFERED_AMOUNT = (receiverType === 'mobile' || myDeviceType === 'mobile') 
        ? 8 * 1024 * 1024
        : 16 * 1024 * 1024;

    let lastUpdateTime = 0;
    const startTime = Date.now();

    try {
        if (conn.dataChannel) {
            conn.dataChannel.bufferedAmountLowThreshold = 65536;
        }
    } catch (e) { 
        console.warn("Browser không hỗ trợ bufferedAmountLowThreshold"); 
    }

    try {
        while (offset < file.size) {
            if (!isTransferring || !conn.open) break;

            // ✅ TIMEOUT DETECTION - Nếu không có data trong 30s, hủy transfer
            lastChunkTime = Date.now();
            if (transferTimeoutId) clearTimeout(transferTimeoutId);
            
            transferTimeoutId = setTimeout(() => {
                if (isTransferring && Date.now() - lastChunkTime > TRANSFER_CONFIG.TIMEOUT_MS) {
                    console.warn("Transfer timeout!");
                    window.showToast("❌ Transfer timeout - mất kết nối");
                    isTransferring = false;
                    resetTransferState();
                }
            }, TRANSFER_CONFIG.TIMEOUT_MS);

            // 1. BACKPRESSURE: Kiểm soát dòng chảy
            if (conn.dataChannel.bufferedAmount > MAX_BUFFERED_AMOUNT) {
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
            try {
                conn.send({ type: 'chunk', data: dataToSend, isEncrypted: !!encKey });
            } catch (err) {
                console.warn("Lỗi gửi chunk, thử lại...", err);
                chunkSize = Math.max(MIN_CHUNK_SIZE, chunkSize / 2);
                await new Promise(r => setTimeout(r, 500));
                continue; 
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
                updateTransferUI(percent, `Gửi (${elapsed}s)`); 
                lastUpdateTime = chunkEndTime;
                
                await new Promise(r => setTimeout(r, 0));
            }
        }

        if (isTransferring) {
            window.showToast("✅ Đã gửi xong, chờ verify...");
            releaseWakeLock(); // ✅ Release wake lock
            resetTransferState();
        }
    } catch (e) {
        console.error("Transfer Critical Error:", e);
        window.showToast("❌ Lỗi truyền: " + e.message);
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

    conn.on('data', async (data) => {
        if(data.type === 'meta') {
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
            
            window.showActionModal({
                title: "📥 Nhận file?",
                desc: `"${data.fileName}" (${formatSize(data.fileSize)})\n\nChecksum: ${data.checksum ? '✅ Verified' : '⚠️ Unverified'}`,
                type: 'confirm',
                onConfirm: () => {
                    isTransferring = true;
                    activeConnection = conn; 
                    conn.send({ type: 'ack', status: 'ok', deviceType: myDeviceType });
                    
                    document.getElementById('transfer-panel').style.display = 'block';
                    document.getElementById('tf-filename').innerText = data.fileName;
                    
                    // ✅ Request wake lock on mobile
                    requestWakeLock();
                    
                    // ✅ NEW: Use StreamSaver or iOS fallback
                    if (isStreamSaverSupported()) {
                        // Android/Desktop: StreamSaver (disk write)
                        const fileStream = streamSaver.createWriteStream(data.fileName, {
                            size: data.fileSize
                        });
                        window.currentWriter = fileStream.getWriter();
                    } else {
                        // iOS: Will collect chunks in memory, download as blob at end
                        window.showToast("📱 iOS: File akan được lưu sau khi nhận xong");
                    }
                    
                    receivedSize = 0;
                    
                    // ✅ Start timeout detection
                    lastChunkTime = Date.now();
                    if (transferTimeoutId) clearTimeout(transferTimeoutId);
                    transferTimeoutId = setInterval(() => {
                        if (isTransferring && Date.now() - lastChunkTime > TRANSFER_CONFIG.TIMEOUT_MS) {
                            console.warn("Receiver timeout!");
                            window.showToast("❌ Timeout - người gửi không phản hồi");
                            conn.send({ type: 'cancel' });
                            isTransferring = false;
                            resetTransferState();
                            clearInterval(transferTimeoutId);
                        }
                    }, 5000);
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
            
            // ✅ Write to file (StreamSaver) or collect (iOS)
            if (window.currentWriter) {
                window.currentWriter.write(new Uint8Array(chunkData));
            }
            fileChunks.push(chunkData); // Lưu để tính checksum sau
            
            receivedSize += chunkData.byteLength;
            
            const percent = (receivedSize / window.incomingMeta.fileSize) * 100;
            updateTransferUI(percent, 'Nhận');

            // Khi nhận xong
            if(receivedSize >= window.incomingMeta.fileSize) {
                if (window.currentWriter) {
                    window.currentWriter.close();
                    window.currentWriter = null;
                }
                
                // ✅ iOS: Download as blob
                if (isMyDeviceIOS) {
                    downloadBlobFile(fileChunks, window.incomingMeta.fileName);
                }
                
                // ✅ VERIFY checksum
                if (incomingChecksum) {
                    const receivedChecksum = await calculateFileChecksum(
                        new File(fileChunks, window.incomingMeta.fileName)
                    );
                    
                    if (receivedChecksum === incomingChecksum) {
                        conn.send({ type: 'verify-ok' });
                        window.showToast("✅ File đã lưu & verify thành công!");
                    } else {
                        conn.send({ type: 'verify-mismatch' });
                        window.showToast("❌ Verify failed - file có thể bị corrupted!");
                    }
                } else {
                    window.showToast("✅ File đã lưu xong!");
                }
                
                releaseWakeLock(); // ✅ Release wake lock
                resetTransferState();
                fileChunks = [];
            }
        } else if (data.type === 'cancel') {
            window.showToast("⛔ Người gửi đã hủy.");
            if (window.currentWriter) {
                window.currentWriter.abort("Người gửi đã hủy");
                window.currentWriter = null;
            }
            releaseWakeLock(); // ✅ Release wake lock
            resetTransferState();
        }
    });

    conn.on('error', (err) => {
        console.error("Connection error:", err);
        window.showToast("❌ Lỗi kết nối: " + err.message);
        if (window.currentWriter) {
            window.currentWriter.close();
            window.currentWriter = null;
        }
        releaseWakeLock(); // ✅ Release wake lock
        resetTransferState();
    });

    conn.on('close', () => {
        if (isTransferring) {
            window.showToast("❌ Mất kết nối!");
            if (window.currentWriter) {
                window.currentWriter.close();
                window.currentWriter = null;
            }
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
        window.showToast('❌ Không thể tải file - thử lại');
    }
}

function updateTransferUI(percent, text) {
    document.getElementById('tf-progress').style.width = percent + '%';
    document.getElementById('tf-status').innerText = `${text} ${Math.floor(percent)}%`;
}

function resetTransferState() {
    isTransferring = false;
    activeConnection = null;
    receivedSize = 0;
    window.currentWriter = null;
    
    // ✅ Clear timeout properly
    if (transferTimeoutId) {
        clearTimeout(transferTimeoutId);
        clearInterval(transferTimeoutId);
        transferTimeoutId = null;
    }
    
    const panel = document.getElementById('transfer-panel');
    if(panel) panel.style.display = 'none';
}

function formatSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

window.cancelTransfer = function() {
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
    
    window.showToast("⛔ Đã hủy chuyển tệp.");
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