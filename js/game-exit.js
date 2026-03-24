// Common exit handler for all games in /games folder
// When a game calls `exitToWindGame()` this will navigate back to the main
// index and trigger the Wind Game tab restore (via core.js auto-restore).

window.exitToWindGame = function() {
    try {
        // If running inside an iframe (e.g. mobile fullscreen host), ask parent to close the overlay.
        try {
            if (window.parent && window.parent !== window) {
                window.parent.postMessage({ type: 'windgame:exit' }, '*');
                return;
            }
        } catch (ignored) {}

        // navigate to root index with #windgame hash so core.js can restore the tab
        window.location.href = '../../index.html#windgame';
    } catch (e) {
        // fallback: try parent opener if available
        try {
            if (window.opener && !window.opener.closed) {
                try { window.opener.location.href = '/index.html#windgame'; } catch (e2) { /* ignore cross-origin */ }
            }
        } catch (ignored) {}
        // final fallback
        window.location.href = '/index.html#windgame';
    }
};

// debug log removed for production
