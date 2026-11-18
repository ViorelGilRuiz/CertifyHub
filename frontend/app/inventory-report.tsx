import type { ReactNode } from "react";
import { compatibility, gibibytes, type Inventory, type Update } from "./diagnostic";

function Details({ values }: { values: [string, ReactNode][] }) {
  return <dl className="details">{values.map(([key, value]) => (
    <div key={key}><dt>{key}</dt><dd>{value ?? "Sin datos"}</dd></div>
  ))}</dl>;
}

function UpdateList({ items }: { items: Update[] }) {
  return <ul className="rows">{items.map((item, index) => (
    <li key={index}><span>{item.title || "Actualización"}</span>
      <span className="muted">{[item.kb, item.date].filter(Boolean).join(" · ")}</span>
    </li>
  ))}</ul>;
}

export function CompatibilityReport({ data }: { data: Inventory }) {
  const checks = compatibility(data);
  const status = checks.some(({ result }) => result === false)
    ? "Hay requisitos que no se cumplen"
    : "Compatibilidad pendiente de confirmar";
  return (
      <section id="compatibilidad">
        <h2>Compatibilidad con Windows 11</h2>
        <p className="summary">{status}</p>
        <ul className="rows">{checks.map(({ name, result }) => (
          <li key={name}><span>{name}</span>
            <span className={`pill ${result === true ? "pass" : result === false ? "fail" : "unknown"}`}>
              {result === true ? "Cumple" : result === false ? "No cumple" : "Sin verificar"}
            </span>
          </li>
        ))}</ul>
        <p className="muted">Comprueba la elegibilidad final con la aplicación oficial <a href="https://www.microsoft.com/windows/windows-11-specifications">Comprobación de estado del PC de Microsoft</a>.</p>
      </section>
  );
}

export function HardwareReport({ data }: { data: Inventory }) {
  return (
      <section id="hardware">
        <h2>Hardware</h2>
        <Details values={[
          ["Sistema operativo", data.os], ["Versión", data.release],
          ["Equipo", [data.manufacturer, data.model].filter(Boolean).join(" ") || null],
          ["Placa base", data.board], ["BIOS / UEFI", data.bios], ["Modo de firmware", data.firmware],
          ["Arranque seguro", data.secure_boot == null ? null : data.secure_boot ? "Activado" : "Desactivado"],
          ["Versión TPM", data.tpm], ["Procesador", data.cpu], ["Arquitectura", data.architecture],
          ["Núcleos físicos", data.cores], ["Frecuencia máxima", data.clock_mhz ? `${data.clock_mhz} MHz` : null],
          ["Gráficos", data.graphics.join(" · ") || null],
          ["Temperatura", null], ["Antigüedad del equipo", null],
        ]} />
        <h3>Memoria y almacenamiento</h3>
        <Details values={[
          ["RAM instalada", gibibytes(data.ram_installed)], ["Posiciones declaradas por el firmware", data.ram_slots],
          ["Volumen del sistema", gibibytes(data.system_volume)], ["Disco físico del sistema", gibibytes(data.system_disk)],
        ]} />
        <h3>Módulos de memoria</h3>
        {data.modules.length ? <ul className="rows">{data.modules.map((module, index) => (
          <li key={index}><span>{module.slot || `Módulo ${index + 1}`}</span>
            <span>{[gibibytes(module.capacity), module.type, module.speed && `${module.speed} MT/s`].filter(Boolean).join(" · ")}</span>
          </li>
        ))}</ul> : <p className="muted">El equipo no informó de los módulos.</p>}
        <h3>Discos físicos</h3>
        {data.disks.length ? <ul className="rows">{data.disks.map((disk, index) => (
          <li key={index}><span>{disk.model || `Disco ${index + 1}`}</span>
            <span>{[gibibytes(disk.capacity), disk.media === "Unspecified" ? null : disk.media, disk.interface].filter(Boolean).join(" · ")}</span>
          </li>
        ))}</ul> : <p className="muted">El equipo no informó de los discos físicos.</p>}
      </section>
  );
}

export function UpdatesReport({ data }: { data: Inventory }) {
  const updateStatus = {
    not_requested: "Búsqueda de actualizaciones pendientes sin ejecutar.",
    complete: data.update_count == null ? "Windows Update no devolvió un recuento." : `${data.update_count} actualizaciones ofrecidas por Windows Update.`,
    partial: data.update_count == null ? "Búsqueda parcial sin recuento disponible." : `Búsqueda parcial. Windows Update mostró ${data.update_count} resultados.`,
    unavailable: "Windows Update no respondió o la búsqueda superó el tiempo de espera.",
  }[data.update_status];
  return (
      <section id="actualizaciones">
        <h2>Windows Update</h2>
        <p className="summary">{updateStatus}</p>
        <p>Reinicio pendiente · {data.reboot_required == null ? "Sin verificar" : data.reboot_required ? "Sí" : "No"}</p>
        {data.pending_updates.length > 0 && <><h3>Actualizaciones ofrecidas</h3><UpdateList items={data.pending_updates} /></>}
        {data.pending_updates.length < (data.update_count ?? 0) && <p className="muted">Se muestran las primeras 15 actualizaciones.</p>}
        <h3>Revisiones instaladas recientes</h3>
        {data.installed_updates.length ? <UpdateList items={data.installed_updates} /> : <p className="muted">Windows no devolvió revisiones instaladas.</p>}
        <p className="muted">La lista de revisiones procede de Get-HotFix y puede omitir parte del historial de Windows Update.</p>
      </section>
  );
}
