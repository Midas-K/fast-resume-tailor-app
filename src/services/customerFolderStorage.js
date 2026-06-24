const DB_NAME = "frt-resume-storage";
const DB_VERSION = 1;
const STORE_NAME = "directory-handles";
const ROOT_HANDLE_KEY = "customer-root";

let dbPromise = null;
let memoryRootHandle = null;
let memoryPermissionGranted = false;

const openDatabase = () =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(request.error || new Error("Could not open resume storage."));
    };

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };
  });

const getDatabase = () => {
  if (!dbPromise) {
    dbPromise = openDatabase();
  }

  return dbPromise;
};

const runStoreRequest = (request) =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      reject(request.error || new Error("Could not access saved folder."));
    };
  });

export async function getStoredCustomerRootHandle() {
  if (memoryRootHandle) {
    return memoryRootHandle;
  }

  if (!("indexedDB" in window)) {
    return null;
  }

  try {
    const db = await getDatabase();
    const handle = await runStoreRequest(
      db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(ROOT_HANDLE_KEY)
    );

    if (handle) {
      memoryRootHandle = handle;
    }

    return handle || null;
  } catch {
    return null;
  }
}

export async function storeCustomerRootHandle(handle) {
  if (!handle || !("indexedDB" in window)) {
    return;
  }

  memoryRootHandle = handle;
  memoryPermissionGranted = false;

  try {
    const db = await getDatabase();
    await runStoreRequest(
      db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(handle, ROOT_HANDLE_KEY)
    );
  } catch {
    // Saving the handle is optional; picking again next time still works.
  }
}

export async function clearStoredCustomerRootHandle() {
  memoryRootHandle = null;
  memoryPermissionGranted = false;

  if (!("indexedDB" in window)) {
    return;
  }

  try {
    const db = await getDatabase();
    await runStoreRequest(
      db
        .transaction(STORE_NAME, "readwrite")
        .objectStore(STORE_NAME)
        .delete(ROOT_HANDLE_KEY)
    );
  } catch {
    // Ignore cleanup errors.
  }
}

export async function verifyDirectoryHandlePermission(handle) {
  if (!handle) {
    return false;
  }

  if (handle === memoryRootHandle && memoryPermissionGranted) {
    return true;
  }

  const options = { mode: "readwrite" };

  try {
    if ((await handle.queryPermission(options)) === "granted") {
      if (handle === memoryRootHandle) {
        memoryPermissionGranted = true;
      }

      return true;
    }

    if ((await handle.requestPermission(options)) === "granted") {
      if (handle === memoryRootHandle) {
        memoryPermissionGranted = true;
      }

      return true;
    }
  } catch {
    return false;
  }

  return false;
}
