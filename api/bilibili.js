export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) return res.status(400).json({ error: "Missing URL" });

  let bvid = null;

  // 1️⃣ Try to extract BV from URL directly
  const directBV = url.match(/BV[0-9A-Za-z]{10}/);
  if (directBV) {
    bvid = directBV[0];
  }

  // 2️⃣ Handle bilibili.tv (numeric ID)
  if (!bvid && url.includes("bilibili.tv")) {
    const crawlURL =
      `https://api.crawlbase.com/?token=s15AoDB0-2Mmb50HO1IlWQ&url=` +
      encodeURIComponent(url);

    try {
      const crawlRes = await fetch(crawlURL);
      const html = await crawlRes.text();

      // New pattern: bilibili.tv serializes JSON with "bvid":"BVxxxx"
      const bvFromJson = html.match(/"bvid"\s*:\s*"(?<bv>BV[0-9A-Za-z]{10})"/);

      if (bvFromJson?.groups?.bv) {
        bvid = bvFromJson.groups.bv;
      } else {
        // fallback: bilibili.tv embeds another API JSON inside html
        const fallback = html.match(/BV[0-9A-Za-z]{10}/);
        if (fallback) bvid = fallback[0];
      }

      if (!bvid)
        return res.status(400).json({
          error: "Could not extract BV ID from bilibili.tv page"
        });

    } catch (e) {
      return res.status(500).json({
        error: "Proxy conversion failed",
        details: e.message
      });
    }
  }

  // Still nothing?
  if (!bvid)
    return res.status(400).json({ error: "Invalid Bilibili URL" });

  // 3️⃣ Get video info
  try {
    const infoRes = await fetch(
      `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`
    );
    const info = await infoRes.json();

    if (!info || info.code !== 0)
      return res.status(500).json({ error: "Failed to fetch video info" });

    const { title, desc, pic, owner, cid } = info.data;

    const play_urls = [
      {
        quality: "HD",
        url: `https://api.bilibili.com/x/player/playurl?bvid=${bvid}&cid=${cid}&qn=80`
      },
      {
        quality: "SD",
        url: `https://api.bilibili.com/x/player/playurl?bvid=${bvid}&cid=${cid}&qn=64`
      },
      {
        quality: "LOW",
        url: `https://api.bilibili.com/x/player/playurl?bvid=${bvid}&cid=${cid}&qn=32`
      }
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
