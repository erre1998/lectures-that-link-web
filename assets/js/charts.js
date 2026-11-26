// Visualizations of precomputed XSLT results. No scientific reclassification.
(() => {
    "use strict";
    const byId = id => document.getElementById(id);
    const number = new Intl.NumberFormat("en");
    const count = n => Number.isInteger(n) && n >= 0;
    const categories = [
        { key: "female", label: "Female", marker: "circle" },
        { key: "male", label: "Male", marker: "square" },
        { key: "nonBinary", label: "Non-binary", marker: "triangle" },
        { key: "withoutKnownGender", label: "No known gender", marker: "diamond" },
        { key: "multipleGenderCategories", label: "Multiple categories", marker: "cross" }
    ];
    const ns = "http://www.w3.org/2000/svg";

    function svg(tag, attributes = {}, text = "") {
        const node = document.createElementNS(ns, tag);
        for (const [key, value] of Object.entries(attributes)) {
            node.setAttribute(key, String(value));
        }
        if (text) node.textContent = text;
        return node;
    }

    function marker(shape, x, y) {
        const r = 3.5;
        const attrs = { class: "gender-marker" };
        if (shape === "circle") return svg("circle", { ...attrs, cx: x, cy: y, r });
        if (shape === "square") return svg("rect", { ...attrs, x: x-r, y: y-r, width: 2*r, height: 2*r });
        if (shape === "triangle") return svg("path", { ...attrs, d: `M${x} ${y-r-1} L${x+r+1} ${y+r} H${x-r-1} Z` });
        if (shape === "diamond") return svg("path", { ...attrs, d: `M${x} ${y-r-1} L${x+r+1} ${y} L${x} ${y+r+1} L${x-r-1} ${y} Z` });
        return svg("path", { ...attrs, d: `M${x-r} ${y-r} L${x+r} ${y+r} M${x-r} ${y+r} L${x+r} ${y-r}`, style: "fill:none" });
    }

    function speakerChart(entries) {
        if (!Array.isArray(entries) || !entries.every(e => e && Number.isInteger(e.lectures) && e.lectures > 0 && count(e.speakers))) {
            throw new Error("Invalid speaker frequency data.");
        }
        const maximum = Math.max(0, ...entries.map(e => e.speakers));
        const rows = document.createDocumentFragment();
        for (const entry of entries) {
            const row = document.createElement("li");
            const label = document.createElement("span");
            label.className = "chart-year";
            label.textContent = number.format(entry.lectures);
            const track = document.createElement("span");
            track.className = "chart-track";
            track.setAttribute("aria-hidden", "true");
            const bar = document.createElement("span");
            bar.className = "chart-bar";
            bar.style.width = `${maximum ? entry.speakers / maximum * 100 : 0}%`;
            track.append(bar);
            const value = document.createElement("span");
            value.className = "chart-value";
            value.textContent = number.format(entry.speakers);
            row.setAttribute("aria-label", `${entry.lectures} lecture records: ${entry.speakers} speaker IDs`);
            row.append(label, track, value);
            rows.append(row);
        }
        byId("speaker-chart-scale").textContent = `Lecture records per speaker ID · scale: 0–${number.format(maximum)} speaker IDs`;
        byId("speaker-chart").replaceChildren(rows);
        byId("speaker-visualization").hidden = false;
        byId("speaker-distribution-table").closest("details").open = false;
    }

    function genderChart(entries) {
        if (!Array.isArray(entries) || !entries.every(e => e && Number.isInteger(e.year) && count(e.total) && categories.every(c => count(e[c.key]) && e[c.key] <= e.total))) {
            throw new Error("Invalid annual gender data.");
        }
        const years = [...entries].sort((a, b) => a.year - b.year);
        if (new Set(years.map(e => e.year)).size !== years.length) throw new Error("Duplicate years.");
        const chart = byId("gender-chart");
        const controls = byId("gender-chart-controls");
        const legend = byId("gender-chart-legend");
        const message = byId("gender-chart-message");
        const maxTotal = Math.max(0, ...years.map(e => e.total));
        // Round up to a readable integer axis, stable when categories change.
        const step = Math.max(1, Math.ceil(maxTotal / 5 / 10) * 10);
        const maximum = 5 * step;
        const left = 55, right = 696, top = 18, bottom = 252;
        const first = years[0]?.year ?? 0;
        const last = years.at(-1)?.year ?? first;
        const x = year => first === last ? (left + right) / 2 : left + (year - first) / (last - first) * (right - left);
        const y = value => bottom - value / maximum * (bottom - top);
        byId("gender-chart-scale").textContent = `Absolute lecture records · fixed scale: 0–${number.format(maximum)}`;

        function render() {
            const selected = new Set([...controls.querySelectorAll("input:checked")].map(input => input.value));
            const visible = categories.filter(c => selected.has(c.key));
            chart.replaceChildren(
                svg("title", { id: "gender-svg-title" }, "Annual lecture records by recorded speaker gender"),
                svg("desc", { id: "gender-svg-desc" }, `Selected categories: ${visible.map(c => c.label).join(", ") || "none"}. Absolute counts on a fixed scale. The data table contains exact values for all categories.`)
            );
            legend.replaceChildren();
            message.textContent = !years.length ? "No annual data available." : !visible.length ? "Select at least one category to display a line." : "";
            for (let i = 0; i <= 5; i++) {
                const value = i * step;
                chart.append(svg("line", { class: "grid-line", x1: left, x2: right, y1: y(value), y2: y(value) }), svg("text", { x: left-9, y: y(value)+4, "text-anchor": "end" }, number.format(value)));
            }
            chart.append(svg("line", { class: "axis-line", x1: left, x2: right, y1: bottom, y2: bottom }), svg("line", { class: "axis-line", x1: left, x2: left, y1: top, y2: bottom }));
            // Limit axis labels, not the observations represented by the chart.
            const every = Math.max(1, Math.ceil(years.length / 12));
            for (const [i, entry] of years.entries()) {
                if (i % every === 0 || i === years.length - 1) chart.append(svg("text", { x: x(entry.year), y: bottom+19, "text-anchor": "middle" }, String(entry.year)));
            }
            chart.append(svg("text", { x: (left+right)/2, y: 292, "text-anchor": "middle" }, "Year"));
            for (const category of visible) {
                const group = svg("g", { class: `gender-${category.key}` });
                // Missing years interrupt the line; zero observations remain visible.
                const path = years.map((e,i) => `${i && e.year === years[i-1].year + 1 ? "L" : "M"}${x(e.year)} ${y(e[category.key])}`).join(" ");
                group.append(svg("path", { class: "gender-series", d: path }));
                for (const entry of years) {
                    const point = marker(category.marker, x(entry.year), y(entry[category.key]));
                    point.append(svg("title", {}, `${entry.year} · ${category.label}: ${number.format(entry[category.key])}`));
                    group.append(point);
                }
                chart.append(group);
                const item = document.createElement("li");
                const key = svg("svg", { viewBox: "0 0 44 18", "aria-hidden": "true" });
                const sample = svg("g", { class: `gender-${category.key}` });
                sample.append(svg("path", { class: "gender-series", d: "M2 9 H42" }), marker(category.marker, 22, 9));
                key.append(sample);
                item.append(key, document.createTextNode(category.label));
                legend.append(item);
            }
        }
        controls.addEventListener("change", render);
        render();
        byId("gender-visualization").hidden = false;
        byId("gender-per-year").closest("details").open = false;
    }

    async function init() {
        try {
            const response = await fetch("./data/analyses.json");
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            speakerChart(data.speakerAnalysis?.lecturesPerSpeakerDistribution);
            genderChart(data.genderPerYear);
        } catch (error) {
            // Tables and other existing analyses remain available via app.js.
            console.error("Unable to load People charts.", error);
        }
    }
    init();
})();
