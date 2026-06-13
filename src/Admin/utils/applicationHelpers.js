import { formatDateOnly } from "../../shared/utils/format";

export function getProfileApplicationRows(applications, profile) {
  const rows = [];

  applications.forEach((applicationGroup) => {
    const matchingProfileRows = (applicationGroup.profiles || []).filter(
      (appProfile) => String(appProfile.profileId) === String(profile.id)
    );

    matchingProfileRows.forEach((profileRow) => {
      rows.push({
        companyName: applicationGroup.company_name,
        roleName: applicationGroup.role_name,
        appliedAt: profileRow.appliedAt,
        profileName: profileRow.profileName,
        profileEmail: profileRow.profileEmail,
        profileLocation: profileRow.profileLocation,
      });
    });
  });

  return rows.sort((a, b) => {
    const timeA = new Date(a.appliedAt || 0).getTime();
    const timeB = new Date(b.appliedAt || 0).getTime();
    return timeA - timeB;
  });
}

export function getWholeApplicationCount(applications, profile) {
  return getProfileApplicationRows(applications, profile).length;
}

export function getMostRecentApplicationCount(applications, profile) {
  const rows = getProfileApplicationRows(applications, profile);

  if (rows.length === 0) {
    return 0;
  }

  const latestApplication = rows[rows.length - 1];
  const latestDate = formatDateOnly(latestApplication.appliedAt);

  return rows.filter((row) => formatDateOnly(row.appliedAt) === latestDate)
    .length;
}

export function getApplicationDateGroups(rows) {
  const groups = {};

  rows.forEach((row) => {
    const dateKey = formatDateOnly(row.appliedAt);

    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }

    groups[dateKey].push(row);
  });

  return Object.entries(groups).map(([date, dateRows]) => ({
    date,
    rows: dateRows,
  }));
}

export function downloadProfilePrompt(profile) {
  if (!profile.admin_prompt || !profile.admin_prompt.trim()) {
    alert("You didn't upload prompt!");
    return;
  }

  const blob = new Blob([profile.admin_prompt], {
    type: "text/plain;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  const safeProfileName = (profile.profile_name || "profile")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "_");

  link.href = url;
  link.download = `${safeProfileName}_prompt.txt`;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}
