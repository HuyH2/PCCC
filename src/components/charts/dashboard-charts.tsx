"use client";

import * as React from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
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

/** UC-SYS-02 — Cơ sở theo khu vực, dữ liệu thật đã lọc theo phạm vi */
export function BieuDoCoSoTheoKhuVuc({
  data,
}: {
  data: { regionName: string; facilityCount: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 36 + 24)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 12, left: 4, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
        <XAxis type="number" tickLine={false} axisLine={false} tick={truc} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="regionName"
          tickLine={false}
          axisLine={false}
          tick={truc}
          width={120}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: "var(--accent)" }}
          formatter={(value: number) => [formatNumber(value), "Cơ sở"]}
        />
        <Bar dataKey="facilityCount" name="Cơ sở" fill="var(--chart-1)" radius={[0, 4, 4, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}
