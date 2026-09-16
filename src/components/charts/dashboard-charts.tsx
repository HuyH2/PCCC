"use client";

import * as React from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import { formatNumber } from "@/lib/utils";

const truc = {
  fontSize: 12,
  fill: "var(--muted-foreground)",
};

const tooltipStyle = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  fontSize: "12px",
  color: "var(--popover-foreground)",
  boxShadow: "0 4px 14px rgb(0 0 0 / 0.08)",
} as const;

/** R09 — Sự cố theo tháng, tách theo loại */
export function BieuDoSuCo({
  data,
}: {
  data: { thang: string; chay: number; no: number; cnch: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
        <defs>
          <linearGradient id="gChay" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.55} />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.04} />
          </linearGradient>
          <linearGradient id="gCnch" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-3)" stopOpacity={0.45} />
            <stop offset="100%" stopColor="var(--chart-3)" stopOpacity={0.04} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="thang" tickLine={false} axisLine={false} tick={truc} />
        <YAxis tickLine={false} axisLine={false} tick={truc} allowDecimals={false} width={44} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "var(--border)" }} />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
        <Area type="monotone" dataKey="chay" name="Cháy" stroke="var(--chart-1)" fill="url(#gChay)" strokeWidth={2} />
        <Area type="monotone" dataKey="cnch" name="CNCH / Y tế" stroke="var(--chart-3)" fill="url(#gCnch)" strokeWidth={2} />
        <Line type="monotone" dataKey="no" name="Nổ" stroke="var(--chart-5)" strokeWidth={2} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** R04 — Chỉ tiêu kiểm tra so với thực hiện */
export function BieuDoTienDoKiemTra({
  data,
}: {
  data: { thang: string; chiTieu: number; thucHien: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -22, bottom: 0 }} barGap={4}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="thang" tickLine={false} axisLine={false} tick={truc} />
        <YAxis tickLine={false} axisLine={false} tick={truc} allowDecimals={false} width={44} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--accent)" }} />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
        <Bar dataKey="chiTieu" name="Chỉ tiêu" fill="var(--muted-foreground)" radius={[4, 4, 0, 0]} maxBarSize={22} opacity={0.35} />
        <Bar dataKey="thucHien" name="Đã thực hiện" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}

const mauLoaiHinh = [
  "var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)",
];

/** R01 — Cơ cấu cơ sở theo loại hình */
export function BieuDoLoaiHinh({ data }: { data: { ten: string; soLuong: number }[] }) {
  const top = data.slice(0, 5);
  const khac = data.slice(5).reduce((s, d) => s + d.soLuong, 0);
  const dataVe = khac > 0 ? [...top, { ten: "Loại hình khác", soLuong: khac }] : top;

  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row">
      <ResponsiveContainer width="100%" height={200} className="max-w-[210px]">
        <PieChart>
          <Pie
            data={dataVe}
            dataKey="soLuong"
            nameKey="ten"
            innerRadius={48}
            outerRadius={78}
            paddingAngle={2}
            stroke="var(--background)"
            strokeWidth={2}
          >
            {dataVe.map((_, i) => (
              <Cell key={i} fill={mauLoaiHinh[i % mauLoaiHinh.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
        </PieChart>
      </ResponsiveContainer>
      <ul className="w-full min-w-0 flex-1 space-y-1.5">
        {dataVe.map((d, i) => (
          <li key={d.ten} className="flex items-center gap-2 text-[13px]">
            <span
              className="size-2.5 shrink-0 rounded-[3px]"
              style={{ background: mauLoaiHinh[i % mauLoaiHinh.length] }}
            />
            <span className="min-w-0 flex-1 truncate">{d.ten}</span>
            <span className="font-semibold tabular-nums">{formatNumber(d.soLuong)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** R01 — Cơ sở theo phường */
export function BieuDoTheoPhuong({
  data,
}: {
  data: { ten: string; hoatDong: number; viPham: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 12, left: 4, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
        <XAxis type="number" tickLine={false} axisLine={false} tick={truc} allowDecimals={false} />
        <YAxis type="category" dataKey="ten" tickLine={false} axisLine={false} tick={truc} width={76} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--accent)" }} />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 4 }} />
        <Bar dataKey="hoatDong" name="Đang hoạt động" stackId="a" fill="var(--chart-4)" radius={[0, 0, 0, 0]} maxBarSize={26} />
        <Bar dataKey="viPham" name="Đình chỉ/không phép/tạm ngừng" stackId="a" fill="var(--chart-1)" radius={[0, 4, 4, 0]} maxBarSize={26} />
      </BarChart>
    </ResponsiveContainer>
  );
}
