// /api/bilibili.js
export default async function handler(req, res) {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "Missing URL" });

  // You can set an env var CRAWLBASE_JS_TOKEN in Vercel (recommended).
  // If not set, the code will still try free endpoints first.
  const CRAWLBASE_JS_TOKEN = process.env.CRAWLBASE_JS_TOKEN || "EHLuestAzfw7pBwy2s4PKA";

  // Utility: safe fetch with timeout
  const doFetch = (u, opts = {}) => {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 20000);
    return fetch(u, { signal: controller.signal, ...opts })
      .finally(() => clearTimeout(t));
  };

  let bvid = null;

  // 1) If BV present in the incoming URL, use it directly
  const bvDirect = url.match(/BV[0-9A-Za-z]{10}/);
  if (bvDirect) bvid = bvDirect[0];

  // 2) If it's a bilibili.tv URL, try to convert
  const tvMatch = url.match(/bilibili\.tv\/[^\s\/]*\/video\/(\d{6,20})/i);
  if (!bvid && tvMatch) {
    const videoId = tvMatch[1];

    // Strategy A: free intl endpoint (fast, no token)
    try {
      const api1 = `https://www.bilibili.tv/intl/gateway/web/v2/app/video/info?video_id=${videoId}`;
      const r1 = await doFetch(api1, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          "Referer": "https://www.bilibili.tv/"
        }
      });
      const txt1 = await r1.text();

      // If response looks like JSON, parse; otherwise fall through
      if (!txt1.trim().startsWith("<")) {
        try {
          const j1 = JSON.parse(txt1);
          if (j1?.data?.bvid) bvid = j1.data.bvid;
        } catch (e) {
          // parse error -> fallthrough
        }
      }
    } catch (e) {
      // ignore, will try fallback
    }

    // Strategy B (fallback): fetch rendered page via Crawlbase JS token and extract BV from HTML
    if (!bvid) {
      try {
        const pageUrl = url; // original TV page
        // Use Crawlbase JS rendering parameter
        const crawlUrl = `https://api.crawlbase.com/?token=${encodeURIComponent(CRAWLBASE_JS_TOKEN)}&javascript=true&url=${encodeURIComponent(pageUrl)}&country=sg&timeout=30000`;
        const r2 = await doFetch(crawlUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
        });
        const html = await r2.text();

        // If HTML returned but contains JSON blob, try multiple patterns
        // Look for "bvid":"BV..." or plain BV occurrences
        let m = html.match(/"bvid"\s*:\s*"?(BV[0-9A-Za-z]{10})"?/i);
        if (!m) m = html.match(/BV[0-9A-Za-z]{10}/);
        if (m) bvid = m[1] || m[0];
      } catch (err) {
        // final fallback fails
        return res.status(500).json({ error: "Failed to convert bilibili.tv ID", details: err.message });
      }
    }
  }

  // If still no BV, invalid/unsupported URL
  if (!bvid) return res.status(400).json({ error: "Invalid Bilibili URL or BV not found" });

  // 3) Fetch main Bilibili video info via official API
  try {
    const infoUrl = `https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`;
    const infoRes = await doFetch(infoUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
    const info = await infoRes.json();

    if (!info || info.code !== 0) {
      return res.status(502).json({ error: "Failed to fetch video meta from Bilibili", raw: info });
    }

    const { title, desc, pic, owner, cid } = info.data;

    // 4) Build play/download URLs (these are Bili public playurl endpoints)
    const play_urls = [
      { quality: "HD", url: `https://api.bilibili.com/x/player/playurl?bvid=${bvid}&cid=${cid}&qn=80` },
      { quality: "SD", url: `https://api.bilibili.com/x/player/playurl?bvid=${bvid}&cid=${cid}&qn=64` },
      { quality: "LOW", url: `https://api.bilibili.com/x/player/playurl?bvid=${bvid}&cid=${cid}&qn=32` }
    ];

    return res.json({
      bvid,
      title,
      description: desc,
      thumbnail: pic,
      owner: owner?.name,
      play_urls
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch final Bilibili info", details: err.message });
  }
}
