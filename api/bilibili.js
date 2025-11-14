export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: "Missing URL" });
  }

  let bvid = null;

  // 1️⃣ BV ID from bilibili.com
  const bvMatch = url.match(/BV[0-9A-Za-z]+/);
  if (bvMatch) {
    bvid = bvMatch[0];
  }

  // 2️⃣ bilibili.tv numeric video ID
  const tvMatch = url.match(/video\/(\d{10,20})/);

  if (!bvid && tvMatch) {
    const tvId = tvMatch[1];

    // 🔥 FETCH PAGE USING CRAWLBASE (NORMAL TOKEN)
    const crawlURL = `https://api.crawlbase.com/?token=s15AoDB0-2Mmb50HO1IlWQ&url=${encodeURIComponent(url)}`;

    try {
      const crawlRes = await fetch(crawlURL);
      const html = await crawlRes.text();

      // 🔥 EXTRACT BV ID FROM HTML
      const bvFromHtml = html.match(/"bvid":"(BV[0-9A-Za-z]+)"/);

      if (bvFromHtml) {
        bvid = bvFromHtml[1];
      } else {
        return res.status(400).json({ error: "Failed to extract BV ID from bilibili.tv page" });
      }

    } catch (error) {
      return res.status(500).json({ error: "Proxy conversion failed", details: error.message });
    }
  }

  // Still no BV?
  if (!bvid) {
    return res.status(400).json({ error: "Invalid Bilibili URL" });
  }

  // 3️⃣ Get regular bilibili info
  try {
    const videoInfoUrl = `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`;
    const infoRes = await fetch(videoInfoUrl);
    const info = await infoRes.json();

    if (!info || info.code !== 0) {
      return res.status(500).json({ error: "Failed to fetch video info" });
    }

    const { title, desc, pic, owner, cid } = info.data;

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
