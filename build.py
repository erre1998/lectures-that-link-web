#!/usr/bin/env python3
"""Produce static-site JSON from the Lectures that Link TEI-XML source (Python stdlib only)."""
from __future__ import annotations

import argparse
import json
import re
import xml.etree.ElementTree as ET
from collections import Counter
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parent
SOURCE_URL = 'https://raw.githubusercontent.com/erre1998/lectures-that-link/v0.8/dh-lecture-series.xml'
OUTPUT = ROOT / 'data' / 'lectures.json'
XML_OUTPUT = ROOT / 'data' / 'dh-lecture-series.xml'
T = '{http://www.tei-c.org/ns/1.0}'
XML_ID = '{http://www.w3.org/XML/1998/namespace}id'


def clean(value: str | None) -> str:
    return re.sub(r'\s+', ' ', value or '').strip()


def content(element: ET.Element | None) -> str:
    return clean(' '.join(element.itertext())) if element is not None else ''


def refs(value: str | None) -> list[str]:
    return [value.lstrip('#') for value in (value or '').split()]


def name_of(person: ET.Element) -> str:
    """Build a name from registered forenames and surnames (never from speaker placeholders)."""
    given = [content(x) for x in person.findall(f'.//{T}forename')]
    family = [content(x) for x in person.findall(f'.//{T}surname')]
    name = clean(' '.join(given + family))
    return name or content(person.find(f'{T}name'))


def main() -> None:
    parser = argparse.ArgumentParser(description="Export TEI data from release v0.8 to JSON.")
    parser.add_argument("--source", type=Path, help="Optional local copy of the v0.8 XML file")
    args = parser.parse_args()
    if args.source:
        xml_data = args.source.read_bytes()
    else:
        with urlopen(SOURCE_URL, timeout=60) as response:
            xml_data = response.read()

    # Parse and save the same XML bytes for the subsequent XSLT transformation.
    root = ET.fromstring(xml_data)
    XML_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    XML_OUTPUT.write_bytes(xml_data)
    print(f'XML source: {XML_OUTPUT}')
    version = content(root.find(f'./{T}teiHeader/{T}fileDesc/{T}editionStmt/{T}edition'))
    persons = {
        p.get(XML_ID): name_of(p)
        for p in root.findall(f'./{T}teiHeader/{T}profileDesc/{T}particDesc//{T}person')
        if p.get(XML_ID)
    }
    institutions = {
        org.get(XML_ID): content(org.find(f'{T}name'))
        for org in root.findall(f'./{T}teiHeader/{T}profileDesc/{T}particDesc//{T}org')
        if org.get(XML_ID)
    }
    disciplines = {
        cat.get(XML_ID): content(cat.find(f'{T}catDesc/{T}name'))
        for cat in root.findall(f'./{T}teiHeader/{T}encodingDesc/{T}classDecl//{T}category')
        if cat.get(XML_ID)
    }
    lecture_series = root.findall(f'.//{T}event[@type="lecture-series"]')
    series = []
    lectures = []
    unresolved_people = Counter()
    for s in lecture_series:
        series_id = s.get(XML_ID, '')
        series_name = content(s.find(f'{T}eventName')) or series_id
        terms = s.findall(f'{T}event[@type="lecture-series-term"]')
        series_count = 0
        for term in terms:
            term_id = term.get(XML_ID, '')
            term_label = content(term.find(f'{T}eventName')) or term_id
            for lecture in term.findall(f'{T}event[@type="lecture"]'):
                series_count += 1
                speaker_entries = []
                for p in lecture.findall(f'{T}listPerson/{T}person[@role="speaker"]'):
                    affiliations = []
                    for a in p.findall(f'{T}affiliation'):
                        for ident in refs(a.get('corresp')):
                            label = institutions.get(ident, ident)
                            if label not in affiliations:
                                affiliations.append(label)
                    for person_id in refs(p.get('corresp')):
                        if person_id not in persons:
                            unresolved_people[person_id] += 1
                        speaker_entries.append({
                            'id': person_id,
                            'name': persons.get(person_id, person_id),
                            'institutions': affiliations,
                        })
                lecture_disciplines = []
                for term_elem in lecture.findall(f'{T}note[@type="keywords"]/{T}term[@type="discipline"]'):
                    for ident in refs(term_elem.get('corresp')):
                        dname = disciplines.get(ident, ident)
                        if dname not in lecture_disciplines:
                            lecture_disciplines.append(dname)
                mode_el = lecture.find(f'{T}note[@type="realization"]/{T}term[@type="speech"]')
                program = lecture.find(f'{T}ptr[@type="programme"]')
                program_link = program.get('target', '') if program is not None else ''
                if not program_link.startswith(('https://', 'http://')):
                    program_link = ''
                when = lecture.get('when', '')
                lectures.append({
                    'id': lecture.get(XML_ID, ''),
                    'date': when,
                    'year': when[:4],
                    'title': content(lecture.find(f'{T}eventName')),
                    'seriesId': series_id,
                    'seriesName': series_name,
                    'termId': term_id,
                    'termName': term_label,
                    'speakers': speaker_entries,
                    'disciplines': lecture_disciplines,
                    'mode': content(mode_el),
                    'abstract': content(lecture.find(f'{T}note[@type="abstract"]')),
                    'programme': program_link,
                })
        series.append({'id': series_id, 'name': series_name, 'terms': len(terms), 'lectures': series_count})

    lectures.sort(key=lambda x: (x['date'], x['id']), reverse=True)
    series.sort(key=lambda x: x['name'].casefold())
    payload = {
        'dataset': 'Lectures that Link',
        'version': version,
        'source': SOURCE_URL,
        'counts': {'series': len(series), 'terms': sum(s['terms'] for s in series), 'lectures': len(lectures)},
        'series': series,
        'lectures': lectures,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f'Export: {len(lectures)} lectures, {len(series)} series, version: {version}')
    print(f'File: {OUTPUT} ({OUTPUT.stat().st_size // 1024} KB)')
    if unresolved_people:
        print(f'Note: {len(unresolved_people)} person IDs without registry entries: {dict(unresolved_people.most_common(5))}')


if __name__ == '__main__':
    main()