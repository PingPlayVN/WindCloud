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

    // Handler to block DevTools hotkeys
    function blockDevTools(e) {
        if (!window.isAdmin) {
            // F12
            if (e.key === "F12") {
                e.preventDefault();
                return false;
            }
            // Ctrl + Shift + I
            if (e.ctrlKey && e.shiftKey && e.key.toUpperCase() === "I") {
                e.preventDefault();
                return false;
            }
            // Ctrl + Shift + J
            if (e.ctrlKey && e.shiftKey && e.key.toUpperCase() === "J") {
                e.preventDefault();
                return false;
            }
            // Ctrl + U (view source)
            if (e.ctrlKey && e.key.toUpperCase() === "U") {
                e.preventDefault();
                return false;
            }
        }
    }

    // Attach listeners once (they check isAdmin internally)
    document.addEventListener("contextmenu", blockContextMenu, true);
    document.addEventListener("keydown", blockDevTools, true);
}
