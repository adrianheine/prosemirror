function getStripLoc(f) {
  return function stripLoc(obj) {
    delete obj.loc
    if (obj.properties) {
      Object.keys(obj.properties).forEach(function (k) {
        obj.properties[k].name = k
      })
    }
    if (obj.type === 'Function' && !obj.returns) {
      obj.returns = { type: "void" }
    }
    if (f) {
      obj.type = f(obj.type, function(type) {
        return parse(type, f)
      })
    }
    return obj
  }
}

function mapTree(fn, obj) {
  var doMap = mapTree.bind(null, fn)
  var mapped = fn(obj)
  if (mapped.params) Object.keys(mapped.params).forEach(function (k) {
    mapped.params[k] = doMap(mapped.params[k])
  })
  if (mapped.properties) Object.keys(mapped.properties).forEach(function (k) {
    mapped.properties[k] = doMap(mapped.properties[k])
  })
  if (mapped.content) mapped.content = mapped.content.map(doMap)
  if (mapped.returns) mapped.returns = doMap(mapped.returns)
  return mapped
}

var _parse = require("getdocs/src/parsetype")
var parse = function (str, f) {
  var d = _parse(str, 0, {file: "", line: str})
  return mapTree(getStripLoc(f), d.type)
}

exports.parse = parse
