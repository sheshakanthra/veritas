import { AnalysisView } from "@/components/veritas/AnalysisView";

export default async function AnalyzePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AnalysisView key={id} analysisId={id} />;
}
