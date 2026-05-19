/**
 * URL Parser Utility
 * Validates and extracts information from Taobao and 1688 URLs
 */

class URLParser {
    /**
     * Check if URL is valid for Taobao or 1688
     */
    static isValidURL(url) {
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname.toLowerCase();
            return (
                hostname.includes('taobao.com') ||
                hostname.includes('1688.com')
            );
        } catch {
            return false;
        }
    }

    /**
     * Get platform from URL
     */
    static getPlatform(url) {
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname.toLowerCase();
            if (hostname.includes('1688.com')) return '1688';
            if (hostname.includes('taobao.com')) return 'taobao';
            return null;
        } catch {
            return null;
        }
    }

    /**
     * Extract product ID from Taobao URL
     */
    static getTaobaoProductId(url) {
        try {
            const urlObj = new URL(url);
            const id = urlObj.searchParams.get('id') || urlObj.searchParams.get('item_id');
            return id || null;
        } catch {
            return null;
        }
    }

    /**
     * Extract product ID from 1688 URL
     */
    static get1688ProductId(url) {
        try {
            const urlObj = new URL(url);
            const id = urlObj.searchParams.get('id') || urlObj.searchParams.get('offerDetail');
            return id || null;
        } catch {
            return null;
        }
    }

    /**
     * Extract product ID from any URL
     */
    static getProductId(url) {
        const platform = this.getPlatform(url);
        if (platform === 'taobao') {
            return this.getTaobaoProductId(url);
        } else if (platform === '1688') {
            return this.get1688ProductId(url);
        }
        return null;
    }

    /**
     * Normalize URL to ensure it's in correct format
     */
    static normalizeURL(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.href;
        } catch {
            // Try adding protocol if missing
            if (!url.includes('://')) {
                return this.normalizeURL(`https://${url}`);
            }
            return null;
        }
    }
}

module.exports = URLParser;
