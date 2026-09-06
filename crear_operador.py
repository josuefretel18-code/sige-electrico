from getpass import getpass
from werkzeug.security import generate_password_hash
from db import obtener_conexion


def crear_operador():
    codigo = input("Código del operador: ").strip().upper()

    if not codigo:
        print("El código es obligatorio.")
        return

    password = getpass("Contraseña: ")
    confirmacion = getpass("Confirmar contraseña: ")

    if password != confirmacion:
        print("Las contraseñas no coinciden.")
        return

    if len(password) < 8:
        print("La contraseña debe tener al menos 8 caracteres.")
        return

    password_hash = generate_password_hash(password)

    with obtener_conexion() as conexion:
        with conexion.cursor() as cursor:
            cursor.execute("""
                INSERT INTO operadores (
                    codigo,
                    password_hash,
                    activo
                )
                VALUES (%s, %s, TRUE)

                ON CONFLICT (codigo)
                DO UPDATE SET
                    password_hash = EXCLUDED.password_hash,
                    activo = TRUE;
            """, (
                codigo,
                password_hash
            ))

    print("Operador creado correctamente.")


if __name__ == "__main__":
    crear_operador()