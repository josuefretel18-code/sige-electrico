import os
import uuid
import jwt

from functools import wraps
from datetime import datetime, timedelta, timezone

from flask import Flask, jsonify, request, g
from flask_cors import CORS
from werkzeug.security import check_password_hash

from db import obtener_conexion


app = Flask(__name__)
CORS(app)

app.json.ensure_ascii = False


JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")

if not JWT_SECRET_KEY:
    raise RuntimeError(
        "JWT_SECRET_KEY no está configurada en el archivo .env"
    )


def generar_token_operador(codigo):
    ahora = datetime.now(timezone.utc)

    payload = {
        "sub": codigo,
        "tipo": "OPERADOR",
        "iat": ahora,
        "exp": ahora + timedelta(hours=4)
    }

    return jwt.encode(
        payload,
        JWT_SECRET_KEY,
        algorithm="HS256"
    )


def requiere_operador(funcion):

    @wraps(funcion)
    def decorador(*args, **kwargs):

        autorizacion = request.headers.get(
            "Authorization",
            ""
        )

        if not autorizacion.startswith("Bearer "):
            return jsonify({
                "ok": False,
                "mensaje": "Acceso no autorizado"
            }), 401

        token = autorizacion.split(" ", 1)[1]

        try:
            payload = jwt.decode(
                token,
                JWT_SECRET_KEY,
                algorithms=["HS256"]
            )

            if payload.get("tipo") != "OPERADOR":
                return jsonify({
                    "ok": False,
                    "mensaje": "Token no válido"
                }), 401

            g.operador_codigo = payload["sub"]

        except jwt.ExpiredSignatureError:
            return jsonify({
                "ok": False,
                "mensaje": "La sesión ha expirado"
            }), 401

        except jwt.InvalidTokenError:
            return jsonify({
                "ok": False,
                "mensaje": "Token no válido"
            }), 401

        return funcion(*args, **kwargs)

    return decorador

@app.get("/")
def inicio():
    return jsonify({
        "sistema": "SIGE - Sistema de Gestión de Incidencias Eléctricas",
        "estado": "API funcionando"
    })


@app.get("/api/health")
def health():
    return jsonify({
        "ok": True,
        "servicio": "sige-api"
    })


@app.get("/api/database")
def probar_database():
    try:
        conexion = obtener_conexion()

        with conexion.cursor() as cursor:
            cursor.execute("SELECT current_database();")
            resultado = cursor.fetchone()

        conexion.close()

        return jsonify({
            "ok": True,
            "mensaje": "Conexión con PostgreSQL exitosa",
            "base_datos": resultado[0]
        })

    except Exception as error:
        return jsonify({
            "ok": False,
            "mensaje": "Error al conectar con PostgreSQL",
            "error": str(error)
        }), 500

@app.get("/api/categorias")
def listar_categorias():
    try:
        conexion = obtener_conexion()

        with conexion.cursor() as cursor:
            cursor.execute("""
                SELECT id, nombre, descripcion, activo
                FROM categorias
                WHERE activo = TRUE
                ORDER BY id;
            """)

            filas = cursor.fetchall()

        conexion.close()

        categorias = []

        for fila in filas:
            categorias.append({
                "id": fila[0],
                "nombre": fila[1],
                "descripcion": fila[2],
                "activo": fila[3]
            })

        return jsonify({
            "ok": True,
            "total": len(categorias),
            "categorias": categorias
        })

    except Exception as error:
        return jsonify({
            "ok": False,
            "error": str(error)
        }), 500

@app.post("/api/incidencias")
def registrar_incidencia():
    try:
        datos = request.get_json(silent=True) or {}

        # Campos obligatorios
        campos = [
            "categoria_id",
            "descripcion",
            "latitud",
            "longitud"
        ]

        faltantes = [
            campo for campo in campos
            if campo not in datos or datos[campo] in [None, ""]
        ]

        if faltantes:
            return jsonify({
                "ok": False,
                "mensaje": "Faltan datos obligatorios",
                "campos": faltantes
            }), 400

        categoria_id = int(datos["categoria_id"])
        descripcion = datos["descripcion"].strip()
        latitud = float(datos["latitud"])
        longitud = float(datos["longitud"])

        origen = datos.get("origen", "CIUDADANO").upper()
        prioridad = datos.get("prioridad", "MEDIA").upper()

        if origen not in ["CIUDADANO", "OPERADOR"]:
            return jsonify({
                "ok": False,
                "mensaje": "Origen no válido"
            }), 400

        if prioridad not in ["BAJA", "MEDIA", "ALTA", "CRITICA"]:
            return jsonify({
                "ok": False,
                "mensaje": "Prioridad no válida"
            }), 400

        if not -90 <= latitud <= 90:
            return jsonify({
                "ok": False,
                "mensaje": "Latitud no válida"
            }), 400

        if not -180 <= longitud <= 180:
            return jsonify({
                "ok": False,
                "mensaje": "Longitud no válida"
            }), 400

        # Código de incidencia
        codigo = (
            f"INC-{datetime.now().year}-"
            f"{uuid.uuid4().hex[:8].upper()}"
        )

        # Identificador anónimo
        identificador_anonimo = (
            f"USR-{uuid.uuid4().hex[:8].upper()}"
        )

        with obtener_conexion() as conexion:
            with conexion.cursor() as cursor:

                # Comprobar categoría
                cursor.execute("""
                    SELECT id
                    FROM categorias
                    WHERE id = %s
                    AND activo = TRUE;
                """, (categoria_id,))

                if cursor.fetchone() is None:
                    return jsonify({
                        "ok": False,
                        "mensaje": "La categoría no existe"
                    }), 400

                # Obtener estado inicial
                cursor.execute("""
                    SELECT id
                    FROM estados
                    WHERE nombre = 'PENDIENTE_VALIDACION';
                """)

                estado = cursor.fetchone()

                if estado is None:
                    return jsonify({
                        "ok": False,
                        "mensaje": "No existe el estado inicial"
                    }), 500

                estado_id = estado[0]

                # Registrar incidencia
                cursor.execute("""
                    INSERT INTO incidencias (
                        codigo,
                        categoria_id,
                        estado_id,
                        descripcion,
                        latitud,
                        longitud,
                        origen,
                        prioridad
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id;
                """, (
                    codigo,
                    categoria_id,
                    estado_id,
                    descripcion,
                    latitud,
                    longitud,
                    origen,
                    prioridad
                ))

                incidencia_id = cursor.fetchone()[0]

                # Auditoría
                cursor.execute("""
                    INSERT INTO auditoria (
                        incidencia_id,
                        accion,
                        tipo_actor,
                        identificador_anonimo
                    )
                    VALUES (%s, %s, %s, %s);
                """, (
                    incidencia_id,
                    "REGISTRO_INCIDENCIA",
                    origen,
                    identificador_anonimo
                ))

        return jsonify({
            "ok": True,
            "mensaje": "Incidencia registrada correctamente",
            "incidencia": {
                "id": incidencia_id,
                "codigo": codigo,
                "estado": "PENDIENTE_VALIDACION",
                "prioridad": prioridad
            }
        }), 201

    except ValueError:
        return jsonify({
            "ok": False,
            "mensaje": "Formato de datos incorrecto"
        }), 400

    except Exception as error:
        return jsonify({
            "ok": False,
            "mensaje": "Error al registrar incidencia",
            "error": str(error)
        }), 500

@app.get("/api/incidencias")
def listar_incidencias():
    try:
        with obtener_conexion() as conexion:
            with conexion.cursor() as cursor:
                cursor.execute("""
                    SELECT
                        i.id,
                        i.codigo,
                        c.nombre AS categoria,
                        i.descripcion,
                        i.latitud,
                        i.longitud,
                        i.origen,
                        i.prioridad,
                        e.nombre AS estado,
                        i.fecha_reporte
                    FROM incidencias i
                    INNER JOIN categorias c
                        ON i.categoria_id = c.id
                    INNER JOIN estados e
                        ON i.estado_id = e.id
                    ORDER BY i.fecha_reporte DESC;
                """)

                filas = cursor.fetchall()

        incidencias = []

        for fila in filas:
            incidencias.append({
                "id": fila[0],
                "codigo": fila[1],
                "categoria": fila[2],
                "descripcion": fila[3],
                "latitud": fila[4],
                "longitud": fila[5],
                "origen": fila[6],
                "prioridad": fila[7],
                "estado": fila[8],
                "fecha_reporte": fila[9].isoformat()
            })

        return jsonify({
            "ok": True,
            "total": len(incidencias),
            "incidencias": incidencias
        })

    except Exception as error:
        return jsonify({
            "ok": False,
            "mensaje": "Error al consultar incidencias",
            "error": str(error)
        }), 500

@app.patch("/api/incidencias/<int:incidencia_id>/estado")
@requiere_operador
def cambiar_estado_incidencia(incidencia_id):
    try:
        datos = request.get_json(silent=True) or {}

        nuevo_estado = datos.get("estado", "").upper()
        observacion = datos.get("observacion", "")

        if not nuevo_estado:
            return jsonify({
                "ok": False,
                "mensaje": "Debe indicar el nuevo estado"
            }), 400

        transiciones = {
            "PENDIENTE_VALIDACION": ["VALIDADO", "DESCARTADO"],
            "VALIDADO": ["EN_ATENCION"],
            "EN_ATENCION": ["SOLUCIONADO"],
            "SOLUCIONADO": [],
            "DESCARTADO": []
        }

        with obtener_conexion() as conexion:
            with conexion.cursor() as cursor:

                # Buscar incidencia y estado actual
                cursor.execute("""
                    SELECT
                        i.estado_id,
                        e.nombre
                    FROM incidencias i
                    INNER JOIN estados e
                        ON i.estado_id = e.id
                    WHERE i.id = %s;
                """, (incidencia_id,))

                incidencia = cursor.fetchone()

                if incidencia is None:
                    return jsonify({
                        "ok": False,
                        "mensaje": "La incidencia no existe"
                    }), 404

                estado_anterior_id = incidencia[0]
                estado_anterior = incidencia[1]

                # Comprobar transición permitida
                permitidos = transiciones.get(estado_anterior, [])

                if nuevo_estado not in permitidos:
                    return jsonify({
                        "ok": False,
                        "mensaje": "Cambio de estado no permitido",
                        "estado_actual": estado_anterior,
                        "estados_permitidos": permitidos
                    }), 400

                # Buscar ID del nuevo estado
                cursor.execute("""
                    SELECT id
                    FROM estados
                    WHERE nombre = %s;
                """, (nuevo_estado,))

                resultado_estado = cursor.fetchone()

                if resultado_estado is None:
                    return jsonify({
                        "ok": False,
                        "mensaje": "El estado solicitado no existe"
                    }), 400

                nuevo_estado_id = resultado_estado[0]

                # Actualizar incidencia
                cursor.execute("""
                    UPDATE incidencias
                    SET estado_id = %s
                    WHERE id = %s;
                """, (
                    nuevo_estado_id,
                    incidencia_id
                ))

                # Registrar historial
                cursor.execute("""
                    INSERT INTO historial_incidencias (
                        incidencia_id,
                        estado_anterior,
                        estado_nuevo,
                        observacion
                    )
                    VALUES (%s, %s, %s, %s);
                """, (
                    incidencia_id,
                    estado_anterior_id,
                    nuevo_estado_id,
                    observacion
                ))

                # Registrar auditoría
                cursor.execute("""
                    INSERT INTO auditoria (
                        incidencia_id,
                        accion,
                        tipo_actor
                    )
                    VALUES (%s, %s, %s);
                """, (
                    incidencia_id,
                    f"CAMBIO_ESTADO_{estado_anterior}_A_{nuevo_estado}",
                    "OPERADOR"
                ))

        return jsonify({
            "ok": True,
            "mensaje": "Estado actualizado correctamente",
            "incidencia_id": incidencia_id,
            "estado_anterior": estado_anterior,
            "estado_nuevo": nuevo_estado
        })

    except Exception as error:
        return jsonify({
            "ok": False,
            "mensaje": "Error al actualizar la incidencia",
            "error": str(error)
        }), 500

@app.get("/api/incidencias/<int:incidencia_id>/historial")
def obtener_historial(incidencia_id):
    try:
        with obtener_conexion() as conexion:
            with conexion.cursor() as cursor:

                cursor.execute("""
                    SELECT
                        h.id,
                        ea.nombre AS estado_anterior,
                        en.nombre AS estado_nuevo,
                        h.observacion,
                        h.fecha_hora
                    FROM historial_incidencias h

                    LEFT JOIN estados ea
                        ON h.estado_anterior = ea.id

                    INNER JOIN estados en
                        ON h.estado_nuevo = en.id

                    WHERE h.incidencia_id = %s

                    ORDER BY h.fecha_hora ASC;
                """, (incidencia_id,))

                filas = cursor.fetchall()

        historial = []

        for fila in filas:
            historial.append({
                "id": fila[0],
                "estado_anterior": fila[1],
                "estado_nuevo": fila[2],
                "observacion": fila[3],
                "fecha_hora": fila[4].isoformat()
            })

        return jsonify({
            "ok": True,
            "incidencia_id": incidencia_id,
            "total": len(historial),
            "historial": historial
        })

    except Exception as error:
        return jsonify({
            "ok": False,
            "mensaje": "Error al consultar historial",
            "error": str(error)
        }), 500

@app.get("/api/auditoria")
def listar_auditoria():
    try:
        with obtener_conexion() as conexion:
            with conexion.cursor() as cursor:
                cursor.execute("""
                    SELECT
                        a.id,
                        a.incidencia_id,
                        i.codigo,
                        a.accion,
                        a.tipo_actor,
                        a.identificador_anonimo,
                        a.fecha_hora
                    FROM auditoria a

                    LEFT JOIN incidencias i
                        ON a.incidencia_id = i.id

                    ORDER BY a.fecha_hora DESC;
                """)

                filas = cursor.fetchall()

        registros = []

        for fila in filas:
            registros.append({
                "id": fila[0],
                "incidencia_id": fila[1],
                "codigo_incidencia": fila[2],
                "accion": fila[3],
                "tipo_actor": fila[4],
                "identificador_anonimo": fila[5],
                "fecha_hora": fila[6].isoformat()
            })

        return jsonify({
            "ok": True,
            "total": len(registros),
            "auditoria": registros
        })

    except Exception as error:
        return jsonify({
            "ok": False,
            "mensaje": "Error al consultar auditoría",
            "error": str(error)
        }), 500

@app.post("/api/auth/login")
def login_operador():
    try:
        datos = request.get_json(silent=True) or {}

        codigo = datos.get("codigo", "").strip().upper()
        password = datos.get("password", "")

        if not codigo or not password:
            return jsonify({
                "ok": False,
                "mensaje": "Código y contraseña son obligatorios"
            }), 400

        with obtener_conexion() as conexion:
            with conexion.cursor() as cursor:

                cursor.execute("""
                    SELECT password_hash, activo
                    FROM operadores
                    WHERE codigo = %s;
                """, (codigo,))

                operador = cursor.fetchone()

                if (
                    operador is None
                    or not operador[1]
                    or not check_password_hash(
                        operador[0],
                        password
                    )
                ):
                    return jsonify({
                        "ok": False,
                        "mensaje": "Credenciales incorrectas"
                    }), 401

                token = generar_token_operador(codigo)

                cursor.execute("""
                    INSERT INTO auditoria (
                        accion,
                        tipo_actor,
                        identificador_anonimo
                    )
                    VALUES (%s, %s, %s);
                """, (
                    "LOGIN_OPERADOR",
                    "OPERADOR",
                    codigo
                ))

        return jsonify({
            "ok": True,
            "mensaje": "Inicio de sesión correcto",
            "operador": codigo,
            "token": token
        })

    except Exception as error:
        return jsonify({
            "ok": False,
            "mensaje": "Error al iniciar sesión",
            "error": str(error)
        }), 500

       
if __name__ == "__main__":
    app.run(debug=True)