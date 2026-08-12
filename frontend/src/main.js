import { gsap } from "gsap";
import { Howl } from "howler";
import { io } from "socket.io-client";
import "./style.css";

import { getPlaylistTracks } from "./services/youtube";
import { YOUTUBE_CONFIG } from "./config/youtube";

import {
  initYouTubePlayer,
  loadYouTubeVideo,
  playYouTube,
  pauseYouTube,
  onYouTubeStateChange,
  stopYouTube,
  seekYouTube,
  getYouTubeCurrentTime,
  getYouTubeDuration,
  setYouTubeVolume
} from "./services/youtubePlayer";

/* =========================================================
   THEMES
========================================================= */

const themes = [
  {
    id: "morning",
    number: "01 / 03",
    name: "मिस्त्री की सुबह",
    time: "7:15 AM",
    status: "on the site",
    listeners: 312,
    image: "/images/mistri-morning.jpg",
    accent: "#e6b96a",
    playlistId: YOUTUBE_CONFIG.playlists.morning,

    sounds: [
      {
        label: "चाय ले लो",
        src: "/audio/morning/chai-lelo.mp3"
      },
      {
        label: "हथौड़ा",
        src: "/audio/morning/hammer.mp3"
      },
      {
        label: "मज़दूरों की आवाज़",
        src: "/audio/morning/worker-talk.mp3"
      }
    ],

    tracks: []
  },

  {
    id: "cement",
    number: "02 / 03",
    name: "सीमेंट मिलाना",
    time: "12:48 PM",
    status: "full power",
    listeners: 487,
    image: "/images/cement-mix.jpg",
    accent: "#f19a3e",
    playlistId: YOUTUBE_CONFIG.playlists.cement,

    sounds: [
      {
        label: "मिक्सर चालू",
        src: "/audio/cement/mixer.mp3"
      },
      {
        label: "ड्रिल",
        src: "/audio/cement/drill.mp3"
      },
      {
        label: "लोहे की आवाज़",
        src: "/audio/cement/metal.mp3"
      }
    ],

    tracks: []
  },

  {
    id: "chai",
    number: "03 / 03",
    name: "चाय का ब्रेक",
    time: "4:36 PM",
    status: "chai break",
    listeners: 421,
    image: "/images/chai-break.jpg",
    accent: "#e68b55",
    playlistId: YOUTUBE_CONFIG.playlists.chai,

    sounds: [
      {
        label: "चाय डालो",
        src: "/audio/chai/chai-dalo.mp3"
      },
      {
        label: "दूर का ट्रैफिक",
        src: "/audio/chai/traffic.mp3"
      },
      {
        label: "साइट की बातें",
        src: "/audio/chai/site-talk.mp3"
      }
    ],

    tracks: []
  }
];

/* =========================================================
   CONSTANTS
========================================================= */

const MAIN_MUSIC_VOLUME = 1;
const DUCKED_MUSIC_VOLUME = 0.25;
const SITE_SOUND_VOLUME = 1;

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL;

/* =========================================================
   APPLICATION STATE
========================================================= */

const state = {
  themeIndex: 0,
  trackIndex: 0,

  isPlaying: false,
  isDragging: false,
  isThemeChanging: false,
  isShuffleEnabled: false,

  masterVolume: 1,
  isMuted: false,

  activeUsers: 0,

  progressTimer: null,
  youtubeVolumeTween: null,

  activeSiteSound: null,
  siteSoundRequestId: 0,

  loadRequestId: 0,

  socket: null
};

/* =========================================================
   DOM CACHE
========================================================= */

const root = document.documentElement;

const elements = {
  bg: document.querySelector(".site-bg"),

  themeNumber:
    document.querySelector("#themeNumber"),

  themeLine:
    document.querySelector("#themeLine"),

  listenerCount:
    document.querySelector("#listenerCount"),

  statusText:
    document.querySelector("#statusText"),

  trackSource:
    document.querySelector("#trackSource"),

  trackTitle:
    document.querySelector("#trackTitle"),

  trackArtist:
    document.querySelector("#trackArtist"),

  coverInitial:
    document.querySelector("#coverInitial"),

  progress:
    document.querySelector("#progress"),

  currentTime:
    document.querySelector("#currentTime"),

  duration:
    document.querySelector("#duration"),

  soundTriggers:
    document.querySelector("#soundTriggers"),

  playerNote:
    document.querySelector("#playerNote"),

  shuffleButton:
    document.querySelector("#shuffle"),

  queueButton:
    document.querySelector("#queue"),

  back5:
    document.querySelector("#back5"),

  forward5:
    document.querySelector("#forward5"),

  volumeButton:
    document.querySelector("#volume"),

  nextButton:
    document.querySelector("#next"),

  previousButton:
    document.querySelector("#previous"),

  leftThemeButton:
    document.querySelector(".left-hint"),

  rightThemeButton:
    document.querySelector(".right-hint"),

  time:
    document.querySelector("#time"),

  youtubePlaylist:
    document.querySelector("#youtubePlaylist"),

  playPause:
    document.querySelector("#playPause")
};

/* =========================================================
   CURRENT THEME / TRACK
========================================================= */

function currentTheme() {
  return themes[state.themeIndex];
}

function currentTrack() {
  return (
    currentTheme().tracks[state.trackIndex] ||
    null
  );
}

/* =========================================================
   HELPERS
========================================================= */

function formatTime(seconds) {
  if (
    !Number.isFinite(seconds) ||
    seconds < 0
  ) {
    return "0:00";
  }

  const minutes =
    Math.floor(seconds / 60);

  const remainingSeconds =
    Math.floor(seconds % 60);

  return `${minutes}:${String(
    remainingSeconds
  ).padStart(2, "0")}`;
}

function clamp(
  value,
  min = 0,
  max = 1
) {
  return Math.min(
    Math.max(value, min),
    max
  );
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll(
      "'",
      "&#039;"
    );
}

/* =========================================================
   PLAY / PAUSE BUTTON UI
========================================================= */

function updatePlayPauseButton(
  isPlaying
) {
  const button =
    elements.playPause;

  if (!button) {
    return;
  }

  button.textContent =
    isPlaying
      ? "||"
      : "▶";

  button.setAttribute(
    "aria-label",
    isPlaying
      ? "Pause"
      : "Play"
  );

  button.setAttribute(
    "title",
    isPlaying
      ? "Pause"
      : "Play"
  );

  button.setAttribute(
    "aria-pressed",
    String(isPlaying)
  );

  button.classList.toggle(
    "is-playing",
    isPlaying
  );
}

/* =========================================================
   YOUTUBE MUSIC PLAYLIST
========================================================= */

function getYouTubeMusicPlaylistUrl() {
  const theme =
    currentTheme();

  if (!theme?.playlistId) {
    return "https://music.youtube.com/";
  }

  return `https://music.youtube.com/playlist?list=${encodeURIComponent(
    theme.playlistId
  )}`;
}

function updateYouTubePlaylistButton() {
  const button =
    elements.youtubePlaylist;

  if (!button) {
    return;
  }

  const playlistUrl =
    getYouTubeMusicPlaylistUrl();

  if (
    button instanceof
    HTMLAnchorElement
  ) {
    button.href =
      playlistUrl;

    button.target =
      "_blank";

    button.rel =
      "noopener noreferrer";
  }

  if (
    button instanceof
    HTMLButtonElement
  ) {
    button.onclick = () => {
      window.open(
        playlistUrl,
        "_blank",
        "noopener,noreferrer"
      );
    };
  }

  button.setAttribute(
    "aria-label",
    `Open ${currentTheme().name} playlist on YouTube Music`
  );

  button.setAttribute(
    "title",
    `Open ${currentTheme().name} playlist on YouTube Music`
  );
}

/* =========================================================
   VOLUME
========================================================= */

function getEffectiveMainVolume() {
  if (state.isMuted) {
    return 0;
  }

  return clamp(
    state.masterVolume
  );
}

function getEffectiveYouTubeVolume() {
  return (
    getEffectiveMainVolume() * 100
  );
}

function updateSiteSoundVolume() {
  if (!state.activeSiteSound) {
    return;
  }

  state.activeSiteSound.volume(
    SITE_SOUND_VOLUME *
      getEffectiveMainVolume()
  );
}

function fadeYouTubeVolume(
  targetVolume,
  fadeDuration = 250
) {
  if (!state.isPlaying) {
    return;
  }

  if (state.youtubeVolumeTween) {
    state.youtubeVolumeTween.kill();
    state.youtubeVolumeTween = null;
  }

  const volumeState = {
    value:
      getEffectiveYouTubeVolume()
  };

  state.youtubeVolumeTween =
    gsap.to(
      volumeState,
      {
        value: clamp(
          targetVolume,
          0,
          100
        ),

        duration:
          fadeDuration / 1000,

        ease: "power2.out",

        onUpdate: () => {
          setYouTubeVolume(
            volumeState.value
          );
        },

        onComplete: () => {
          state.youtubeVolumeTween =
            null;
        }
      }
    );
}

function duckMainMusic() {
  if (!state.isPlaying) {
    return;
  }

  fadeYouTubeVolume(
    DUCKED_MUSIC_VOLUME *
      getEffectiveYouTubeVolume(),
    220
  );
}

function restoreMainMusic() {
  if (!state.isPlaying) {
    return;
  }

  fadeYouTubeVolume(
    MAIN_MUSIC_VOLUME *
      getEffectiveYouTubeVolume(),
    300
  );
}

/* =========================================================
   SITE SOUND
========================================================= */

function stopSiteSound(
  restoreMusic = true
) {
  state.siteSoundRequestId++;

  if (state.activeSiteSound) {
    try {
      state.activeSiteSound.stop();
      state.activeSiteSound.unload();
    } catch (error) {
      console.warn(
        "Unable to stop site sound:",
        error
      );
    }

    state.activeSiteSound =
      null;
  }

  document
    .querySelectorAll(
      ".sound-btn.is-triggered"
    )
    .forEach((button) => {
      button.classList.remove(
        "is-triggered"
      );
    });

  if (restoreMusic) {
    restoreMainMusic();
  }
}

function playSiteSound(
  src,
  button = null
) {
  if (!src) {
    return;
  }

  stopSiteSound(false);

  const requestId =
    ++state.siteSoundRequestId;

  duckMainMusic();

  if (button) {
    button.classList.add(
      "is-triggered"
    );

    gsap.fromTo(
      button,
      {
        scale: 1
      },
      {
        scale: 0.94,
        duration: 0.08,
        yoyo: true,
        repeat: 1,
        ease: "power1.inOut"
      }
    );
  }

  const sound = new Howl({
    src: [src],

    volume:
      SITE_SOUND_VOLUME *
      getEffectiveMainVolume(),

    html5: true,

    onloaderror: (
      id,
      error
    ) => {
      console.error(
        "Site sound failed:",
        src,
        error
      );

      if (
        requestId ===
        state.siteSoundRequestId
      ) {
        if (button) {
          button.classList.remove(
            "is-triggered"
          );
        }

        restoreMainMusic();
      }
    },

    onplay: () => {
      console.log(
        "Playing site sound:",
        src
      );
    },

    onend: () => {
      if (
        requestId !==
        state.siteSoundRequestId
      ) {
        return;
      }

      state.activeSiteSound =
        null;

      if (button) {
        button.classList.remove(
          "is-triggered"
        );
      }

      restoreMainMusic();
    },

    onstop: () => {
      if (
        requestId !==
        state.siteSoundRequestId
      ) {
        return;
      }

      if (button) {
        button.classList.remove(
          "is-triggered"
        );
      }
    }
  });

  state.activeSiteSound =
    sound;

  sound.play();
}

/* =========================================================
   PROGRESS
========================================================= */

function stopProgressTimer() {
  if (state.progressTimer) {
    clearInterval(
      state.progressTimer
    );

    state.progressTimer = null;
  }
}

function updateProgress() {
  if (!state.isPlaying) {
    return;
  }

  const current =
    Number(
      getYouTubeCurrentTime()
    ) || 0;

  const total =
    Number(
      getYouTubeDuration()
    ) || 0;

  if (
    total > 0 &&
    elements.progress
  ) {
    elements.progress.value =
      (current / total) * 100;
  }

  if (elements.currentTime) {
    elements.currentTime.textContent =
      formatTime(current);
  }

  if (elements.duration) {
    elements.duration.textContent =
      formatTime(total);
  }
}

function startProgressTimer() {
  stopProgressTimer();

  state.progressTimer =
    setInterval(
      updateProgress,
      250
    );
}

/* =========================================================
   YOUTUBE PLAYER STATE
========================================================= */

function handleYouTubeState(
  playerState
) {
  const YTState =
    window.YT?.PlayerState;

  if (!YTState) {
    console.warn(
      "YouTube PlayerState is not available yet."
    );

    return;
  }

  switch (playerState) {
    case YTState.PLAYING:
      state.isPlaying = true;

      updatePlayPauseButton(
        true
      );

      startProgressTimer();

      updateQueue();

      setYouTubeVolume(
        getEffectiveYouTubeVolume()
      );

      if (elements.playerNote) {
        elements.playerNote.textContent =
          "YouTube";
      }

      console.log(
        "▶ YouTube playback started"
      );

      break;

    case YTState.PAUSED:
      state.isPlaying = false;

      updatePlayPauseButton(
        false
      );

      stopProgressTimer();

      console.log(
        "⏸ YouTube playback paused"
      );

      break;

    case YTState.ENDED:
      state.isPlaying = false;

      updatePlayPauseButton(
        false
      );

      stopProgressTimer();

      if (elements.progress) {
        elements.progress.value = 100;
      }

      console.log(
        "⏹ YouTube track ended"
      );

      nextTrack();

      break;

    case YTState.BUFFERING:
      if (elements.playerNote) {
        elements.playerNote.textContent =
          "Buffering...";
      }

      break;

    case YTState.CUED:
      state.isPlaying = false;

      updatePlayPauseButton(
        false
      );

      stopProgressTimer();

      if (elements.playerNote) {
        elements.playerNote.textContent =
          "YouTube";
      }

      break;

    default:
      break;
  }
}

/* =========================================================
   LOAD TRACK
========================================================= */

async function loadTrack(
  autoPlay = false
) {
  const track =
    currentTrack();

  stopSiteSound(false);
  stopProgressTimer();

  state.loadRequestId++;

  const requestId =
    state.loadRequestId;

  state.isPlaying = false;

  updatePlayPauseButton(
    false
  );

  if (elements.progress) {
    elements.progress.value = 0;
  }

  if (elements.currentTime) {
    elements.currentTime.textContent =
      "0:00";
  }

  if (elements.duration) {
    elements.duration.textContent =
      "—:——";
  }

  if (!track) {
    state.isPlaying = false;

    updatePlayPauseButton(
      false
    );

    if (elements.playerNote) {
      elements.playerNote.textContent =
        "No tracks available in this playlist.";
    }

    return;
  }

  if (elements.playerNote) {
    elements.playerNote.textContent =
      "YouTube";
  }

  try {
    await initYouTubePlayer();

    if (
      requestId !==
      state.loadRequestId
    ) {
      return;
    }

    await loadYouTubeVideo(
      track.id,
      autoPlay
    );

    if (
      requestId !==
      state.loadRequestId
    ) {
      return;
    }

    setYouTubeVolume(
      getEffectiveYouTubeVolume()
    );

  } catch (error) {
    console.error(
      "YouTube player initialization failed:",
      error
    );

    state.isPlaying = false;

    updatePlayPauseButton(
      false
    );

    if (elements.playerNote) {
      elements.playerNote.textContent =
        "YouTube player could not be loaded.";
    }
  }
}

/* =========================================================
   COVER ART
========================================================= */

/*
 * Get the actual YouTube video ID.
 */
function getTrackVideoId(track) {
  if (!track) {
    return null;
  }

  return (
    track.videoId ||
    track.id ||
    track.resourceId?.videoId ||
    track.contentDetails?.videoId ||
    null
  );
}


/*
 * Get cover artwork.
 *
 * The normalized youtube.js file should
 * already provide thumbnail + thumbnailFallback.
 *
 * We still generate the YouTube URLs here
 * as an additional safety fallback.
 */
function getTrackArtwork(track) {
  if (!track) {
    return {
      primary: null,
      fallback: null
    };
  }

  /*
   * Use normalized thumbnail first.
   */
  const primary =
    track.thumbnail ||
    track.thumbnailUrl ||
    track.image ||
    track.artwork ||
    track.thumbnails?.maxres?.url ||
    track.thumbnails?.high?.url ||
    track.thumbnails?.medium?.url ||
    track.thumbnails?.default?.url ||
    null;

  /*
   * Use normalized fallback if available.
   */
  const fallback =
    track.thumbnailFallback ||
    null;

  /*
   * If we still don't have artwork,
   * generate it from the video ID.
   */
  const videoId =
    getTrackVideoId(track);

  if (!primary && videoId) {
    const encodedVideoId =
      encodeURIComponent(videoId);

    return {
      primary:
        `https://i.ytimg.com/vi/${encodedVideoId}/maxresdefault.jpg`,

      fallback:
        `https://i.ytimg.com/vi/${encodedVideoId}/hqdefault.jpg`
    };
  }

  return {
    primary,
    fallback
  };
}


/*
 * Render the circular disc artwork.
 */
function renderCoverArt(
  track,
  theme
) {
  const container =
    elements.coverInitial;

  if (!container) {
    return;
  }

  /*
   * Clear previous artwork.
   */
  container.innerHTML = "";

  const artwork =
    getTrackArtwork(track);

  /*
   * No artwork available.
   */
  if (!artwork.primary) {
    container.textContent =
      theme?.name?.charAt(0) ||
      "M";

    return;
  }

  /*
   * Create image.
   */
  const image =
    document.createElement("img");

  image.alt =
    track?.title ||
    "Album artwork";

  image.loading =
    "eager";

  image.decoding =
    "async";

  /*
   * Prevent browser dragging the artwork.
   */
  image.draggable = false;

  Object.assign(
    image.style,
    {
      width: "100%",
      height: "100%",
      objectFit: "cover",
      borderRadius: "50%",
      display: "block",
      userSelect: "none",
      WebkitUserDrag: "none"
    }
  );

  /*
   * Keep track of fallback state.
   */
  let usingFallback = false;

  image.onerror = () => {
    /*
     * First failure:
     * try fallback artwork.
     */
    if (
      artwork.fallback &&
      !usingFallback
    ) {
      usingFallback = true;

      console.warn(
        "Max resolution artwork unavailable. Loading fallback artwork."
      );

      image.src =
        artwork.fallback;

      return;
    }

    /*
     * Everything failed.
     */
    console.warn(
      "Unable to load artwork for track:",
      track
    );

    image.remove();

    container.textContent =
      theme?.name?.charAt(0) ||
      "M";
  };

  /*
   * Set source only after onerror
   * has been registered.
   */
  image.src =
    artwork.primary;

  /*
   * Append to disc.
   */
  container.appendChild(
    image
  );
}

/* =========================================================
   SOUND BUTTONS
========================================================= */

function renderSoundButtons(
  theme
) {
  if (!elements.soundTriggers) {
    return;
  }

  elements.soundTriggers.innerHTML =
    theme.sounds
      .map(
        (sound, index) => `
          <button
            class="sound-btn"
            data-sound="${index}"
            type="button"
          >
            <span class="sound-icon">
              ◉
            </span>

            ${escapeHtml(
              sound.label
            )}
          </button>
        `
      )
      .join("");

  elements.soundTriggers
    .querySelectorAll(
      ".sound-btn"
    )
    .forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          const index =
            Number(
              button.dataset.sound
            );

          const sound =
            currentTheme().sounds[
              index
            ];

          if (!sound) {
            return;
          }

          playSiteSound(
            sound.src,
            button
          );
        }
      );
    });
}

/* =========================================================
   RENDER THEME
========================================================= */

function renderTheme() {
  const theme =
    currentTheme();

  const track =
    currentTrack();

  root.style.setProperty(
    "--accent",
    theme.accent
  );

  if (elements.bg) {
    elements.bg.style.backgroundImage =
      `url("${theme.image}")`;
  }

  if (elements.themeNumber) {
    elements.themeNumber.textContent =
      theme.number;
  }

  if (elements.themeLine) {
    elements.themeLine.textContent =
      `${theme.name} · ${theme.time}`;
  }

  if (elements.listenerCount) {
    elements.listenerCount.textContent =
      state.activeUsers ||
      theme.listeners;
  }

  if (elements.statusText) {
    elements.statusText.textContent =
      theme.status;
  }

  if (elements.trackSource) {
    elements.trackSource.textContent =
      `${theme.name.toUpperCase()} / ${String(
        state.trackIndex + 1
      ).padStart(2, "0")}`;
  }

  if (elements.trackTitle) {
    elements.trackTitle.textContent =
      track?.title ||
      "Loading tracks...";
  }

  if (elements.trackArtist) {
    elements.trackArtist.textContent =
      track?.artist ||
      "YouTube";
  }

  /*
   * IMPORTANT:
   * Render artwork from normalized track.
   */
  renderCoverArt(
    track,
    theme
  );

  renderSoundButtons(
    theme
  );

  updateYouTubePlaylistButton();

  updatePlayPauseButton(
    state.isPlaying
  );

  if (elements.progress) {
    elements.progress.value = 0;
  }

  if (elements.currentTime) {
    elements.currentTime.textContent =
      "0:00";
  }

  if (elements.duration) {
    elements.duration.textContent =
      "—:——";
  }

  updateQueue();
}

/* =========================================================
   CHANGE THEME
========================================================= */

function changeTheme(
  direction
) {
  if (
    state.isThemeChanging ||
    themes.length <= 1
  ) {
    return;
  }

  state.isThemeChanging =
    true;

  const wasPlaying =
    state.isPlaying;

  stopSiteSound(false);

  stopProgressTimer();

  try {
    stopYouTube();
  } catch (error) {
    console.warn(
      "Unable to stop YouTube:",
      error
    );
  }

  state.isPlaying = false;

  updatePlayPauseButton(
    false
  );

  state.themeIndex =
    (
      state.themeIndex +
      direction +
      themes.length
    ) %
    themes.length;

  state.trackIndex = 0;

  const theme =
    currentTheme();

  const incomingX =
    direction > 0
      ? 90
      : -90;

  const outgoingX =
    direction > 0
      ? -90
      : 90;

  const heroElements =
    document.querySelectorAll(
      ".hero-copy > *"
    );

  const timeline =
    gsap.timeline({
      onComplete: () => {
        state.isThemeChanging =
          false;
      }
    });

  timeline
    .to(
      ".site-bg",
      {
        xPercent:
          outgoingX / 10,
        scale: 1.07,
        filter: "blur(5px)",
        duration: 0.32,
        ease: "power2.in"
      }
    )
    .set(
      ".site-bg",
      {
        backgroundImage:
          `url("${theme.image}")`,
        xPercent:
          incomingX / 10
      }
    )
    .to(
      ".site-bg",
      {
        xPercent: 0,
        scale: 1.015,
        filter: "blur(0px)",
        duration: 0.65,
        ease: "power3.out"
      }
    )
    .to(
      heroElements,
      {
        x: outgoingX,
        opacity: 0,
        duration: 0.22,
        stagger: 0.025,
        ease: "power2.in"
      },
      0
    )
    .call(() => {
      renderTheme();
    })
    .set(
      heroElements,
      {
        x: incomingX,
        opacity: 0
      }
    )
    .to(
      heroElements,
      {
        x: 0,
        opacity: 1,
        duration: 0.48,
        stagger: 0.045,
        ease: "power3.out"
      },
      "-=0.12"
    );

  loadTrack(
    wasPlaying
  );
}

/* =========================================================
   PLAY / PAUSE
========================================================= */

async function setPlayState(
  nextState
) {
  try {
    await initYouTubePlayer();

    if (nextState) {
      console.log(
        "▶ Play button clicked"
      );

      await playYouTube();
    } else {
      console.log(
        "⏸ Pause button clicked"
      );

      pauseYouTube();
    }
  } catch (error) {
    console.error(
      "Unable to change YouTube play state:",
      error
    );

    state.isPlaying = false;

    updatePlayPauseButton(
      false
    );
  }
}

/* =========================================================
   NEXT TRACK
========================================================= */

function getRandomTrackIndex(
  totalTracks
) {
  if (totalTracks <= 1) {
    return 0;
  }

  let nextIndex;

  do {
    nextIndex =
      Math.floor(
        Math.random() *
          totalTracks
      );
  } while (
    nextIndex ===
    state.trackIndex
  );

  return nextIndex;
}

function nextTrack() {
  const tracks =
    currentTheme().tracks;

  const totalTracks =
    tracks.length;

  if (totalTracks === 0) {
    return;
  }

  if (state.isShuffleEnabled) {
    state.trackIndex =
      getRandomTrackIndex(
        totalTracks
      );
  } else {
    state.trackIndex =
      (
        state.trackIndex + 1
      ) %
      totalTracks;
  }

  const shouldPlay =
    state.isPlaying;

  renderTheme();

  loadTrack(
    shouldPlay
  );
}

/* =========================================================
   PREVIOUS TRACK
========================================================= */

function previousTrack() {
  const totalTracks =
    currentTheme()
      .tracks.length;

  if (totalTracks === 0) {
    return;
  }

  state.trackIndex =
    (
      state.trackIndex -
      1 +
      totalTracks
    ) %
    totalTracks;

  const shouldPlay =
    state.isPlaying;

  renderTheme();

  loadTrack(
    shouldPlay
  );
}

/* =========================================================
   SKIP
========================================================= */

function skip(seconds) {
  const current =
    Number(
      getYouTubeCurrentTime()
    ) || 0;

  const total =
    Number(
      getYouTubeDuration()
    ) || 0;

  if (total <= 0) {
    return;
  }

  const nextPosition =
    Math.max(
      0,
      Math.min(
        total,
        current + seconds
      )
    );

  seekYouTube(
    nextPosition
  );

  if (elements.progress) {
    elements.progress.value =
      (nextPosition / total) *
      100;
  }

  if (elements.currentTime) {
    elements.currentTime.textContent =
      formatTime(
        nextPosition
      );
  }
}

/* =========================================================
   SHUFFLE
========================================================= */

function toggleShuffle() {
  state.isShuffleEnabled =
    !state.isShuffleEnabled;

  if (elements.shuffleButton) {
    elements.shuffleButton.classList.toggle(
      "is-active",
      state.isShuffleEnabled
    );

    elements.shuffleButton.setAttribute(
      "aria-pressed",
      String(
        state.isShuffleEnabled
      )
    );

    gsap.fromTo(
      elements.shuffleButton,
      {
        scale: 0.88,
        rotate: -8
      },
      {
        scale: 1,
        rotate: 0,
        duration: 0.42,
        ease: "back.out(2)"
      }
    );
  }

  if (state.isShuffleEnabled) {
    shuffleCurrentThemeTracks();
  }

  updateQueue();
}

function shuffleCurrentThemeTracks() {
  const tracks =
    currentTheme().tracks;

  if (tracks.length <= 1) {
    return;
  }

  const current =
    tracks[state.trackIndex];

  const remaining =
    tracks.filter(
      (_, index) =>
        index !==
        state.trackIndex
    );

  for (
    let i =
      remaining.length - 1;
    i > 0;
    i--
  ) {
    const randomIndex =
      Math.floor(
        Math.random() *
          (i + 1)
      );

    [
      remaining[i],
      remaining[randomIndex]
    ] = [
      remaining[randomIndex],
      remaining[i]
    ];
  }

  currentTheme().tracks = [
    current,
    ...remaining
  ];

  state.trackIndex = 0;

  renderTheme();
}

/* =========================================================
   QUEUE
========================================================= */

function createQueueUI() {
  if (
    document.querySelector(
      "#queueOverlay"
    )
  ) {
    return;
  }

  const queueHTML = `
    <div
      id="queueOverlay"
      class="queue-overlay"
      aria-hidden="true"
    >
      <div
        id="queuePanel"
        class="queue-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Music queue"
      >
        <div class="queue-header">

          <div>
            <div
              class="queue-kicker"
              id="queueTheme"
            >
              मिस्त्री की सुबह · 7:15 AM | वैभव द्वारा बनाया गया
            </div>

            <h2>Queue</h2>

            <span id="queueCount">
              0 tracks
            </span>
          </div>

          <button
            id="queueClose"
            class="queue-close"
            type="button"
            aria-label="Close queue"
          >
            ×
          </button>

        </div>

        <div
          id="queueList"
          class="queue-list"
        ></div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML(
    "beforeend",
    queueHTML
  );
}

createQueueUI();

const queueElements = {
  overlay:
    document.querySelector(
      "#queueOverlay"
    ),

  panel:
    document.querySelector(
      "#queuePanel"
    ),

  close:
    document.querySelector(
      "#queueClose"
    ),

  list:
    document.querySelector(
      "#queueList"
    ),

  theme:
    document.querySelector(
      "#queueTheme"
    ),

  count:
    document.querySelector(
      "#queueCount"
    )
};

/* =========================================================
   UPDATE QUEUE
========================================================= */

function updateQueue() {
  const {
    list,
    theme,
    count
  } = queueElements;

  if (
    !list ||
    !theme ||
    !count
  ) {
    return;
  }

  const current =
    currentTheme();

  const tracks =
    current.tracks;

  theme.textContent =
    `${current.name} · ${current.time}`;

  count.textContent =
    `${tracks.length} ${
      tracks.length === 1
        ? "track"
        : "tracks"
    }`;

  if (tracks.length === 0) {
    list.innerHTML = `
      <div class="queue-empty">
        No tracks found in this playlist.
      </div>
    `;

    return;
  }

  list.innerHTML =
    tracks
      .map(
        (track, index) => {
          const isCurrent =
            index ===
            state.trackIndex;

          return `
            <button
              class="queue-item ${
                isCurrent
                  ? "is-current"
                  : ""
              }"
              data-track-index="${index}"
              type="button"
            >

              <span class="queue-number">
                ${String(
                  index + 1
                ).padStart(2, "0")}
              </span>

              <span class="queue-track-info">

                <span
                  class="queue-track-title"
                >
                  ${escapeHtml(
                    track.title
                  )}
                </span>

                <span
                  class="queue-track-artist"
                >
                  ${escapeHtml(
                    track.artist ||
                      "YouTube"
                  )}
                </span>

              </span>

              <span
                class="queue-play-indicator"
              >
                ${
                  isCurrent
                    ? "▶"
                    : "▷"
                }
              </span>

            </button>
          `;
        }
      )
      .join("");

  list
    .querySelectorAll(
      ".queue-item"
    )
    .forEach((item) => {
      item.addEventListener(
        "click",
        () => {
          const index =
            Number(
              item.dataset
                .trackIndex
            );

          playQueueTrack(
            index
          );
        }
      );
    });
}

/* =========================================================
   OPEN QUEUE
========================================================= */

function openQueue() {
  const {
    overlay,
    panel
  } = queueElements;

  if (
    !overlay ||
    !panel
  ) {
    return;
  }

  updateQueue();

  overlay.classList.add(
    "is-open"
  );

  overlay.setAttribute(
    "aria-hidden",
    "false"
  );

  gsap.fromTo(
    panel,
    {
      y: 35,
      opacity: 0,
      scale: 0.97
    },
    {
      y: 0,
      opacity: 1,
      scale: 1,
      duration: 0.38,
      ease: "power3.out"
    }
  );

  gsap.fromTo(
    ".queue-item",
    {
      y: 15,
      opacity: 0
    },
    {
      y: 0,
      opacity: 1,
      duration: 0.35,
      stagger: 0.035,
      ease: "power2.out"
    }
  );
}

/* =========================================================
   CLOSE QUEUE
========================================================= */

function closeQueue() {
  const {
    overlay
  } = queueElements;

  if (!overlay) {
    return;
  }

  overlay.classList.remove(
    "is-open"
  );

  overlay.setAttribute(
    "aria-hidden",
    "true"
  );
}

/* =========================================================
   PLAY QUEUE TRACK
========================================================= */

function playQueueTrack(
  index
) {
  const tracks =
    currentTheme().tracks;

  if (
    index < 0 ||
    index >= tracks.length
  ) {
    return;
  }

  state.trackIndex =
    index;

  closeQueue();

  renderTheme();

  loadTrack(true);

  gsap.fromTo(
    ".player",
    {
      scale: 0.97
    },
    {
      scale: 1,
      duration: 0.4,
      ease: "back.out(1.8)"
    }
  );
}

/* =========================================================
   VOLUME
========================================================= */

function toggleVolume() {
  state.isMuted =
    !state.isMuted;

  const targetVolume =
    getEffectiveYouTubeVolume();

  if (state.isPlaying) {
    fadeYouTubeVolume(
      targetVolume,
      180
    );
  } else {
    setYouTubeVolume(
      targetVolume
    );
  }

  updateSiteSoundVolume();

  if (elements.volumeButton) {
    elements.volumeButton.textContent =
      state.isMuted
        ? "🔇"
        : "🔊";

    elements.volumeButton.setAttribute(
      "aria-label",
      state.isMuted
        ? "Unmute"
        : "Mute"
    );
  }
}

/* =========================================================
   PLAYER EVENTS
========================================================= */

function setupPlayerEvents() {
  elements.playPause?.addEventListener(
    "click",
    async (event) => {
      event.preventDefault();
      event.stopPropagation();

      await setPlayState(
        !state.isPlaying
      );
    }
  );

  elements.nextButton?.addEventListener(
    "click",
    nextTrack
  );

  elements.previousButton?.addEventListener(
    "click",
    previousTrack
  );

  elements.forward5?.addEventListener(
    "click",
    () => skip(5)
  );

  elements.back5?.addEventListener(
    "click",
    () => skip(-5)
  );

  elements.volumeButton?.addEventListener(
    "click",
    toggleVolume
  );

  elements.shuffleButton?.addEventListener(
    "click",
    toggleShuffle
  );

  elements.queueButton?.addEventListener(
    "click",
    (event) => {
      event.stopPropagation();
      openQueue();
    }
  );

  elements.youtubePlaylist?.addEventListener(
    "click",
    () => {
      if (
        elements.youtubePlaylist instanceof
        HTMLButtonElement
      ) {
        window.open(
          getYouTubeMusicPlaylistUrl(),
          "_blank",
          "noopener,noreferrer"
        );
      }
    }
  );
}

/* =========================================================
   QUEUE EVENTS
========================================================= */

function setupQueueEvents() {
  queueElements.close?.addEventListener(
    "click",
    closeQueue
  );

  queueElements.overlay?.addEventListener(
    "click",
    (event) => {
      if (
        event.target ===
        queueElements.overlay
      ) {
        closeQueue();
      }
    }
  );
}

/* =========================================================
   KEYBOARD CONTROLS
========================================================= */

function setupKeyboardControls() {
  window.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key ===
          "Escape" &&
        queueElements.overlay?.classList.contains(
          "is-open"
        )
      ) {
        closeQueue();
        return;
      }

      const target =
        event.target;

      if (
        target instanceof
          HTMLElement &&
        (
          target.tagName ===
            "INPUT" ||
          target.tagName ===
            "TEXTAREA" ||
          target.isContentEditable
        )
      ) {
        return;
      }

      switch (event.key) {
        case "ArrowRight":
          changeTheme(1);
          break;

        case "ArrowLeft":
          changeTheme(-1);
          break;

        case " ":
        case "Spacebar":
          event.preventDefault();

          setPlayState(
            !state.isPlaying
          );

          break;

        case "ArrowUp":
          event.preventDefault();
          nextTrack();
          break;

        case "ArrowDown":
          event.preventDefault();
          previousTrack();
          break;

        default:
          break;
      }
    }
  );
}

/* =========================================================
   THEME NAVIGATION
========================================================= */

function setupThemeNavigation() {
  elements.leftThemeButton?.addEventListener(
    "click",
    (event) => {
      event.stopPropagation();
      changeTheme(-1);
    }
  );

  elements.rightThemeButton?.addEventListener(
    "click",
    (event) => {
      event.stopPropagation();
      changeTheme(1);
    }
  );
}

/* =========================================================
   PROGRESS SEEK
========================================================= */

function setupProgressSeek() {
  elements.progress?.addEventListener(
    "input",
    () => {
      const total =
        Number(
          getYouTubeDuration()
        ) || 0;

      if (total <= 0) {
        return;
      }

      const position =
        (
          Number(
            elements.progress.value
          ) /
          100
        ) *
        total;

      try {
        seekYouTube(
          position
        );
      } catch (error) {
        console.error(
          "Unable to seek:",
          error
        );
      }

      if (elements.currentTime) {
        elements.currentTime.textContent =
          formatTime(position);
      }
    }
  );
}

/* =========================================================
   SWIPE / DRAG
========================================================= */

function setupSwipeNavigation() {
  let startX = 0;
  let startY = 0;

  window.addEventListener(
    "pointerdown",
    (event) => {
      if (
        event.target.closest(
          "button, input, textarea, select, a"
        )
      ) {
        return;
      }

      state.isDragging =
        true;

      startX =
        event.clientX;

      startY =
        event.clientY;
    },
    {
      passive: true
    }
  );

  window.addEventListener(
    "pointerup",
    (event) => {
      if (
        !state.isDragging
      ) {
        return;
      }

      state.isDragging =
        false;

      const deltaX =
        event.clientX -
        startX;

      const deltaY =
        event.clientY -
        startY;

      if (
        Math.abs(deltaX) >
          70 &&
        Math.abs(deltaX) >
          Math.abs(deltaY)
      ) {
        changeTheme(
          deltaX < 0
            ? 1
            : -1
        );
      }
    },
    {
      passive: true
    }
  );
}

/* =========================================================
   DESKTOP PARALLAX
========================================================= */

function setupParallax() {
  if (
    window.matchMedia(
      "(pointer: coarse)"
    ).matches
  ) {
    return;
  }

  window.addEventListener(
    "pointermove",
    (event) => {
      if (
        window.innerWidth <
        800
      ) {
        return;
      }

      const mouseX =
        (
          event.clientX /
            window.innerWidth -
          0.5
        ) * 2;

      const mouseY =
        (
          event.clientY /
            window.innerHeight -
          0.5
        ) * 2;

      gsap.to(
        ".site-bg",
        {
          x:
            mouseX * -8,

          y:
            mouseY * -5,

          duration: 1.2,

          ease: "power3.out",

          overwrite: true
        }
      );
    },
    {
      passive: true
    }
  );
}

/* =========================================================
   CLOCK
========================================================= */

function updateClock() {
  if (!elements.time) {
    return;
  }

  const now =
    new Date();

  elements.time.textContent =
    now
      .toLocaleTimeString(
        [],
        {
          hour: "numeric",
          minute: "2-digit"
        }
      )
      .toLowerCase();
}

function setupClock() {
  updateClock();

  setInterval(
    updateClock,
    30000
  );
}

/* =========================================================
   LOAD ALL PLAYLISTS
========================================================= */

async function loadAllPlaylists() {
  if (elements.playerNote) {
    elements.playerNote.textContent =
      "Loading Mistri playlists...";
  }

  await Promise.all(
    themes.map(
      async (theme) => {
        try {
          const tracks =
            await getPlaylistTracks(
              theme.playlistId
            );

          theme.tracks =
            Array.isArray(tracks)
              ? tracks
              : [];

          console.log(
            `🎵 ${theme.name}: ${theme.tracks.length} tracks`
          );

          /*
           * Debug artwork information.
           */
          if (
            theme.tracks.length > 0
          ) {
            console.log(
              "🎨 First track artwork:",
              {
                title:
                  theme.tracks[0].title,

                videoId:
                  theme.tracks[0].videoId,

                thumbnail:
                  theme.tracks[0].thumbnail,

                fallback:
                  theme.tracks[0]
                    .thumbnailFallback
              }
            );
          }

        } catch (error) {
          console.error(
            `❌ ${theme.name} playlist failed:`,
            error
          );

          theme.tracks = [];
        }
      }
    )
  );

  console.log(
    "🎵 All YouTube playlists loaded."
  );

  if (elements.playerNote) {
    elements.playerNote.textContent =
      "YouTube";
  }
}

/* =========================================================
   REAL-TIME PRESENCE
========================================================= */

function setupPresence() {
  if (!SOCKET_URL) {
    console.warn(
      "VITE_SOCKET_URL is not configured."
    );

    return;
  }

  try {
    state.socket =
      io(
        SOCKET_URL,
        {
          transports: [
            "websocket",
            "polling"
          ]
        }
      );

    state.socket.on(
      "connect",
      () => {
        console.log(
          "Connected to Mistri Presence Server:",
          state.socket.id
        );
      }
    );

    state.socket.on(
      "presence:update",
      (count) => {
        state.activeUsers =
          Number(count) || 0;

        if (
          !elements.listenerCount
        ) {
          return;
        }

        gsap.fromTo(
          elements.listenerCount,
          {
            opacity: 0.4,
            y: -3
          },
          {
            opacity: 1,
            y: 0,
            duration: 0.35,
            ease: "power2.out"
          }
        );

        elements.listenerCount.textContent =
          state.activeUsers;
      }
    );

    state.socket.on(
      "connect_error",
      (error) => {
        console.warn(
          "Presence server unavailable:",
          error.message
        );
      }
    );

    state.socket.on(
      "disconnect",
      () => {
        console.log(
          "Disconnected from Mistri Presence Server."
        );
      }
    );
  } catch (error) {
    console.warn(
      "Unable to initialize presence server:",
      error
    );
  }
}

/* =========================================================
   CLEANUP
========================================================= */

function cleanup() {
  stopProgressTimer();

  stopSiteSound(false);

  if (state.youtubeVolumeTween) {
    state.youtubeVolumeTween.kill();

    state.youtubeVolumeTween =
      null;
  }

  try {
    stopYouTube();
  } catch (error) {
    console.warn(
      "YouTube cleanup failed:",
      error
    );
  }

  if (state.socket) {
    state.socket.disconnect();
    state.socket = null;
  }
}

window.addEventListener(
  "beforeunload",
  cleanup
);

/* =========================================================
   APPLICATION INITIALIZATION
========================================================= */

async function initialize() {
  try {
    setupPlayerEvents();

    setupQueueEvents();

    setupKeyboardControls();

    setupThemeNavigation();

    setupProgressSeek();

    setupSwipeNavigation();

    setupParallax();

    setupClock();

    setupPresence();

    /*
     * Register YouTube state listener
     * BEFORE loading the player.
     */
    onYouTubeStateChange(
      handleYouTubeState
    );

    /*
     * Load all playlist tracks first.
     */
    await loadAllPlaylists();

    /*
     * Render the first theme and queue.
     */
    renderTheme();

    /*
     * Initialize YouTube player.
     */
    await initYouTubePlayer();

    /*
     * Load first track without autoplay.
     */
    await loadTrack(false);

    /*
     * Make sure button starts in Play state.
     */
    state.isPlaying = false;

    updatePlayPauseButton(
      false
    );

    console.log(
      "🚧 Mistri initialized successfully."
    );
  } catch (error) {
    console.error(
      "❌ Mistri initialization failed:",
      error
    );

    state.isPlaying = false;

    updatePlayPauseButton(
      false
    );

    if (elements.playerNote) {
      elements.playerNote.textContent =
        "Unable to initialize Mistri.";
    }
  }
}

/* =========================================================
   START
========================================================= */

initialize();