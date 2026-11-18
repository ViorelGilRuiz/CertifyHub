"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Stage = "connecting" | "collecting" | "evaluating" | "generating" | "completed" | "failed";
const stages = [
  ["connecting", "Conectando"],
  ["collecting", "Recopilando datos"],
  ["evaluating", "Evaluando"],
  ["generating", "Generando informe"],
] as const;
type Status = { agent: { online: boolean; device: string | null }; job: { id: string; stage: Stage } | null };

export default function AnalysisControls({ hasReport }: { hasReport: boolean }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>();
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const [unreachable, setUnreachable] = useState(false);
  const seen = useRef<string | null>(null);
  const stage = status?.job?.stage;
  const current = stages.findIndex(([key]) => key === stage);
  const active = starting || current >= 0;

  useEffect(() => {
    const controller = new AbortController();
    let next: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const result = await fetch("/api/analysis", { cache: "no-store", signal: controller.signal });
        if (!result.ok) throw new Error();
        const updated: Status = await result.json();
        setUnreachable(false);
        setStatus(updated);
        if (updated.job?.stage === "completed" && seen.current !== updated.job.id) {
          seen.current = updated.job.id;
          router.refresh();
        }
      } catch {
        if (!controller.signal.aborted) setUnreachable(true);
      } finally {
        if (!controller.signal.aborted) next = setTimeout(poll, 1400);
      }
    }
    void poll();
    return () => { controller.abort(); clearTimeout(next); };
  }, [router]);

  async function start() {
    setStarting(true);
    setError("");
    try {
      const response = await fetch("/api/analysis", { method: "POST", headers: { "X-CertifyHub-Local": "1" } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail);
      setStatus(data);
    } catch (cause) {
      setError(cause instanceof Error && cause.message ? cause.message : "No se pudo iniciar el análisis.");
    } finally {
      setStarting(false);
    }
  }

  return <div className="test-controls">
    <div className="control-row">
      <span className={`badge ${active || status?.agent.online && !unreachable ? "ok" : "neutral"}`}>
        <span className="dot" aria-hidden="true"/> {active ? "Análisis en curso" : unreachable ? "Servicio no disponible" : !status ? "Comprobando conexión" : status.agent.online ? "Agente conectado" : "Agente desconectado"}
      </span>
      <div className="actions">
        {hasReport && <button className="button secondary" onClick={() => router.refresh()}>Actualizar informe</button>}
        {hasReport && <button className="button secondary print" onClick={() => window.print()}>Exportar informe</button>}
        <button className="button primary" onClick={start} disabled={active || !status?.agent.online || unreachable}><span aria-hidden="true">▶</span> Iniciar test</button>
      </div>
    </div>
    <div aria-live="polite">
      {(active || stage === "completed") && <ol className="test-stages" aria-label="Progreso del análisis">{stages.map(([key, label], index) =>
        <li key={key} aria-current={current === index ? "step" : undefined} className={stage === "completed" || index <= current ? "reached" : ""}>{label}</li>
      )}</ol>}
      {error && <p className="control-message" role="alert">{error}</p>}
      {!error && stage === "failed" && <p className="control-message" role="alert">El análisis se interrumpió. Comprueba el agente y vuelve a iniciarlo.</p>}
      {!active && stage === "completed" && <p className="control-message">Análisis completado. Informe disponible.</p>}
      {!active && status && !status.agent.online && <p className="control-message">Abre el agente de Windows para habilitar la prueba.</p>}
      {!hasReport && status?.agent.online && status.agent.device && <p className="control-message">Equipo conectado · {status.agent.device}</p>}
    </div>
  </div>;
}
