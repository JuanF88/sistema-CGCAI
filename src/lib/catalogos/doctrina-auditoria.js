/**
 * El marco con el que se juzga un informe de auditoría en la CGCAI.
 *
 * Sin esto el modelo opina desde lo genérico: dice «podrías ser más
 * específico» donde un auditor diría «unas conclusiones deben sostenerse en
 * los hallazgos». Aquí está el criterio con el que se corrige de verdad.
 *
 * ── De dónde sale ──
 * De dos documentos de `public/documentos de contexto`:
 *   · NTC-ISO 19011:2018, directrices para la auditoría de sistemas de gestión
 *   · Guía Metodológica para la Gestión de Indicadores V6 (Universidad del
 *     Cauca, 2024), documento propio de la institución
 *
 * Está redactado con nuestras palabras, no copiado: la 19011 es de ICONTEC y
 * su texto no se reproduce. Las definiciones institucionales sí son de la
 * Universidad y por eso se recogen con su significado exacto —la regla de uno
 * o dos periodos, por ejemplo, es una regla concreta que se puede auditar—.
 *
 * ── Por qué es una constante y no algo que se consulte ──
 * No cambia entre auditorías. Va siempre en el mismo sitio del mensaje, antes
 * de lo que escribe el auditor, para que la parte estable entre en caché.
 */

export const DOCTRINA_AUDITORIA = `MARCO DE REFERENCIA

Objetivo de una auditoría individual (NTC-ISO 19011:2018)
- Define qué se va a lograr con esa auditoría concreta y debe ser coherente con los objetivos globales del programa. Esa coherencia es justo lo que se está revisando.
- Suele consistir en alguna de estas cosas: determinar el grado de conformidad del sistema —o de una parte— frente a los criterios de auditoría; evaluar la capacidad del sistema para cumplir requisitos legales y otros que la institución haya asumido; evaluar su eficacia para lograr los resultados previstos; identificar oportunidades de mejora; evaluar su idoneidad frente al contexto y la dirección estratégica; o evaluar su capacidad de alcanzar objetivos y de tratar riesgos y oportunidades.
- El alcance es otra cosa: es dónde y sobre qué periodo se audita. Un texto que solo dice qué dependencia se audita no es un objetivo.

Conclusiones (NTC-ISO 19011:2018)
- Son el resultado de la auditoría tras considerar los objetivos y TODOS los hallazgos. Unas conclusiones que no se apoyan en hallazgos, o que no responden al objetivo planteado, están mal construidas por definición, aunque suenen bien.
- Los hallazgos resultan de comparar la evidencia recopilada con los criterios de auditoría. Pueden indicar conformidad o no conformidad, y dar lugar a oportunidades de mejora o al registro de buenas prácticas.
- Conviene que las conclusiones se sostengan en evidencia objetiva y no en impresiones.

Vocabulario institucional (Universidad del Cauca)
- Corrección: acción inmediata sobre la no conformidad. En indicadores, se aplica cuando no se logra la meta en UN periodo.
- Acción correctiva: actúa sobre la causa para que no vuelva a ocurrir. En indicadores, se emprende cuando se incumple la meta en DOS periodos sucesivos.
- Eficacia: grado en que se realizan las actividades planificadas y se logran los resultados planificados.
- Eficiencia: relación entre el resultado alcanzado y los recursos utilizados.
- Efectividad: relaciona eficacia con eficiencia y considera el impacto.
- Monitoreo: lo hace el responsable del área funcional; observa y registra la evolución. Es revisión interna.
- Seguimiento: lo hacen el Centro de Gestión de la Calidad y la Oficina de Planeación; compara resultados con metas y estándares.
- Evaluación: la hacen Control Interno y Planeación; análisis periódico y más profundo del impacto y la eficacia.
- Los tres son cosas distintas y con responsables distintos: no usarlos como sinónimos.

Indicadores (Guía Metodológica de Gestión de Indicadores V6)
- Tipos: de producto, de proceso y de resultado. Categorías: de eficacia, de eficiencia y de efectividad.
- Un indicador debe ser pertinente, independiente de factores no controlables, de costo razonable, confiable, simple, oportuno, no repetitivo, focalizado, participativo, disponible, sensible al cambio y útil para decidir.
- La ficha técnica del indicador es el documento donde se registran sus características, la medición y el análisis de resultados; en ella se registran también las correcciones y acciones correctivas.
- Los objetivos institucionales deben ser SMART y redactarse empezando por un verbo en infinitivo, diciendo qué se quiere, en qué proporción, en cuánto tiempo, cómo y para qué.`
