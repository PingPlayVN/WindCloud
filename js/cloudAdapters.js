// js/cloudAdapters.js

// Storage providers and resolve logic extracted for easy extension (Factory/Adapter pattern)
export const StorageProviders = {
    drive: {
        getThumb: (id) => id ? `https://drive.google.com/thumbnail?id=${id}&sz=w400` : '',
        getDownloadUrl: (id) => `https://drive.google.com/uc?export=download&id=${id}`
    },
    dropbox: {
        getThumb: (id) => '',
        // Dropbox share links may be in several formats. Normalize common variants to direct download.
        getDownloadUrl: (id) => {
            if (!id) return '';
            const s = String(id).trim();
            // If it's already a full http(s) URL
            try {
                const url = new URL(s);
                // Dropbox shared links typically end with ?dl=0 or dl=1 or www.dropbox.com/s/...
                if (url.hostname.includes('dropbox.com')) {
                    // Prefer dl=1 to force download
                    if (url.searchParams.has('dl')) {
                        url.searchParams.set('dl', '1');
                        return url.toString();
                    }
                    // If path contains /s/ it's a shared file
                    if (url.pathname.includes('/s/')) {
                        url.searchParams.set('dl', '1');
                        return url.toString();
                    }
                }
                // Otherwise return original
                return s;
            } catch (e) {
                // Not a URL - maybe an id or path, return prefixed https
                if (s.startsWith('www.')) return 'https://' + s;
                return s;
            }
        }
    },
    direct_link: {
        getThumb: (id) => '',
        getDownloadUrl: (id) => id || ''
    }
};

export function resolveProvider(dataOrName) {
    const data = dataOrName || {};
    const src = data && data.source;
    const id = data && data.id;

    if (src && StorageProviders[src]) return StorageProviders[src];
    if (id && String(id).includes('dropbox')) return StorageProviders.dropbox;
    if (id && String(id).startsWith('http')) return StorageProviders.direct_link;
    return StorageProviders.drive;
}
