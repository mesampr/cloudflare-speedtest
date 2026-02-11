# 🚀 Cloudflare Worker Speedtest

A lightweight, serverless internet speed test running entirely on **Cloudflare Workers**. This project measures Ping, Jitter, Download, and Upload speeds using Cloudflare's global edge network.

## ✨ Features
* **⚡ Serverless:** Zero server maintenance, runs on the edge.
* **📈 Optimized for Free Tier:** Uses **Streaming API** to ensure it stays within the 128MB RAM limit.
* **💾 History Logging:** Automatically saves your last 10 test results.
* **🎨 Professional UI:** Responsive design with real-time speed updates and SVG icons.

## 🛠️ Setup & Deployment (via Cloudflare Dashboard)

### Step 1: Create the KV Namespace (For History)
1. Log in to your **Cloudflare Dashboard**.
2. Navigate to **Workers & Pages** > **KV**.
3. Click **Create a namespace**.
4. Name it `SPEED_HISTORY` and click **Add**.

### Step 2: Create the Worker
1. Go to **Workers & Pages** > **Overview**.
2. Click **Create application** > **Create Worker**.
3. Give it a name (e.g., `speedtest-worker`) and click **Deploy**.
4. Click **Edit Code**.
5. Delete the default code and paste the code from `index.js` in this repository.
6. Click **Save and Deploy**.

### Step 3: Bind the KV to the Worker
1. Go back to your Worker's main page.
2. Go to the **Settings** tab > **Variables**.
3. Scroll down to **KV Namespace Bindings** and click **Add binding**.
4. Set the **Variable name** to `SPEED_KV`.
5. Set the **KV namespace** to `SPEED_HISTORY`.
6. Click **Save and Deploy**.

## 📊 How it Works

* **Ping:** Measures the round-trip time to the nearest Cloudflare PoP.
* **Download:** Streams random data chunks to calculate speed without filling memory.
* **Upload:** Sends a POST request to calculate the time taken to transmit data.

## 📝 License
MIT
