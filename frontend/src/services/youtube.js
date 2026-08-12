const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL;

/* =========================================================
   YOUTUBE HELPERS
========================================================= */

/*
 * Get the actual YouTube video ID from a track.
 *
 * Supported formats:
 *
 * {
 *   id: "VIDEO_ID"
 * }
 *
 * {
 *   videoId: "VIDEO_ID"
 * }
 *
 * {
 *   id: {
 *     videoId: "VIDEO_ID"
 *   }
 * }
 *
 * {
 *   resourceId: {
 *     videoId: "VIDEO_ID"
 *   }
 * }
 */
function getVideoId(track) {
  if (!track) {
    return null;
  }

  if (
    typeof track.videoId === "string" &&
    track.videoId.trim()
  ) {
    return track.videoId.trim();
  }

  if (
    typeof track.id === "string" &&
    track.id.trim()
  ) {
    return track.id.trim();
  }

  if (
    typeof track.id?.videoId === "string" &&
    track.id.videoId.trim()
  ) {
    return track.id.videoId.trim();
  }

  if (
    typeof track.resourceId?.videoId ===
      "string" &&
    track.resourceId.videoId.trim()
  ) {
    return track.resourceId.videoId.trim();
  }

  if (
    typeof track.contentDetails?.videoId ===
      "string" &&
    track.contentDetails.videoId.trim()
  ) {
    return track.contentDetails.videoId.trim();
  }

  return null;
}


/* =========================================================
   THUMBNAIL HELPERS
========================================================= */

/*
 * Generate YouTube thumbnail URLs directly
 * from the video ID.
 *
 * maxresdefault:
 *   Highest quality when available.
 *
 * hqdefault:
 *   Reliable fallback.
 */
function getYouTubeThumbnailUrls(
  videoId
) {
  if (!videoId) {
    return {
      primary: null,
      fallback: null
    };
  }

  const encodedVideoId =
    encodeURIComponent(videoId);

  return {
    primary:
      `https://i.ytimg.com/vi/${encodedVideoId}/maxresdefault.jpg`,

    fallback:
      `https://i.ytimg.com/vi/${encodedVideoId}/hqdefault.jpg`
  };
}


/*
 * Get an existing thumbnail from the backend/API.
 */
function getExistingThumbnail(
  track
) {
  if (!track) {
    return null;
  }

  /*
   * Direct thumbnail properties.
   */
  const directThumbnail =
    [
      track.thumbnail,
      track.thumbnailUrl,
      track.image,
      track.artwork
    ].find(
      (value) =>
        typeof value === "string" &&
        value.trim()
    );

  if (directThumbnail) {
    return directThumbnail;
  }

  /*
   * YouTube thumbnail objects.
   */
  const youtubeThumbnail =
    [
      track.thumbnails?.maxres?.url,
      track.thumbnails?.high?.url,
      track.thumbnails?.medium?.url,
      track.thumbnails?.default?.url
    ].find(
      (value) =>
        typeof value === "string" &&
        value.trim()
    );

  if (youtubeThumbnail) {
    return youtubeThumbnail;
  }

  return null;
}


/*
 * Get complete artwork information.
 *
 * Returns:
 *
 * {
 *   primary: "...",
 *   fallback: "..."
 * }
 */
function getThumbnailInfo(
  track
) {
  /*
   * First use artwork supplied by
   * the backend.
   */
  const existing =
    getExistingThumbnail(track);

  if (existing) {
    return {
      primary: existing,
      fallback: null
    };
  }

  /*
   * Otherwise generate artwork directly
   * from the YouTube video ID.
   */
  const videoId =
    getVideoId(track);

  return getYouTubeThumbnailUrls(
    videoId
  );
}


/*
 * Public/simple thumbnail getter.
 */
function getThumbnail(track) {
  const thumbnailInfo =
    getThumbnailInfo(track);

  return (
    thumbnailInfo.primary ||
    thumbnailInfo.fallback ||
    null
  );
}


/* =========================================================
   NORMALIZE TRACK
========================================================= */

function normalizeTrack(track) {
  const videoId =
    getVideoId(track);

  const thumbnailInfo =
    getThumbnailInfo(track);

  return {
    ...track,

    /*
     * Keep the actual YouTube video ID.
     */
    id:
      videoId ||
      track?.id ||
      null,

    /*
     * Also expose it explicitly.
     */
    videoId,

    /*
     * Normalize title.
     */
    title:
      track?.title ||
      track?.name ||
      "Unknown Track",

    /*
     * Normalize artist.
     */
    artist:
      track?.artist ||
      track?.channelTitle ||
      track?.author ||
      "YouTube",

    /*
     * Primary artwork.
     */
    thumbnail:
      thumbnailInfo.primary,

    /*
     * Backup artwork.
     */
    thumbnailFallback:
      thumbnailInfo.fallback
  };
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

    const response =
      await fetch(
        `${API_BASE_URL}/api/youtube/playlist/${encodeURIComponent(
          playlistId
        )}?${params.toString()}`
      );

    let data = null;

    try {
      data =
        await response.json();
    } catch (error) {
      throw new Error(
        "Invalid response received from Mistri YouTube API."
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
        data?.tracks
      )
    ) {
      const normalizedTracks =
        data.tracks
          .map(normalizeTrack)
          .filter(
            (track) =>
              Boolean(track.id)
          );

      tracks.push(
        ...normalizedTracks
      );
    }

    pageToken =
      data?.nextPageToken ||
      null;

  } while (pageToken);

  console.log(
    `🎵 Loaded ${tracks.length} tracks`
  );

  console.log(
    "🎨 Track artwork normalized"
  );

  return tracks;
}