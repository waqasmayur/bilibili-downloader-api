export default async function handler(req, res) {
  try {
    const url = req.query.url;

    if (!url) {
      return res.status(400).json({ error: "No URL provided" });
    }

    let bvid = null;

    // 1️⃣ Extract BV from bilibili.com
    if (url.includes("bilibili.com")) {
      const match = url.match(/BV[0-9A-Za-z]+/);
      if (match) bvid = match[0];
    }

    // 2️⃣ Convert bilibili.tv → BV
    if (url.includes("bilibili.tv")) {
      const tvIdMatch = url.match(/video\/(\d+)/);
      if (tvIdMatch) {
        const tvId = tvIdMatch[1];

        // Convert numeric ID → BV by calling Bilibili API
        const convertRes = await fetch(
          `https://api.bilibili.com/x/web-interface/view?aid=${tvId}`
        ).then(r => r.json());

        if (convertRes.data && convertRes.data.bvid) {
          bvid = convertRes.data.bvid;
        } else {
          return res.status(400).json({ error: "Failed to convert bilibili.tv ID" });
        }
      }
    }

    if (!bvid) {
      return res.status(400).json({ error: "Invalid Bilibili URL" });
    }

    // 3️⃣ Fetch full BV video info
    const info = await fetch(
      `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`
    ).then(r => r.json());

    if (!info.data) {
      return res.status(400).json({ error: "Video not found" });
    }

    const title = info.data.title;
    const thumbnail = info.data.pic;
    const owner = info.data.owner?.name;
    const cid = info.data.cid;

    // 4️⃣ Generate play URLs for multiple qualities
    const qualities = [
      { qn: 80, quality: "HD" },
      { qn: 64, quality: "SD" },
      { qn: 32, quality: "LOW" }
    ];

    const play_urls = qualities.map(q => ({
      quality: q.quality,
      url: `https://api.bilibili.com/x/player/playurl?bvid=${bvid}&cid=${cid}&qn=${q.qn}`
    }));

    // 5️⃣ Return response
    return res.status(200).json({
      title,
      thumbnail,
      owner,
      bvid,
      play_urls
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server Error" });
  }
}
