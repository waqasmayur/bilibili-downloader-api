export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: "Missing URL" });
  }

  let bvid = null;

  const crawlbaseToken = "s15AoDB0-2Mmb50HO1IlWQ"; // ← your token

  // STEP 1 — Extract BV from .com
  const bvMatch = url.match(/BV[0-9A-Za-z]+/);
  if (bvMatch) bvid = bvMatch[0];

  // STEP 2 — Handle bilibili.tv → convert video_id → BV
  const tvMatch = url.match(/video\/(\d+)/);
  if (!bvid && tvMatch) {
    const tvId = tvMatch[1];

    try {
      const apiUrl =
        `https://www.bilibili.tv/intl/gateway/v2/video/intro?video_id=${tvId}`;

      const crawlUrl =
        `https://api.crawlbase.com/?token=${crawlbaseToken}&url=${encodeURIComponent(apiUrl)}`;

      const resp = await fetch(crawlUrl);
      const data = await resp.json();

      if (data?.data?.bvid) {
        bvid = data.data.bvid;
      } else {
        return res.status(400).json({ error: "Could not convert bilibili.tv ID" });
      }
    } catch (err) {
      return res.status(500).json({ error: "Proxy conversion failed" });
    }
  }

  // INVALID URL
  if (!bvid) {
    return res.status(400).json({ error: "Invalid Bilibili URL" });
  }

  // STEP 3 — Fetch video info (via Crawlbase to bypass restrictions)
  try {
    const infoUrl =
      `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`;

    const crawlInfo =
      `https://api.crawlbase.com/?token=${crawlbaseToken}&url=${encodeURIComponent(infoUrl)}`;

    const infoRes = await fetch(crawlInfo);
    const info = await infoRes.json();

    if (!info || info.code !== 0) {
      return res.status(500).json({ error: "Failed to fetch video info" });
    }

    const { title, desc, pic, owner, cid } = info.data;

    // STEP 4 — Build download links
    const play_urls = [
      { quality: "HD", url: `https://api.bilibili.com/x/player/playurl?bvid=${bvid}&cid=${cid}&qn=80` },
      { quality: "SD", url: `https://api.bilibili.com/x/player/playurl?bvid=${bvid}&cid=${cid}&qn=64` },
      { quality: "LOW", url: `https://api.bilibili.com/x/player/playurl?bvid=${bvid}&cid=${cid}&qn=32` }
    ];

    return res.json({
      title,
      thumbnail: pic,
      description: desc,
      bvid,
      owner: owner?.name,
      play_urls
    });

  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch video info" });
  }
}
