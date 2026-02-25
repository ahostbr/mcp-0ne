const fetch = globalThis.fetch;
(async () => {
    try {
        let pRes = await fetch('https://www.youtube.com/watch?v=6MBq1paspVU');
        let html = await pRes.text();
        const split = html.split('"captions":');
        const captions = JSON.parse(split[1].split(',"videoDetails')[0].replace('\n', ''))?.playerCaptionsTracklistRenderer;

        let url = captions.captionTracks[0].baseUrl;
        console.log('Original BaseUrl:', url.substring(0, 100));

        for (const fmt of ['', '&fmt=json3', '&fmt=srv1', '&fmt=vtt']) {
            let res = await fetch(url + fmt, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            let text = await res.text();
            console.log(`Format [${fmt || 'default'}] -> Length: ${text.length} -> `, text.substring(0, 50));
        }
    } catch (e) { console.error(e.message); }
})();
