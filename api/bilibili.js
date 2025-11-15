export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: "Missing URL" });
  }

  let bvid = null;

  // Extract BV if present
  const bvMatch = url.match(/BV[0-9A-Za-z]+/);
  if (bvMatch) {
    bvid = bvMatch[0];
  }

  // If bilibili.tv -> extract numeric ID
  const tvMatch = url.match(/video\/(\d{6,20})/);

  if (!bvid && tvMatch) {
    const videoId = tvMatch[1];

    // Free Bilibili API
    const api = `https://www.bilibili.tv/intl/gateway/web/v2/app/video/info?video_id=${videoId}`;

    try {
      const r = await fetch(api);
      const j = await r.json();

      if (j?.data?.bvid) {
        bvid = j.data.bvid;
      } else {
        return res.status(400).json({ error: "Could not extract BV from bilibili.tv" });
      }

    } catch (err) {
      return res.status(500).json({ error: "Failed to convert bilibili.tv ID" });
    }
  }

  if (!bvid) {
    return res.status(400).json({ error: "Invalid Bilibili URL" });
  }

  // Fetch Bili info
  try {
    const infoUrl = `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`;
    const r = await fetch(infoUrl);
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
    return res.status(500).json({ error: "Failed to fetch Bili info" });
  }
}
