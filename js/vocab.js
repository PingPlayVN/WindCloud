// js/vocab.js - Tính năng Ôn tập từ vựng (Mobile UI Tối ưu, Progressive Hinting)
let pendingDeleteSetId = null; // Biến lưu ID bảng đang chờ xóa
class VocabQuiz {
    constructor() {
        this.sets = this.loadData() || [
            { id: Date.now(), title: "Bảng từ vựng 1", isActive: true, words: [{ en: "", vi: "" }, { en: "", vi: "" }] }
        ];
        
        this.currentList = [];
        this.currentIndex = 0;
        this.score = 0;
        this.failedAttempts = 0;
        this.saveDataTimeout = null; // Debounce timer
        
        this.initDOM();
        this.bindEvents();
        this.renderSets(); 
    }

    initDOM() {
        this.setupPanel = document.getElementById('vocabSetupPanel');
        this.setsContainer = document.getElementById('vocabSetsContainer');
        this.btnAddSet = document.getElementById('btnAddSet');
        this.btnStart = document.getElementById('btnStartQuiz');
        
        this.quizPanel = document.getElementById('vocabQuizPanel');
        this.questionText = document.getElementById('questionText');
        this.answerInput = document.getElementById('answerInput');
        this.btnSubmit = document.getElementById('btnSubmitAnswer');
        this.progressText = document.getElementById('quizProgress');
        this.scoreText = document.getElementById('quizScore');
        this.feedbackText = document.getElementById('quizFeedback');
        this.btnReset = document.getElementById('btnResetQuiz');
        this.quizInputSection = document.getElementById('quizInputSection');
        this.vocabConfirmModal = document.getElementById('vocabConfirmModal');
        this.vocabDeleteName = document.getElementById('vocabDeleteName');
        this.btnCancelVocabDelete = document.getElementById('btnCancelVocabDelete');
        this.btnConfirmVocabDelete = document.getElementById('btnConfirmVocabDelete');
        this.pendingDeleteSetIndex = null; // Biến lưu vị trí bảng đang chờ xóa

        if (this.quizInputSection) {
            this.quizInputSection.style.flexWrap = 'wrap';
            if (this.answerInput) this.answerInput.style.minWidth = '200px'; 
            if (this.btnSubmit) this.btnSubmit.style.flex = '1 1 auto'; 
        }
    }

    // DÁN 2 HÀM NÀY NGAY DƯỚI HÀM initDOM()
    openVocabDeleteModal(setIndex, setName) {
        this.pendingDeleteSetIndex = setIndex;
        if (this.vocabDeleteName) this.vocabDeleteName.textContent = `"${setName}"`;
        
        if (this.vocabConfirmModal) {
            this.vocabConfirmModal.style.display = 'flex';
            void this.vocabConfirmModal.offsetWidth; // Kích hoạt CSS Animation
            this.vocabConfirmModal.classList.add('show');
        }
    }

    closeVocabDeleteModal() {
        this.pendingDeleteSetIndex = null;
        if (this.vocabConfirmModal) {
            this.vocabConfirmModal.classList.remove('show');
            setTimeout(() => {
                this.vocabConfirmModal.style.display = 'none';
            }, 300);
        }
    }

    loadData() {
        try { return JSON.parse(localStorage.getItem('windcloud_vocab_sets')); } 
        catch (e) { return null; }
    }
    
    saveData() {
        // Debounce: chỉ save sau 500ms không có input mới
        if (this.saveDataTimeout) clearTimeout(this.saveDataTimeout);
        this.saveDataTimeout = setTimeout(() => {
            localStorage.setItem('windcloud_vocab_sets', JSON.stringify(this.sets));
        }, 500);
    }

    // Rebuild rows cho một set cụ thể mà không render toàn bộ
    renderSetRows(setIdx) {
        const setCard = document.querySelectorAll('.vocab-set-card')[setIdx];
        if (!setCard) return;
        
        const rowsContainer = setCard.querySelector('.vocab-row')?.parentElement;
        if (!rowsContainer) return;
        
        // Xóa các hàng cũ
        rowsContainer.innerHTML = '';
        
        // Thêm hàng mới
        this.sets[setIdx].words.forEach((word, wordIndex) => {
            const row = document.createElement('div');
            row.className = 'vocab-row';
            row.style.cssText = "display: flex; flex-wrap: wrap; align-items: flex-end; gap: 10px; margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px dashed var(--border);";
            row.innerHTML = `
                <div style="flex: 1 1 calc(50% - 35px); min-width: 130px; display: flex; flex-direction: column; gap: 5px;">
                    <span style="font-size: 0.75rem; color: var(--primary); font-weight: bold; letter-spacing: 0.5px;">🇬🇧 TIẾNG ANH</span>
                    <input type="text" id="vocab-en-${setIdx}-${wordIndex}" name="vocab-en-${setIdx}-${wordIndex}" class="input-en" data-set="${setIdx}" data-word="${wordIndex}" value="${word.en}" placeholder="VD: hello" style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-surface); color: var(--text-main);" aria-label="Từ tiếng Anh">
                </div>
                
                <div style="flex: 1 1 calc(50% - 35px); min-width: 130px; display: flex; flex-direction: column; gap: 5px;">
                    <span style="font-size: 0.75rem; color: #10b981; font-weight: bold; letter-spacing: 0.5px;">🇻🇳 TIẾNG VIỆT</span>
                    <input type="text" id="vocab-vi-${setIdx}-${wordIndex}" name="vocab-vi-${setIdx}-${wordIndex}" class="input-vi" data-set="${setIdx}" data-word="${wordIndex}" value="${word.vi}" placeholder="VD: xin chào" style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-surface); color: var(--text-main);" aria-label="Nghĩa tiếng Việt">
                </div>
                
                <button class="btn-icon btn-delete-row" data-set="${setIdx}" data-word="${wordIndex}" tabindex="-1" style="flex: 0 0 auto; margin-bottom: 8px; padding: 5px;">✕</button>
            `;
            rowsContainer.appendChild(row);
        });
    }

    // Thêm 1 hàng từ vựng vào DOM mà không render lại toàn bộ
    addRowToDOM(setIdx) {
        const setCard = document.querySelectorAll('.vocab-set-card')[setIdx];
        if (!setCard) return;
        
        const rowsContainer = setCard.querySelector('.vocab-row')?.parentElement;
        if (!rowsContainer) return;

        const wordIndex = this.sets[setIdx].words.length - 1;
        const word = this.sets[setIdx].words[wordIndex];
        
        const row = document.createElement('div');
        row.className = 'vocab-row';
        row.style.cssText = "display: flex; flex-wrap: wrap; align-items: flex-end; gap: 10px; margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px dashed var(--border);";
        row.innerHTML = `
            <div style="flex: 1 1 calc(50% - 35px); min-width: 130px; display: flex; flex-direction: column; gap: 5px;">
                <span style="font-size: 0.75rem; color: var(--primary); font-weight: bold; letter-spacing: 0.5px;">🇬🇧 TIẾNG ANH</span>
                <input type="text" id="vocab-en-${setIdx}-${wordIndex}" name="vocab-en-${setIdx}-${wordIndex}" class="input-en" data-set="${setIdx}" data-word="${wordIndex}" value="${word.en}" placeholder="VD: hello" style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-surface); color: var(--text-main);" aria-label="Từ tiếng Anh">
            </div>
            
            <div style="flex: 1 1 calc(50% - 35px); min-width: 130px; display: flex; flex-direction: column; gap: 5px;">
                <span style="font-size: 0.75rem; color: #10b981; font-weight: bold; letter-spacing: 0.5px;">🇻🇳 TIẾNG VIỆT</span>
                <input type="text" id="vocab-vi-${setIdx}-${wordIndex}" name="vocab-vi-${setIdx}-${wordIndex}" class="input-vi" data-set="${setIdx}" data-word="${wordIndex}" value="${word.vi}" placeholder="VD: xin chào" style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-surface); color: var(--text-main);" aria-label="Nghĩa tiếng Việt">
            </div>
            
            <button class="btn-icon btn-delete-row" data-set="${setIdx}" data-word="${wordIndex}" tabindex="-1" style="flex: 0 0 auto; margin-bottom: 8px; padding: 5px;">✕</button>
        `;
        
        rowsContainer.appendChild(row);
        return row;
    }

    renderSets() {
        this.setsContainer.innerHTML = '';
        
        // VÒNG LẶP FOREACH PHẢI NẰM Ở ĐÂY
        this.sets.forEach((set, setIndex) => {
            
            // Đảm bảo state isCollapsed tồn tại (nếu là mảng dữ liệu cũ)
            if (typeof set.isCollapsed === 'undefined') set.isCollapsed = false;

            const setCard = document.createElement('div');
            setCard.className = 'vocab-set-card';
            
            const header = document.createElement('div');
            header.className = 'vocab-set-header';
            
            const titleSection = document.createElement('div');
            titleSection.className = 'vocab-title-section';
            titleSection.innerHTML = `
                <input type="text" id="vocab-title-${setIndex}" name="vocab-title-${setIndex}" class="vocab-set-title" data-index="${setIndex}" value="${set.title}" placeholder="Tên bảng..." aria-label="Tên bảng từ vựng">
            `;
            
            const controlsSection = document.createElement('div');
            controlsSection.className = 'vocab-controls-section';
            controlsSection.innerHTML = `
                <button class="btn-toggle-set" data-index="${setIndex}" title="Thu gọn/Mở rộng bảng" style="transform: ${set.isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)'}; transition: transform 0.3s ease;">
                    <span class="arrow-icon"></span>
                </button>
                
                <div class="cntr">
                    <input type="checkbox" id="vocab-active-${setIndex}" class="vocab-set-checkbox hidden-xs-up" data-index="${setIndex}" ${set.isActive ? 'checked' : ''} title="Sử dụng bảng này" aria-label="Kích hoạt bảng">
                    <label for="vocab-active-${setIndex}" class="cbx"></label>
                </div>
                
                <button class="btn-import-set" data-index="${setIndex}" title="Nhập nhanh từ vựng">Nhập nhanh</button>
                <button class="bin-button btn-delete-set" data-index="${setIndex}" type="button" title="Xóa bảng này">
                    <svg class="bin-top" viewBox="0 0 39 7" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <line y1="5" x2="39" y2="5" stroke="white" stroke-width="4"></line>
                        <line x1="12" y1="1.5" x2="26.0357" y2="1.5" stroke="white" stroke-width="3"></line>
                    </svg>
                    <svg class="bin-bottom" viewBox="0 0 33 39" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <mask id="path-1-inside-1_8_19" fill="white">
                            <path d="M0 0H33V35C33 37.2091 31.2091 39 29 39H4C1.79086 39 0 37.2091 0 35V0Z"></path>
                        </mask>
                        <path d="M0 0H33H0ZM37 35C37 39.4183 33.4183 43 29 43H4C-0.418278 43 -4 39.4183 -4 35H4H29H37ZM4 43C-0.418278 43 -4 39.4183 -4 35V0H4V35V43ZM37 0V35C37 39.4183 33.4183 43 29 43V35V0H37Z" fill="white" mask="url(#path-1-inside-1_8_19)"></path>
                        <path d="M12 6L12 29" stroke="white" stroke-width="4"></path>
                        <path d="M21 6V29" stroke="white" stroke-width="4"></path>
                    </svg>
                </button>
            `;
            
            header.appendChild(titleSection);
            header.appendChild(controlsSection);

            // --- BỌC TOÀN BỘ PHẦN THÂN VÀO BODY WRAPPER ---
            const bodyWrapper = document.createElement('div');
            bodyWrapper.className = 'vocab-set-body';
            bodyWrapper.setAttribute('data-collapsed', set.isCollapsed);
            // Nếu state là thu gọn (true) thì ẩn body đi
            if (set.isCollapsed) {
                bodyWrapper.style.height = '0px';
                bodyWrapper.style.opacity = '0';
                bodyWrapper.style.paddingTop = '0px';
                bodyWrapper.style.paddingBottom = '0px';
            } else {
                bodyWrapper.style.height = 'auto';
                bodyWrapper.style.opacity = '1';
                bodyWrapper.style.paddingTop = '15px';
                bodyWrapper.style.paddingBottom = '15px';
            }

            // 1. Khu vực Import
            const importArea = document.createElement('div');
            importArea.className = 'import-area';
            importArea.style.cssText = 'display: none; width: 100%; height: 0px; margin-top: 0px; margin-bottom: 0px; padding-top: 0px; padding-bottom: 0px; border-width: 0px; opacity: 0; overflow: hidden;';
            importArea.innerHTML = `
                <p style="font-size: 0.85rem; color: var(--text-sub); margin-bottom: 8px;">Nhập từ vựng theo định dạng <b>Tiếng Anh : Tiếng Việt</b> (mỗi dòng 1 từ):</p>
                <textarea id="vocab-import-${setIndex}" name="vocab-import-${setIndex}" class="import-textarea" placeholder="hello : xin chào\napple : quả táo" style="width: 100%; height: 100px; padding: 8px; border: 1px solid var(--border); border-radius: 4px; background: var(--bg-surface); color: var(--text-main); resize: vertical; font-family: 'Segoe UI', 'Helvetica Neue', 'Arial', sans-serif; white-space: pre-wrap; overflow-x: auto;" aria-label="Khu vực nhập từ vựng hàng loạt"></textarea>
                <div style="display: flex; gap: 10px; margin-top: 10px;">
                    <button class="btn-submit btn-confirm-import" data-index="${setIndex}" style="flex: 1; padding: 6px;">Lưu từ vựng</button>
                    <button class="btn-action btn-cancel-import" style="flex: 1; padding: 6px;">Hủy bỏ</button>
                </div>
            `;

            // 2. Khu vực Các hàng từ vựng
            const rowsContainer = document.createElement('div');
            set.words.forEach((word, wordIndex) => {
                const row = document.createElement('div');
                row.className = 'vocab-row';
                row.style.cssText = "display: flex; flex-wrap: wrap; align-items: flex-end; gap: 10px; margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px dashed var(--border);";
                row.innerHTML = `
                    <div style="flex: 1 1 calc(50% - 35px); min-width: 130px; display: flex; flex-direction: column; gap: 5px;">
                        <span style="font-size: 0.75rem; color: var(--primary); font-weight: bold; letter-spacing: 0.5px;">🇬🇧 TIẾNG ANH</span>
                        <input type="text" id="vocab-en-${setIndex}-${wordIndex}" name="vocab-en-${setIndex}-${wordIndex}" class="input-en" data-set="${setIndex}" data-word="${wordIndex}" value="${word.en}" placeholder="VD: hello" style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-surface); color: var(--text-main);" aria-label="Từ tiếng Anh">
                    </div>
                    
                    <div style="flex: 1 1 calc(50% - 35px); min-width: 130px; display: flex; flex-direction: column; gap: 5px;">
                        <span style="font-size: 0.75rem; color: #10b981; font-weight: bold; letter-spacing: 0.5px;">🇻🇳 TIẾNG VIỆT</span>
                        <input type="text" id="vocab-vi-${setIndex}-${wordIndex}" name="vocab-vi-${setIndex}-${wordIndex}" class="input-vi" data-set="${setIndex}" data-word="${wordIndex}" value="${word.vi}" placeholder="VD: xin chào" style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-surface); color: var(--text-main);" aria-label="Nghĩa tiếng Việt">
                    </div>
                    
                    <button class="btn-icon btn-delete-row" data-set="${setIndex}" data-word="${wordIndex}" tabindex="-1" style="flex: 0 0 auto; margin-bottom: 8px; padding: 5px;">✕</button>
                `;
                rowsContainer.appendChild(row);
            });

            // 3. Nút Thêm Hàng
            const btnAddRow = document.createElement('button');
            btnAddRow.className = 'btn-add-row';
            btnAddRow.setAttribute('data-index', setIndex);
            btnAddRow.innerText = '+ Thêm 1 từ vào bảng';

            // Gắn 3 thành phần trên vào Thân Bảng
            bodyWrapper.appendChild(importArea);
            bodyWrapper.appendChild(rowsContainer);
            bodyWrapper.appendChild(btnAddRow);

            // Lắp ráp vào Card
            setCard.appendChild(header);
            setCard.appendChild(bodyWrapper); 
            this.setsContainer.appendChild(setCard);
            
        }); // KẾT THÚC VÒNG LẶP Ở ĐÂY
    }

    bindEvents() {
        if (!this.btnStart) return;

        this.setsContainer.addEventListener('input', (e) => {
            const target = e.target;
            const sIdx = target.getAttribute('data-set');
            const wIdx = target.getAttribute('data-word');
            
            if (target.classList.contains('input-en')) {
                this.sets[sIdx].words[wIdx].en = target.value;
            } else if (target.classList.contains('input-vi')) {
                this.sets[sIdx].words[wIdx].vi = target.value;
            } else if (target.classList.contains('vocab-set-title')) {
                this.sets[target.getAttribute('data-index')].title = target.value;
            }
            this.saveData(); 
        });

        this.setsContainer.addEventListener('change', (e) => {
            if (e.target.classList.contains('vocab-set-checkbox')) {
                this.sets[e.target.getAttribute('data-index')].isActive = e.target.checked;
                this.saveData();
            }
        });

        this.setsContainer.addEventListener('click', (e) => {
            const target = e.target;
            if (target.classList.contains('btn-add-row')) {
                const setIdx = target.getAttribute('data-index');
                this.sets[setIdx].words.push({ en: '', vi: '' });
                
                // Thêm hàng mới vào DOM mà không render lại toàn bộ
                const newRow = this.addRowToDOM(setIdx);
                this.saveData();
                
                // Focus vào input mới với animation
                if (newRow) {
                    setTimeout(() => {
                        const newInput = newRow.querySelector('.input-en');
                        gsap.fromTo(newRow, 
                            { opacity: 0, y: -10 },
                            { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' }
                        );
                        if (newInput) newInput.focus();
                    }, 50);
                }
            } else if (target.classList.contains('btn-delete-row')) {
                const sIdx = target.getAttribute('data-set');
                const wIdx = target.getAttribute('data-word');
                const row = target.closest('.vocab-row');
                
                // Animate removal và xóa từ data
                gsap.to(row, {
                    opacity: 0,
                    x: 20,
                    duration: 0.3,
                    ease: 'power2.in',
                    onComplete: () => {
                        this.sets[sIdx].words.splice(wIdx, 1);
                        row.remove(); // Xóa từ DOM mà không render lại toàn bộ
                        this.saveData();
                    }
                });
            } else if (target.classList.contains('btn-delete-set') || target.closest('.btn-delete-set')) {
                const btn = target.closest('.btn-delete-set') || target;
                const setIdx = parseInt(btn.getAttribute('data-index'), 10);
                
                // Lấy tên của bảng từ vựng để hiển thị lên Popup
                const setName = this.sets[setIdx].title || "Bảng chưa đặt tên";
                
                // BƯỚC 4: Gọi hàm mở Popup tự chế thay vì dùng confirm()
                this.openVocabDeleteModal(setIdx, setName);
            } else if (target.classList.contains('btn-import-set') || target.closest('.btn-import-set')) {
                const btn = target.closest('.btn-import-set') || target;
                const setIdx = btn.getAttribute('data-index');
                const setCard = btn.closest('.vocab-set-card');
                if (!setCard) return;
                
                const importArea = setCard.querySelector('.import-area');
                const textarea = setCard.querySelector('.import-textarea');
                if (!importArea || !textarea) return;

                const isHidden = importArea.style.display === 'none' || importArea.style.height === '0px';
                
                if (isHidden) {
                    // ====== MỞ RỘNG IMPORT AREA ======
                    importArea.style.display = 'block';
                    
                    // Animate bung ra: height, padding, margin, opacity
                    gsap.fromTo(importArea,
                        { 
                            height: 0, opacity: 0, paddingTop: 0, paddingBottom: 0, 
                            marginTop: 0, marginBottom: 0, borderWidth: 0 
                        },
                        { 
                            height: "auto", opacity: 1, paddingTop: 15, paddingBottom: 15, 
                            marginTop: 10, marginBottom: 15, borderWidth: 2,
                            duration: 0.35, ease: 'power2.out' 
                        }
                    );

                    // Lấy các từ hiện có và đổ vào Textarea
                    const currentWords = this.sets[setIdx].words;
                    const textLines = currentWords
                        .filter(w => w.en.trim() !== '' || w.vi.trim() !== '') 
                        .map(w => `${w.en} : ${w.vi}`); 
                    
                    textarea.value = textLines.join('\n'); 
                    setTimeout(() => textarea.focus(), 100);
                } else {
                    // ====== THU GỌN IMPORT AREA ======
                    const currentHeight = importArea.offsetHeight;
                    gsap.set(importArea, { height: currentHeight }); // Gắn cứng pixel trước khi thu
                    
                    gsap.to(importArea, {
                        height: 0, opacity: 0, paddingTop: 0, paddingBottom: 0, 
                        marginTop: 0, marginBottom: 0, borderWidth: 0,
                        duration: 0.35, ease: 'power2.inOut',
                        onComplete: () => {
                            importArea.style.display = 'none';
                        }
                    });
                }
            } else if (target.classList.contains('btn-toggle-set') || target.closest('.btn-toggle-set')) {
                const btn = target.closest('.btn-toggle-set');
                const setIdx = btn.getAttribute('data-index');
                const setCard = btn.closest('.vocab-set-card');
                const bodyWrapper = setCard.querySelector('.vocab-set-body');
                
                // Đảo ngược trạng thái hiện tại
                this.sets[setIdx].isCollapsed = !this.sets[setIdx].isCollapsed;
                
                if (this.sets[setIdx].isCollapsed) {
                    // ====== THU GỌN (COLLAPSE) ======
                    // 1. Lấy chiều cao thực tế bằng pixel trước khi thu gọn
                    const currentHeight = bodyWrapper.offsetHeight;
                    
                    // 2. Set chiều cao thành pixel cố định để GSAP có điểm bắt đầu chính xác
                    gsap.set(bodyWrapper, { height: currentHeight });
                    
                    // 3. Thực hiện animation thu nhỏ
                    gsap.to(btn, { rotation: 0, duration: 0.35, ease: 'power2.inOut' });
                    gsap.to(bodyWrapper, {
                        height: 0,
                        opacity: 0,
                        paddingTop: 0,
                        paddingBottom: 0,
                        duration: 0.35,
                        ease: 'power2.inOut',
                        onComplete: () => {
                            bodyWrapper.style.display = 'none'; // Ẩn hẳn sau khi thu xong
                        }
                    });
                } else {
                    // ====== MỞ RỘNG (EXPAND) ======
                    bodyWrapper.style.display = 'block'; // Hiển thị trước để GSAP có thể tính toán "auto"
                    
                    gsap.to(btn, { rotation: 90, duration: 0.35, ease: 'power2.inOut' });
                    
                    // Dùng fromTo để đảm bảo điểm bắt đầu luôn là 0
                    gsap.fromTo(bodyWrapper,
                        {
                            height: 0,
                            opacity: 0,
                            paddingTop: 0,
                            paddingBottom: 0
                        },
                        {
                            height: "auto", // Để GSAP tự tính toán bung ra
                            opacity: 1,
                            paddingTop: 15,
                            paddingBottom: 15,
                            duration: 0.35,
                            ease: 'power2.inOut'
                        }
                    );
                }
                
                // Lưu trạng thái vào LocalStorage
                this.saveData();
            }
            // Nút Hủy bỏ
            else if (target.classList.contains('btn-cancel-import')) {
                const setCard = target.closest('.vocab-set-card');
                const importArea = setCard.querySelector('.import-area');
                
                const currentHeight = importArea.offsetHeight;
                gsap.set(importArea, { height: currentHeight });
                gsap.to(importArea, {
                    height: 0, opacity: 0, paddingTop: 0, paddingBottom: 0, marginTop: 0, marginBottom: 0, borderWidth: 0,
                    duration: 0.35, ease: 'power2.inOut',
                    onComplete: () => importArea.style.display = 'none'
                });
                
                setCard.querySelector('.import-textarea').value = ''; // Xóa text đang nhập dở
            }
            // Xác nhận Import và Parsing
            else if (target.classList.contains('btn-confirm-import')) {
                const setIdx = target.getAttribute('data-index');
                const setCard = target.closest('.vocab-set-card');
                const textarea = setCard.querySelector('.import-textarea');
                const rawText = textarea.value.trim();

                const lines = rawText.split('\n');
                const newWords = [];

                lines.forEach(line => {
                    const delimiterIndex = line.indexOf(':');
                    if (delimiterIndex !== -1) {
                        const en = line.slice(0, delimiterIndex).trim();
                        const vi = line.slice(delimiterIndex + 1).trim();
                        
                        // Chỉ cần có tiếng Anh hoặc tiếng Việt thì lưu lại
                        if (en || vi) {
                            newWords.push({ en, vi });
                        }
                    }
                });

                // Đảm bảo luôn có ít nhất 1 ô trống nếu người dùng lỡ xóa sạch Textarea
                if (newWords.length === 0) {
                    newWords.push({ en: '', vi: '' });
                }

                // [QUAN TRỌNG] Ghi đè toàn bộ mảng thay vì nối thêm
                this.sets[setIdx].words = newWords;
                
                // Chỉ rebuild rows của set này, không render toàn bộ
                this.renderSetRows(setIdx);
                
                // Đóng import area
                // Đóng import area mượt mà
                const importArea = setCard.querySelector('.import-area');
                const currentHeight = importArea.offsetHeight;
                gsap.set(importArea, { height: currentHeight });
                gsap.to(importArea, {
                    height: 0, opacity: 0, paddingTop: 0, paddingBottom: 0, marginTop: 0, marginBottom: 0, borderWidth: 0,
                    duration: 0.35, ease: 'power2.inOut',
                    onComplete: () => importArea.style.display = 'none'
                });
                this.saveData();
            }
        });

        this.setsContainer.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const target = e.target;
                if (target.classList.contains('input-en') || target.classList.contains('input-vi')) {
                    e.preventDefault();
                    const setCard = target.closest('.vocab-set-card');
                    if (!setCard) return;

                    const inputs = Array.from(setCard.querySelectorAll('.input-en, .input-vi'));
                    const currentIndex = inputs.indexOf(target);

                    if (currentIndex > -1) {
                        if (currentIndex < inputs.length - 1) {
                            inputs[currentIndex + 1].focus();
                        } else {
                            const setIndex = target.getAttribute('data-set');
                            this.sets[setIndex].words.push({ en: '', vi: '' });
                            
                            // Thêm hàng mới vào DOM thay vì render lại toàn bộ
                            const newRow = this.addRowToDOM(setIndex);
                            this.saveData();
                            
                            if (newRow) {
                                setTimeout(() => {
                                    const newInput = newRow.querySelector('.input-en');
                                    if (newInput) newInput.focus();
                                }, 50);
                            }
                        }
                    }
                }
            }
        });

        this.btnAddSet.addEventListener('click', () => {
            this.sets.push({ id: Date.now(), title: `Bảng từ vựng ${this.sets.length + 1}`, isActive: true, words: [{ en: "", vi: "" }] });
            this.renderSets();
            this.saveData();
        });

        this.btnStart.addEventListener('click', () => this.startQuiz());
        this.btnSubmit.addEventListener('click', () => this.checkAnswer());
        this.btnReset.addEventListener('click', () => this.resetApp());
        
        this.answerInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.checkAnswer();
            }
        });

        // --- BƯỚC 3: DÁN LOGIC CỦA POPUP VÀO ĐÂY ---
        if (this.btnCancelVocabDelete) {
            this.btnCancelVocabDelete.addEventListener('click', () => this.closeVocabDeleteModal());
        }

        if (this.btnConfirmVocabDelete) {
            this.btnConfirmVocabDelete.addEventListener('click', () => {
                if (this.pendingDeleteSetIndex !== null) {
                    const setIdx = this.pendingDeleteSetIndex;
                    
                    // Tìm thẻ HTML của bảng đang bị xóa để làm hiệu ứng bay màu
                    const setCard = this.setsContainer.children[setIdx]; 
                    
                    this.closeVocabDeleteModal(); // Đóng popup

                    // Chạy hiệu ứng GSAP xóa như cũ của bạn
                    if (setCard) {
                        gsap.to(setCard, {
                            opacity: 0,
                            x: -20,
                            duration: 0.3,
                            ease: 'power2.in',
                            onComplete: () => {
                                this.sets.splice(setIdx, 1);
                                setCard.remove(); // Xóa từ DOM thay vì render lại toàn bộ
                                this.saveData();
                            }
                        });
                    }
                }
            });
        }
    }

    shuffleArray(array) {
        const arr = [...array];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    startQuiz() {
        let compiledList = [];
        this.sets.forEach(set => {
            if (set.isActive) {
                set.words.forEach(w => {
                    const en = w.en.trim().toLowerCase();
                    const vi = w.vi.trim();
                    if (en && vi) compiledList.push({ en, vi }); 
                });
            }
        });

        if (compiledList.length === 0) {
            alert('⚠️ Vui lòng tick chọn ít nhất 1 bảng và đảm bảo đã nhập đầy đủ (Anh - Việt) cho các từ.');
            return;
        }

        this.currentList = this.shuffleArray(compiledList);
        this.currentIndex = 0;
        this.score = 0;

        this.setupPanel.style.display = 'none';
        this.quizPanel.style.display = 'block';
        this.quizInputSection.style.display = 'flex';
        
        this.loadQuestion();
    }

    loadQuestion() {
        this.answerInput.value = '';
        this.answerInput.disabled = false;
        this.btnSubmit.disabled = false;
        this.feedbackText.innerText = '';
        
        this.failedAttempts = 0; 
        setTimeout(() => this.answerInput.focus(), 50);

        this.questionText.innerText = this.currentList[this.currentIndex].vi;
        this.updateStatus();
    }

    checkAnswer() {
        if (this.answerInput.disabled) return;

        const userAnswer = this.answerInput.value.trim().toLowerCase();
        if (!userAnswer) return;

        const currentWord = this.currentList[this.currentIndex];
        const isCorrect = (userAnswer === currentWord.en);

        if (isCorrect) {
            this.answerInput.disabled = true;
            this.btnSubmit.disabled = true;

            if (this.failedAttempts === 0) {
                this.score++;
            }

            this.feedbackText.innerHTML = `<span class="feedback-correct">✅ Chính xác!</span>`;
            this.updateStatus(); 
            
            setTimeout(() => this.nextQuestion(), 800);
        } else {
            this.failedAttempts++;
            this.answerInput.value = ''; 
            this.answerInput.focus();    

            if (this.failedAttempts >= 3) {
                this.feedbackText.innerHTML = `
                    <span class="feedback-wrong">
                        ❌ Sai rồi! Đáp án đúng là: <strong style="font-size: 1.2rem;">${currentWord.en}</strong><br>
                        <span style="font-size:0.9rem; color:var(--text-muted);">(Hãy gõ lại từ trên để tiếp tục)</span>
                    </span>`;
            } else {
                this.feedbackText.innerHTML = `<span class="feedback-wrong">❌ Chưa đúng, hãy thử lại! (Sai lần ${this.failedAttempts})</span>`;
            }
        }
    }

    nextQuestion() {
        this.currentIndex++;
        if (this.currentIndex < this.currentList.length) this.loadQuestion();
        else this.showResults();
    }

    updateStatus() {
        this.progressText.innerText = `Câu: ${this.currentIndex + 1}/${this.currentList.length}`;
        this.scoreText.innerText = `Điểm: ${this.score}`;
    }

    showResults() {
        this.questionText.innerText = "🎉 Hoàn thành!";
        this.quizInputSection.style.display = 'none';
        const percent = Math.round((this.score / this.currentList.length) * 100);
        let msg = percent === 100 ? "Tuyệt đối! Bạn có trí nhớ siêu phàm!" : percent >= 70 ? "Rất tốt! Bạn thuộc hầu hết các từ ngay lần đầu." : "Hãy tiếp tục ôn tập để cải thiện trí nhớ nhé!";
        this.feedbackText.innerHTML = `Bạn đã đúng ngay lần đầu <strong style="color:var(--primary); font-size:1.5rem;">${this.score}/${this.currentList.length}</strong> từ.<br><span style="color: var(--text-muted); margin-top:10px; display:inline-block;">${msg}</span>`;
    }

    resetApp() {
        this.setupPanel.style.display = 'block';
        this.quizPanel.style.display = 'none';
        this.renderSets();
    }
}

document.addEventListener('DOMContentLoaded', () => new VocabQuiz());

