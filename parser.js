var jsdom = require("jsdom")

var root    = "http://www.dgv.min-agricultura.pt/portal/page/portal/DGV/genericos?generico=4183425&cboui=4183425"
var group   = "http://www.dgav.pt/fitofarmaceuticos/guia/Introd_guia/insect_fung_culturas.htm"
var page    = "http://www.dgav.pt/fitofarmaceuticos/guia/finalidades_guia/Insec&Fung/Culturas/videira.htm"
var scripts = ["http://code.jquery.com/jquery.js"]
var config  = { encoding: "binary" }

var log = console.log

var MESSAGES = {
  loadError       : "Error when loading page and/or jQuery",
  multipleTables  : "Multiple tables",
  zeroTables      : "No tables found"
}
var NODE_TYPES  = {
  TEXT_NODE     : 3
}

main()

function main() {
  //fetch(group, parseGroup)
  fetch(page, parsePage)
}

function fetch(url, callback) {
  jsdom.env(url, scripts, config, callback)
}

function note(e, cause) {
  log("NOTE: " + e + "\n" + cause)
}
function GTFO(e, cause) {
  log("GTFO " + e + "\n" + cause)
  process.exit(1)
}

function relativeURL(origin, path) {
  var parent = origin.match((/(.*\/)+/))[0]
  return parent + path
}

function parseGroup(err, window) {
  var $ = window.$
  if(err) GTFO(MESSAGES.loadError, err)
  map($("tr"), parseRow)

  function parseRow(tr) {
    var rows = $("td", tr)
    var [horticulture, date] = rows.toArray()
    if(! /\w+/.test(horticulture.textContent)) return;

    var href = $('a', horticulture).attr("href")
    var url = relativeURL(window.location.href, href)
    fetch(url, parsePage)
  }
}

function textBetween($, start, stop) {
  var between = slice($("*"), start, stop)
  var texts = flatMap(between, e => filter(e.childNodes, c => c.nodeType == NODE_TYPES.TEXT_NODE))
  return $(texts).text()
}

function parsePage(err, window) {
  if(err) GTFO(MESSAGES.loadError, err)

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

  log(titles)
  log(url)
  log(numberedObservations(obs))

  if(tables.length > 1)     note(MESSAGES.multipleTables, url)
  if(tables.length == 0)    note(MESSAGES.zeroTables,     url)
  map(zip(tables, titles), parseTable)

  function tagIndexes(e) {
    var start = all.index(e)
    var end = start + 1 + $(e).find('*').size()
    return [start, end]
  }

  function numberedObservations(xs) {
    return xs.map((x,i) => "(" + (i+1) + ") " + x).join('\n')
  }

  function parseObservations() {
    var everything  = window.document.body.textContent
    var start       = "Observações:"
    var end         = "Voltar a Guia de Condições"
    var anything    = "[^]*"
    var flags       = "i"
    var capture     = "(" + anything + ")"
    var regexp      = new RegExp(start + capture + end, flags)
    var obs         = everything.match(regexp)[1]
    var list        = slice(obs.split(/^\d+[.]/gim), 1)
    return map(list, l => l.trimAll())
  }

  function parseTable(table, title) {
    var rows = prune(map($("tr", table).next(), parseRow))
    map(rows, r => log(title + "\t" + r.toCSV()))
  }

  function parseRow(tr) {
    if(tr.textContent.trimAll() == "") return;
    var cells = $("td", tr)

    var h = Horticulture.factoryApply(cells.toArray())
    previous = previous || h
    if("" == h.infestant.textContent.trim()) h.infestant = previous.infestant
    if("" == h.substance.textContent.trim()) h.substance = previous.substance
    previous = h

    return h
  }
}

function Horticulture(infestant, substance, formulation, dosage, days, notes) {
  this.infestant = infestant
  this.substance = substance
  this.formulation = formulation
  this.dosage = dosage
  this.days = days
  this.notes = notes
}
Horticulture.prototype.columns = function() { return Object.keys(this) }
Horticulture.prototype.toCSV = function() {
  var values = prune(map(this.columns(), c => this[c]))
  return map(values, v => v.textContent.trimAll()).join(",")
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
