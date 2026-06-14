const DB_NAME = "frt-resume-storage";
const DB_VERSION = 1;
const STORE_NAME = "directory-handles";
const ROOT_HANDLE_KEY = "customer-root";

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

const runStoreRequest = (request) =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      reject(request.error || new Error("Could not access saved folder."));
    };
  });

export async function getStoredCustomerRootHandle() {
  if (!("indexedDB" in window)) {
    return null;
  }

  try {
    const db = await openDatabase();
    const handle = await runStoreRequest(
      db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(ROOT_HANDLE_KEY)
    );
    db.close();

    return handle || null;
  } catch {
    return null;
  }
}

export async function storeCustomerRootHandle(handle) {
  if (!handle || !("indexedDB" in window)) {
    return;
  }

  try {
    const db = await openDatabase();
    await runStoreRequest(
      db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(handle, ROOT_HANDLE_KEY)
    );
    db.close();
  } catch {
    // Saving the handle is optional; picking again next time still works.
  }
}

export async function clearStoredCustomerRootHandle() {
  if (!("indexedDB" in window)) {
    return;
  }

  try {
    const db = await openDatabase();
    await runStoreRequest(
      db
        .transaction(STORE_NAME, "readwrite")
        .objectStore(STORE_NAME)
        .delete(ROOT_HANDLE_KEY)
    );
    db.close();
  } catch {
    // Ignore cleanup errors.
  }
}

export async function verifyDirectoryHandlePermission(handle) {
  if (!handle) {
    return false;
  }

  const options = { mode: "readwrite" };

  try {
    if ((await handle.queryPermission(options)) === "granted") {
      return true;
    }

    if ((await handle.requestPermission(options)) === "granted") {
      return true;
    }
  } catch {
    return false;
  }

  return false;
}
