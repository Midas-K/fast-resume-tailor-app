import { API_URL, getToken } from "../../shared/api/client";

export async function fetchProfiles() {
  const response = await fetch(`${API_URL}/api/profiles`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Could not load profiles.");
  }

  return result.profiles || [];
}

export async function fetchProfileApplicationCounts() {
  const response = await fetch(`${API_URL}/api/applications/profile-counts`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Could not load application counts.");
  }

  return result.counts || [];
}

export async function fetchProfileApplications(profileId) {
  const response = await fetch(`${API_URL}/api/applications/profile/${profileId}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Could not load applications.");
  }

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

  return result;
}

export async function deleteProfile(profileId) {
  const response = await fetch(`${API_URL}/api/profiles/${profileId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Could not remove profile.");
  }

  return result;
}
