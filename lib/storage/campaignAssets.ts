import { supabase } from '../supabase';

export type CampaignAssetKind = 'logo' | 'background';

type UploadCampaignAssetInput = {
  file: File;
  businessId: string;
  kind: CampaignAssetKind;
};

type UploadedCampaignAsset = {
  publicUrl: string;
  path: string;
};

type DeleteCampaignAssetResult = {
  managed: boolean;
  deleted: boolean;
  error?: string;
};

const BUCKET_NAME = 'campaign-assets';
const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const BACKGROUND_MAX_BYTES = 6 * 1024 * 1024;
const LOGO_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'svg']);
const BACKGROUND_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp']);
const LOGO_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/svg+xml',
]);
const BACKGROUND_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const MIME_TO_EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};

const getSupabaseOrigin = () => {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
};

const getExtensionFromName = (filename: string) => {
  const parts = filename.toLowerCase().split('.');
  if (parts.length < 2) return '';
  return parts[parts.length - 1];
};

const resolveAllowedRules = (kind: CampaignAssetKind) => {
  if (kind === 'logo') {
    return {
      maxBytes: LOGO_MAX_BYTES,
      allowedExtensions: LOGO_EXTENSIONS,
      allowedMimeTypes: LOGO_MIME_TYPES,
      typeError: 'Logo must be a JPG, PNG, WebP, or SVG file.',
      sizeError: 'Logo must be 2MB or smaller.',
    };
  }
  return {
    maxBytes: BACKGROUND_MAX_BYTES,
    allowedExtensions: BACKGROUND_EXTENSIONS,
    allowedMimeTypes: BACKGROUND_MIME_TYPES,
    typeError: 'Background must be a JPG, PNG, or WebP file.',
    sizeError: 'Background must be 6MB or smaller.',
  };
};

const resolveFileExtension = (kind: CampaignAssetKind, file: File) => {
  const rules = resolveAllowedRules(kind);
  const extensionFromName = getExtensionFromName(file.name);
  if (extensionFromName && rules.allowedExtensions.has(extensionFromName)) {
    return extensionFromName;
  }
  const extensionFromMime = MIME_TO_EXTENSION[file.type];
  if (extensionFromMime && rules.allowedExtensions.has(extensionFromMime)) {
    return extensionFromMime;
  }
  throw new Error(rules.typeError);
};

const validateUploadFile = (kind: CampaignAssetKind, file: File) => {
  const rules = resolveAllowedRules(kind);
  if (file.size > rules.maxBytes) {
    throw new Error(rules.sizeError);
  }

  const extension = getExtensionFromName(file.name);
  const extensionAllowed = Boolean(extension) && rules.allowedExtensions.has(extension);
  const mimeAllowed = Boolean(file.type) && rules.allowedMimeTypes.has(file.type);

  if (!extensionAllowed && !mimeAllowed) {
    throw new Error(rules.typeError);
  }
};

const getManagedCampaignAssetPath = (url: string): string | null => {
  const supabaseOrigin = getSupabaseOrigin();
  if (!supabaseOrigin) return null;

  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.origin !== supabaseOrigin) return null;

    const match = parsedUrl.pathname.match(/^\/storage\/v1\/object\/public\/campaign-assets\/(.+)$/);
    if (!match || !match[1]) return null;

    const decoded = decodeURIComponent(match[1]);
    if (!decoded || decoded.includes('..')) return null;

    return decoded;
  } catch {
    return null;
  }
};

export async function uploadCampaignAsset({
  file,
  businessId,
  kind,
}: UploadCampaignAssetInput): Promise<UploadedCampaignAsset> {
  validateUploadFile(kind, file);
  const extension = resolveFileExtension(kind, file);
  const path = `${businessId}/${kind}/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET_NAME).upload(path, file, {
    upsert: false,
    contentType: file.type || undefined,
  });

  if (uploadError) {
    throw new Error('Unable to upload image right now. Please try again.');
  }

  const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path);
  if (!data.publicUrl) {
    throw new Error('Image uploaded, but public URL could not be resolved.');
  }

  return { publicUrl: data.publicUrl, path };
}

export async function deleteCampaignAssetByUrl(url: string): Promise<DeleteCampaignAssetResult> {
  const managedPath = getManagedCampaignAssetPath(url);
  if (!managedPath) {
    return { managed: false, deleted: false };
  }

  const { error } = await supabase.storage.from(BUCKET_NAME).remove([managedPath]);
  if (error) {
    return {
      managed: true,
      deleted: false,
      error: 'Unable to remove previous image from storage. You can continue editing.',
    };
  }

  return { managed: true, deleted: true };
}
