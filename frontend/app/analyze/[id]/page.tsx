import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AnalysisView } from "@/components/veritas/AnalysisView";

export default async function AnalyzePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <div className="mx-auto w-full max-w-6xl px-6 pt-6">
        <Link
          href="/"
          className="text-mute hover:text-text group inline-flex items-center gap-1.5 font-mono text-xs tracking-wide uppercase transition-colors"
        >
          <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
          Back to search
        </Link>
      </div>
      <AnalysisView key={id} analysisId={id} />
    </>
  );
}
