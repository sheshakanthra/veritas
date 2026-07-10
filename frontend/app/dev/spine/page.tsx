import { Spine } from "@/components/spine/Spine";
import { VerdictBadge } from "@/components/veritas/VerdictBadge";
import {
  SUPPORTED_FIXTURE,
  REFUTED_FIXTURE,
  MISLEADING_CONTEXT_FIXTURE,
  UNVERIFIABLE_FIXTURE,
  FOUR_VERDICTS_FIXTURE,
} from "@/lib/fixtures";
import type { AnalysisResult } from "@/lib/types";

const FIXTURES: { label: string; data: AnalysisResult }[] = [
  { label: "SUPPORTED", data: SUPPORTED_FIXTURE },
  { label: "REFUTED", data: REFUTED_FIXTURE },
  { label: "MISLEADING_CONTEXT", data: MISLEADING_CONTEXT_FIXTURE },
  { label: "UNVERIFIABLE", data: UNVERIFIABLE_FIXTURE },
];

/**
 * Static preview of all four verdict shapes side by side, plus a mixed
 * multi-claim spine - the visual QA surface for build order phase 7
 * ("get the visual right before it moves"). Not linked from the product
 * nav; reachable directly at /dev/spine.
 */
export default function SpineDevPreviewPage() {
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-16 px-6 py-16">
      <h1 className="text-text font-mono text-2xl font-bold">Spine - verdict shapes</h1>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        {FIXTURES.map(({ label, data }) => (
          <div key={label} className="border-line flex flex-col gap-3 rounded-overlay border p-4">
            <VerdictBadge verdict={data.overall_verdict} />
            <Spine
              claims={data.claims}
              claimVerdicts={data.claim_verdicts}
              stances={data.stances}
              evidence={data.evidence}
            />
          </div>
        ))}
      </div>

      <div>
        <h2 className="text-mute mb-4 font-mono text-sm uppercase tracking-wide">
          Mixed (all four in one spine)
        </h2>
        <Spine
          claims={FOUR_VERDICTS_FIXTURE.claims}
          claimVerdicts={FOUR_VERDICTS_FIXTURE.claim_verdicts}
          stances={FOUR_VERDICTS_FIXTURE.stances}
          evidence={FOUR_VERDICTS_FIXTURE.evidence}
        />
      </div>
    </main>
  );
}
