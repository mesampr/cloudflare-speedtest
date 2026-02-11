# 🚀 Cloudflare Worker Speedtest

A lightweight, serverless internet speed test running entirely on **Cloudflare Workers**. It measures Ping, Jitter, Download, and Upload speeds without needing a heavy backend server.

![Speedtest UI](https://via.placeholder.com/800x400?text=Speedtest+Worker+UI)

## ✨ Features
* **⚡ Serverless:** Runs on Cloudflare's global edge network (low latency).
* **📉 Low Memory Footprint:** Uses **Stream API** for download tests to avoid crashing the 128MB RAM limit of the free tier.
* **💾 History Logging:** Saves test results (Ping, DL, UL, ISP) using **Cloudflare KV**.
* **🎨 Modern UI:** Responsive HTML/CSS interface with real-time progress updates.
* **📱 Mobile Friendly:** Fully responsive grid layout.

## 🛠️ Setup & Deployment

### 1. Prerequisites
* A Cloudflare account.
* Node.js and npm installed.
* Wrangler CLI installed (`npm install -g wrangler`).

### 2. Configuration
1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/YOUR_USERNAME/cloudflare-speedtest.git](https://github.com/YOUR_USERNAME/cloudflare-speedtest.git)
    cd cloudflare-speedtest
    ```

2.  **Create a KV Namespace:**
    Run this command to create a database for your history logs:
    ```bash
    wrangler kv:namespace create "SPEED_HISTORY"
    ```
    *Copy the `id` output from this command.*

3.  **Update `wrangler.toml`:**
    Create a `wrangler.toml` file in the root directory:
    ```toml
    name = "speedtest-worker"
    main = "src/index.js"
    compatibility_date = "2024-01-01"

    [[kv_namespaces]]
    binding = "SPEED_KV"
    id = "PASTE_YOUR_KV_ID_HERE"
    ```

### 3. Deploy
Run the deploy command:
```bash
wrangler deploy
