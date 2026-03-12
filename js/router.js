// router.js - Simple Vanilla Router for SPA

class Router {
    constructor(routes) {
        this.routes = routes;
        window.addEventListener('hashchange', this.route.bind(this));
        document.addEventListener('DOMContentLoaded', this.route.bind(this));
    }

    route() {
        const hash = window.location.hash.replace('#', '') || 'home';
        const route = this.routes[hash] || this.routes['404'];
        if (route && typeof route === 'function') {
            route();
        }
    }
}

export default Router;
