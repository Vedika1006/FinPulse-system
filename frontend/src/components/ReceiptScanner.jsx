import { useState, useRef } from "react";
import API from "../api/axios";

export default function ReceiptScanner({ onExtracted }) {
  const [scanning, setScanning] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPreview(URL.createObjectURL(file));
    setScanning(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const { data } = await API.post("/receipts/scan", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      onExtracted(data);
    } catch {
      setError("Could not read receipt. Please fill in manually.");
    } finally {
      setScanning(false);
      e.target.value = "";
    }
  };

  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={scanning}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:bg-white/5 dark:text-app-subtle dark:hover:bg-white/10"
      >
        {scanning ? "Scanning receipt..." : "Scan a receipt"}
      </button>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
        className="hidden"
      />

      {preview ? (
        <img
          src={preview}
          alt="Receipt preview"
          className="mt-2 h-20 w-20 rounded-lg border border-gray-200 object-cover dark:border-white/10"
        />
      ) : null}

      {error ? <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-300">{error}</p> : null}
    </div>
  );
}
