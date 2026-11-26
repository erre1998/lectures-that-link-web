async function loadData() {
    const status = document.getElementById("status");
    const format = new Intl.NumberFormat("en");

    try {
        const response = await fetch("./data/lectures.json");

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        document.getElementById("dataset-version").textContent =
            `Dataset: ${data.version}`;

        document.getElementById("count-series").textContent =
            format.format(data.counts.series);

        document.getElementById("count-terms").textContent =
            format.format(data.counts.terms);

        document.getElementById("count-lectures").textContent =
            format.format(data.counts.lectures);

        status.textContent = "Data loaded successfully.";

    } catch (error) {
        status.textContent = "Unable to load the dataset.";
        console.error(error);
    }
}

loadData();