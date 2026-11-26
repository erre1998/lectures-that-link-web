// Individual lecture records, loaded only when the Lectures view is opened.
(() => {
    "use strict";
    const byId = id => document.getElementById(id);
    const section = document.querySelector('[data-analysis-view="lectures"]');
    const tab = document.querySelector('[data-analysis-target="lectures"]');
    if (!section || !tab) return;

    const status = byId("lecture-results-status");
    const region = byId("lecture-results-region");
    const pagination = byId("lecture-pagination");
    const previous = byId("lecture-prev");
    const next = byId("lecture-next");
    const retry = byId("lecture-retry");
    const number = new Intl.NumberFormat("en");
    const pageSize = 25;
    let records = [];
    let page = 0;
    let loaded = false;
    let loading = false;

    function validDataset(data) {
        const items = data?.lectures;
        return data?.schemaVersion === 2 && Array.isArray(items) &&
            data.counts?.lectures === items.length &&
            items.every(record => record &&
                typeof record.id === "string" && record.id.length > 0 &&
                typeof record.date === "string" &&
                typeof record.title === "string" &&
                typeof record.seriesName === "string" &&
                typeof record.seriesId === "string" &&
                typeof record.hasAbstract === "boolean" &&
                Array.isArray(record.deliveryFormats) &&
                record.deliveryFormats.every(value => typeof value === "string") &&
                Array.isArray(record.speakerDetails) &&
                record.speakerDetails.every(person => person &&
                    typeof person.id === "string" &&
                    typeof person.label === "string" &&
                    typeof person.resolved === "boolean")) &&
            new Set(items.map(record => record.id)).size === items.length;
    }

    function cell(tag, value) {
        const element = document.createElement(tag);
        element.textContent = value;
        return element;
    }

    function renderRecord(record) {
        const row = document.createElement("tr");
        const date = cell("td", record.date || "Not recorded");
        const title = cell("th", record.title || "Untitled lecture");
        title.scope = "row";
        if (record.deliveryFormats.includes("canceled")) {
            const note = cell("span", "Canceled");
            note.className = "lecture-record-note";
            title.append(note);
        }

        const speakers = document.createElement("td");
        if (!record.speakerDetails.length) {
            speakers.textContent = "Not recorded";
        } else {
            const list = document.createElement("ul");
            list.className = "lecture-speakers";
            for (const person of record.speakerDetails) {
                const label = person.label || person.id || "Not recorded";
                list.append(cell("li", person.resolved ? label : `${label} (unresolved ID)`));
            }
            speakers.append(list);
        }

        row.append(date, title, speakers,
            cell("td", record.seriesName || record.seriesId || "Not recorded"),
            cell("td", record.hasAbstract ? "Available" : "Not available"));
        return row;
    }

    function renderPage() {
        const total = records.length;
        const pages = Math.max(1, Math.ceil(total / pageSize));
        page = Math.min(Math.max(0, page), pages - 1);
        const start = page * pageSize;
        const end = Math.min(start + pageSize, total);
        const rows = document.createDocumentFragment();
        for (const record of records.slice(start, end)) {
            rows.append(renderRecord(record));
        }
        byId("lecture-results").replaceChildren(rows);
        status.textContent = total
            ? `Showing ${number.format(start + 1)}–${number.format(end)} of ${number.format(total)} lecture records.`
            : "No lecture records available.";
        byId("lecture-page").textContent = `Page ${number.format(page + 1)} of ${number.format(pages)}`;
        previous.disabled = page === 0;
        next.disabled = page === pages - 1;
        region.hidden = total === 0;
        pagination.hidden = pages <= 1;
    }

    function changePage(delta, button) {
        page += delta;
        renderPage();
        // A disabled button cannot retain keyboard focus reliably.
        if (button.disabled) status.focus();
    }

    previous.addEventListener("click", () => changePage(-1, previous));
    next.addEventListener("click", () => changePage(1, next));

    async function loadLectures() {
        if (loaded || loading) return;
        loading = true;
        retry.hidden = true;
        section.setAttribute("aria-busy", "true");
        status.textContent = "Loading lecture records…";
        try {
            const response = await fetch("./data/lectures.json");
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            if (!validDataset(data)) throw new Error("Invalid lecture data or unsupported schema. Regenerate lectures.json.");
            // Keep the deterministic order supplied by build.py (date, then ID).
            records = data.lectures;
            page = 0;
            renderPage();
            loaded = true;
        } catch (error) {
            status.textContent = "Unable to load lecture records. Please try again or regenerate lectures.json.";
            region.hidden = true;
            pagination.hidden = true;
            retry.hidden = false;
            console.error("Unable to load lecture records.", error);
        } finally {
            loading = false;
            section.setAttribute("aria-busy", "false");
        }
    }

    tab.addEventListener("click", loadLectures);
    retry.addEventListener("click", loadLectures);
    if (!section.hidden) loadLectures();
})();
