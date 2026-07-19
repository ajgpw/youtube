import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = 8010;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distPath = path.join(__dirname, "../client/dist");

app.use(express.static(distPath));

app.get("*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

app.listen(PORT, () => {
  console.log(`✅ Server running`);
  console.log(`http://localhost:${PORT}`);
});
