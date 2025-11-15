export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: "Missing URL" });
  }

  let bvid = null;

  // 1️⃣ Extract BV directly if present
  const bvMatch = url.match(/BV[0-9A-Za-z]+/);
  if (bvMatch) {
    bvid = bvMatch[0];
  }

  // 2️⃣ bilibili.tv numeric video ID
  const tvMatch = url.match(/video\/(\d{10,20})/);

  if (!bvid && tvMatch) {
    const crawlURL =
      `https://api.crawlbase.com/?token=EHLuestAzfw7pBwy2s4PKA&url=${encodeURIComponent(url)}&javascript=true`;

    try {
      const crawlRes = await fetch(crawlURL);
      const html = await crawlRes.text();

      // Try multiple BV patterns because bilibili.tv is inconsistent
      const patterns = [
        /"bvid":"(BV[0-9A-Za-z]+)"/,
        /"bvid":"(BV[A-Za-z0-9]+)"/,
        /"bvid":\s*"?(BV[A-Za-z0-9]+)"?/,
        /BV[A-Za-z0-9]{10}/
      ];

      for (let p of patterns) {
        let m = html.match(p);
        if (m) {
          bvid = m[1] || m[0];
          break;
        }
      }

      if (!bvid) {
        return res.status(400).json({
          error: "Cannot extract BV ID from bilibili.tv (JS version)",
        });
      }

    } catch (err) {
      return res.status(500).json({
        error: "Crawlbase JS fetch failed",
        details: err.message,
      });
    }
  }

  if (!bvid) {
    return res.status(400).json({ error: "Invalid Bilibili URL" });
  }

  // 3️⃣ Fetch normal Bilibili info
  try {
    const infoUrl = `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`;
    const infoRes = await fetch(infoUrl);
    const info = await infoRes.json();

    if (!info || info.code !== 0) {
      return res.status(500).json({ error: "Failed to fetch video info" });
    }

    const { title, desc, pic, owner, cid } = info.data;

    return res.json({
      bvid,
      title,
      description: desc,
      thumbnail: pic,
      owner: owner?.name,
      play_urls: [
        { quality: "HD", url: `https://api.bilibili.com/x/player/playurl?bvid=${bvid}&cid=${cid}&qn=80` },
        { quality: "SD", url: `https://api.bilibili.com/x/player/playurl?bvid=${bvid}&cid=${cid}&qn=64` },
        { quality: "LOW", url: `https://api.bilibili.com/x/player/playurl?bvid=${bvid}&cid=${cid}&qn=32` },
      ]
    });

  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch Bili info" });
  }
}
