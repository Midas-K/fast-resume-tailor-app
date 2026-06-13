const express = require("express");
const corsMiddleware = require("./config/cors");

const authRoutes = require("./routes/auth");
const applicationRoutes = require("./routes/applications");
const profileRoutes = require("./routes/profiles");
const buildResumeRoutes = require("./routes/buildResume");
const resumeTemplateRoutes = require("./routes/resumeTemplates");

const app = express();

app.use(corsMiddleware);
app.use(express.json({ limit: "50mb" }));

app.get("/api/health", (req, res) => {
  res.json({
    message: "FRT server is running.",
  });
});

app.use("/api/resume-templates", resumeTemplateRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/profiles", profileRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/build-resume", buildResumeRoutes);

module.exports = app;
