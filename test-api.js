const fetch = globalThis.fetch;
(async () => {
    let videoId = '6MBq1paspVU';
    let res = await fetch('https://www.youtube.com/watch?v=' + videoId);
    let html = await res.text();
    let apiKey = (html.match(/"INNERTUBE_API_KEY":"([^"]+)"/) || [])[1];
    let clientNameRaw = (html.match(/"INNERTUBE_CLIENT_NAME":(\d+)/) || html.match(/"clientName":"([^"]+)"/) || [])[1];
    let clientName = isNaN(clientNameRaw) ? clientNameRaw || 'WEB' : parseInt(clientNameRaw);
    let clientVersion = (html.match(/"INNERTUBE_CLIENT_VERSION":"([^"]+)"/) || [])[1] || '2.20250225.01.00';
    let splitted = html.split('\"captions\":');
    let captions = JSON.parse(splitted[1].split(',\"videoDetails')[0].replace('\n', ''))?.playerCaptionsTracklistRenderer;
    let track = captions.captionTracks[0];

    let payload = {
        context: {
            client: {
                clientName: 'WEB', // Let's hardcode WEB to ensure it's handled correctly
                clientVersion: clientVersion,
            }
        },
        params: track.params
    };

    console.log('API Key:', apiKey);
    console.log('clientName:', 'WEB');
    console.log('clientVersion:', clientVersion);
    console.log('Params:', track.params);

    let trRes = await fetch('https://www.youtube.com/youtubei/v1/get_transcript?key=' + apiKey, {
        method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' }
    });
    console.log('Status:', trRes.status);
    let js = await trRes.json();
    console.log('Response Error?', js.error?.message, js.error?.code);
})();
