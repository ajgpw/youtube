// ./routes2/base64-ytimg.js
import express from "express";
import fetch from "node-fetch";

const router = express.Router();

router.get("/yt-img", async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).send("Missing id");

  try {
    const imgUrl = `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
    const response = await fetch(imgUrl);
    if (!response.ok) throw new Error("Failed to fetch image");

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer); // ArrayBuffer → Buffer
    const base64 = buffer.toString("base64"); // Buffer → Base64文字列

    res.json(`${base64}`);
  } catch (e) {
    console.error(e);
    res.status(500).send("Error fetching image");
  }
});

export default router;