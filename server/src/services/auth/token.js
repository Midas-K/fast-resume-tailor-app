const jwt = require("jsonwebtoken");

const createToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      account_type: user.account_type,
      accountType: user.account_type,
      is_approved: user.is_approved,
      isApproved: user.is_approved,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );
};

module.exports = { createToken };
