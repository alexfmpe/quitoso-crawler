
var fs        = require("fs")
var util      = require("util")
var jsdom     = require("jsdom")
var extend    = require("extend")
var Promise   = require("bluebird")
var escape    = require("escape-string-regexp")
var innerText = require('text-content')

Promise.promisifyAll(fs)
Promise.promisifyAll(jsdom)

var page   = 'http://www.dgav.pt/fitofarmaceuticos/guia/finalidades_guia/Outros/Nematodicidas/tabaco.htm'
var root    = "http://www.dgv.min-agricultura.pt/portal/page/portal/DGV/genericos?generico=4183425&cboui=4183425"
var roots = [
  /*
  ['INSECTICIDAS E FUNGICIDAS', 'Culturas',                           "http://www.dgav.pt/fitofarmaceuticos/guia/Introd_guia/insect_fung_culturas.htm"    ],
  ['INSECTICIDAS E FUNGICIDAS', 'Florestais',                         "http://www.dgav.pt/fitofarmaceuticos/guia/Introd_guia/insect_fung_florest.htm"     ],
  ['INSECTICIDAS E FUNGICIDAS', 'Ornamentais',                        "http://www.dgav.pt/fitofarmaceuticos/guia/Introd_guia/insect_fung_ornam.htm"       ],
  ['INSECTICIDAS E FUNGICIDAS', 'Tratamento de Produtos Armazenados', "http://www.dgav.pt/fitofarmaceuticos/guia/Introd_guia/insect_fung_prod_armz.htm"   ],
  ['INSECTICIDAS E FUNGICIDAS', 'Tratamento de Sementes',             "http://www.dgav.pt/fitofarmaceuticos/guia/Introd_guia/insect_fung_tratsem.htm"     ],
  ['INSECTICIDAS E FUNGICIDAS', 'Outros Tratamentos',                 "http://www.dgav.pt/fitofarmaceuticos/guia/Introd_guia/insect_fung_outr_tratm.htm"  ],
  ['Atrativos',                 '',                                   "http://www.dgav.pt/fitofarmaceuticos/guia/Introd_guia/outros_atractivos.htm"       ],
  */
  ['Moluscicidas',              '',                                   "http://www.dgav.pt/fitofarmaceuticos/guia/Introd_guia/outros_moluscicidas.htm"     ],
  ['Nematodicidas ',            '',                                   "http://www.dgav.pt/fitofarmaceuticos/guia/Introd_guia/outros_nematodicidas.htm"    ],
  /*
  ['Repulsivos',                '',                                   "http://www.dgav.pt/fitofarmaceuticos/guia/Introd_guia/outros_repulsivos.htm"       ],
  ['Rodenticidas',              '',                                   "http://www.dgav.pt/fitofarmaceuticos/guia/Introd_guia/outros_rodenticidas.htm"     ],
  ['HERBICIDAS',                '',                                   "http://www.dgav.pt/fitofarmaceuticos/guia/Introd_guia/herbicidas_guia.htm"         ],
//['ignore',                    '',                                   "http://www.dgav.pt/fitofarmaceuticos/guia/Introd_guia/reg_cresc_guia.htm"          ],
  */
].map(function (row) {
  var [a, f, u] = row
  return {
    application:  a,
    family:       f,
    url:          u,
  }
})

var scripts = ["http://code.jquery.com/jquery.js"]
var config  = { encoding: "binary" }

var errFile    = 'fito.txt'
var outputFile = 'fito.json'
var production = !true
var singlePage = true
var total_delay = 0
var fetch_delay = 1000

var show = util.inspect
var update = data => target => extend(target, data)

var MESSAGES = {
  loadError       : "Error when loading page and/or jQuery",
  multipleTables  : "Multiple tables",
  zeroTables      : "No tables found"
}
var NODE_TYPES  = {
  TEXT_NODE     : 3
}
var columns = 'infestant substance formulation dosage days'.split(/\s+/)
var isTextNode = n => n.nodeType == NODE_TYPES.TEXT_NODE
var isReallyText = n => isTextNode(n) && !n.textContent.trim().startsWith('<!--')


main()

function main() {
  map([errFile, outputFile], clear)
  debugWarning()
/*
  var group = 'http://www.dgav.pt/fitofarmaceuticos/guia/Introd_guia/herbicidas_guia.htm'
  fetch(group).then(parseGroup).then(id).then(output)
*/
  //Promise.all(map(roots, parseRoot)).then(flatten).then(changeNames).then(output)
  fetch(page).then(parsePage).then(output)
}

function parseRoot(root) {
  var newFields = {
    family: root.family,
    application: root.application
  }

  return fetch(root.url).then(parseGroup).then(group => map(group, update(newFields)))
}

function fetch(url) {
  total_delay += fetch_delay
  var my_delay = total_delay

  console.log('scheduled for ' + (my_delay / 1000) + 's\t@ ' + url)
  var d = delay(my_delay)

  return d.then(function() {
    console.log('requesting ' + url)
    return jsdom.envAsync(url, scripts, config)
    })
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
  return fs.appendFileSync(outputFile, show(json) + '\n')
}

function log(e, cause) {
  var text = e + (cause ? "\n @ " + cause : '') + "\n"
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

function GTFO(e, cause) {
  log("GTFO " + e + "\n" + cause)
  process.exit(1)
}

function relativeURL(origin, path) {
  var parent = origin.match((/(.*\/)+/))[0]
  return parent + path
}

function parseGroup(window) {
  var $ = window.$
  var title = $('*').filter(isReallyText)[0]
  var family
  var rows = $("tr")
  return Promise.all(map(rows, parseRow)).then(flatten)

  function parseRow(tr) {
    var cells = $("td", tr)

    var [horticulture, date] = cells.toArray()
    if(! /\w+/.test(horticulture.textContent)) return purePromise([]);

    var href = $('a', horticulture).attr("href")
    var url = relativeURL(window.location.href, href)

    function donegoofed(e) {
      log(e, url)
    }

    return fetch(url).then(parsePage).catch(donegoofed)
  }
}

function textBetween($, start, stop) {
  var between = slice($("*"), start, stop)
  var texts = flatMap(between, e => filter(e.childNodes, isReallyText))
  return $(texts).text()
}

function parsePage(window) {
  var $           = window.$
  var url         = window.location.href
  var all         = $('*')
  var firstIndex  = all.index($('body'))
  var previous    = undefined

  var tables = $("table")
  var [startIndexes, endIndexes] = unzip(map(tables, tagIndexes))
  var intervals = zip(concat([firstIndex], endIndexes), startIndexes)
  var titles = map(intervals, i => textBetween($, i[0], i[1]).trimAll())
  var obs = parseObservations()
  console.log(obs)

  if(tables.length > 1)     log(MESSAGES.multipleTables, url)
  if(tables.length == 0)    log(MESSAGES.zeroTables,     url)

  return flatMap(zip(tables, titles), parseTable)

  function tagIndexes(e) {
    var start = all.index(e)
    var end = start + 1 + $(e).find('*').size()
    return [start, end]
  }

  function numberedObservations(xs) {
    return xs.map((x,i) => "(" + (i+1) + ") " + x)
  }

  function parseObservations() {
    var everything  = window.document.body.textContent
    var start       = "Observações:"
    var end         = escape(last($('a')).textContent)
    var anything    = "[^]*"
    var flags       = "i"
    var capture     = "(" + anything + ")"
    var regexp      = new RegExp(start + capture + end, flags)
    var match       = everything.match(regexp)
    var obs         = match == null ? "" : match[1]
    var list        = slice(obs.split(/^\d+[.]/gim), 1)
    list = list.concat(map($('ol li'), e => e.textContent))
/*
    if(list.length == 0)
        list = map($('ol li'), e => e.textContent)
        */
    console.log(list)
    return list.map((x,i) => "(" + (i+1) + ") " + x.trimAll())
  }

  function parseTable(table, title) {
    var rows = prune(map($("tr", table).next(), parseRow))
    return map(rows, update({culture: title}))
  }

  function parseRow(tr) {
    if(tr.textContent.trimAll() == "") return;
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
      observations  : observations == undefined ? '' : observations.textContent.trimAll(),
    }

    map(columns, c => h[c] = h[c].textContent.trimAll())

    previous = previous || h
    h.infestant    = h.infestant    || previous.infestant
    h.substance    = h.substance    || previous.substance
    h.substanceURL = h.substanceURL || previous.substanceURL
    previous = h
    map(columns, addObservations)

    function addObservations(column) {
        var matches = h[column].match(/\(\d+\)/g) || []
        var numbers = matches.map(s => s.slice(1, -1)).map(Number)
        map(numbers, n => h.observations += obs[n-1])
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

function purePromise(x) {
  return new Promise((resolve, request) => resolve(x))
}

function delay(ms) {
    var deferred = Promise.pending();
    setTimeout(function(){
	    deferred.resolve();
	}, ms);
    return deferred.promise;
}
