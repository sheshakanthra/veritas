import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ReliabilityChart } from "@/components/veritas/ReliabilityChart";
import { fetchCalibrationReport } from "@/lib/calibration-api";

export default async function CalibrationPage() {
  const report = await fetchCalibrationReport();

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-text font-mono text-2xl font-bold tracking-tight">Calibration</h1>
        <p className="text-mute max-w-2xl font-sans text-base leading-relaxed">
          VERITAS never asks the model how confident it is - LLM self-reported percentages are
          badly calibrated. Confidence is instead derived from measurable evidence features (source
          count, source tier, agreement ratio, topical similarity) via a small logistic function.
          This page reports how well those derived confidences track empirical accuracy over a
          labelled fixture set.
        </p>
        <Dialog>
          <DialogTrigger className="text-signal w-fit font-mono text-sm underline underline-offset-2 hover:no-underline">
            How is confidence computed?
          </DialogTrigger>
          <DialogContent className="border-line bg-panel rounded-overlay font-mono">
            <DialogTitle className="text-text">How confidence is computed</DialogTitle>
            <DialogDescription className="text-mute font-sans leading-relaxed">
              confidence = sigmoid(1.1 · evidence_count_norm + 1.6 · tier1_fraction + 1.8 ·
              agreement_ratio + 0.9 · mean_similarity − 2.4). Agreement between sources and the
              presence of tier-1 sourcing move confidence the most; raw evidence count saturates
              past 8 sources; topical similarity alone moves it least, since evidence can be
              on-topic and still contradict the claim. See backend/app/graph/nodes/calibration.py
              for the exact weights and rationale.
            </DialogDescription>
          </DialogContent>
        </Dialog>
      </header>

      {report.total_samples === 0 ? (
        <p className="text-mute font-mono text-sm">No labelled examples available yet.</p>
      ) : (
        <>
          <div className="border-line rounded-overlay border p-4">
            <ReliabilityChart bins={report.bins} />
          </div>

          <dl className="text-mute flex flex-wrap gap-x-8 gap-y-2 font-mono text-sm">
            <div className="flex gap-2">
              <dt>Samples</dt>
              <dd className="text-text tabular-nums">{report.total_samples}</dd>
            </div>
            <div className="flex gap-2">
              <dt>Expected calibration error</dt>
              <dd className="text-text tabular-nums">{report.expected_calibration_error.toFixed(3)}</dd>
            </div>
          </dl>

          <p className="text-mute font-mono text-xs uppercase tracking-wide">{report.note}</p>
        </>
      )}
    </main>
  );
}
