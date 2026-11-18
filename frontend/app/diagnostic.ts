export type Update = { title: string; kb?: string | null; date?: string | null };

export type Inventory = {
  os?: string | null;
  release?: string | null;
  revision?: number | null;
  manufacturer?: string | null;
  model?: string | null;
  board?: string | null;
  bios?: string | null;
  firmware?: "Uefi" | "Bios" | null;
  secure_boot?: boolean | null;
  tpm?: string | null;
  cpu?: string | null;
  cores?: number | null;
  clock_mhz?: number | null;
  architecture?: "x64" | "arm64" | "other" | null;
  ram_installed?: number | null;
  ram_slots?: number | null;
  modules: { slot?: string | null; capacity: number; speed?: number | null; type?: string | null }[];
  system_volume?: number | null;
  system_disk?: number | null;
  system_media?: string | null;
  disks: { model: string; capacity: number; media?: string | null; interface?: string | null }[];
  graphics: string[];
  installed_updates: Update[];
  pending_updates: Update[];
  update_count?: number | null;
  update_status: "not_requested" | "complete" | "partial" | "unavailable";
  reboot_required?: boolean | null;
};

export type Metrics = {
  windows_build: string;
  logical_processors: number;
  memory_bytes: number;
  system_disk_free_bytes: number;
  inventory?: Inventory | null;
};

const GiB = 2 ** 30;

export function gibibytes(bytes?: number | null) {
  if (bytes == null) return "Sin datos";
  return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 }).format(bytes / GiB) + " GiB";
}

export function compatibility(inventory: Inventory) {
  const { architecture, cores, clock_mhz, ram_installed, system_disk, firmware, secure_boot, tpm } = inventory;
  const cpu = architecture === "other" || (cores != null && cores < 2) || (clock_mhz != null && clock_mhz > 0 && clock_mhz < 1000) ? false
    : architecture && cores && clock_mhz ? true : null;
  return [
    { name: "Procesador de 64 bits, 2 núcleos y 1 GHz", result: cpu },
    { name: "Modelo de procesador aprobado por Microsoft", result: null },
    { name: "RAM instalada de al menos 4 GiB", result: ram_installed == null ? null : ram_installed >= 4 * GiB },
    { name: "Disco del sistema de al menos 64 GB", result: system_disk == null ? null : system_disk >= 64e9 },
    { name: "Modo de firmware UEFI", result: firmware == null ? null : firmware === "Uefi" },
    { name: "Capacidad de Arranque seguro", result: firmware === "Bios" ? false : secure_boot != null ? true : null },
    { name: "TPM 2.0", result: tpm == null ? null : tpm === "2.0" },
    { name: "DirectX 12, WDDM 2.0 y pantalla", result: null },
  ];
}

export function recommendations(metrics: Metrics, inventory: Inventory) {
  const { ram_installed, ram_slots, modules, system_volume, system_media, update_status, update_count, reboot_required } = inventory;
  const free = metrics.system_disk_free_bytes;
  const memory = ram_installed ?? metrics.memory_bytes;
  const ram = memory < 16 * GiB
    ? "Valora llegar a 16 GiB si usas varias aplicaciones a la vez."
    : "Mantén la capacidad actual para uso general. Valora más RAM si observas saturación sostenida con tu carga habitual.";
  const slots = ram_slots != null && modules.length > 0 && ram_slots > modules.length
    ? " El firmware indica posiciones de memoria sin ocupar. Confirma que sean accesibles y revisa el tipo y la capacidad admitidos por el fabricante antes de comprar."
    : " Consulta el manual del equipo para verificar si admite ampliación, el tipo de módulo y su capacidad máxima.";
  const disk = free < 25 * GiB || (system_volume && free / system_volume < 0.15)
    ? "Libera espacio en el volumen del sistema. Si vuelve a llenarse con frecuencia, valora un SSD de mayor capacidad."
    : "El espacio libre actual es suficiente según los umbrales del informe.";
  const media = system_media === "HDD"
    ? " El disco del sistema es mecánico. Cambiarlo por un SSD compatible puede mejorar los tiempos de arranque y carga."
    : "";
  const updates = reboot_required ? "Reinicia el equipo cuando puedas guardar tu trabajo y vuelve a comprobar las actualizaciones."
    : (update_count ?? 0) > 0 ? "Revisa las actualizaciones ofrecidas en Configuración → Windows Update."
    : update_status !== "complete" ? "Comprueba las actualizaciones en Configuración → Windows Update o repite el informe con la búsqueda activada."
    : "Windows Update no ofrecía actualizaciones en la última consulta.";
  return [{ title: "Memoria RAM", text: ram + slots }, { title: "Almacenamiento", text: disk + media }, { title: "Actualizaciones", text: updates }];
}
