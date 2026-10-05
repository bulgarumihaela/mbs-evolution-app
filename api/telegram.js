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

function getContentType(post) {
  if (post.audio) return "audio";
  if (post.voice) return "voice";
  if (post.video) return "video";
  if (post.video_note) return "video";
  if (post.photo) return "photo";
  if (post.document) return "document";

  return "post";
}

function getTelegramFileId(post) {
  if (post.audio?.file_id) return post.audio.file_id;
  if (post.voice?.file_id) return post.voice.file_id;
  if (post.video?.file_id) return post.video.file_id;
  if (post.video_note?.file_id) return post.video_note.file_id;
  if (post.document?.file_id) return post.document.file_id;

  if (Array.isArray(post.photo) && post.photo.length) {
    return post.photo[post.photo.length - 1].file_id;
  }

  return null;
}

function getTitle(text = "") {
  const firstLine = text
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("#"));

  return firstLine || "Postare Telegram";
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).json({
      ok: true,
      service: "MBS Telegram Webhook",
    });
  }

  try {
    const update = req.body;

    const post =
      update.channel_post ||
      update.edited_channel_post;

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
    const contentType = getContentType(post);
    const telegramFileId = getTelegramFileId(post);

    const row = {
      telegram_message_id: post.message_id,

      telegram_chat_id: String(
        post.chat?.id || ""
      ),

      telegram_chat_title:
        post.chat?.title || "",

      telegram_chat_username:
        post.chat?.username || null,

      title: getTitle(text),

      text: text,

      content_type: contentType,

      hashtags: hashtags,

      telegram_file_id: telegramFileId,

      telegram_date: post.date
        ? new Date(
            post.date * 1000
          ).toISOString()
        : new Date().toISOString(),

      is_published: true,
    };

    console.log(
      "MBS TELEGRAM CONTENT:",
      JSON.stringify({
        ...row,
        category,
      })
    );

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    // CHEIA SECRETĂ SERVER-SIDE
    const supabaseKey =
      process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error(
        "Supabase environment variables are missing"
      );
    }

    const response = await fetch(
      `${supabaseUrl}/rest/v1/telegram_content?on_conflict=telegram_chat_id,telegram_message_id`,
      {
        method: "POST",

        headers: {
          apikey: supabaseKey,

          Authorization:
            `Bearer ${supabaseKey}`,

          "Content-Type":
            "application/json",

          Prefer:
            "resolution=merge-duplicates,return=representation",
        },

        body: JSON.stringify(row),
      }
    );

    const resultText =
      await response.text();

    if (!response.ok) {
      console.error(
        "SUPABASE ERROR:",
        resultText
      );

      return res.status(500).json({
        ok: false,
        error:
          "Could not save Telegram content",
        details: resultText,
      });
    }

    console.log(
      "MBS SAVED TO SUPABASE:",
      resultText
    );

    return res.status(200).json({
      ok: true,
      received: true,
      saved: true,
    });

  } catch (error) {
    console.error(
      "Telegram webhook error:",
      error
    );

    return res.status(500).json({
      ok: false,
      error:
        error.message ||
        "Internal server error",
    });
  }
}
