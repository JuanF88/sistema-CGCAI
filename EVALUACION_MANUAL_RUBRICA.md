# Evaluación Manual de Auditores - Rúbrica

## Descripción General

La evaluación manual con rúbrica es uno de los 3 componentes de la evaluación integral de auditores en el sistema CGCAI:

1. **Archivos** (33.33%): Verificación automática de documentos cargados
2. **Encuestas** (33.33%): Respuestas de evaluación importadas desde Google Forms
3. **Rúbrica Manual** (33.33%): Evaluación cualitativa por criterios técnicos

## Estructura de la Rúbrica

La rúbrica evalúa **6 criterios fundamentales** basados en el archivo `Rubrica.xlsx`:

### Criterio 1: Identificación del Informe
- **Descripción**: Exactitud y completitud en la codificación, nombre del proceso, fecha, versión, etc.
- **Peso**: 16.67% (1/6)
- **Escala**: 1 a 4 puntos

### Criterio 2: Objetivo y Alcance de la Auditoría
- **Descripción**: Claridad en la definición del objetivo y alcance, coherencia con el programa de auditoría
- **Peso**: 16.67% (1/6)
- **Escala**: 1 a 4 puntos

### Criterio 3: Oportunidades de Mejora
- **Descripción**: Registro preciso y sustentado de oportunidades de mejora con evidencia objetiva
- **Peso**: 16.67% (1/6)
- **Escala**: 1 a 4 puntos

### Criterio 4: No Conformidades
- **Descripción**: Registro preciso y sustentado de No Conformidades con evidencia objetiva
- **Peso**: 16.67% (1/6)
- **Escala**: 1 a 4 puntos

### Criterio 5: Redacción y Lenguaje Técnico
- **Descripción**: Claridad, coherencia, ortografía, uso de terminología adecuada y estilo profesional
- **Peso**: 16.67% (1/6)
- **Escala**: 1 a 4 puntos

### Criterio 6: Análisis Crítico y Valor Agregado
- **Descripción**: Aporte reflexivo y valor agregado al proceso/dependencia auditada
- **Peso**: 16.67% (1/6)
- **Escala**: 1 a 4 puntos

## Niveles de Evaluación

Cada criterio puede recibir una de estas 7 calificaciones:

| Puntos | Nivel | Descripción General |
|--------|-------|---------------------|
| **4.0** | Excelente o Ejemplar | Cumplimiento total, máxima calidad |
| **3.8** | Destacable | Muy bueno con detalles menores mejorables |
| **3.5** | Muy bueno | Buen desempeño con aspectos a mejorar |
| **3.3** | Óptimo | Adecuado con algunas deficiencias |
| **3.0** | Aceptable | Mínimo aceptable con errores menores |
| **2.0** | Deficiente | Incompleto o con errores significativos |
| **1.0** | Insuficiente | No cumple con los requisitos mínimos |

## Cálculo de la Nota de Rúbrica

La nota de rúbrica se calcula en **dos pasos**:

### Paso 1: Promedio Simple (Escala 1-4)
```
Promedio_Rúbrica = (C1 + C2 + C3 + C4 + C5 + C6) / 6
```

### Paso 2: Normalización a Escala de 5
Como el sistema trabaja con escala de 0-5, se normaliza el promedio:
```
Nota_Rúbrica_Final = (Promedio_Rúbrica / 4) × 5
```

**Ejemplo**:
- Criterio 1: 4.0
- Criterio 2: 3.8
- Criterio 3: 3.5
- Criterio 4: 3.8
- Criterio 5: 4.0
- Criterio 6: 3.5

**Cálculo**:
1. Promedio: (4.0 + 3.8 + 3.5 + 3.8 + 4.0 + 3.5) / 6 = **3.77**
2. Normalización: (3.77 / 4) × 5 = **4.71**

**Resultado Final**: 4.71 / 5.00

### Tabla de Conversión

| Promedio (1-4) | Nota Final (0-5) |
|----------------|------------------|
| 4.0 | 5.00 |
| 3.8 | 4.75 |
| 3.5 | 4.38 |
| 3.3 | 4.13 |
| 3.0 | 3.75 |
| 2.0 | 2.50 |
| 1.0 | 1.25 |

## Cálculo de la Nota Final

La nota final del auditor combina las 3 fuentes con ponderación igual:

```sql
Nota_Final = (Nota_Archivos * 0.33) + (Nota_Encuesta * 0.33) + (Nota_Rúbrica * 0.33)
```

Esta nota final se calcula automáticamente mediante la función PostgreSQL `calcular_nota_final()` que se encuentra en:
```
sql/crear-tablas-evaluaciones.sql (líneas 276-328)
```

## Flujo de Evaluación Manual

### 1. Seleccionar Auditor
- Ir a la pestaña **"Evaluación Manual"**
- Visualizar lista de auditores del periodo seleccionado
- Hacer clic en **"Evaluar"** o **"Editar"** (si ya tiene evaluación previa)

### 2. Evaluar Criterios
- Para cada uno de los 6 criterios:
  - Leer la descripción del criterio
  - Revisar las opciones de calificación (1.0 a 4.0)
  - Seleccionar el nivel que mejor describe el desempeño
- La nota se calcula automáticamente en tiempo real

### 3. Guardar Evaluación
- Revisar la **nota calculada** en la parte superior
- Hacer clic en **"💾 Guardar Evaluación"**
- El sistema:
  - Guarda las respuestas en `evaluaciones_auditores.rubrica_respuestas` (JSONB)
  - Actualiza `evaluaciones_auditores.nota_rubrica`
  - **Recalcula automáticamente** `evaluaciones_auditores.nota_final`

## Almacenamiento en Base de Datos

### Tabla: evaluaciones_auditores

```sql
-- Campos relacionados con rúbrica
nota_rubrica NUMERIC(3,2)              -- Nota calculada (0-5)
rubrica_id UUID                        -- Referencia a rúbrica (futuro)
rubrica_respuestas JSONB               -- Respuestas por criterio
```

### Estructura de rubrica_respuestas (JSONB)

```json
{
  "c1": 4.0,
  "c2": 3.8,
  "c3": 3.5,
  "c4": 3.8,
  "c5": 4.0,
  "c6": 3.5
}
```

## API Endpoints

### POST /api/evaluaciones-auditores/guardar-rubrica

Guarda o actualiza la evaluación de rúbrica de un auditor.

**Request Body**:
```json
{
  "evaluacion_id": "uuid-de-la-evaluacion",
  "rubrica_respuestas": {
    "c1": 4.0,
    "c2": 3.8,
    "c3": 3.5,
    "c4": 3.8,
    "c5": 4.0,
    "c6": 3.5
  },
  "nota_rubrica": 3.77
}
```

**Response (Success)**:
```json
{
  "success": true,
  "message": "Evaluación de rúbrica guardada exitosamente",
  "data": [...],
  "nota_final_recalculada": true
}
```

**Response (Error)**:
```json
{
  "error": "Descripción del error"
}
```

## Componente Frontend

**Ubicación**: `src/components/admin/VistaEvaluacionAuditores.jsx`

### Estados Principales:
- `auditorSeleccionado`: Evaluación actual en edición
- `calificaciones`: Objeto con las calificaciones de cada criterio
- `RUBRICA_CRITERIOS`: Estructura completa de la rúbrica (6 criterios)

### Funciones Clave:
- `seleccionarAuditor(evaluacion)`: Carga datos del auditor a evaluar
- `actualizarCalificacion(criterioId, valor)`: Actualiza un criterio
- `calcularNotaRubrica()`: Calcula promedio en tiempo real
- `guardarEvaluacionRubrica()`: Envía datos al API
- `cancelarEvaluacion()`: Descarta cambios no guardados

## Estilos CSS

**Ubicación**: `src/components/admin/CSS/VistaEvaluacionAuditores.module.css`

### Clases Principales:
- `.evaluacionForm`: Contenedor del formulario
- `.criterioCard`: Tarjeta de cada criterio
- `.nivelesContainer`: Opciones de calificación
- `.nivelSeleccionado`: Nivel activo (seleccionado)
- `.notaPreview`: Banner con nota calculada
- `.evaluacionAcciones`: Botones de acción

## Validaciones

### Frontend:
- ✅ Advertencia si hay criterios sin calificar
- ✅ Confirmación antes de cancelar con cambios no guardados
- ✅ Cálculo en tiempo real de la nota

### Backend:
- ✅ Validación de `evaluacion_id` requerido
- ✅ Validación de `rubrica_respuestas` como objeto válido
- ✅ Validación de `nota_rubrica` en rango 0-5
- ✅ Recálculo automático de nota final

## Futuras Mejoras

1. **Rúbricas Configurables**: Permitir crear múltiples rúbricas con diferentes criterios
2. **Comentarios por Criterio**: Agregar campo de texto para justificar la calificación
3. **Histórico de Cambios**: Registrar quién y cuándo modificó cada evaluación
4. **Exportación de Rúbricas**: Generar PDF con la evaluación completa
5. **Análisis Comparativo**: Gráficos de radar comparando auditores

## Troubleshooting

### Error: "evaluacion_id es requerido"
**Causa**: No se está enviando el ID de la evaluación al API  
**Solución**: Verificar que `auditorSeleccionado.id` esté definido

### Error: "nota_rubrica debe estar entre 0 y 5"
**Causa**: El cálculo devuelve un valor fuera de rango  
**Solución**: Revisar que las calificaciones sean valores válidos (1-4)

### Error: "No se pudo recalcular la nota final"
**Causa**: La función SQL `calcular_nota_final` no está disponible  
**Solución**: Ejecutar el script `sql/crear-tablas-evaluaciones.sql` en Supabase

### No se guardan las calificaciones
**Causa**: Problema de conexión con Supabase  
**Solución**: Verificar variables de entorno `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`

## Contacto y Soporte

Para reportar problemas o sugerencias relacionadas con la evaluación manual:
- Revisar los logs del navegador (F12 > Console)
- Verificar los logs del servidor en la terminal
- Consultar la documentación de Supabase para errores de base de datos
