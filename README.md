# Lectures that Link – Web Application

**Version 0.5** · Developed and published by Erik Renz

This repository contains the web application for the research project **“Lectures that Link”**, which analyzes European lecture series as nodes of interaction within the Digital Humanities (DH) community.

Over the past decade, numerous DH lecture series have been organized by institutions across Europe. The underlying research project systematically analyzes the structure and content of these series to investigate the development of DH as a field of research, including its key topics, institutional and personal networks, and broader thematic trends.

The web application complements the original research repository by making its data and quantitative analyses accessible through a browser-based interface. It is developed and published independently by Erik Renz. The underlying research data and scripts remain the work of the Lectures that Link project and its contributors.

- [Web application (GitHub Pages)](https://erre1998.github.io/lectures-that-link-web/)
- [Research data and scripts](https://github.com/erre1998/lectures-that-link)
- [Institutional project website](https://www.germanistik.uni-rostock.de/en/forschung/digital-humanities/rosdh/research/lectures-that-link/)

## Data and analyses

The application currently uses version 0.8 of the research dataset. The TEI-XML source is processed into JSON using Python and XSLT 3.0. The XSLT analysis script is adapted from the original research software by Ulrike Henny-Krahmer. The application presents the resulting statistics using HTML, CSS, and JavaScript.

The quantitative analyses cover the corpus overview, lecture delivery, audience participation, lecture series structure, speaker frequency, recorded gender categories, institutional affiliations, disciplinary distribution, geographical connections, and LLM-generated topics. Selected analyses can be viewed for individual lecture series.

Known metadata inconsistencies and unresolved references are documented in [DATA_QUALITY.md](DATA_QUALITY.md). The web application does not modify the underlying research dataset.

## License

This repository distinguishes between software and research data:

- **Software**: [GNU General Public License Version 3 (GPL-3.0)](https://www.gnu.org/licenses/gpl-3.0.html). This includes the adapted XSLT analysis code; its original authorship and provenance are retained in the source file. See [LICENSE](LICENSE).
- **Data**: [Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)](https://creativecommons.org/licenses/by-sa/4.0/), as specified by the original research repository.

Institutional logos and third-party marks are subject to their respective rights and are not covered by these license declarations.

## Citation

If you use the web application, please cite it as follows:

> Renz, Erik. *Lectures that Link – Web Application*. Version 0.5. https://github.com/erre1998/lectures-that-link-web.

If you use the underlying research data or analytical results, please also cite the corresponding version of the original research repository:

> Henny-Krahmer, Ulrike, Fernanda Alvares Freire, and Erik Renz. 2025–. *Lectures that Link*. Version 0.8. https://github.com/erre1998/lectures-that-link.

For reproducibility, record the dataset version, the web application version or commit, and the date of access.

## Project Status

This repository is currently under active development. Full-text search, combined filters, linked macro- and micro-level exploration, and detailed views of individual lectures and available abstracts are planned extensions. Expect updates and improvements as development progresses.
