// eventManager.js - Centralized event listener management

const listeners = [];

export function addManagedEventListener(element, type, handler, options) {
    element.addEventListener(type, handler, options);
    listeners.push({ element, type, handler });
}

export function removeManagedEventListener(element, type, handler) {
    element.removeEventListener(type, handler);
    // Remove from listeners array
    for (let i = listeners.length - 1; i >= 0; i--) {
        if (listeners[i].element === element && listeners[i].type === type && listeners[i].handler === handler) {
            listeners.splice(i, 1);
        }
    }
}

export function cleanupAllEventListeners() {
    listeners.forEach(({ element, type, handler }) => {
        element.removeEventListener(type, handler);
    });
    listeners.length = 0;
}
