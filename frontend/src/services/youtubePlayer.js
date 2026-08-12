/* ==================================================
   YOUTUBE PLAYER SERVICE
================================================== */

let player = null;

let isAPIReady = false;

let pendingVideoId = null;

let readyPromise = null;
let stateChangeCallback = null;


/* ==================================================
   LOAD YOUTUBE IFRAME API
================================================== */

function loadYouTubeAPI() {

  if (window.YT && window.YT.Player) {

    isAPIReady = true;

    return Promise.resolve();

  }


  if (readyPromise) {
    return readyPromise;
  }


  readyPromise =
    new Promise((resolve, reject) => {

      const existingScript =
        document.querySelector(
          'script[src="https://www.youtube.com/iframe_api"]'
        );


      /*
       * YouTube calls this global function
       * when the API has finished loading.
       */

      const previousCallback =
        window.onYouTubeIframeAPIReady;


      window.onYouTubeIframeAPIReady =
        () => {

          if (typeof previousCallback === "function") {
            previousCallback();
          }

          isAPIReady = true;

          resolve();

        };


      /*
       * Avoid adding the script twice.
       */

      if (existingScript) {
        return;
      }


      const script =
        document.createElement("script");


      script.src =
        "https://www.youtube.com/iframe_api";


      script.async = true;


      script.onerror =
        () => {

          readyPromise = null;

          reject(
            new Error(
              "Failed to load YouTube IFrame API."
            )
          );

        };


      document.head.appendChild(
        script
      );

    });


  return readyPromise;

}


/* ==================================================
   CREATE PLAYER
================================================== */

async function createPlayer() {

  await loadYouTubeAPI();


  if (player) {
    return player;
  }


  /*
   * Create a hidden YouTube container.
   *
   * We don't use YouTube's visual UI.
   * Your Mistri UI controls the player.
   */

  let container =
    document.querySelector(
      "#youtubePlayer"
    );


  if (!container) {

    container =
      document.createElement(
        "div"
      );

    container.id =
      "youtubePlayer";

    container.style.position =
      "fixed";

    container.style.width =
      "1px";

    container.style.height =
      "1px";

    container.style.left =
      "-9999px";

    container.style.top =
      "-9999px";

    container.style.pointerEvents =
      "none";

    document.body.appendChild(
      container
    );

  }


  return new Promise(
    (resolve, reject) => {

      player =
        new window.YT.Player(
          "youtubePlayer",
          {

            width: "1",

            height: "1",

            videoId:
              pendingVideoId || "",


            playerVars: {

              autoplay: 0,

              controls: 0,

              disablekb: 1,

              fs: 0,

              modestbranding: 1,

              playsinline: 1,

              rel: 0

            },


            events: {

  onReady: () => {

    console.log(
      "🎵 YouTube player ready"
    );

    resolve(player);

  },

  onStateChange: (event) => {

    if (
      typeof stateChangeCallback ===
      "function"
    ) {

      stateChangeCallback(
        event.data
      );

    }

  },

  onError: (event) => {

    console.error(
      "❌ YouTube player error:",
      event.data
    );

    reject(
      new Error(
        `YouTube player error: ${event.data}`
      )
    );

  }

}

          }
        );

    }
  );

}


/* ==================================================
   INITIALIZE
================================================== */

export async function initYouTubePlayer() {

  await createPlayer();

  return player;

}


/* ==================================================
   LOAD VIDEO
================================================== */

export async function loadYouTubeVideo(
  videoId,
  autoplay = false
) {

  if (!videoId) {

    throw new Error(
      "YouTube video ID is required."
    );

  }


  pendingVideoId =
    videoId;


  const youtubePlayer =
    await createPlayer();


  if (autoplay) {

    youtubePlayer.loadVideoById(
      videoId
    );

  } else {

    youtubePlayer.cueVideoById(
      videoId
    );

  }

}


/* ==================================================
   PLAY
================================================== */

export async function playYouTube() {

  const youtubePlayer =
    await createPlayer();


  youtubePlayer.playVideo();

}


/* ==================================================
   PAUSE
================================================== */

export async function pauseYouTube() {

  if (!player) {
    return;
  }


  player.pauseVideo();

}


/* ==================================================
   STOP
================================================== */

export async function stopYouTube() {

  if (!player) {
    return;
  }


  player.stopVideo();

}


/* ==================================================
   SEEK
================================================== */

export function seekYouTube(
  seconds
) {

  if (!player) {
    return;
  }


  player.seekTo(
    seconds,
    true
  );

}


/* ==================================================
   CURRENT TIME
================================================== */

export function getYouTubeCurrentTime() {

  if (!player) {
    return 0;
  }


  return (
    player.getCurrentTime() || 0
  );

}


/* ==================================================
   DURATION
================================================== */

export function getYouTubeDuration() {

  if (!player) {
    return 0;
  }


  return (
    player.getDuration() || 0
  );

}


/* ==================================================
   PLAYER STATE
================================================== */

export function getYouTubeState() {

  if (!player) {
    return -1;
  }


  return player.getPlayerState();

}


/* ==================================================
   VOLUME
================================================== */

export function setYouTubeVolume(
  volume
) {

  if (!player) {
    return;
  }


  const safeVolume =
    Math.max(
      0,
      Math.min(
        100,
        volume
      )
    );


  player.setVolume(
    safeVolume
  );

}


/* ==================================================
   MUTE
================================================== */

export function muteYouTube() {

  if (!player) {
    return;
  }


  player.mute();

}


/* ==================================================
   UNMUTE
================================================== */

export function unmuteYouTube() {

  if (!player) {
    return;
  }


  player.unMute();

}

/* ==================================================
   STATE CHANGE LISTENER
================================================== */

export function onYouTubeStateChange(
  callback
) {

  stateChangeCallback =
    typeof callback === "function"
      ? callback
      : null;

}


/* ==================================================
   DESTROY
================================================== */

export function destroyYouTubePlayer() {

  if (!player) {
    return;
  }


  try {

    player.destroy();

  } catch (error) {

    console.warn(
      "Unable to destroy YouTube player:",
      error
    );

  }


  player = null;

  isAPIReady = false;

  pendingVideoId = null;

  readyPromise = null;

}