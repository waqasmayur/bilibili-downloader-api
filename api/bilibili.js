export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: "Missing URL" });
  }

  let bvid = null;

  // -------------------------------
  // 1️⃣ HANDLE bilibili.com BV LINKS
  // -------------------------------
  const bvMatch = url.match(/BV[0-9A-Za-z]+/);
  if (bvMatch) {
    bvid = bvMatch[0];
  }

  // -------------------------------
  // 2️⃣ HANDLE bilibili.tv LINKS
  // -------------------------------
  const crawlbaseToken = process.env.CRAWLBASE_TOKEN;
  const tvMatch = url.match(/video\/(\d{10,20})/);

  if (!bvid && tvMatch) {
    const tvId = tvMatch[1];

    const apiUrl = `https://www.bilibili.tv/intl/gateway/v2/app/video/detail?video_id=${tvId}`;

    const crawlUrl =
      `https://api.crawlbase.com/?token=${crawlbaseToken}&js=true&country=sg&timeout=15000&url=${encodeURIComponent(apiUrl)}`;

    try {
      const raw = await fetch(crawlUrl);
      const text = await raw.text();

      // If HTML returned → block page (not JSON)
      if (text.trim().startsWith("<")) {
        return res.status(400).json({ error: "BilibiliTV HTML block page returned" });
      }

      // Try parse JSON
      const data = JSON.parse(text);

      if (data?.data?.data?.bvid) {
        bvid = data.data.data.bvid;
      } else {
        return res.status(400).json({ error: "Could not extract BV from bilibili.tv" });
      }
    } catch (err) {
      return res.status(400).json({ error: "Proxy conversion failed", details: err.toString() });
    }
  }

  // If STILL no BV → invalid URL
  if (!bvid) {
    return res.status(400).json({ error: "Invalid Bilibili URL" });
  }

  // -------------------------------
  // 3️⃣ GET VIDEO META INFO
  // -------------------------------
  try {
    const videoInfoUrl = `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`;
    const infoRes = await fetch(videoInfoUrl);
    const info = await infoRes.json();

    if (!info || info.code !== 0) {
      return res.status(500).json({ error: "Failed to fetch video info" });
    }

    const { title, desc, pic, owner, cid } = info.data;

    // -------------------------------
    // 4️⃣ BUILD DOWNLOAD LINKS
    // -------------------------------
    const play_urls = [
      { quality: "HD", url: `https://api.bilibili.com/x/player/playurl?bvid=${bvid}&cid=${cid}&qn=80` },
      { quality: "SD", url: `https://api.bilibili.com/x/player/playurl?bvid=${bvid}&cid=${cid}&qn=64` },
      { quality: "LOW", url: `https://api.bilibili.com/x/player/playurl?bvid=${bvid}&cid=${cid}&qn=32` }
    ];

    return res.json({
      title,
      thumbnail: pic,
      description: desc,
      owner: owner?.name,
      bvid,
      play_urls
    });

  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch video info" });
  }
}
