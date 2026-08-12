import express from "express";

const router = express.Router();

const YOUTUBE_API_URL =
  "https://www.googleapis.com/youtube/v3/playlistItems";


router.get(
  "/playlist/:playlistId",
  async (req, res) => {

    try {

      const { playlistId } =
        req.params;

      const {
        pageToken = "",
        maxResults = "50"
      } = req.query;


      /*
      --------------------------------------------------
      VALIDATE PLAYLIST ID
      --------------------------------------------------
      */

      if (!playlistId) {

        return res.status(400).json({
          error:
            "Playlist ID is required."
        });

      }


      /*
      --------------------------------------------------
      VALIDATE YOUTUBE API KEY
      --------------------------------------------------
      */

      const apiKey =
        process.env.YOUTUBE_API_KEY;


      if (!apiKey) {

        console.error(
          "YOUTUBE_API_KEY is not configured."
        );

        return res.status(500).json({
          error:
            "YouTube API key is not configured."
        });

      }


      /*
      --------------------------------------------------
      BUILD REQUEST
      --------------------------------------------------
      */

      const safeMaxResults =
        Math.min(
          Math.max(
            Number(maxResults) || 50,
            1
          ),
          50
        );


      const params =
        new URLSearchParams({

          part:
            "snippet,contentDetails",

          playlistId,

          maxResults:
            safeMaxResults.toString(),

          key:
            apiKey

        });


      if (pageToken) {

        params.set(
          "pageToken",
          pageToken
        );

      }


      /*
      --------------------------------------------------
      YOUTUBE API REQUEST
      --------------------------------------------------
      */

      const response =
        await fetch(
          `${YOUTUBE_API_URL}?${params}`
        );


      const data =
        await response.json();


      /*
      --------------------------------------------------
      HANDLE YOUTUBE API ERROR
      --------------------------------------------------
      */

      if (!response.ok) {

        console.error(
          "YouTube API error:",
          data
        );


        return res.status(
          response.status
        ).json({

          error:
            data?.error?.message ||
            "YouTube API request failed."

        });

      }


      /*
      --------------------------------------------------
      FORMAT TRACKS
      --------------------------------------------------
      */

      const tracks =
        (data.items || [])

          .filter(
            (item) =>
              item.snippet?.title !==
              "Private video"
          )

          .filter(
            (item) =>
              item.contentDetails?.videoId
          )

          .map(
            (item) => ({

              id:
                item.contentDetails.videoId,

              title:
                item.snippet?.title ||
                "Unknown Track",

              artist:
                item.snippet
                  ?.videoOwnerChannelTitle ||
                item.snippet
                  ?.channelTitle ||
                "YouTube",

              thumbnail:
                item.snippet
                  ?.thumbnails?.high?.url ||

                item.snippet
                  ?.thumbnails?.medium?.url ||

                item.snippet
                  ?.thumbnails?.default?.url ||

                null,

              description:
                item.snippet?.description ||
                "",

              publishedAt:
                item.snippet?.publishedAt ||
                null

            })
          );


      /*
      --------------------------------------------------
      RESPONSE
      --------------------------------------------------
      */

      return res.json({

        tracks,

        nextPageToken:
          data.nextPageToken ||
          null,

        totalResults:
          data.pageInfo?.totalResults ||
          tracks.length

      });

    } catch (error) {

      console.error(
        "YouTube route failed:",
        error
      );


      return res.status(500).json({

        error:
          "Unable to fetch YouTube playlist."

      });

    }

  }
);


export default router;