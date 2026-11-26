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
XML_LANG = '{http://www.w3.org/XML/1998/namespace}lang'
XML_ID = '{http://www.w3.org/XML/1998/namespace}id'


def clean(value: str | None) -> str:
    return re.sub(r'\s+', ' ', value or '').strip()


def content(element: ET.Element | None) -> str:
    return clean(' '.join(element.itertext())) if element is not None else ''


def refs(value: str | None) -> list[str]:
    return [value.lstrip('#') for value in (value or '').split()]


def unique(values):
    """Preserve source order while removing duplicate scalar values."""
    return list(dict.fromkeys(values))


def tokens(values):
    return unique(token for value in values for token in (value or '').split())


def local_ids(values):
    """Match XSLT: only nonempty local fragment references are IDs."""
    return unique(token[1:] for token in tokens(values)
                  if token.startswith('#') and len(token) > 1)


def source_text(element):
    """XPath string-value with XML whitespace normalization."""
    return re.sub(r'[ \t\r\n]+', ' ', ''.join(element.itertext())).strip(' \t\r\n')


def register(elements):
    return {e.get(XML_ID): e for e in elements if e.get(XML_ID)}


def entity(ident, registry, name):
    node = registry.get(ident)
    return {'id': ident, 'label': name(node) or ident if node is not None else ident,
            'resolved': node is not None}


def node_name(node):
    return content(node.find(f'{T}name'))


def references(elements):
    return tokens(e.get('corresp') for e in elements)


def format_values(lecture, kind):
    # Preserve the recorded values; no inferred delivery/audience format.
    return unique(''.join(e.itertext()) for e in lecture.iter(f'{T}term')
                  if e.get('type') == kind)


def abstract_entries(lecture):
    entries = []
    for note in lecture.findall(f'{T}note[@type="abstract"]'):
        text = content(note)
        status = 'empty' if not text else 'not-found' if text.casefold() == 'not found' else 'available'
        entries.append({'language': note.get(XML_LANG), 'text': text if status == 'available' else '',
                        'status': status})
    return entries


def resource_entries(*scopes):
    """Keep resource provenance: lecture, term, or series."""
    entries = []
    seen = set()
    for scope, element in scopes:
        for ptr in element.findall(f'{T}ptr'):
            kind, url = ptr.get('type', ''), ptr.get('target', '')
            key = (scope, kind, url)
            if url.startswith(('https://', 'http://')) and key not in seen:
                seen.add(key)
                entries.append({'scope': scope, 'type': kind, 'url': url})
    return entries


def geography(place_ids, places):
    """Resolve recorded places and countries, without geocoding or inference."""
    cities = [i for i in place_ids if i in places and places[i].get('type') == 'city']
    country_refs = unique([i for i in place_ids if i in places and places[i].get('type') == 'country'] +
                          local_ids(c.get('corresp') for i in cities for c in places[i].findall(f'{T}country')))
    countries = [i for i in country_refs if i in places and places[i].get('type') == 'country']
    return {
        'places': [dict(entity(i, places, node_name),
                        type=places[i].get('type') if i in places else None) for i in place_ids],
        'cities': [entity(i, places, node_name) for i in cities],
        'countries': [entity(i, places, node_name) for i in countries],
        'unresolvedOrInvalidCountryIds': [i for i in country_refs if i not in countries],
    }


def institution_entry(ident, orgs, places):
    org = orgs.get(ident)
    place_refs = references(org.findall(f'{T}place')) if org is not None else []
    return dict(entity(ident, orgs, node_name),
                type=org.get('type') if org is not None else None,
                placeReferences=place_refs,
                geography=geography(local_ids(place_refs), places))


def lecture_metadata(lecture, term, series, persons, orgs, places, taxonomy):
    speaker_nodes = [p for p in lecture.iter(f'{T}person') if p.get('role') == 'speaker']
    speaker_refs = references(speaker_nodes)
    speaker_ids = local_ids(speaker_refs)
    affiliation_refs = references(list(lecture.iter(f'{T}affiliation')))
    affiliation_ids = local_ids(affiliation_refs)
    discipline_refs = references([n for n in lecture.iter(f'{T}term') if n.get('type') == 'discipline'])
    discipline_ids = local_ids(discipline_refs)
    host_refs = references(lecture.findall(f'{T}org[@role="host-institution"]'))
    host_place_refs = tokens([series.get('where')])
    affiliation_places = local_ids(
        p.get('corresp') for i in affiliation_ids if i in orgs for p in orgs[i].findall(f'{T}place'))
    title = lecture.find(f'{T}eventName')
    topics = unique(topic for n in lecture.iter(f'{T}term') if n.get('type') == 'topics-llm'
                    for part in source_text(n).split(',')
                    if (topic := re.sub(r'[ \t\r\n]+', ' ', part).strip(' \t\r\n').lower()))
    abstracts = abstract_entries(lecture)
    return {
        'titleLanguage': title.get(XML_LANG) if title is not None else None,
        'abstracts': abstracts,
        'hasAbstract': any(a['status'] == 'available' for a in abstracts),
        'speakerReferences': speaker_refs,
        'speakerDetails': [dict(entity(i, persons, name_of),
                                genders=unique(''.join(g.itertext()) for g in persons[i].findall(f'{T}gender')) if i in persons else [],
                                affiliationIds=local_ids(a.get('corresp') for p in speaker_nodes
                                    if i in local_ids([p.get('corresp')]) for a in p.iter(f'{T}affiliation')))
                           for i in speaker_ids],
        'affiliationReferences': affiliation_refs,
        'affiliations': [institution_entry(i, orgs, places) for i in affiliation_ids],
        'hostInstitutionReferences': host_refs,
        'hostInstitutions': [institution_entry(i, orgs, places) for i in local_ids(host_refs)],
        'hostPlaceReferences': host_place_refs,
        'hostGeography': geography(local_ids(host_place_refs), places),
        'affiliationGeography': geography(affiliation_places, places),
        'disciplineReferences': discipline_refs,
        'disciplineDetails': [entity(i, taxonomy, lambda n: content(n.find(f'{T}catDesc/{T}name'))) for i in discipline_ids],
        'topics': topics,
        'deliveryFormats': format_values(lecture, 'speech'),
        'audienceFormats': format_values(lecture, 'audience'),
        'resources': resource_entries(('lecture', lecture), ('term', term), ('series', series)),
    }


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
    # Registers for the detailed, ID-based export.
    person_nodes = register(root.findall(f'./{T}teiHeader/{T}profileDesc/{T}particDesc//{T}person'))
    org_nodes = register(root.findall(f'./{T}teiHeader/{T}profileDesc/{T}particDesc//{T}org'))
    place_nodes = register(root.findall(f'.//{T}settingDesc//{T}place'))
    taxonomy = register(root.findall(f'.//{T}taxonomy[@{XML_ID}="disciplines"]/{T}category'))
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
                    **lecture_metadata(lecture, term, s, person_nodes, org_nodes, place_nodes, taxonomy),
                })
        series.append({'id': series_id, 'name': series_name, 'terms': len(terms), 'lectures': series_count})

    lectures.sort(key=lambda x: (x['date'], x['id']), reverse=True)
    series.sort(key=lambda x: x['name'].casefold())
    payload = {
        'schemaVersion': 2,
        'dataset': 'Lectures that Link',
        'version': version,
        'source': SOURCE_URL,
        'counts': {'series': len(series), 'terms': sum(s['terms'] for s in series), 'lectures': len(lectures)},
        'series': series,
        'lectures': lectures,
    }
    # Unique record IDs are required for the future detail view.
    lecture_ids = [lecture['id'] for lecture in lectures]
    if not all(lecture_ids) or len(set(lecture_ids)) != len(lecture_ids):
        raise ValueError('Missing or duplicate lecture IDs.')
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f'Export: {len(lectures)} lectures, {len(series)} series, version: {version}')
    print(f'File: {OUTPUT} ({OUTPUT.stat().st_size // 1024} KB)')
    if unresolved_people:
        print(f'Note: {len(unresolved_people)} person IDs without registry entries: {dict(unresolved_people.most_common(5))}')


if __name__ == '__main__':
    main()