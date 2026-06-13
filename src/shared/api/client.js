export const API_URL = process.env.REACT_APP_API_URL || "";

export const getToken = () => localStorage.getItem("rta_token");

export const authHeaders = () => ({
  Authorization: `Bearer ${getToken()}`,
});

export const jsonAuthHeaders = () => ({
  "Content-Type": "application/json",
  ...authHeaders(),
});

export const readJsonResponse = async (response, urlLabel) => {
  const contentType = response.headers.get("content-type");

  if (!contentType || !contentType.includes("application/json")) {
    const text = await response.text();
    console.error(`Non-JSON response from ${urlLabel}:`, text);
    throw new Error(`Backend returned HTML instead of JSON from: ${urlLabel}`);
  }

  return response.json();
};
