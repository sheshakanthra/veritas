import type { Metadata } from "next";
import { AuthForm } from "@/components/veritas/AuthForm";

export const metadata: Metadata = {
  title: "Log in - VERITAS",
};

export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24">
      <div className="w-full max-w-sm">
        <h1 className="text-text mb-2 font-mono text-4xl leading-[1.05] font-bold tracking-tight">
          VERITAS
        </h1>
        <p className="text-mute mb-10 font-mono text-lg">Log in to analyze claims.</p>
        <AuthForm mode="login" />
      </div>
    </main>
  );
}
