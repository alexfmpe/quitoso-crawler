
var fs        = require("fs")
var util      = require("util")
var jsdom     = require("jsdom")
var extend    = require("extend")
var Promise   = require("bluebird")
var escape    = require("escape-string-regexp")
var innerText = require('text-content')


Promise.promisifyAll(fs)
Promise.promisifyAll(jsdom)

var root    = "http://www.dgv.min-agricultura.pt/portal/page/portal/DGV/genericos?generico=4183425&cboui=4183425"
var group   = "http://www.dgav.pt/fitofarmaceuticos/guia/Introd_guia/insect_fung_culturas.htm"
//var page    = "http://www.dgav.pt/fitofarmaceuticos/guia/finalidades_guia/Herbicidas/florestas.htm"
var page    = "http://www.dgav.pt/fitofarmaceuticos/guia/Introd_guia/../finalidades_guia/Insec&Fung/Culturas/milho.htm"
var scripts = ["http://code.jquery.com/jquery.js"]
var config  = { encoding: "binary" }

var production = !true
var singlePage = !true

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

var output = console.log
var columns = 'infestant substance formulation dosage days'.split(/\s+/)

main()


function main() {
  debugWarning()
  if(!singlePage) fetch(group).then(parseGroup).then(output).then(debugWarning)
  else            fetch(page).then(parsePage).then(output).then(debugWarning)
}

function debugWarning() {
  log("===============================")
  log("WARNING: NOT IN PRODUCTION MODE")
  log("===============================")
}

function fetch(url) {
  return jsdom.envAsync(url, scripts, config)
}



function log(x) {
  if(!production) output(x)
}
function note(e, cause) {
  console.error("NOTE: " + e + "\n @ " + cause + "\n")
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
  var rows = $("tr")
  //rows = slice(rows, 0, 5)
  return Promise.all(map(rows, parseRow)).then(flatten)

  function parseRow(tr) {
    var cells = $("td", tr)

    var [horticulture, date] = cells.toArray()
    if(! /\w+/.test(horticulture.textContent)) return purePromise([]);

    var href = $('a', horticulture).attr("href")
    var url = relativeURL(window.location.href, href)

    function donegoofed(e) {
      note(e, url)
    }

    return fetch(url).then(parsePage).catch(donegoofed)
  }
}

function textBetween($, start, stop) {
  var isTextNode = n => n.nodeType == NODE_TYPES.TEXT_NODE
  var isReallyText = n => isTextNode(n) && !n.textContent.trim().startsWith('<!--')
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

  if(tables.length > 1)     note(MESSAGES.multipleTables, url)
  if(tables.length == 0)    note(MESSAGES.zeroTables,     url)

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
      substanceURL  : href == '' ? '' : relativeURL(url, href),
      formulation   : formulation,
      dosage        : dosage,
      days          : days,
      observations  : observations || '',
    }

    map(columns, c => h[c] = h[c].textContent.trimAll())

    previous = previous || h
    h.infestant = h.infestant || previous.infestant
    h.substance = h.substance || previous.substance
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
