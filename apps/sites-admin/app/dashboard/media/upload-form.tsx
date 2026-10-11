"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { uploadMedia, type UploadMediaState } from "../../media-actions";

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const initialState: UploadMediaState = {};

function UploadButton() {
  const { pending } = useFormStatus();
  return <button disabled={pending}>{pending ? "Uploading…" : "Upload image"}</button>;
}

export function UploadMediaForm() {
  const [state, action] = useActionState(uploadMedia, initialState);
  const [clientError, setClientError] = useState("");
  return <form action={action} className="panel" onSubmit={event => {
    const file = new FormData(event.currentTarget).get("image");
    if (file instanceof File && file.size > MAX_UPLOAD_BYTES) {
      event.preventDefault();
      setClientError("Image exceeds the 8 MB limit.");
    }
  }}>
    <h2>Upload image</h2>
    <label>Image (PNG, JPEG, WebP or AVIF; 8 MB maximum)<input type="file" name="image" accept="image/png,image/jpeg,image/webp,image/avif" required onChange={() => setClientError("")} /><small className="field-help">Choose a sharp, well-lit image. Avoid screenshots and text-heavy graphics.</small></label>
    <label>Alt text<input name="altText" maxLength={180} placeholder="Describe the image" /><small className="field-help">Describe what a person would see, for example “Three bottled juices on a wooden counter.”</small></label>
    {(clientError || state.error) && <p className="notice" role="alert">{clientError || state.error}</p>}
    {!clientError && state.success && <p className="notice" role="status">{state.success}</p>}
    <UploadButton />
  </form>;
}
