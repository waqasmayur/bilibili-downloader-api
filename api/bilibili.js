export default async function handler(req, res) {
  try {
    const rawUrl = req.query.url;
    if (!rawUrl) return res.status(400).json({ error: "No Bilibili URL provided" });

    let url = rawUrl.trim();

    // ----------- Convert bilibili.tv → BV ID for bilibili.com -----------
    if (url.includes("bilibili.tv")) {
      const match = url.match(/video\/(\d+)/);
      if (match) {
        url = `https://www.bilibili.com/video/BV${match[1]}`;
      }
    }

    // ----------- Extract BV ID -----------
    const bvMatch = url.match(/(BV[0-9A-Za-z]+)/);
    if (!bvMatch) return res.status(400).json({ error: "Invalid Bilibili URL" });

    const bvid = bvMatch[1];

    // ----------- Call Bilibili Official API -----------
    const apiURL = `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`;

    const biliRes = await fetch(apiURL, {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    const biliData = await biliRes.json();

    if (biliData.code !== 0) {
      return res.status(500).json({ error: "Failed to fetch video info" });
    }

    const videoInfo = biliData.data;

    // ----------- Fetch Play URLs (DASH) -----------
    const playUrlAPI = `https://api.bilibili.com/x/player/playurl?bvid=${bvid}&cid=${videoInfo.cid}&qn=120&fourk=1`;

    const playRes = await fetch(playUrlAPI, {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    const playData = await playRes.json();

    if (playData.code !== 0) {
      return res.status(500).json({ error: "Failed to fetch formats" });
    }

    const formats = [];

    // DASH Video
    if (playData.data.dash && playData.data.dash.video) {
      playData.data.dash.video.forEach(v => {
        formats.push({
          type: "video",
          quality: v.quality,
          codecs: v.codecs,
          width: v.width,
          height: v.height,
          url: v.baseUrl
        });
      });
    }

    // DASH Audio
    if (playData.data.dash && playData.data.dash.audio) {
      playData.data.dash.audio.forEach(a => {
        formats.push({
          type: "audio",
          quality: a.quality,
          codecs: a.codecs,
          url: a.baseUrl
        });
      });
    }

    // FLV fallback
    if (playData.data.durl) {
      playData.data.durl.forEach(f => {
        formats.push({
          type: "flv",
          size: f.size,
          url: f.url
        });
      });
    }

    res.status(200).json({
      title: videoInfo.title,
      thumbnail: videoInfo.pic,
      duration: videoInfo.duration,
      formats
    });

  } catch (e) {
    res.status(500).json({ error: "Server error", details: e.toString() });
  }
}

