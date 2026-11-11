# Investigación normativa y de referencias (verificada el 10-11-2026)

Fuentes oficiales consultadas: BCN LeyChile, Diario Oficial, owasp.org, nist.gov, acm.org / computer.org, ingenieros.cl.
Lo marcado **NO VERIFICADO** no pudo confirmarse en la fuente oficial.

## Normativa chilena

| Norma | Publicación (D.O.) | Vigencia al 10-11-2026 | Artículos pertinentes para CampusReserva |
|---|---|---|---|
| Ley 21.459 — Delitos informáticos (deroga Ley 19.223) | 20-06-2022 | Vigente | Art. 1 ataque a la integridad de un sistema; **Art. 2 acceso ilícito**; Art. 3 interceptación ilícita; Art. 4 ataque a la integridad de los datos; Art. 5 falsificación informática; Art. 6 receptación de datos; Art. 7 fraude informático; Art. 8 abuso de los dispositivos |
| Ley 19.628 — Protección de la vida privada | 28-08-1999 | Vigente (texto actual) | Art. 2 definiciones; Art. 4 consentimiento informado; Art. 7 deber de secreto; Art. 9 finalidad y exactitud; **Art. 11 cuidado con la debida diligencia**; Art. 12 derechos de acceso, rectificación, cancelación y bloqueo; Art. 23 indemnización |
| Ley 21.719 — Modifica Ley 19.628 y crea la Agencia de Protección de Datos Personales | 13-12-2024 | **No vigente**: rige desde el **01-12-2026** (art. 1° transitorio) | Art. 3 principios (licitud y lealtad, finalidad, proporcionalidad, calidad, responsabilidad, seguridad, transparencia e información, confidencialidad); Art. 14 quáter privacidad desde el diseño y por defecto; **Art. 14 quinquies medidas de seguridad**; Art. 14 sexies reporte de vulneraciones; Arts. 34–35 infracciones y multas |
| Ley 21.663 — Marco de Ciberseguridad | 08-04-2024 | Vigente desde 01-01-2025 | Obliga a servicios esenciales (art. 4) y operadores de importancia vital (arts. 5–6). La educación no figura en el art. 4: **no aplica directamente** a una institución privada de educación superior salvo calificación de la ANCI. Se usa solo como referencia de buenas prácticas |
| Constitución Política, art. 19 N°4 (reforma Ley 21.096) | 16-06-2018 | Vigente | Protección de datos personales como derecho fundamental |
| Ley 17.336 — Propiedad intelectual | 02-10-1970 | Vigente | Art. 3 N°16 protege programas computacionales; Art. 8 inc. 2 titularidad del software creado por trabajadores |

**Distinción clave:** la Ley 21.459 tipifica **delitos** (conductas de terceros que atacan sistemas o datos). Las Leyes 19.628/21.719 regulan **obligaciones del responsable** del tratamiento de datos personales. El prototipo no "cumple" una ley penal: aplica controles que reducen la probabilidad de que se cometan esos delitos contra él y que facilitan su detección.

## OWASP Top 10:2025 (versión final vigente)

A01 Broken Access Control · A02 Security Misconfiguration · A03 Software Supply Chain Failures · A04 Cryptographic Failures · A05 Injection · A06 Insecure Design · A07 Authentication Failures · A08 Software or Data Integrity Failures · A09 Security Logging & Alerting Failures · A10 Mishandling of Exceptional Conditions. Fecha exacta de publicación final: **NO VERIFICADA**.

- Password Storage Cheat Sheet: scrypt mínimo N=2^17, r=8, p=1 (Argon2id preferido: m=19 MiB, t=2, p=1).
- Session Management Cheat Sheet: regenerar ID al autenticar; cookies Secure, HttpOnly, SameSite, prefijo `__Host-`; expiración por inactividad 15–30 min (bajo riesgo) y absoluta 4–8 h; invalidar en el servidor al cerrar sesión; `Cache-Control: no-store`; ≥ 64 bits de entropía.

## Cloud (NIST SP 800-145, 2011)

- **SaaS**: el consumidor usa aplicaciones del proveedor; no controla infraestructura.
- **PaaS**: el consumidor despliega sus propias aplicaciones con lenguajes/herramientas del proveedor; controla la aplicación, no la infraestructura.
- **IaaS**: el consumidor aprovisiona cómputo, almacenamiento y red; controla SO, almacenamiento y aplicaciones.

## Códigos de ética

- ACM Code of Ethics and Professional Conduct (2018): 1.6 Respetar la privacidad; 1.7 Honrar la confidencialidad; 2.9 Diseñar e implementar sistemas robusta y usablemente seguros. (Fecha de adopción **NO VERIFICADA** en la fuente oficial.)
- Software Engineering Code of Ethics and Professional Practice v5.2 (ACM/IEEE-CS, 1999): 8 principios — Público, Cliente y empleador, Producto, Juicio, Gestión, Profesión, Colegas, Uno mismo.
- Código de Ética del Colegio de Ingenieros de Chile A.G. (aprobado 05-12-2012, vigente desde 01-01-2013).

## Referencias (APA 7)

- Association for Computing Machinery. (2018). *ACM code of ethics and professional conduct*. https://www.acm.org/code-of-ethics
- Colegio de Ingenieros de Chile A.G. (2012). *Código de ética*. https://www.ingenieros.cl/codigo-de-etica/
- Decreto 100 de 2005 [Ministerio Secretaría General de la Presidencia]. Texto refundido de la Constitución Política de la República de Chile. https://www.bcn.cl/leychile/navegar?idNorma=242302
- Gotterbarn, D., Miller, K., & Rogerson, S. (1999). *Software engineering code of ethics and professional practice* (Versión 5.2). ACM/IEEE-CS. https://www.acm.org/code-of-ethics/software-engineering-code
- Ley 17.336 de 1970. Sobre propiedad intelectual. https://www.bcn.cl/leychile/navegar?idNorma=28933
- Ley 19.628 de 1999. Sobre protección de la vida privada. https://www.bcn.cl/leychile/navegar?idNorma=141599
- Ley 21.096 de 2018. Consagra el derecho a protección de los datos personales. https://www.bcn.cl/leychile/navegar?idNorma=1119730
- Ley 21.459 de 2022. Establece normas sobre delitos informáticos. https://www.bcn.cl/leychile/navegar?idNorma=1177743
- Ley 21.663 de 2024. Ley marco de ciberseguridad. https://www.bcn.cl/leychile/navegar?idNorma=1202434
- Ley 21.719 de 2024. Regula la protección y el tratamiento de los datos personales y crea la Agencia de Protección de Datos Personales. https://www.bcn.cl/leychile/navegar?idNorma=1209272
- Mell, P., & Grance, T. (2011). *The NIST definition of cloud computing* (SP 800-145). NIST. https://doi.org/10.6028/NIST.SP.800-145
- OWASP Foundation. (2025). *OWASP Top 10:2025*. https://owasp.org/Top10/2025/
- OWASP Foundation. (s. f.). *Password storage cheat sheet*. Recuperado el 10-11-2026 de https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- OWASP Foundation. (s. f.). *Session management cheat sheet*. Recuperado el 10-11-2026 de https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
