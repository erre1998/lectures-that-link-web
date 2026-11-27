const format = new Intl.NumberFormat("en");
const percent = new Intl.NumberFormat("en", {
    style: "percent", maximumFractionDigits: 1
});
const byId = id => document.getElementById(id);
const validCount = value => Number.isInteger(value) && value >= 0;

function setCount(id, value) {
    byId(id).textContent = format.format(value);
}

function overviewValues(data) {
    const overview = data.corpusOverview;
    return {
        "count-series": data.counts?.series,
        "count-terms": data.counts?.terms,
        "count-lectures": data.counts?.lectures,
        "count-speakers": data.speakerAnalysis?.uniqueSpeakers,
        "count-organizers": overview?.organizers?.registeredPersons,
        "count-host-institutions": overview?.hostInstitutions?.registeredInstitutions,
        "count-affiliation-institutions": overview?.affiliationInstitutions?.registeredInstitutions,
        "count-host-cities": overview?.hostGeography?.cities,
        "count-host-countries": overview?.hostGeography?.countries,
        "count-affiliation-cities": overview?.affiliationGeography?.cities,
        "count-affiliation-countries": overview?.affiliationGeography?.countries
    };
}

function renderOverview(data) {
    byId("dataset-version").textContent = `Dataset: ${data.datasetVersion}`;
    for (const [id, value] of Object.entries(overviewValues(data))) {
        setCount(id, value);
    }
}

// Render precomputed statistics as accessible tables.
function renderRows(id, entries, label, cells, emptyMessage = "") {
    const rows = document.createDocumentFragment();

    for (const entry of entries) {
        const row = document.createElement("tr");
        const heading = document.createElement("th");

        heading.scope = "row";
        heading.textContent = label(entry);
        row.appendChild(heading);

        for (const cellValue of cells) {
            const cell = document.createElement("td");
            cell.textContent = cellValue(entry);
            row.appendChild(cell);
        }

        rows.appendChild(row);
    }

    if (!entries.length && emptyMessage) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = cells.length + 1;
        cell.textContent = emptyMessage;

        row.appendChild(cell);
        rows.appendChild(row);
    }

    byId(id).replaceChildren(rows);
}

function renderTable(id, entries, headingField, fields) {
    renderRows(id, entries, entry => entry[headingField],
        fields.map(field => entry => format.format(entry[field])));
}

function renderShareTable(id, entries, label, emptyMessage = "") {
    renderRows(id, entries, label, [
        entry => format.format(entry.lectures),
        entry => entry.share === null ? "–" : percent.format(entry.share)
    ], emptyMessage);
}

// Chart widths are presentation values, not scientific calculations.
function renderBars(id, entries, label, value, maximum) {
    const rows = document.createDocumentFragment();

    for (const entry of entries) {
        const item = document.createElement("li");

        const name = document.createElement("span");
        name.className = "chart-year";
        name.textContent = label(entry);

        const track = document.createElement("span");
        track.className = "chart-track";
        track.setAttribute("aria-hidden", "true");

        const bar = document.createElement("span");
        bar.className = "chart-bar";
        bar.style.width = `${maximum > 0 ? value(entry) / maximum * 100 : 0}%`;

        track.appendChild(bar);

        const count = document.createElement("span");
        count.className = "chart-value";
        count.textContent = format.format(value(entry));

        item.append(name, track, count);
        rows.appendChild(item);
    }

    byId(id).replaceChildren(rows);
}

function setupAnnualChart(prefix, entries, maximum) {
    const select = byId(`${prefix}-category`);
    const list = byId(`${prefix}-chart`);

    byId(`${prefix}-scale`).textContent =
        `Scale: 0–${format.format(maximum)} lecture records`;

    function render() {
        const field = select.value;
        const category = select.options[select.selectedIndex].text;
        const name = prefix === "delivery"
            ? "Lecture delivery"
            : "Audience participation";

        list.setAttribute("aria-label", `${name}: ${category} by year`);

        renderBars(
            `${prefix}-chart`,
            entries,
            entry => entry.year,
            entry => entry[field],
            maximum
        );
    }

    select.addEventListener("change", render);
    render();
    select.disabled = false;
}

function renderDistribution(prefix, entries, categoryField, frequencyField, unit) {
    const maximum = Math.max(0, ...entries.map(entry => entry[frequencyField]));

    byId(`${prefix}-scale`).textContent =
        `Scale: 0–${format.format(maximum)} ${unit}`;

    const label = entry => format.format(entry[categoryField]);

    renderRows(`${prefix}-table`, entries, label,
        [entry => format.format(entry[frequencyField])]);

    renderBars(`${prefix}-chart`, entries, label,
        entry => entry[frequencyField], maximum);
}

// Lecture series structure.
function renderSeriesStructure(structure) {
    renderDistribution(
        "terms-distribution",
        structure.termsPerSeriesDistribution,
        "terms", "series", "lecture series"
    );

    renderDistribution(
        "lectures-distribution",
        structure.lecturesPerTermDistribution,
        "lectures", "terms", "terms"
    );
}

// Speaker analysis.
function renderSpeakerAnalysis(analysis) {
    setCount("speaker-assignments", analysis.speakerLectureAssignments);
    setCount("speaker-unresolved", analysis.unresolvedSpeakerIds);
    setCount("speaker-missing", analysis.lecturesWithoutSpeakerId);

    renderTable(
        "speaker-distribution-table",
        analysis.lecturesPerSpeakerDistribution,
        "lectures", ["speakers"]
    );
}

// Annual gender analysis.
const genderFields = [
    "female", "male", "nonBinary", "multipleGenderCategories",
    "withoutKnownGender", "total"
];

const genderQualityFields = [
    "withoutSpeakerId", "unresolvedSpeaker", "unknownGender"
];

function renderGenderAnalysis(entries) {
    renderTable("gender-per-year", entries, "year", genderFields);
    renderTable("gender-quality-per-year", entries, "year", genderQualityFields);
}

// Shared validation and selection for corpus and series summaries.
function validShare(entry, total) {
    return entry &&
        validCount(entry.lectures) &&
        entry.lectures <= total &&
        (total === 0
            ? entry.share === null
            : Number.isFinite(entry.share) &&
              entry.share >= 0 &&
              entry.share <= 1);
}

function validQuality(summary, quality) {
    return summary &&
        validCount(summary.total) &&
        Object.values(quality).every(field =>
            validCount(summary[field]) &&
            summary[field] <= summary.total
        );
}

function uniqueValues(entries, field) {
    return new Set(
        entries.map(entry => entry[field])
    ).size === entries.length;
}

function validSeriesAnalysis(analysis, validate) {
    return Boolean(
        analysis &&
        validate(analysis.overall) &&
        Array.isArray(analysis.perSeries) &&
        analysis.perSeries.every(entry =>
            validate(entry) &&
            typeof entry.seriesId === "string" &&
            entry.seriesId.length > 0 &&
            typeof entry.seriesName === "string"
        ) &&
        uniqueValues(analysis.perSeries, "seriesId")
    );
}

function setupSeriesSelector(prefix, analysis, renderSummary) {
    const select = byId(`${prefix}-series`);
    const summaries = new Map([["all", analysis.overall]]);

    const series = [...analysis.perSeries].sort((a, b) =>
        (a.seriesName || a.seriesId).localeCompare(
            b.seriesName || b.seriesId, "en"
        ) ||
        a.seriesId.localeCompare(b.seriesId, "en")
    );

    for (const entry of series) {
        const option = document.createElement("option");

        option.value = `series:${entry.seriesId}`;
        option.textContent = entry.seriesName || entry.seriesId;

        select.appendChild(option);
        summaries.set(option.value, entry);
    }

    function render() {
        const summary = summaries.get(select.value);

        if (!summary) return;

        byId(`${prefix}-total`).textContent =
            `Lecture records: ${format.format(summary.total)}`;

        renderSummary(summary);
    }

    select.value = "all";
    select.addEventListener("change", render);
    render();
    select.disabled = false;

    return render;
}

function renderQuality(summary, quality) {
    for (const [id, field] of Object.entries(quality)) {
        setCount(id, summary[field]);
    }
}

function validTypeSummary(summary, field, labels, quality) {
    return validQuality(summary, quality) &&
        Array.isArray(summary[field]) &&
        summary[field].length === labels.size &&
        summary[field].every(entry =>
            validShare(entry, summary.total) &&
            labels.has(entry.type)
        ) &&
        uniqueValues(summary[field], "type");
}

// Institutional affiliations.
const institutionLabels = new Map([
    ["university", "University"],
    ["research_institution", "Research institution"],
    ["glam", "GLAM"],
    ["company", "Company"],
    ["other", "Other"],
    ["self-employment", "Self-employment"]
]);

const institutionQuality = {
    "institution-no-id": "withoutAffiliationId",
    "institution-unresolved": "unresolvedAffiliation",
    "institution-unknown": "unknownInstitutionType",
    "institution-no-type": "withoutKnownType",
    "institution-multiple": "multipleInstitutionTypes"
};

function validInstitutionSummary(summary) {
    return validTypeSummary(
        summary, "types", institutionLabels, institutionQuality
    );
}

function setupInstitutionAnalysis(analysis) {
    setupSeriesSelector("institution", analysis, summary => {
        renderShareTable(
            "institution-type-table",
            summary.types,
            entry => institutionLabels.get(entry.type)
        );

        renderQuality(summary, institutionQuality);
    });
}

// Disciplinary distribution.
const disciplineQuality = {
    "discipline-no-id": "withoutDisciplineId",
    "discipline-unresolved": "unresolvedDiscipline",
    "discipline-invalid": "invalidDisciplineReference",
    "discipline-no-known": "withoutKnownDiscipline",
    "discipline-multiple": "multipleDisciplines"
};

function validDisciplineSummary(summary) {
    if (!validQuality(summary, disciplineQuality)) return false;

    const validId = entry =>
        entry &&
        typeof entry.id === "string" &&
        entry.id.length > 0 &&
        validCount(entry.lectures) &&
        entry.lectures <= summary.total;

    return Array.isArray(summary.disciplines) &&
        summary.disciplines.length > 0 &&
        summary.disciplines.every(entry =>
            validId(entry) &&
            typeof entry.label === "string" &&
            validShare(entry, summary.total)
        ) &&
        uniqueValues(summary.disciplines, "id") &&
        Array.isArray(summary.unresolvedIds) &&
        summary.unresolvedIds.every(entry =>
            validId(entry) && entry.lectures > 0
        ) &&
        uniqueValues(summary.unresolvedIds, "id");
}

function validDisciplineAnalysis(analysis) {
    if (!validSeriesAnalysis(analysis, validDisciplineSummary)) return false;

    const ids = new Set(
        analysis.overall.disciplines.map(entry => entry.id)
    );

    return analysis.perSeries.every(entry =>
        entry.disciplines.length === ids.size &&
        entry.disciplines.every(item => ids.has(item.id))
    );
}

function setupDisciplineAnalysis(analysis) {
    const showZero = byId("discipline-show-zero");
    showZero.checked = false;

    const render = setupSeriesSelector("discipline", analysis, summary => {
        const entries = summary.disciplines.filter(entry =>
            showZero.checked || entry.lectures > 0
        );

        renderShareTable(
            "discipline-table",
            entries,
            entry => entry.label || entry.id,
            "No recorded disciplines in this selection."
        );

        renderQuality(summary, disciplineQuality);

        renderTable(
            "discipline-unresolved-table",
            summary.unresolvedIds,
            "id", ["lectures"]
        );

        byId("discipline-unresolved-region").hidden =
            summary.unresolvedIds.length === 0;

        byId("discipline-unresolved-empty").hidden =
            summary.unresolvedIds.length > 0;
    });

    showZero.addEventListener("change", render);
    showZero.disabled = false;
}

// Geographical connections.
const geographyLabels = new Map([
    ["local", "Local"],
    ["national", "National"],
    ["European", "European"],
    ["other continents", "Other continents"]
]);

const geographyQuality = {
    "geography-no-host": "withoutHostCity",
    "geography-no-id": "withoutAffiliationId",
    "geography-unresolved": "unresolvedAffiliation",
    "geography-incomplete": "incompleteAffiliationGeography",
    "geography-no-known": "withoutKnownConnection",
    "geography-multiple": "multipleConnectionTypes"
};

function validGeographySummary(summary) {
    return validTypeSummary(
        summary, "connections", geographyLabels, geographyQuality
    );
}

function setupGeographyAnalysis(analysis) {
    setupSeriesSelector("geography", analysis, summary => {
        renderShareTable(
            "geography-table",
            summary.connections,
            entry => geographyLabels.get(entry.type)
        );

        renderQuality(summary, geographyQuality);
    });
}

// LLM-generated topics: filter and paginate the precomputed keyword list.
const topicAreaIds = new Set([
    "digitizationAndCulturalHeritage",
    "digitalEdition",
    "analysis",
    "artificialIntelligence"
]);

const topicQuality = {
    "topic-with": "withTopics",
    "topic-without": "withoutTopics",
    "topic-no-area": "withoutTopicArea",
    "topic-multiple": "multipleTopicAreas"
};

function validTopicSummary(summary) {
    return validQuality(summary, topicQuality) &&
        summary.withTopics + summary.withoutTopics === summary.total &&
        validCount(summary.distinctTopics) &&
        validCount(summary.topicAssignments) &&
        Array.isArray(summary.topics) &&
        summary.topics.length === summary.distinctTopics &&
        summary.topics.every(entry =>
            validShare(entry, summary.total) &&
            entry.lectures > 0 &&
            typeof entry.topic === "string" &&
            entry.topic.length > 0
        ) &&
        uniqueValues(summary.topics, "topic") &&
        summary.topics.reduce(
            (sum, entry) => sum + entry.lectures, 0
        ) === summary.topicAssignments &&
        Array.isArray(summary.topicAreas) &&
        summary.topicAreas.length === topicAreaIds.size &&
        summary.topicAreas.every(entry =>
            validShare(entry, summary.total) &&
            topicAreaIds.has(entry.id) &&
            typeof entry.label === "string"
        ) &&
        uniqueValues(summary.topicAreas, "id");
}

function setupTopicAnalysis(analysis) {
    const search = byId("topic-search");
    const previous = byId("topic-prev");
    const next = byId("topic-next");

    const pageSize = 25;

    let summary = analysis.overall;
    let page = 0;

    search.value = "";

    // Search all topics in the selected scope.
    // Filtering changes the displayed rows, not the original statistics.
    function renderTopics() {
        const query = search.value.trim().toLowerCase();

        const matches = summary.topics.filter(entry =>
            entry.topic.toLowerCase().includes(query)
        );

        const lastPage = Math.max(
            0, Math.ceil(matches.length / pageSize) - 1
        );

        page = Math.min(Math.max(0, page), lastPage);

        const start = page * pageSize;
        const end = Math.min(start + pageSize, matches.length);

        renderShareTable(
            "topic-table",
            matches.slice(start, end),
            entry => entry.topic,
            "No matching topics."
        );

        byId("topic-results").textContent = matches.length
            ? `Showing ${format.format(start + 1)}–${format.format(end)} of ${format.format(matches.length)} matching topics`
            : "No matching topics.";

        previous.disabled = page === 0;
        next.disabled = page === lastPage;
    }

    setupSeriesSelector("topic", analysis, selection => {
        summary = selection;
        page = 0;

        setCount("topic-distinct", summary.distinctTopics);
        setCount("topic-assignments", summary.topicAssignments);

        renderQuality(summary, topicQuality);

        renderShareTable(
            "topic-area-table",
            summary.topicAreas,
            entry => entry.label
        );

        renderTopics();
    });

    search.addEventListener("input", () => {
        page = 0;
        renderTopics();
    });

    previous.addEventListener("click", () => {
        page--;
        renderTopics();
    });

    next.addEventListener("click", () => {
        page++;
        renderTopics();
    });

    search.disabled = false;
}

// Load and validate the XSLT analysis results.
async function loadData() {
    const status = byId("status");

    function requireValid(condition, name) {
        if (!condition) {
            throw new Error(
                `Missing or invalid ${name}. Regenerate analyses.json.`
            );
        }
    }

    try {
        const data = await window.lectureData.loadAnalyses();

        // Validate annual statistics.
        requireValid(
            Array.isArray(data.lecturesPerYear) &&
            Array.isArray(data.audiencePerYear),
            "annual analysis results"
        );

        // Validate lecture series structure.
        requireValid(
            Array.isArray(data.seriesStructure?.termsPerSeriesDistribution) &&
            Array.isArray(data.seriesStructure?.lecturesPerTermDistribution),
            "series structure results"
        );

        // Validate corpus overview.
        requireValid(
            Object.values(overviewValues(data)).every(validCount),
            "corpus overview"
        );

        // Validate speaker analysis.
        const speaker = data.speakerAnalysis;

        requireValid(
            Array.isArray(speaker?.lecturesPerSpeakerDistribution) &&
            [
                speaker.speakerLectureAssignments,
                speaker.unresolvedSpeakerIds,
                speaker.lecturesWithoutSpeakerId
            ].every(validCount) &&
            speaker.lecturesPerSpeakerDistribution.every(entry =>
                entry &&
                Number.isInteger(entry.lectures) &&
                entry.lectures > 0 &&
                validCount(entry.speakers)
            ),
            "speaker analysis"
        );

        // Validate gender analysis.
        const gender = data.genderPerYear;

        requireValid(
            Array.isArray(gender) &&
            gender.every(entry =>
                entry &&
                Number.isInteger(entry.year) &&
                [...genderFields, ...genderQualityFields].every(field =>
                    validCount(entry[field]) &&
                    entry[field] <= entry.total
                )
            ),
            "gender analysis"
        );

        // Validate institutional affiliations.
        const institution = data.institutionTypeAnalysis;

        requireValid(
            validSeriesAnalysis(institution, validInstitutionSummary),
            "institution analysis"
        );

        // Validate disciplinary distribution.
        const discipline = data.disciplineAnalysis;

        requireValid(
            validDisciplineAnalysis(discipline),
            "discipline analysis"
        );

        // Validate geographical connections.
        const geography = data.geographicalAnalysis;

        requireValid(
            validSeriesAnalysis(geography, validGeographySummary),
            "geographical analysis"
        );

        // Validate LLM-generated topics.
        const topic = data.topicAnalysis;

        requireValid(
            validSeriesAnalysis(topic, validTopicSummary),
            "topic analysis"
        );

        // Corpus overview.
        renderOverview(data);

        // Lecture delivery.
        renderTable(
            "lectures-per-year",
            data.lecturesPerYear,
            "year",
            [
                "inPerson",
                "online",
                "canceled",
                "otherOrUnknown",
                "multipleFormats",
                "total"
            ]
        );

        // Audience participation.
        renderTable(
            "audience-per-year",
            data.audiencePerYear,
            "year",
            [
                "inPerson",
                "online",
                "hybrid",
                "canceledWithoutAudience",
                "otherOrUnknown",
                "multipleFormats",
                "total"
            ]
        );

        // Common scale for annual charts.
        const maximum = Math.max(
            0,
            ...data.lecturesPerYear.map(entry => entry.total),
            ...data.audiencePerYear.map(entry => entry.total)
        );

        setupAnnualChart("delivery", data.lecturesPerYear, maximum);
        setupAnnualChart("audience", data.audiencePerYear, maximum);

        byId("undated-lectures").textContent =
            `Undated lectures: ${format.format(data.undatedLectures)}`;

        renderSeriesStructure(data.seriesStructure);
        renderSpeakerAnalysis(speaker);
        renderGenderAnalysis(gender);
        setupInstitutionAnalysis(institution);
        setupDisciplineAnalysis(discipline);
        setupGeographyAnalysis(geography);
        setupTopicAnalysis(topic);

        status.textContent = "Data loaded successfully.";

    } catch (error) {
        status.textContent =
            "Unable to load the analysis results.";

        console.error(error);
    }
}

// Initialize application.
loadData();
