import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { apiRouter } from "./server/apiRouter.ts";
import { setupLiveWebSocket } from "./server/liveWebSocket.ts";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: "50mb" }));
app.use("/api", apiRouter);

// Serve static assets from dist
const distPath = path.join(__dirname, "dist");
app.use(express.static(distPath));

app.get("*", (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

const server = createServer(app);
setupLiveWebSocket(server);

server.listen(port, () => {
  console.log(`Mindful Orator server running on port ${port}`);
});
