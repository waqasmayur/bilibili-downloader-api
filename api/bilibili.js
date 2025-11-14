export const config = {
  runtime: "edge",
};

export default async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get("url");

    if (!url) {
      return new Response(JSON.stringify({ error: "No Bilibili URL provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Validate URL
    if (!url.includes("bilibili.com") && !url.includes("bilibili.tv")) {
      return new Response(JSON.stringify({ error: "Invalid Bilibili URL" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Extract BV ID
    const bvMatch = url.match(/BV([A-Za-z0-9]+)/);
    if (!bvMatch) {
      return new Response(JSON.stringify({ error: "Could not extract BV ID" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const bvId = bvMatch[0];

    // Fetch video info from Bilibili API (public)
    const apiURL = `https://api.bilibili.com/x/web-interface/view?bvid=${bvId}`;
    const response = await fetch(apiURL);
    const json = await response.json();

    if (json.code !== 0) {
      return new Response(JSON.stringify({ error: "Failed to fetch video info" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const data = json.data;

    // Format response
    return new Response(
      JSON.stringify({
        title: data.title,
        thumbnail: data.pic,
        description: data.desc,
        owner: data.owner.name,
        bvid: data.bvid,

        // Instead of real download links (blocked by Bilibili),
        // we generate playable URLs using public API
        play_urls: [
          {
            quality: "HD",
            url: `https://api.bilibili.com/x/player/playurl?bvid=${data.bvid}&cid=${data.cid}&qn=80`
          },
          {
            quality: "SD",
            url: `https://api.bilibili.com/x/player/playurl?bvid=${data.bvid}&cid=${data.cid}&qn=64`
          },
          {
            quality: "LOW",
            url: `https://api.bilibili.com/x/player/playurl?bvid=${data.bvid}&cid=${data.cid}&qn=32`
          }
        ]
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: "Server Error", details: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
