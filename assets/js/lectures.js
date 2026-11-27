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
    const searchPanel = byId("lecture-search-panel");
    const search = byId("lecture-search");
    const clear = byId("lecture-search-clear");
    const number = new Intl.NumberFormat("en");
    const pageSize = 25;
    const filterPanel = byId("lecture-filters");
    const resetFilters = byId("lecture-filters-reset");
    const detail = byId("lecture-detail");
    const detailContent = byId("lecture-detail-content");
    let detailTrigger = null;
    const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
    const option = (value, label = value) => ({ value, label });
    const entities = (items, resolvedOnly = false) => (items ?? [])
        .filter(item => item.id && (!resolvedOnly || item.resolved))
        .map(item => option(item.id, `${item.label || item.id}${item.resolved ? "" : " (unresolved ID)"}`));
    const values = items => (items ?? []).filter(Boolean).map(value => option(value));
    const years = record => record.year && /^\d{4}$/.test(record.year) ? [option(record.year)] : [];
    const genderLabels = { female: "Female", male: "Male", "non-binary": "Non-binary" };
    const derivedFields = [
        ["geo-connection", "geographicalAnalysis", "connections", "type"],
        ["geo-quality", "geographicalAnalysis", "selectionGroups", "id"],
        ["topic-area", "topicAnalysis", "topicAreas", "id"],
        ["topic-quality", "topicAnalysis", "selectionGroups", "id"]
    ];
    const derivedMembership = new Map();
    const derivedOptions = (record, key) => derivedMembership.get(key)?.get(record.id) ?? [];
    const filters = [
        { key: "from", options: years, matches: (record, value) => years(record).length > 0 && record.year >= value },
        { key: "to", options: years, matches: (record, value) => years(record).length > 0 && record.year <= value },
        { key: "series", options: record => [option(record.seriesId, record.seriesName || record.seriesId)] },
        { key: "speaker", options: record => entities(record.speakerDetails) },
        { key: "gender", options: record => record.speakerDetails.flatMap(person => (person.genders ?? [])
            .filter(gender => Object.hasOwn(genderLabels, gender)).map(gender => option(gender, genderLabels[gender])) ) },
        { key: "affiliation", options: record => entities(record.affiliations) },
        { key: "institution-type", options: record => values((record.affiliations ?? []).filter(item => item.resolved).map(item => item.type)) },
        { key: "host-country", options: record => entities(record.hostGeography?.countries, true) },
        { key: "affiliation-country", options: record => entities(record.affiliationGeography?.countries, true) },
        { key: "delivery", options: record => values(record.deliveryFormats) },
        { key: "audience", options: record => values(record.audienceFormats) },
        { key: "discipline", options: record => entities(record.disciplineDetails, true) },
        { key: "topic", options: record => values(record.topics) },
        { key: "abstract", options: record => [option(record.hasAbstract ? "available" : "unavailable", record.hasAbstract ? "Available" : "Not available")] },
        ...derivedFields.map(([key]) => ({ key, options: record => derivedOptions(record, key) }))
    ].map(filter => ({ ...filter, control: byId(`lecture-filter-${filter.key}`) }));

    let records = [];
    let searchIndex = [];
    let matches = [];
    let page = 0;
    let loaded = false;
    let loading = false;
    let pendingSelection = null;
    const selectionNote = byId("lecture-analysis-selection");

    // Start a fresh, reproducible query from a quantitative chart.
    // Do not silently combine it with a previous search or filter state.
    function applyAnalysisSelection() {
        if (!pendingSelection) return;
        const selection = pendingSelection;
        pendingSelection = null;
        const entries = Object.entries(selection.filters);
        const selected = entries.map(([key, value]) => ({
            filter: filters.find(item => item.key === key), value
        }));
        const valid = selected.every(({ filter, value }) => filter &&
            [...filter.control.options].some(item => item.value === value));
        const matched = valid ? searchIndex.filter(entry => selected.every(({ filter, value }) =>
            filter.matches ? filter.matches(entry.record, value) : entry.filters[filter.key].has(value))) : [];
        const count = valid ? matched.length : -1;
        const requiresIds = entries.some(([key]) => derivedFields.some(([derived]) => key === derived));
        const expectedIds = Array.isArray(selection.lectureIds) ? new Set(selection.lectureIds) : null;
        const sameIds = !requiresIds || (expectedIds && expectedIds.size === selection.expected &&
            selection.lectureIds.length === expectedIds.size && matched.every(entry => expectedIds.has(entry.record.id)));
        selectionNote.hidden = false;
        if (!valid || count !== selection.expected || !sameIds) {
            selectionNote.textContent = "The selected analysis could not be matched to the lecture export. Previous filters have been retained. Regenerate both JSON files from the same source.";
            return;
        }
        search.value = "";
        for (const filter of filters) filter.control.value = "";
        for (const { filter, value } of selected) filter.control.value = value;
        filterPanel.open = true;
        applySearch();
        selectionNote.hidden = false;
        selectionNote.textContent = `Analysis selection: ${selection.label} (${number.format(count)} lecture records). You can refine or reset these filters.`;
    }

    document.addEventListener("lecture:explore", event => {
        const selection = event.detail;
        if (!selection || !selection.filters || typeof selection.label !== "string" ||
            !Number.isInteger(selection.expected) || selection.expected < 1) return;
        pendingSelection = selection;
        tab.click();
        byId("lectures-heading").focus();
        if (loaded) applyAnalysisSelection();
    });

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

    // Normalize Unicode and case, without changing the original display text.
    function normalize(value) {
        return value.normalize("NFKC").toLowerCase().replace(/\s+/gu, " ").trim();
    }

    // Index explicit metadata fields, not the entire JSON serialization.
    // Placeholder abstracts and internal status strings are not searchable.
    function searchableText(record) {
        const fields = [record.title, record.date, record.year,
            record.seriesName, record.termName, record.titleLanguage,
            record.id, record.seriesId, record.termId];
        for (const abstract of record.abstracts ?? []) {
            if (abstract.status === "available") fields.push(abstract.text, abstract.language);
        }
        for (const group of [record.speakerDetails, record.affiliations,
            record.hostInstitutions, record.disciplineDetails]) {
            for (const entity of group ?? []) fields.push(entity.label, entity.id, entity.type);
        }
        for (const geography of [record.hostGeography, record.affiliationGeography]) {
            for (const group of [geography?.places, geography?.cities, geography?.countries]) {
                for (const entity of group ?? []) fields.push(entity.label, entity.id);
            }
        }
        fields.push(...(record.topics ?? []), ...(record.deliveryFormats ?? []),
            ...(record.audienceFormats ?? []));
        return fields.filter(value => typeof value === "string")
            .map(normalize).filter(Boolean).join("\n");
    }

    function populateFilters() {
        for (const filter of filters) {
            const options = new Map();
            for (const record of records) {
                for (const item of filter.options(record)) {
                    if (item.value) options.set(item.value, item.label);
                }
            }
            const fragment = document.createDocumentFragment();
            fragment.append(new Option("Any", ""));
            // Distinguish homonymous entities without merging their IDs.
            const labelCounts = new Map();
            for (const label of options.values()) labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
            for (const [value, label] of [...options].sort((a, b) => collator.compare(a[1], b[1]) || collator.compare(a[0], b[0]))) {
                fragment.append(new Option(labelCounts.get(label) > 1 ? `${label} (${value})` : label, value));
            }
            filter.control.replaceChildren(fragment);
            filter.control.disabled = derivedFields.some(([key]) => key === filter.key) && !derivedMembership.has(filter.key);
        }
        filterPanel.hidden = false;
    }

    function applySearch() {
        selectionNote.hidden = true;
        const terms = [...new Set(normalize(search.value).split(" ").filter(Boolean))];
        const active = filters.filter(filter => filter.control.value !== "");
        const from = byId("lecture-filter-from");
        const to = byId("lecture-filter-to");
        const invalidRange = Boolean(from.value && to.value && from.value > to.value);
        byId("lecture-filter-error").hidden = !invalidRange;
        from.setAttribute("aria-invalid", String(invalidRange));
        to.setAttribute("aria-invalid", String(invalidRange));
        matches = invalidRange ? [] : searchIndex.filter(entry =>
            terms.every(term => entry.text.includes(term)) && active.every(filter =>
                filter.matches ? filter.matches(entry.record, filter.control.value) :
                    entry.filters[filter.key].has(filter.control.value)))
            .map(entry => entry.record);
        page = 0;
        clear.disabled = search.value === "";
        resetFilters.disabled = active.length === 0;
        byId("lecture-filter-count").textContent = active.length ? `(${active.length} active)` : "";
        renderPage();
    }

    function cell(tag, value) {
        const element = document.createElement(tag);
        element.textContent = value;
        return element;
    }

    function renderRecord(record) {
        const row = document.createElement("tr");
        const date = cell("td", record.date || "Not recorded");
        const title = document.createElement("th");
        title.scope = "row";
        const button = cell("button", record.title || "Untitled lecture");
        button.type = "button";
        button.className = "lecture-title-button";
        button.setAttribute("aria-haspopup", "dialog");
        if (record.titleLanguage) button.lang = record.titleLanguage;
        button.addEventListener("click", () => openDetail(record, button));
        title.append(button);
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
        const total = matches.length;
        const pages = Math.max(1, Math.ceil(total / pageSize));
        page = Math.min(Math.max(0, page), pages - 1);
        const start = page * pageSize;
        const end = Math.min(start + pageSize, total);
        const rows = document.createDocumentFragment();
        for (const record of matches.slice(start, end)) {
            rows.append(renderRecord(record));
        }
        byId("lecture-results").replaceChildren(rows);
        const restricted = Boolean(normalize(search.value) || filters.some(filter => filter.control.value));
        status.textContent = total
            ? `Showing ${number.format(start + 1)}–${number.format(end)} of ${number.format(total)} lecture records${restricted ? ` (${number.format(records.length)} in the corpus)` : ""}.`
            : restricted ? "No matching lecture records." : "No lecture records available.";
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

    search.addEventListener("input", applySearch);
    clear.addEventListener("click", () => {
        search.value = "";
        applySearch();
        search.focus();
    });
    for (const filter of filters) filter.control.addEventListener("change", applySearch);
    resetFilters.addEventListener("click", () => {
        for (const filter of filters) filter.control.value = "";
        applySearch();
        filterPanel.querySelector("summary").focus();
    });

    // Prefer the most specific available programme scope. Keep the source
    // metadata intact and show supplementary materials only for this lecture.
    function appendResources(resources) {
        const programmeLabels = {
            lecture: "Lecture programme",
            term: "Semester programme",
            series: "Lecture series website"
        };
        const materialLabels = {
            video: "Video recording",
            slides: "Presentation slides",
            blogpost: "Blog post"
        };
        const valid = [];
        for (const resource of resources) {
            if (typeof resource?.url !== "string") continue;
            let url;
            try { url = new URL(resource.url); } catch { continue; }
            if (!["http:", "https:"].includes(url.protocol)) continue;
            valid.push({ ...resource, href: url.href });
        }
        const scope = ["lecture", "term", "series"].find(scope =>
            valid.some(resource => resource.type === "programme" && resource.scope === scope));
        const programmes = valid.filter(resource => resource.type === "programme" && resource.scope === scope && scope !== undefined);
        const materials = valid.filter(resource => resource.scope === "lecture" &&
            Object.hasOwn(materialLabels, resource.type));
        const seen = new Set();

        function appendGroup(heading, entries, labelFor) {
            const list = document.createElement("ul");
            const labels = new Map();
            for (const entry of entries) {
                if (seen.has(entry.href)) continue;
                seen.add(entry.href);
                const label = labelFor(entry);
                const occurrence = (labels.get(label) ?? 0) + 1;
                labels.set(label, occurrence);
                const item = document.createElement("li");
                const link = cell("a", occurrence === 1 ? label : `${label} ${occurrence}`);
                link.href = entry.href;
                item.append(link);
                list.append(item);
            }
            if (list.children.length) detailContent.append(cell("h3", heading), list);
        }

        appendGroup("Programme sources", programmes, entry => programmeLabels[entry.scope]);
        appendGroup("Supplementary materials", materials, entry => materialLabels[entry.type]);
    }

    function openDetail(record, trigger) {
        detailTrigger = trigger;
        detailContent.replaceChildren();
        detailContent.append(cell("p", record.title || "Untitled lecture"));
        const title = detailContent.firstElementChild;
        title.className = "lecture-detail-title";
        if (record.titleLanguage) title.lang = record.titleLanguage;
        const metadata = document.createElement("dl");
        metadata.className = "lecture-detail-metadata";
        const add = (label, value) => metadata.append(cell("dt", label), cell("dd", value || "Not recorded"));
        const list = items => (items ?? []).filter(Boolean).join("; ");
        const names = items => list(entities(items).map(item => item.label));
        const countries = geo => list([...entities(geo?.countries).map(item => item.label),
            ...(geo?.unresolvedOrInvalidCountryIds ?? []).map(id => `${id} (unresolved or invalid country ID)`)]);
        add("Lecture ID", record.id);
        add("Date", record.date);
        add("Lecture series", record.seriesName);
        add("Term", record.termName);
        add("Title language", record.titleLanguage);
        add("Lecture delivery", list(record.deliveryFormats));
        add("Audience participation", list(record.audienceFormats));
        add("Host institutions", names(record.hostInstitutions));
        add("Host places", names(record.hostGeography?.places));
        add("Host countries", countries(record.hostGeography));
        add("Affiliation institutions", names(record.affiliations));
        add("Affiliation places", names(record.affiliationGeography?.places));
        add("Affiliation countries", countries(record.affiliationGeography));
        add("Annotated disciplines", names(record.disciplineDetails));
        detailContent.append(metadata, cell("h3", "Speakers"));
        const people = document.createElement("ul");
        for (const person of record.speakerDetails) {
            const affiliations = (person.affiliationIds ?? []).map(id => {
                const org = (record.affiliations ?? []).find(item => item.id === id);
                return org ? names([org]) : `${id} (unresolved ID)`;
            });
            people.append(cell("li", `${names([person])}${affiliations.length ? ` — ${list(affiliations)}` : ""}`));
        }
        detailContent.append(people.children.length ? people : cell("p", "No speakers recorded."));
        detailContent.append(cell("h3", "Abstracts"));
        const abstracts = (record.abstracts ?? []).filter(item => item.status === "available");
        if (!abstracts.length) detailContent.append(cell("p", "No abstract available."));
        for (const abstract of abstracts) {
            const label = cell("h4", abstract.language ? `Abstract (${abstract.language})` : "Abstract (language not recorded)");
            const text = cell("p", abstract.text);
            if (abstract.language) text.lang = abstract.language;
            detailContent.append(label, text);
        }
        detailContent.append(cell("h3", "LLM-generated topics"), cell("p", list(record.topics) || "No topics recorded."));
        appendResources(record.resources ?? []);
        detail.showModal();
        detail.scrollTop = 0;
    }
    detail.addEventListener("close", () => {
        if (detailTrigger?.isConnected) detailTrigger.focus();
        detailTrigger = null;
    });

    function loadDerivedMembership(analysis, data) {
        if (analysis.datasetVersion !== data.version || analysis.counts?.lectures !== records.length) {
            throw new Error("Analysis and lecture exports differ in version or record count.");
        }
        const byRecord = new Map(records.map(record => [record.id, record]));
        const seriesCounts = new Map();
        for (const record of records) seriesCounts.set(record.seriesId, (seriesCounts.get(record.seriesId) ?? 0) + 1);
        const result = new Map();
        for (const [key, analysisKey, field, idField] of derivedFields) {
            const source = analysis[analysisKey];
            const groups = source?.overall?.[field];
            if (!Array.isArray(groups) || source.overall.total !== records.length || !Array.isArray(source.perSeries)) {
                throw new Error(`Missing ${key} membership. Regenerate analyses.json.`);
            }
            const validateGroup = group => {
                if (typeof group[idField] !== "string" || !Array.isArray(group.lectureIds) ||
                    group.lectureIds.length !== group.lectures || new Set(group.lectureIds).size !== group.lectures ||
                    !group.lectureIds.every(id => byRecord.has(id))) throw new Error(`Invalid ${key} membership.`);
            };
            const membership = new Map();
            const byGroup = new Map();
            for (const group of groups) {
                validateGroup(group);
                if (byGroup.has(group[idField])) throw new Error(`Duplicate ${key} group.`);
                byGroup.set(group[idField], group);
                const label = group.label ?? ({ local: "Local", national: "National", European: "European", "other continents": "Other continents" }[group[idField]] ?? group[idField]);
                for (const id of group.lectureIds) {
                    if (!membership.has(id)) membership.set(id, []);
                    membership.get(id).push(option(group[idField], label));
                }
            }
            const seen = new Set();
            for (const summary of source.perSeries) {
                if (seen.has(summary.seriesId) || summary.total !== (seriesCounts.get(summary.seriesId) ?? 0) ||
                    !Array.isArray(summary[field]) || summary[field].length !== groups.length ||
                    new Set(summary[field].map(group => group[idField])).size !== groups.length) throw new Error(`Invalid ${key} series summary.`);
                seen.add(summary.seriesId);
                for (const group of summary[field]) {
                    validateGroup(group);
                    const overall = byGroup.get(group[idField]);
                    if (!overall) throw new Error(`Unknown ${key} group.`);
                    const expected = new Set(overall.lectureIds.filter(id => byRecord.get(id).seriesId === summary.seriesId));
                    if (expected.size !== group.lectures || !group.lectureIds.every(id => expected.has(id))) throw new Error(`Inconsistent ${key} series membership.`);
                }
            }
            if (![...seriesCounts.keys()].every(id => seen.has(id))) throw new Error(`Missing ${key} series summary.`);
            result.set(key, membership);
        }
        for (const [key, membership] of result) derivedMembership.set(key, membership);
    }

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
            try {
                const analysisResponse = await fetch("./data/analyses.json");
                if (!analysisResponse.ok) throw new Error(`HTTP ${analysisResponse.status}`);
                loadDerivedMembership(await analysisResponse.json(), data);
            } catch (error) {
                // Keep the ordinary explorer usable if the analysis export is missing or outdated.
                console.error("Unable to load derived filters.", error);
                byId("lecture-derived-warning").hidden = false;
            }
            searchIndex = records.map(record => ({ record, text: searchableText(record),
                filters: Object.fromEntries(filters.map(filter => [filter.key,
                    new Set(filter.options(record).map(item => item.value))])) }));
            populateFilters();
            search.value = "";
            search.disabled = false;
            searchPanel.hidden = false;
            applySearch();
            loaded = true;
            applyAnalysisSelection();
        } catch (error) {
            status.textContent = "Unable to load lecture records. Please try again or regenerate lectures.json.";
            searchPanel.hidden = true;
            filterPanel.hidden = true;
            search.disabled = true;
            clear.disabled = true;
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
