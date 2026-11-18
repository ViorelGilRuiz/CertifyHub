import { compatibility, gibibytes, type Metrics } from "./diagnostic";

const GiB = 2 ** 30;
type Priority = "Crítica" | "Recomendada" | "Opcional";
type Action = { title: string; reason: string; service: string; benefit: string; priority: Priority };

export function assess(metrics: Metrics) {
  const data = metrics.inventory;
  const ram = data?.ram_installed ?? metrics.memory_bytes;
  const free = metrics.system_disk_free_bytes;
  const updates = data?.update_count;
  const windows10 = /Windows 10/i.test(data?.os ?? "");
  const windows11 = /Windows 11/i.test(data?.os ?? "");
  const lowDisk = free < 25 * GiB || Boolean(data?.system_volume && free / data.system_volume < .15);
  const checks = data ? compatibility(data) : [];
  const blocked = checks.some(check => check.result === false);
  const critical = data?.disk_health === "unhealthy" || free < 5 * GiB;
  const security = data?.defender_active === true && data.firewall_profiles_disabled === 0;
  const weakSecurity = (data?.firewall_profiles_disabled ?? 0) > 0;
  const signals = [
    { good: ram >= 8 * GiB, weight: 15 },
    { good: !lowDisk, weight: 20 },
    { good: data?.disk_health ? data.disk_health === "healthy" : null, weight: 20 },
    { good: data?.firewall_profiles_disabled != null ? !weakSecurity : null, weight: 15 },
    { good: data?.update_status === "complete" && updates != null ? updates === 0 : null, weight: 15 },
    { good: data?.unexpected_shutdowns != null ? data.unexpected_shutdowns === 0 : null, weight: 10 },
    { good: data?.secure_boot ?? null, weight: 5 },
  ].filter(signal => signal.good != null);
  const score = signals.length >= 4
    ? Math.min(critical ? 39 : 100, Math.round(100 * signals.reduce((sum, item) => sum + (item.good ? item.weight : 0), 0) / signals.reduce((sum, item) => sum + item.weight, 0)))
    : null;
  const state = score == null ? "Pendiente de analizar" : score >= 92 ? "Excelente" : score >= 75 ? "Bueno" : score >= 60 ? "Mejorable" : score >= 40 ? "Riesgo alto" : "Crítico";

  const actions: Action[] = [];
  if (data?.disk_health === "unhealthy" || data?.disk_health === "warning") actions.push({
    title: "Verificar el disco y asegurar la copia", reason: "Windows notificó una alerta de salud del disco del sistema.",
    service: "Copia de seguridad y revisión del almacenamiento", benefit: "Reduce el riesgo de pérdida de datos y ayuda a planificar una sustitución.", priority: data.disk_health === "unhealthy" ? "Crítica" : "Recomendada",
  });
  if (lowDisk) actions.push({
    title: "Recuperar espacio en el volumen del sistema", reason: `Quedan ${gibibytes(free)} libres. Un volumen lleno puede bloquear actualizaciones.`,
    service: "Optimización de almacenamiento", benefit: "Da margen para actualizar Windows y trabajar con archivos temporales.", priority: free < 5 * GiB ? "Crítica" : "Recomendada",
  });
  if (weakSecurity) actions.push({
    title: "Revisar los perfiles de firewall", reason: `${data?.firewall_profiles_disabled} perfiles aparecen desactivados. Comprueba la política de la empresa antes de cambiarla.`,
    service: "Revisión de protección del puesto", benefit: "Ayuda a reducir exposición y verificar la configuración corporativa.", priority: "Recomendada",
  });
  if (windows10) actions.push({
    title: "Planificar la salida de Windows 10", reason: "Comprueba el ciclo de vida de esta edición y su cobertura ESU. Las ediciones de uso general ya finalizaron el soporte estándar.",
    service: "Migración de sistema operativo", benefit: "Mantiene el acceso a parches y permite validar aplicaciones y periféricos antes del cambio.", priority: "Recomendada",
  });
  if ((updates ?? 0) > 0 || data?.reboot_required) actions.push({
    title: "Programar mantenimiento de Windows Update", reason: data?.reboot_required ? "Windows requiere un reinicio." : `Windows Update ofreció ${updates} actualizaciones.`,
    service: "Mantenimiento preventivo y gestión de parches", benefit: "Permite aplicar las actualizaciones en una ventana acordada y comprobar el resultado.", priority: "Recomendada",
  });
  if (ram < 16 * GiB) actions.push({
    title: "Valorar una ampliación de RAM a 16 GiB", reason: `${gibibytes(ram)} detectados. Si hay lentitud con varias aplicaciones, comprueba ranuras y capacidad admitida.`,
    service: "Evaluación y ampliación de memoria", benefit: "Puede mejorar la fluidez cuando la carga de trabajo agota la RAM.", priority: ram < 8 * GiB ? "Recomendada" : "Opcional",
  });
  if (data?.system_media === "HDD") actions.push({
    title: "Valorar la migración a SSD", reason: "El sistema arranca desde un disco mecánico.",
    service: "Instalación de SSD y migración de datos", benefit: "Puede reducir tiempos de arranque y carga de aplicaciones.", priority: "Recomendada",
  });
  if (data?.secure_boot === false || (data?.tpm != null && data.tpm !== "2.0")) actions.push({
    title: "Revisar la configuración de firmware", reason: "El arranque seguro está desactivado o el módulo TPM detectado no es 2.0. Valida BitLocker y las claves de recuperación antes de tocar el firmware.",
    service: "Evaluación de seguridad y compatibilidad", benefit: "Aclara si se pueden habilitar los requisitos de seguridad sin cambiar el equipo.", priority: "Recomendada",
  });
  if (data?.bitlocker_active === false) actions.push({
    title: "Valorar el cifrado del disco", reason: "La protección del volumen del sistema aparece desactivada.",
    service: "Configuración de cifrado y custodia de claves", benefit: "Ayuda a proteger archivos si el portátil se extravía.", priority: "Opcional",
  });
  if ((data?.unexpected_shutdowns ?? 0) > 0) actions.push({
    title: "Investigar los apagados inesperados", reason: "El registro de Windows contiene eventos Kernel-Power 41 de los últimos siete días.",
    service: "Diagnóstico de estabilidad", benefit: "Ayuda a identificar interrupciones recurrentes antes de sustituir componentes.", priority: "Recomendada",
  });
  if (checks.some(check => check.result == null)) actions.push({
    title: "Validar la elegibilidad de Windows 11", reason: "Quedan requisitos sin verificar, como el modelo oficial del procesador y los gráficos.",
    service: "Auditoría de compatibilidad", benefit: "Permite decidir con más seguridad entre mantener, migrar y sustituir.", priority: "Opcional",
  });

  const rank = { Crítica: 0, Recomendada: 1, Opcional: 2 };
  actions.sort((a, b) => rank[a.priority] - rank[b.priority]);
  const plan = critical ? "Optimizar y revisar de inmediato"
    : windows10 && blocked ? "Evaluar renovación o migración"
    : windows10 ? "Actualizar sistema"
    : ram < 8 * GiB || data?.system_media === "HDD" ? "Valorar ampliación"
    : actions.some(item => item.priority === "Recomendada") ? "Optimizar"
    : "Mantener y verificar pendientes";
  return { actions, plan, ram, score, state, coverage: signals.length, lowDisk, security, weakSecurity, updates, checks, windows10, windows11, blocked };
}

export function workloads(ram: number, cores?: number | null) {
  const basic = ram >= 8 * GiB;
  const multitask = ram >= 16 * GiB && (cores ?? 0) >= 4;
  return [
    ["Ofimática y administración", basic ? "Adecuado en principio" : "Uso básico", "Estimación por memoria disponible. Comprueba las aplicaciones habituales."],
    ["Teletrabajo", basic ? "Viable con verificación" : "Mejorable", "Valida videollamadas, conexión y periféricos."],
    ["Programación", multitask ? "Adecuado para desarrollo ligero" : "Carga moderada", "Prueba compilaciones, contenedores y máquinas virtuales si se usan."],
    ["Diseño básico", multitask ? "Viable con verificación" : "Pendiente de probar", "Confirma los requisitos de la aplicación gráfica."],
    ["Diseño avanzado", "Pendiente de analizar", "Requiere una prueba representativa de GPU, RAM y rendimiento."],
    ["Servidor ligero", "Pendiente de analizar", "Valida continuidad, concurrencia, copias y política de soporte."],
    ["TPV / punto de venta", "Viable con verificación", "Comprueba software de caja, impresora y lector con el proveedor."],
    ["Tareas básicas", basic ? "Margen para uso general" : "Priorizar tareas básicas", "Navegación ligera y formularios son un punto de partida para las pruebas."],
  ];
}
