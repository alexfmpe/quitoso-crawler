var jsdom = require("jsdom")

var root  = "http://www.dgv.min-agricultura.pt/portal/page/portal/DGV/genericos?generico=4183425&cboui=4183425"
var group = "http://www.dgav.pt/fitofarmaceuticos/guia/Introd_guia/herbicidas_guia.htm"
//var url = "http://www.dgav.pt/fitofarmaceuticos/guia/finalidades_guia/Herbicidas/tomateiro1.htm"
var scripts = ["http://code.jquery.com/jquery.js"]
var config = { encoding: "binary" }

var log = console.log
var ERROR = {
  multipleTables : "GTFO: Found more than one <table> on page"
}

main()


function fetch(url, callback) {
    jsdom.env(url, scripts, config, callback)
}

function main() {
  fetch(group, parseGroup)
}

function GTFO(e) {
  log(e)
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

function parseHorticulture(err, window) {
  var $ = window.$
  var _infestant = ""
  var _substance = ""

  log(window.location.href)
  if($("table").length > 1)   {
    log(window.location.href + "\t" + ERROR.multipleTables);
    return;
  }
  $("tr").each(parseRow)

  function parseRow(i, tr) {
    var cells = $("td", tr)
    var horticulture = Horticulture.factoryApply(cells.toArray())
    log("===")
    log(_substance.textContent.trim())
  }

  function Horticulture(infestant, substance, formulation, dosage, days, notes) {
    //log(substance.textContent)
    _infestant = infestant.textContent.trim() == "" ? _infestant : infestant
    _substance = substance.textContent.trim() == "" ? _substance : substance

    this.infestant = infestant
    this.substance = substance
    this.formulation = formulation
    this.dosage = dosage
    this.days = days
    this.notes = notes
  }
}

//kinda should not slice because V8 is a crybaby
function arguments2array(args) {
  return [].slice.call(args, 0, args.length)
}

Function.prototype.factory =
    function(/* arguments */) {
      return Function.prototype.factoryApply.call(this, arguments2array(arguments))
    }


Function.prototype.factoryApply =
  function(args) {
    var fact = Function.prototype.bind.apply(this, [{}].concat(args))
    return new fact()
  }
