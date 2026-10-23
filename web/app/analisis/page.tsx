"use client";

import { useReducer } from "react";
import { ConsentStep } from "@/components/ConsentStep";
import { CaptureStep } from "@/components/CaptureStep";
import { ProcessingView } from "@/components/ProcessingView";
import { ResultView } from "@/components/ResultView";
import { Button, Card, StageProgress } from "@/components/ui";
import { RetryIcon } from "@/components/icons";
import { Wordmark } from "@/components/Wordmark";
import type { AnalyzeError, AnalyzeResponse } from "@/lib/types";

type Stage = "consent" | "capture" | "preview" | "processing" | "result" | "error";

interface AppState {
  stage: Stage;
  file: File | null;
  photoUrl: string | null;
  result: AnalyzeResponse | null;
  error: AnalyzeError | null;
}

type Action =
  | { type: "proceed_capture" }
  | { type: "set_file"; file: File }
  | { type: "start_processing" }
  | { type: "processing_done"; result: AnalyzeResponse }
  | { type: "processing_failed"; error: AnalyzeError }
  | { type: "back_to_capture" }
  | { type: "restart" };

const initialState: AppState = {
  stage: "consent",
  file: null,
  photoUrl: null,
  result: null,
  error: null,
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "proceed_capture":
      return { ...state, stage: "capture" };
    case "set_file": {
      if (state.photoUrl) URL.revokeObjectURL(state.photoUrl);
      return {
        ...state,
        stage: "preview",
        file: action.file,
        photoUrl: URL.createObjectURL(action.file),
      };
    }
    case "start_processing":
      return { ...state, stage: "processing" };
    case "processing_done":
      return { ...state, stage: "result", result: action.result };
    case "processing_failed":
      return { ...state, stage: "error", error: action.error };
    case "back_to_capture":
      return { ...state, stage: "capture", error: null };
    case "restart": {
      if (state.photoUrl) URL.revokeObjectURL(state.photoUrl);
      return { ...initialState, stage: "consent" };
    }
  }
}

export default function AnalisisPage() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const stageForProgress: "consent" | "foto" | "hasil" =
    state.stage === "consent" ? "consent" : state.stage === "result" ? "hasil" : "foto";

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <header className="mx-auto flex w-full max-w-5xl flex-col items-center justify-between gap-3 px-4 py-4 sm:flex-row sm:px-6">
        <Wordmark className="font-display text-lg font-bold text-ink" />
        <StageProgress current={stageForProgress} />
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-4 pb-12 sm:px-6">
        {state.stage === "consent" && (
          <ConsentStep onAgree={() => dispatch({ type: "proceed_capture" })} />
        )}

        {state.stage === "capture" && (
          <CaptureStep
            onCaptured={(f) => dispatch({ type: "set_file", file: f })}
            onUpload={(f) => dispatch({ type: "set_file", file: f })}
            onCancel={() => dispatch({ type: "restart" })}
          />
        )}

        {state.stage === "preview" && state.photoUrl && (
          <PreviewPane
            photoUrl={state.photoUrl}
            onRetry={() => dispatch({ type: "back_to_capture" })}
            onProceed={() => dispatch({ type: "start_processing" })}
          />
        )}

        {state.stage === "processing" && state.file && (
          <ProcessingView
            file={state.file}
            onDone={(result) => dispatch({ type: "processing_done", result })}
            onError={(error) => dispatch({ type: "processing_failed", error })}
          />
        )}

        {state.stage === "result" && state.photoUrl && state.result && (
          <ResultView
            photoUrl={state.photoUrl}
            result={state.result}
            onRestart={() => dispatch({ type: "restart" })}
          />
        )}

        {state.stage === "error" && state.error && (
          <ErrorView error={state.error} onBackToCapture={() => dispatch({ type: "back_to_capture" })} onRestart={() => dispatch({ type: "restart" })} />
        )}
      </main>
    </div>
  );
}

function PreviewPane({
  photoUrl,
  onRetry,
  onProceed,
}: {
  photoUrl: string;
  onRetry: () => void;
  onProceed: () => void;
}) {
  return (
    <div className="flex w-full max-w-xl flex-col items-center gap-5">
      <img
        src={photoUrl}
        alt="Pratinjau foto gigi yang akan dianalisis"
        className="max-h-[60dvh] rounded-2xl border border-line"
      />
      <p className="max-w-md text-center text-[14px] text-ink-soft">
        Pastikan semua gigi terlihat dan tidak tertutup bayangan. Server memproses foto di memori
        selama analisis.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button variant="secondary" onClick={onRetry}>
          <RetryIcon className="h-5 w-5" />
          Ulangi
        </Button>
        <Button onClick={onProceed}>Lanjut</Button>
      </div>
    </div>
  );
}

function ErrorView({
  error,
  onBackToCapture,
  onRestart,
}: {
  error: AnalyzeError;
  onBackToCapture: () => void;
  onRestart: () => void;
}) {
  return (
    <Card className="flex max-w-md flex-col items-center gap-4 text-center">
      <RetryIcon className="h-8 w-8 text-accent" />
      <h1 className="font-display text-lg font-semibold">Analisis terhenti</h1>
      <p className="text-[15px] text-ink">{error.message}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button variant="secondary" onClick={onBackToCapture}>
          Coba foto ini lagi
        </Button>
        <Button onClick={onRestart}>Mulai dari awal</Button>
      </div>
    </Card>
  );
}
