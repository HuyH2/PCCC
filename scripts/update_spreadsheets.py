import sys, os, re
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

sys.stdout.reconfigure(encoding='utf-8')

header_fill = PatternFill(start_color="1F4E78", end_color="1F4E78", fill_type="solid")
header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
title_font = Font(name="Calibri", size=14, bold=True, color="1F4E78")
bold_font = Font(name="Calibri", size=11, bold=True)
regular_font = Font(name="Calibri", size=10)

pass_fill = PatternFill(start_color="C6EFCE", end_color="C6EFCE", fill_type="solid")
pass_font = Font(name="Calibri", size=10, bold=True, color="006100")

notrun_fill = PatternFill(start_color="FFEB9C", end_color="FFEB9C", fill_type="solid")
notrun_font = Font(name="Calibri", size=10, bold=True, color="9C6500")

mock_fill = PatternFill(start_color="FCE4D6", end_color="FCE4D6", fill_type="solid")
mock_font = Font(name="Calibri", size=10, bold=True, color="C65911")

unimpl_fill = PatternFill(start_color="EDEDED", end_color="EDEDED", fill_type="solid")
unimpl_font = Font(name="Calibri", size=10, bold=True, color="7F7F7F")

thin_border = Border(
    left=Side(style='thin', color='D9D9D9'),
    right=Side(style='thin', color='D9D9D9'),
    top=Side(style='thin', color='D9D9D9'),
    bottom=Side(style='thin', color='D9D9D9')
)

print("Starting Excel v2.0 updates...")

# ==============================================================================
# 1. UPDATE Test_Plan_Test_Cases_PCCC.xlsx
# ==============================================================================
wb_tp = openpyxl.load_workbook('Test_Plan_Test_Cases_PCCC.xlsx')

# 1.1 Sheet 'Test Plan'
if 'Test Plan' in wb_tp.sheetnames:
    ws_tp_plan = wb_tp['Test Plan']
    ws_tp_plan.cell(2, 1).value = "Phiên bản 2.0 | 09/11/2026 | Người tổng hợp: QA Lead / Business Analyst (chuẩn hóa toàn hệ thống 56 UCs, đối soát từ mã nguồn và test suite mới)."

# 1.2 Sheet 'Test Cases' (Base 64 TCs)
if 'Test Cases' in wb_tp.sheetnames:
    ws_tp_cases = wb_tp['Test Cases']
    ws_tp_cases.cell(2, 1).value = "Tổng số: 64 Base Test Cases (54 PASS, 0 FAIL, 10 NOT RUN) | Đợt kiểm thử 09/11/2026"
    for r in range(5, ws_tp_cases.max_row + 1):
        c1 = ws_tp_cases.cell(r, 1).value
        # Rename TC-WRK-02-02 -> TC-WRK-03-01
        if c1 == 'TC-WRK-02-02':
            ws_tp_cases.cell(r, 1).value = 'TC-WRK-03-01'
            ws_tp_cases.cell(r, 4).value = 'Cập nhật tiến độ task (0..100%) và ghi chú lịch sử'
            ws_tp_cases.cell(r, 8).value = "PASS"
            ws_tp_cases.cell(r, 8).fill = pass_fill
            ws_tp_cases.cell(r, 8).font = pass_font
            ws_tp_cases.cell(r, 9).value = "m07-e2e.test.js; task-messages.test.js"
            ws_tp_cases.cell(r, 10).value = "Khớp mã M07_WRK; đã chạy test tự động"
        elif c1 == 'TC-WRK-02-01':
            ws_tp_cases.cell(r, 8).value = "PASS"
            ws_tp_cases.cell(r, 8).fill = pass_fill
            ws_tp_cases.cell(r, 8).font = pass_font
            ws_tp_cases.cell(r, 9).value = "m07-e2e.test.js; work-kpi.test.js"

# 1.3 Sheet 'Tóm tắt kết quả'
if 'Tóm tắt kết quả' in wb_tp.sheetnames:
    ws_tp_sum = wb_tp['Tóm tắt kết quả']
    ws_tp_sum.cell(2, 1).value = "Bảng Tổng hợp Kết quả Thực thi Base Test Cases Toàn hệ thống (v2.0 - 09/11/2026)"
    for r in range(4, ws_tp_sum.max_row + 1):
        if ws_tp_sum.cell(r, 1).value and 'TC-WRK' in str(ws_tp_sum.cell(r, 1).value):
            ws_tp_sum.cell(r, 2).value = 4
            ws_tp_sum.cell(r, 3).value = 4
            ws_tp_sum.cell(r, 4).value = 0
            ws_tp_sum.cell(r, 5).value = 0
            ws_tp_sum.cell(r, 6).value = 0
        elif ws_tp_sum.cell(r, 1).value and 'TỔNG CỘNG' in str(ws_tp_sum.cell(r, 1).value):
            ws_tp_sum.cell(r, 2).value = 64
            ws_tp_sum.cell(r, 3).value = 54
            ws_tp_sum.cell(r, 4).value = 10
            ws_tp_sum.cell(r, 5).value = 0
            ws_tp_sum.cell(r, 6).value = 0

# 1.4 Sheet 'M07_WRK' (Detailed 59 TCs for M07)
if 'M07_WRK' in wb_tp.sheetnames:
    del wb_tp['M07_WRK']

ws_m07 = wb_tp.create_sheet(title='M07_WRK')
ws_m07.views.sheetView[0].showGridLines = True

ws_m07.merge_cells("A1:M1")
ws_m07.cell(1, 1).value = "Hồ sơ Kiểm thử Chi tiết Phân hệ M07: Lịch công tác – Giao việc – Tiến độ – KPI – Giải trình – Trao đổi"
ws_m07.cell(1, 1).font = title_font

ws_m07.merge_cells("A2:M2")
ws_m07.cell(2, 1).value = "Tổng số: 59 Test Cases (51 PASS, 0 FAIL, 8 NOT RUN) | Thực thi thực tế ngày 09/11/2026 trên Node.js v24.13.0 & SQLite"
ws_m07.cell(2, 1).font = Font(name="Calibri", size=10, italic=True)

headers_m07 = [
    "TC ID", "Nhóm", "UC ID", "Mô tả Test Case", "Tiền điều kiện",
    "Dữ liệu test", "Bước thực hiện", "Kết quả mong đợi", "Mức ưu tiên",
    "Loại kiểm thử", "Trạng thái", "File test / Bằng chứng", "Ghi chú"
]

for col_idx, h in enumerate(headers_m07, start=1):
    cell = ws_m07.cell(4, col_idx, h)
    cell.fill = header_fill
    cell.font = header_font
    cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

# Parse from docs/M07_Test_Cases_WRK.md
row_idx = 5
with open("docs/M07_Test_Cases_WRK.md", "r", encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if line.startswith("| **TC-WRK-"):
            parts = [p.strip() for p in line.split("|")[1:-1]]
            if len(parts) >= 13:
                tc_id = parts[0].replace("**", "")
                group = parts[1]
                uc_id = parts[2]
                desc = parts[3]
                pre = parts[4]
                data = parts[5]
                steps = parts[6]
                expected = parts[7]
                priority = parts[8]
                tc_type = parts[9]
                status = parts[10].replace("**", "")
                evidence = parts[11]
                notes = parts[12]

                vals = [tc_id, group, uc_id, desc, pre, data, steps, expected, priority, tc_type, status, evidence, notes]
                for c_idx, val in enumerate(vals, start=1):
                    cell = ws_m07.cell(row_idx, c_idx, val)
                    cell.font = regular_font
                    cell.border = thin_border
                    if c_idx in [1, 2, 3, 9, 10, 11]:
                        cell.alignment = Alignment(horizontal="center", vertical="center")
                    else:
                        cell.alignment = Alignment(vertical="center", wrap_text=True)

                    if c_idx == 11:
                        if status == 'PASS':
                            cell.fill = pass_fill
                            cell.font = pass_font
                        else:
                            cell.fill = notrun_fill
                            cell.font = notrun_font
                row_idx += 1

print(f"M07_WRK sheet populated with {row_idx - 5} Test Cases.")

col_widths_m07 = {
    1: 18, 2: 10, 3: 14, 4: 35, 5: 25, 6: 25, 7: 35,
    8: 35, 9: 10, 10: 14, 11: 12, 12: 25, 13: 25
}
for c, w in col_widths_m07.items():
    ws_m07.column_dimensions[get_column_letter(c)].width = w

wb_tp.save('Test_Plan_Test_Cases_PCCC.xlsx')
print("Test_Plan_Test_Cases_PCCC.xlsx updated successfully!")

# ==============================================================================
# 2. UPDATE Requirements_Traceability_Matrix.xlsx
# ==============================================================================
wb_rtm = openpyxl.load_workbook('Requirements_Traceability_Matrix.xlsx')

# 2.1 Sheet 'RTM'
if 'RTM' in wb_rtm.sheetnames:
    ws_rtm = wb_rtm['RTM']
    ws_rtm.cell(2, 1).value = "Phiên bản 2.0 | Cập nhật: 09/11/2026 | Chuẩn hóa 56 Use Cases toàn hệ thống (28 Đầy đủ, 8 Chưa test đủ, 13 Một phần/Mock, 7 Chưa làm GĐ1)"
    
    for r in range(5, ws_rtm.max_row + 1):
        uc = ws_rtm.cell(r, 2).value
        if uc == 'UC-ADM-01':
            ws_rtm.cell(r, 12).value = "Session HttpOnly, scrypt (node:crypto)"
        elif uc == 'UC-WRK-03':
            ws_rtm.cell(r, 8).value = "TC-WRK-03-01..07"
        elif uc == 'UC-WRK-05':
            # Downgrade to Chưa test (đã triển khai)
            ws_rtm.cell(r, 9).value = "PASS 5, NOT RUN 3"
            c10 = ws_rtm.cell(r, 10)
            c10.value = "Chưa test (đã triển khai)"
            c10.fill = notrun_fill
            c10.font = notrun_font
            ws_rtm.cell(r, 11).value = "R-03, BUG-WRK-001 (GD2)"
            ws_rtm.cell(r, 12).value = "Đã triển khai API và UI giải trình; còn 3 TC NOT RUN (từ chối giải trình, phân quyền, upload file GĐ2 cần xác nhận BA/PO) nên chưa đạt 'Đầy đủ + có test'"

# 2.2 Sheet 'Tổng hợp & Module'
if 'Tổng hợp & Module' in wb_rtm.sheetnames:
    ws_sum = wb_rtm['Tổng hợp & Module']
    ws_sum.cell(2, 1).value = "Bảng Tổng hợp Tiến độ 56 Use Cases theo 11 Phân hệ Nghiệp vụ (v2.0 - 09/11/2026)"
    
    for r in range(4, ws_sum.max_row + 1):
        m_val = str(ws_sum.cell(r, 1).value or '')
        if 'M07' in m_val:
            ws_sum.cell(r, 3).value = 5  # Đầy đủ + có test
            ws_sum.cell(r, 4).value = 1  # Chưa test / một phần
            ws_sum.cell(r, 5).value = 0  # Một phần / Mock
            ws_sum.cell(r, 6).value = 0  # Chưa triển khai
        elif 'TỔNG CỘNG' in m_val:
            ws_sum.cell(r, 3).value = 28 # 29 -> 28
            ws_sum.cell(r, 4).value = 8  # 7 -> 8
            ws_sum.cell(r, 5).value = 13
            ws_sum.cell(r, 6).value = 7

# 2.3 Sheet 'Bug & Rủi ro'
if 'Bug & Rủi ro' in wb_rtm.sheetnames:
    ws_risk = wb_rtm['Bug & Rủi ro']
    for r in range(4, ws_risk.max_row + 1):
        r_code = str(ws_risk.cell(r, 1).value or '')
        if r_code == 'R-01':
            ws_risk.cell(r, 3).value = "7 UC chưa triển khai (ngoài phạm vi GĐ1): UC-FAC-07, UC-RPT-04..06, UC-INC-03, UC-SYS-04, UC-SYS-08."
        elif r_code == 'R-03':
            ws_risk.cell(r, 3).value = "8 UC đã có code nhưng chưa có TC PASS (hoặc chưa test đủ): FAC-05, FAC-08, VIO-04, VIO-05, INS-02..04, WRK-05."
        elif r_code == 'R-09':
            ws_risk.cell(r, 3).value = "Phân rã M07 thành 6 UC (WRK-01..06) và quy mô 56 UC toàn hệ thống là giả định thiết kế kiến trúc kỹ thuật của nhóm dev từ mã nguồn, chưa đối chiếu chính thức 1-1 với file URD .docx gốc của chủ đầu tư."
            ws_risk.cell(r, 4).value = "Kiến nghị Product Owner / BA ký duyệt chính thức bảng phân rã 56 Use Cases trước giai đoạn nghiệm thu diện rộng."

# 2.4 Sheet 'Chú giải Trạng thái'
if 'Chú giải Trạng thái' in wb_rtm.sheetnames:
    ws_notes = wb_rtm['Chú giải Trạng thái']
    ws_notes.cell(2, 2).value = "Đã triển khai đầy đủ và MỌI Test Case của UC đều PASS (tự động hoặc thủ công). Hiện có 28 UC đạt trạng thái này."
    ws_notes.cell(3, 2).value = "Đã triển khai backend/API nhưng chưa có TC, TC mới ở trạng thái NOT RUN, hoặc TC mới chỉ phủ một phần UC. Hiện có 8 UC (bao gồm WRK-05)."

wb_rtm.save('Requirements_Traceability_Matrix.xlsx')
print("Requirements_Traceability_Matrix.xlsx updated successfully!")
