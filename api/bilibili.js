export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: "Missing URL" });
  }

  let bvid = null;

  // Extract BV directly if in URL
  const bvMatch = url.match(/BV[0-9A-Za-z]+/);
  if (bvMatch) bvid = bvMatch[0];

  // Extract numeric bilibili.tv ID
  const idMatch = url.match(/video\/(\d{6,20})/);

  if (!bvid && idMatch) {
    const videoId = idMatch[1];
    const apiURL = `https://www.bilibili.tv/intl/gateway/web/v2/app/video/info?video_id=${videoId}`;

    try {
      const response = await fetch(apiURL, {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Referer": "https://www.bilibili.tv/"
        }
      });

      const data = await response.json();

      if (data?.data?.bvid) {
        bvid = data.data.bvid;
      } else {
        return res.status(400).json({
          error: "bilibili.tv API returned no BV ID",
          raw: data
        });
      }

    } catch (err) {
      return res.status(500).json({
        error: "Failed to convert bilibili.tv ID",
        message: err.message
      });
    }
  }

  if (!bvid) {
    return res.status(400).json({ error: "Invalid Bilibili URL" });
  }

  // Fetch main Bilibili video info
  try {
    const infoURL = `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`;
    const r = await fetch(infoURL);
    const info = await r.json();

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
    return res.status(500).json({
      error: "Failed to fetch Bilibili info",
      message: err.message
    });
  }
}
