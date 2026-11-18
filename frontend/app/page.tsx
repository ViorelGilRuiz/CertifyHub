import { connection } from "next/server";
import { gibibytes, type Metrics } from "./diagnostic";
import InventoryReport from "./inventory-report";

type Report = {
  received_at: string;
  metrics: Metrics;
};

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
  await connection();
  const report = await lastReport().catch(() => undefined);
  return (
    <main>
      <header className="top"><span>CertifyHub</span><a href="/">Actualizar informe</a></header>
      <h1>Diagnóstico de Windows</h1>
      {report === undefined && <p role="status">El servicio de diagnóstico no está disponible.</p>}
      {report === null && <p>Ejecuta el agente con <code>-Enviar</code> para registrar el primer informe.</p>}
      {report && (
        <section className="overview" aria-labelledby="last-report">
          <h2 id="last-report">Último informe</h2>
          <dl>
            <div><dt>Compilación de Windows</dt><dd>{report.metrics.windows_build}{report.metrics.inventory?.revision != null && `.${report.metrics.inventory.revision}`}</dd></div>
            <div><dt>Procesadores lógicos</dt><dd>{report.metrics.logical_processors}</dd></div>
            <div><dt>Memoria visible</dt><dd>{gibibytes(report.metrics.memory_bytes)}</dd></div>
            <div><dt>Espacio libre en disco del sistema</dt><dd>{gibibytes(report.metrics.system_disk_free_bytes)}</dd></div>
          </dl>
          <p>Recibido el <time dateTime={report.received_at}>{new Date(report.received_at).toLocaleString("es-ES", { timeZone: "UTC" })} UTC</time></p>
        </section>
      )}
      {report?.metrics.inventory && (
        <>
          <nav aria-label="Secciones del informe">
            <a href="#compatibilidad">Windows 11</a>
            <a href="#recomendaciones">Recomendaciones</a>
            <a href="#sistema">Sistema</a>
            <a href="#hardware">Hardware</a>
            <a href="#actualizaciones">Actualizaciones</a>
          </nav>
          <InventoryReport metrics={report.metrics} data={report.metrics.inventory} />
        </>
      )}
      {report && !report.metrics.inventory && <p>Ejecuta la versión actual del agente para ver el inventario detallado.</p>}
    </main>
  );
}
