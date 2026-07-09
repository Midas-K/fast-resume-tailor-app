import { zipSync } from "fflate";
import {
  formatEstFolderDate,
  getEstDayBounds,
} from "../shared/utils/estDateTime";
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

export const getTodayFolderName = (date = new Date()) => {
  return sanitizeFolderName(formatEstFolderDate(date), "Today");
};

export const getEstResumeDayBounds = (date = new Date()) => {
  const { dayStart, dayEnd } = getEstDayBounds(date);

  return {
    dayStart,
    dayEnd,
    dateFolder: getTodayFolderName(date),
    timeZone: "America/New_York",
  };
};

export const getLocalDayBounds = getEstResumeDayBounds;

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

const readFolderSequenceFromName = (name = "") => {
  const match = String(name).trim().match(/^(\d+)\.\s+/);

  if (!match) {
    return null;
  }

  const sequence = Number(match[1]);

  return Number.isFinite(sequence) && sequence > 0 ? sequence : null;
};

export const getNextFolderSequenceInDateFolder = async (
  dateDirectoryHandle = null
) => {
  if (!dateDirectoryHandle) {
    return 1;
  }

  let maxSequence = 0;

  try {
    for await (const [name, handle] of dateDirectoryHandle.entries()) {
      if (handle.kind !== "directory") {
        continue;
      }

      const sequence = readFolderSequenceFromName(name);

      if (sequence) {
        maxSequence = Math.max(maxSequence, sequence);
      }
    }
  } catch {
    return 1;
  }

  return maxSequence + 1;
};

const resolveApplicationFolderNumber = async ({
  dateDirectoryHandle = null,
  applicationNumber = null,
} = {}) => {
  const localNext = await getNextFolderSequenceInDateFolder(dateDirectoryHandle);
  const serverNumber = Number(applicationNumber);

  if (Number.isFinite(serverNumber) && serverNumber >= 1) {
    return Math.max(serverNumber, localNext);
  }

  return localNext;
};

export const buildResumeSaveLocation = async ({
  companyName,
  roleName,
  profileName,
  applicationNumber = 1,
  dateDirectoryHandle = null,
}) => {
  const dateFolder = getTodayFolderName();
  const resolvedApplicationNumber = await resolveApplicationFolderNumber({
    dateDirectoryHandle,
    applicationNumber,
  });
  const companyRoleFolder = buildNumberedCompanyRoleFolder({
    applicationNumber: resolvedApplicationNumber,
    companyName,
    roleName,
  });
  const fileName = `${sanitizeFileName(profileName, "First_Last")}.pdf`;

  return {
    dateFolder,
    companyRoleFolder,
    fileName,
    applicationNumber: resolvedApplicationNumber,
    savedPath: `${dateFolder}/${companyRoleFolder}/${fileName}`,
  };
};

const MOBILE_SEQUENCE_KEY = "frt-mobile-save-seq";

const getMobileSequenceStore = () => {
  try {
    return JSON.parse(localStorage.getItem(MOBILE_SEQUENCE_KEY) || "{}");
  } catch {
    return {};
  }
};

const rememberMobileSequence = (dateFolder, sequence) => {
  const store = getMobileSequenceStore();
  const nextValue = Math.max(Number(store[dateFolder]) || 0, Number(sequence) || 0);

  store[dateFolder] = nextValue;
  localStorage.setItem(MOBILE_SEQUENCE_KEY, JSON.stringify(store));
};

const resolveMobileApplicationNumber = (applicationNumber) => {
  const dateFolder = getTodayFolderName();
  const store = getMobileSequenceStore();
  const localNext = (Number(store[dateFolder]) || 0) + 1;
  const serverNumber = Number(applicationNumber);

  if (Number.isFinite(serverNumber) && serverNumber >= 1) {
    return Math.max(serverNumber, localNext);
  }

  return localNext;
};

const buildResumeSaveLocationForDownload = ({
  companyName,
  roleName,
  profileName,
  applicationNumber = 1,
}) => {
  const dateFolder = getTodayFolderName();
  const resolvedApplicationNumber = resolveMobileApplicationNumber(applicationNumber);
  const companyRoleFolder = buildNumberedCompanyRoleFolder({
    applicationNumber: resolvedApplicationNumber,
    companyName,
    roleName,
  });
  const fileName = `${sanitizeFileName(profileName, "First_Last")}.pdf`;

  return {
    dateFolder,
    companyRoleFolder,
    fileName,
    applicationNumber: resolvedApplicationNumber,
    savedPath: `${dateFolder}/${companyRoleFolder}/${fileName}`,
  };
};

const toUint8Array = async (filePayload) => {
  if (filePayload instanceof Uint8Array) {
    return filePayload;
  }

  if (filePayload instanceof ArrayBuffer) {
    return new Uint8Array(filePayload);
  }

  if (filePayload?.arrayBuffer) {
    return new Uint8Array(await filePayload.arrayBuffer());
  }

  throw new Error("Resume PDF data is missing.");
};

const triggerBlobDownload = (blob, fileName) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const saveResumeAsStructuredZip = async ({
  pdfBytes,
  pdfBlob = null,
  profileName = "First_Last",
  companyName = "Unknown Company",
  roleName = "Unknown Role",
  applicationNumber = 1,
}) => {
  const filePayload = pdfBlob || pdfBytes;

  if (!filePayload) {
    throw new Error("Resume PDF data is missing.");
  }

  const location = buildResumeSaveLocationForDownload({
    profileName,
    companyName,
    roleName,
    applicationNumber,
  });
  const zipPath = `${location.dateFolder}/${location.companyRoleFolder}/${location.fileName}`;
  const zipped = zipSync({
    [zipPath]: await toUint8Array(filePayload),
  });
  const zipBlob = new Blob([zipped], { type: "application/zip" });
  const zipFileName = sanitizeFolderName(
    `${location.dateFolder} - ${location.companyRoleFolder}`,
    "resume-save"
  );

  triggerBlobDownload(zipBlob, `${zipFileName}.zip`);
  rememberMobileSequence(location.dateFolder, location.applicationNumber);

  return {
    ...location,
    saveMode: "zip",
    zipFileName: `${zipFileName}.zip`,
  };
};

export const FOLDER_PICKER_REQUIRED_MESSAGE =
  "Select a folder on your device to save your resume. Use Chrome or Edge (HTTPS or localhost), then choose a local folder such as Documents, Desktop, or Downloads. Files stay on your device only.";

export const FOLDER_PICKER_USER_HINT =
  "Choose a folder on your device (Documents, Desktop, Downloads, or any local drive). Resumes are grouped by US Eastern (EST/EDT) date folders.";

export const MOBILE_ZIP_SAVE_HINT =
  "Your phone cannot pick a folder directly in this browser. We download a zip with the same US Eastern (EST/EDT) date/company folder layout as desktop. Unzip it in Files or Downloads to get the same structure.";

export const canUseFolderPicker = () => {
  return Boolean(window.showDirectoryPicker && window.isSecureContext);
};

export const usesStructuredZipFallback = () => !canUseFolderPicker();

export const canSaveResumeToDevice = () => true;

let cachedRootFolderSelection = null;
let cachedDateFolderSelection = null;

export const getCachedCustomerRootFolder = () => cachedRootFolderSelection;

export const getCachedDateFolderHandle = () => cachedDateFolderSelection;

const rememberDateFolderSelection = (rootDirectoryHandle, dateFolder, handle) => {
  cachedDateFolderSelection = {
    rootDirectoryHandle,
    dateFolder,
    handle,
  };
};

export const prepareResumeSaveFolder = async (rootDirectoryHandle = null) => {
  const rootHandle =
    rootDirectoryHandle || cachedRootFolderSelection?.handle || null;

  if (!rootHandle) {
    return null;
  }

  const dateFolder = getTodayFolderName();

  if (
    cachedDateFolderSelection?.rootDirectoryHandle === rootHandle &&
    cachedDateFolderSelection?.dateFolder === dateFolder &&
    cachedDateFolderSelection?.handle
  ) {
    return cachedDateFolderSelection;
  }

  const handle = await rootHandle.getDirectoryHandle(dateFolder, {
    create: true,
  });

  rememberDateFolderSelection(rootHandle, dateFolder, handle);

  return cachedDateFolderSelection;
};

export const warmCustomerRootFolder = async () => {
  if (cachedRootFolderSelection) {
    prepareResumeSaveFolder(cachedRootFolderSelection.handle).catch(() => {});
    return cachedRootFolderSelection;
  }

  const selection = await resolveCustomerRootFolder();
  cachedRootFolderSelection = selection;
  prepareResumeSaveFolder(selection.handle).catch(() => {});
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
  cachedDateFolderSelection = null;
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

  let dateDirectoryHandle = null;

  if (
    cachedDateFolderSelection?.rootDirectoryHandle === rootDirectoryHandle &&
    cachedDateFolderSelection?.dateFolder === dateFolder &&
    cachedDateFolderSelection?.handle
  ) {
    dateDirectoryHandle = cachedDateFolderSelection.handle;
  } else {
    dateDirectoryHandle = await rootDirectoryHandle.getDirectoryHandle(
      dateFolder,
      {
        create: true,
      }
    );
    rememberDateFolderSelection(rootDirectoryHandle, dateFolder, dateDirectoryHandle);
  }

  const location = await buildResumeSaveLocation({
    companyName,
    roleName,
    profileName,
    applicationNumber,
    dateDirectoryHandle,
  });

  const companyRoleDirectoryHandle =
    await dateDirectoryHandle.getDirectoryHandle(location.companyRoleFolder, {
      create: true,
    });

  const fileHandle = await companyRoleDirectoryHandle.getFileHandle(location.fileName, {
    create: true,
  });

  const writable = await fileHandle.createWritable();
  await writable.write(filePayload);
  await writable.close();

  return {
    ...location,
    saveMode: "folder",
  };
};

export const saveResumeToDevice = async ({
  pdfBytes,
  pdfBlob = null,
  profileName = "First_Last",
  companyName = "Unknown Company",
  roleName = "Unknown Role",
  applicationNumber = 1,
  rootDirectoryHandle = null,
}) => {
  if (canUseFolderPicker()) {
    const handle =
      rootDirectoryHandle ||
      cachedRootFolderSelection?.handle ||
      (await warmCustomerRootFolder()).handle;

    return saveResumeToCustomerFolder({
      pdfBytes,
      pdfBlob,
      profileName,
      companyName,
      roleName,
      applicationNumber,
      rootDirectoryHandle: handle,
    });
  }

  return saveResumeAsStructuredZip({
    pdfBytes,
    pdfBlob,
    profileName,
    companyName,
    roleName,
    applicationNumber,
  });
};
