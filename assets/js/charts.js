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

    // Share charts display the original XSLT shares, not a new analysis.
    const percentage = new Intl.NumberFormat("en", { style: "percent", maximumFractionDigits: 1 });
    const institutionLabels = new Map([
        ["university", "University"],
        ["research_institution", "Research institution"],
        ["glam", "GLAM"],
        ["company", "Company"],
        ["other", "Other"],
        ["self-employment", "Self-employment"]
    ]);

    const geographyLabels = new Map([
        ["local", "Local"], ["national", "National"],
        ["European", "European"], ["other continents", "Other continents"]
    ]);

    // Real buttons keep drill-down links keyboard accessible. A count check in
    // lectures.js guards against mismatched analysis and lecture exports.
    function exploreButton(text, label, filters, expected, className = "", lectureIds = undefined) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `analysis-explore ${className}`;
        button.textContent = text;
        button.setAttribute("aria-label", `Explore ${label}: ${number.format(expected)} lecture records`);
        button.addEventListener("click", () => document.dispatchEvent(new CustomEvent("lecture:explore", {
            detail: { label, filters, expected, lectureIds }
        })));
        return button;
    }

    function linkAnnualChart(prefix, entries) {
        const list = byId(`${prefix}-chart`);
        const select = byId(`${prefix}-category`);
        const formats = { total: null, inPerson: "in person", online: "online",
            ...(prefix === "delivery" ? { canceled: "canceled" } : { hybrid: "hybrid" }) };
        const byYear = new Map(entries.map(entry => [String(entry.year), entry]));
        function linkRows() {
            const field = select.value;
            if (!Object.hasOwn(formats, field)) return;
            for (const row of list.children) {
                const label = row.querySelector(".chart-year:not(button)");
                if (!label) continue;
                const year = label.textContent;
                const expected = byYear.get(year)?.[field];
                if (!Number.isInteger(expected) || expected < 1) continue;
                const filters = { from: year, to: year };
                if (formats[field]) filters[prefix] = formats[field];
                const description = `${prefix === "delivery" ? "Lecture delivery" : "Audience participation"} · ${select.selectedOptions[0].textContent} · ${year}`;
                label.replaceWith(exploreButton(year, description, filters, expected, "chart-year"));
            }
        }
        // app.js replaces the rows when the annual category changes.
        new MutationObserver(linkRows).observe(list, { childList: true });
        linkRows();
    }

    function linkGenderTable(entries) {
        const table = byId("gender-per-year");
        const byYear = new Map(entries.map(entry => [String(entry.year), entry]));
        const columns = [[1, "female", "female", "Female"], [2, "male", "male", "Male"],
            [3, "nonBinary", "non-binary", "Non-binary"], [6, "total", null, "All lecture records"]];
        function linkRows() {
            for (const row of table.rows) {
                const year = row.cells[0]?.textContent;
                const entry = byYear.get(year);
                if (!entry) continue;
                for (const [index, key, gender, label] of columns) {
                    const cell = row.cells[index];
                    const expected = entry[key];
                    if (!cell || cell.querySelector("button") || !Number.isInteger(expected) || expected < 1) continue;
                    const filters = { from: year, to: year };
                    if (gender) filters.gender = gender;
                    cell.replaceChildren(exploreButton(number.format(expected), `Recorded speaker gender · ${label} · ${year}`, filters, expected));
                }
            }
        }
        new MutationObserver(linkRows).observe(table, { childList: true });
        linkRows();
    }

    function shareChart(prefix, analysis, field, label, {
        limit = Infinity, selector = prefix, tableId = null,
        noun = "categories", rank = true, drilldown = null
    } = {}) {
        const select = byId(`${selector}-series`);
        const list = byId(`${prefix}-chart`);
        const message = byId(`${prefix}-chart-message`);
        const valid = summary => summary && count(summary.total) &&
            Array.isArray(summary[field]) && summary[field].every(e =>
                e && typeof label(e) === "string" && count(e.lectures) &&
                e.lectures <= summary.total && (summary.total === 0
                    ? e.share === null
                    : Number.isFinite(e.share) && e.share >= 0 && e.share <= 1));
        if (!analysis || !valid(analysis.overall) || !Array.isArray(analysis.perSeries) ||
            !analysis.perSeries.every(e => valid(e) && typeof e.seriesId === "string")) {
            throw new Error(`Invalid ${prefix} chart data.`);
        }
        const summaries = new Map([["all", analysis.overall],
            ...analysis.perSeries.map(e => [`series:${e.seriesId}`, e])]);

        function render() {
            const summary = summaries.get(select.value);
            if (!summary) return;
            // Sorting and limiting are display operations only. Keep all data in the table.
            const available = summary[field].filter(e => limit === Infinity || e.lectures > 0);
            const entries = [...available];
            if (rank) entries.sort((a, b) =>
                b.lectures - a.lectures || label(a).localeCompare(label(b), "en"));
            const displayed = entries.slice(0, limit);
            const rows = document.createDocumentFragment();
            for (const entry of summary.total ? displayed : []) {
                const row = document.createElement("li");
                const name = document.createElement("span");
                name.className = "share-label";
                name.textContent = label(entry);
                const value = document.createElement("span");
                value.className = "share-value";
                value.textContent = `${number.format(entry.lectures)} · ${percentage.format(entry.share)}`;
                const track = document.createElement("span");
                track.className = "share-track";
                track.setAttribute("aria-hidden", "true");
                const bar = document.createElement("span");
                bar.className = "share-bar";
                bar.style.width = `${entry.share * 100}%`;
                track.append(bar);
                if (drilldown && entry.lectures > 0) {
                    const [key, getValue] = drilldown;
                    const filters = { [key]: getValue(entry) };
                    if (select.value !== "all") filters.series = summary.seriesId;
                    const description = `${label(entry)} · ${select.selectedOptions[0].textContent}`;
                    row.append(exploreButton(label(entry), description, filters, entry.lectures, "share-label", entry.lectureIds), value, track);
                } else {
                    row.append(name, value, track);
                }
                rows.append(row);
            }
            list.replaceChildren(rows);
            message.textContent = summary.total === 0 ? "No lecture records in this selection. Shares are undefined."
                : !displayed.length ? `No recorded ${noun} in this selection.`
                : limit !== Infinity ? `Showing ${number.format(displayed.length)} of ${number.format(available.length)} recorded ${noun}. The data table contains the full distribution.` : "";
        }
        select.addEventListener("change", render);
        render();
        byId(`${prefix}-visualization`).hidden = false;
        if (tableId) byId(tableId).closest("details").open = false;
    }

    function linkQualityGroups(prefix, analysis, key, ids) {
        const select = byId(`${prefix}-series`);
        const summaries = new Map([["all", analysis.overall],
            ...analysis.perSeries.map(e => [`series:${e.seriesId}`, e])]);
        function render() {
            const summary = summaries.get(select.value);
            if (!summary) return;
            for (const group of summary.selectionGroups ?? []) {
                const node = byId(ids[group.id]);
                if (!node || node.querySelector("button") || group.lectures < 1 ||
                    !Array.isArray(group.lectureIds) || node.textContent.trim() !== number.format(group.lectures)) continue;
                const filters = { [key]: group.id };
                if (select.value !== "all") filters.series = summary.seriesId;
                const description = `${group.label} · ${select.selectedOptions[0].textContent}`;
                node.replaceChildren(exploreButton(number.format(group.lectures), description, filters,
                    group.lectures, "", group.lectureIds));
            }
        }
        const observer = new MutationObserver(render);
        for (const id of Object.values(ids)) observer.observe(byId(id), { childList: true, characterData: true, subtree: true });
        select.addEventListener("change", () => {
            // Remove stale buttons before the observer links the newly rendered counts.
            for (const id of Object.values(ids)) {
                const node = byId(id);
                if (node.querySelector("button")) node.textContent = node.textContent;
            }
            render();
        });
        render();
    }

    async function init() {
        try {
            const response = await fetch("./data/analyses.json");
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            // Independent chart failures must not suppress other visualizations.
            const tasks = [
                () => linkAnnualChart("delivery", data.lecturesPerYear),
                () => linkAnnualChart("audience", data.audiencePerYear),
                () => linkGenderTable(data.genderPerYear),
                () => speakerChart(data.speakerAnalysis?.lecturesPerSpeakerDistribution),
                () => genderChart(data.genderPerYear),
                () => shareChart("institution", data.institutionTypeAnalysis, "types", e => institutionLabels.get(e.type), { tableId: "institution-type-table", drilldown: ["institution-type", e => e.type] }),
                () => shareChart("discipline", data.disciplineAnalysis, "disciplines", e => e.label || e.id, { limit: 10, tableId: "discipline-table", noun: "disciplines", drilldown: ["discipline", e => e.id] }),
                () => shareChart("geography", data.geographicalAnalysis, "connections", e => geographyLabels.get(e.type), { tableId: "geography-table", rank: false, drilldown: ["geo-connection", e => e.type] }),
                () => shareChart("topic-area", data.topicAnalysis, "topicAreas", e => e.label, { selector: "topic", tableId: "topic-area-table", rank: false, drilldown: ["topic-area", e => e.id] }),
                () => linkQualityGroups("geography", data.geographicalAnalysis, "geo-quality", {
                    withoutHostCity: "geography-no-host", withoutAffiliationId: "geography-no-id",
                    unresolvedAffiliation: "geography-unresolved", incompleteAffiliationGeography: "geography-incomplete",
                    withoutKnownConnection: "geography-no-known", multipleConnectionTypes: "geography-multiple" }),
                () => linkQualityGroups("topic", data.topicAnalysis, "topic-quality", {
                    withoutTopics: "topic-without", withoutTopicArea: "topic-no-area", multipleTopicAreas: "topic-multiple" }),
                () => shareChart("topic-top", data.topicAnalysis, "topics", e => e.topic, { selector: "topic", limit: 10, noun: "topics", drilldown: ["topic", e => e.topic] })
            ];
            for (const task of tasks) {
                try { task(); } catch (error) { console.error("Unable to render chart.", error); }
            }
        } catch (error) {
            // Tables and other existing analyses remain available via app.js.
            console.error("Unable to load analysis charts.", error);
        }
    }
    init();
})();
