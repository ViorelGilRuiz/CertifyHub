import type { ReactNode } from "react";
import { assess, workloads } from "./assessment";
import { gibibytes, type Metrics } from "./diagnostic";
import { CompatibilityReport, HardwareReport, UpdatesReport } from "./inventory-report";

type Tone = "ok" | "watch" | "improve" | "danger" | "neutral";
const unknown = "No verificado";
const status = (value?: boolean | null) => value == null ? unknown : value ? "Activo" : "Desactivado";
const priorityTone = { Crítica: "danger", Recomendada: "watch", Opcional: "neutral" } as const;

export const navigation = [
  ["resumen", "Resumen"], ["salud", "Salud del sistema"], ["hardware", "Hardware"],
  ["seguridad", "Seguridad"], ["compatibilidad", "Compatibilidad"], ["recomendaciones", "Acciones técnicas"],
  ["servicios", "Servicios IT"], ["usos", "Uso recomendado"], ["actualizaciones", "Windows Update"],
];

function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

function Tile({ icon, label, value, description, tone, state }: {
  icon: string; label: string; value: ReactNode; description: string; tone: Tone; state: string;
}) {
  return <article className="kpi">
    <div className="kpi-top"><span className="tile-icon" aria-hidden="true">{icon}</span><Badge tone={tone}>{state}</Badge></div>
    <h3>{label}</h3><strong>{value ?? "Dato no disponible"}</strong><p>{description}</p>
  </article>;
}

function FactList({ rows }: { rows: [string, ReactNode][] }) {
  return <dl className="facts">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? "Dato no disponible"}</dd></div>)}</dl>;
}

export default function Dashboard({ metrics }: { metrics: Metrics }) {
  const data = metrics.inventory;
  const evaluation = assess(metrics);
  const { actions, score, state, plan, coverage, lowDisk, security, weakSecurity, updates, ram, blocked, windows11 } = evaluation;
  const used = data?.system_volume ? Math.min(100, Math.max(0, 100 * (1 - metrics.system_disk_free_bytes / data.system_volume))) : null;
  const alerts: { title: string; label: string; tone: Tone }[] = actions.map(item => ({
    title: item.title, label: item.priority, tone: priorityTone[item.priority],
  }));
  if (!lowDisk) alerts.push({ title: "El volumen del sistema tiene margen de espacio", label: "Correcto", tone: "ok" });
  if (security) alerts.push({ title: "Defender y los perfiles de firewall están activos", label: "Correcto", tone: "ok" });
  if (data?.disk_health == null) alerts.push({ title: "Falta verificar la salud del disco", label: unknown, tone: "neutral" });
  if (data?.disk_health === "healthy") alerts.push({ title: "Windows informa que el disco está en buen estado", label: "Correcto", tone: "ok" });
  if (data?.update_status !== "complete") alerts.push({ title: "Falta completar la consulta de Windows Update", label: unknown, tone: "neutral" });
  const model = data?.cpu ?? "Modelo no disponible";
  const use = ram >= 16 * 2 ** 30 ? "Ofimática y multitarea" : "Ofimática y tareas ligeras";
  const disk = data?.disk_health === "healthy" ? "Correcta" : data?.disk_health === "warning" ? "Revisar" : data?.disk_health === "unhealthy" ? "Alerta" : unknown;
  return <>
    <section id="resumen" className="executive">
      <div className="executive-main">
        <div>
          <h2>Resumen ejecutivo</h2>
          <p className="executive-plan">{plan}</p>
          <p>Uso recomendado · {use}</p>
          <p>Vida útil estimada · {data?.disk_health === "unhealthy" ? "Revisar tras comprobar el disco" : "Dato no disponible"}</p>
        </div>
        <div className="score">
          <div className="gauge" style={{ "--score": `${score ?? 0}%` } as React.CSSProperties}><strong>{score ?? "—"}</strong><span>/ 100</span></div>
          <strong>{state}</strong><small>{coverage} de 7 indicadores medidos</small>
        </div>
      </div>
      <div className="executive-alerts">
        <h3>Hallazgos clave</h3>
        {alerts.length ? <ul>{alerts.slice(0, 5).map(item => <li key={item.title}><Badge tone={item.tone}>{item.label}</Badge>{item.title}</li>)}</ul>
          : <p>Pendiente de analizar. Ejecuta un test para ampliar la evaluación.</p>}
      </div>
    </section>

    <div className="kpi-grid" aria-label="Indicadores del equipo">
      <Tile icon="▣" label="Sistema operativo" value={data?.os ?? `Compilación ${metrics.windows_build}`} state={data?.os ? "Detectado" : unknown} tone={data?.os ? "ok" : "neutral"} description={data?.release ? `Versión ${data.release} · Compilación ${metrics.windows_build}` : "La edición del sistema requiere inventario."}/>
      <Tile icon="⌗" label="Procesador" value={model} state={data?.cpu ? "Detectado" : unknown} tone={data?.cpu ? "ok" : "neutral"} description={`${metrics.logical_processors} procesadores lógicos. Consulta el uso recomendado para dimensionar la carga.`}/>
      <Tile icon="▤" label="Memoria RAM" value={gibibytes(ram)} state={ram >= 16 * 2 ** 30 ? "Adecuada" : "Mejorable"} tone={ram >= 16 * 2 ** 30 ? "ok" : "improve"} description={ram >= 16 * 2 ** 30 ? "Margen para multitarea de uso general." : "Valora ampliar si trabajas con varias aplicaciones."}/>
      <Tile icon="◫" label="Almacenamiento" value={`${gibibytes(metrics.system_disk_free_bytes)} libres`} state={lowDisk ? "Espacio bajo" : "Espacio suficiente"} tone={lowDisk ? "improve" : "ok"} description={`${data?.system_media === "SSD" || data?.system_media === "HDD" ? data.system_media + " · " : ""}${used == null ? "Ocupación no verificada" : `${Math.round(used)} % del volumen ocupado`}.`}/>
      <Tile icon="◇" label="Seguridad" value={security ? "Defender y firewall activos" : weakSecurity ? "Revisar firewall" : "Evaluación parcial"} state={security ? "Controles activos" : weakSecurity ? "Atención" : unknown} tone={security ? "ok" : weakSecurity ? "watch" : "neutral"} description="Abre Seguridad para ver el detalle del cifrado y la protección."/>
      <Tile icon="⊞" label="Compatibilidad Windows 11" value={blocked ? "Requisitos incumplidos" : "Validación parcial"} state={blocked ? "Atención" : unknown} tone={blocked ? "watch" : "neutral"} description="Verifica el modelo oficial de CPU, los gráficos y los requisitos pendientes."/>
      <Tile icon="↻" label="Actualizaciones" value={updates == null ? "Consulta pendiente" : `${updates} ofrecidas`} state={data?.update_status === "complete" && updates != null ? updates > 0 ? "Atención" : "Al día en la consulta" : unknown} tone={data?.update_status === "complete" && updates != null ? updates > 0 ? "watch" : "ok" : "neutral"} description={data?.reboot_required ? "Windows solicita reiniciar." : "Resultado de la última consulta de Windows Update."}/>
      <Tile icon="∿" label="Salud general" value={state} state={score == null ? unknown : `${score} / 100`} tone={score == null ? "neutral" : score < 40 ? "danger" : score < 60 ? "watch" : score < 75 ? "improve" : "ok"} description="Puntuación orientativa según indicadores disponibles."/>
    </div>

    <section id="salud" className="panel">
      <h2>Salud del sistema</h2>
      <p>Instantánea del rendimiento y señales de estabilidad registradas por Windows.</p>
      <FactList rows={[
        ["Salud del disco del sistema", disk], ["Uso instantáneo de CPU", data?.cpu_load_percent == null ? null : `${data.cpu_load_percent} %`],
        ["Memoria libre al analizar", data?.memory_free == null ? null : gibibytes(data.memory_free)],
        ["Tiempo desde el último arranque", data?.uptime_minutes == null ? null : `${Math.floor(data.uptime_minutes / 60)} h ${data.uptime_minutes % 60} min`],
        ["Apagados inesperados en 7 días", data?.unexpected_shutdowns === 100 ? "100 o más" : data?.unexpected_shutdowns],
        ["Duración del arranque", null], ["Procesos y servicios críticos", "Pendiente de analizar"],
      ]}/>
      <p className="muted">La carga de CPU y la memoria libre pueden variar. Los eventos de apagado orientan la revisión; su causa requiere diagnóstico.</p>
    </section>

    {data ? <HardwareReport data={data}/> : <section id="hardware" className="panel"><h2>Hardware</h2><p>Pendiente de analizar. Inicia un test para obtener el inventario detallado.</p></section>}

    <section id="seguridad" className="panel">
      <h2>Seguridad</h2>
      <FactList rows={[
        ["Antivirus registrados", data?.antivirus == null ? unknown : data.antivirus.join(" · ") || "Sin productos registrados"],
        ["Protección en tiempo real de Defender", status(data?.defender_active)],
        ["Firewall de Windows", data?.firewall_profiles_disabled == null ? unknown : data.firewall_profiles_disabled === 0 ? "Todos los perfiles activos" : `${data.firewall_profiles_disabled} perfiles desactivados`],
        ["BitLocker en el volumen del sistema", status(data?.bitlocker_active)],
        ["TPM", data?.tpm ?? unknown], ["Arranque seguro", status(data?.secure_boot)],
      ]}/>
      <p className="muted">La presencia de un antivirus en el registro de Windows indica que está registrado. Su protección efectiva puede requerir una comprobación adicional.</p>
    </section>

    {data && <CompatibilityReport data={data}/>}
    <section id={data ? "sistema-recomendado" : "compatibilidad"} className="panel">
      <h2>Sistema operativo recomendado</h2>
      <p>{windows11 ? "Mantén Windows 11 si tu edición sigue en soporte y las aplicaciones funcionan correctamente." : blocked ? "Evalúa si los requisitos pendientes se pueden corregir antes de proponer una migración o renovación." : "Valida la elegibilidad oficial y las aplicaciones antes de decidir una migración a Windows 11."}</p>
      <FactList rows={[
        ["Windows 11 Pro", "Preferible si se necesitan dominio, administración de BitLocker o Escritorio remoto como equipo anfitrión."],
        ["Windows 11 Home", "Válido para un puesto independiente que no necesita las funciones de administración de Pro."],
        ["Windows 10", "Para las ediciones de uso general fuera de soporte estándar, confirma la edición y cobertura ESU y fija una fecha de migración."],
        ["Linux", "Evaluar para navegación, ofimática web o tareas ligeras si las aplicaciones y periféricos funcionan en una prueba piloto."],
      ]}/>
      <p><a href="https://www.microsoft.com/windows/compare-windows-11-home-vs-pro-versions">Comparativa de ediciones</a> · <a href="https://www.microsoft.com/windows/end-of-support">Ciclo de soporte de Windows 10</a></p>
    </section>

    <section id="recomendaciones" className="panel">
      <h2>Recomendaciones técnicas</h2>
      {actions.length ? <ol className="action-list">{actions.map(item => <li key={item.title}><div><h3>{item.title}</h3><p>{item.reason}</p></div><Badge tone={priorityTone[item.priority]}>{item.priority}</Badge></li>)}</ol>
        : <p>Pendiente de analizar. Ejecuta un test para generar acciones basadas en el equipo.</p>}
    </section>

    <section id="servicios" className="panel">
      <h2>Servicios IT sugeridos</h2>
      <p>Propuestas para comentar con el cliente a partir de los hallazgos del informe.</p>
      {actions.length ? <div className="service-grid">{actions.map(item => <article key={item.service}><Badge tone={priorityTone[item.priority]}>{item.priority}</Badge><h3>{item.service}</h3><p>{item.reason}</p><strong>Beneficio</strong><p>{item.benefit}</p></article>)}</div> : <p>Pendiente de analizar.</p>}
    </section>

    <section id="usos" className="panel">
      <h2>Uso recomendado</h2>
      <p>Orientación según recursos detectados. Valida las aplicaciones y periféricos con una prueba de uso real.</p>
      <div className="service-grid">{workloads(ram, data?.cores).map(([title, state, explanation]) => <article key={title}><h3>{title}</h3><Badge tone="neutral">{state}</Badge><p>{explanation}</p></article>)}</div>
    </section>
    {data && <UpdatesReport data={data}/>}
  </>;
}
