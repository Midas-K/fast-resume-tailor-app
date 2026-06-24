import {
  clearStoredCustomerRootHandle,
  getStoredCustomerRootHandle,
  storeCustomerRootHandle,
  verifyDirectoryHandlePermission,
} from "./customerFolderStorage";

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

export const getTodayFolderName = () => {
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();

  return sanitizeFolderName(`${month}.${day}`, "Today");
};

export const getLocalDayBounds = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return {
    dayStart: start.toISOString(),
    dayEnd: end.toISOString(),
    dateFolder: getTodayFolderName(),
  };
};

const buildNumberedCompanyRoleFolder = ({
  applicationNumber,
  companyName,
  roleName,
}) => {
  const sequence = Number(applicationNumber);

  if (!Number.isFinite(sequence) || sequence < 1) {
    throw new Error("Application number must be a positive integer.");
  }

  const companyRoleLabel = sanitizeFolderName(
    `${companyName || "Unknown Company"} - ${roleName || "Unknown Role"}`,
    "Unknown Company - Unknown Role"
  );

  return sanitizeFolderName(
    `${sequence}. ${companyRoleLabel}`,
    `${sequence}. Unknown Company - Unknown Role`
  );
};

export const FOLDER_PICKER_REQUIRED_MESSAGE =
  "Select a folder on your laptop or computer to save your resume. Use Chrome or Edge (HTTPS or localhost), then choose a local folder such as Documents or Desktop. Files stay on your device only.";

export const FOLDER_PICKER_USER_HINT =
  "Choose a folder on your laptop or computer (Documents, Desktop, or any local drive). The file is saved on your device, not on the server.";

export const canUseFolderPicker = () => {
  return Boolean(window.showDirectoryPicker && window.isSecureContext);
};

let cachedRootFolderSelection = null;

export const getCachedCustomerRootFolder = () => cachedRootFolderSelection;

export const warmCustomerRootFolder = async () => {
  if (cachedRootFolderSelection) {
    return cachedRootFolderSelection;
  }

  const selection = await resolveCustomerRootFolder();
  cachedRootFolderSelection = selection;
  return selection;
};

const openDirectoryPicker = async () => {
  const pickerOptions = {
    id: "frt-customer-resume-root",
    mode: "readwrite",
  };

  if (typeof window.showDirectoryPicker === "function") {
    try {
      return await window.showDirectoryPicker({
        ...pickerOptions,
        startIn: "documents",
      });
    } catch (error) {
      if (error?.name === "TypeError") {
        return window.showDirectoryPicker(pickerOptions);
      }

      throw error;
    }
  }

  throw new Error(FOLDER_PICKER_REQUIRED_MESSAGE);
};

export const resolveCustomerRootFolder = async ({ forcePicker = false } = {}) => {
  if (!canUseFolderPicker()) {
    throw new Error(FOLDER_PICKER_REQUIRED_MESSAGE);
  }

  if (!forcePicker) {
    const storedHandle = await getStoredCustomerRootHandle();

    if (storedHandle && (await verifyDirectoryHandlePermission(storedHandle))) {
      const selection = {
        handle: storedHandle,
        reusedSavedFolder: true,
      };
      cachedRootFolderSelection = selection;
      return selection;
    }
  }

  const handle = await openDirectoryPicker();
  await storeCustomerRootHandle(handle);

  const selection = {
    handle,
    reusedSavedFolder: false,
  };
  cachedRootFolderSelection = selection;

  return selection;
};

export const changeCustomerRootFolder = async () => {
  cachedRootFolderSelection = null;
  await clearStoredCustomerRootHandle();
  return resolveCustomerRootFolder({ forcePicker: true });
};

export const saveResumeToCustomerFolder = async ({
  pdfBytes,
  pdfBlob = null,
  profileName = "First_Last",
  companyName = "Unknown Company",
  roleName = "Unknown Role",
  applicationNumber = 1,
  rootDirectoryHandle = null,
}) => {
  if (!rootDirectoryHandle) {
    throw new Error(FOLDER_PICKER_REQUIRED_MESSAGE);
  }

  const filePayload = pdfBlob || pdfBytes;

  if (!filePayload) {
    throw new Error("Resume PDF data is missing.");
  }

  const dateFolder = getTodayFolderName();

  const companyRoleFolder = buildNumberedCompanyRoleFolder({
    applicationNumber,
    companyName,
    roleName,
  });

  const fileName = `${sanitizeFileName(profileName, "First_Last")}.pdf`;

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
  await writable.write(filePayload);
  await writable.close();

  return {
    dateFolder,
    companyRoleFolder,
    fileName,
    applicationNumber,
    savedPath: `${dateFolder}/${companyRoleFolder}/${fileName}`,
  };
};
