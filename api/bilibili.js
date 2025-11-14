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

  // --------------------------------
  // 2️⃣ HANDLE bilibili.tv LINKS
  // --------------------------------
  const tvMatch = url.match(/video\/(\d{10,20})/);
  if (!bvid && tvMatch) {
    const tvId = tvMatch[1];

    // Convert bilibili.tv ID → BV via intl API
    try {
      const api = `https://www.bilibili.tv/intl/gateway/v2/video/intro?video_id=${tvId}`;
      const response = await fetch(api);
      const data = await response.json();

      if (data?.data?.bvid) {
        bvid = data.data.bvid;
      }
    } catch (e) {
      return res.status(500).json({ error: "Failed to convert bilibili.tv ID" });
    }
  }

  // If STILL no BV, it's invalid
  if (!bvid) {
    return res.status(400).json({ error: "Invalid Bilibili URL" });
  }

  // --------------------------------
  // 3️⃣ GET VIDEO META INFO
  // --------------------------------
  try {
    const videoInfoUrl = `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`;
    const infoRes = await fetch(videoInfoUrl);
    const info = await infoRes.json();

    if (!info || info.code !== 0) {
      return res.status(500).json({ error: "Failed to fetch video info" });
    }

    const { title, desc, pic, owner, cid } = info.data;

    // --------------------------------
    // 4️⃣ BUILD DOWNLOAD LINKS
    // --------------------------------
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
