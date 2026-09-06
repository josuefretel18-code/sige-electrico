-- ==========================================
-- SIGE
-- Sistema de Gestión de Incidencias Eléctricas
-- Base de datos: sige_db
-- ==========================================


-- 1. CATEGORÍAS DE INCIDENCIAS
CREATE TABLE IF NOT EXISTS categorias (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) UNIQUE NOT NULL,
    descripcion VARCHAR(255),
    activo BOOLEAN DEFAULT TRUE
);


-- 2. ESTADOS DE UNA INCIDENCIA
CREATE TABLE IF NOT EXISTS estados (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) UNIQUE NOT NULL
);


-- 3. INFRAESTRUCTURA ELÉCTRICA
CREATE TABLE IF NOT EXISTS infraestructura_electrica (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(50) UNIQUE NOT NULL,
    tipo VARCHAR(100) NOT NULL,
    descripcion VARCHAR(255),
    latitud DOUBLE PRECISION NOT NULL,
    longitud DOUBLE PRECISION NOT NULL,
    estado_operativo VARCHAR(50) DEFAULT 'OPERATIVO',
    fecha_registro TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);


-- 4. INCIDENCIAS
CREATE TABLE IF NOT EXISTS incidencias (
    id BIGSERIAL PRIMARY KEY,

    codigo VARCHAR(30) UNIQUE NOT NULL,

    categoria_id INTEGER NOT NULL
        REFERENCES categorias(id),

    estado_id INTEGER NOT NULL
        REFERENCES estados(id),

    infraestructura_id INTEGER
        REFERENCES infraestructura_electrica(id),

    descripcion TEXT NOT NULL,

    latitud DOUBLE PRECISION NOT NULL,
    longitud DOUBLE PRECISION NOT NULL,

    origen VARCHAR(20) NOT NULL
        CHECK (origen IN ('CIUDADANO', 'OPERADOR')),

    prioridad VARCHAR(20) DEFAULT 'MEDIA'
        CHECK (prioridad IN ('BAJA', 'MEDIA', 'ALTA', 'CRITICA')),

    fecha_reporte TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);


-- 5. HISTORIAL DE INCIDENCIAS
CREATE TABLE IF NOT EXISTS historial_incidencias (
    id BIGSERIAL PRIMARY KEY,

    incidencia_id BIGINT NOT NULL
        REFERENCES incidencias(id),

    estado_anterior INTEGER
        REFERENCES estados(id),

    estado_nuevo INTEGER NOT NULL
        REFERENCES estados(id),

    observacion TEXT,

    fecha_hora TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);


-- 6. AUDITORÍA
CREATE TABLE IF NOT EXISTS auditoria (
    id BIGSERIAL PRIMARY KEY,

    incidencia_id BIGINT
        REFERENCES incidencias(id),

    accion VARCHAR(100) NOT NULL,

    tipo_actor VARCHAR(20)
        CHECK (tipo_actor IN ('CIUDADANO', 'OPERADOR', 'SISTEMA')),

    identificador_anonimo VARCHAR(100),

    fecha_hora TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
-- 7. Operadores
CREATE TABLE IF NOT EXISTS operadores (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(30) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
-- 7. clima
CREATE TABLE IF NOT EXISTS clima_incidencias (
    id SERIAL PRIMARY KEY,
    incidencia_id INTEGER NOT NULL,
    temperatura DECIMAL(5,2),
    velocidad_viento DECIMAL(6,2),
    precipitacion DECIMAL(6,2),
    codigo_clima INTEGER,
    descripcion_clima VARCHAR(150),
    fecha_consulta TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_clima_incidencia
        FOREIGN KEY (incidencia_id)
        REFERENCES incidencias(id)
        ON DELETE CASCADE
);

-- ==========================================
-- DATOS INICIALES
-- ==========================================

INSERT INTO estados (nombre)
VALUES
    ('PENDIENTE_VALIDACION'),
    ('VALIDADO'),
    ('EN_ATENCION'),
    ('SOLUCIONADO'),
    ('DESCARTADO')
ON CONFLICT (nombre) DO NOTHING;


INSERT INTO categorias (nombre, descripcion)
VALUES
    ('POSTE_CAIDO', 'Poste eléctrico caído'),
    ('CORTE_ENERGIA', 'Interrupción del servicio eléctrico'),
    ('TRANSFORMADOR_AVERIADO', 'Falla o avería de transformador'),
    ('CABLE_CAIDO', 'Cable eléctrico caído o expuesto'),
    ('ALUMBRADO_PUBLICO', 'Problema de alumbrado público'),
    ('CORTOCIRCUITO', 'Posible cortocircuito o chisporroteo'),
    ('OTRO', 'Otro tipo de incidencia eléctrica')
ON CONFLICT (nombre) DO NOTHING;