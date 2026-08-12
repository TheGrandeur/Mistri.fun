const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL;

/* =========================================================
   YOUTUBE HELPERS
========================================================= */

function getVideoId(track) {
  if (!track) {
    return null;
  }

  /*
   * Direct video ID
   */
  if (
    typeof track.videoId === "string" &&
    track.videoId.trim()
  ) {
    return track.videoId.trim();
  }

  /*
   * Normalized backend format
   */
  if (
    typeof track.id === "string" &&
    track.id.trim()
  ) {
    return track.id.trim();
  }

  /*
   * Some APIs return:
   *
   * id: {
   *   videoId: "..."
   * }
   */
  if (
    typeof track.id?.videoId === "string" &&
    track.id.videoId.trim()
  ) {
    return track.id.videoId.trim();
  }

  /*
   * YouTube playlistItems format:
   *
   * snippet.resourceId.videoId
   */
  if (
    typeof track.snippet?.resourceId?.videoId ===
      "string" &&
    track.snippet.resourceId.videoId.trim()
  ) {
    return track.snippet.resourceId.videoId.trim();
  }

  /*
   * Another common YouTube API format:
   *
   * contentDetails.videoId
   */
  if (
    typeof track.contentDetails?.videoId ===
      "string" &&
    track.contentDetails.videoId.trim()
  ) {
    return track.contentDetails.videoId.trim();
  }

  /*
   * Some APIs expose resourceId directly.
   */
  if (
    typeof track.resourceId?.videoId ===
      "string" &&
    track.resourceId.videoId.trim()
  ) {
    return track.resourceId.videoId.trim();
  }

  return null;
}

/* =========================================================
   THUMBNAIL HELPERS
========================================================= */

function getThumbnail(track) {
  if (!track) {
    return null;
  }

  /*
   * First try explicit backend thumbnail.
   */
  if (
    typeof track.thumbnail === "string" &&
    track.thumbnail.trim()
  ) {
    return track.thumbnail.trim();
  }

  if (
    typeof track.thumbnailUrl === "string" &&
    track.thumbnailUrl.trim()
  ) {
    return track.thumbnailUrl.trim();
  }

  if (
    typeof track.image === "string" &&
    track.image.trim()
  ) {
    return track.image.trim();
  }

  if (
    typeof track.artwork === "string" &&
    track.artwork.trim()
  ) {
    return track.artwork.trim();
  }

  /*
   * YouTube API thumbnails.
   */
  const youtubeThumbnails = [
    track.thumbnails?.maxres?.url,
    track.thumbnails?.standard?.url,
    track.thumbnails?.high?.url,
    track.thumbnails?.medium?.url,
    track.thumbnails?.default?.url,

    /*
     * YouTube playlistItems may store thumbnails
     * inside snippet.
     */
    track.snippet?.thumbnails?.maxres?.url,
    track.snippet?.thumbnails?.standard?.url,
    track.snippet?.thumbnails?.high?.url,
    track.snippet?.thumbnails?.medium?.url,
    track.snippet?.thumbnails?.default?.url
  ];

  const existingThumbnail =
    youtubeThumbnails.find(
      (url) =>
        typeof url === "string" &&
        url.trim()
    );

  if (existingThumbnail) {
    return existingThumbnail;
  }

  /*
   * Generate thumbnail directly from YouTube
   * video ID.
   */
  const videoId =
    getVideoId(track);

  if (videoId) {
    return `https://i.ytimg.com/vi/${encodeURIComponent(
      videoId
    )}/hqdefault.jpg`;
  }

  return null;
}

/* =========================================================
   THUMBNAIL FALLBACKS
========================================================= */

function getThumbnailFallbacks(
  track
) {
  const videoId =
    getVideoId(track);

  if (!videoId) {
    return [];
  }

  const encodedId =
    encodeURIComponent(videoId);

  return [
    `https://i.ytimg.com/vi/${encodedId}/maxresdefault.jpg`,
    `https://i.ytimg.com/vi/${encodedId}/hqdefault.jpg`,
    `https://i.ytimg.com/vi/${encodedId}/mqdefault.jpg`,
    `https://img.youtube.com/vi/${encodedId}/hqdefault.jpg`,
    `https://img.youtube.com/vi/${encodedId}/0.jpg`
  ];
}

/* =========================================================
   NORMALIZE TRACK
========================================================= */

function normalizeTrack(track) {
  const videoId =
    getVideoId(track);

  const thumbnail =
    getThumbnail(track);

  const title =
    track.title ||
    track.name ||
    track.snippet?.title ||
    "Unknown Track";

  const artist =
    track.artist ||
    track.channelTitle ||
    track.author ||
    track.snippet?.channelTitle ||
    "YouTube";

  const normalized = {
    ...track,

    /*
     * IMPORTANT:
     * Always use the actual YouTube video ID.
     */
    id:
      videoId ||
      track.id,

    videoId,

    title,

    artist,

    thumbnail,

    thumbnailFallbacks:
      getThumbnailFallbacks(track)
  };

  console.log(
    "🎵 Normalized track:",
    {
      id: normalized.id,
      videoId: normalized.videoId,
      title: normalized.title,
      thumbnail: normalized.thumbnail,
      fallbacks:
        normalized.thumbnailFallbacks
    }
  );

  return normalized;
}

/* =========================================================
   GET PLAYLIST TRACKS
========================================================= */

export async function getPlaylistTracks(
  playlistId
) {
  if (!playlistId) {
    throw new Error(
      "Playlist ID is required."
    );
  }

  if (!API_BASE_URL) {
    throw new Error(
      "VITE_API_BASE_URL is not configured."
    );
  }

  const tracks = [];

  let pageToken = null;

  do {
    const params =
      new URLSearchParams({
        maxResults: "50"
      });

    if (pageToken) {
      params.set(
        "pageToken",
        pageToken
      );
    }

    const url =
      `${API_BASE_URL}/api/youtube/playlist/${encodeURIComponent(
        playlistId
      )}?${params.toString()}`;

    console.log(
      "🎵 Fetching playlist:",
      url
    );

    const response =
      await fetch(url);

    let data = null;

    try {
      data =
        await response.json();
    } catch {
      throw new Error(
        `Invalid JSON response from Mistri API: ${response.status}`
      );
    }

    if (!response.ok) {
      throw new Error(
        data?.error ||
          `Mistri API error: ${response.status}`
      );
    }

    if (
      Array.isArray(
        data.tracks
      )
    ) {
      const normalizedTracks =
        data.tracks.map(
          normalizeTrack
        );

      tracks.push(
        ...normalizedTracks
      );
    }

    pageToken =
      data.nextPageToken ||
      null;
  } while (pageToken);

  console.log(
    `🎨 Loaded ${tracks.length} tracks with artwork`
  );

  /*
   * Very useful debugging information.
   */
  console.table(
    tracks.map(
      (track) => ({
        title: track.title,
        videoId: track.videoId,
        thumbnail: track.thumbnail
      })
    )
  );

  return tracks;
}