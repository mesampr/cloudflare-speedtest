export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const userIP = request.headers.get('CF-Connecting-IP') || '127.0.0.1';

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    // --- API SECTION ---
    
    // 1. Meta Data: Tells the UI the User's IP and ISP
    if (path === '/api/meta') {
      const cf = request.cf || {};
      return new Response(JSON.stringify({
        ip: userIP,
        isp: cf.asOrganization || 'Unknown ISP',
        colo: cf.colo || 'Cloudflare'
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    /**
     * 2. ADMIN LOG (Internal API)
     * DESCRIPTION: This handles the communication between the browser and your KV.
     * It receives the test result, opens the KV key "history", and adds the new data.
     */
    if (path === '/api/admin-log' && request.method === 'POST') {
      if (env.SPEED_KV) {
        const data = await request.json();
        // Here we use "history" as the storage key inside your KV Namespace
        let globalHistory = await env.SPEED_KV.get('history', { type: 'json' }) || [];
        data.ip = userIP;
        data.timestamp = new Date().toLocaleString();
        globalHistory.unshift(data);
        // Keeps the last 100 tests for you to monitor
        await env.SPEED_KV.put('history', JSON.stringify(globalHistory.slice(0, 100)));
      }
      return new Response('logged', { headers: corsHeaders });
    }

    // 3. Speed Test Endpoints (Ping, Download, Upload)
    if (path === '/api/ping') return new Response('pong', { headers: corsHeaders });

    if (path === '/api/download') {
      const size = 15 * 1024 * 1024; 
      const chunk = new Uint8Array(64 * 1024);
      let sent = 0;
      const stream = new ReadableStream({
        pull(controller) {
          if (sent >= size) controller.close();
          else { controller.enqueue(chunk); sent += chunk.length; }
        }
      });
      return new Response(stream, { headers: { ...corsHeaders, 'Content-Type': 'application/octet-stream' } });
    }

    if (path === '/api/upload') {
      await request.arrayBuffer();
      return new Response('received', { headers: corsHeaders });
    }

    // --- UI SECTION (HTML/CSS) ---
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Speedtest Pro</title>
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@100;300;400;600&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-gradient: linear-gradient(135deg, #141414 0%, #5e0a0a 100%);
            --text-white: #ffffff;
            --text-dim: rgba(255, 255, 255, 0.6);
            --accent: #ff4d4d;
            --stop-red: #d32f2f;
            --card-bg: rgba(0, 0, 0, 0.3);
        }
        body { margin: 0; background: var(--bg-gradient); color: var(--text-white); font-family: 'Montserrat', sans-serif; min-height: 100vh; display: flex; flex-direction: column; align-items: center; }
        .container { width: 100%; max-width: 1000px; padding: 20px; box-sizing: border-box; }
        .header { display: flex; justify-content: space-between; align-items: center; padding: 20px 0; margin-bottom: 20px; }
        .logo { font-weight: 600; font-size: 24px; letter-spacing: 1px; }
        .dashboard { display: grid; grid-template-columns: 220px 1fr 200px; gap: 20px; align-items: center; margin-bottom: 50px; }
        @media (max-width: 850px) { .dashboard { grid-template-columns: 1fr; text-align: center; gap: 40px; } }
        .col-small { display: flex; flex-direction: column; gap: 20px; }
        .stat-box-small { background: var(--card-bg); padding: 20px; border-radius: 12px; text-align: left; }
        .label-sm { font-size: 14px; color: var(--text-dim); text-transform: uppercase; margin-bottom: 5px; display: flex; align-items: center; gap: 8px; }
        .value-sm { font-size: 40px; font-weight: 300; line-height: 1; }
        .unit-sm { font-size: 14px; color: var(--text-dim); margin-left: 2px; }
        .col-large { display: flex; flex-direction: column; gap: 30px; padding: 0 20px; }
        .stat-box-large { text-align: center; }
        .label-lg { font-size: 16px; color: var(--text-dim); letter-spacing: 2px; margin-bottom: 5px; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .value-lg { font-size: 80px; font-weight: 100; line-height: 1; }
        .unit-lg { font-size: 20px; color: var(--accent); font-weight: 400; }
        .start-btn { width: 160px; height: 160px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.2); background: transparent; color: white; font-size: 20px; cursor: pointer; transition: 0.3s; position: relative; }
        .start-btn:hover { border-color: var(--accent); box-shadow: 0 0 30px rgba(185, 43, 39, 0.4); }
        .start-btn.is-running { background: var(--stop-red); border-color: var(--stop-red); box-shadow: 0 0 40px rgba(211, 47, 47, 0.6); font-weight: 600; }
        .start-btn.is-running::after { content: ""; position: absolute; top: -5px; left: -5px; right: -5px; bottom: -5px; border-radius: 50%; border: 2px solid var(--stop-red); animation: pulse 1.5s infinite; }
        @keyframes pulse { 0% { transform: scale(1); opacity: 1; } 100% { transform: scale(1.3); opacity: 0; } }
        .footer { display: flex; justify-content: space-between; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 20px; margin-bottom: 40px; }
        .info-group h4 { margin: 0; font-size: 14px; color: var(--text-dim); text-transform: uppercase; }
        .info-group p { margin: 5px 0; font-size: 16px; }
        .history-section { width: 100%; background: rgba(0,0,0,0.2); border-radius: 10px; padding: 20px; margin-top: 20px; }
        table { width: 100%; border-collapse: collapse; font-size: 14px; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .speed-cell { color: var(--accent); font-weight: 600; }
    </style>
</head>
<body>
<div class="container">
    <div class="header"><div class="logo">SPEEDTEST <span style="font-weight:100; opacity:0.7">WORKER</span></div></div>
    <div class="dashboard">
        <div class="col-small">
            <div class="stat-box-small">
                <div class="label-sm">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg> Ping
                </div>
                <div style="display:flex; align-items:baseline"><div class="value-sm" id="pingVal">--</div><div class="unit-sm">ms</div></div>
            </div>
            <div class="stat-box-small">
                <div class="label-sm">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V6s-1 1-4 1-5-2-8-2-4 1-4 1z"/></svg> Jitter
                </div>
                <div style="display:flex; align-items:baseline"><div class="value-sm" id="jitterVal">--</div><div class="unit-sm">ms</div></div>
            </div>
        </div>
        <div class="col-large">
            <div class="stat-box-large">
                <div class="label-lg">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M12 16l-6-6h4V4h4v6h4l-6 6zm-6 4h12v2H6v-2z"/></svg> DOWNLOAD
                </div>
                <div class="value-lg" id="dlVal">--</div><div class="unit-lg">Mbps</div>
            </div>
            <div class="stat-box-large">
                <div class="label-lg">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M12 8l6 6h-4v6h-4v-6H6l6-6zm6-4H6v2h12V4z"/></svg> UPLOAD
                </div>
                <div class="value-lg" id="ulVal">--</div><div class="unit-lg">Mbps</div>
            </div>
        </div>
        <div class="col-action"><button class="start-btn" id="startBtn" onclick="handleBtn()">GO</button></div>
    </div>
    <div class="footer">
        <div class="info-group"><h4>Client</h4><p id="clientIp">Searching...</p><p id="clientIsp" style="font-size:13px; opacity:0.7;">...</p></div>
        <div class="info-group" style="text-align:right"><h4>Server</h4><p id="serverLoc">Cloudflare Edge</p></div>
    </div>
    <div class="history-section">
        <h3 style="margin-top:0">Recent Tests</h3>
        <table id="historyTable">
            <thead><tr><th>Time</th><th>Ping</th><th>Download</th><th>Upload</th><th>ISP</th></tr></thead>
            <tbody></tbody>
        </table>
    </div>
</div>

<script>
    const api = window.location.origin + '/api';
    let currentController = null;

    function renderHistory() {
        const history = JSON.parse(localStorage.getItem('speed_history') || "[]");
        const tbody = document.querySelector('#historyTable tbody');
        tbody.innerHTML = history.length ? '' : '<tr><td colspan="5" style="text-align:center; opacity:0.5">No tests yet</td></tr>';
        history.forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = \`<td>\${row.timestamp}</td><td>\${row.ping} ms</td><td class="speed-cell">\${row.dl} Mbps</td><td class="speed-cell">\${row.ul} Mbps</td><td>\${row.isp}</td>\`;
            tbody.appendChild(tr);
        });
    }

    async function init() {
        try {
            const meta = await (await fetch(api + '/meta')).json();
            document.getElementById('clientIp').innerText = meta.ip;
            document.getElementById('clientIsp').innerText = meta.isp;
        } catch(e) {}
        renderHistory();
    }

    function handleBtn() {
        const btn = document.getElementById('startBtn');
        if (btn.classList.contains('is-running')) {
            if (currentController) currentController.abort();
            btn.classList.remove('is-running');
            btn.innerText = 'GO';
            return;
        }
        runTest();
    }

    async function runTest() {
        const btn = document.getElementById('startBtn');
        currentController = new AbortController();
        const signal = currentController.signal;

        btn.classList.add('is-running');
        btn.innerText = 'STOP';
        
        try {
            const meta = await (await fetch(api + '/meta', { signal })).json();
            
            // Ping & Jitter
            let pings = [];
            for(let i=0; i<10; i++) {
                if (signal.aborted) throw new Error('Aborted');
                const s = performance.now();
                await fetch(api + '/ping?t=' + s, { signal });
                pings.push(performance.now() - s);
                document.getElementById('pingVal').innerText = Math.round(pings[pings.length-1]);
            }
            const jitter = pings.reduce((acc, v, i) => i === 0 ? 0 : acc + Math.abs(v - pings[i-1]), 0) / (pings.length - 1);
            const finalPing = Math.round(Math.min(...pings));
            document.getElementById('pingVal').innerText = finalPing;
            document.getElementById('jitterVal').innerText = Math.round(jitter);

            // Download
            const dlS = performance.now();
            const dlRes = await fetch(api + '/download', { signal });
            const reader = dlRes.body.getReader();
            let dlSize = 0;
            while(true) {
                const {done, value} = await reader.read();
                if(done || signal.aborted) break;
                dlSize += value.length;
                const secs = (performance.now() - dlS) / 1000;
                document.getElementById('dlVal').innerText = ((dlSize * 8) / 1024 / 1024 / secs).toFixed(1);
            }
            if (signal.aborted) throw new Error('Aborted');
            const finalDl = document.getElementById('dlVal').innerText;

            // Upload (Stabilized)
            const upData = new Uint8Array(4 * 1024 * 1024);
            const upS = performance.now();
            let stabilizedS = null;

            const upInt = setInterval(() => {
                const now = performance.now();
                const totalSecs = (now - upS) / 1000;
                
                // Warm-up: 0.8 seconds to avoid buffer spikes
                if (totalSecs > 0.8) {
                    if (!stabilizedS) stabilizedS = now;
                    document.getElementById('ulVal').innerText = ((upData.length * 8) / 1024 / 1024 / totalSecs).toFixed(1);
                } else {
                    document.getElementById('ulVal').innerText = "...";
                }
            }, 100);
            
            await fetch(api + '/upload', { method: 'POST', body: upData, signal });
            clearInterval(upInt);
            if (signal.aborted) throw new Error('Aborted');
            
            const finalUp = ((upData.length * 8) / 1024 / 1024 / ((performance.now() - upS) / 1000)).toFixed(1);
            document.getElementById('ulVal').innerText = finalUp;

            const resData = { timestamp: new Date().toLocaleTimeString(), ping: finalPing, dl: finalDl, ul: finalUp, isp: meta.isp };

            // 1. User Local Storage (Private)
            let history = JSON.parse(localStorage.getItem('speed_history') || "[]");
            history.unshift(resData);
            localStorage.setItem('speed_history', JSON.stringify(history.slice(0, 10)));
            renderHistory();
            
            btn.classList.remove('is-running');
            btn.innerText = 'AGAIN';
            
            // 2. Admin Log (KV Key: "history")
            fetch(api + '/admin-log', { method: 'POST', body: JSON.stringify(resData) }).catch(() => {});
        } catch(e) {
            btn.classList.remove('is-running');
            btn.innerText = (e.message === 'Aborted') ? 'GO' : 'RETRY';
        }
    }
    init();
</script>
</body>
</html>`;

    return new Response(html, { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
  }
};
