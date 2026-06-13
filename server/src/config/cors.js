const cors = require("cors");

const allowedOrigins = [
  process.env.CLIENT_URL,
  "http://localhost",
  "http://localhost:3000",
  "http://frt.ai.com",
  "http://my-server.env",
].filter(Boolean);

const corsMiddleware = cors({
  origin: (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    const isAllowedLocalNetwork =
      /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(origin) ||
      /^http:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(origin) ||
      /^http:\/\/172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(
        origin
      );

    if (allowedOrigins.includes(origin) || isAllowedLocalNetwork) {
      callback(null, true);
      return;
    }

    console.error(`CORS blocked origin: ${origin}`);

    callback(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: true,
});

module.exports = corsMiddleware;
