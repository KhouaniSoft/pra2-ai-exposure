const files = {
  topBottom: "viz1_top_bottom.csv",
  timeline: "viz2_evolucion_grupos.csv",
  heatmap: "viz3_heatmap_tipos.csv",
  spain: "viz4_scatter_espana.csv",
  gender: "viz5_genero.csv",
  genai: "viz6_ratio_genai.csv",
  acceleration: "viz7_aceleracion.csv",
};

const palette = [
  "#00d2ff", // Teal
  "#ff4d4d", // Coral
  "#ffb800", // Gold
  "#8b5cf6", // Violet
  "#3b82f6", // Blue
  "#10b981", // Green
  "#f43f5e", // Rose
  "#ffffff", // White
  "#86868b", // Muted
  "#00ffa3", // Mint
];

const chart = d3.select("#chart");
const title = d3.select("#chart-title");
const kicker = d3.select("#chart-kicker");
const note = d3.select("#chart-note");
const source = d3.select("#chart-source");
const legend = d3.select("#legend");
const tooltip = d3.select("body").append("div").attr("class", "tooltip");
const progressBar = d3.select("#reading-progress");
const backToTop = document.querySelector("#back-to-top");
const visualPanelElement = document.querySelector(".visual-panel");
const visualPanelAnchor = document.createComment("visual-panel-anchor");
if (visualPanelElement && visualPanelElement.parentNode) {
  visualPanelElement.parentNode.insertBefore(visualPanelAnchor, visualPanelElement);
}
const localeEs = d3.formatLocale({
  decimal: ",",
  thousands: ".",
  grouping: [3],
  currency: ["", " €"],
});
const formatEsOneDecimal = localeEs.format(".1f");
const formatEsThousands = localeEs.format(",.0f");
const formatEsPercent0 = localeEs.format(".0%");
const formatEsPercent1 = localeEs.format(".1%");

let store;
let activeScene = "timeline";
let metricsData = null;

function shortGroup(label) {
  return label.replace(/^\d\s+/, "");
}

function formatMillions(value) {
  return `${formatEsOneDecimal(value / 1000)} M`;
}

function formatPersonsFromThousands(value) {
  return `${formatEsThousands(value * 1000)} personas`;
}

function truncateLabel(value, maxLength) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function viewportState() {
  const width = window.innerWidth || document.documentElement.clientWidth || 1024;
  const height = window.innerHeight || document.documentElement.clientHeight || 768;
  return {
    width,
    height,
    narrow: width <= 540,
    compact: width <= 760,
    mobile: width <= 920,
    tablet: width <= 1024,
    short: height <= 680,
    wide: width >= 1600,
  };
}

function optionValue(value, context) {
  return typeof value === "function" ? value(context) : value;
}

function placeVisualPanel(scene = activeScene) {
  if (!visualPanelElement || !visualPanelAnchor.parentNode) return;

  const { tablet } = viewportState();
  if (tablet) {
    const activeStep = document.querySelector(`.step[data-scene="${scene}"]`) || document.querySelector(".step.is-active");
    if (activeStep && visualPanelElement.parentNode !== activeStep) {
      activeStep.appendChild(visualPanelElement);
    }
    return;
  }

  if (visualPanelElement.parentNode !== visualPanelAnchor.parentNode || visualPanelElement.previousSibling !== visualPanelAnchor) {
    visualPanelAnchor.parentNode.insertBefore(visualPanelElement, visualPanelAnchor.nextSibling);
  }
}

function setHeader(nextTitle, nextKicker, nextNote, nextSource) {
  title.text(nextTitle);
  kicker.text(nextKicker);
  note.text(nextNote);
  source.text(nextSource || "Fuente: AI Economics Lab, DAIOE-ISCO08. Elaboración: A. Khouani.");
}

function chartSize(extra = {}) {
  const viewport = viewportState();
  const chartWidth = Math.floor(chart.node().getBoundingClientRect().width || 0);
  const minWidth = optionValue(extra.minWidth, viewport) ?? (viewport.mobile ? 500 : 340);
  const width = Math.max(minWidth, chartWidth);
  const defaultHeight = viewport.compact
    ? viewport.short ? 280 : 320
    : viewport.mobile
      ? 380
      : viewport.wide
        ? 600
        : Math.max(390, Math.min(520, viewport.height - 300));
  const context = { ...viewport, width };
  const height = optionValue(extra.height, context) ?? defaultHeight;
  const marginContext = { ...context, height };
  return {
    width,
    height,
    margin: {
      top: optionValue(extra.top, marginContext) ?? (viewport.mobile ? 24 : 28),
      right: optionValue(extra.right, marginContext) ?? (viewport.mobile ? 28 : 42),
      bottom: optionValue(extra.bottom, marginContext) ?? (viewport.mobile ? 44 : 48),
      left: optionValue(extra.left, marginContext) ?? (viewport.mobile ? 96 : 130),
    },
  };
}

function clear() {
  chart.selectAll("*").remove();
  const node = chart.node();
  if (node) {
    node.scrollTop = 0;
    node.scrollLeft = 0;
  }
}

function showTooltip(event, html) {
  const padding = 12;
  tooltip
    .html(html)
    .classed("is-visible", true)
    .style("left", "0px")
    .style("top", "0px");

  const box = tooltip.node().getBoundingClientRect();
  const x = Math.max(box.width / 2 + padding, Math.min(window.innerWidth - box.width / 2 - padding, event.clientX));
  const y = Math.max(box.height + padding + 16, Math.min(window.innerHeight - padding, event.clientY));

  tooltip.style("left", `${x}px`).style("top", `${y}px`);
}

function hideTooltip() {
  tooltip.classed("is-visible", false);
}

function makeSvg(options = {}) {
  clear();
  const { width, height, margin } = chartSize(options);
  const svg = chart
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("width", width)
    .attr("height", height)
    .attr("preserveAspectRatio", "xMinYMin meet")
    .attr("focusable", "false")
    .attr("aria-hidden", "true");

  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  return {
    svg,
    g,
    width,
    height,
    margin,
    innerWidth: width - margin.left - margin.right,
    innerHeight: height - margin.top - margin.bottom,
  };
}

function addAxes(g, xAxis, yAxis, innerHeight) {
  g.append("g")
    .attr("class", "axis axis-x")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(xAxis);

  g.append("g").attr("class", "axis axis-y").call(yAxis);
  g.selectAll(".domain").remove();
}

function addYAxisLabel(g, text, innerHeight) {
  g.append("text")
    .attr("class", "axis-label")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerHeight / 2)
    .attr("y", -54)
    .attr("text-anchor", "middle")
    .text(text);
}

function addXAxisLabel(g, text, innerWidth, innerHeight) {
  g.append("text")
    .attr("class", "axis-label")
    .attr("x", innerWidth / 2)
    .attr("y", innerHeight + 43)
    .attr("text-anchor", "middle")
    .text(text);
}

function setLegend(items, scale, onEnter, onLeave) {
  legend.selectAll("*").remove();
  const row = legend
    .selectAll(".legend-item")
    .data(items)
    .join("button")
    .attr("class", "legend-item")
    .attr("type", "button")
    .attr("aria-label", (d) => `Resaltar ${shortGroup(d)}`)
    .on("pointerenter", (_, d) => onEnter && onEnter(d))
    .on("pointerleave", () => onLeave && onLeave());

  row.append("span").attr("class", "swatch").style("background", (d) => scale(d));
  row.append("span").text((d) => shortGroup(d));
}

function renderTimeline() {
  const rows = store.timeline;
  const groups = rows.columns.filter((d) => d !== "year");
  const highlight = [
    "4 Empleados admin.",
    "2 Téc. y prof. científicos",
    "3 Téc. y prof. de apoyo",
    "7 Artesanos manuf./constr.",
    "8 Operadores instal./maquinaria",
  ];
  const color = d3.scaleOrdinal(highlight, palette);
  const series = groups.map((group) => ({
    group,
    values: rows.map((row) => ({ year: row.year, value: row[group], group })),
  }));

  setHeader(
    "Evolución DAIOE por gran grupo",
    "2010-2023",
    "Pasa el cursor por una línea o por la leyenda para aislar el grupo. Las líneas grises mantienen el contexto del resto de ocupaciones.",
    "Fuente: AI Economics Lab, DAIOE-ISCO08, 2010-2023. Elaboración: A. Khouani.",
  );

  const { g, innerWidth, innerHeight } = makeSvg({
    right: (viewport) => (viewport.mobile ? 96 : 150),
    minWidth: (viewport) => (viewport.mobile ? 560 : 420),
    height: (viewport) => (viewport.compact ? 340 : undefined),
  });
  const x = d3.scaleLinear().domain(d3.extent(rows, (d) => d.year)).range([0, innerWidth]);
  const y = d3.scaleLinear().domain([0, d3.max(series, (s) => d3.max(s.values, (d) => d.value))]).nice().range([innerHeight, 0]);
  const line = d3.line().x((d) => x(d.year)).y((d) => y(d.value)).curve(d3.curveMonotoneX);

  g.append("g")
    .attr("class", "grid")
    .call(d3.axisLeft(y).tickSize(-innerWidth).tickFormat(""))
    .select(".domain")
    .remove();
  addAxes(g, d3.axisBottom(x).tickFormat(d3.format("d")), d3.axisLeft(y), innerHeight);
  addYAxisLabel(g, "DAIOE medio del grupo", innerHeight);

  const events = [
    { year: 2013, label: "2013 · Deep learning", y: 78 },
    { year: 2017, label: "2017 · Transformer", y: 48 },
    { year: 2022, label: "2022 · ChatGPT", y: 18 },
  ];
  g.selectAll(".event-line")
    .data(events)
    .join("line")
    .attr("class", "event-line")
    .attr("x1", (d) => x(d.year))
    .attr("x2", (d) => x(d.year))
    .attr("y1", 0)
    .attr("y2", innerHeight);
  const eventLabels = g
    .selectAll(".tech-label")
    .data(events)
    .join("g")
    .attr("class", "tech-label")
    .attr("transform", (d) => `translate(${x(d.year) + 5},${d.y})`);
  eventLabels.append("text").attr("class", "event-label").text((d) => d.label);
  eventLabels.each(function () {
    const bbox = this.querySelector("text").getBBox();
    d3.select(this)
      .insert("rect", "text")
      .attr("x", bbox.x - 4)
      .attr("y", bbox.y - 3)
      .attr("width", bbox.width + 8)
      .attr("height", bbox.height + 6)
      .attr("rx", 3);
  });

  const path = g
    .selectAll(".line-series")
    .data(series)
    .join("path")
    .attr("class", (d) => `line-series ${highlight.includes(d.group) ? "is-highlight" : ""}`)
    .attr("fill", "none")
    .attr("stroke", (d) => (highlight.includes(d.group) ? color(d.group) : "rgba(255,255,255,0.1)"))
    .attr("stroke-width", (d) => (highlight.includes(d.group) ? 3.5 : 1.2))
    .attr("opacity", (d) => (highlight.includes(d.group) ? 1 : 0.4))
    .attr("d", (d) => line(d.values));

  path
    .each(function () {
      const length = this.getTotalLength();
      d3.select(this)
        .attr("stroke-dasharray", `${length} ${length}`)
        .attr("stroke-dashoffset", length)
        .transition()
        .duration(900)
        .attr("stroke-dashoffset", 0);
    })
    .on("pointerenter", (event, d) => focusGroup(d.group, event))
    .on("pointermove", (event, d) => {
      const last = d.values[d.values.length - 1];
      showTooltip(event, `<strong>${shortGroup(d.group)}</strong>DAIOE 2023: ${formatEsOneDecimal(last.value)}`);
    })
    .on("pointerleave", resetFocus);

  function focusGroup(group) {
    path.attr("opacity", (d) => (d.group === group ? 1 : 0.12)).attr("stroke-width", (d) => (d.group === group ? 4 : 1));
  }

  function resetFocus() {
    hideTooltip();
    path.attr("opacity", (d) => (highlight.includes(d.group) ? 1 : 0.48)).attr("stroke-width", (d) => (highlight.includes(d.group) ? 3 : 1.2));
  }

  setLegend(highlight, color, focusGroup, resetFocus);
}

function renderTopBottom() {
  const data = [...store.topBottom].sort((a, b) => b.DAIOE_2023 - a.DAIOE_2023);
  const color = d3.scaleOrdinal(["Mayor exposición", "Menor exposición"], ["#ff4d4d", "#00d2ff"]);

  setHeader(
    "Top 10 y bottom 10 de ocupaciones expuestas",
    "Ocupaciones · 2023",
    "Pasa el cursor por cada barra para ver ocupación, grupo ISCO y valor DAIOE.",
    "Fuente: AI Economics Lab, DAIOE-ISCO08, 2023. Elaboración: A. Khouani.",
  );

  const { mobile } = viewportState();
  const { g, innerWidth, innerHeight } = makeSvg({
    height: (viewport) => (viewport.compact ? 520 : viewport.mobile ? 590 : 620),
    left: (viewport) => (viewport.mobile ? viewport.narrow ? 150 : 180 : 285),
    right: (viewport) => (viewport.mobile ? 28 : 42),
    minWidth: (viewport) => (viewport.mobile ? viewport.narrow ? 620 : 680 : 560),
  });
  const x = d3.scaleLinear().domain([0, d3.max(data, (d) => d.DAIOE_2023)]).nice().range([0, innerWidth]);
  const y = d3.scaleBand().domain(data.map((d) => d.ocupacion)).range([0, innerHeight]).padding(0.18);

  g.append("g").attr("class", "grid").call(d3.axisTop(x).tickSize(-innerHeight).tickFormat("")).select(".domain").remove();
  addAxes(
    g,
    d3.axisBottom(x),
    d3.axisLeft(y).tickSize(0).tickFormat((d) => truncateLabel(d, mobile ? 22 : 42)),
    innerHeight,
  );
  addXAxisLabel(g, "DAIOE 2023", innerWidth, innerHeight);

  g.append("line").attr("class", "threshold").attr("x1", x(33)).attr("x2", x(33)).attr("y1", -12).attr("y2", innerHeight);
  const thresholdLabel = g.append("g").attr("class", "threshold-label").attr("transform", `translate(${x(33) + 7},-18)`);
  thresholdLabel.append("rect").attr("x", -4).attr("y", -13).attr("width", 90).attr("height", 18).attr("rx", 3);
  thresholdLabel.append("text").attr("class", "event-label").text("umbral 33 (p65)");

  const bars = g
    .selectAll(".bar")
    .data(data)
    .join("rect")
    .attr("class", "bar")
    .attr("x", 0)
    .attr("y", (d) => y(d.ocupacion))
    .attr("height", y.bandwidth())
    .attr("width", 0)
    .attr("fill", (d) => color(d.categoria));

  bars
    .transition()
    .duration(700)
    .attr("width", (d) => x(d.DAIOE_2023));

  bars
    .on("pointerenter", function (event, d) {
      d3.select(this).classed("is-hovered", true);
      showTooltip(event, `<strong>${d.ocupacion}</strong>${shortGroup(d.gran_grupo)}<br>DAIOE 2023: ${formatEsOneDecimal(d.DAIOE_2023)}`);
    })
    .on("pointermove", (event, d) => showTooltip(event, `<strong>${d.ocupacion}</strong>${shortGroup(d.gran_grupo)}<br>DAIOE 2023: ${formatEsOneDecimal(d.DAIOE_2023)}`))
    .on("pointerleave", function () {
      d3.select(this).classed("is-hovered", false);
      hideTooltip();
    });

  setLegend(
    color.domain(),
    color,
    (category) => bars.attr("opacity", (d) => (d.categoria === category ? 1 : 0.16)),
    () => bars.attr("opacity", 1),
  );
}

function renderHeatmap() {
  const data = store.heatmap;
  const groups = [...new Set(data.map((d) => d.grupo_label))];
  const types = [...new Set(data.map((d) => d.tipo_IA))];
  const color = d3.scaleSequential(d3.interpolateViridis).domain(d3.extent(data, (d) => d.DAIOE_medio));

  setHeader(
    "Tipos de IA por grupo ocupacional",
    "Tipos de IA · 2023",
    "Pasa el cursor por una celda para cruzar tipo de IA, grupo ocupacional y exposición media.",
    "Fuente: AI Economics Lab, DAIOE-ISCO08, 2023. Elaboración: A. Khouani.",
  );
  legend.selectAll("*").remove();
  const scaleLegend = legend.append("div").attr("class", "scale-legend").style("display", "flex").style("align-items", "center").style("gap", "0.8rem");
  scaleLegend.append("span").style("font-size", "0.75rem").style("color", "var(--muted)").text("Exposición: Baja");
  const gradient = scaleLegend.append("div").style("width", "120px").style("height", "8px").style("border-radius", "4px").style("background", "linear-gradient(90deg, #440154, #21918c, #fde725)");
  scaleLegend.append("span").style("font-size", "0.75rem").style("color", "var(--muted)").text("Alta");

  const { g, innerWidth, innerHeight } = makeSvg({
    top: (viewport) => (viewport.mobile ? 82 : 95),
    left: (viewport) => (viewport.mobile ? 128 : 155),
    right: 28,
    height: (viewport) => (viewport.compact ? 480 : 570),
    minWidth: (viewport) => (viewport.mobile ? 700 : 560),
  });
  const x = d3.scaleBand().domain(types).range([0, innerWidth]).padding(0.04);
  const y = d3.scaleBand().domain(groups).range([0, innerHeight]).padding(0.04);

  addAxes(g, d3.axisBottom(x).tickSize(0), d3.axisLeft(y).tickSize(0).tickFormat(shortGroup), innerHeight);
  g.select(".axis-x").selectAll("text").attr("transform", "rotate(-34)").style("text-anchor", "end").attr("dx", "-0.5em").attr("dy", "0.2em");

  g.selectAll(".heat-cell")
    .data(data)
    .join("rect")
    .attr("class", "heat-cell")
    .attr("x", (d) => x(d.tipo_IA))
    .attr("y", (d) => y(d.grupo_label))
    .attr("width", x.bandwidth())
    .attr("height", y.bandwidth())
    .attr("fill", (d) => color(d.DAIOE_medio))
    .attr("opacity", 0)
    .on("pointerenter", function (event, d) {
      d3.selectAll(".heat-cell").attr("opacity", (c) => (c.tipo_IA === d.tipo_IA || c.grupo_label === d.grupo_label ? 1 : 0.25));
      showTooltip(event, `<strong>${shortGroup(d.grupo_label)}</strong>${d.tipo_IA}<br>DAIOE medio: ${formatEsOneDecimal(d.DAIOE_medio)}`);
    })
    .on("pointermove", (event, d) => showTooltip(event, `<strong>${shortGroup(d.grupo_label)}</strong>${d.tipo_IA}<br>DAIOE medio: ${formatEsOneDecimal(d.DAIOE_medio)}`))
    .on("pointerleave", () => {
      d3.selectAll(".heat-cell").attr("opacity", 1);
      hideTooltip();
    })
    .transition()
    .duration(500)
    .delay((_, i) => i * 8)
    .attr("opacity", 1);
}

function renderAcceleration() {
  const data = store.acceleration;
  const groups = [...new Set(data.map((d) => d.gran_grupo))];
  const color = d3.scaleOrdinal(groups, palette);

  setHeader(
    "Aceleración de exposición entre 2019 y 2023",
    "2019-2023",
    "Pasa el cursor para comparar 2019 y 2023. El número final indica el aumento en puntos DAIOE.",
    "Fuente: AI Economics Lab, DAIOE-ISCO08, 2019-2023. Elaboración: A. Khouani.",
  );

  const { mobile } = viewportState();
  const { g, innerWidth, innerHeight } = makeSvg({
    height: (viewport) => (viewport.compact ? 520 : 590),
    left: (viewport) => (viewport.mobile ? viewport.narrow ? 150 : 180 : 285),
    right: (viewport) => (viewport.mobile ? 54 : 70),
    minWidth: (viewport) => (viewport.mobile ? 660 : 560),
  });
  const x = d3.scaleLinear().domain([d3.min(data, (d) => d.DAIOE_2019) - 2, d3.max(data, (d) => d.DAIOE_2023) + 6]).range([0, innerWidth]);
  const y = d3.scaleBand().domain(data.map((d) => d.ocupacion)).range([0, innerHeight]).padding(0.45);

  g.append("g").attr("class", "grid").call(d3.axisTop(x).tickSize(-innerHeight).tickFormat("")).select(".domain").remove();
  addAxes(
    g,
    d3.axisBottom(x),
    d3.axisLeft(y).tickSize(0).tickFormat((d) => truncateLabel(d, mobile ? 22 : 42)),
    innerHeight,
  );
  addXAxisLabel(g, "DAIOE", innerWidth, innerHeight);

  const rows = g.selectAll(".dumbbell-row").data(data).join("g").attr("class", "dumbbell-row");
  rows
    .append("line")
    .attr("class", "dumbbell-line")
    .attr("x1", (d) => x(d.DAIOE_2019))
    .attr("x2", (d) => x(d.DAIOE_2019))
    .attr("y1", (d) => y(d.ocupacion) + y.bandwidth() / 2)
    .attr("y2", (d) => y(d.ocupacion) + y.bandwidth() / 2)
    .transition()
    .duration(800)
    .attr("x2", (d) => x(d.DAIOE_2023));

  rows
    .append("circle")
    .attr("class", "dot-muted")
    .attr("cx", (d) => x(d.DAIOE_2019))
    .attr("cy", (d) => y(d.ocupacion) + y.bandwidth() / 2)
    .attr("r", 4);

  rows
    .append("circle")
    .attr("class", "dot-main")
    .attr("cx", (d) => x(d.DAIOE_2023))
    .attr("cy", (d) => y(d.ocupacion) + y.bandwidth() / 2)
    .attr("r", 5.5)
    .attr("fill", (d) => color(d.gran_grupo));

  rows
    .append("text")
    .attr("class", "delta-label")
    .attr("x", (d) => x(d.DAIOE_2023) + 12)
    .attr("y", (d) => y(d.ocupacion) + y.bandwidth() / 2 + 4)
    .attr("opacity", 0)
    .text((d) => `+${formatEsOneDecimal(d.aceleracion)}`)
    .transition()
    .delay(600)
    .duration(400)
    .attr("opacity", 1);

  rows
    .on("pointerenter", function (event, d) {
      d3.selectAll(".dumbbell-row").attr("opacity", 0.15);
      d3.select(this).attr("opacity", 1);
      showTooltip(
        event,
        `<strong>${d.ocupacion}</strong>
         <span style="color:var(--muted)">2019: ${formatEsOneDecimal(d.DAIOE_2019)}</span><br>
         <span style="color:#fff">2023: ${formatEsOneDecimal(d.DAIOE_2023)}</span><br>
         <strong>Aceleración: +${formatEsOneDecimal(d.aceleracion)}</strong>`
      );
    })
    .on("pointermove", (event, d) =>
      showTooltip(
        event,
        `<strong>${d.ocupacion}</strong>
         <span style="color:var(--muted)">2019: ${formatEsOneDecimal(d.DAIOE_2019)}</span><br>
         <span style="color:#fff">2023: ${formatEsOneDecimal(d.DAIOE_2023)}</span><br>
         <strong>Aceleración: +${formatEsOneDecimal(d.aceleracion)}</strong>`
      )
    )
    .on("pointerleave", () => {
      d3.selectAll(".dumbbell-row").attr("opacity", 1);
      hideTooltip();
    });

  setLegend(groups, color, (group) => rows.attr("opacity", (d) => (d.gran_grupo === group ? 1 : 0.18)), () => rows.attr("opacity", 1));
  
  // Add year legend
  const yearLegend = legend.append("div").attr("class", "year-legend");
  
  yearLegend.append("div").attr("class", "legend-item").style("cursor", "default").style("background", "none").style("border", "none").html(`<span class="swatch" style="background:#444;border:1px solid var(--line)"></span><span style="color:var(--muted)">2019</span>`);
  yearLegend.append("div").attr("class", "legend-item").style("cursor", "default").style("background", "none").style("border", "none").html(`<span class="swatch" style="background:#fff"></span><span>2023</span>`);
}

function renderGenai() {
  const data = store.genai;
  const groups = [...new Set(data.map((d) => d.gran_grupo))];
  const color = d3.scaleOrdinal(groups, palette);

  setHeader(
    "Exposición total frente a peso relativo de GenAI",
    "IA generativa · 2023",
    "Pasa el cursor por cada punto. Usa la leyenda para resaltar un gran grupo ocupacional.",
    "Fuente: AI Economics Lab, DAIOE-ISCO08, 2023. Elaboración: A. Khouani.",
  );

  const { g, innerWidth, innerHeight } = makeSvg({
    right: 36,
    minWidth: (viewport) => (viewport.mobile ? 540 : 420),
    height: (viewport) => (viewport.compact ? 340 : undefined),
  });
  const x = d3.scaleLinear().domain(d3.extent(data, (d) => d.DAIOE_total)).nice().range([0, innerWidth]);
  const y = d3.scaleLinear().domain(d3.extent(data, (d) => d.ratio_genai)).nice().range([innerHeight, 0]);

  g.append("g").attr("class", "grid").call(d3.axisLeft(y).tickSize(-innerWidth).tickFormat("")).select(".domain").remove();
  addAxes(g, d3.axisBottom(x), d3.axisLeft(y).tickFormat(formatEsPercent0), innerHeight);
  addXAxisLabel(g, "DAIOE total", innerWidth, innerHeight);
  addYAxisLabel(g, "Ratio GenAI (%)", innerHeight);

  const dots = g
    .selectAll(".scatter-dot")
    .data(data)
    .join("circle")
    .attr("class", "scatter-dot")
    .attr("cx", (d) => x(d.DAIOE_total))
    .attr("cy", (d) => y(d.ratio_genai))
    .attr("r", 0)
    .attr("fill", (d) => color(d.gran_grupo))
    .attr("opacity", 0.72)
    .on("pointerenter", function (event, d) {
      d3.select(this).attr("r", 7).attr("opacity", 1);
      showTooltip(event, `<strong>${d.ocupacion}</strong>${shortGroup(d.gran_grupo)}<br>DAIOE total: ${formatEsOneDecimal(d.DAIOE_total)}<br>Ratio GenAI: ${formatEsPercent1(d.ratio_genai)}`);
    })
    .on("pointermove", (event, d) => showTooltip(event, `<strong>${d.ocupacion}</strong>${shortGroup(d.gran_grupo)}<br>DAIOE total: ${formatEsOneDecimal(d.DAIOE_total)}<br>Ratio GenAI: ${formatEsPercent1(d.ratio_genai)}`))
    .on("pointerleave", function () {
      d3.select(this).attr("r", 3.5).attr("opacity", 0.72);
      hideTooltip();
    });

  dots.transition().duration(500).delay((_, i) => i * 2).attr("r", 3.5);
  setLegend(groups.slice(0, 5), color, (group) => dots.attr("opacity", (d) => (d.gran_grupo === group ? 0.95 : 0.08)), () => dots.attr("opacity", 0.72));
}

function renderSpain() {
  const data = store.spain;
  const color = d3.scaleOrdinal(["Alta", "Media/Baja"], ["#ff4d4d", "#00d2ff"]);

  setHeader(
    "Exposición y volumen de empleo en España",
    "España · EPA 2023",
    "El tamaño del punto representa ocupados. Pasa el cursor para leer volumen, exposición y número de ocupaciones.",
    "Fuente: AI Economics Lab, DAIOE-ISCO08; INE, Encuesta de Población Activa, 2023. Elaboración: A. Khouani.",
  );

  const { g, innerWidth, innerHeight } = makeSvg({
    right: (viewport) => (viewport.mobile ? 70 : 130),
    minWidth: (viewport) => (viewport.mobile ? 560 : 420),
    height: (viewport) => (viewport.compact ? 360 : undefined),
  });
  const x = d3.scaleLinear().domain([24, 42]).range([0, innerWidth]);
  const y = d3.scaleLinear().domain([0, d3.max(data, (d) => d.ocupados_miles) * 1.12]).range([innerHeight, 0]);
  const r = d3.scaleSqrt().domain(d3.extent(data, (d) => d.ocupados_miles)).range([6, 25]);

  g.append("g").attr("class", "grid").call(d3.axisLeft(y).tickSize(-innerWidth).tickFormat("")).select(".domain").remove();
  addAxes(g, d3.axisBottom(x), d3.axisLeft(y).tickFormat(formatEsThousands), innerHeight);
  addXAxisLabel(g, "DAIOE medio del grupo", innerWidth, innerHeight);
  addYAxisLabel(g, "Ocupados (miles)", innerHeight);
  g.append("line").attr("class", "threshold").attr("x1", x(33)).attr("x2", x(33)).attr("y1", 0).attr("y2", innerHeight);

  const dots = g
    .selectAll(".bubble")
    .data(data)
    .join("circle")
    .attr("class", "bubble")
    .attr("cx", (d) => x(d.DAIOE_medio))
    .attr("cy", (d) => y(d.ocupados_miles))
    .attr("r", 0)
    .attr("fill", (d) => color(d.nivel_exposicion))
    .on("pointerenter", function (event, d) {
      d3.select(this).attr("stroke-width", 3);
      const caveat = d.n_ocupaciones <= 2 ? `<span style="color:var(--muted);font-size:0.8em"> ⚠ solo ${d.n_ocupaciones} ocup. con datos</span>` : "";
      showTooltip(event, `<strong>${shortGroup(d.grupo_label)}</strong>${formatMillions(d.ocupados_miles)} ocupados<br>DAIOE: ${formatEsOneDecimal(d.DAIOE_medio)}${caveat}<br>Ocupaciones: ${d.n_ocupaciones}`);
    })
    .on("pointermove", (event, d) => {
      const caveat = d.n_ocupaciones <= 2 ? `<span style="color:var(--muted);font-size:0.8em"> ⚠ solo ${d.n_ocupaciones} ocup. con datos</span>` : "";
      showTooltip(event, `<strong>${shortGroup(d.grupo_label)}</strong>${formatMillions(d.ocupados_miles)} ocupados<br>DAIOE: ${formatEsOneDecimal(d.DAIOE_medio)}${caveat}<br>Ocupaciones: ${d.n_ocupaciones}`);
    })
    .on("pointerleave", function () {
      d3.select(this).attr("stroke-width", 1.4);
      hideTooltip();
    });

  dots.transition().duration(650).attr("r", (d) => r(d.ocupados_miles));
  setLegend(
    color.domain(),
    color,
    (level) => dots.attr("opacity", (d) => (d.nivel_exposicion === level ? 0.95 : 0.12)),
    () => dots.attr("opacity", 1),
  );
}

function renderGender() {
  const rows = store.gender.flatMap((d) => [
    { ...d, sexo: "Hombres", miles: d.hombres_miles },
    { ...d, sexo: "Mujeres", miles: d.mujeres_miles },
  ]);
  const color = d3.scaleOrdinal(["Hombres", "Mujeres"], ["#3b82f6", "#f43f5e"]);

  setHeader(
    "Ocupados por sexo, ordenados por exposición",
    "Género · EPA 2023",
    "Pasa el cursor para comparar el volumen de hombres y mujeres dentro de cada grupo ocupacional.",
    "Fuente: AI Economics Lab, DAIOE-ISCO08; INE, Encuesta de Población Activa, 2023. Elaboración: A. Khouani.",
  );

  const { g, innerWidth, innerHeight } = makeSvg({
    height: (viewport) => (viewport.compact ? 500 : 570),
    left: (viewport) => (viewport.mobile ? 150 : 190),
    right: (viewport) => (viewport.mobile ? 36 : 42),
    minWidth: (viewport) => (viewport.mobile ? 640 : 520),
  });
  const x = d3.scaleLinear().domain([0, d3.max(rows, (d) => d.miles)]).nice().range([0, innerWidth]);
  const y0 = d3.scaleBand().domain(store.gender.map((d) => d.grupo_label)).range([0, innerHeight]).padding(0.24);
  const y1 = d3.scaleBand().domain(color.domain()).range([0, y0.bandwidth()]).padding(0.14);

  g.append("g").attr("class", "grid").call(d3.axisTop(x).tickSize(-innerHeight).tickFormat("")).select(".domain").remove();
  addAxes(g, d3.axisBottom(x).tickFormat(formatEsThousands), d3.axisLeft(y0).tickSize(0).tickFormat(shortGroup), innerHeight);
  addXAxisLabel(g, "Ocupados (miles)", innerWidth, innerHeight);

  const bars = g
    .selectAll(".gender-bar")
    .data(rows)
    .join("rect")
    .attr("class", "gender-bar")
    .attr("x", 0)
    .attr("y", (d) => y0(d.grupo_label) + y1(d.sexo))
    .attr("height", y1.bandwidth())
    .attr("width", 0)
    .attr("fill", (d) => color(d.sexo))
    .on("pointerenter", function (event, d) {
      d3.select(this).classed("is-hovered", true);
      showTooltip(event, `<strong>${shortGroup(d.grupo_label)}</strong>${d.sexo}: ${formatPersonsFromThousands(d.miles)}<br>Mujeres: ${formatEsOneDecimal(d.pct_mujeres)}%<br>DAIOE: ${formatEsOneDecimal(d.DAIOE_medio)}`);
    })
    .on("pointermove", (event, d) => showTooltip(event, `<strong>${shortGroup(d.grupo_label)}</strong>${d.sexo}: ${formatPersonsFromThousands(d.miles)}<br>Mujeres: ${formatEsOneDecimal(d.pct_mujeres)}%<br>DAIOE: ${formatEsOneDecimal(d.DAIOE_medio)}`))
    .on("pointerleave", function () {
      d3.select(this).classed("is-hovered", false);
      hideTooltip();
    });

  bars.transition().duration(650).attr("width", (d) => x(d.miles));
  setLegend(color.domain(), color, (sexo) => bars.attr("opacity", (d) => (d.sexo === sexo ? 1 : 0.18)), () => bars.attr("opacity", 1));
}

const renderers = {
  timeline: renderTimeline,
  topbottom: renderTopBottom,
  heatmap: renderHeatmap,
  acceleration: renderAcceleration,
  genai: renderGenai,
  spain: renderSpain,
  gender: renderGender,
};

function render(scene) {
  activeScene = scene;
  hideTooltip();
  placeVisualPanel(scene);
  renderers[scene]();
}

function animateCounter(el, end, duration, formatter) {
  const startTime = performance.now();
  function tick(now) {
    const t = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = formatter(end * eased);
    if (t < 1) requestAnimationFrame(tick);
    else el.textContent = formatter(end);
  }
  requestAnimationFrame(tick);
}

function renderSummary() {
  const high = store.spain.filter((d) => d.nivel_exposicion === "Alta");
  const highWorkers = d3.sum(high, (d) => d.ocupados_miles);
  const totalWorkers = d3.sum(store.spain, (d) => d.ocupados_miles);
  const admin = store.gender.find((d) => d.grupo_label.includes("Empleados admin."));
  const maxAcceleration = d3.max(store.acceleration, (d) => d.aceleracion);

  const metrics = [
    { raw: highWorkers, fmt: formatMillions, label: `${formatEsPercent0(highWorkers / totalWorkers)} de ocupados en grupos de exposición alta` },
    { raw: admin.pct_mujeres, fmt: (v) => `${formatEsOneDecimal(v)}%`, label: "mujeres en empleados administrativos, uno de los grupos más expuestos" },
    { raw: maxAcceleration, fmt: (v) => `+${formatEsOneDecimal(v)}`, label: "puntos DAIOE en la ocupación con mayor aceleración 2019-2023" },
  ];

  metricsData = metrics;

  d3.select("#summary-metrics")
    .selectAll(".metric")
    .data(metrics)
    .join("div")
    .attr("class", "metric")
    .html((d) => `<strong>${d.fmt(d.raw)}</strong><span>${d.label}</span>`);
}

async function loadData() {
  const [topBottom, timeline, heatmap, spain, gender, genai, acceleration] = await Promise.all([
    d3.csv(files.topBottom, d3.autoType),
    d3.csv(files.timeline, d3.autoType),
    d3.csv(files.heatmap, d3.autoType),
    d3.csv(files.spain, d3.autoType),
    d3.csv(files.gender, d3.autoType),
    d3.csv(files.genai, d3.autoType),
    d3.csv(files.acceleration, d3.autoType),
  ]);

  store = { topBottom, timeline, heatmap, spain, gender, genai, acceleration };
  if (window.lucide) {
    window.lucide.createIcons();
  }
  
  d3.select("#summary-metrics").classed("is-loading", false);
  d3.select(".chart-shell").classed("is-loading", false);

  renderSummary();
  render(activeScene);
  setupScroll();
  setupReveal();
  setupPageControls();
}

function setupScroll() {
  const scroller = scrollama();
  let resizeFrame;
  scroller
    .setup({ step: ".step", offset: 0.56 })
    .onStepEnter(({ element }) => {
      document.querySelectorAll(".step").forEach((step) => step.classList.remove("is-active"));
      element.classList.add("is-active");
      render(element.dataset.scene);
    });

  window.addEventListener("resize", () => {
    window.cancelAnimationFrame(resizeFrame);
    resizeFrame = window.requestAnimationFrame(() => {
      scroller.resize();
      render(activeScene);
    });
  });
}

function setupReveal() {
  if (!window.ScrollReveal) return;
  const config = {
    distance: "40px",
    duration: 1000,
    easing: "cubic-bezier(0.16, 1, 0.3, 1)", // Modern fluid easing
    opacity: 0,
    origin: "bottom",
    cleanup: true,
  };

  ScrollReveal().reveal(".hero h1", { ...config, delay: 100, distance: "60px" });
  ScrollReveal().reveal(".hero p", { ...config, delay: 300 });
  ScrollReveal().reveal(".intro > p", { ...config, delay: 100 });
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  ScrollReveal().reveal(".metric", {
    ...config,
    interval: 100,
    distance: "20px",
    afterReveal() {},
  });
  ScrollReveal().reveal(".closing", { ...config, distance: "30px" });
}

function setupPageControls() {
  let ticking = false;

  function updateProgress() {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const progress = maxScroll > 0 ? window.scrollY / maxScroll : 0;
    progressBar.style("transform", `scaleX(${Math.max(0, Math.min(1, progress))})`);

    if (backToTop) {
      backToTop.classList.toggle("is-visible", window.scrollY > window.innerHeight * 0.65);
    }

    ticking = false;
  }

  window.addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        window.requestAnimationFrame(updateProgress);
        ticking = true;
      }
    },
    { passive: true },
  );

  if (backToTop) {
    backToTop.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  updateProgress();
}

loadData().catch((error) => {
  console.error(error);
  setHeader(
    "No se pudieron cargar los CSV",
    "Error",
    "Abre este proyecto desde un servidor local para permitir la lectura de archivos CSV.",
    "",
  );
});
