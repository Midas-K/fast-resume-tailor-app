const fs = require("fs/promises");
const path = require("path");
const os = require("os");
const { execFile } = require("child_process");
const { pathToFileURL } = require("url");

let sharedProfileDirPromise = null;

const getSharedProfileDir = () => {
  if (!sharedProfileDirPromise) {
    sharedProfileDirPromise = fs.mkdtemp(
      path.join(os.tmpdir(), "frt-libreoffice-profile-")
    );
  }

  return sharedProfileDirPromise;
};

const runLibreOfficeConvert = async (inputPath, outputDir) => {
  const profileDir = await getSharedProfileDir();
  const userInstallationUrl = pathToFileURL(profileDir).href;

  const runCommand = (command) =>
    new Promise((resolve, reject) => {
      execFile(
        command,
        [
          "--headless",
          "--norestore",
          "--nologo",
          "--nodefault",
          "--nofirststartwizard",
          "--nolockcheck",
          "--convert-to",
          "pdf",
          "--outdir",
          outputDir,
          inputPath,
        ],
        {
          timeout: 120000,
          env: {
            ...process.env,
            HOME: profileDir,
            UserInstallation: userInstallationUrl,
          },
        },
        (error, stdout, stderr) => {
          if (error) {
            reject(
              Object.assign(
                new Error(
                  [
                    `LibreOffice command failed: ${command}`,
                    stdout ? `stdout: ${stdout}` : "",
                    stderr ? `stderr: ${stderr}` : "",
                    error.message ? `error: ${error.message}` : "",
                  ]
                    .filter(Boolean)
                    .join("\n")
                ),
                { stdout, stderr }
              )
            );
            return;
          }

          resolve({ stdout, stderr });
        }
      );
    });

  try {
    await runCommand("libreoffice");
  } catch (firstError) {
    console.error("libreoffice failed, trying soffice:", firstError.message);
    await runCommand("soffice");
  }
};

module.exports = {
  runLibreOfficeConvert,
};
