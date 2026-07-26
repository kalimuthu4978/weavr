import { getToken } from "../auth/session";
import { API_BASE_URL } from "../config";

// What the server sends back for one successfully uploaded file
export type UploadedFile = {
  message: string;
  fileUrl: string;
  fileName: string;
  fileType: string; // "image" | "video" | "file"
};

// Upload a single file, return its URL and name from the server
export async function uploadFile(file: File): Promise<UploadedFile> {
  const token = getToken();

  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/api/upload`, {
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

// The result of trying to upload several files at once.
// Some may succeed while others fail, so we report both.
export type ManyUploadsResult = {
  uploaded: UploadedFile[];
  // One "name: reason" line per file that didn't make it
  failures: string[];
};

// Upload several files. Each one is sent as its own request, because the
// /api/upload route handles a single file at a time.
//
// One bad file shouldn't throw away the good ones, so a failure is collected
// and reported rather than stopping the whole batch.
export async function uploadManyFiles(
  files: File[]
): Promise<ManyUploadsResult> {
  const uploaded: UploadedFile[] = [];
  const failures: string[] = [];

  for (const oneFile of files) {
    try {
      const result = await uploadFile(oneFile);
      uploaded.push(result);
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : "Upload failed";
      failures.push(oneFile.name + ": " + reason);
    }
  }

  return { uploaded: uploaded, failures: failures };
}