const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export async function uploadFile(file, token) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_URL}/api/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Upload failed");
  }

  return res.json();
}

export function getFileUrl(url) {
  return url;
}
