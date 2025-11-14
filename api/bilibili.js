export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: "Missing URL" });
  }

  let bvid = null;

  // 1) Extract BV from bilibili.com
  const bvMatch = url.match(/BV[0-9A-Za-z]+/);
  if (bvMatch) bvid = bvMatch[0];

  // 2) Extract video_id from bilibili.tv
  const tvMatch = url.match(/video\/(\d{10,20})/);
  if (!bvid && tvMatch) {
    const tvId = tvMatch[1];
    try {
      const api = `https://www.bilibili.tv/intl/gateway/v2/video/intro?video_id=${tvId}`;
      const r = await fetch(api);
      const j = await r.json();
      if (j?.data?.bvid) bvid = j.data.bvid;
    } catch {
      return res.status(500).json({ error: "bilibili.tv conversion failed" });
    }
  }

  if (!bvid) {
    return res.status(400).json({ error: "Invalid Bilibili URL" });
  }

  // 3) Fetch Video Info from bilibili.tv API (WORKS on Vercel)
  try {
    const infoURL = `https://www.bilibili.tv/intl/gateway/v2/video/intro?bvid=${bvid}`;
    const resInfo = await fetch(infoURL);
    const info = await resInfo.json();

    if (!info?.data) {
      return res.status(500).json({ error: "Failed to fetch video info" });
    }

    const data = info.data;
    const { title, desc, cover, cid } = data;

    // 4) Build download URLs using bilibili.tv API
    const play_urls = [
      {
        quality: "Full HD",
        url: `https://www.bilibili.tv/intl/gateway/v2/video/playurl?bvid=${bvid}&cid=${cid}&qn=120`
      },
      {
        quality: "HD",
        url: `https://www.bilibili.tv/intl/gateway/v2/video/playurl?bvid=${bvid}&cid=${cid}&qn=80`
      },
      {
        quality: "SD",
        url: `https://www.bilibili.tv/intl/gateway/v2/video/playurl?bvid=${bvid}&cid=${cid}&qn=64`
      }
    ];

    return res.json({
      title,
      thumbnail: cover,
      description: desc,
      bvid,
      cid,
      play_urls
    });

  } catch (e) {
    return res.status(500).json({ error: "Video info fetch failed" });
  }
}
