import { API_URL, getToken } from "./client";
import { invalidateCache } from "./cache";

const applicationCountsPrefix = `GET:${API_URL}/api/applications/profile-counts`;

export async function buildResumeFromTemplate(payload) {
  const token = getToken();

  if (!token) {
    throw new Error("Please login again.");
  }

  const response = await fetch(`${API_URL}/api/build-resume/from-template`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const result = await response.json().catch(() => null);
    throw new Error(result?.message || "Could not generate resume PDF.");
  }

  const sequenceHeader = response.headers.get("X-Application-Sequence");
  const blob = await response.blob();

  queueMicrotask(() => {
    invalidateCache(applicationCountsPrefix);
    invalidateCache(`GET:${API_URL}/api/applications/profile/${payload.profileId}`);
  });

  return {
    blob,
    sequenceNumber: sequenceHeader ? Number(sequenceHeader) : null,
  };
}

export async function buildResumeFromProfile(payload) {
  const token = getToken();

  if (!token) {
    throw new Error("Please login again.");
  }

  const response = await fetch(`${API_URL}/api/build-resume/from-profile`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const result = await response.json().catch(() => null);
    throw new Error(result?.message || "Could not build resume.");
  }

  const sequenceHeader = response.headers.get("X-Application-Sequence");
  const templateName = response.headers.get("X-Resume-Template-Name");
  const usesDefaultTemplate =
    response.headers.get("X-Resume-Uses-Default-Template") === "true";
  const blob = await response.blob();

  queueMicrotask(() => {
    invalidateCache(applicationCountsPrefix);
    invalidateCache(`GET:${API_URL}/api/applications/profile/${payload.profileId}`);
  });

  return {
    blob,
    sequenceNumber: sequenceHeader ? Number(sequenceHeader) : null,
    templateName,
    usesDefaultTemplate,
  };
}
