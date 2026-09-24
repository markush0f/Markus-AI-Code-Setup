# Markus-AI-Code-Setup

| Herramienta | Uso principal | Configuración recomendada | Cuándo usarla | Link |
|---|---|---|---|---|
| Serena | Navegación y edición semántica del código | Solo language servers necesarios por proyecto | Siempre | https://github.com/oraios/serena |
| RTK | Reducir output de terminal enviado al agente | Global + hooks del agente | Siempre, especialmente tests/builds/logs | https://github.com/rtk-ai/rtk |
| Ponytail | Evitar overengineering y código innecesario | `full` | Siempre | https://github.com/DietrichGebert/ponytail |
| Caveman | Reducir respuestas y contexto verbal innecesario | `full` | Siempre | https://github.com/JuliusBrussee/caveman |
| Impeccable | Mejorar diseño, UX/UI, responsive, accesibilidad, jerarquía visual y evitar patrones genéricos de IA | Skill del proyecto + contexto de producto/diseño | Frontend, interfaces, dashboards, landing pages y componentes UI | https://github.com/pbakaus/impeccable |
| Context7 | Obtener documentación actualizada y específica de librerías, frameworks y APIs | Global, preferiblemente bajo demanda | Cuando el agente necesite documentación externa o APIs actuales | https://github.com/upstash/context7 |
| CodeGraph | Grafo de llamadas y relaciones del repositorio | Opcional | Solo si Serena no cubre bien relaciones/arquitectura | https://github.com/Lordymine/codegraph |
