
const format = new Intl.NumberFormat("en");
const percent = new Intl.NumberFormat("en", {
    style: "percent", maximumFractionDigits: 1
});

function renderOverview(data) {
    document.getElementById("dataset-version").textContent =
        `Dataset: ${data.datasetVersion}`;
    document.getElementById("count-series").textContent =
        format.format(data.counts.series);
    document.getElementById("count-terms").textContent =
        format.format(data.counts.terms);
    document.getElementById("count-lectures").textContent =
        format.format(data.counts.lectures);

    document.getElementById("count-speakers").textContent =
        format.format(data.speakerAnalysis.uniqueSpeakers);
    document.getElementById("count-organizers").textContent =
        format.format(data.corpusOverview.organizers.registeredPersons);
    document.getElementById("count-host-institutions").textContent =
        format.format(data.corpusOverview.hostInstitutions.registeredInstitutions);
    document.getElementById("count-affiliation-institutions").textContent =
        format.format(data.corpusOverview.affiliationInstitutions.registeredInstitutions);
    document.getElementById("count-host-cities").textContent =
        format.format(data.corpusOverview.hostGeography.cities);
    document.getElementById("count-host-countries").textContent =
        format.format(data.corpusOverview.hostGeography.countries);
    document.getElementById("count-affiliation-cities").textContent =
        format.format(data.corpusOverview.affiliationGeography.cities);
    document.getElementById("count-affiliation-countries").textContent =
        format.format(data.corpusOverview.affiliationGeography.countries);
}

// Display precomputed XSLT results without recalculating the statistics.
function renderTable(id, entries, headingField, fields) {
    const tbody = document.getElementById(id);
    const rows = document.createDocumentFragment();

    for (const entry of entries) {
        const row = document.createElement("tr");
        const heading = document.createElement("th");
        heading.scope = "row";
        heading.textContent = entry[headingField];
        row.appendChild(heading);

        for (const field of fields) {
            const cell = document.createElement("td");
            cell.textContent = format.format(entry[field]);
            row.appendChild(cell);
        }
        rows.appendChild(row);
    }

    tbody.replaceChildren(rows);
}

// Visualize precomputed counts using a common scale for both charts.
function setupAnnualChart(prefix, entries, maximum) {
    const select = document.getElementById(`${prefix}-category`);
    const list = document.getElementById(`${prefix}-chart`);
    const scale = document.getElementById(`${prefix}-scale`);

    scale.textContent = `Scale: 0–${format.format(maximum)} lecture records`;

    function render() {
        const field = select.value;
        const category = select.options[select.selectedIndex].text;
        const rows = document.createDocumentFragment();

        for (const entry of entries) {
            const value = entry[field];
            const item = document.createElement("li");

            const year = document.createElement("span");
            year.className = "chart-year";
            year.textContent = entry.year;

            const track = document.createElement("span");
            track.className = "chart-track";
            track.setAttribute("aria-hidden", "true");

            const bar = document.createElement("span");
            bar.className = "chart-bar";
            bar.style.width = `${maximum > 0 ? value / maximum * 100 : 0}%`;
            track.appendChild(bar);

            const count = document.createElement("span");
            count.className = "chart-value";
            count.textContent = format.format(value);

            item.append(year, track, count);
            rows.appendChild(item);
        }

        list.setAttribute(
            "aria-label",
            `${prefix === "delivery" ? "Lecture delivery" : "Audience participation"}: ${category} by year`
        );

        list.replaceChildren(rows);
    }

    select.addEventListener("change", render);
    render();
    select.disabled = false;
}

// Display frequency distributions calculated by XSLT.
function renderDistribution(prefix, entries, categoryField, frequencyField, unit) {
    const tbody = document.getElementById(`${prefix}-table`);
    const chart = document.getElementById(`${prefix}-chart`);
    const scale = document.getElementById(`${prefix}-scale`);
    const tableRows = document.createDocumentFragment();
    const chartRows = document.createDocumentFragment();

    // The maximum controls only the visual scale, not the analysis.
    const maximum = Math.max(0, ...entries.map(entry => entry[frequencyField]));
    scale.textContent = `Scale: 0–${format.format(maximum)} ${unit}`;

    for (const entry of entries) {
        const category = entry[categoryField];
        const frequency = entry[frequencyField];

        const row = document.createElement("tr");
        const heading = document.createElement("th");
        heading.scope = "row";
        heading.textContent = format.format(category);

        const cell = document.createElement("td");
        cell.textContent = format.format(frequency);
        row.append(heading, cell);
        tableRows.appendChild(row);

        const item = document.createElement("li");
        const label = document.createElement("span");
        label.className = "chart-year";
        label.textContent = format.format(category);

        const track = document.createElement("span");
        track.className = "chart-track";
        track.setAttribute("aria-hidden", "true");

        const bar = document.createElement("span");
        bar.className = "chart-bar";
        bar.style.width = `${maximum > 0 ? frequency / maximum * 100 : 0}%`;
        track.appendChild(bar);

        const count = document.createElement("span");
        count.className = "chart-value";
        count.textContent = format.format(frequency);

        item.append(label, track, count);
        chartRows.appendChild(item);
    }

    tbody.replaceChildren(tableRows);
    chart.replaceChildren(chartRows);
}

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

// Speaker frequency and data quality, precomputed in XSLT.
function renderSpeakerAnalysis(analysis) {
    document.getElementById("speaker-assignments").textContent =
        format.format(analysis.speakerLectureAssignments);
    document.getElementById("speaker-unresolved").textContent =
        format.format(analysis.unresolvedSpeakerIds);
    document.getElementById("speaker-missing").textContent =
        format.format(analysis.lecturesWithoutSpeakerId);

    renderTable(
        "speaker-distribution-table",
        analysis.lecturesPerSpeakerDistribution,
        "lectures", ["speakers"]
    );
}

// Annual gender counts and metadata quality, precomputed in XSLT.
const genderFields = [
    "female",
    "male",
    "nonBinary",
    "multipleGenderCategories",
    "withoutKnownGender",
    "total"
];

const genderQualityFields = [
    "withoutSpeakerId",
    "unresolvedSpeaker",
    "unknownGender"
];

function renderGenderAnalysis(entries) {
    renderTable("gender-per-year", entries, "year", genderFields);
    renderTable("gender-quality-per-year", entries, "year", genderQualityFields);
}

// Institutional affiliations: use the XSLT summaries without recalculation.
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
    if (!summary || !Number.isInteger(summary.total) || summary.total < 0) {
        return false;
    }

    const validCount = value =>
        Number.isInteger(value) &&
        value >= 0 &&
        value <= summary.total;

    return Object.values(institutionQuality).every(field =>
        validCount(summary[field])) &&
        Array.isArray(summary.types) &&
        summary.types.length === institutionLabels.size &&
        new Set(summary.types.map(entry => entry?.type)).size === institutionLabels.size &&
        summary.types.every(entry =>
            entry &&
            institutionLabels.has(entry.type) &&
            validCount(entry.lectures) &&
            (summary.total === 0
                ? entry.share === null
                : Number.isFinite(entry.share) &&
                  entry.share >= 0 &&
                  entry.share <= 1)
        );
}

function setupInstitutionAnalysis(analysis) {
    const select = document.getElementById("institution-series");
    const table = document.getElementById("institution-type-table");
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

        document.getElementById("institution-total").textContent =
            `Lecture records: ${format.format(summary.total)}`;

        const rows = document.createDocumentFragment();

        for (const entry of summary.types) {
            const row = document.createElement("tr");

            const heading = document.createElement("th");
            heading.scope = "row";
            heading.textContent = institutionLabels.get(entry.type);

            const count = document.createElement("td");
            count.textContent = format.format(entry.lectures);

            const share = document.createElement("td");
            share.textContent =
                entry.share === null
                    ? "–"
                    : percent.format(entry.share);

            row.append(heading, count, share);
            rows.appendChild(row);
        }

        table.replaceChildren(rows);

        for (const [id, field] of Object.entries(institutionQuality)) {
            document.getElementById(id).textContent =
                format.format(summary[field]);
        }
    }

    select.value = "all";
    select.addEventListener("change", render);
    render();
    select.disabled = false;
}

// Load and validate XSLT analysis results.
async function loadData() {
    const status = document.getElementById("status");

    try {
        const response = await fetch("./data/analyses.json");

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        // Validate annual analysis results.
        if (!Array.isArray(data.lecturesPerYear) ||
            !Array.isArray(data.audiencePerYear)) {

            throw new Error(
                "Missing annual analysis results. Regenerate analyses.json."
            );
        }

        // Validate lecture series structure.
        if (!Array.isArray(data.seriesStructure?.termsPerSeriesDistribution) ||
            !Array.isArray(data.seriesStructure?.lecturesPerTermDistribution)) {

            throw new Error(
                "Missing series structure results. Regenerate analyses.json."
            );
        }

        // Validate corpus overview.
        const overview = data.corpusOverview;

        const overviewCounts = [
            data.speakerAnalysis?.uniqueSpeakers,
            overview?.organizers?.registeredPersons,
            overview?.hostInstitutions?.registeredInstitutions,
            overview?.affiliationInstitutions?.registeredInstitutions,
            overview?.hostGeography?.cities,
            overview?.hostGeography?.countries,
            overview?.affiliationGeography?.cities,
            overview?.affiliationGeography?.countries
        ];

        if (!overviewCounts.every(
            value => Number.isInteger(value) && value >= 0
        )) {
            throw new Error(
                "Missing or invalid corpus overview. Regenerate analyses.json."
            );
        }

        // Validate speaker analysis.
        const speaker = data.speakerAnalysis;

        if (!Array.isArray(speaker?.lecturesPerSpeakerDistribution) ||
            ![
                speaker.speakerLectureAssignments,
                speaker.unresolvedSpeakerIds,
                speaker.lecturesWithoutSpeakerId
            ].every(value =>
                Number.isInteger(value) && value >= 0
            ) ||
            !speaker.lecturesPerSpeakerDistribution.every(entry =>
                Number.isInteger(entry.lectures) &&
                entry.lectures > 0 &&
                Number.isInteger(entry.speakers) &&
                entry.speakers >= 0
            )) {
            throw new Error(
                "Missing or invalid speaker analysis. Regenerate analyses.json."
            );
        }

        // Validate annual gender analysis.
        const gender = data.genderPerYear;

        if (!Array.isArray(gender) ||
            !gender.every(entry =>
                entry &&
                Number.isInteger(entry.year) &&
                [...genderFields, ...genderQualityFields].every(field =>
                    Number.isInteger(entry[field]) &&
                    entry[field] >= 0 &&
                    entry[field] <= entry.total
                )
            )) {
            throw new Error(
                "Missing or invalid gender analysis. Regenerate analyses.json."
            );
        }

        // Validate institution analysis.
        const institution = data.institutionTypeAnalysis;

        if (!validInstitutionSummary(institution?.overall) ||
            !Array.isArray(institution.perSeries) ||
            !institution.perSeries.every(entry =>
                validInstitutionSummary(entry) &&
                typeof entry.seriesId === "string" &&
                entry.seriesId.length > 0 &&
                typeof entry.seriesName === "string"
            ) ||
            new Set(institution.perSeries.map(entry => entry.seriesId)).size !==
                institution.perSeries.length) {

            throw new Error(
                "Missing or invalid institution analysis. Regenerate analyses.json."
            );
        }

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

        document.getElementById("undated-lectures").textContent =
            `Undated lectures: ${format.format(data.undatedLectures)}`;

        // Lecture series structure.
        renderSeriesStructure(data.seriesStructure);

        // Speaker analysis.
        renderSpeakerAnalysis(speaker);

        // Annual gender analysis.
        renderGenderAnalysis(gender);

        // Institutional affiliations.
        setupInstitutionAnalysis(institution);

        status.textContent = "Data loaded successfully.";

    } catch (error) {
        status.textContent =
            "Unable to load the analysis results.";

        console.error(error);
    }
}

// Initialize application.
loadData();
