const format = new Intl.NumberFormat("en");


// Overview statistics

function renderOverview(data) {
    document.getElementById("dataset-version").textContent =
        `Dataset: ${data.datasetVersion}`;

    document.getElementById("count-series").textContent =
        format.format(data.counts.series);

    document.getElementById("count-terms").textContent =
        format.format(data.counts.terms);

    document.getElementById("count-lectures").textContent =
        format.format(data.counts.lectures);
}


// Annual statistics tables

function renderAnnualTable(id, entries, fields) {
    const tbody = document.getElementById(id);
    const rows = document.createDocumentFragment();

    for (const entry of entries) {
        const row = document.createElement("tr");

        const heading = document.createElement("th");
        heading.scope = "row";
        heading.textContent = entry.year;
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


// Interactive annual charts

function setupAnnualChart(prefix, entries, maximum) {
    const select = document.getElementById(`${prefix}-category`);
    const list = document.getElementById(`${prefix}-chart`);
    const scale = document.getElementById(`${prefix}-scale`);

    scale.textContent =
        `Scale: 0–${format.format(maximum)} lecture records`;

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
            bar.style.width =
                `${maximum > 0 ? value / maximum * 100 : 0}%`;

            track.appendChild(bar);

            const count = document.createElement("span");
            count.className = "chart-value";
            count.textContent = format.format(value);

            item.append(year, track, count);
            rows.appendChild(item);
        }

        list.setAttribute(
            "aria-label",
            `${prefix === "delivery"
                ? "Lecture delivery"
                : "Audience participation"}: ${category} by year`
        );

        list.replaceChildren(rows);
    }

    select.addEventListener("change", render);

    render();

    select.disabled = false;
}


// Frequency distributions

function renderDistribution(
    prefix,
    entries,
    categoryField,
    frequencyField,
    unit
) {
    const tbody = document.getElementById(`${prefix}-table`);
    const chart = document.getElementById(`${prefix}-chart`);
    const scale = document.getElementById(`${prefix}-scale`);

    const tableRows = document.createDocumentFragment();
    const chartRows = document.createDocumentFragment();

    // The maximum controls only the visual scale,
    // not the scientific analysis.

    const maximum = Math.max(
        0,
        ...entries.map(entry => entry[frequencyField])
    );

    scale.textContent =
        `Scale: 0–${format.format(maximum)} ${unit}`;

    for (const entry of entries) {
        const category = entry[categoryField];
        const frequency = entry[frequencyField];


        // Table row

        const row = document.createElement("tr");

        const heading = document.createElement("th");
        heading.scope = "row";
        heading.textContent = format.format(category);

        const cell = document.createElement("td");
        cell.textContent = format.format(frequency);

        row.append(heading, cell);
        tableRows.appendChild(row);


        // Chart row

        const item = document.createElement("li");

        const label = document.createElement("span");
        label.className = "chart-year";
        label.textContent = format.format(category);

        const track = document.createElement("span");
        track.className = "chart-track";
        track.setAttribute("aria-hidden", "true");

        const bar = document.createElement("span");
        bar.className = "chart-bar";
        bar.style.width =
            `${maximum > 0 ? frequency / maximum * 100 : 0}%`;

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


// Lecture series structure

function renderSeriesStructure(structure) {

    // Terms per lecture series

    renderDistribution(
        "terms-distribution",
        structure.termsPerSeriesDistribution,
        "terms",
        "series",
        "lecture series"
    );


    // Lectures per term

    renderDistribution(
        "lectures-distribution",
        structure.lecturesPerTermDistribution,
        "lectures",
        "terms",
        "terms"
    );
}


// Load XSLT analysis results

async function loadData() {
    const status = document.getElementById("status");

    try {
        const response = await fetch("./data/analyses.json");

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();


        // Validate annual analysis results

        if (!Array.isArray(data.lecturesPerYear) ||
            !Array.isArray(data.audiencePerYear)) {

            throw new Error(
                "Missing annual analysis results. Regenerate analyses.json."
            );
        }


        // Validate lecture series structure results

        if (!Array.isArray(
                data.seriesStructure?.termsPerSeriesDistribution
            ) ||
            !Array.isArray(
                data.seriesStructure?.lecturesPerTermDistribution
            )) {

            throw new Error(
                "Missing series structure results. Regenerate analyses.json."
            );
        }


        // Overview

        renderOverview(data);


        // Lecture delivery table

        renderAnnualTable(
            "lectures-per-year",
            data.lecturesPerYear,
            [
                "inPerson",
                "online",
                "canceled",
                "otherOrUnknown",
                "multipleFormats",
                "total"
            ]
        );


        // Audience participation table

        renderAnnualTable(
            "audience-per-year",
            data.audiencePerYear,
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


        // Common scale for annual charts

        const maximum = Math.max(
            0,
            ...data.lecturesPerYear.map(entry => entry.total),
            ...data.audiencePerYear.map(entry => entry.total)
        );


        // Interactive annual charts

        setupAnnualChart(
            "delivery",
            data.lecturesPerYear,
            maximum
        );

        setupAnnualChart(
            "audience",
            data.audiencePerYear,
            maximum
        );


        // Undated lectures

        document.getElementById("undated-lectures").textContent =
            `Undated lectures: ${format.format(data.undatedLectures)}`;


        // Lecture series structure

        renderSeriesStructure(data.seriesStructure);


        // Success message

        status.textContent = "Data loaded successfully.";

    } catch (error) {
        status.textContent = "Unable to load the analysis results.";
        console.error(error);
    }
}


// Initialize application

loadData();