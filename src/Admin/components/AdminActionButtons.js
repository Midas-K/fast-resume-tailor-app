import LabeledIconButton from "../../UI/LabeledIconButton";
import Icon from "../../UI/Icon";

export function PromptActionGroup({
  profile,
  inputRef,
  onViewPrompt,
  onTriggerPromptUpload,
  onPromptFileUpload,
  onRemovePrompt,
  layout = "row",
}) {
  const hasUploadedPrompt =
    profile.admin_prompt && profile.admin_prompt.trim();

  return (
    <div className={`admin-action-group admin-action-group--${layout}`}>
      <span
        className={
          hasUploadedPrompt ? "admin-status-chip ready" : "admin-status-chip pending"
        }
      >
        <Icon name={hasUploadedPrompt ? "fileCheck" : "sparkles"} size={13} />
        {hasUploadedPrompt ? "Custom prompt" : "Sample prompt"}
      </span>

      <div className="admin-action-group__buttons">
        <LabeledIconButton
          icon="scrollText"
          label="View prompt"
          variant="ghost"
          size="sm"
          onClick={() => onViewPrompt(profile)}
        />
        <LabeledIconButton
          icon="fileUp"
          label="Upload prompt"
          variant="primary"
          size="sm"
          onClick={() => onTriggerPromptUpload(profile.id)}
        />
        <LabeledIconButton
          icon="fileX"
          label="Remove prompt"
          variant="danger"
          size="sm"
          onClick={() => onRemovePrompt(profile.id)}
        />
      </div>

      <input
        type="file"
        accept=".txt,text/plain"
        style={{ display: "none" }}
        ref={inputRef}
        onChange={(e) => onPromptFileUpload(profile.id, e.target.files?.[0])}
      />
    </div>
  );
}

export function ApplicationCountBadges({ wholeCount, recentCount }) {
  return (
    <div className="admin-app-counts">
      <span className="admin-metric-chip">
        <Icon name="layers" size={13} />
        <strong>{wholeCount}</strong>
        <span>Total</span>
      </span>
      <span className="admin-metric-chip accent">
        <Icon name="calendarCheck" size={13} />
        <strong>{recentCount}</strong>
        <span>Latest day</span>
      </span>
    </div>
  );
}

export function ApplicationDeleteGroup({
  profile,
  onDeleteApplications,
  getLatestApplicationDate,
  showLatestDay = true,
}) {
  return (
    <div className="admin-action-group admin-action-group--stack">
      <div className="admin-action-group__buttons admin-action-group__buttons--wrap">
        <LabeledIconButton
          icon="archive"
          label="Delete all apps"
          variant="danger"
          size="sm"
          onClick={() => onDeleteApplications({ profile, deleteType: "all" })}
        />

        {showLatestDay && (
          <LabeledIconButton
            icon="calendarX"
            label="Delete latest day"
            variant="danger-soft"
            size="sm"
            onClick={() => {
              const latestDate = getLatestApplicationDate(profile);

              if (!latestDate) {
                alert("No application date found for this profile.");
                return;
              }

              onDeleteApplications({
                profile,
                deleteType: "day",
                date: latestDate,
              });
            }}
          />
        )}
      </div>
    </div>
  );
}

export function ApplicationListDeleteToolbar({
  profile,
  selectedApplicationDate,
  onDeleteApplications,
  onBackToDates,
  getIsoDateFromFormattedDate,
  getMonthFromDate,
  getYearFromDate,
}) {
  const selectedIsoDate = getIsoDateFromFormattedDate(selectedApplicationDate);

  return (
    <div className="admin-delete-toolbar">
      <LabeledIconButton
        icon="calendarX"
        label="Delete this day"
        variant="danger-soft"
        size="sm"
        onClick={() =>
          onDeleteApplications({
            profile,
            deleteType: "day",
            date: selectedIsoDate,
          })
        }
      />
      <LabeledIconButton
        icon="calendarDays"
        label="Delete this month"
        variant="danger-soft"
        size="sm"
        onClick={() =>
          onDeleteApplications({
            profile,
            deleteType: "month",
            month: getMonthFromDate(selectedIsoDate),
          })
        }
      />
      <LabeledIconButton
        icon="calendarRange"
        label="Delete this year"
        variant="danger-soft"
        size="sm"
        onClick={() =>
          onDeleteApplications({
            profile,
            deleteType: "year",
            year: getYearFromDate(selectedIsoDate),
          })
        }
      />
      <LabeledIconButton
        icon="archive"
        label="Delete all apps"
        variant="danger"
        size="sm"
        onClick={() => onDeleteApplications({ profile, deleteType: "all" })}
      />
      <LabeledIconButton
        icon="arrowLeft"
        label="Back to dates"
        variant="ghost"
        size="sm"
        onClick={onBackToDates}
      />
    </div>
  );
}
