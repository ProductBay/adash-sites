"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { MediaKind } from "@prisma/client";
import { prisma } from "@adash/site-core";
import { localStorage, mediaReferences, mediaUrl, newStorageKey, optimizeUpload } from "@adash/site-core/media";
import { dashboardContext as context, audit } from "./context";

async function secure(permission: "brand.update" | "product.update" | "content.update" | "media.manage") {
  const h = await headers();
  if (!h.get("origin") || new URL(h.get("origin")!).host !== h.get("host")) throw new Error("Invalid request origin");
  return context(permission);
}
const field = (form: FormData, name: string) => String(form.get(name) ?? "").trim();

export async function uploadMedia(form: FormData) {
  const { tenant, principal } = await secure("media.manage");
  const file = form.get("image");
  if (!(file instanceof File)) throw new Error("Choose an image");
  if (file.size > 8 * 1024 * 1024) throw new Error("Image exceeds 8 MB");
  const processed = await optimizeUpload(Buffer.from(await file.arrayBuffer()), file.type);
  const kind = Object.values(MediaKind).includes(field(form, "kind") as MediaKind) ? field(form, "kind") as MediaKind : MediaKind.IMAGE;
  const storageKey = newStorageKey(tenant.id);
  await localStorage.put(storageKey, processed.body);
  try {
    const asset = await prisma.mediaAsset.create({ data: { tenantId: tenant.id, uploadedByUserId: principal.userId, kind, storageKey, mimeType: processed.mimeType, originalFilename: file.name.replace(/[\\/\x00-\x1f]/g, "_").slice(0, 180), sizeBytes: processed.body.length, width: processed.width, height: processed.height, altText: field(form, "altText").slice(0, 180) } });
    await audit(tenant.id, principal.userId, "media.uploaded", "MediaAsset", asset.id);
  } catch (error) { await localStorage.delete(storageKey); throw error; }
  revalidatePath("/dashboard/media");
}
export async function updateMediaAlt(form: FormData) {
  const { tenant, principal } = await secure("media.manage");
  const id = field(form, "id");
  const result = await prisma.mediaAsset.updateMany({ where: { id, tenantId: tenant.id }, data: { altText: field(form, "altText").slice(0, 180) } });
  if (!result.count) notFound();
  await audit(tenant.id, principal.userId, "media.alt_updated", "MediaAsset", id);
  revalidatePath("/dashboard/media");
}
export async function deleteMedia(form: FormData) {
  const { tenant, principal } = await secure("media.manage");
  if (field(form, "confirm") !== "DELETE") throw new Error("Confirm deletion");
  const id = field(form, "id");
  const asset = await prisma.mediaAsset.findFirst({ where: { id, tenantId: tenant.id } });
  if (!asset) notFound();
  const refs = await mediaReferences(tenant.id, id);
  if (refs.products || refs.brand || refs.content) throw new Error("Asset is in use; remove its associations first");
  await prisma.mediaAsset.delete({ where: { id: asset.id } });
  await localStorage.delete(asset.storageKey).catch(() => {});
  await audit(tenant.id, principal.userId, "media.deleted", "MediaAsset", id);
  revalidatePath("/dashboard/media");
}
export async function attachProductMedia(form: FormData) {
  const { tenant, principal } = await secure("product.update");
  const productId = field(form, "productId"), mediaAssetId = field(form, "mediaAssetId");
  const [product, asset] = await Promise.all([prisma.product.findFirst({ where: { tenantId: tenant.id, id: productId } }), prisma.mediaAsset.findFirst({ where: { tenantId: tenant.id, id: mediaAssetId } })]);
  if (!product || !asset) notFound();
  await prisma.productImage.create({ data: { tenantId: tenant.id, productId, mediaAssetId, url: mediaUrl(asset.id), altText: asset.altText || product.name, sortOrder: await prisma.productImage.count({ where: { tenantId: tenant.id, productId } }) } });
  await audit(tenant.id, principal.userId, "product.image_added", "Product", productId);
  revalidatePath(`/dashboard/products/${productId}`);
}
export async function detachProductMedia(form: FormData) {
  const { tenant, principal } = await secure("product.update");
  const id = field(form, "id"), productId = field(form, "productId");
  const result = await prisma.productImage.deleteMany({ where: { id, productId, tenantId: tenant.id } });
  if (!result.count) notFound();
  await audit(tenant.id, principal.userId, "product.image_removed", "ProductImage", id);
  revalidatePath(`/dashboard/products/${productId}`);
}
export async function updateProductImage(form: FormData) {
  const { tenant, principal } = await secure("product.update");
  const id = field(form, "id"), productId = field(form, "productId");
  const image = await prisma.productImage.findFirst({ where: { tenantId: tenant.id, id, productId } });
  if (!image) notFound();
  const sortOrder = Number(field(form, "sortOrder"));
  if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 1000) throw new Error("Invalid image order");
  const altText = field(form, "altText");
  if (!altText || altText.length > 180) throw new Error("Alt text is required");
  await prisma.$transaction(async tx => {
    if (form.get("isPrimary") === "on") await tx.productImage.updateMany({ where: { tenantId: tenant.id, productId }, data: { isPrimary: false } });
    await tx.productImage.update({ where: { id }, data: { altText, sortOrder, isPrimary: form.get("isPrimary") === "on" } });
  });
  await audit(tenant.id, principal.userId, "product.image_updated", "ProductImage", id);
  revalidatePath(`/dashboard/products/${productId}`);
}
export async function setBrandMedia(form: FormData) {
  const { tenant, principal } = await secure("brand.update");
  const slot = field(form, "slot");
  if (slot !== "logo" && slot !== "icon") throw new Error("Invalid slot");
  const id = field(form, "mediaAssetId");
  const asset = id ? await prisma.mediaAsset.findFirst({ where: { tenantId: tenant.id, id } }) : null;
  if (id && !asset) notFound();
  await prisma.brandConfiguration.update({ where: { tenantId: tenant.id }, data: slot === "logo" ? { logoMediaId: asset?.id ?? null, logoUrl: asset ? mediaUrl(asset.id) : null } : { iconMediaId: asset?.id ?? null, iconUrl: asset ? mediaUrl(asset.id) : null } });
  await audit(tenant.id, principal.userId, "brand.media_changed", "BrandConfiguration", undefined, { slot, mediaAssetId: asset?.id ?? null });
  revalidatePath("/dashboard/brand");
}
