import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { supabase } from "./supabase";

export const PHOTO_BUCKET = "waste-photos";

export async function preparePhoto(asset: {
  uri: string;
  width: number;
  height: number;
}) {
  const context = ImageManipulator.manipulate(asset.uri);
  let rendered: Awaited<ReturnType<typeof context.renderAsync>> | undefined;
  try {
    if (Math.max(asset.width, asset.height) > 1280)
      context.resize(
        asset.width >= asset.height ? { width: 1280 } : { height: 1280 },
      );
    rendered = await context.renderAsync();
    const result = await rendered.saveAsync({
      format: SaveFormat.JPEG,
      compress: 0.6,
      base64: true,
    });
    if (!result.base64 || result.base64.length > 1500000)
      throw new Error("ai_image_size");
    return `data:image/jpeg;base64,${result.base64}`;
  } finally {
    rendered?.release();
    context.release();
  }
}

function decodeBase64(base64: string): Uint8Array {
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export async function uploadPhotoIfNeeded(
  photoUrl: string | null,
  organizationId: string,
): Promise<string | null> {
  if (!photoUrl || !supabase) return photoUrl;
  const match = photoUrl.match(
    /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+=*)$/,
  );
  if (!match) return photoUrl;
  const [, contentType, base64] = match;
  const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  const path = `${organizationId}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
  try {
    const bytes = decodeBase64(base64);
    const { error } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(path, bytes, { contentType, upsert: false });
    if (error) return photoUrl;
    const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
    return data.publicUrl || photoUrl;
  } catch {
    return photoUrl;
  }
}
