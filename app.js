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

function renderLecturesPerYear(data) {
    const tbody = document.getElementById("lectures-per-year");

    tbody.replaceChildren();

    for (const entry of data.lecturesPerYear) {
        const row = document.createElement("tr");

        const heading = document.createElement("th");
        heading.scope = "row";
        heading.textContent = entry.year;
        row.appendChild(heading);

        const values = [
            entry.inPerson,
            entry.online,
            entry.canceled,
            entry.otherOrUnknown,
            entry.multipleFormats,
            entry.total
        ];

        for (const value of values) {
            const cell = document.createElement("td");
            cell.textContent = format.format(value);
            row.appendChild(cell);
        }

        tbody.appendChild(row);
    }

    document.getElementById("undated-lectures").textContent =
        `Undated lectures: ${format.format(data.undatedLectures)}`;
}

async function loadData() {
    const status = document.getElementById("status");

    try {
        const response = await fetch("./data/analyses.json");

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        renderOverview(data);
        renderLecturesPerYear(data);

        status.textContent = "Data loaded successfully.";

    } catch (error) {
        status.textContent = "Unable to load the analysis results.";
        console.error(error);
    }
}

loadData();