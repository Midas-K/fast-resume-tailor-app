const { HttpError } = require("./httpError");

const jsonHandler =
  (serviceFn, { logLabel = "Request" } = {}) =>
  async (req, res) => {
    try {
      const result = await serviceFn(req);
      const status = result?.status ?? 200;
      const body = result?.body !== undefined ? result.body : result;

      return res.status(status).json(body);
    } catch (error) {
      if (error instanceof HttpError) {
        return res.status(error.status).json({
          message: error.message,
          ...error.extra,
        });
      }

      console.error(`${logLabel} error:`, error);

      return res.status(500).json({
        message: "Something went wrong.",
      });
    }
  };

module.exports = { jsonHandler };
