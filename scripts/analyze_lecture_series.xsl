<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:xs="http://www.w3.org/2001/XMLSchema"
  xmlns:math="http://www.w3.org/2005/xpath-functions/math"
  exclude-result-prefixes="xs math" xmlns:local="local"
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
    
    - Inclusion of all recorded lecture series
    - Removal of fixed temporal restrictions
    - Dynamic determination of the annual analysis range
    - Retention of undated lectures in the general corpus
      Annual analyses exclude lectures without an evaluable year
    - Annual lecture counts exported as JSON; the original format
      predicates are retained. Counts include canceled records
    - Unclassified and overlapping format assignments are reported
    - Annual audience participation is analyzed separately from speech
      Canceled records without an audience term are reported separately;
      other unclassified records and multiple recognized categories are counted
    - Other legacy analyses are retained but not executed by default
    
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
      'audiencePerYear': array { $annual-audience }
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