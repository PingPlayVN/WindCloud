const activeStack = [];
const modalState = new WeakMap();

function isVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    const rects = el.getClientRects();
    return rects.length > 0;
}

function getFocusableElements(container) {
    if (!container) return [];
    const candidates = Array.from(
        container.querySelectorAll(
            [
                'a[href]',
                'area[href]',
                'button:not([disabled])',
                'input:not([disabled]):not([type="hidden"])',
                'select:not([disabled])',
                'textarea:not([disabled])',
                'iframe',
                'object',
                'embed',
                '[contenteditable="true"]',
                '[tabindex]:not([tabindex="-1"])'
            ].join(',')
        )
    );
    return candidates.filter((el) => isVisible(el));
}

function focusFirst(modalEl) {
    const focusables = getFocusableElements(modalEl);
    if (focusables.length > 0) {
        focusables[0].focus();
        return true;
    }
    return false;
}

function focusLast(modalEl) {
    const focusables = getFocusableElements(modalEl);
    if (focusables.length > 0) {
        focusables[focusables.length - 1].focus();
        return true;
    }
    return false;
}

function isTopmost(modalEl) {
    return activeStack.length > 0 && activeStack[activeStack.length - 1] === modalEl;
}

export function activateModal(modalEl, { initialFocus = null, onClose = null } = {}) {
    if (!modalEl) return;
    if (modalState.has(modalEl)) return;

    const previousActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!modalEl.hasAttribute('tabindex')) modalEl.setAttribute('tabindex', '-1');

    activeStack.push(modalEl);

    const onKeyDown = (e) => {
        if (!isTopmost(modalEl)) return;
        if (!isVisible(modalEl)) return;

        if (e.key === 'Escape') {
            if (typeof onClose === 'function') {
                e.preventDefault();
                e.stopPropagation();
                onClose();
            }
            return;
        }

        if (e.key !== 'Tab') return;

        const focusables = getFocusableElements(modalEl);
        if (focusables.length === 0) {
            e.preventDefault();
            modalEl.focus();
            return;
        }

        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        const isInside = active instanceof Node && modalEl.contains(active);

        if (!isInside) {
            e.preventDefault();
            first.focus();
            return;
        }

        if (e.shiftKey) {
            if (active === first) {
                e.preventDefault();
                last.focus();
            }
        } else {
            if (active === last) {
                e.preventDefault();
                first.focus();
            }
        }
    };

    const onFocusIn = (e) => {
        if (!isTopmost(modalEl)) return;
        if (!isVisible(modalEl)) return;
        if (!(e.target instanceof Node)) return;
        if (modalEl.contains(e.target)) return;
        focusFirst(modalEl) || modalEl.focus();
    };

    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('focusin', onFocusIn, true);

    modalState.set(modalEl, { previousActiveElement, onKeyDown, onFocusIn });

    queueMicrotask(() => {
        if (!modalState.has(modalEl)) return;
        if (!isVisible(modalEl)) return;

        if (initialFocus instanceof HTMLElement && modalEl.contains(initialFocus) && isVisible(initialFocus)) {
            initialFocus.focus();
            return;
        }

        if (focusFirst(modalEl)) return;
        modalEl.focus();
    });
}

export function deactivateModal(modalEl, { restoreFocus = true } = {}) {
    if (!modalEl) return;
    const state = modalState.get(modalEl);
    if (!state) return;

    document.removeEventListener('keydown', state.onKeyDown, true);
    document.removeEventListener('focusin', state.onFocusIn, true);
    modalState.delete(modalEl);

    const idx = activeStack.lastIndexOf(modalEl);
    if (idx !== -1) activeStack.splice(idx, 1);

    if (!restoreFocus) return;
    const el = state.previousActiveElement;
    if (el && document.contains(el) && typeof el.focus === 'function') el.focus();
}

