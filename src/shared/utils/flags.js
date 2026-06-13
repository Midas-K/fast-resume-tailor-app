export const getBooleanFlag = (...values) => {
  return values.some((value) => value === true || value === "true");
};
