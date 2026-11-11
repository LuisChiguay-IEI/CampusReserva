# Matriz de cumplimiento — Escala de Apreciación N°2 (Sumativa 3)

Autoevaluación de evidencia, no una calificación. "Informe" = `Informe_Final_CampusReserva_ES3_Luis_Chiguay.docx`.
Estados: **Cubierto** (hay evidencia verificable), **Cubierto con limitaciones** (evidencia parcial declarada), **Pendiente** (depende de una acción del estudiante).

| N° | Criterio (pts) | Dónde está la evidencia | Estado | Limitaciones / acción pendiente |
|---|---|---|---|---|
| 1 | Análisis completo, fundamentado y coherente con el caso (7) | Informe: Introducción (contexto, antecedentes de la ES2), I (trazabilidad RF/HU/KAN/AN/DET, decisiones abiertas resueltas), VI; `docs/decisiones-y-alcance.md` | Cubierto | Sin validación con usuarios reales ni con la institución (pendiente desde la ES2) |
| 2 | Introducción: contexto, importancia, implicancias y riesgos iniciales (5) | Informe: Introducción, tabla de riesgos R1–R9 | Cubierto | — |
| 3 | Objetivo general alineado a la problemática y límites del MVP (5) | Informe: Introducción > Objetivos; Alcance y limitaciones | Cubierto | — |
| 4 | ≥ 5 objetivos específicos coherentes (5) | Informe: 7 objetivos específicos vinculados a RF y a la verificación | Cubierto | — |
| 5 | Propuesta fundamentada con antecedentes funcionales (4) | Informe: I (trazabilidad con la ES2, resolución de su Tabla 22), Anexo B; `docs/decisiones-y-alcance.md` | Cubierto | Las figuras de Enterprise Architect de la ES2 se citan, no se reproducen (no estaba el .docx de la ES2 en el equipo) |
| 6 | Modelo cloud SaaS/IaaS/PaaS, impacto en la arquitectura y relación con el caso (4) | Informe: II.b (comparación, selección PaaS, impacto), diagrama de despliegue | Cubierto con limitaciones | PaaS es una **propuesta**: no se desplegó |
| 7 | Requerimientos según metodología y fiabilidad (8) | Informe: I (RF, HU, criterios), Metodología Kanban (columnas y WIP de la ES2, DoD); `docs/plan-pruebas.md` (35/35 CA cubiertos) | Cubierto | Reglas institucionales (plazo de cancelación, inhabilitación) siguen como propuestas |
| 8 | RNF de seguridad, disponibilidad, rendimiento y protección de datos (8) | Informe: tabla RNF-01 a RNF-11 con verificación y resultado; métricas reales | Cubierto con limitaciones | RNF-02 parcial (HTTPS solo con despliegue); RNF-09 disponibilidad **no verificada** |
| 9 | Principios éticos (integridad, calidad, responsabilidad) (8) | Informe: III > Principios éticos (ACM, SE Code, Colegio de Ingenieros); Anexo D | Cubierto | El estudiante debe **revisar y firmar** el Anexo D y decidir cómo declara el uso de IA según la política del curso |
| 10 | Cumplimiento normativo: confidencialidad, datos, acceso autorizado, resguardo (8) | Informe: III (normativa verificada, mapeo norma → riesgo → medida → código/prueba, brechas); `docs/investigacion-normativa.md` | Cubierto con limitaciones | No se declara cumplimiento legal total: faltan aviso de privacidad, derechos ARCO en la interfaz, retención de auditoría y procedimiento de vulneraciones |
| 11 | Medidas de seguridad dentro del marco metodológico (8) | Informe: Metodología (DoD con seguridad, columna En revisión, riesgos como casos de prueba); `docs/jira-actualizaciones.md` | Cubierto | Las tarjetas de Jira deben actualizarse manualmente para que el tablero lo refleje |
| 12 | Código legible, modular, estructurado y documentado (8) | Repositorio `src/` (capas, JSDoc, comentarios), cobertura 96,58 %; Informe IV y Anexo A | Cubierto | — |
| 13 | Interfaces principales con datos de prueba coherentes (6) | 27 capturas reales (`docs/evidencias/capturas`), seed ficticio; Informe V.c | Cubierto | — |
| 14 | Plan de Pruebas Integral: casos, criterios de aceptación, procedimientos y cobertura/trazabilidad (8) | `docs/plan-pruebas.md`; Informe VI (estrategia, trazabilidad RF/HU → CA → CP, casos detallados, resultados, cobertura) | Cubierto con limitaciones | **Pruebas de usuario pendientes** (procedimiento listo en `docs/pruebas-usuario.md`) |
| 15 | ≥ 3 medidas OWASP Top 10 pertinentes (4) | Informe IV (A01, A05, A07 detalladas + tabla de 9 categorías con líneas de código y pruebas) | Cubierto | — |
| 16 | Conclusión técnica clara, aprendizajes, aportes y limitaciones (4) | Informe: Conclusiones y recomendaciones | Cubierto | — |

## Requisitos de las instrucciones (fuera de la escala)

| Requisito | Estado | Acción |
|---|---|---|
| Informe de documentación final | Generado (`dist/`), con el enlace de GitHub en V.d | Revisar y firmar el Anexo D |
| Plataforma colaborativa con avance de actividades (Jira) | **Pendiente (manual)** | Aplicar `docs/jira-actualizaciones.md` |
| Control de versiones en GitHub | Cumplido: https://github.com/LuisChiguay-IEI/CampusReserva (público, rama `main`) | Mantener sincronizado con `git push` |
| Apartados obligatorios (requerimientos, arquitectura UML, tecnologías, funcionalidades, repositorio, pruebas, métricas, problemas) | Cubiertos en el Informe | — |
