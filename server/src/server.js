import express from "express";
import http from "http";
import cors from "cors";
import dotenv from "dotenv";
import { Server } from "socket.io";
import { createClient } from "redis";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import youtubeRouter from "./routes/youtube.js";

dotenv.config();

const app = express();

app.disable("x-powered-by");

app.use(
  helmet()
);

app.use(
  express.json({
    limit: "10kb"
  })
);

/*
--------------------------------------------------
CORS
--------------------------------------------------
*/

const allowedOrigins = [
  process.env.FRONTEND_URL
].filter(Boolean);


app.use(
  cors({

    origin: (origin, callback) => {

      // Allow server-to-server requests
      // and local tools without Origin.
      if (!origin) {
        return callback(null, true);
      }


      if (
        allowedOrigins.includes(origin)
      ) {

        return callback(
          null,
          true
        );

      }


      return callback(
        new Error(
          "CORS policy violation."
        )
      );

    },

    methods: [
      "GET",
      "POST",
      "OPTIONS"
    ],

    credentials: true

  })
);

const youtubeLimiter =
  rateLimit({

    windowMs:
      60 * 1000,

    max: 60,

    standardHeaders: true,

    legacyHeaders: false,

    message: {
      error:
        "Too many API requests. Please try again later."
    }

  });


app.use(
  "/api/youtube",
  youtubeLimiter,
  youtubeRouter
);

/*
--------------------------------------------------
HTTP SERVER
--------------------------------------------------
*/

const httpServer = http.createServer(app);
app.get(
  "/health",
  (req, res) => {

    res.json({

      status: "ok",

      service: "mistri-server",

      timestamp:
        new Date().toISOString()

    });

  }
);

/*
--------------------------------------------------
SOCKET.IO
--------------------------------------------------
*/

const io = new Server(httpServer, {

  cors: {

    origin:
      process.env.FRONTEND_URL,

    methods: [
      "GET",
      "POST"
    ],

    credentials: true

  }

});

/*
--------------------------------------------------
REDIS
--------------------------------------------------
*/

const redis = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379"
});

redis.on("error", (error) => {
  console.error("Redis Error:", error);
});

await redis.connect();

console.log("Redis connected");

/*
--------------------------------------------------
PRESENCE
--------------------------------------------------
*/

const PRESENCE_KEY = "mistri:presence";
await redis.del(PRESENCE_KEY);

console.log("Presence state reset");

/*
Get current number of connected users
*/

async function getActiveUsers() {
  return await redis.sCard(PRESENCE_KEY);
}

/*
Broadcast current user count to everyone
*/

async function broadcastPresence() {
  const count = await getActiveUsers();

  console.log(`Active users: ${count}`);

  io.emit("presence:update", count);
}

/*
--------------------------------------------------
BASIC ROUTE
--------------------------------------------------
*/

app.get("/", (req, res) => {
  res.json({
    service: "Mistri Presence Server",
    status: "running"
  });
});

/*
--------------------------------------------------
WEBSOCKET
--------------------------------------------------
*/

io.on("connection", async (socket) => {
  console.log("User connected:", socket.id);

  /*
  Add this user to Redis
  */

  await redis.sAdd(PRESENCE_KEY, socket.id);

  /*
  Send updated count to everyone
  */

  await broadcastPresence();

  /*
  User disconnects
  */

  socket.on("disconnect", async () => {
    console.log("User disconnected:", socket.id);

    /*
    Remove user from Redis
    */

    await redis.sRem(PRESENCE_KEY, socket.id);

    /*
    Send updated count to everyone
    */

    await broadcastPresence();
  });
});

/*
--------------------------------------------------
SERVER
--------------------------------------------------
*/

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`Mistri server running on port ${PORT}`);
});