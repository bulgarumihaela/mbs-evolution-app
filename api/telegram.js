const CATEGORY_HASHTAGS = {
  "#podcasturi": "podcasturi",
  "#practici": "practici",
  "#intrebari": "intrebari",
  "#live": "live",
};

function extractHashtags(text = "") {
  return [...text.matchAll(/#[\p{L}\p{N}_-]+/gu)].map((match) =>
    match[0].toLowerCase()
  );
}

function getCategory(hashtags) {
  for (const hashtag of hashtags) {
    if (CATEGORY_HASHTAGS[hashtag]) {
      return CATEGORY_HASHTAGS[hashtag];
    }
  }

  return null;
}

function getThemeHashtags(hashtags) {
  return hashtags.filter((tag) => !CATEGORY_HASHTAGS[tag]);
}

function getContentType(post) {
  if (post.audio) return "audio";
  if (post.voice) return "audio";
  if (post.video) return "video";
  if (post.video_note) return "video";
  if (post.photo) return "photo";
  if (post.document) return "document";

  return "text";
}

export default async function handler(req, res) {
  // Telegram trimite update-urile prin POST
  if (req.method !== "POST") {
    return res.status(200).json({
      ok: true,
      service: "MBS Telegram Webhook",
    });
  }

  try {
    const update = req.body;

    // Pentru postări noi în canale
    const post = update.channel_post || update.edited_channel_post;

    if (!post) {
      return res.status(200).json({
        ok: true,
        ignored: true,
        reason: "Not a channel post",
      });
    }

    const text = post.caption || post.text || "";

    const hashtags = extractHashtags(text);
    const category = getCategory(hashtags);
    const themes = getThemeHashtags(hashtags);
    const contentType = getContentType(post);

    const channel = {
      id: post.chat?.id || null,
      title: post.chat?.title || "",
      username: post.chat?.username || "",
    };

    const telegramLink =
      channel.username && post.message_id
        ? `https://t.me/${channel.username}/${post.message_id}`
        : null;

    const item = {
      message_id: post.message_id,
      date: post.date,
      channel_id: channel.id,
      channel_title: channel.title,
      channel_username: channel.username,

      category,
      content_type: contentType,

      hashtags,
      themes,

      text,

      telegram_link: telegramLink,
    };

    console.log("MBS TELEGRAM CONTENT:", JSON.stringify(item));

    /*
      IMPORTANT:

      Deocamdată doar RECEPȚIONĂM și CLASIFICĂM postarea.

      Exemplu:

      #podcasturi #emotii #anxietate

      devine:

      category: "podcasturi"

      themes:
      [
        "#emotii",
        "#anxietate"
      ]

      În pasul următor conectăm acest obiect la
      biblioteca MBS App.
    */

    return res.status(200).json({
      ok: true,
      received: true,
      item,
    });
  } catch (error) {
    console.error("Telegram webhook error:", error);

    return res.status(500).json({
      ok: false,
      error: "Internal server error",
    });
  }
}
