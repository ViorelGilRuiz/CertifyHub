import type { Metrics } from "./diagnostic";
import AnalysisControls from "./analysis-controls";
import Dashboard, { navigation } from "./dashboard";

type Report = { received_at: string; metrics: Metrics };

async function lastReport(): Promise<Report | null> {
  const url = process.env.API_URL ?? "http://127.0.0.1:8000";
  const response = await fetch(new URL("/diagnostics/latest", url), {
    cache: "no-store",
    signal: AbortSignal.timeout(4000),
  });
  if (!response.ok) throw new Error("No se pudo consultar la API");
  return response.json();
}

export default async function Home() {
  const report = await lastReport().catch(() => undefined);
  const data = report?.metrics.inventory;
  return <div className="layout">
    <aside className="sidebar">
      <a className="brand" href="/"><span aria-hidden="true">C</span> CertifyHub</a>
      {report && <nav aria-label="Secciones del informe">{navigation.filter(([id]) => data || id !== "actualizaciones").map(([href, label]) =>
        <a key={href} href={`#${href}`}>{label}</a>
      )}</nav>}
    </aside>
    <main>
      <header className="page-header">
        <div>
          <h1>Auditoría del equipo</h1>
          {report && <dl className="metadata">
            <div><dt>Equipo</dt><dd>{data?.device ?? data?.model ?? "Equipo local"}</dd></div>
            {data?.customer && <div><dt>Cliente</dt><dd>{data.customer}</dd></div>}
            <div><dt>Sistema</dt><dd>{data?.os ?? "Windows"}{data?.release ? ` · ${data.release}` : ""}</dd></div>
            <div><dt>Último análisis</dt><dd><time dateTime={report.received_at}>{new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Madrid" }).format(new Date(report.received_at))}</time></dd></div>
          </dl>}
        </div>
        <AnalysisControls hasReport={Boolean(report)}/>
      </header>
      {report ? <Dashboard metrics={report.metrics}/> : <section className="empty panel">
        <span className="tile-icon" aria-hidden="true">◫</span>
        <h2>{report === null ? "Aún no hay ningún informe" : "El informe no está disponible"}</h2>
        <p>{report === null ? "En cuanto se conecte el agente local, pulsa «Iniciar test» para recopilar el inventario y generar las recomendaciones." : "Comprueba que la API y PostgreSQL estén en ejecución y vuelve a cargar la página."}</p>
      </section>}
    </main>
  </div>;
}
