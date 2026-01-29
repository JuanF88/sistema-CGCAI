# 🔧 Script de Migración de Nombres de Archivos

## Problema que resuelve

Cuando cambias la fecha de una auditoría, los archivos subidos "desaparecen" porque el nombre incluía la fecha:

```
❌ Nombre antiguo: PlanAuditoria_123_CONTADURIA_2026-01-20.pdf
✅ Nombre nuevo:   PlanAuditoria_123_CONTADURIA.pdf
```

## Cómo ejecutar

### 1. Asegúrate de tener las variables de entorno

Tu archivo `.env.local` debe contener:

```env
NEXT_PUBLIC_SUPABASE_URL=https://wplfupxbqtpvwcdtqedw.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_clave_aqui
```

### 2. Ejecuta el script

```powershell
npm run migrate:files
```

## Qué hace el script

1. ✅ Se conecta a Supabase
2. ✅ Lista archivos en 6 buckets:
   - planes
   - asistencias
   - evaluaciones
   - actas
   - actascompromiso
   - validaciones
3. ✅ Identifica archivos con fecha al final (patrón `_YYYY-MM-DD.pdf`)
4. ✅ Crea una copia sin la fecha
5. ✅ Elimina el archivo antiguo
6. ✅ Muestra progreso y resumen

## Ejemplo de salida

```
╔════════════════════════════════════════════════════════════╗
║   🔧 Script de Migración de Nombres de Archivos           ║
║   Elimina fechas al final de nombres de archivos          ║
╚════════════════════════════════════════════════════════════╝

📂 Procesando bucket: planes
────────────────────────────────────────────────────────────
   🔄 Renombrando:
      De: PlanAuditoria_123_CONTADURIA_2026-01-20.pdf
      A:  PlanAuditoria_123_CONTADURIA.pdf
      ✅ Migrado exitosamente

   📊 Resultado: 5 exitosos, 0 fallidos, 2 omitidos

📂 Procesando bucket: asistencias
────────────────────────────────────────────────────────────
   🔄 Renombrando:
      De: Asistencia_456_SISTEMAS_2026-01-15.pdf
      A:  Asistencia_456_SISTEMAS.pdf
      ✅ Migrado exitosamente

   📊 Resultado: 3 exitosos, 0 fallidos, 0 omitidos

════════════════════════════════════════════════════════════
📊 RESUMEN FINAL
════════════════════════════════════════════════════════════
✅ Archivos migrados: 15
❌ Errores: 0
⏭️  Omitidos (sin fecha): 2
════════════════════════════════════════════════════════════

🎉 ¡Migración completada exitosamente!
   Ahora los archivos mantienen el mismo nombre aunque cambies la fecha de auditoría.
```

## ⚠️ Notas importantes

1. **El script es seguro**: 
   - Primero **copia** el archivo
   - Solo **elimina** el antiguo si la copia fue exitosa

2. **Es idempotente**: 
   - Puedes ejecutarlo múltiples veces
   - Solo procesa archivos que aún tengan fecha

3. **No afecta la base de datos**:
   - Solo renombra archivos en Storage
   - Las referencias en BD siguen funcionando porque usan paths dinámicos

4. **Archivos omitidos**:
   - Archivos que ya no tienen fecha: se omiten (ya migrados)
   - Placeholders de carpetas: se ignoran

## Verificación después de migrar

1. Ve a Supabase Dashboard → Storage
2. Abre cada bucket (planes, asistencias, etc.)
3. Verifica que los archivos ahora tienen nombres como:
   - ✅ `PlanAuditoria_123_DEPENDENCIA.pdf`
   - ✅ `Asistencia_456_OTRA_DEP.pdf`
   - ❌ ~~`PlanAuditoria_123_DEPENDENCIA_2026-01-20.pdf`~~

4. Prueba en la app:
   - Cambia la fecha de una auditoría
   - Los archivos **siguen apareciendo** ✅

## En caso de error

Si ves errores como:
```
❌ Error copiando: Storage object not found
```

Posibles causas:
- El archivo fue eliminado manualmente
- Problemas de permisos en Supabase
- Bucket no existe

**Solución**: El script continúa con el siguiente archivo. Revisa los detalles del error.

## Soporte

Si necesitas ayuda:
1. Copia el error completo de la consola
2. Verifica que `.env.local` tiene las variables correctas
3. Verifica que tienes permisos en Supabase Storage
