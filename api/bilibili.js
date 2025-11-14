export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: "Missing URL" });
  }

  let bvid = null;

  // 1️⃣ Extract BV from bilibili.com links
  const bvMatch = url.match(/BV[0-9A-Za-z]+/);
  if (bvMatch) {
    bvid = bvMatch[0];
  }

  // 2️⃣ Convert bilibili.tv → BV using new working API
  const tvMatch = url.match(/video\/(\d{10,20})/);
  if (!bvid && tvMatch) {
    const tvId = tvMatch[1];

    try {
      const api = `https://api.bilibili.com/pgc/view/web/season?ep_id=${tvId}`;
      const response = await fetch(api);
      const data = await response.json();

      if (data?.result?.episodes?.[0]?.bvid) {
        bvid = data.result.episodes[0].bvid;
      }
    } catch (err) {
      return res.status(500).json({ error: "Failed to convert bilibili.tv ID" });
    }
  }

  // Still no BV? invalid URL
  if (!bvid) {
    return res.status(400).json({ error: "Invalid Bilibili URL" });
  }

  // 3️⃣ Fetch video details
  try {
    const infoUrl = `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`;
    const infoRes = await fetch(infoUrl);
    const info = await infoRes.json();

    if (!info || info.code !== 0) {
      return res.status(500).json({ error: "Failed to fetch video info" });
    }

    const { title, desc, pic, owner, cid } = info.data;

    // 4️⃣ Generate download URLs
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
