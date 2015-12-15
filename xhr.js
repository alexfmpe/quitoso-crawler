var jsdom = require("jsdom")
var url = "http://www.dgav.pt/fitofarmaceuticos/guia/finalidades_guia/Herbicidas/tomateiro1.htm"
var log = console.log
var ERROR = {
  multipleTables : "GTFO: Found more than one <table> on page"
}

main()

function main() {
  var scripts = ["http://code.jquery.com/jquery.js"]
  var config = { encoding: "binary" }
  jsdom.env(url, scripts, config, parseTable);
}

function GTFO(e) {
  log(e)
  process.exit(1)
}

function parseTable(err, window) {
  var $ = window.$
  var _infestant = ""
  var _substance = ""

  if($("table").length > 1)   GTFO(ERROR.multipleTables);
  $("tr").each(parseRow)

  function parseRow(i, tr) {
    var cells = $("td", tr)
    var [infestant, substance, formulation, dosage, days, notes] = cells.toArray()
    _infestant = infestant.textContent.trim() == "" ? _infestant : infestant
    _substance = substance.textContent.trim() == "" ? _substance : substance
    var entry = new Entry(_infestant, _substance, formulation, dosage, days, notes)
    log(entry.notes.textContent)
  }
}

function Entry(infestant, substance, formulation, dosage, days, notes) {
  this.infestant = infestant
  this.substance = substance
  this.formulation = formulation
  this.dosage = dosage
  this.days = days
  this.notes = notes
}
