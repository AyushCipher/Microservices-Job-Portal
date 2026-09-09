import express from "express";
import dotenv from "dotenv";
import routes from "./routes.js";
import cors from "cors";
import { v2 as cloudinary } from "cloudinary";
import { startSendMailConsumer } from "./consumer.js";
import { rateLimiter } from "./utils/redisClient.js";
import {
  createHealthHandler,
  createLogger,
  createMetrics,
  createRequestLogger,
} from "@hireheaven/common";

dotenv.config();

startSendMailConsumer();

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

const SERVICE_NAME = "utils-service";

const logger = createLogger(SERVICE_NAME);
const { metricsMiddleware, metricsHandler } = createMetrics(SERVICE_NAME);

const app = express();
app.use(cors());

// This middleware is used to parse incoming requests with JSON payloads
app.use(express.json({ limit: "50mb" }));

// This middleware is used to parse incoming requests with urlencoded payloads& executes when a client sends data using the traditional HTML form formatting, accompanied by the HTTP header Content-Type: application/x-www-form-urlencoded.
// The limit option specifies the maximum size of the request body that the server will accept. In this case, it is set to 50 megabytes. 
// The extended option allows for rich objects and arrays to be encoded into the URL-encoded format, which can be useful for complex data structures.
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.use(createRequestLogger(logger));
app.use(metricsMiddleware);

app.use(
  rateLimiter({ windowSeconds: 60, maxRequests: 60, prefix: "utils-global" })
);

app.get("/health", createHealthHandler(SERVICE_NAME));
app.get("/metrics", metricsHandler);

app.use("/api/utils", routes);

app.listen(process.env.PORT, () => {
  logger.info(
    `Utils Service is running on http://localhost:${process.env.PORT}`
  );
});