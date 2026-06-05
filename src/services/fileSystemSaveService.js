const sanitizeFolderName = (value, fallback = "Unknown") => {
  const cleaned = String(value || "")
    .trim()
    .replace(/[<>:"/\\|?*]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/\.+$/g, "")
    .trim();

  if (!cleaned) return fallback;

  const reservedNames = [
    "CON",
    "PRN",
    "AUX",
    "NUL",
    "COM1",
    "COM2",
    "COM3",
    "COM4",
    "COM5",
    "COM6",
    "COM7",
    "COM8",
    "COM9",
    "LPT1",
    "LPT2",
    "LPT3",
    "LPT4",
    "LPT5",
    "LPT6",
    "LPT7",
    "LPT8",
    "LPT9",
  ];

  if (reservedNames.includes(cleaned.toUpperCase())) {
    return `${cleaned}_folder`;
  }

  return cleaned.slice(0, 100);
};

const sanitizeFileName = (value, fallback = "First_Last") => {
  const cleaned = sanitizeFolderName(value, fallback)
    .replace(/\s+/g, "_")
    .replace(/\.+$/g, "")
    .trim();

  return cleaned || fallback;
};

const getTodayFolderName = () => {
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();

  return sanitizeFolderName(`${month}.${day}`, "Today");
};

const downloadBlobFallback = ({ pdfBytes, fileName }) => {
  const blob = new Blob([pdfBytes], {
    type: "application/pdf",
  });

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
};

export const canUseFolderPicker = () => {
  return Boolean(window.showDirectoryPicker && window.isSecureContext);
};

export const pickCustomerRootFolder = async () => {
  if (!canUseFolderPicker()) {
    return null;
  }

  return window.showDirectoryPicker({
    mode: "readwrite",
  });
};

export const saveResumeToCustomerFolder = async ({
  pdfBytes,
  profileName = "First_Last",
  companyName = "Unknown Company",
  roleName = "Unknown Role",
  rootDirectoryHandle = null,
}) => {
  const dateFolder = getTodayFolderName();

  const companyRoleFolder = sanitizeFolderName(
    `${companyName || "Unknown Company"} - ${roleName || "Unknown Role"}`,
    "Unknown Company - Unknown Role"
  );

  const fileName = `${sanitizeFileName(profileName, "First_Last")}.pdf`;

  if (!rootDirectoryHandle) {
    downloadBlobFallback({
      pdfBytes,
      fileName,
    });

    return {
      savedWithFolderPicker: false,
      dateFolder: "Downloads",
      companyRoleFolder,
      fileName,
    };
  }

  const dateDirectoryHandle = await rootDirectoryHandle.getDirectoryHandle(
    dateFolder,
    {
      create: true,
    }
  );

  const companyRoleDirectoryHandle =
    await dateDirectoryHandle.getDirectoryHandle(companyRoleFolder, {
      create: true,
    });

  const fileHandle = await companyRoleDirectoryHandle.getFileHandle(fileName, {
    create: true,
  });

  const writable = await fileHandle.createWritable();
  await writable.write(pdfBytes);
  await writable.close();

  return {
    savedWithFolderPicker: true,
    dateFolder,
    companyRoleFolder,
    fileName,
  };
};