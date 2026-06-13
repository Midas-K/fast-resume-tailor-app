import Icon from "./Icon";

function IconButton({
  icon,
  label,
  variant = "ghost",
  size = "md",
  className = "",
  loading = false,
  disabled = false,
  type = "button",
  onClick,
  ...rest
}) {
  const classes = [
    "icon-btn",
    `icon-btn--${variant}`,
    `icon-btn--${size}`,
    loading ? "icon-btn--loading" : "",
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
        <Icon name="loader" size={size === "sm" ? 15 : 17} className="spin" />
      ) : (
        <Icon name={icon} size={size === "sm" ? 15 : size === "lg" ? 20 : 17} />
      )}
    </button>
  );
}

export default IconButton;
