describe('instagram-photo-proxy parser', () => {
    test('extracts og:image URL from property-first tag', async () => {
        const { extractOgImageFromHtml } = await import('./instagram-photo-proxy.mjs');
        const html = '<meta property="og:image" content="https://example.com/image.jpg" />';
        expect(extractOgImageFromHtml(html)).toBe('https://example.com/image.jpg');
    });

    test('extracts og:image URL from content-first tag and decodes ampersand', async () => {
        const { extractOgImageFromHtml } = await import('./instagram-photo-proxy.mjs');
        const html = '<meta content="https://example.com/image.jpg?x=1&amp;y=2" property="og:image" />';
        expect(extractOgImageFromHtml(html)).toBe('https://example.com/image.jpg?x=1&y=2');
    });

    test('returns null when og:image is missing', async () => {
        const { extractOgImageFromHtml } = await import('./instagram-photo-proxy.mjs');
        const html = '<html><head><title>No image</title></head></html>';
        expect(extractOgImageFromHtml(html)).toBeNull();
    });
});
