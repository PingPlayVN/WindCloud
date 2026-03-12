// js/mobileContextMenu.js
// Mobile context menu with long-press support

export function initMobileContextMenu() {
    let touchStartX = 0;
    let touchStartY = 0;
    let touchTarget = null;
    let longPressTimer = null;
    let isLongPress = false;
    const LONG_PRESS_DURATION = 500; // milliseconds
    const MOVE_THRESHOLD = 10; // pixels - allow small movement before cancelling

    /**
     * Simulates a context menu event for mobile devices
     * Creates a synthetic MouseEvent that mimics right-click
     */
    function createContextMenuEvent(touchEvent) {
        const touch = touchEvent.touches[0] || touchEvent.changedTouches[0];
        const mouseEvent = new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: touch.clientX,
            clientY: touch.clientY,
            pageX: touch.pageX,
            pageY: touch.pageY,
            screenX: touch.screenX,
            screenY: touch.screenY
        });

        // Copy touch target to the synthetic event
        Object.defineProperty(mouseEvent, 'target', {
            value: touchEvent.target,
            enumerable: true
        });

        return mouseEvent;
    }

    /**
     * Check if element or its parent is a card (for context menu item handling)
     */
    function isContextMenuTarget(element) {
        // Check if it's a card element or can trigger context menu
        const card = element.closest('.card');
        const appCloud = element.closest('#app-cloud');
        return !!(card || appCloud);
    }

    /**
     * Handle touch start
     */
    function handleTouchStart(e) {
        if (!isContextMenuTarget(e.target)) return;

        const touch = e.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        touchTarget = e.target;
        isLongPress = false;

        // Start long-press timer
        longPressTimer = setTimeout(() => {
            isLongPress = true;
            // Add visual feedback
            addLongPressIndicator(e.target);
            // Trigger synthetic context menu event
            const contextEvent = createContextMenuEvent(e);
            document.dispatchEvent(contextEvent);
            touchTarget.dispatchEvent(contextEvent);
        }, LONG_PRESS_DURATION);
    }

    /**
     * Handle touch move - cancel long-press if user moves too far
     */
    function handleTouchMove(e) {
        if (!longPressTimer || !touchTarget) return;

        const touch = e.touches[0];
        const moveX = Math.abs(touch.clientX - touchStartX);
        const moveY = Math.abs(touch.clientY - touchStartY);
        const totalMove = Math.sqrt(moveX * moveX + moveY * moveY);

        // Cancel long-press if user moves too far
        if (totalMove > MOVE_THRESHOLD) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
            removeLongPressIndicator(touchTarget);
        }
    }

    /**
     * Handle touch end
     */
    function handleTouchEnd(e) {
        clearTimeout(longPressTimer);
        longPressTimer = null;

        if (touchTarget) {
            removeLongPressIndicator(touchTarget);
        }

        // Prevent default click if was long-press
        if (isLongPress) {
            isLongPress = false;
            e.preventDefault();
        }

        touchTarget = null;
    }

    /**
     * Add visual feedback during long-press
     */
    function addLongPressIndicator(element) {
        // Remove any existing indicator
        removeLongPressIndicator(element);

        // Add a visual indicator class
        element.classList.add('long-press-active');

        // Create and show ripple effect for better UX
        const ripple = document.createElement('div');
        ripple.className = 'ripple-effect';
        element.style.position = 'relative';
        element.appendChild(ripple);

        // Add animation
        setTimeout(() => ripple.classList.add('ripple-animate'), 10);
    }

    /**
     * Remove visual feedback
     */
    function removeLongPressIndicator(element) {
        if (!element) return;

        element.classList.remove('long-press-active');

        // Remove ripple effect
        const ripple = element.querySelector('.ripple-effect');
        if (ripple) {
            ripple.classList.remove('ripple-animate');
            setTimeout(() => ripple.remove(), 300);
        }
    }

    /**
     * Initialize event listeners
     */
    function initializeListeners() {
        document.addEventListener('touchstart', handleTouchStart, { passive: true });
        document.addEventListener('touchmove', handleTouchMove, { passive: true });
        document.addEventListener('touchend', handleTouchEnd, { passive: false });
        document.addEventListener('touchcancel', handleTouchEnd, { passive: false });
    }

    // Initialize on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeListeners);
    } else {
        initializeListeners();
    }

    // Return API for external usage
    return {
        createContextMenuEvent,
        isContextMenuTarget
    };
}

// Also handle when clicking outside context menu on mobile (to close it)
export function enableMobileContextMenuDismissal() {
    document.addEventListener('touchstart', (e) => {
        const contextMenu = document.getElementById('contextMenu');
        if (!contextMenu) return;

        // Close menu if user touches outside of it
        if (contextMenu.style.display === 'block' && 
            !e.target.closest('#contextMenu') && 
            !e.target.closest('.card') &&
            !e.target.closest('#app-cloud')) {
            contextMenu.style.display = 'none';
        }
    }, { passive: true });
}
