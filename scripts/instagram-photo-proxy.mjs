import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const parseRequestBody = (req) => {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                resolve(JSON.parse(body || '{}'));
            } catch (err) {
                reject(err);
            }
        });
        req.on('error', err => {
            reject(err);
        });
    });
};

const PORT = 8787;
const INSTAGRAM_WEB_APP_ID = '936619743392459';

export const extractOgImageFromHtml = (html) => {
    const ogImageMetaMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i)
        || html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:image["']/i);

    if (!ogImageMetaMatch?.[1]) {
        return null;
    }

    return ogImageMetaMatch[1].replace(/&amp;/g, '&');
};

const sendJson = (res, statusCode, payload) => {
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.end(JSON.stringify(payload));
};

export const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

    if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.end();
        return;
    }

    if (req.method === 'POST' && req.url === '/api/incorporate-plan') {
        try {
            const plan = await parseRequestBody(req);
            if (!plan || !plan.id || !plan.name) {
                sendJson(res, 400, { error: 'Invalid plan payload' });
                return;
            }

            const __dirname = path.dirname(fileURLToPath(import.meta.url));
            const rootDir = path.resolve(__dirname, '..');
            
            const srcPlansDir = path.join(rootDir, 'src', 'plans');
            const distPlansDir = path.join(rootDir, 'dist', 'plans');

            // Ensure directories exist
            fs.mkdirSync(srcPlansDir, { recursive: true });
            fs.mkdirSync(distPlansDir, { recursive: true });

            const jsonStr = JSON.stringify(plan, null, 2);

            // Write to src/plans/ and dist/plans/
            fs.writeFileSync(path.join(srcPlansDir, `${plan.id}.json`), jsonStr, 'utf8');
            fs.writeFileSync(path.join(distPlansDir, `${plan.id}.json`), jsonStr, 'utf8');

            sendJson(res, 200, { success: true, id: plan.id });
        } catch (error) {
            console.error('Incorporate plan failed:', error);
            sendJson(res, 500, { error: 'Failed to save incorporated plan: ' + error.message });
        }
        return;
    }

    if (!req.url || req.method !== 'GET') {
        sendJson(res, 404, { error: 'Not found' });
        return;
    }

    const match = req.url.match(/^\/api\/instagram-photo\/([^/?#]+)/i);
    if (!match) {
        sendJson(res, 404, { error: 'Not found' });
        return;
    }

    const username = decodeURIComponent(match[1]).trim();
    if (!username) {
        sendJson(res, 400, { error: 'Missing username' });
        return;
    }

    try {
        const profileResponse = await fetch(
            `https://i.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`,
            {
                headers: {
                    'x-ig-app-id': INSTAGRAM_WEB_APP_ID,
                    accept: 'application/json',
                    'user-agent': 'Mozilla/5.0',
                },
            },
        );

        if (profileResponse.ok) {
            const payload = await profileResponse.json();
            const imageUrl = payload?.data?.user?.profile_pic_url_hd || payload?.data?.user?.profile_pic_url;

            if (imageUrl) {
                res.statusCode = 302;
                res.setHeader('Location', imageUrl);
                res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
                res.end();
                return;
            }
        }

        // Fallback path: parse og:image from the public profile HTML.
        const htmlResponse = await fetch(`https://www.instagram.com/${encodeURIComponent(username)}/`, {
            headers: {
                accept: 'text/html,application/xhtml+xml',
                'user-agent': 'Mozilla/5.0',
            },
        });

        if (!htmlResponse.ok) {
            sendJson(res, 404, { error: 'Instagram profile lookup failed' });
            return;
        }

        const html = await htmlResponse.text();
        const imageUrl = extractOgImageFromHtml(html);

        if (!imageUrl) {
            sendJson(res, 404, { error: 'Profile image not found' });
            return;
        }

        res.statusCode = 302;
        res.setHeader('Location', imageUrl);
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.end();
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error(`Proxy request failed for ${username}:`, error);
        sendJson(res, 500, { error: 'Proxy request failed' });
    }
});

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
    server.listen(PORT, () => {
        // eslint-disable-next-line no-console
        console.log(`Instagram photo proxy running at http://localhost:${PORT}`);
    });
}
