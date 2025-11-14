export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) return res.status(400).json({ error: "Missing URL" });

  const crawlbaseToken = "s15AoDB0-2Mmb50HO1IlWQ";

  let bvid = null;

  // Catch BV URLs
  const bvMatch = url.match(/BV[0-9A-Za-z]+/);
  if (bvMatch) bvid = bvMatch[0];

  // Extract bilibili.tv ID
  const tvMatch = url.match(/video\/(\d+)/);

  if (!bvid && tvMatch) {
    const tvId = tvMatch[1];

    // WORKING intl API endpoint
    const apiUrl = `https://www.bilibili.tv/intl/gateway/v2/app/video/detail?video_id=${tvId}`;

    const crawlUrl =
      `https://api.crawlbase.com/?token=${crawlbaseToken}&url=${encodeURIComponent(apiUrl)}`;

    try {
      const resp = await fetch(crawlUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Linux; Android 10)",
          "Referer": "https://www.bilibili.tv/",
          "X-Bili-Accept-Language": "en-US",
          "X-Bili-Device-ID": "1234567890abcdef"
        }
      });

      const data = await resp.json();

      if (data?.data?.video_base?.bvid) {
        bvid = data.data.video_base.bvid;
      } else {
        return res.status(400).json({ error: "Could not convert bilibili.tv ID" });
      }
    } catch (err) {
      return res.status(500).json({ error: "Proxy conversion failed", details: err.toString() });
    }
  }

  if (!bvid) {
    return res.status(400).json({ error: "Invalid Bilibili URL" });
  }

  // NOW FETCH VIDEO DETAILS
  try {
    const infoUrl = `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`;

    const crawlInfo =
      `https://api.crawlbase.com/?token=${crawlbaseToken}&url=${encodeURIComponent(infoUrl)}`;

    const infoRes = await fetch(crawlInfo);
    const info = await infoRes.json();

    if (!info || info.code !== 0)
      return res.status(500).json({ error: "Failed to fetch video info" });

    const { title, desc, pic, owner, cid } = info.data;

    return res.json({
      title,
      description: desc,
      thumbnail: pic,
      owner: owner?.name,
      bvid,
      play_urls: [
        { quality: "HD", url: `https://api.bilibili.com/x/player/playurl?bvid=${bvid}&cid=${cid}&qn=80` },
        { quality: "SD", url: `https://api.bilibili.com/x/player/playurl?bvid=${bvid}&cid=${cid}&qn=64` },
        { quality: "LOW", url: `https://api.bilibili.com/x/player/playurl?bvid=${bvid}&cid=${cid}&qn=32` }
      ]
    });

  } catch (e) {
    return res.status(500).json({ error: "Failed to get video" });
  }
}
