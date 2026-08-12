const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL;


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

      tracks.push(
        ...data.tracks
      );

    }


    pageToken =
      data.nextPageToken ||
      null;


  } while (pageToken);


  return tracks;

}