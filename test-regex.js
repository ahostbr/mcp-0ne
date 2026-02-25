const fetch = globalThis.fetch;
(async () => {
    try {
        let pRes = await fetch('https://www.youtube.com/watch?v=6MBq1paspVU');
        let html = await pRes.text();
        let match = html.match(/"getTranscriptEndpoint":{"params":"([^"]+)"/);
        console.log('Regex params:', match ? match[1] : 'not found');
    } catch (e) { }
})();
