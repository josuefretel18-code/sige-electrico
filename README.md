# SIGE - Sistema de Gestión de Incidencias Eléctricas

Proyecto web para que ciudadanos reporten incidencias eléctricas geolocalizadas
y la empresa eléctrica pueda validarlas, gestionarlas y atenderlas.

## Fase 1
API base creada con Flask.

## Ejecutar en desarrollo

```bash
python -m venv .venv
```

Windows:

```bash
.venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Abrir:

- http://127.0.0.1:5000/
- http://127.0.0.1:5000/api/health

## Despliegue previsto

- Backend: Flask en Render
- Base de datos: PostgreSQL en Aiven
- Frontend: Google Apps Script + HTML/CSS/JS + Bootstrap
- Mapas: Google Maps API
- Automatizaciones: Node-RED
