import express from "express";
import bodyParser from "body-parser";
import { lineRouter, lineMiddleware } from "./routes/line";
import { apiRouter } from "./routes/api";
import { env } from "./utils/env";

const app = express();
app.use("/liff", express.static("src/liff"));
app.use("/webhook", lineMiddleware, lineRouter);
app.use("/api", bodyParser.json(), apiRouter);
app.get("/health", (req, res) => res.send("OK"));

const port = Number(process.env.PORT || env.PORT);
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
