import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { CoSoForm } from "@/components/forms/co-so-form";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { coSoList, coSoTheoId } from "@/data/mock";

export function generateStaticParams() {
  return coSoList.slice(0, 60).map((c) => ({ id: c.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cs = coSoTheoId.get(id);
  return { title: cs ? `Cập nhật ${cs.ten}` : "Không tìm thấy cơ sở" };
}

export default async function TrangSuaCoSo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cs = coSoTheoId.get(id);
  if (!cs) notFound();

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href={`/co-so/${cs.id}`}>
          <ArrowLeft />
          Hồ sơ cơ sở
        </Link>
      </Button>

      <PageHeader
        title="Cập nhật hồ sơ cơ sở"
        description={`${cs.ma} · ${cs.ten}`}
        module="M03"
        useCases={["UC-FAC-02", "UC-FAC-08"]}
      />

      <CoSoForm coSo={cs} />
    </div>
  );
}
