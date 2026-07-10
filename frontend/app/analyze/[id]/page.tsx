import Link from "next/link";
import { AnalysisView } from "@/components/veritas/AnalysisView";

export default async function AnalyzePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <div className="mx-auto w-full max-w-6xl px-6 pt-6">
        <Link
          href="/"
          className="text-mute hover:text-text font-mono text-xs tracking-wide uppercase transition-colors"
        >
          ← Back
        </Link>
      </div>
      <AnalysisView key={id} analysisId={id} />
    </>
  );
}
