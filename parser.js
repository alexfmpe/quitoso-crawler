var jsdom = require("jsdom")

var root    = "http://www.dgv.min-agricultura.pt/portal/page/portal/DGV/genericos?generico=4183425&cboui=4183425"
var group   = "http://www.dgav.pt/fitofarmaceuticos/guia/Introd_guia/herbicidas_guia.htm"
//var page  = "http://www.dgav.pt/fitofarmaceuticos/guia/finalidades_guia/Herbicidas/tomateiro1.htm"
var page    = "http://www.dgav.pt/fitofarmaceuticos/guia/finalidades_guia/Herbicidas/florestas.htm"
var scripts = ["http://code.jquery.com/jquery.js"]
var config  = { encoding: "binary" }

var log = console.log
var ERROR = {
  multipleTables : "Found more than one <table> on page"
}

main()

function main() {
  fetch(group, parseGroup)
  //fetch(page, parseHorticulture)
}

function fetch(url, callback) {
    jsdom.env(url, scripts, config, callback)
}

function GTFO(e) {
  log("GTFO: " + e)
  process.exit(1)
}

function relativeURL(origin, path) {
  var parent = origin.match((/(.*\/)+/))[0]
  return parent + path
}

function parseGroup(err, window) {
  window.$("tr").each(parseRow)

  function parseRow(i, tr) {
    var rows = window.$("td", tr)
    var [horticulture, date] = rows.toArray()
    if(! /\w+/.test(horticulture.textContent)) return;

    var href = window.$('a', horticulture).attr("href")
    var url = relativeURL(window.location.href, href)
    fetch(url, parseHorticulture)
  }
}

function textBetween($, start, stop) {
  var id = x => x
  var between = JQ.map($("*").slice(start,stop), (i,e) => e)
  var texts = between.flatMap(e => map(e.childNodes, id).filter(c => c.nodeType == 3))
  return $(texts).text().trimAll()
}

function tagIndexes($, e) {
  var start = $(e).index('*')
  var end = start + 1 + $(e).find('*').size()
  return [start, end]
}

function parseHorticulture(err, window) {
  var $ = window.$
  var rootIndex = $('body').index('*')
  var previous = undefined

  var tables = $("table")

  var [startIndexes, endIndexes] = unzip(JQ.map(tables, (i,e) => tagIndexes($, e)))
  var intervals = zip([rootIndex].concat(endIndexes), startIndexes)
  var titles = intervals.map(i => textBetween.call(null, $, i[0], i[1]))

/*
  log(startIndexes)
  log(endIndexes)
  log(intervals)
*/
  if(titles.length != 1)
    log(window.location.href)

  //titles.forEach(log)
  log(titles)


  var rows = JQ.map($("tr").next(), parseRow).prune()
  //rows.forEach(r => log(r.toCSV()))

  function parseRow(i, tr) {
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
Horticulture.prototype.toCSV = function() { return this.columns().map(c => this[c].textContent.trimAll()).join(",") }

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

Array.prototype.prune = function() {
  return this.filter(s => s != undefined)
}

Array.prototype.flatMap = function(lambda) {
  return Array.prototype.concat.apply([], this.map(lambda));
}

var JQ = {
  map : function(jQueryObj, f) {
    var arr = []

    function ff(index, element) {
      var res = f(index, element)
      arr.push(res)
    }

    jQueryObj.each(ff)
    return arr
  }
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
  return [].slice.call(xs).map(f)
}