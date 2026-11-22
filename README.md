# Ubicador óptimo de router WiFi

Aplicación web que encuentra el mejor lugar para poner un router WiFi dentro de una casa, usando **cálculo multivariable** (Matemáticas 3). Dibujas el plano (habitaciones, puertas, enchufe), ajustas el modelo de señal y la app calcula el punto óptimo.

> Proyecto académico de Ingeniería de Sistemas y Telecomunicaciones. Es un modelo simplificado, no está calibrado con mediciones reales.

## Qué hace

- Editor de plano: dibuja habitaciones (rectángulos que se ajustan a 0.5 m), pon o quita puertas de 1 m, borra, ubica el enchufe.
- Todos los muros tienen el mismo espesor y la misma pérdida de señal (parámetro L).
- Peso por habitación: la sala o el estudio pueden valer más que el baño.
- Mapa de calor de la señal con tu router actual o con el óptimo.
- Compara la cobertura actual contra la óptima.
- Modo con restricción: el router solo puede estar a cierta distancia del enchufe (cable).
- Plantillas (casa, apartamento), exportar/importar el plano en JSON y guardado automático en el navegador.

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Lenguaje | JavaScript (vanilla, sin frameworks ni build) |
| Interfaz | HTML5 + CSS3, dibujo con Canvas 2D |
| Pruebas | Node.js (`assert`), sin dependencias |
| Control de versiones | Git + GitHub |
| Despliegue | GitHub Pages con GitHub Actions |
| Editor | Visual Studio Code (+ extensión Live Server) |

No hay `npm install` ni compilación: es una página estática.

## Estructura

```
router-optimo/
├── index.html            Página principal
├── css/estilos.css       Estilos (modo claro y oscuro)
├── js/
│   ├── modelo.js         Matemáticas: señal, integral, gradiente, Hessiano, Lagrange
│   ├── planos.js         Plantillas y validación de planos
│   └── ui.js             Canvas, editor del plano y resultados
├── tests/modelo.test.js  Pruebas del modelo
├── .github/workflows/deploy.yml   Despliegue automático a GitHub Pages
├── package.json  .gitignore  LICENSE  README.md
```

## Ejecutar en tu computador

1. Instala [Visual Studio Code](https://code.visualstudio.com/) y la extensión **Live Server**.
2. Abre la carpeta del proyecto (`Archivo > Abrir carpeta`).
3. Clic derecho sobre `index.html` > **Open with Live Server**.

También funciona con doble clic en `index.html`, o con `npx serve .` si tienes Node.js.

Pruebas: `node tests/modelo.test.js` (o `npm test`).

## Cómo funciona (y qué tema del curso usa cada parte)

**Señal recibida** en un punto (x, y) cuando el router está en (x₀, y₀):

```
P = P₁ − 10·n·log₁₀(d) − L·(muros cruzados),   d = √((x−x₀)² + (y−y₀)²)
```

**Función objetivo** (cobertura ponderada), versión discreta de una integral doble sobre las habitaciones dibujadas:

```
F(x₀,y₀) = 100 · Σ wⱼ·σ((Pⱼ − P_min)/s) / Σ wⱼ   ≈   ∬ w(x,y)·σ(...) dA
```

| Tema | Dónde está |
|---|---|
| Regla de la cadena | P depende de d, y d de (x, y) (`senal` en `modelo.js`) |
| Integral en región no rectangular | `F`: suma sobre habitaciones de cualquier forma (L, T, etc.) |
| Derivadas parciales y gradiente | `grad` y `ascenso`: ∇F = (∂F/∂x₀, ∂F/∂y₀) |
| Máximos y mínimos | `hessiano`: det(H) > 0 y F_xx < 0 confirman un máximo |
| Multiplicadores de Lagrange | Con cable: ∇F = λ∇g, g = (x−xₑ)² + (y−yₑ)² − R² (`proj`, panel de resultados) |
| Derivada direccional | D_u F = ∇F · u, con la dirección elegida en el control |

Los muros hacen la señal discontinua, así que el Hessiano es aproximado y la app lo indica. Como F puede tener varios máximos locales, el óptimo se busca desde varios puntos de partida.

## Subir el proyecto a GitHub

1. Instala [Git](https://git-scm.com/downloads) y crea una cuenta en [github.com](https://github.com).
2. En github.com crea un repositorio nuevo llamado `router-optimo` (público, **sin** README ni .gitignore).
3. En la terminal de VS Code (`Terminal > Nueva terminal`), dentro de la carpeta del proyecto:

```bash
git init
git add .
git commit -m "Primera versión: ubicador óptimo de router"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/router-optimo.git
git push -u origin main
```

Si Git pide credenciales, inicia sesión desde el navegador cuando lo ofrezca, o usa un *Personal Access Token* en lugar de la contraseña (GitHub > Settings > Developer settings).

Antes de subir, cambia `TU NOMBRE` en el archivo `LICENSE`.

## Desplegar en GitHub Pages

1. En el repositorio: **Settings > Pages > Build and deployment > Source: GitHub Actions**.
2. Haz un `push` a `main` (o ve a la pestaña **Actions** y ejecuta «Desplegar en GitHub Pages»).
3. Cuando termine, la app queda en `https://TU_USUARIO.github.io/router-optimo/`.

El flujo ejecuta las pruebas antes de publicar: si una prueba falla, no se despliega.

## Agregar cambios después

```bash
git add .
git commit -m "Describe el cambio"
git push
```

Cada `push` a `main` vuelve a desplegar la página automáticamente (tarda 1 o 2 minutos).

## Problemas frecuentes

- **La página sale en blanco en Pages:** revisa que Source sea *GitHub Actions* y que la pestaña Actions muestre el despliegue en verde.
- **`git push` rechazado:** el repositorio se creó con README. Usa `git pull origin main --allow-unrelated-histories` y vuelve a hacer `git push`.
- **El plano importado no carga:** debe tener medidas múltiplos de 0.5 m, habitaciones de al menos 1 × 1 m, dentro de 14 × 9 m y sin solapes.

## Ideas para ampliar

- Varios routers o repetidores.
- Dos pisos con integrales triples y coordenadas cilíndricas (propagación 3D).
- Materiales distintos por muro.
- Calibrar L y n con mediciones reales de una app de WiFi.

## Licencia

MIT. Ver `LICENSE`.
