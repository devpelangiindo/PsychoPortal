import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
const productionOrigins = new Set([
  "https://pi-psychology.com",
  "https://www.pi-psychology.com",
  "https://asesmen.pi-psychology.com",
  "https://psychoportal-asesmen-4djc.onrender.com",
  "https://psychoportal-marketing-oekw.onrender.com",
  ...(process.env.CORS_ALLOWED_ORIGINS || "").split(",").map((origin) => origin.trim()).filter(Boolean),
]);

app.use(cors({
  origin(origin, callback) {
    if (!origin || productionOrigins.has(origin)) {
      return callback(null, true);
    }

    if (
      process.env.NODE_ENV !== "production" &&
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
    ) {
      return callback(null, true);
    }

    return callback(null, false);
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
