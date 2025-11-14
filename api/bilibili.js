export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: "Missing URL" });
  }

  const crawlbaseToken = "s15AoDB0-2Mmb50HO1IlWQ";

  let bvid = null;

  // ---------------------------------------------------------
  // 1️⃣ If URL already has BV ID (bilibili.com)
  // ---------------------------------------------------------
  const bvMatch = url.match(/BV[0-9A-Za-z]+/);
  if (bvMatch) {
    bvid = bvMatch[0];
  }

  // ---------------------------------------------------------
  // 2️⃣ Handle bilibili.tv URLs → extract HTML → find BV
  // ---------------------------------------------------------
  if (!bvid && url.includes("bilibili.tv")) {
    try {
      const crawlUrl = `https://api.crawlbase.com/?token=${crawlbaseToken}&url=${encodeURIComponent(url)}`;

      const response = await fetch(crawlUrl);
      const html = await response.text();

      // Search BV in crawled HTML
      const findBV = html.match(/BV[0-9A-Za-z]{10}/);
      if (findBV) {
        bvid = findBV[0];
      } else {
        return res.status(500).json({
          error: "Failed to extract BV ID from bilibili.tv page"
        });
      }
    } catch (err) {
      return res.status(500).json({
        error: "Crawlbase request failed",
        details: err.toString()
      });
    }
  }

  // ---------------------------------------------------------
  // 3️⃣ If STILL no BV → invalid URL
  // ---------------------------------------------------------
  if (!bvid) {
    return res.status(400).json({ error: "Invalid Bilibili URL" });
  }

  // ---------------------------------------------------------
  // 4️⃣ Fetch real Bilibili video info
  // ---------------------------------------------------------
  try {
    const infoUrl = `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`;
    const infoRes = await fetch(infoUrl);
    const info = await infoRes.json();

    if (!info || info.code !== 0) {
      return res.status(500).json({ error: "Failed to fetch Bilibili meta" });
    }

    const { title, desc, pic, owner, cid } = info.data;

    // ---------------------------------------------------------
    // 5️⃣ Build download links
    // ---------------------------------------------------------
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
    return res.status(500).json({
      error: "Failed to fetch final video info",
      details: err.toString()
    });
  }
}
