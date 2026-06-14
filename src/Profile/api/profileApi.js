import { API_URL, authHeaders, getToken } from "../../shared/api/client";
import { cachedJsonGet, invalidateCache } from "../../shared/api/cache";

const profilesPrefix = `GET:${API_URL}/api/profiles`;

export async function fetchProfiles() {
  const result = await cachedJsonGet(`${API_URL}/api/profiles`, {
    headers: authHeaders(),
  });

  return result.profiles || [];
}

export async function fetchProfileById(profileId) {
  const result = await cachedJsonGet(
    `${API_URL}/api/profiles/${profileId}`,
    { headers: authHeaders() },
    15_000
  );

  return result.profile;
}

export async function fetchProfileApplicationCounts() {
  const result = await cachedJsonGet(
    `${API_URL}/api/applications/profile-counts`,
    { headers: authHeaders() },
    15_000
  );

  return result.counts || [];
}

export async function fetchProfileApplications(profileId) {
  const result = await cachedJsonGet(
    `${API_URL}/api/applications/profile/${profileId}`,
    { headers: authHeaders() },
    15_000
  );

  return result.applications || [];
}

export async function saveProfile({ editingProfileId, payload }) {
  const isEditing = Boolean(editingProfileId);

  const response = await fetch(
    isEditing
      ? `${API_URL}/api/profiles/${editingProfileId}`
      : `${API_URL}/api/profiles`,
    {
      method: isEditing ? "PUT" : "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify(payload),
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result.message ||
        (isEditing ? "Could not update profile." : "Could not create profile.")
    );
  }

  invalidateCache(profilesPrefix);
  invalidateCache(`GET:${API_URL}/api/applications/profile-counts`);
  if (editingProfileId) {
    invalidateCache(`GET:${API_URL}/api/profiles/${editingProfileId}`);
  }
  if (result.profile?.id) {
    invalidateCache(`GET:${API_URL}/api/profiles/${result.profile.id}`);
  }

  return result;
}

export async function deleteProfile(profileId) {
  const response = await fetch(`${API_URL}/api/profiles/${profileId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Could not remove profile.");
  }

  invalidateCache(profilesPrefix);
  invalidateCache(`GET:${API_URL}/api/applications/profile-counts`);
  invalidateCache(`GET:${API_URL}/api/profiles/${profileId}`);

  return result;
}
