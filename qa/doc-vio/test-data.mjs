// Synthetic data shared by the HTTP test cases. No real records or credentials.
export const samplePdf = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n");
export const sampleEvidence = {
  fileName: "TEST_evidence.pdf",
  mediaType: "application/pdf",
  contentBase64: samplePdf.toString("base64"),
};
export const violationPayload = (extra = {}) => ({
  facilityId: "CS001",
  type: "TEST_Lối thoát nạn bị chặn",
  severity: "Nghiêm trọng",
  detectedOn: "2026-11-01",
  description: "TEST_VIO: dữ liệu giả lập kiểm thử",
  trackedOfficerId: "CB-A03",
  ...extra,
});
export const suspensionPayload = {
  decisionNumber: "TEST_QD_001",
  reason: "Quyết định đình chỉ giả lập",
  issuedOn: "2026-11-02",
};
export const documentPayload = (extra = {}) => ({
  category_id: "law",
  title: "TEST Văn bản phòng cháy",
  reference_number: "TEST-DOC-001",
  issuing_authority: "Cơ quan giả lập",
  issued_date: "2026-01-01",
  effective_date: "2026-02-01",
  status: "effective",
  file: { name: sampleEvidence.fileName, contentBase64: sampleEvidence.contentBase64 },
  ...extra,
});
