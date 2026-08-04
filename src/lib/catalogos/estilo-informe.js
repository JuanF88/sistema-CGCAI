/**
 * Cómo se redacta un informe de auditoría **en esta universidad**.
 *
 * `DOCTRINA_AUDITORIA` dice qué es un objetivo y qué son unas conclusiones
 * según la norma. Esto dice otra cosa: cómo se escriben aquí. Sin ello el
 * modelo corrige hacia un registro genérico y propone redacciones que ningún
 * auditor de la CGCAI reconocería como suyas.
 *
 * ── De dónde sale ──
 * De los informes reales de 2025 que están en
 * `public/documentos de contexto/auditorias`, todos en el formulario
 * PE-GS-2.2.1-FOR-14 v10:
 *   · Informe General de Auditoría — Control Interno (Gestión del Control)
 *   · Informe General de Auditoría — Medicina (Gestión Académica)
 *
 * La regla de las conclusiones no la escribimos nosotros: es el texto de
 * instrucción impreso en el propio formulario, y por eso va entrecomillado.
 * Los ejemplos son de la Universidad, documentos internos suyos, y van
 * abreviados: se conserva la estructura y el registro, no el caso.
 *
 * El tercer informe de la carpeta (CGCyAI) es un escaneo sin capa de texto y no
 * se pudo leer; si algún día se digitaliza, es el sitio para añadirlo.
 *
 * ── Por qué es una constante ──
 * Igual que la doctrina: no cambia entre auditorías, así que va en la cabecera
 * estable del mensaje y se cobra como entrada en caché.
 */

export const ESTILO_INFORME = `FORMATO INSTITUCIONAL DEL INFORME

La instrucción impresa en el formulario PE-GS-2.2.1-FOR-14 dice, sobre las conclusiones:
"Redactar conclusiones precisas, concisas y claras conforme a: conformidad de requisitos, implementación, mantenimiento y eficacia de la gestión de calidad, logro de los objetivos de auditoría, cobertura, alcance y cumplimiento de criterios."
Son los ejes que la institución espera ver. Unas conclusiones que no tocan ninguno no cumplen el formato aunque estén bien escritas.

Cómo se redacta el OBJETIVO aquí
- Dos o tres puntos, cada uno abierto por un verbo en infinitivo: Verificar, Evaluar, Identificar, Comprobar.
- Cada punto dice qué se verifica y para qué. El "para qué" no es adorno: es lo que lo ata al objetivo del programa.
- No cita numerales de norma: los numerales van en los criterios de la auditoría, no en el objetivo.
- No nombra la dependencia como si fuera el objetivo. Dónde se audita es alcance.
- Cuando el programa incluye gestión ambiental, uno de los puntos se dedica a ella —normalmente a política ambiental, aspectos ambientales, competencia o toma de conciencia del personal—.

Cómo se redactan las CONCLUSIONES aquí
- Van numeradas, precedidas de una frase de entrada del tipo "Del ejercicio de auditoría se concluye:".
- El primer punto se pronuncia sobre el logro de los objetivos de la auditoría y dice qué se logró constatar.
- El segundo se pronuncia sobre la conformidad con los criterios, y ahí es donde entran las salvedades, introducidas con "no obstante".
- El tercero da el estado del plan de mejoramiento de la auditoría anterior con cifras: porcentaje de avance y porcentaje de eficacia.
- El último puede recoger la disposición del equipo auditado. Es habitual y no es relleno.
- Se escribe en tercera persona y en presente: "el proceso presenta", "se evidencia", "se identifican". Nunca en primera persona.

EJEMPLO REAL 1 — Gestión del Control (Control Interno, 2025)
Objetivo:
"Evaluar si el proceso aplica la guía de indicadores como herramienta de seguimiento y medición, asegurando la confiabilidad de los datos y su utilización en la toma de decisiones. Identificar oportunidades de mejora en el proceso, verificando la aplicación de acciones que contribuyan a aumentar la eficacia, mitigar riesgos y la sostenibilidad del Sistema de Gestión de Calidad. Comprobar que el personal del proceso conoce la política ambiental, aspectos ambientales y ha recibido formación adecuada."
Conclusiones:
"Del ejercicio de auditoría se concluye: 1. Cumplimiento a los objetivos de la auditoría dado que se logró constatar que el proceso cuenta con mecanismos definidos para el seguimiento a indicadores y promueve la gestión del conocimiento mediante la capacitación del personal. 2. El proceso presenta conformidad con los criterios de auditoría; no obstante, se identifican avances inferiores a lo esperado en algunos planes de mejora, por lo que resulta pertinente revisar la eficacia del esquema de seguimiento institucional. 3. El proceso demuestra la gestión de las acciones derivadas de auditorías anteriores con un avance del 100%, alcanzando el cierre total del plan de mejora producto de la auditoría 2024, y alcanza el 83.3% en la eficacia de sus acciones. 4. La disposición, compromiso y colaboración del equipo auditado contribuyeron de manera significativa a la obtención de resultados consistentes."

EJEMPLO REAL 2 — Gestión Académica (programa de Medicina, 2025)
Objetivo:
"Verificar la implementación y uso efectivo de la guía de indicadores en el programa. Evaluar la promoción de la mejora continua en el proceso, fortaleciendo la eficacia del sistema de gestión de calidad. Verificar las responsabilidades asignadas, competencia y toma de conciencia del personal auditado respecto al sistema de gestión ambiental, la política ambiental, los aspectos ambientales asociados y las necesidades de formación."
Conclusiones:
"Se evidencia la conformidad con los requisitos de la auditoría. Se evidencia la madurez y continuidad en el Sistema de Gestión de Calidad. Se realiza cierre del plan de mejoramiento producto de la auditoría del año anterior, con las oportunidades de mejoramiento con avance superior al porcentaje previsto y alta eficacia, en la que se destaca el impacto del seguimiento a egresados para la toma de decisiones de ajuste curricular y la articulación de la política ambiental con los requisitos de norma."

Los ejemplos fijan el registro y la estructura, no el contenido. No los copies ni los cites: el auditor audita otro proceso.`
