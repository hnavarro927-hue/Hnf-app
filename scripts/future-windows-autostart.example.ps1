# =============================================================================
# HNF — Plantilla FUTURA para autoarranque en Windows (no ejecutar a ciegas).
# Copiar a otro nombre y adaptar rutas antes de usar con Programador de tareas.
#
# Objetivo documentado para un siguiente paso:
#   - Abrir VS Code / carpeta del repo (opcional)
#   - npm run start:all en la raíz del proyecto
#   - Anotar IP LAN (ipconfig) para acceso iPad
#   - curl http://127.0.0.1:4000/health para verificar backend
#
# NO activar tareas con privilegios elevados salvo que lo necesites.
# NO exponer el backend a Internet sin firewall y autenticación adecuados.
#
# Ejemplo comentado — arranque en ventana nueva:
# Set-Location "C:\ruta\al\repo\Hnf-app"
# Start-Process npm -ArgumentList "run","start:all" -WindowStyle Normal
#
# Opcional (cuando el stack este estable): abrir navegador local tras unos segundos
# Start-Sleep -Seconds 4
# Start-Process "http://127.0.0.1:5173"
#
# Alternativa sin npm en PATH explicito: ejecutar el .cmd del repo
# Start-Process -FilePath "C:\ruta\al\repo\Hnf-app\start-hnf.cmd" -WorkingDirectory "C:\ruta\al\repo\Hnf-app"
# =============================================================================
