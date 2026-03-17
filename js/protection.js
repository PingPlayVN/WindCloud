// js/protection.js
// Protection: Block right-click context menu and DevTools when not admin

export function setupProtection() {
    // Handler to block context menu
    function blockContextMenu(e) {
        if (!window.isAdmin) {
            e.preventDefault();
            return false;
        }
    }

    // Handler to block DevTools hotkeys and Save As
    function blockDevTools(e) {
        if (!window.isAdmin) {
            // 1. Chặn F12
            if (e.key === "F12") {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
            // 2. Chặn Ctrl + Shift + I
            if (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "i" || e.keyCode === 73)) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
            // 3. Chặn Ctrl + Shift + J
            if (e.ctrlKey && e.shiftKey && (e.key === "J" || e.key === "j" || e.keyCode === 74)) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
            // 4. Chặn Ctrl + U (View Source)
            if (e.ctrlKey && (e.key === "U" || e.key === "u" || e.keyCode === 85)) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
            // 5. Chặn Ctrl + S (Windows) hoặc Cmd + S (Mac) để chống lưu trang
            if ((e.ctrlKey || e.metaKey) && (e.key === "S" || e.key === "s" || e.keyCode === 83)) {
                e.preventDefault();      // Ngăn hành vi tải xuống của trình duyệt
                e.stopPropagation();   // Ngăn sự kiện lan truyền tiếp
                return false;
            }
            // 6. Chặn Ctrl + Shift + C
            if (e.ctrlKey && e.shiftKey && (e.key === "C" || e.key === "c" || e.keyCode === 67)) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
        }
    }

    // Gắn listener với tham số { capture: true } để bắt sự kiện sớm nhất có thể
    document.addEventListener("contextmenu", blockContextMenu, { capture: true });
    window.addEventListener("keydown", blockDevTools, { capture: true });
}