var fs        = require("fs")
var util      = require("util")
var extend    = require("extend")
var request   = require('request-promise');
var errors    = require('request-promise/errors');
var cheerio   = require('cheerio');
var Promise   = require("bluebird")
var escape    = require("escape-string-regexp")
var innerText = require('text-content')

Promise.promisifyAll(fs)

var startTime = Date.now()
var page  = 'http://www.dgav.pt/fitofarmaceuticos/guia/finalidades_guia/Outros/Nematodicidas/tabaco.htm'
page = 'http://www.dgav.pt/fitofarmaceuticos/guia/finalidades_guia/Insec&Fung/Culturas/cv%20frisada.htm'
var group = 'http://www.dgav.pt/fitofarmaceuticos/guia/Introd_guia/herbicidas_guia.htm'
var root  = "http://www.dgv.min-agricultura.pt/portal/page/portal/DGV/genericos?generico=4183425&cboui=4183425"
var roots = [
  ['INSECTICIDAS E FUNGICIDAS', 'Culturas',                           "http://www.dgav.pt/fitofarmaceuticos/guia/Introd_guia/insect_fung_culturas.htm"    ],
  ['INSECTICIDAS E FUNGICIDAS', 'Florestais',                         "http://www.dgav.pt/fitofarmaceuticos/guia/Introd_guia/insect_fung_florest.htm"     ],
  ['INSECTICIDAS E FUNGICIDAS', 'Ornamentais',                        "http://www.dgav.pt/fitofarmaceuticos/guia/Introd_guia/insect_fung_ornam.htm"       ],
  ['INSECTICIDAS E FUNGICIDAS', 'Tratamento de Produtos Armazenados', "http://www.dgav.pt/fitofarmaceuticos/guia/Introd_guia/insect_fung_prod_armz.htm"   ],
  ['INSECTICIDAS E FUNGICIDAS', 'Tratamento de Sementes',             "http://www.dgav.pt/fitofarmaceuticos/guia/Introd_guia/insect_fung_tratsem.htm"     ],
  ['INSECTICIDAS E FUNGICIDAS', 'Outros Tratamentos',                 "http://www.dgav.pt/fitofarmaceuticos/guia/Introd_guia/insect_fung_outr_tratm.htm"  ],
  ['Atrativos',                 '',                                   "http://www.dgav.pt/fitofarmaceuticos/guia/Introd_guia/outros_atractivos.htm"       ],
  ['Moluscicidas',              '',                                   "http://www.dgav.pt/fitofarmaceuticos/guia/Introd_guia/outros_moluscicidas.htm"     ],
  ['Nematodicidas ',            '',                                   "http://www.dgav.pt/fitofarmaceuticos/guia/Introd_guia/outros_nematodicidas.htm"    ],
  ['Repulsivos',                '',                                   "http://www.dgav.pt/fitofarmaceuticos/guia/Introd_guia/outros_repulsivos.htm"       ],
  ['Rodenticidas',              '',                                   "http://www.dgav.pt/fitofarmaceuticos/guia/Introd_guia/outros_rodenticidas.htm"     ],
  ['HERBICIDAS',                '',                                   "http://www.dgav.pt/fitofarmaceuticos/guia/Introd_guia/herbicidas_guia.htm"         ],
//['ignore',                    '',                                   "http://www.dgav.pt/fitofarmaceuticos/guia/Introd_guia/reg_cresc_guia.htm"          ],

].map(function (row) {
  var [a, f, u] = row
  return {
    application:  a,
    family:       f,
    url:          u,
  }
})

var scripts = ["http://code.jquery.com/jquery.js"]

var errFile    = 'fito.txt'
var outputFile = 'fito.json'
var production = !true
var singlePage = true
var total_delay = 0
var start_delay = 0
var incr_delay  = 100

var update = data => target => extend(target, data)

var MESSAGES = {
  loadError       : "Error when loading page and/or jQuery",
  multipleTables  : "Multiple tables",
  zeroTables      : "No tables found"
}
var NODE_TYPES  = {
  TEXT_NODE     : 3
}
var counts = {}

var columns = 'infestant substance formulation dosage days'.split(/\s+/)
var isTextNode = n => n.nodeType == NODE_TYPES.TEXT_NODE
var isReallyText = $ => n => isTextNode(n) && !$(n).text().trim().startsWith('<!--')


main()

function main() {
  map([errFile, outputFile], clear)
  debugWarning()
  //Promise.all(map(roots, parseRoot)).then(flatten).then(changeNames).then(output)
  //fetch(group).then(parseGroup).then(id).then(output)
  fetchPage(page).then(output)
}

//function fetchRoot()    { fetch(root).then(parseRoot).catch(fetchRoot) }
//function fetchGroup()   { fetch(root).then(parseRoot).catch(fetchRoot) }
function fetchPage(url) {
  return fetch(url)
    .then(parsePage)
    .catch(errors.StatusCodeError,
      function(e) {
        log(e.statusCode, url)
        return []
      })
    .catch(() => fetchPage(url))
  }

function parseRoot(root) {
  var newFields = {
    family: root.family,
    application: root.application
  }

  return fetch(root.url).then(parseGroup).then(group => map(group, update(newFields)))
}

function fetch(url) {
  counts[url] = counts[url] || 0
  total_delay += start_delay + incr_delay * counts[url]
  counts[url]++
  count = counts[url]
  var my_delay = Math.max(0, startTime + total_delay - Date.now())

  function req() {
    var options = {
      uri: url,
      encoding: 'binary',
    }
    console.log('request #' + count + ' for\t' + url)
    return request(options).then(body => [cheerio.load(body), url])
  }

  console.log('scheduled for ' + (total_delay/1000) + '(' + (my_delay/1000) + ')s\t@ ' + url)
  return Promise.delay(my_delay).then(req)//.catch(() => fetch(url))
}

function changeNames(horticultures) {
  return map(horticultures, function(h) { return {
    familia_aplicacao : h.family,
    aplicacao         : h.application,
    cultura           : h.culture,
    praga_doenca      : h.infestant,
    substancia        : h.substance,
    substancia_link   : h.substanceURL,
    formulacao        : h.formulation,
    dose              : h.dosage,
    int_seguranca     : h.days,
    observacoes       : h.observations
  }})
}

function clear(file) {
  fs.writeFileSync(file, '')
}

function output(json) {
  return fs.appendFileSync(outputFile, JSON.stringify(json, undefined, ' ') + '\n')
}

function log(e, url) {
  var text = e + (url ? "\n @ " + url : '') + "\n"
  fs.appendFileSync(errFile, text)
}

function debug(x) {
  if(!production) log(x)
}

function debugWarning() {
  debug("===============================")
  debug("WARNING: NOT IN PRODUCTION MODE")
  debug("===============================")
}

function relativeURL(origin, path) {
  var parent = origin.match((/(.*\/)+/))[0]
  return parent + path
}

function parseGroup(args) {
  var [$, url] = args
//  var $ = window.$
  var title = $('*').filter(isReallyText($))[0]
  var family
  var rows = $("tr")
  return Promise.all(map(rows, parseRow)).then(flatten)

  function parseRow(tr) {
    var cells = $("td", tr)

    var [horticulture, date] = cells.toArray()
    if(! /\w+/.test($(horticulture).text())) return Promise.resolve([]);

    var href = $('a', horticulture).attr("href")
    var page = relativeURL(url, href)

    return fetchPage(page)
  }
}

function textBetween($, start, stop) {
  var between = slice($("*"), start, stop)
  var t = between[0].childNodes[0]
  var texts = flatMap(between, e => filter(e.childNodes, isReallyText($)))
  return $(texts).text()
}

function parsePage(args) {
  var [$, url] = args
//  var $           = window.$
//  var url         = window.location.href
  var all         = $('*')
  var firstIndex  = all.index($('body'))
  var previous    = undefined

  console.log('processing\t' + url)

  var tables = $("table")
  var [startIndexes, endIndexes] = unzip(map(tables, tagIndexes))
  var intervals = zip(concat([firstIndex], endIndexes), startIndexes)
  var titles = map(intervals, i => textBetween($, i[0], i[1]).trimAll())
  var obs = parseObservations()

  if(tables.length > 1)     log(MESSAGES.multipleTables, url)
  if(tables.length == 0)    log(MESSAGES.zeroTables,     url)

  return flatMap(zip(tables, titles), parseTable)

  function tagIndexes(e) {
    var start = all.index(e)
    var end = start + 1 + $(e).find('*').length
    return [start, end]
  }

  function numberedObservations(xs) {
    return xs.map((x,i) => "(" + (i+1) + ") " + x)
  }

  function parseObservations() {
    var everything  = $('*').text()
    var start       = "Observações:"
    var end         = escape($(last($('a'))).text())
    var anything    = "[^]*"
    var flags       = "i"
    var capture     = "(" + anything + ")"
    var regexp      = new RegExp(start + capture + end, flags)
    var match       = everything.match(regexp)
    var obs         = match == null ? "" : match[1]
    var list        = slice(obs.split(/^\d+[.]/gim), 1)
    list = list.concat(map($('ol li'), e => $(e).text()))
    return list.map((x,i) => "(" + (i+1) + ") " + x.trimAll())
  }

  function parseTable(table, title) {
    var rows = prune(map($("tr", table).next(), parseRow))
    return map(rows, update({culture: title}))
  }

  function parseRow(tr) {
    if($(tr).text().trimAll() == "") return;
    var cells = $("td", tr).toArray()

    var href = $('a', cells[1]).attr('href')
    var [infestant, substance, formulation, dosage, days, observations] = cells

    var h = {
      infestant     : infestant,
      substance     : substance,
      substanceURL  : href == undefined ? '' : relativeURL(url, href),
      formulation   : formulation,
      dosage        : dosage,
      days          : days,
      observations  : observations == undefined ? '' : $(observations).text().trimAll(),
    }

    map(columns, c => h[c] = $(h[c]).text().trimAll())

    previous = previous || h
    h.infestant    = h.infestant    || previous.infestant
    h.substance    = h.substance    || previous.substance
    h.substanceURL = h.substanceURL || previous.substanceURL
    previous = h
    map(columns, addObservations)

    function addObservations(column) {
        var matches = h[column].match(/\(\d+\)/g) || []
        var numbers = matches.map(s => s.slice(1, -1)).map(Number)
        map(numbers, n => h.observations += (obs[n-1] || ''))
    }

    return h
  }
}

//kinda should not slice because V8 is a crybaby
function arguments2array(args) {
  return [].slice.call(args, 0, args.length)
}

Function.prototype.factory = function(/* arguments */) {
  return Function.prototype.factoryApply.call(this, arguments2array(arguments))
}

Function.prototype.factoryApply = function(args) {
  var fact = Function.prototype.bind.apply(this, [{}].concat(args))
  return new fact()
}

String.prototype.trimAll = function() {
  return this.replace(/\s+/g, " ").trim()
}

function id(x) {
  return x
}

function zip(xs, ys) {
  var arr = []
  var len = Math.min(xs.length, ys.length)
  for(var i = 0; i < len; i++)
    arr.push([xs[i], ys[i]])
  return arr
}

function unzip(xys) {
  var xs = []
  var ys = []
  for(var i = 0; i < xys.length; i++) {
    xs.push(xys[i][0])
    ys.push(xys[i][1])
  }
  return [xs,ys]
}

function map(xs, f) {
  var f_ = f.length > 1 ? (args => f.apply(null, args)) : f
  var map_ = [].slice.call(xs).map.bind(xs)

  return map_(f_)
}

function flatten(xxs) {
  return flatMap(xxs, id)
}

function flatMap(xs, f) {
  return Array.prototype.concat.apply([], map(xs, f))
}

function slice(xs, start, end) {
  return map(xs, id).slice(start, end)
}

function prune(xs) {
  return xs.map(id).filter(s => s != undefined)
}

function filter(xs, p) {
  return prune(map(xs, x => p(x) ? x : undefined))
}

function concat() {
  return Array.prototype.concat.apply([], map(arguments, id))
}

function last(xs) {
  var arr = map(xs, id)
  return arr[arr.length - 1]
}
