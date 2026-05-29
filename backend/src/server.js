require("dotenv").config();

const path = require("path");
const axios = require("axios");
const cors = require("cors");
const express = require("express");
const FormData = require("form-data");
const helmet = require("helmet");
const JSZip = require("jszip");
const morgan = require("morgan");
const multer = require("multer");

const app = express();

const PORT = Number(process.env.PORT || 5000);
const IMAGE_PROCESSOR_URL = process.env.IMAGE_PROCESSOR_URL || "http://localhost:8000";
const PROCESSOR_TIMEOUT_MS = Number(process.env.PROCESSOR_TIMEOUT_MS || 120000);
const MAX_FILE_SIZE = Number(process.env.MAX_FILE_SIZE || 100 * 1024 * 1024);
const MAX_IMAGES = Number(process.env.MAX_IMAGES || 50);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_IMAGES,
  },
  fileFilter: (_req, file, callback) => {
    if (!file.mimetype || !file.mimetype.startsWith("image/")) {
      callback(new Error("Only image files are allowed"));
      return;
    }

    callback(null, true);
  },
});

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: buildCorsOrigin(), credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

app.get("/health", healthHandler);
app.get("/api/health", healthHandler);

app.post("/api/remove-background", upload.single("image"), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "Upload one image using the image field" });
      return;
    }

    const output = await processImage(req.file, readOptions(req.body));
    const filename = `${cleanStem(req.file.originalname)}_no_bg.jpg`;

    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(output);
  } catch (error) {
    next(error);
  }
});

app.post("/api/remove-background/bulk", upload.array("images", MAX_IMAGES), async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      res.status(400).json({ error: "Upload one or more images using the images field" });
      return;
    }

    const options = readOptions(req.body);
    const zip = new JSZip();

    for (const file of req.files) {
      const output = await processImage(file, options);
      zip.file(`${cleanStem(file.originalname)}_no_bg.jpg`, output);
    }

    const archive = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", 'attachment; filename="background_removed_images.zip"');
    res.send(archive);
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  const status = error.status || error.response?.status || 500;
  const message = extractErrorMessage(error);

  if (error instanceof multer.MulterError) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.status(status >= 400 && status < 600 ? status : 500).json({ error: message });
});

app.listen(PORT, () => {
  console.log(`Backend API running on http://localhost:${PORT}`);
});

async function healthHandler(_req, res) {
  try {
    const processor = await axios.get(`${IMAGE_PROCESSOR_URL}/health`, {
      timeout: 5000,
    });

    res.json({
      status: "ok",
      imageProcessor: processor.data,
    });
  } catch (error) {
    res.status(503).json({
      status: "degraded",
      imageProcessor: "unreachable",
    });
  }
}

async function processImage(file, options) {
  const form = new FormData();
  form.append("image", file.buffer, {
    filename: file.originalname || "image",
    contentType: file.mimetype || "application/octet-stream",
  });
  form.append("background_color", options.backgroundColor);
  form.append("quality", String(options.quality));

  const response = await axios.post(`${IMAGE_PROCESSOR_URL}/remove-background`, form, {
    headers: form.getHeaders(),
    responseType: "arraybuffer",
    timeout: PROCESSOR_TIMEOUT_MS,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });

  return Buffer.from(response.data);
}

function readOptions(body) {
  return {
    backgroundColor: body.background_color || body.backgroundColor || "#ffffff",
    quality: clamp(Number(body.quality || 95), 60, 100),
  };
}

function buildCorsOrigin() {
  const origin = process.env.CORS_ORIGIN;
  if (!origin || origin === "*") {
    return true;
  }

  return origin.split(",").map((entry) => entry.trim()).filter(Boolean);
}

function cleanStem(filename) {
  const stem = path.parse(filename || "image").name;
  return stem.replace(/[^a-z0-9_-]+/gi, "_").replace(/^_+|_+$/g, "") || "image";
}

function clamp(value, min, max) {
  if (Number.isNaN(value)) {
    return max;
  }

  return Math.max(min, Math.min(max, value));
}

function extractErrorMessage(error) {
  const data = error.response?.data;

  if (Buffer.isBuffer(data)) {
    try {
      const parsed = JSON.parse(data.toString("utf8"));
      return parsed.error || parsed.detail || error.message || "Unexpected server error";
    } catch {
      return error.message || "Unexpected server error";
    }
  }

  return data?.error || data?.detail || error.message || "Unexpected server error";
}
