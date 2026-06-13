const jwt = require("jsonwebtoken");

const normalizeAccountType = (decoded) => {
  return decoded.account_type || decoded.accountType || "user";
};

const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      message: "Authorization token is missing.",
    });
  }

  const token = authHeader.replace("Bearer ", "");

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const accountType = normalizeAccountType(decoded);

    req.user = {
      ...decoded,
      account_type: accountType,
      accountType,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      message: "Invalid or expired token.",
    });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user.account_type !== "admin" && req.user.accountType !== "admin") {
    return res.status(403).json({
      message: "Admin access required.",
    });
  }

  next();
};

module.exports = {
  requireAuth,
  requireAdmin,
};
