import { API_URL, getToken } from "./client";

export async function fetchDailyApplicationSequence({ profileId, dayStart, dayEnd }) {
  const params = new URLSearchParams({
    profileId: String(profileId),
    dayStart,
    dayEnd,
  });

  const response = await fetch(
    `${API_URL}/api/applications/daily-sequence?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${getToken()}`,
      },
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Could not get daily application number.");
  }

  return {
    sequenceNumber: result.sequenceNumber,
    applicationsToday: result.applicationsToday,
  };
}

export async function saveApplication({ profileId, roleName, companyName }) {
  const response = await fetch(`${API_URL}/api/applications`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({
      profileId,
      roleName: roleName.trim(),
      companyName: companyName.trim(),
    }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Could not save application.");
  }

  return result;
}
