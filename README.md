# CertifyHub

Base de diagnóstico local para Windows. El agente recoge la compilación de Windows, el número de procesadores lógicos, la memoria visible y el espacio libre en el disco del sistema. La API guarda los informes y el panel presenta el último recibido.

## Requisitos

- Windows 11 con PowerShell, Git y Docker Desktop configurado para contenedores Linux.
- Dos puertos locales disponibles. Por defecto se usan 3000 y 8000.
- Node.js 24 para comprobar el frontend fuera de Docker.

## Instalación y uso

Desde PowerShell, clona el repositorio y cambia a la rama que contiene esta fase.

```powershell
git clone https://github.com/ViorelGilRuiz/CertifyHub.git
cd CertifyHub
git switch feature/fase-1-base
Copy-Item .env.example .env
notepad .env
```

Conserva `POSTGRES_DB` y `POSTGRES_USER` con sus valores de ejemplo. Define una contraseña local propia en `POSTGRES_PASSWORD` antes de ejecutar Compose. Usa letras y números para evitar la interpolación de caracteres especiales en el archivo de entorno.

```powershell
docker compose up --build -d --wait
Invoke-RestMethod http://127.0.0.1:8000/health
powershell -NoProfile -ExecutionPolicy RemoteSigned -File .\agent\Invoke-CertifyHubDiagnostic.ps1
powershell -NoProfile -ExecutionPolicy RemoteSigned -File .\agent\Invoke-CertifyHubDiagnostic.ps1 -Enviar
```

El primer comando del agente imprime el informe. El segundo lo envía a la API local. La opción `-ExecutionPolicy RemoteSigned` se aplica al proceso que ejecuta el script. Abre <http://localhost:3000> y actualiza el informe. La documentación interactiva está en <http://localhost:8000/docs>.

Si algún puerto está ocupado, cambia `WEB_PORT` o `API_PORT` en `.env` y usa los puertos elegidos en el navegador y en las consultas. Si cambias el puerto de la API, añade `-PuertoApi <puerto>` al comando del agente que incluye `-Enviar`.

El panel incluye el resumen de Windows, BIOS, TPM, CPU, memoria, discos y gráficos. La comprobación de Windows 11 es parcial. Usa [Comprobación de estado del PC de Microsoft](https://www.microsoft.com/windows/windows-11-specifications) para validar elegibilidad, incluido el modelo del procesador y los requisitos gráficos.

```powershell
powershell -NoProfile -ExecutionPolicy RemoteSigned -File .\agent\Invoke-CertifyHubDiagnostic.ps1 -Enviar -BuscarActualizaciones
powershell -NoProfile -ExecutionPolicy RemoteSigned -File .\agent\Invoke-CertifyHubDiagnostic.ps1 -ExportarMsinfo .\equipo.nfo
```

La búsqueda consulta el servicio de Windows Update configurado en el equipo durante un máximo de 40 segundos. El agente consulta las actualizaciones y el reinicio pendiente sin instalar actualizaciones. El archivo NFO queda local y se abre con MSINFO32. Puede contener identificadores del equipo y datos de red.

PostgreSQL inicializa la base y el usuario al crear el volumen por primera vez. La API crea la tabla `diagnostics` al arrancar. El volumen conserva los informes al ejecutar `docker compose down`. Editar las variables de PostgreSQL después de inicializar el volumen requiere cambiar la configuración de la base existente.

## Arquitectura

- `agent/` reúne métricas e inventario mediante CIM, datos de firmware y Windows Update, y los serializa como JSON.
- `backend/app/` valida el informe, persiste las métricas en PostgreSQL y sirve el estado y el último registro.
- `frontend/app/` consulta la API desde el servidor Next.js y muestra el informe, el estado inicial o un fallo de conexión.
- `compose.yaml` conecta los servicios. Los puertos publicados quedan en la interfaz local y PostgreSQL permanece en la red interna de Compose.

El prototipo comparte un único historial local y carece de autenticación. Está pensado para pruebas en un único ordenador. El esquema omite identificadores de equipo y de usuario.

## Pruebas

Con Compose en ejecución y los valores de ejemplo en `POSTGRES_DB` y `POSTGRES_USER`, crea una base de pruebas la primera vez. Las pruebas vacían la tabla de esa base.

```powershell
docker compose exec -T db createdb -U certifyhub certifyhub_test
docker compose run --rm --user root -e PGDATABASE=certifyhub_test -v "${PWD}/backend/tests:/app/tests:ro" api sh -c "pip install 'pytest>=8,<10' 'httpx2>=2,<3' && python -m pytest -q"
npm.cmd --prefix frontend ci
npm.cmd --prefix frontend run typecheck
npm.cmd --prefix frontend run build
```

GitHub Actions ejecuta las pruebas de API y PostgreSQL, verifica el flujo entre los contenedores y ejecuta el diagnóstico en Windows.
