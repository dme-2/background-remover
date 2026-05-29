import { useMemo, useState } from "react";
import "./styles.css";

const API_URL = (import.meta.env.REACT_APP_API_URL || "http://localhost:5000/api").replace(/\/$/, "");
const MAX_IMAGES = Number(import.meta.env.REACT_APP_MAX_IMAGES || 50);

export default function App() {
  const [files, setFiles] = useState([]);
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");
  const [quality, setQuality] = useState(95);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resultUrl, setResultUrl] = useState("");
  const [downloadName, setDownloadName] = useState("background_removed.jpg");

  const previewUrl = useMemo(() => {
    if (files.length !== 1) {
      return "";
    }

    return URL.createObjectURL(files[0]);
  }, [files]);

  function selectFiles(nextFiles) {
    const images = Array.from(nextFiles)
      .filter((file) => file.type.startsWith("image/"))
      .slice(0, MAX_IMAGES);

    setFiles(images);
    setError("");
    setResultUrl("");
  }

  async function processImages() {
    if (files.length === 0) {
      setError("Select at least one image.");
      return;
    }

    setBusy(true);
    setError("");
    setResultUrl("");

    try {
      const form = new FormData();
      form.append("background_color", backgroundColor);
      form.append("quality", String(quality));

      const endpoint = files.length === 1 ? "remove-background" : "remove-background/bulk";
      const field = files.length === 1 ? "image" : "images";
      files.forEach((file) => form.append(field, file));

      const response = await fetch(`${API_URL}/${endpoint}`, {
        method: "POST",
        body: form,
      });

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      const blob = await response.blob();
      setResultUrl(URL.createObjectURL(blob));
      setDownloadName(files.length === 1 ? `${fileStem(files[0].name)}_no_bg.jpg` : "background_removed_images.zip");
    } catch (err) {
      setError(err.message || "Processing failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="shell">
      <section className="workspace">
        <aside className="panel">
          <div
            className="dropzone"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              selectFiles(event.dataTransfer.files);
            }}
          >
            <input
              id="images"
              type="file"
              accept="image/*"
              multiple
              onChange={(event) => selectFiles(event.target.files)}
            />
            <label htmlFor="images">Choose Images</label>
            <span>{files.length ? `${files.length} selected` : "Drop JPG, PNG, WebP, BMP"}</span>
          </div>

          <label className="field">
            <span>JPG background</span>
            <input type="color" value={backgroundColor} onChange={(event) => setBackgroundColor(event.target.value)} />
          </label>

          <label className="field">
            <span>JPG quality: {quality}</span>
            <input
              type="range"
              min="60"
              max="100"
              value={quality}
              onChange={(event) => setQuality(Number(event.target.value))}
            />
          </label>

          <button className="primary" type="button" disabled={busy || files.length === 0} onClick={processImages}>
            {busy ? "Processing..." : files.length > 1 ? "Process Batch" : "Remove Background"}
          </button>

          {resultUrl && (
            <a className="download" href={resultUrl} download={downloadName}>
              Download Result
            </a>
          )}

          {error && <p className="error">{error}</p>}
        </aside>

        <section className="preview-grid">
          <div className="preview">
            <header>Original</header>
            {previewUrl ? <img src={previewUrl} alt="Original preview" /> : <div className="placeholder">No single image selected</div>}
          </div>

          <div className="preview">
            <header>Processed JPG</header>
            {resultUrl && files.length === 1 ? (
              <img src={resultUrl} alt="Processed preview" />
            ) : (
              <div className="placeholder">{files.length > 1 ? "Batch output downloads as ZIP" : "No result yet"}</div>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}

async function readError(response) {
  try {
    const data = await response.json();
    return data.error || data.detail || response.statusText;
  } catch {
    return response.statusText;
  }
}

function fileStem(name) {
  return name.replace(/\.[^/.]+$/, "").replace(/[^a-z0-9_-]+/gi, "_") || "image";
}
