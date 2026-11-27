// Load the single shared footer on each page. No analysis code is changed.
async function loadSiteFooter() {
    const footer = document.getElementById("site-footer");
    if (!footer) return;

    try {
        const response = await fetch("./footer.html");
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const template = document.createElement("template");
        template.innerHTML = await response.text();
        footer.replaceChildren(template.content);
    } catch (error) {
        // Keep the static fallback links if the footer cannot be loaded.
        console.error("Unable to load shared footer.", error);
        return;
    }

    try {
        const response = await fetch("./last-updated.txt", { cache: "no-cache" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const date = (await response.text()).trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Invalid date");
        const parsed = new Date(`${date}T00:00:00Z`);
        if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
            throw new Error("Invalid date");
        }
        const time = document.createElement("time");
        time.dateTime = date;
        time.textContent = new Intl.DateTimeFormat("en", {
            dateStyle: "medium", timeZone: "UTC"
        }).format(parsed);
        document.getElementById("site-update").replaceChildren("Last website update: ", time);
    } catch (error) {
        // Do not substitute the browser's current date for the source commit date.
        console.info("Website update date unavailable.", error);
    }
}

loadSiteFooter();

// Switch views without rebuilding tables or resetting their controls.
// If JavaScript is unavailable, the original sections remain visible.
function setupAnalysisViews() {
    const navigation = document.getElementById("analysis-views");
    if (!navigation) return;

    const buttons = Array.from(navigation.querySelectorAll("button[data-analysis-target]"));
    const sections = Array.from(document.querySelectorAll("main > section[data-analysis-view]"));

    function showView(view) {
        if (!sections.some(section => section.dataset.analysisView === view)) return;

        for (const section of sections) {
            section.hidden = section.dataset.analysisView !== view;
        }

        for (const button of buttons) {
            button.setAttribute("aria-pressed", String(button.dataset.analysisTarget === view));
        }
    }

    for (const button of buttons) {
        button.addEventListener("click", () => showView(button.dataset.analysisTarget));
    }

    showView("overview");
    navigation.hidden = false;
}

setupAnalysisViews();

// Keep keyboard focus in the topic explorer when pagination reaches an edge.
document.addEventListener("click", event => {
    const button = event.target.closest("#topic-prev, #topic-next");
    if (button?.disabled) document.getElementById("topic-results")?.focus();
});
