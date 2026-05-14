# Exposición de las ocupaciones a la Inteligencia Artificial

## Evolución temporal y contexto español (2010-2023)

Este proyecto desarrolla la segunda parte de la práctica mediante una pieza web
interactiva construida con HTML, CSS y JavaScript. La historia usa los datasets
preparados en formato CSV para explicar la exposición ocupacional a la inteligencia
artificial a través del indicador DAIOE.

## Objetivo narrativo

La pieza analiza cómo la exposición a la IA ha dejado de concentrarse únicamente en
tareas manuales o rutinarias y alcanza con fuerza el trabajo cognitivo, administrativo
y textual. El story también incorpora una lectura de género para mostrar que algunos
grupos altamente expuestos están feminizados.

## Archivos principales

- `index.html`: estructura del story y bloques narrativos.
- `styles.css`: diseño visual, layout responsive y estilo editorial.
- `app.js`: carga de datos, scrollytelling y visualizaciones interactivas con D3.js.
- `server.js`: servidor local mínimo para abrir el proyecto.

## Bibliotecas utilizadas

- **D3.js**: construcción directa de las visualizaciones SVG, escalas, ejes,
  transiciones, tooltips, resaltado por hover y selección desde leyendas.
- **Scrollama**: activación de escenas narrativas al avanzar por el scroll.
- **ScrollReveal**: animaciones de entrada para portada, métricas y bloques
  principales durante el desplazamiento.

## Datasets

- `viz1_top_bottom.csv`: ocupaciones más y menos expuestas en 2023.
- `viz2_evolucion_grupos.csv`: evolución temporal DAIOE por gran grupo ISCO.
- `viz3_heatmap_tipos.csv`: tipos de IA por grupo ocupacional.
- `viz4_scatter_espana.csv`: exposición y ocupados por gran grupo en España.
- `viz5_genero.csv`: ocupados por sexo y exposición.
- `viz6_ratio_genai.csv`: peso relativo de la IA generativa.
- `viz7_aceleracion.csv`: aceleración de exposición entre 2019 y 2023.

## Estructura del story

1. Portada e hipótesis principal.
2. Evolución temporal de la exposición a IA.
3. Ocupaciones más y menos expuestas.
4. Mapa de calor por tipos de IA.
5. Aceleración del periodo 2019-2023.
6. Ratio de IA generativa sobre exposición total.
7. Concentración de trabajadores expuestos en España.
8. Lectura de género como cierre analítico central.

## Cómo abrirlo

Desde esta carpeta:

```powershell
node server.js
```

Después abre:

```text
http://127.0.0.1:4173
```

El sitio carga las librerías de visualización desde CDN, por lo que necesita conexión
a internet para renderizar las gráficas.
