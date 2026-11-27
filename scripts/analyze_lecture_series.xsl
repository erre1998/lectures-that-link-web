<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:xs="http://www.w3.org/2001/XMLSchema"
  xmlns:math="http://www.w3.org/2005/xpath-functions/math"
  xmlns:map="http://www.w3.org/2005/xpath-functions/map"
  exclude-result-prefixes="xs math map" xmlns:local="local"
  xpath-default-namespace="http://www.tei-c.org/ns/1.0"
  version="3.0">
  
  <!--
    Original author: Ulrike Henny-Krahmer

    Source: Lectures that Link, release v0.8
    https://github.com/erre1998/lectures-that-link/blob/v0.8/scripts/analyze_lecture_series.xsl
    Original Git blob: 592a6eb163bb6ff9ff20a74b39ddf226f740fa05
    License: GPL-3.0

    Adapted for Lectures that Link Web (2026-11-26).

    Methodological changes:
    - Inclusion of all recorded lecture series.
    - Removal of fixed temporal restrictions.
    - Dynamic determination of the annual analysis range.
    - Retention of undated lectures in the general corpus.
      Annual analyses exclude lectures without an evaluable year.
    - Annual lecture counts exported as JSON; the original format
      predicates are retained. Counts include canceled records.
    - Unclassified and overlapping format assignments are reported.
    - Annual audience participation is analyzed separately from speech.
      Canceled records without an audience term are reported separately;
      other unclassified records and multiple recognized categories are counted.
    - Series structure exported as per-series and per-term counts and
      frequency distributions. All recorded terms and lectures are included,
      including canceled records; counts of zero are retained if present.
    - Speaker frequency exported by local TEI person ID. Each speaker is
      counted once per lecture record, including canceled records. Multiple
      references are tokenized; unresolved local IDs are retained and flagged.
      Records without a usable local speaker ID are counted separately.
    - Annual gender analysis counts lecture records with at least one
      referenced speaker in each recorded gender category (female, male,
      non-binary). Categories may overlap, including when a person has
      multiple recorded categories. No gender is inferred from names.
      Missing, unclassified and unresolved speaker metadata are reported
      separately. Canceled records are included; undated records are
      excluded from annual counts, as in the other annual analyses.
    - Institutional affiliations: lecture-level counts and shares per series
      and for the entire corpus, using the six original institution types.
      Each type is counted at most once per lecture; categories can overlap.
      Denominator: all recorded lectures, including canceled records.
      Empty series have null shares; missing, unresolved and unclassified
      affiliations are reported separately. No affiliation is inferred.
    - Disciplinary analysis: lecture-level counts and shares for the
      entire corpus and each series, using the disciplines taxonomy.
      Local references are tokenized and deduplicated per lecture.
      Missing and unresolved references are reported without guessing
      corrections. Categories may overlap; denominator is all lecture
      records, including canceled records. Empty series have null shares.
    - Geographical connections: compare each affiliated institution's city
      to the series host cities (@where). Local takes precedence over
      national; national takes precedence over international. International
      links are classified by the affiliation country's continent (Europe
      or elsewhere). Multiple affiliation cities may yield different types;
      each type counts at most once per lecture. Only local TEI references
      are resolved; virtual hosts and missing geography remain unclassified.
      Shares use all recorded lectures, including canceled records; empty
      series have null shares. Data quality indicators are not exclusive.
    - LLM-generated topics: split comma-separated terms, normalize whitespace
      and case, count each topic once per lecture. Export observed keywords
      and the four original thematic areas for the corpus and each series.
      Area matching uses word boundaries instead of substring matching to
      avoid false positives (e.g. ai in training). Areas may overlap and
      are heuristic, not a controlled taxonomy. Shares use all lectures,
      including canceled records; empty series have null shares. Missing
      topics are reported separately. No new LLM annotations are generated.
    - Corpus overview: count distinct local references for organizers,
      host institutions and affiliations. Organizers are identified by the
      original org[@role='organizer'] encoding on terms; person and institution
      register matches are distinguished. Institution and city counts refer
      to resolved register IDs, not inferred identities. Countries are taken
      from resolved cities' country references or directly referenced country
      entries. Virtual places are excluded from physical city counts. Missing,
      unresolved and wrong-type references remain explicit; no corrections
      are inferred. Canceled lecture records are included.
    - Other legacy analyses are retained but not executed by default.
  -->
  <xsl:output method="json" encoding="UTF-8" indent="yes"/>

  <xsl:variable name="lecture-series" select="//event[@type='lecture-series']"/>
  <xsl:variable name="lecture-terms" select="$lecture-series/event[@type='lecture-series-term']"/>
  <xsl:variable name="lectures" select="$lecture-terms/event[@type='lecture']"/>
  <xsl:variable name="places" select="//settingDesc//place"/>
  <xsl:variable name="institutions" select="//particDesc//org"/>
  <xsl:variable name="lecture-years" as="xs:integer*"
    select="for $lecture in $lectures[matches(@when, '^[0-9]{4}')]
            return xs:integer(substring($lecture/@when, 1, 4))"/>
  <xsl:variable name="years" as="xs:integer*"
    select="if (exists($lecture-years))
            then min($lecture-years) to max($lecture-years)
            else ()"/>
  <xsl:variable name="persons" select="//particDesc//person"/>
  <xsl:variable name="persons-female" select="$persons[gender='female']"/>
  <xsl:variable name="persons-male" select="$persons[gender='male']"/>
  <xsl:variable name="persons-non-binary" select="$persons[gender='non-binary']"/>
  
  <xsl:function name="local:get-continents-for-countries" as="xs:string+">
    <xsl:param name="countries"/>
    <xsl:for-each select="$countries">
      <xsl:value-of select="$places[@xml:id=current()]/bloc[@type='continent']/substring-after(@corresp,'#')"/>
    </xsl:for-each>
  </xsl:function>
  
  <xsl:function name="local:get-countries-for-cities" as="xs:string+">
    <xsl:param name="cities"/>
    <xsl:for-each select="$cities">
      <xsl:value-of select="$places[@xml:id=current()]/country/substring-after(@corresp,'#')"/>
    </xsl:for-each>
  </xsl:function>
  
  <xsl:function name="local:get-affiliation-city" as="xs:string+">
    <xsl:param name="context"/>
    <xsl:message><xsl:value-of select="$context/@xml:id"/></xsl:message>
    <xsl:for-each select="$context//affiliation/tokenize(translate(@corresp,'#',''),'\s')">
      <xsl:variable name="institution" select="$institutions[@xml:id=current()]"/>
      <xsl:choose>
        <xsl:when test="$institution/@xml:id=('self-employment','i4dh','legacy-page')">unknown</xsl:when>
        <xsl:otherwise>
          <xsl:for-each select="$institution/place/tokenize(translate(@corresp,'#',''),'\s')">
            <xsl:value-of select="."/>
          </xsl:for-each>
        </xsl:otherwise>
      </xsl:choose>
    </xsl:for-each>
  </xsl:function>
  
  <xsl:function name="local:get-affiliation-type" as="xs:string+">
    <xsl:param name="context"/>
    <xsl:message><xsl:value-of select="$context/@xml:id"/></xsl:message>
    <xsl:for-each select="$context//affiliation/tokenize(translate(@corresp,'#',''),'\s')">
      <xsl:variable name="institution" select="$institutions[@xml:id=current()]"/>
      <xsl:value-of select="$institution/@type"/>
    </xsl:for-each>
  </xsl:function>
  
  <!-- JSON successor to the counting logic of ls-structures-general. -->
  <xsl:function name="local:series-structure" as="map(*)">
    <xsl:param name="series" as="element()*"/>
    <xsl:param name="terms" as="element()*"/>

    <xsl:variable name="series-counts" as="map(*)*"
      select="for $s in $series
              return map {
                'seriesId': string($s/@xml:id),
                'seriesName': normalize-space(string(($s/eventName[@xml:lang='en'], $s/eventName)[1])),
                'terms': count($s/event[@type='lecture-series-term'])
              }"/>

    <xsl:variable name="term-counts" as="map(*)*"
      select="for $t in $terms
              return map {
                'seriesId': string($t/parent::event/@xml:id),
                'termId': string($t/@xml:id),
                'termName': normalize-space(string(($t/eventName[@xml:lang='en'], $t/eventName)[1])),
                'lectures': count($t/event[@type='lecture'])
              }"/>

    <xsl:sequence select="map {
      'termsPerSeries': array { $series-counts },
      'lecturesPerTerm': array { $term-counts },
      'termsPerSeriesDistribution': array {
        for $n in sort(distinct-values($series-counts?terms))
        return map {
          'terms': $n,
          'series': count($series-counts[?terms = $n])
        }
      },
      'lecturesPerTermDistribution': array {
        for $n in sort(distinct-values($term-counts?lectures))
        return map {
          'lectures': $n,
          'terms': count($term-counts[?lectures = $n])
        }
      }
    }"/>
  </xsl:function>

  <!-- JSON successor to lectures-per-speaker. Count each referenced person
       once per lecture record, including canceled records. -->
  <xsl:function name="local:speaker-ids" as="xs:string*">
    <xsl:param name="lecture" as="element()"/>
    <xsl:sequence select="distinct-values(
      (for $ref in $lecture//person[@role='speaker']/@corresp
       return tokenize(normalize-space($ref), '\s+'))
      [starts-with(., '#') and string-length(.) gt 1]
      ! substring(., 2))"/>
  </xsl:function>

  <xsl:function name="local:speaker-analysis" as="map(*)">
    <xsl:param name="records" as="element()*"/>
    <xsl:variable name="speaker-counts" as="map(*)*">
      <xsl:for-each-group select="$records" group-by="local:speaker-ids(.)">
        <xsl:sort select="count(current-group())" data-type="number" order="descending"/>
        <xsl:sort select="current-grouping-key()"/>
        <xsl:variable name="id" select="current-grouping-key()"/>
        <xsl:variable name="person" select="$persons[@xml:id = $id]"/>
        <xsl:sequence select="map {
          'speakerId': $id,
          'speakerName': normalize-space(string-join(($person//forename, $person//surname), ' ')),
          'registered': exists($person),
          'lectures': count(current-group())
        }"/>
      </xsl:for-each-group>
    </xsl:variable>
    <xsl:sequence select="map {
      'uniqueSpeakers': count($speaker-counts),
      'speakerLectureAssignments': sum($speaker-counts?lectures),
      'unresolvedSpeakerIds': count($speaker-counts[not(?registered)]),
      'lecturesWithoutSpeakerId': count($records[empty(local:speaker-ids(.))]),
      'lecturesPerSpeaker': array { $speaker-counts },
      'lecturesPerSpeakerDistribution': array {
        for $n in sort(distinct-values($speaker-counts?lectures))
        return map {
          'lectures': $n,
          'speakers': count($speaker-counts[?lectures = $n])
        }
      }
    }"/>
  </xsl:function>

  <!-- JSON successor to gender-per-year-plot. The unit is a lecture
       record, not a unique speaker or an individual speaker assignment. -->
  <xsl:function name="local:lecture-gender-record" as="map(*)">
    <xsl:param name="lecture" as="element()"/>
    <xsl:variable name="ids" select="local:speaker-ids($lecture)"/>
    <xsl:variable name="registered" select="$persons[@xml:id = $ids]"/>
    <xsl:variable name="categories" as="xs:string*"
      select="distinct-values($registered/gender[. = ('female', 'male', 'non-binary')] ! string(.))"/>
    <xsl:sequence select="map {
      'year': xs:integer(substring($lecture/@when, 1, 4)),
      'female': $categories = 'female',
      'male': $categories = 'male',
      'nonBinary': $categories = 'non-binary',
      'multipleGenderCategories': count($categories) gt 1,
      'withoutKnownGender': empty($categories),
      'withoutSpeakerId': empty($ids),
      'unresolvedSpeaker': exists($ids[not(. = $registered/@xml:id)]),
      'unknownGender': exists($registered[not(gender = ('female', 'male', 'non-binary'))])
    }"/>
  </xsl:function>

  <xsl:function name="local:gender-per-year" as="map(*)*">
    <xsl:param name="records" as="element()*"/>
    <xsl:variable name="classified" as="map(*)*"
      select="$records[matches(@when, '^[0-9]{4}')] ! local:lecture-gender-record(.)"/>
    <xsl:for-each select="$years">
      <xsl:variable name="year" select="."/>
      <xsl:variable name="entries" select="$classified[?year = $year]"/>
      <xsl:sequence select="map {
        'year': $year,
        'female': count($entries[?female]),
        'male': count($entries[?male]),
        'nonBinary': count($entries[?nonBinary]),
        'multipleGenderCategories': count($entries[?multipleGenderCategories]),
        'withoutKnownGender': count($entries[?withoutKnownGender]),
        'withoutSpeakerId': count($entries[?withoutSpeakerId]),
        'unresolvedSpeaker': count($entries[?unresolvedSpeaker]),
        'unknownGender': count($entries[?unknownGender]),
        'total': count($entries)
      }"/>
    </xsl:for-each>
  </xsl:function>

  <!-- JSON successor to ls-institution-types-plot. -->
  <xsl:variable name="institution-types" as="xs:string+"
    select="('university', 'research_institution', 'glam',
             'company', 'other', 'self-employment')"/>

  <xsl:function name="local:lecture-institution-record" as="map(*)">
    <xsl:param name="lecture" as="element()"/>
    <xsl:variable name="ids" as="xs:string*"
      select="distinct-values(
        (for $ref in $lecture//affiliation/@corresp
         return tokenize(normalize-space($ref), '\s+'))
        [starts-with(., '#') and string-length(.) gt 1]
        ! substring(., 2))"/>
    <xsl:variable name="registered" select="$institutions[@xml:id = $ids]"/>
    <xsl:variable name="types" as="xs:string*"
      select="distinct-values($registered/@type[. = $institution-types] ! string(.))"/>
    <xsl:sequence select="map {
      'seriesId': string($lecture/ancestor::event[@type='lecture-series'][1]/@xml:id),
      'types': $types,
      'withoutAffiliationId': empty($ids),
      'unresolvedAffiliation': exists($ids[not(. = $registered/@xml:id)]),
      'unknownInstitutionType': exists($registered[not(@type = $institution-types)]),
      'withoutKnownType': empty($types),
      'multipleInstitutionTypes': count($types) gt 1
    }"/>
  </xsl:function>

  <xsl:function name="local:institution-type-summary" as="map(*)">
    <xsl:param name="records" as="map(*)*"/>
    <xsl:variable name="total" select="count($records)"/>
    <xsl:sequence select="map {
      'total': $total,
      'types': array {
        for $type in $institution-types
        return map {
          'type': $type,
          'lectures': count($records[?types = $type]),
          'share': if ($total gt 0)
                   then count($records[?types = $type]) div $total
                   else ()
        }
      },
      'withoutAffiliationId': count($records[?withoutAffiliationId]),
      'unresolvedAffiliation': count($records[?unresolvedAffiliation]),
      'unknownInstitutionType': count($records[?unknownInstitutionType]),
      'withoutKnownType': count($records[?withoutKnownType]),
      'multipleInstitutionTypes': count($records[?multipleInstitutionTypes])
    }"/>
  </xsl:function>

  <xsl:function name="local:institution-type-analysis" as="map(*)">
    <xsl:param name="series" as="element()*"/>
    <xsl:param name="lectures" as="element()*"/>
    <xsl:variable name="records" as="map(*)*"
      select="$lectures ! local:lecture-institution-record(.)"/>
    <xsl:sequence select="map {
      'overall': local:institution-type-summary($records),
      'perSeries': array {
        for $s in $series
        return map:merge((
          map {
            'seriesId': string($s/@xml:id),
            'seriesName': normalize-space(string(($s/eventName[@xml:lang='en'], $s/eventName)[1]))
          },
          local:institution-type-summary($records[?seriesId = string($s/@xml:id)])
        ))
      }
    }"/>
  </xsl:function>

  <!-- JSON successor to ls-disciplines. -->
  <xsl:variable name="discipline-categories" as="element()*"
    select="//taxonomy[@xml:id='disciplines']/category"/>

  <xsl:function name="local:lecture-discipline-record" as="map(*)">
    <xsl:param name="lecture" as="element()"/>
    <xsl:variable name="refs" as="xs:string*"
      select="distinct-values(
        (for $ref in $lecture//term[@type='discipline']/@corresp
         return tokenize(normalize-space($ref), '\s+'))[. != ''])"/>
    <xsl:variable name="ids" as="xs:string*"
      select="$refs[starts-with(., '#') and string-length(.) gt 1]
              ! substring(., 2)"/>
    <xsl:variable name="known" as="xs:string*"
      select="$ids[. = $discipline-categories/@xml:id]"/>
    <xsl:variable name="unresolved" as="xs:string*"
      select="$ids[not(. = $discipline-categories/@xml:id)]"/>
    <xsl:sequence select="map {
      'seriesId': string($lecture/ancestor::event[@type='lecture-series'][1]/@xml:id),
      'disciplines': $known,
      'unresolvedIds': $unresolved,
      'withoutDisciplineId': empty($ids),
      'unresolvedDiscipline': exists($unresolved),
      'invalidDisciplineReference': exists($refs[not(starts-with(., '#') and string-length(.) gt 1)]),
      'withoutKnownDiscipline': empty($known),
      'multipleDisciplines': count($known) gt 1
    }"/>
  </xsl:function>

  <xsl:function name="local:discipline-summary" as="map(*)">
    <xsl:param name="records" as="map(*)*"/>
    <xsl:variable name="total" select="count($records)"/>
    <xsl:variable name="categories" as="map(*)*">
      <xsl:for-each select="$discipline-categories">
        <xsl:variable name="id" select="string(@xml:id)"/>
        <xsl:variable name="count" select="count($records[?disciplines = $id])"/>
        <xsl:sequence select="map {
          'id': $id,
          'label': normalize-space(string((catDesc/name, catDesc)[1])),
          'wikidata': normalize-space(string((catDesc/idno[@type='wikidata'])[1])),
          'lectures': $count,
          'share': if ($total gt 0) then $count div $total else ()
        }"/>
      </xsl:for-each>
    </xsl:variable>
    <xsl:variable name="sorted" as="map(*)*">
      <xsl:perform-sort select="$categories">
        <xsl:sort select="?lectures" data-type="number" order="descending"/>
        <xsl:sort select="?label"/>
      </xsl:perform-sort>
    </xsl:variable>
    <xsl:sequence select="map {
      'total': $total,
      'disciplines': array { $sorted },
      'withoutDisciplineId': count($records[?withoutDisciplineId]),
      'unresolvedDiscipline': count($records[?unresolvedDiscipline]),
      'invalidDisciplineReference': count($records[?invalidDisciplineReference]),
      'withoutKnownDiscipline': count($records[?withoutKnownDiscipline]),
      'multipleDisciplines': count($records[?multipleDisciplines]),
      'unresolvedIds': array {
        for $id in sort(distinct-values($records?unresolvedIds))
        return map {
          'id': $id,
          'lectures': count($records[?unresolvedIds = $id])
        }
      }
    }"/>
  </xsl:function>

  <xsl:function name="local:discipline-analysis" as="map(*)">
    <xsl:param name="series" as="element()*"/>
    <xsl:param name="lectures" as="element()*"/>
    <xsl:variable name="records" as="map(*)*"
      select="$lectures ! local:lecture-discipline-record(.)"/>
    <xsl:sequence select="map {
      'overall': local:discipline-summary($records),
      'perSeries': array {
        for $s in $series
        return map:merge((
          map {
            'seriesId': string($s/@xml:id),
            'seriesName': normalize-space(string(($s/eventName[@xml:lang='en'], $s/eventName)[1]))
          },
          local:discipline-summary($records[?seriesId = string($s/@xml:id)])
        ))
      }
    }"/>
  </xsl:function>

  <!-- JSON successor to ls-location-links-plot. -->
  <xsl:variable name="geo-categories" as="xs:string+"
    select="('local', 'national', 'European', 'other continents')"/>

  <xsl:function name="local:geo-ids" as="xs:string*">
    <xsl:param name="refs" as="attribute()*"/>
    <xsl:sequence select="distinct-values(
      (for $ref in $refs return tokenize(normalize-space($ref), '\s+'))
      [starts-with(., '#') and string-length(.) gt 1] ! substring(., 2))"/>
  </xsl:function>

  <xsl:function name="local:geo-countries" as="xs:string*">
    <xsl:param name="city" as="xs:string"/>
    <xsl:sequence select="local:geo-ids($places[@type='city'][@xml:id=$city]/country/@corresp)
      [. = $places[@type='country']/@xml:id]"/>
  </xsl:function>

  <xsl:function name="local:geo-category" as="xs:string?">
    <xsl:param name="city" as="xs:string"/>
    <xsl:param name="hosts" as="xs:string*"/>
    <xsl:variable name="countries" select="local:geo-countries($city)"/>
    <xsl:variable name="host-countries" select="distinct-values($hosts ! local:geo-countries(.))"/>
    <xsl:variable name="continents" select="local:geo-ids($places[@type='country'][@xml:id=$countries]/bloc[@type='continent']/@corresp)
      [. = $places[@type='continent']/@xml:id]"/>
    <xsl:choose>
      <xsl:when test="not($city = $places[@type='city']/@xml:id) or empty($hosts)"/>
      <xsl:when test="$city = $hosts"><xsl:sequence select="'local'"/></xsl:when>
      <xsl:when test="(some $host in $hosts satisfies count(local:geo-countries($host)) ne 1) or count($countries) ne 1"/>
      <xsl:when test="$countries = $host-countries"><xsl:sequence select="'national'"/></xsl:when>
      <xsl:when test="count($continents) ne 1"/>
      <xsl:when test="$continents = 'europe'"><xsl:sequence select="'European'"/></xsl:when>
      <xsl:otherwise><xsl:sequence select="'other continents'"/></xsl:otherwise>
    </xsl:choose>
  </xsl:function>

  <xsl:function name="local:lecture-geo-record" as="map(*)">
    <xsl:param name="lecture" as="element()"/>
    <xsl:variable name="series" select="$lecture/ancestor::event[@type='lecture-series'][1]"/>
    <xsl:variable name="host-ids" select="local:geo-ids($series/@where)"/>
    <xsl:variable name="hosts" select="$host-ids[. = $places[@type='city']/@xml:id]"/>
    <xsl:variable name="affiliation-ids" select="local:geo-ids($lecture//affiliation/@corresp)"/>
    <xsl:variable name="orgs" select="$institutions[@xml:id=$affiliation-ids]"/>
    <xsl:variable name="cities" select="local:geo-ids($orgs/place/@corresp)"/>
    <xsl:variable name="categories" as="xs:string*"
      select="distinct-values($cities ! local:geo-category(., $host-ids))"/>
    <xsl:sequence select="map {
      'lectureId': string($lecture/@xml:id),
      'seriesId': string($series/@xml:id),
      'categories': $categories,
      'withoutHostCity': empty($hosts),
      'withoutAffiliationId': empty($affiliation-ids),
      'unresolvedAffiliation': exists($affiliation-ids[not(. = $orgs/@xml:id)]),
      'incompleteAffiliationGeography': exists($orgs[empty(local:geo-ids(place/@corresp))])
        or (some $city in $cities satisfies
          (count(local:geo-countries($city)) ne 1 or
           count(local:geo-ids($places[@type='country'][@xml:id=local:geo-countries($city)]/bloc[@type='continent']/@corresp)
                 [. = $places[@type='continent']/@xml:id]) ne 1)),
      'withoutKnownConnection': empty($categories),
      'multipleConnectionTypes': count($categories) gt 1
    }"/>
  </xsl:function>

  <xsl:function name="local:geo-summary" as="map(*)">
    <xsl:param name="records" as="map(*)*"/>
    <xsl:variable name="total" select="count($records)"/>
    <xsl:sequence select="map {
      'total': $total,
      'selectionGroups': array {
        map { 'id': 'withoutHostCity', 'label': 'No resolved host city', 'lectures': count($records[?withoutHostCity]),
          'lectureIds': array { $records[?withoutHostCity]?lectureId } },
        map { 'id': 'withoutAffiliationId', 'label': 'No affiliation ID', 'lectures': count($records[?withoutAffiliationId]),
          'lectureIds': array { $records[?withoutAffiliationId]?lectureId } },
        map { 'id': 'unresolvedAffiliation', 'label': 'Unresolved affiliation ID', 'lectures': count($records[?unresolvedAffiliation]),
          'lectureIds': array { $records[?unresolvedAffiliation]?lectureId } },
        map { 'id': 'incompleteAffiliationGeography', 'label': 'Incomplete affiliation geography', 'lectures': count($records[?incompleteAffiliationGeography]),
          'lectureIds': array { $records[?incompleteAffiliationGeography]?lectureId } },
        map { 'id': 'withoutKnownConnection', 'label': 'No known connection', 'lectures': count($records[?withoutKnownConnection]),
          'lectureIds': array { $records[?withoutKnownConnection]?lectureId } },
        map { 'id': 'multipleConnectionTypes', 'label': 'Multiple connection types', 'lectures': count($records[?multipleConnectionTypes]),
          'lectureIds': array { $records[?multipleConnectionTypes]?lectureId } }
      },
      'connections': array {
        for $category in $geo-categories
        return map {
          'type': $category,
          'lectures': count($records[?categories = $category]),
          'lectureIds': array { $records[?categories = $category]?lectureId },
          'share': if ($total gt 0) then count($records[?categories = $category]) div $total else ()
        }
      },
      'withoutHostCity': count($records[?withoutHostCity]),
      'withoutAffiliationId': count($records[?withoutAffiliationId]),
      'unresolvedAffiliation': count($records[?unresolvedAffiliation]),
      'incompleteAffiliationGeography': count($records[?incompleteAffiliationGeography]),
      'withoutKnownConnection': count($records[?withoutKnownConnection]),
      'multipleConnectionTypes': count($records[?multipleConnectionTypes])
    }"/>
  </xsl:function>

  <xsl:function name="local:geographical-analysis" as="map(*)">
    <xsl:param name="series" as="element()*"/>
    <xsl:param name="lectures" as="element()*"/>
    <xsl:variable name="records" as="map(*)*" select="$lectures ! local:lecture-geo-record(.)"/>
    <xsl:sequence select="map {
      'overall': local:geo-summary($records),
      'perSeries': array {
        for $s in $series
        return map:merge((
          map {
            'seriesId': string($s/@xml:id),
            'seriesName': normalize-space(string(($s/eventName[@xml:lang='en'], $s/eventName)[1]))
          },
          local:geo-summary($records[?seriesId = string($s/@xml:id)])
        ))
      }
    }"/>
  </xsl:function>

  <!-- JSON successors to llm-topic-analysis and llm-topic-csv. -->
  <xsl:variable name="topic-areas" as="map(*)+" select="(
    map {'id': 'digitizationAndCulturalHeritage',
         'label': 'Digitization and cultural heritage',
         'pattern': 'cultural heritage|digitization'},
    map {'id': 'digitalEdition', 'label': 'Digital edition',
         'pattern': 'edition|editing|editorial'},
    map {'id': 'analysis', 'label': 'Analysis', 'pattern': 'analysis'},
    map {'id': 'artificialIntelligence', 'label': 'Artificial intelligence',
         'pattern': 'machine learning|ai|artificial intelligence|llm'}
  )"/>

  <xsl:function name="local:lecture-topic-record" as="map(*)">
    <xsl:param name="lecture" as="element()"/>
    <xsl:variable name="topics" as="xs:string*" select="distinct-values(
      (for $term in $lecture//term[@type='topics-llm']
       return tokenize(normalize-space(string($term)), ',')
         ! lower-case(normalize-space(.)))[. != ''])"/>
    <xsl:variable name="areas" as="xs:string*" select="
      for $area in $topic-areas
      return if (some $topic in $topics satisfies
        matches($topic, concat('(^|[^\p{L}\p{N}])(', $area?pattern,
          ')([^\p{L}\p{N}]|$)')))
        then $area?id else ()"/>
    <xsl:sequence select="map {
      'lectureId': string($lecture/@xml:id),
      'seriesId': string($lecture/ancestor::event[@type='lecture-series'][1]/@xml:id),
      'topics': $topics,
      'areas': $areas
    }"/>
  </xsl:function>

  <xsl:function name="local:topic-summary" as="map(*)">
    <xsl:param name="records" as="map(*)*"/>
    <xsl:variable name="total" select="count($records)"/>
    <xsl:variable name="keywords" as="map(*)*">
      <xsl:for-each-group select="$records?topics" group-by=".">
        <xsl:sort select="count(current-group())" data-type="number" order="descending"/>
        <xsl:sort select="current-grouping-key()"/>
        <xsl:variable name="count" select="count(current-group())"/>
        <xsl:sequence select="map {
          'topic': current-grouping-key(),
          'lectures': $count,
          'share': if ($total gt 0) then $count div $total else ()
        }"/>
      </xsl:for-each-group>
    </xsl:variable>
    <xsl:sequence select="map {
      'total': $total,
      'selectionGroups': array {
        map { 'id': 'withoutTopics', 'label': 'No recorded topics', 'lectures': count($records[empty(?topics)]),
          'lectureIds': array { $records[empty(?topics)]?lectureId } },
        map { 'id': 'withoutTopicArea', 'label': 'No matching topic area', 'lectures': count($records[empty(?areas)]),
          'lectureIds': array { $records[empty(?areas)]?lectureId } },
        map { 'id': 'multipleTopicAreas', 'label': 'Multiple matching topic areas', 'lectures': count($records[count(?areas) gt 1]),
          'lectureIds': array { $records[count(?areas) gt 1]?lectureId } }
      },
      'withTopics': count($records[exists(?topics)]),
      'withoutTopics': count($records[empty(?topics)]),
      'distinctTopics': count($keywords),
      'topicAssignments': count($records?topics),
      'withoutTopicArea': count($records[empty(?areas)]),
      'multipleTopicAreas': count($records[count(?areas) gt 1]),
      'topics': array { $keywords },
      'topicAreas': array {
        for $area in $topic-areas
        return map {
          'id': $area?id,
          'label': $area?label,
          'lectures': count($records[?areas = $area?id]),
          'lectureIds': array { $records[?areas = $area?id]?lectureId },
          'share': if ($total gt 0) then count($records[?areas = $area?id]) div $total else ()
        }
      }
    }"/>
  </xsl:function>

  <xsl:function name="local:topic-analysis" as="map(*)">
    <xsl:param name="series" as="element()*"/>
    <xsl:param name="lectures" as="element()*"/>
    <xsl:variable name="records" as="map(*)*" select="$lectures ! local:lecture-topic-record(.)"/>
    <xsl:sequence select="map {
      'overall': local:topic-summary($records),
      'perSeries': array {
        for $s in $series
        return map:merge((
          map {
            'seriesId': string($s/@xml:id),
            'seriesName': normalize-space(string(($s/eventName[@xml:lang='en'], $s/eventName)[1]))
          },
          local:topic-summary($records[?seriesId = string($s/@xml:id)])
        ))
      }
    }"/>
  </xsl:function>

  <!-- JSON successor to the institutional and geographical number-of-* templates.
       Local references are deduplicated using the same helper as geographical analysis. -->
  <xsl:function name="local:overview-geography" as="map(*)">
    <xsl:param name="ids" as="xs:string*"/>
    <xsl:variable name="registered" select="$places[@xml:id = $ids]"/>
    <xsl:variable name="cities" select="$registered[@type='city']"/>
    <xsl:variable name="country-ids" as="xs:string*"
      select="distinct-values((local:geo-ids($cities/country/@corresp),
                              $registered[@type='country']/@xml:id ! string(.)))"/>
    <xsl:variable name="countries" select="$places[@type='country'][@xml:id = $country-ids]"/>
    <xsl:sequence select="map {
      'referencedPlaces': count($ids),
      'cities': count($cities),
      'countries': count($countries),
      'referencedCountries': count($country-ids),
      'virtualPlaceIds': array { sort($registered[@type='virtual']/@xml:id ! string(.)) },
      'directCountryIds': array { sort($registered[@type='country']/@xml:id ! string(.)) },
      'unresolvedPlaceIds': array { sort($ids[not(. = $registered/@xml:id)]) },
      'unresolvedOrInvalidCountryIds': array { sort($country-ids[not(. = $countries/@xml:id)]) },
      'citiesWithoutResolvedCountryIds': array {
        sort($cities[empty(local:geo-countries(string(@xml:id)))]/@xml:id ! string(.))
      }
    }"/>
  </xsl:function>

  <xsl:function name="local:corpus-overview" as="map(*)">
    <xsl:variable name="organizer-ids" select="local:geo-ids($lecture-terms//org[@role='organizer']/@corresp)"/>
    <xsl:variable name="organizer-persons" select="$persons[@xml:id = $organizer-ids]"/>
    <xsl:variable name="organizer-orgs" select="$institutions[@xml:id = $organizer-ids]"/>
    <xsl:variable name="host-ids" select="local:geo-ids($lectures/org[@role='host-institution']/@corresp)"/>
    <xsl:variable name="affiliation-ids" select="local:geo-ids($lectures//affiliation/@corresp)"/>
    <xsl:variable name="host-orgs" select="$institutions[@xml:id = $host-ids]"/>
    <xsl:variable name="affiliation-orgs" select="$institutions[@xml:id = $affiliation-ids]"/>
    <xsl:sequence select="map {
      'organizers': map {
        'uniqueIds': count($organizer-ids),
        'registeredPersons': count($organizer-persons),
        'registeredInstitutions': count($organizer-orgs),
        'unresolvedIds': array { sort($organizer-ids[not(. = ($organizer-persons/@xml:id, $organizer-orgs/@xml:id))]) }
      },
      'hostInstitutions': map {
        'uniqueIds': count($host-ids),
        'registeredInstitutions': count($host-orgs),
        'unresolvedIds': array { sort($host-ids[not(. = $host-orgs/@xml:id)]) }
      },
      'affiliationInstitutions': map {
        'uniqueIds': count($affiliation-ids),
        'registeredInstitutions': count($affiliation-orgs),
        'unresolvedIds': array { sort($affiliation-ids[not(. = $affiliation-orgs/@xml:id)]) },
        'withoutPlaceIds': array { sort($affiliation-orgs[empty(local:geo-ids(place/@corresp))]/@xml:id ! string(.)) }
      },
      'hostGeography': local:overview-geography(local:geo-ids($lecture-series/@where)),
      'affiliationGeography': local:overview-geography(local:geo-ids($affiliation-orgs/place/@corresp))
    }"/>
  </xsl:function>

  <xsl:template match="/">
    <xsl:variable name="annual" as="map(*)*">
      <xsl:call-template name="lectures-per-year"/>
    </xsl:variable>
    <xsl:variable name="annual-audience" as="map(*)*">
      <xsl:call-template name="audience-per-year"/>
    </xsl:variable>
    <xsl:sequence select="map {
      'datasetVersion': normalize-space(string((//teiHeader/fileDesc/editionStmt/edition)[1])),
      'counts': map {
        'series': count($lecture-series),
        'terms': count($lecture-terms),
        'lectures': count($lectures)
      },
      'undatedLectures': count($lectures[not(matches(@when, '^[0-9]{4}'))]),
      'lecturesPerYear': array { $annual },
      'audiencePerYear': array { $annual-audience },
      'seriesStructure': local:series-structure($lecture-series, $lecture-terms),
      'speakerAnalysis': local:speaker-analysis($lectures),
      'genderPerYear': array { local:gender-per-year($lectures) },
      'institutionTypeAnalysis': local:institution-type-analysis($lecture-series, $lectures),
      'disciplineAnalysis': local:discipline-analysis($lecture-series, $lectures),
      'geographicalAnalysis': local:geographical-analysis($lecture-series, $lectures),
      'topicAnalysis': local:topic-analysis($lecture-series, $lectures),
      'corpusOverview': local:corpus-overview()
    }"/>
  </xsl:template>
  
  <xsl:template name="llm-topic-analysis">
     <xsl:result-document href="../analyses/llm-topics-plot.html" method="html">
        <html>
          <head>
            <script src="https://cdn.plot.ly/plotly-3.0.1.min.js" charset="utf-8"/>
          </head>
          <body>
            <table>
              <tr>
                <td><div id="myDiv1" style="width:700px;height:500px;"/></td>
              </tr>
            </table>
            <script>
              var trace1 = {
              y: [<xsl:for-each select="$lecture-series">
                <xsl:variable name="terms" select="event[@type='lecture-series-term']"/>
                <xsl:variable name="lectures" select="$terms/event[@type='lecture']"/>
                <xsl:value-of select="count($terms/event[@type='lecture'][.//term[@type='topics-llm'][contains(normalize-space(.),'cultural heritage') or contains(normalize-space(.),'digitization')]]) div count($terms/event[@type='lecture'])"/>
                <xsl:if test="position()!=last()">,</xsl:if>
              </xsl:for-each>],
              type: 'box',
              name: 'digitization and cultural heritage'
              };
              
              var trace2 = {
              y: [<xsl:for-each select="$lecture-series">
                <xsl:variable name="terms" select="event[@type='lecture-series-term']"/>
                <xsl:variable name="lectures" select="$terms/event[@type='lecture']"/>
                <xsl:value-of select="count($terms/event[@type='lecture'][.//term[@type='topics-llm'][contains(normalize-space(.),'edition') or contains(normalize-space(.),'editing') or contains(normalize-space(.),'editorial')]]) div count($terms/event[@type='lecture'])"/>
                <xsl:if test="position()!=last()">,</xsl:if>
              </xsl:for-each>],
              type: 'box',
              name: 'digital edition'
              };
              
              var trace3 = {
              y: [<xsl:for-each select="$lecture-series">
                <xsl:variable name="terms" select="event[@type='lecture-series-term']"/>
                <xsl:variable name="lectures" select="$terms/event[@type='lecture']"/>
                <xsl:value-of select="count($terms/event[@type='lecture'][.//term[@type='topics-llm'][contains(normalize-space(.),'analysis')]]) div count($terms/event[@type='lecture'])"/>
                <xsl:if test="position()!=last()">,</xsl:if>
              </xsl:for-each>],
              type: 'box',
              name: 'analysis'
              };
              
              var trace4 = {
              y: [<xsl:for-each select="$lecture-series">
                <xsl:variable name="terms" select="event[@type='lecture-series-term']"/>
                <xsl:variable name="lectures" select="$terms/event[@type='lecture']"/>
                <xsl:value-of select="count($terms/event[@type='lecture'][.//term[@type='topics-llm'][contains(normalize-space(.),'machine learning') or contains(normalize-space(.),'ai') or contains(normalize-space(.),'artificial intelligence') or contains(normalize-space(.),'llm')]]) div count($terms/event[@type='lecture'])"/>
                <xsl:if test="position()!=last()">,</xsl:if>
              </xsl:for-each>],
              type: 'box',
              name: 'artificial intelligence'
              };
              
             
              var data = [trace1,trace2,trace3,trace4];
              var layout = {
              yaxis: {range: [0,1], title: {text: "percentage of lectures with topic area per series"}},
              xaxis: {tickangle: 15}
              };
              
              Plotly.newPlot('myDiv1', data, layout);
              
            </script>
          </body>
        </html>
      </xsl:result-document>
  </xsl:template>
  
  <xsl:template name="lectures-per-speaker">
    <xsl:result-document href="../analyses/lectures-per-speaker.csv" method="text" encoding="UTF-8">
      <xsl:text>speaker-name,number-of-lectures</xsl:text>
      <xsl:text>
</xsl:text>
      <xsl:for-each-group select="$lectures//person[@role='speaker']" group-by="@corresp">
        <xsl:sort select="count(current-group())"/>
        <xsl:variable name="speaker-id" select="substring-after(current-grouping-key(),'#')"/>
        <xsl:variable name="speaker" select="//teiHeader//person[@xml:id=$speaker-id]"/>
        <xsl:value-of select="string-join(($speaker//forename, $speaker//surname),' ')"/>
        <xsl:text>,</xsl:text>
        <xsl:value-of select="count(current-group())"/>
        <xsl:text>
</xsl:text>
      </xsl:for-each-group>
    </xsl:result-document>
    <xsl:result-document href="../analyses/lectures-per-speaker-plot.html" method="html">
      <html>
        <head>
          <script src="https://cdn.plot.ly/plotly-3.0.1.min.js" charset="utf-8"/>
        </head>
        <body>
          <table>
            <tr>
              <td><div id="myDiv" style="width:400px;height:400px;"/></td>
            </tr>
          </table>
          <script>
            var trace1 = {
            x: [<xsl:for-each-group select="$lectures//person[@role='speaker']" group-by="@corresp">
              <xsl:value-of select="count(current-group())"/>
              <xsl:if test="position() != last()">,</xsl:if>
            </xsl:for-each-group>],
            type: 'histogram'
            };
            
            
            var data = [trace1];
            var layout = {
            barmode: "stack",
            yaxis: {title: {text: "number of speakers"}},
            xaxis: {title: {text: "number of lectures"}}
            };
            
            Plotly.newPlot('myDiv', data, layout);
          </script>
        </body>
      </html>
    </xsl:result-document>
  </xsl:template>
  
  <xsl:template name="llm-topic-csv">
    <xsl:result-document href="../analyses/llm-topics.csv" method="text">
      <xsl:text>topic,count</xsl:text>
      <xsl:text>
</xsl:text>
      <xsl:for-each-group select="$lectures//term[@type='topics-llm']/tokenize(normalize-space(.),',\s')" group-by=".">
        <xsl:value-of select="current-grouping-key()"/>
        <xsl:text>,</xsl:text>
        <xsl:value-of select="count(current-group())"/><xsl:text>
</xsl:text>
      </xsl:for-each-group>  
    </xsl:result-document>
  </xsl:template>
  
  <xsl:template name="ls-disciplines">
    <xsl:for-each select="$lecture-series">
      <xsl:variable name="ls-id" select="@xml:id"/>
      <xsl:result-document href="../analyses/ls-disciplines-{$ls-id}.html" method="html">
        <html>
          <head>
            <script src="https://cdn.plot.ly/plotly-3.0.1.min.js" charset="utf-8"/>
          </head>
          <body>
            <table>
              <tr>
                <td><div id="myDiv1" style="width:700px;height:550px;"/></td>
              </tr>
            </table>
            <script>
              var trace1 = {
              y: [<xsl:for-each select="//taxonomy[@xml:id='disciplines']/category">
                <xsl:sort select="count($lectures[ancestor::event[@type='lecture-series'][@xml:id=$ls-id]][.//term[@type='discipline']/tokenize(translate(@corresp,'#',''),'\s')=current()/@xml:id])" data-type="number" order="descending"/>
                <xsl:value-of select="count($lectures[ancestor::event[@type='lecture-series'][@xml:id=$ls-id]][.//term[@type='discipline']/tokenize(translate(@corresp,'#',''),'\s')=current()/@xml:id])"/>
                <xsl:if test="position()!=last()">,</xsl:if>
              </xsl:for-each>],
              x: [<xsl:for-each select="//taxonomy[@xml:id='disciplines']/category">
                <xsl:sort select="count($lectures[ancestor::event[@type='lecture-series'][@xml:id=$ls-id]][.//term[@type='discipline']/tokenize(translate(@corresp,'#',''),'\s')=current()/@xml:id])" data-type="number" order="descending"/>
                '<xsl:value-of select="catDesc"/>'
                <xsl:if test="position()!=last()">,</xsl:if>
              </xsl:for-each>],
              type: 'bar',
              name: 'disciplines'
              };
              
              var data = [trace1];
              var layout = {
              yaxis: {title: {text: "number of lectures"}},
              xaxis: {tickangle: 40},
              margin: {b: 150}
              };
              
              Plotly.newPlot('myDiv1', data, layout);
              
            </script>
          </body>
        </html>
      </xsl:result-document>
    </xsl:for-each>
    
    
    <xsl:result-document href="../analyses/ls-disciplines-overview.html" method="html">
      <html>
        <head>
          <script src="https://cdn.plot.ly/plotly-3.0.1.min.js" charset="utf-8"/>
        </head>
        <body>
          <table>
            <tr>
              <td><div id="myDiv1" style="width:700px;height:550px;"/></td>
            </tr>
          </table>
          <script>
            var trace1 = {
            y: [<xsl:for-each select="//taxonomy[@xml:id='disciplines']/category">
              <xsl:sort select="count($lectures[.//term[@type='discipline']/tokenize(translate(@corresp,'#',''),'\s')=current()/@xml:id])" data-type="number" order="descending"/>
              <xsl:value-of select="count($lectures[.//term[@type='discipline']/tokenize(translate(@corresp,'#',''),'\s')=current()/@xml:id])"/>
              <xsl:if test="position()!=last()">,</xsl:if>
            </xsl:for-each>],
            x: [<xsl:for-each select="//taxonomy[@xml:id='disciplines']/category">
              <xsl:sort select="count($lectures[.//term[@type='discipline']/tokenize(translate(@corresp,'#',''),'\s')=current()/@xml:id])" data-type="number" order="descending"/>
              '<xsl:value-of select="catDesc"/>'
              <xsl:if test="position()!=last()">,</xsl:if>
            </xsl:for-each>],
            type: 'bar',
            name: 'disciplines'
            };
            
            var data = [trace1];
            var layout = {
            yaxis: {title: {text: "number of lectures"}},
            xaxis: {tickangle: 40},
            margin: {b: 150, r: 100}
            };
            
            Plotly.newPlot('myDiv1', data, layout);
            
          </script>
        </body>
      </html>
    </xsl:result-document>
  </xsl:template>
  
  <xsl:template name="ls-institution-types-plot">
    <xsl:result-document href="../analyses/ls-institution-types-plot.html" method="html">
      <html>
        <head>
          <script src="https://cdn.plot.ly/plotly-3.0.1.min.js" charset="utf-8"/>
        </head>
        <body>
          <table>
            <tr>
              <td><div id="myDiv1" style="width:700px;height:500px;"/></td>
            </tr>
          </table>
          <script>
            var trace1 = {
            y: [<xsl:for-each select="$lecture-series">
              <xsl:variable name="terms" select="event[@type='lecture-series-term']"/>
              <xsl:variable name="lectures" select="$terms/event[@type='lecture']"/>
              <xsl:value-of select="count($terms/event[@type='lecture'][local:get-affiliation-type(.)='university']) div count($terms/event[@type='lecture'])"/>
              <xsl:if test="position()!=last()">,</xsl:if>
            </xsl:for-each>],
            type: 'box',
            name: 'university'
            };
            
            var trace2 = {
            y: [<xsl:for-each select="$lecture-series">
              <xsl:variable name="terms" select="event[@type='lecture-series-term']"/>
              <xsl:variable name="lectures" select="$terms/event[@type='lecture']"/>
              <xsl:value-of select="count($terms/event[@type='lecture'][local:get-affiliation-type(.)='research_institution']) div count($terms/event[@type='lecture'])"/>
              <xsl:if test="position()!=last()">,</xsl:if>
            </xsl:for-each>],
            type: 'box',
            name: 'other kind of research institution'
            };
            
            var trace3 = {
            y: [<xsl:for-each select="$lecture-series">
              <xsl:variable name="terms" select="event[@type='lecture-series-term']"/>
              <xsl:variable name="lectures" select="$terms/event[@type='lecture']"/>
              <xsl:value-of select="count($terms/event[@type='lecture'][local:get-affiliation-type(.)='glam']) div count($terms/event[@type='lecture'])"/>
              <xsl:if test="position()!=last()">,</xsl:if>
            </xsl:for-each>],
            type: 'box',
            name: 'glam'
            };
            
            var trace4 = {
            y: [<xsl:for-each select="$lecture-series">
              <xsl:variable name="terms" select="event[@type='lecture-series-term']"/>
              <xsl:variable name="lectures" select="$terms/event[@type='lecture']"/>
              <xsl:value-of select="count($terms/event[@type='lecture'][local:get-affiliation-type(.)='company']) div count($terms/event[@type='lecture'])"/>
              <xsl:if test="position()!=last()">,</xsl:if>
            </xsl:for-each>],
            type: 'box',
            name: 'company'
            };
            
            
            var trace5 = {
            y: [<xsl:for-each select="$lecture-series">
              <xsl:variable name="terms" select="event[@type='lecture-series-term']"/>
              <xsl:variable name="lectures" select="$terms/event[@type='lecture']"/>
              <xsl:value-of select="count($terms/event[@type='lecture'][local:get-affiliation-type(.)='other']) div count($terms/event[@type='lecture'])"/>
              <xsl:if test="position()!=last()">,</xsl:if>
            </xsl:for-each>],
            type: 'box',
            name: 'other kind of institution'
            };
            
            var trace6 = {
            y: [<xsl:for-each select="$lecture-series">
              <xsl:variable name="terms" select="event[@type='lecture-series-term']"/>
              <xsl:variable name="lectures" select="$terms/event[@type='lecture']"/>
              <xsl:value-of select="count($terms/event[@type='lecture'][local:get-affiliation-type(.)='self-employment']) div count($terms/event[@type='lecture'])"/>
              <xsl:if test="position()!=last()">,</xsl:if>
            </xsl:for-each>],
            type: 'box',
            name: 'self employment'
            };
            
            var data = [trace1,trace2,trace3,trace4,trace5,trace6];
            var layout = {
            yaxis: {range: [0,1], title: {text: "percentage of speaker institution type per series"}},
            xaxis: {tickangle: 15}
            };
            
            Plotly.newPlot('myDiv1', data, layout);
            
          </script>
        </body>
      </html>
    </xsl:result-document>
  </xsl:template>
  
  <xsl:template name="ls-location-links-plot">
    <xsl:result-document href="../analyses/ls-location-links-plot.html" method="html">
      <html>
        <head>
          <script src="https://cdn.plot.ly/plotly-3.0.1.min.js" charset="utf-8"/>
        </head>
        <body>
          <table>
            <tr>
              <td><div id="myDiv1" style="width:600px;height:500px;"/></td>
            </tr>
          </table>
          <script>
            var trace1 = {
            y: [<xsl:for-each select="$lecture-series">
              <xsl:variable name="ls-cities" select="tokenize(translate(@where,'#',''),'\s')"/>
              <xsl:variable name="terms" select="event[@type='lecture-series-term']"/>
              <xsl:value-of select="count($terms/event[@type='lecture'][local:get-affiliation-city(.)=$ls-cities]) div count($terms/event[@type='lecture'])"/>
              <xsl:if test="position()!=last()">,</xsl:if>
            </xsl:for-each>],
            type: 'box',
            name: 'local'
            };
            
            var trace2 = {
            y: [<xsl:for-each select="$lecture-series">
              <xsl:variable name="ls-cities" select="tokenize(translate(@where,'#',''),'\s')"/>
              <xsl:variable name="ls-countries" select="local:get-countries-for-cities($ls-cities)"/>
              <xsl:variable name="terms" select="event[@type='lecture-series-term']"/>
              <xsl:value-of select="count($terms/event[@type='lecture'][local:get-affiliation-city(.)!=$ls-cities][local:get-countries-for-cities(local:get-affiliation-city(.))=$ls-countries]) div count($terms/event[@type='lecture'])"/>
              <xsl:if test="position()!=last()">,</xsl:if>
            </xsl:for-each>],
            type: 'box',
            name: 'national'
            };
            
            var trace3 = {
            y: [<xsl:for-each select="$lecture-series">
              <xsl:variable name="ls-cities" select="tokenize(translate(@where,'#',''),'\s')"/>
              <xsl:variable name="ls-countries" select="local:get-countries-for-cities($ls-cities)"/>
              <xsl:variable name="ls-continents" select="local:get-continents-for-countries($ls-countries)"/>
              <xsl:variable name="terms" select="event[@type='lecture-series-term']"/>
              <xsl:value-of select="count($terms/event[@type='lecture'][local:get-affiliation-city(.)!=$ls-cities][local:get-countries-for-cities(local:get-affiliation-city(.))!=$ls-countries][local:get-continents-for-countries(local:get-countries-for-cities(local:get-affiliation-city(.)))='europe']) div count($terms/event[@type='lecture'])"/>
              <xsl:if test="position()!=last()">,</xsl:if>
            </xsl:for-each>],
            type: 'box',
            name: 'European'
            };
            
            var trace4 = {
            y: [<xsl:for-each select="$lecture-series">
              <xsl:variable name="ls-cities" select="tokenize(translate(@where,'#',''),'\s')"/>
              <xsl:variable name="ls-countries" select="local:get-countries-for-cities($ls-cities)"/>
              <xsl:variable name="ls-continents" select="local:get-continents-for-countries($ls-countries)"/>
              <xsl:variable name="terms" select="event[@type='lecture-series-term']"/>
              <xsl:value-of select="count($terms/event[@type='lecture'][local:get-affiliation-city(.)!=$ls-cities][local:get-countries-for-cities(local:get-affiliation-city(.))!=$ls-countries][local:get-continents-for-countries(local:get-countries-for-cities(local:get-affiliation-city(.)))!='europe']) div count($terms/event[@type='lecture'])"/>
              <xsl:if test="position()!=last()">,</xsl:if>
            </xsl:for-each>],
            type: 'box',
            name: 'other continents'
            };
            
            var data = [trace1,trace2,trace3,trace4];
            var layout = {
            yaxis: {range: [0,1], title: {text: "percentage of lectures per series"}}
            };
            
            Plotly.newPlot('myDiv1', data, layout);
            
          </script>
        </body>
      </html>
    </xsl:result-document>
  </xsl:template>
  
  <xsl:template name="gender-per-year-plot">
    <xsl:result-document href="../analyses/gender-per-year-plot.html" method="html">
      <html>
        <head>
          <script src="https://cdn.plot.ly/plotly-3.0.1.min.js" charset="utf-8"/>
        </head>
        <body>
          <table>
            <tr>
              <td><div id="myDiv" style="width:620px;height:400px;"/></td>
            </tr>
          </table>
          <script>
            var trace1 = {
            y: [<xsl:for-each select="$years">
              <xsl:value-of select="count($lectures[number(substring(@when,1,4))=current()][.//person[@role='speaker']/substring-after(@corresp,'#')=$persons-female/@xml:id])"/>
              <xsl:if test="position()!=last()">,</xsl:if>
            </xsl:for-each>],
            x: [<xsl:value-of select="string-join($years,',')"/>],
            type: 'bar',
            name: 'female'
            };
            
            var trace2 = {
            y: [<xsl:for-each select="$years">
              <xsl:value-of select="count($lectures[number(substring(@when,1,4))=current()][.//person[@role='speaker']/substring-after(@corresp,'#')=$persons-male/@xml:id])"/>
              <xsl:if test="position()!=last()">,</xsl:if>
            </xsl:for-each>],
            x: [<xsl:value-of select="string-join($years,',')"/>],
            type: 'bar',
            name: 'male'
            };
            
            var trace3 = {
            y: [<xsl:for-each select="$years">
              <xsl:value-of select="count($lectures[number(substring(@when,1,4))=current()][.//person[@role='speaker']/substring-after(@corresp,'#')=$persons-non-binary/@xml:id])"/>
              <xsl:if test="position()!=last()">,</xsl:if>
            </xsl:for-each>],
            x: [<xsl:value-of select="string-join($years,',')"/>],
            type: 'bar',
            name: 'non-binary'
            };
            
            
            var data = [trace1,trace2,trace3];
            var layout = {
            barmode: "stack",
            yaxis: {title: {text: "number of lectures"}}
            };
            
            Plotly.newPlot('myDiv', data, layout);
          </script>
        </body>
      </html>
    </xsl:result-document>
  </xsl:template>
  
  <!-- Annual lecture records by year and format.
       Counts preserve the original existential TEI format predicates.
       Multiple matching categories can overlap; total counts records once. -->
  <xsl:template name="lectures-per-year" as="map(*)*">
    <xsl:variable name="formats" as="xs:string*"
      select="('in person', 'online', 'canceled')"/>
    <xsl:for-each select="$years">
      <xsl:variable name="year" select="."/>
      <xsl:variable name="annual-lectures"
        select="$lectures[matches(@when, '^[0-9]{4}')]
                         [number(substring(@when, 1, 4)) = $year]"/>
      <xsl:sequence select="map {
        'year': $year,
        'inPerson': count($annual-lectures[.//term[@type='speech']='in person']),
        'online': count($annual-lectures[.//term[@type='speech']='online']),
        'canceled': count($annual-lectures[.//term[@type='speech']='canceled']),
        'otherOrUnknown': count($annual-lectures[not(.//term[@type='speech']=$formats)]),
        'multipleFormats': count($annual-lectures[
          count(distinct-values(.//term[@type='speech'][.=$formats])) gt 1]),
        'total': count($annual-lectures)
      }"/>
    </xsl:for-each>
  </xsl:template>
  
  <!-- Audience participation is independent of lecture delivery.
       The unit of analysis is a lecture record, not an audience member.
       Recognized categories are counted by presence, and may overlap. -->
  <xsl:template name="audience-per-year" as="map(*)*">
    <xsl:variable name="formats" as="xs:string*"
      select="('in person', 'online', 'hybrid')"/>
    <xsl:for-each select="$years">
      <xsl:variable name="year" select="."/>
      <xsl:variable name="annual-lectures"
        select="$lectures[matches(@when, '^[0-9]{4}')]
                         [number(substring(@when, 1, 4)) = $year]"/>
      <xsl:variable name="canceled-without-audience"
        select="$annual-lectures[.//term[@type='speech']='canceled']
                               [not(.//term[@type='audience'])]"/>
      <xsl:sequence select="map {
        'year': $year,
        'inPerson': count($annual-lectures[.//term[@type='audience']='in person']),
        'online': count($annual-lectures[.//term[@type='audience']='online']),
        'hybrid': count($annual-lectures[.//term[@type='audience']='hybrid']),
        'canceledWithoutAudience': count($canceled-without-audience),
        'otherOrUnknown': count(($annual-lectures except $canceled-without-audience)
                                [not(.//term[@type='audience']=$formats)]),
        'multipleFormats': count($annual-lectures[
          count(distinct-values(.//term[@type='audience'][.=$formats])) gt 1]),
        'total': count($annual-lectures)
      }"/>
    </xsl:for-each>
  </xsl:template>

  <xsl:template name="number-of-affiliation-countries">
    <xsl:variable name="countries" as="xs:string+">
      <xsl:for-each select="distinct-values($lectures//affiliation/tokenize(@corresp,'\s'))">
        <xsl:variable name="institution-name" select="substring-after(.,'#')"/>
        <xsl:variable name="city-names" select="$institutions[@xml:id=$institution-name]/place/@corresp/tokenize(translate(.,'#',''),'\s')"/>
        <xsl:for-each select="$city-names">
          <xsl:value-of select="$places[@type='city'][@xml:id=current()]/country/@corresp"/>
        </xsl:for-each>
      </xsl:for-each>
    </xsl:variable>
    
    <xsl:value-of select="count(distinct-values($countries))"/>
  </xsl:template>
  
  <xsl:template name="number-of-affiliation-cities">
    <xsl:variable name="cities" as="xs:string+">
      <xsl:for-each select="distinct-values($lectures//affiliation/tokenize(@corresp,'\s'))">
        <xsl:variable name="institution-name" select="substring-after(.,'#')"/>
        <xsl:variable name="city-names" select="$institutions[@xml:id=$institution-name]/place/@corresp/tokenize(.,'\s')"/>
        <xsl:for-each select="$city-names">
          <xsl:value-of select="."/>
        </xsl:for-each>
      </xsl:for-each>
    </xsl:variable>
    
    <xsl:value-of select="count(distinct-values($cities))"/>
  </xsl:template>
  
  <xsl:template name="number-of-host-countries">
    <xsl:variable name="countries" as="xs:string+">
      <xsl:for-each select="distinct-values($lecture-series/tokenize(@where,'\s'))">
        <xsl:variable name="city-name" select="substring-after(.,'#')"/>
        <xsl:variable name="country-name" select="$places[@type='city'][@xml:id=$city-name]/country/@corresp"/>
        <xsl:value-of select="$country-name"/>
      </xsl:for-each>
    </xsl:variable>
    
    <xsl:value-of select="count(distinct-values($countries))"/>
  </xsl:template>
  
  <xsl:template name="number-of-host-cities">
    <xsl:value-of select="count(distinct-values($lecture-series/tokenize(@where,'\s')))"/>
  </xsl:template>
  
  <xsl:template name="number-of-affiliation-institutions">
    <xsl:value-of select="count(distinct-values($lectures//affiliation/tokenize(@corresp,'\s')))"/>
  </xsl:template>
  
  <xsl:template name="number-of-host-institutions">
    <xsl:value-of select="count(distinct-values($lectures/org[@role='host-institution']/tokenize(@corresp,'\s')))"/>
  </xsl:template>
  
  <xsl:template name="number-of-speakers">
    <xsl:value-of select="count(distinct-values($lectures//person[@role='speaker']/@corresp))"/>
  </xsl:template>
  
  <xsl:template name="number-of-organizers">
    <xsl:value-of select="count(distinct-values($lecture-terms//org[@role='organizer']/tokenize(@corresp,'\s')))"/>
  </xsl:template>
  
  <xsl:template name="number-of-lectures">
    <xsl:value-of select="count($lecture-series/event[@type='lecture-series-term']/event[@type='lecture'])"/>
  </xsl:template>
  
  <xsl:template name="ls-structures-general">
    <xsl:result-document href="../analyses/ls-structure-plot.html" method="html">
      <html>
        <head>
          <script src="https://cdn.plot.ly/plotly-3.0.1.min.js" charset="utf-8"/>
        </head>
        <body>
          <table>
            <tr>
              <td><div id="myDiv1" style="width:300px;height:500px;"/></td>
              <td><div id="myDiv2" style="width:300px;height:500px;"/></td>
            </tr>
          </table>
          <script>
            var trace1 = {
            y: [<xsl:for-each select="$lecture-series">
              <xsl:value-of select="count(event[@type='lecture-series-term'])"/>
              <xsl:if test="position()!=last()">,</xsl:if>
            </xsl:for-each>],
            type: 'box',
            name: 'lecture series'
            };
            
            var data = [trace1];
            var layout = {
            yaxis: {range: [0,16], title: {text: "number of terms per series"}}
            };
            
            Plotly.newPlot('myDiv1', data, layout);
            
            var trace2 = {
            y: [<xsl:for-each select="$lecture-series">
              <xsl:for-each select="event[@type='lecture-series-term']">
                <xsl:value-of select="count(event[@type='lecture'])"/>
                <xsl:if test="position()!=last()">,</xsl:if>
              </xsl:for-each>
              <xsl:if test="position()!=last()">,</xsl:if>
            </xsl:for-each>],
            type: 'box',
            name: 'lecture series terms'
            };
            
            var data = [trace2];
            var layout = {
            yaxis: {range: [0,16], title: {text: "number of lectures per term"}}
            };
            
            Plotly.newPlot('myDiv2', data, layout);
          </script>
        </body>
      </html>
    </xsl:result-document>
    
    
    <xsl:result-document href="../analyses/ls-structure_terms-per-series.csv" method="text">
      <xsl:text>series-id,number-of-terms</xsl:text><xsl:text>
</xsl:text>
      <xsl:for-each select="//event[@type='lecture-series']">
        <xsl:value-of select="@xml:id"/><xsl:text>,</xsl:text>
        <xsl:value-of select="count(event[@type='lecture-series-term'])"/>
        <xsl:if test="position()!=last()"><xsl:text>
</xsl:text></xsl:if>
      </xsl:for-each>
    </xsl:result-document>
    
    
    <xsl:result-document href="../analyses/ls-structure_lectures-per-term.csv" method="text">
      <xsl:text>series-id,term-id,number-of-lectures</xsl:text><xsl:text>
</xsl:text>
      <xsl:for-each select="//event[@type='lecture-series']">
        <xsl:for-each select="event[@type='lecture-series-term']">
          <xsl:value-of select="parent::event[@type='lecture-series']/@xml:id"/><xsl:text>,</xsl:text>
          <xsl:value-of select="@xml:id"/><xsl:text>,</xsl:text>
          <xsl:value-of select="count(event[@type='lecture'])"/>
          <xsl:if test="position()!=last()"><xsl:text>
</xsl:text></xsl:if>
        </xsl:for-each>
        <xsl:if test="position()!=last()"><xsl:text>
</xsl:text></xsl:if>
      </xsl:for-each>
    </xsl:result-document>
  </xsl:template>
  
</xsl:stylesheet>