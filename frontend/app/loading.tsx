export default function Loading() {
  return <main aria-busy="true" aria-label="Cargando el informe"><div className="skeleton skeleton-header"/><div className="skeleton skeleton-summary"/><div className="kpi-grid">{["sistema", "cpu", "ram", "disco"].map(item => <div key={item} className="skeleton skeleton-card"/>)}</div></main>;
}
