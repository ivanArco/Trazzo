-- Esquema de la base de datos de Trazzo (instalación desde cero)
-- Uso: mysql -u root -p -P 3307 < database/schema.sql
-- Después crea el primer administrador con: pnpm migrar -- --admin "Nombre" correo@trazzo.mx contraseña
-- (pnpm migrar también crea estas tablas si faltan, así que este archivo es opcional)

CREATE DATABASE IF NOT EXISTS trazzo CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE trazzo;
SELECT * FROM trazzo.usuarios;
SELECT * FROM trazzo.unidades;
SELECT * FROM trazzo.viajes;

DELETE FROM usuarios WHERE id = 9;
CREATE TABLE IF NOT EXISTS usuarios (
  id INT NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(100) NOT NULL,
  correo VARCHAR(100) NOT NULL,
  contraseña VARCHAR(255) NOT NULL,          -- hash de bcrypt, nunca texto plano
  rol ENUM('admin', 'capturista', 'operador', 'cliente') NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY correo (correo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Camiones de la flota
CREATE TABLE IF NOT EXISTS unidades (
  id INT NOT NULL AUTO_INCREMENT,
  placas VARCHAR(15) NOT NULL,
  marca_modelo VARCHAR(60) NOT NULL,
  anio SMALLINT NOT NULL,
  capacidad_kg INT NOT NULL,
  poliza VARCHAR(30) NULL,
  estado ENUM('disponible', 'en_ruta', 'taller') NOT NULL DEFAULT 'disponible',
  PRIMARY KEY (id),
  UNIQUE KEY placas (placas)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Cada viaje de carga: se registra, se asigna y se sigue hasta la entrega
CREATE TABLE IF NOT EXISTS viajes (
  id INT NOT NULL AUTO_INCREMENT,
  folio VARCHAR(12) NULL,                    -- TRZ-0001, se genera con el id
  origen VARCHAR(150) NOT NULL,
  destino VARCHAR(150) NOT NULL,
  gps_origen VARCHAR(255) NULL,
  gps_destino VARCHAR(255) NULL,
  mercancia VARCHAR(255) NOT NULL,
  peso_kg INT NOT NULL,
  num_unidades SMALLINT NOT NULL DEFAULT 1,
  flete DECIMAL(12, 2) NOT NULL DEFAULT 0,
  cliente VARCHAR(120) NOT NULL,
  salida DATETIME NOT NULL,
  distancia_km DECIMAL(7, 1) NULL,          -- calculadas con OpenStreetMap al registrar
  duracion_min INT NULL,                     -- tiempo estimado en camión
  estado ENUM('pendiente', 'asignado', 'en_ruta', 'retraso', 'entregado', 'cancelado') NOT NULL DEFAULT 'pendiente',
  avance TINYINT UNSIGNED NOT NULL DEFAULT 0, -- porcentaje del recorrido
  eta DATETIME NULL,                          -- hora estimada de llegada
  operador_id INT NULL,
  unidad_id INT NULL,
  creado_por INT NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  entregado_en DATETIME NULL,
  rastreo_token VARCHAR(43) NULL,            -- enlace público de rastreo para el cliente (QR)
  PRIMARY KEY (id),
  UNIQUE KEY folio (folio),
  UNIQUE KEY rastreo_token (rastreo_token),
  KEY estado (estado),
  CONSTRAINT fk_viaje_operador FOREIGN KEY (operador_id) REFERENCES usuarios (id) ON DELETE SET NULL,
  CONSTRAINT fk_viaje_unidad FOREIGN KEY (unidad_id) REFERENCES unidades (id) ON DELETE SET NULL,
  CONSTRAINT fk_viaje_creador FOREIGN KEY (creado_por) REFERENCES usuarios (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Historial de cada viaje (alimenta las alertas y la línea de tiempo del seguimiento)
CREATE TABLE IF NOT EXISTS eventos_viaje (
  id INT NOT NULL AUTO_INCREMENT,
  viaje_id INT NOT NULL,
  tipo ENUM('creado', 'asignado', 'en_ruta', 'retraso', 'entregado', 'cancelado', 'avance', 'panico') NOT NULL,
  descripcion VARCHAR(255) NOT NULL,
  usuario_id INT NULL,                        -- NULL = lo generó el sistema (simulador)
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY viaje (viaje_id),
  CONSTRAINT fk_evento_viaje FOREIGN KEY (viaje_id) REFERENCES viajes (id) ON DELETE CASCADE,
  CONSTRAINT fk_evento_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Botón de pánico: el operador lo activa desde la app móvil (robo de la unidad u otra emergencia)
-- y los administradores lo ven en la web. Solo puede haber una alerta activa por operador.
CREATE TABLE IF NOT EXISTS alertas_panico (
  id INT NOT NULL AUTO_INCREMENT,
  operador_id INT NOT NULL,
  viaje_id INT NULL,                          -- viaje activo del operador al activar la alerta
  unidad_id INT NULL,
  estado ENUM('activa', 'atendida', 'falsa_alarma') NOT NULL DEFAULT 'activa',
  lat DECIMAL(9, 6) NULL,                     -- última ubicación conocida (NULL si no hubo GPS)
  lon DECIMAL(9, 6) NULL,
  precision_m INT NULL,                       -- radio de precisión del GPS en metros
  ubicacion_en DATETIME NULL,                 -- hora de la última ubicación
  nota VARCHAR(255) NULL,                     -- lo que escribió el operador (opcional)
  creada_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atendida_por INT NULL,
  atendida_en DATETIME NULL,
  resolucion VARCHAR(255) NULL,               -- lo que anotó el administrador al cerrarla
  PRIMARY KEY (id),
  KEY estado (estado),
  KEY operador (operador_id),
  CONSTRAINT fk_alerta_operador FOREIGN KEY (operador_id) REFERENCES usuarios (id) ON DELETE CASCADE,
  CONSTRAINT fk_alerta_viaje FOREIGN KEY (viaje_id) REFERENCES viajes (id) ON DELETE SET NULL,
  CONSTRAINT fk_alerta_unidad FOREIGN KEY (unidad_id) REFERENCES unidades (id) ON DELETE SET NULL,
  CONSTRAINT fk_alerta_atendio FOREIGN KEY (atendida_por) REFERENCES usuarios (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Recorrido de la unidad mientras la alerta está activa (la app manda la ubicación cada ~30 s)
CREATE TABLE IF NOT EXISTS ubicaciones_panico (
  id INT NOT NULL AUTO_INCREMENT,
  alerta_id INT NOT NULL,
  lat DECIMAL(9, 6) NOT NULL,
  lon DECIMAL(9, 6) NOT NULL,
  precision_m INT NULL,
  registrada_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY alerta (alerta_id),
  CONSTRAINT fk_ubicacion_alerta FOREIGN KEY (alerta_id) REFERENCES alertas_panico (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
