require("dotenv").config();

const app = require("./app");
const { createTables } = require("./db/schema");

const PORT = Number(process.env.PORT) || 5000;
const HOST = process.env.HOST || "0.0.0.0";

if (!process.env.DATABASE_URL) {
  console.error(
    "DATABASE_URL is not set. Add your Neon/Postgres connection string in Render environment variables."
  );
}

const server = app.listen(PORT, HOST, () => {
  console.log(`FRT server listening on ${HOST}:${PORT}`);
});

const setupDatabase = async () => {
  try {
    await createTables();
    console.log("Database schema ready.");
  } catch (error) {
    console.error("Database setup failed:", error);
  }
};

setupDatabase();

const shutdown = (signal) => {
  console.log(`Received ${signal}, shutting down gracefully.`);

  server.close(() => {
    process.exit(0);
  });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
