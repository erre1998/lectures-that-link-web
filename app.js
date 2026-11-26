const format = new Intl.NumberFormat("en");

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

// Display precomputed XSLT results without recalculating the statistics.
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

async function loadData() {
    const status = document.getElementById("status");

    try {
        const response = await fetch("./data/analyses.json");

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (!Array.isArray(data.lecturesPerYear) ||
            !Array.isArray(data.audiencePerYear)) {
            throw new Error(
                "Missing annual analysis results. Regenerate analyses.json."
            );
        }

        renderOverview(data);

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

        document.getElementById("undated-lectures").textContent =
            `Undated lectures: ${format.format(data.undatedLectures)}`;

        status.textContent = "Data loaded successfully.";

    } catch (error) {
        status.textContent = "Unable to load the analysis results.";
        console.error(error);
    }
}

loadData();