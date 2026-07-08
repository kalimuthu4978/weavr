import { getToken } from "../auth/session";

// Upload an image file, return its URL and name from the server
export async function uploadFile(file: File) {
  const token = getToken();

  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("http://localhost:5000/api/upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Upload failed");
  }

  return data;
}