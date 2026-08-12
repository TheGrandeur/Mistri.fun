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
   * Most likely format:
   * {
   *   id: "VIDEO_ID",
   *   title: "...",
   *   artist: "..."
   * }
   */

  if (typeof track.id === "string") {
    return track.id;
  }

  if (typeof track.videoId === "string") {
    return track.videoId;
  }

  if (
    typeof track.id?.videoId === "string"
  ) {
    return track.id.videoId;
  }

  return null;
}

function getThumbnail(track) {
  if (!track) {
    return null;
  }

  /*
   * Use an existing thumbnail if the backend
   * already provides one.
   */

  if (
    typeof track.thumbnail === "string" &&
    track.thumbnail
  ) {
    return track.thumbnail;
  }

  if (
    typeof track.thumbnailUrl === "string" &&
    track.thumbnailUrl
  ) {
    return track.thumbnailUrl;
  }

  if (
    typeof track.image === "string" &&
    track.image
  ) {
    return track.image;
  }

  if (
    typeof track.artwork === "string" &&
    track.artwork
  ) {
    return track.artwork;
  }

  /*
   * Handle YouTube API thumbnail objects.
   */

  if (
    track.thumbnails?.high?.url
  ) {
    return track.thumbnails.high.url;
  }

  if (
    track.thumbnails?.medium?.url
  ) {
    return track.thumbnails.medium.url;
  }

  if (
    track.thumbnails?.default?.url
  ) {
    return track.thumbnails.default.url;
  }

  /*
   * If the backend didn't send a thumbnail,
   * generate the standard YouTube thumbnail
   * directly from the video ID.
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

function normalizeTrack(track) {
  const videoId =
    getVideoId(track);

  return {
    ...track,

    /*
     * Keep the original YouTube video ID
     * available to the player.
     */
    id:
      videoId ||
      track.id,

    /*
     * Normalize title.
     */
    title:
      track.title ||
      track.name ||
      "Unknown Track",

    /*
     * Normalize artist.
     */
    artist:
      track.artist ||
      track.channelTitle ||
      track.author ||
      "YouTube",

    /*
     * Always expose the artwork using
     * the property expected by main.js.
     */
    thumbnail:
      getThumbnail(track)
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
        )}?${params}`
      );

    const data =
      await response.json();

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

  return tracks;
}