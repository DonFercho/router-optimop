# Ubicador óptimo de router WiFi

Aplicación web interactiva que encuentra el mejor lugar para colocar un router WiFi dentro de una casa, utilizando conceptos de **Cálculo Multivariable** (Matemáticas 3). El usuario dibuja el plano, ajusta las condiciones de los muros y la app calcula y grafica el punto óptimo.

> Proyecto académico de Ingeniería de Sistemas y Telecomunicaciones.

## Características principales

- **Editor de plano:** dibuja habitaciones, añade puertas de 1 m, ubica el enchufe y asigna un peso (importancia) a cada habitación.
- **Mapa de calor:** visualiza la intensidad de la señal (0% a 100%) desde el router actual o desde el punto óptimo calculado.
- **Restricción física:** modo "cable" que limita la posición del router a un radio máximo desde el enchufe.
- **Plantillas y guardado:** incluye planos de ejemplo (casa, apartamento) y guarda tu progreso en el navegador.

## Stack tecnológico

- **Vanilla JavaScript, HTML5 y CSS3** (sin frameworks ni compiladores).
- **Canvas 2D** para el dibujo del plano y el mapa de calor.
- **Node.js** (solo para ejecutar las pruebas unitarias).

## Ejecución local

1. Abre la carpeta del proyecto en Visual Studio Code.
2. Usa la extensión **Live Server** (clic derecho sobre `index.html` > *Open with Live Server*).
3. Para correr las pruebas del modelo matemático: `npm test` (requiere Node.js).

## Fundamento Matemático

El objetivo es maximizar la cobertura ponderada de la casa. La app implementa los siguientes temas del curso:

### 1. Integral doble en región no rectangular
La función objetivo representa la cobertura. Se calcula como una suma de Riemann (integral doble discretizada) sobre las muestras espaciales de las habitaciones, las cuales pueden tener formas no rectangulares (L, T, etc.).

### 2. Derivadas parciales y gradiente
Para encontrar el máximo, se calcula el gradiente de la cobertura respecto a la posición del router:
El algoritmo usa **ascenso por gradiente**: se mueve el router iterativamente en la dirección en que la cobertura crece más rápido. Se ejecuta desde múltiples puntos de partida para evitar quedar atrapado en máximos locales.

### 3. Máximos y mínimos
En el punto óptimo interior, el gradiente se anula. El criterio del **Hessiano** (matriz de segundas derivadas) confirma que es un máximo.

### 4. Multiplicadores de Lagrange
Si se activa la restricción del cable, el router solo puede estar dentro de un círculo centrado en el enchufe.
Cuando el óptimo cae en el borde del círculo (restricción activa), el gradiente de la cobertura es paralelo al gradiente de la restricción. La app verifica esta condición y calcula el multiplicador.

## Modelo de señal
Para que los valores sean intuitivos, la señal \(S\) se mide en porcentaje (0% a 100%), no en dBm.
Donde \(d\) es la distancia euclidiana al router, \(n\) es el exponente de pérdida por distancia y \(L\) es la pérdida por cada muro.

## Estructura del proyecto
- `index.html`: Interfaz principal.
- `css/estilos.css`: Estilos visuales (modo claro/oscuro).
- `js/modelo.js`: Lógica matemática pura (sin dependencias del DOM).
- `js/planos.js`: Plantillas y validación de los planos.
- `js/ui.js`: Control del Canvas, eventos del ratón y renderizado.
- `tests/`: Pruebas unitarias del modelo matemático.