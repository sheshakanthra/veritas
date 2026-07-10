import { ClaimInput } from "@/components/veritas/ClaimInput";
import { UserMenu } from "@/components/veritas/UserMenu";

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24">
      <UserMenu />
      <div className="w-full max-w-2xl">
        <h1 className="text-text mb-2 font-mono text-4xl leading-[1.05] font-bold tracking-tight">
          VERITAS
        </h1>
        <p className="text-mute mb-10 font-mono text-lg">
          A calibrated verdict with a visible evidence trail.
        </p>
        <ClaimInput />
      </div>
    </main>
  );
}
