// Share the analysis export across the application for this page lifetime.
// A failed request is not cached, so a later caller can retry.
(() => {
    "use strict";
    let analysisPromise;

    function loadAnalyses() {
        if (!analysisPromise) {
            analysisPromise = fetch("./data/analyses.json")
                .then(response => {
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    return response.json();
                })
                .catch(error => {
                    analysisPromise = undefined;
                    throw error;
                });
        }
        return analysisPromise;
    }

    // Consumers treat the shared result as read-only; validation remains local.
    window.lectureData = Object.freeze({ loadAnalyses });
})();
