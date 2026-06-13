require("dotenv").config();

const app = require("./app");
const { createTables } = require("./db/schema");

const PORT = process.env.PORT || 5000;

createTables()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`FRT server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Database setup failed:", error);
    process.exit(1);
  });
