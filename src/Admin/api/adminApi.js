import {
  API_URL,
  authHeaders,
  jsonAuthHeaders,
  readJsonResponse,
} from "../../shared/api/client";
import { cachedJsonGet, invalidateCache } from "../../shared/api/cache";

const invalidateAdminReads = () => {
  invalidateCache(`GET:${API_URL}/api/auth/users`);
  invalidateCache(`GET:${API_URL}/api/applications/admin/profile-counts`);
  invalidateCache(`GET:${API_URL}/api/profiles/admin/all`);
  invalidateCache(`GET:${API_URL}/api/resume-templates`);
};

const templatePreviewBlobCache = new Map();

export const invalidateTemplatePreviewCache = (templateId = null) => {
  if (!templateId) {
    templatePreviewBlobCache.clear();
    return;
  }

  templatePreviewBlobCache.delete(String(templateId));
};

export async function fetchAdminUsers() {
  const url = `${API_URL}/api/auth/users`;
  const result = await cachedJsonGet(url, { headers: authHeaders() }, 120_000);

  return result.users || [];
}

export async function fetchAdminProfileCounts() {
  const url = `${API_URL}/api/applications/admin/profile-counts`;
  const result = await cachedJsonGet(url, { headers: authHeaders() }, 120_000);

  return result.counts || [];
}

export async function fetchAdminProfileApplications(profileId) {
  const url = `${API_URL}/api/applications/admin/profile/${profileId}/applications`;
  const result = await cachedJsonGet(url, { headers: authHeaders() }, 120_000);

  return result.applications || [];
}

export async function fetchAdminApplications() {
  const url = `${API_URL}/api/applications/admin/summary`;
  const response = await fetch(url, { headers: authHeaders() });
  const result = await readJsonResponse(response, url);

  if (!response.ok) {
    throw new Error(result.message || "Could not load applications.");
  }

  return result.applications || [];
}

export async function fetchAllProfiles() {
  const url = `${API_URL}/api/profiles/admin/all`;
  const result = await cachedJsonGet(url, { headers: authHeaders() }, 120_000);

  return result.profiles || [];
}

export async function fetchResumeTemplates() {
  const url = `${API_URL}/api/resume-templates`;
  const result = await cachedJsonGet(url, { headers: authHeaders() }, 120_000);

  return result.templates || [];
}

export async function fetchTemplatePreviewBlob(templateId) {
  const cacheKey = String(templateId);
  const cachedBlob = templatePreviewBlobCache.get(cacheKey);

  if (cachedBlob) {
    return cachedBlob;
  }

  const url = `${API_URL}/api/resume-templates/${templateId}/preview-pdf`;
  const response = await fetch(url, { headers: authHeaders() });

  if (!response.ok) {
    const result = await response.json().catch(() => null);
    throw new Error(result?.message || "Could not load template preview.");
  }

  const blob = await response.blob();
  templatePreviewBlobCache.set(cacheKey, blob);

  return blob;
}

export async function uploadResumeTemplate(formData) {
  const url = `${API_URL}/api/resume-templates`;
  const response = await fetch(url, {
    method: "POST",
    headers: authHeaders(),
    body: formData,
  });
  const result = await readJsonResponse(response, url);

  if (!response.ok) {
    const errorLines =
      result.errors && result.errors.length > 0
        ? result.errors
        : result.message
        ? [result.message]
        : ["Could not upload resume template."];

    const details = [
      "Template upload failed:",
      ...errorLines,
      ...(result.warnings || []).map((warning) => `Warning: ${warning}`),
    ]
      .filter(Boolean)
      .join("\n");

    throw new Error(details);
  }

  invalidateCache(`GET:${API_URL}/api/resume-templates`);
  invalidateTemplatePreviewCache();

  return result;
}

export async function setDefaultResumeTemplate(templateId) {
  const url = `${API_URL}/api/resume-templates/${templateId}/default`;
  const response = await fetch(url, {
    method: "PATCH",
    headers: authHeaders(),
  });
  const result = await readJsonResponse(response, url);

  if (!response.ok) {
    throw new Error(result.message || "Could not set default template.");
  }

  invalidateCache(`GET:${API_URL}/api/resume-templates`);
  invalidateTemplatePreviewCache();

  return result;
}

export async function deleteResumeTemplate(templateId) {
  const url = `${API_URL}/api/resume-templates/${templateId}`;
  const response = await fetch(url, {
    method: "DELETE",
    headers: authHeaders(),
  });
  const result = await readJsonResponse(response, url);

  if (!response.ok) {
    throw new Error(result.message || "Could not remove template.");
  }

  invalidateCache(`GET:${API_URL}/api/resume-templates`);
  invalidateTemplatePreviewCache(templateId);

  return result;
}

export async function updateProfileResumeTemplate(profileId, resumeTemplateId) {
  const url = `${API_URL}/api/profiles/admin/${profileId}/resume-template`;
  const response = await fetch(url, {
    method: "PATCH",
    headers: jsonAuthHeaders(),
    body: JSON.stringify({ resumeTemplateId: resumeTemplateId || null }),
  });
  const result = await readJsonResponse(response, url);

  if (!response.ok) {
    throw new Error(result.message || "Could not update resume template.");
  }

  invalidateCache(`GET:${API_URL}/api/profiles/admin/all`);

  return result;
}

export async function updateUserApproval(userId, isApproved) {
  const url = `${API_URL}/api/auth/users/${userId}/approval`;
  const response = await fetch(url, {
    method: "PATCH",
    headers: jsonAuthHeaders(),
    body: JSON.stringify({ isApproved }),
  });
  const result = await readJsonResponse(response, url);

  if (!response.ok) {
    throw new Error(result.message || "Could not update account.");
  }

  invalidateAdminReads();
  return result;
}

export async function deleteUserAccount(userId) {
  const url = `${API_URL}/api/auth/users/${userId}`;
  const response = await fetch(url, {
    method: "DELETE",
    headers: authHeaders(),
  });
  const result = await readJsonResponse(response, url);

  if (!response.ok) {
    throw new Error(result.message || "Could not permanently delete account.");
  }

  invalidateAdminReads();
  return result;
}

export async function updateUserJobBidStyle(userId, jobBidStyle) {
  const url = `${API_URL}/api/auth/users/${userId}/job-bid-style`;
  const response = await fetch(url, {
    method: "PATCH",
    headers: jsonAuthHeaders(),
    body: JSON.stringify({ jobBidStyle }),
  });
  const result = await readJsonResponse(response, url);

  if (!response.ok) {
    throw new Error(result.message || "Could not update job-bid style.");
  }

  invalidateAdminReads();
  return result;
}

export async function saveProfilePrompt(profileId, adminPrompt) {
  const url = `${API_URL}/api/profiles/admin/${profileId}/prompt`;
  const response = await fetch(url, {
    method: "PATCH",
    headers: jsonAuthHeaders(),
    body: JSON.stringify({ adminPrompt }),
  });
  const result = await readJsonResponse(response, url);

  if (!response.ok) {
    throw new Error(result.message || "Could not update profile prompt.");
  }

  invalidateAdminReads();
  return result;
}

export async function deleteProfileApplications(profileId, payload) {
  const url = `${API_URL}/api/applications/admin/profile/${profileId}`;
  const response = await fetch(url, {
    method: "DELETE",
    headers: jsonAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const result = await readJsonResponse(response, url);

  if (!response.ok) {
    throw new Error(result.message || "Could not delete application records.");
  }

  invalidateCache(`GET:${API_URL}/api/applications/admin/profile-counts`);
  invalidateCache(
    `GET:${API_URL}/api/applications/admin/profile/${profileId}/applications`
  );
  return result;
}
