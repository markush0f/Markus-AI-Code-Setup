# AI-Setup

| Herramienta | Uso principal | Configuración recomendada | Cuándo usarla | Link |
|---|---|---|---|---|
| Serena | Navegación y edición semántica del código | Solo language servers necesarios por proyecto | Siempre | https://github.com/oraios/serena |
| RTK | Reducir output de terminal enviado al agente | Global + hooks del agente | Siempre, especialmente tests/builds/logs | https://github.com/rtk-ai/rtk |
| Ponytail | Evitar overengineering y código innecesario | `full` | Siempre | https://github.com/DietrichGebert/ponytail |
| Caveman | Reducir respuestas y contexto verbal innecesario | `full` | Siempre | https://github.com/JuliusBrussee/caveman |
| CodeGraph | Grafo de llamadas y relaciones del repositorio | Opcional | Solo si Serena no cubre bien relaciones/arquitectura | https://github.com/Lordymine/codegraph |

## Modelos

| Modelo | Uso | Prioridad |
|---|---|---|
| Composer 2.5 | CRUD, tests, cambios pequeños, tareas mecánicas | Alta |
| Grok 4.7 Medium | Implementaciones complejas, debugging, refactors, arquitectura | Principal |
| GPT-5.6 Sol | Problemas difíciles que Grok no resuelva bien | Escalado |
| Claude | Problemas difíciles donde aporte mejores resultados | Escalado |

## Serena por proyecto

| Proyecto / Stack | Language Servers |
|---|---|
| Java + TypeScript | `java`, `typescript` |
| Rust | `rust` |
| Python | `python` |
| React / Expo | `typescript` |
| Spring Boot | `java` |
| Vue | `vue` |
| Svelte | `svelte` |

## Flujo recomendado

| Paso | Acción |
|---:|---|
| 1 | Nueva tarea → nuevo chat |
| 2 | Elegir Composer o Grok |
| 3 | Usar Serena para explorar el código |
| 4 | Ponytail para mantener la solución mínima |
| 5 | Caveman para respuestas compactas |
| 6 | RTK para comandos, tests, builds y logs |
| 7 | Escalar a Sol/Claude solo si es necesario |
| 8 | Nueva tarea no relacionada → nuevo chat |
