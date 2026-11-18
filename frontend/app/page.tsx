import { connection } from "next/server";

type Report = {
  received_at: string;
  metrics: {
    windows_build: string;
    logical_processors: number;
    memory_bytes: number;
    system_disk_free_bytes: number;
  };
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

function gibibytes(bytes: number) {
  return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 }).format(bytes / 2 ** 30) + " GiB";
}

export default async function Home() {
  await connection();
  const report = await lastReport().catch(() => undefined);
  return (
    <main>
      <header>CertifyHub</header>
      <h1>Diagnóstico de Windows</h1>
      {report === undefined && <p role="status">El servicio de diagnóstico no está disponible.</p>}
      {report === null && <p>Ejecuta el agente con <code>-Enviar</code> para registrar el primer informe.</p>}
      {report && (
        <section aria-labelledby="last-report">
          <h2 id="last-report">Último informe</h2>
          <dl>
            <div><dt>Compilación de Windows</dt><dd>{report.metrics.windows_build}</dd></div>
            <div><dt>Procesadores lógicos</dt><dd>{report.metrics.logical_processors}</dd></div>
            <div><dt>Memoria visible</dt><dd>{gibibytes(report.metrics.memory_bytes)}</dd></div>
            <div><dt>Espacio libre en disco del sistema</dt><dd>{gibibytes(report.metrics.system_disk_free_bytes)}</dd></div>
          </dl>
          <p>Recibido el <time dateTime={report.received_at}>{new Date(report.received_at).toLocaleString("es-ES", { timeZone: "UTC" })} UTC</time></p>
        </section>
      )}
      <a href="/">Actualizar informe</a>
    </main>
  );
}
