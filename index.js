export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    // --- API SECTION ---
    if (path === '/api/meta') {
      const cf = request.cf || {};
      return new Response(JSON.stringify({
        ip: request.headers.get('CF-Connecting-IP') || '127.0.0.1',
        isp: cf.asOrganization || 'Unknown ISP',
        country: cf.country || 'XX',
        colo: cf.colo || 'Cloudflare'
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (path === '/api/ping') return new Response('pong', { headers: corsHeaders });

    if (path === '/api/download') {
      // Stream 15MB of data to avoid memory crashes
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

    if (path === '/api/record' && request.method === 'POST') {
      const data = await request.json();
      if (env.SPEED_KV) {
        let history = await env.SPEED_KV.get('history', { type: 'json' }) || [];
        data.timestamp = new Date().toLocaleString();
        history.unshift(data);
        await env.SPEED_KV.put('history', JSON.stringify(history.slice(0, 10)));
      }
      return new Response('ok', { headers: corsHeaders });
    }

    if (path === '/api/history') {
      const history = env.SPEED_KV ? await env.SPEED_KV.get('history', { type: 'json' }) : [];
      return new Response(JSON.stringify(history || []), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // --- UI SECTION ---
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
            --card-bg: rgba(0, 0, 0, 0.3);
        }
        body { margin: 0; background: var(--bg-gradient); color: var(--text-white); font-family: 'Montserrat', sans-serif; min-height: 100vh; display: flex; flex-direction: column; align-items: center; }
        .container { width: 100%; max-width: 1000px; padding: 20px; box-sizing: border-box; }
        .header { display: flex; justify-content: space-between; align-items: center; padding: 20px 0; margin-bottom: 20px; }
        .logo { font-weight: 600; font-size: 24px; letter-spacing: 1px; }
        
        /* Grid Layout */
        .dashboard { display: grid; grid-template-columns: 220px 1fr 200px; gap: 20px; align-items: center; margin-bottom: 50px; }
        @media (max-width: 850px) { .dashboard { grid-template-columns: 1fr; text-align: center; gap: 40px; } }

        /* Ping/Jitter Column */
        .col-small { display: flex; flex-direction: column; gap: 20px; }
        .stat-box-small { background: var(--card-bg); padding: 20px; border-radius: 12px; text-align: left; }
        .label-sm { font-size: 14px; color: var(--text-dim); text-transform: uppercase; margin-bottom: 5px; display: flex; align-items: center; gap: 8px; }
        .value-sm { font-size: 40px; font-weight: 300; line-height: 1; } /* Increased size */
        .unit-sm { font-size: 14px; color: var(--text-dim); margin-left: 2px; }

        /* Speed Column */
        .col-large { display: flex; flex-direction: column; gap: 30px; padding: 0 20px; }
        .stat-box-large { text-align: center; }
        .label-lg { font-size: 16px; color: var(--text-dim); letter-spacing: 2px; margin-bottom: 5px; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .value-lg { font-size: 80px; font-weight: 100; line-height: 1; text-shadow: 0 0 20px rgba(255,255,255,0.1); }
        .unit-lg { font-size: 20px; color: var(--accent); font-weight: 400; }

        /* Button */
        .col-action { display: flex; justify-content: center; }
        .start-btn { width: 160px; height: 160px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.2); background: transparent; color: white; font-size: 20px; cursor: pointer; transition: 0.3s; position: relative; overflow: hidden; }
        .start-btn:hover { background: rgba(255,255,255,0.05); border-color: var(--accent); box-shadow: 0 0 30px rgba(185, 43, 39, 0.4); }
        .start-btn.loading { border-top-color: var(--accent); animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }

        .footer { display: flex; justify-content: space-between; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 20px; margin-bottom: 40px; }
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
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                    Ping
                </div>
                <div style="display:flex; align-items:baseline">
                    <div class="value-sm" id="pingVal">--</div>
                    <div class="unit-sm">ms</div>
                </div>
            </div>
            <div class="stat-box-small">
                <div class="label-sm">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V6s-1 1-4 1-5-2-8-2-4 1-4 1z"/></svg>
                    Jitter
                </div>
                <div style="display:flex; align-items:baseline">
                    <div class="value-sm" id="jitterVal">--</div>
                    <div class="unit-sm">ms</div>
                </div>
            </div>
        </div>

        <div class="col-large">
            <div class="stat-box-large">
                <div class="label-lg">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M12 16l-6-6h4V4h4v6h4l-6 6zm-6 4h12v2H6v-2z"/></svg> 
                    DOWNLOAD
                </div>
                <div class="value-lg" id="dlVal">--</div>
                <div class="unit-lg">Mbps</div>
            </div>
            <div class="stat-box-large">
                <div class="label-lg">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M12 8l6 6h-4v6h-4v-6H6l6-6zm6-4H6v2h12V4z"/></svg>
                    UPLOAD
                </div>
                <div class="value-lg" id="ulVal">--</div>
                <div class="unit-lg">Mbps</div>
            </div>
        </div>

        <div class="col-action"><button class="start-btn" id="startBtn" onclick="runTest()">GO</button></div>
    </div>

    <div class="footer">
        <div class="info-group"><h4>Client</h4><p id="clientIp">Searching...</p><p id="clientIsp" style="font-size:13px; opacity:0.7;">...</p></div>
        <div class="info-group" style="text-align:right"><h4>Server</h4><p id="serverLoc">Cloudflare Edge</p></div>
    </div>

    <div class="history-section">
        <h3>Recent Tests</h3>
        <table id="historyTable">
            <thead><tr><th>Time</th><th>Ping</th><th>Download</th><th>Upload</th><th>ISP</th></tr></thead>
            <tbody></tbody>
        </table>
    </div>
</div>

<script>
    const api = window.location.origin + '/api';

    async function fetchHistory() {
        try {
            const res = await fetch(api + '/history');
            const data = await res.json();
            const tbody = document.querySelector('#historyTable tbody');
            tbody.innerHTML = data.length ? '' : '<tr><td colspan="5" style="text-align:center; opacity:0.5">No tests yet</td></tr>';
            data.forEach(row => {
                const tr = document.createElement('tr');
                tr.innerHTML = \`<td>\${row.timestamp}</td><td>\${row.ping} ms</td><td class="speed-cell">\${row.dl} Mbps</td><td class="speed-cell">\${row.ul} Mbps</td><td>\${row.isp}</td>\`;
                tbody.appendChild(tr);
            });
        } catch (e) {}
    }

    async function runTest() {
        const btn = document.getElementById('startBtn');
        btn.classList.add('loading');
        btn.innerText = '';
        
        // Reset UI
        ['pingVal','jitterVal','dlVal','ulVal'].forEach(id => document.getElementById(id).innerText = '--');

        try {
            const meta = await (await fetch(api + '/meta')).json();
            document.getElementById('clientIp').innerText = meta.ip;
            document.getElementById('clientIsp').innerText = meta.isp;

            // 1. Ping & Jitter
            let pings = [];
            for(let i=0; i<10; i++) {
                const s = performance.now();
                await fetch(api + '/ping?t=' + s);
                pings.push(performance.now() - s);
                document.getElementById('pingVal').innerText = Math.round(pings[pings.length-1]);
                await new Promise(r => setTimeout(r, 50));
            }
            const minPing = Math.min(...pings);
            // Standard Jitter: Average of absolute differences between consecutive pings
            let jitterSum = 0;
            for(let i=1; i<pings.length; i++) {
                jitterSum += Math.abs(pings[i] - pings[i-1]);
            }
            const jitter = jitterSum / (pings.length - 1);
            
            document.getElementById('pingVal').innerText = Math.round(minPing);
            document.getElementById('jitterVal').innerText = Math.round(jitter);

            // 2. Download Test
            const dlS = performance.now();
            const dlRes = await fetch(api + '/download');
            const reader = dlRes.body.getReader();
            let dlSize = 0;
            while(true) {
                const {done, value} = await reader.read();
                if(done) break;
                dlSize += value.length;
                const secs = (performance.now() - dlS) / 1000;
                // Live update
                if(secs > 0.1) document.getElementById('dlVal').innerText = ((dlSize * 8) / 1024 / 1024 / secs).toFixed(1);
            }
            const finalDl = document.getElementById('dlVal').innerText;

            // 3. Upload Test
            const upData = new Uint8Array(4 * 1024 * 1024); // 4MB
            const upS = performance.now();
            
            // Artificial live counter for upload (since fetch doesn't give progress)
            const upInt = setInterval(() => {
                const secs = (performance.now() - upS) / 1000;
                if(secs > 0) {
                    const mockSpeed = ((upData.length * 8) / 1024 / 1024 / secs);
                    // Cap the visual speed so it doesn't look infinite at start
                    if(mockSpeed < 500) document.getElementById('ulVal').innerText = mockSpeed.toFixed(1);
                }
            }, 100);

            await fetch(api + '/upload', { method: 'POST', body: upData });
            clearInterval(upInt);
            
            const finalUp = ((upData.length * 8) / 1024 / 1024 / ((performance.now() - upS) / 1000)).toFixed(1);
            document.getElementById('ulVal').innerText = finalUp;

            // 4. Save
            await fetch(api + '/record', { 
                method: 'POST', 
                body: JSON.stringify({ 
                    ping: Math.round(minPing), 
                    dl: finalDl, 
                    ul: finalUp, 
                    isp: meta.isp 
                }) 
            });
            
            fetchHistory();
            btn.innerText = 'AGAIN';

        } catch(e) {
            console.error(e);
            btn.innerText = 'RETRY';
        }
        btn.classList.remove('loading');
    }
    fetchHistory();
</script>
</body>
</html>
`;

    return new Response(html, { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
  }
};
