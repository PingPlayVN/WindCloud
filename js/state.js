// js/state.js
// Centralized State Management System
// Provides safe, encapsulated state variables accessible across modules

// --- STATE VARIABLES ---
let isAdmin = false;
let appClipboard = { action: null, id: null };
let currentFolderId = null;

// --- EVENT LISTENERS ---
const stateChangeListeners = {
    isAdmin: [],
    appClipboard: [],
    currentFolderId: []
};

// --- GETTERS ---
export function getIsAdmin() {
    return isAdmin;
}

export function getAppClipboard() {
    return { ...appClipboard };
}

export function getCurrentFolderId() {
    return currentFolderId;
}

// --- SETTERS WITH NOTIFICATIONS ---
export function setIsAdmin(value) {
    if (isAdmin !== value) {
        isAdmin = value;
        notifyListeners('isAdmin', value);
    }
}

export function setAppClipboard(action, id) {
    appClipboard = { action, id };
    notifyListeners('appClipboard', appClipboard);
}

export function setCurrentFolderId(id) {
    if (currentFolderId !== id) {
        currentFolderId = id;
        notifyListeners('currentFolderId', id);
    }
}

// --- LISTENER MANAGEMENT ---
export function onStateChange(property, callback) {
    if (stateChangeListeners[property]) {
        stateChangeListeners[property].push(callback);
    }
}

export function offStateChange(property, callback) {
    if (stateChangeListeners[property]) {
        const index = stateChangeListeners[property].indexOf(callback);
        if (index > -1) {
            stateChangeListeners[property].splice(index, 1);
        }
    }
}

// --- INTERNAL NOTIFICATION ---
function notifyListeners(property, value) {
    if (stateChangeListeners[property]) {
        stateChangeListeners[property].forEach(callback => {
            try {
                callback(value);
            } catch (error) {
                console.error(`Error in state listener for ${property}:`, error);
            }
        });
    }
}

// --- RESET (useful for testing or logout) ---
export function resetState() {
    isAdmin = false;
    appClipboard = { action: null, id: null };
    currentFolderId = null;
}
