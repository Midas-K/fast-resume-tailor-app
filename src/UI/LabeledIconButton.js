import Icon from "./Icon";

function LabeledIconButton({
  icon,
  label,
  variant = "ghost",
  size = "sm",
  className = "",
  loading = false,
  disabled = false,
  type = "button",
  onClick,
  ...rest
}) {
  const classes = [
    "labeled-icon-btn",
    `labeled-icon-btn--${variant}`,
    `labeled-icon-btn--${size}`,
    loading ? "labeled-icon-btn--loading" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type={type}
      className={classes}
      aria-label={label}
      title={label}
      disabled={disabled || loading}
      onClick={onClick}
      {...rest}
    >
      {loading ? (
        <Icon name="loader" size={15} className="spin" />
      ) : (
        <Icon name={icon} size={size === "md" ? 16 : 15} />
      )}
      <span>{label}</span>
    </button>
  );
}

export default LabeledIconButton;
