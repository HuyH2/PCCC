"use client";

export const acceptedPlanningFiles = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";

export async function planningFilePayload(file: File | null) {
  if (!file || file.size === 0) return undefined;
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Không thể đọc tệp đã chọn."));
    reader.readAsDataURL(file);
  });
  const separator = dataUrl.indexOf(",");
  if (separator < 0) throw new Error("Tệp đính kèm không hợp lệ.");
  return {
    name: file.name,
    content_type: file.type,
    content_base64: dataUrl.slice(separator + 1),
  };
}
