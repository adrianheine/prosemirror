"use strict"

var mapType = exports.mapType = function mapType(str) {
  var match;
  if (str === "bool") {
    str += "ean"
  }
  if (str === "null") {
    str = "void"
  }
  if (str === "*") {
    str = "any"
  }
  if (str === "()") {
    // FIXME: void?
    str = "(): any";
  }
  if (str === "DOMDocument") {
    str = 'typeof _' + str
  }
  if (str === "DOMEvent") {
    str = 'typeof _' + str
  }
  if (str === "DOMFragment") {
    str = 'typeof _' + str
  }
  if (str === "DOMNode") {
    str = 'typeof _' + str
  }
  return str;
}

function simpleToString(data) {
  return parsedToString(data)
}

var parsedToString = exports.parsedToString = function parsedToString(data, isRootFn) {
  if (typeof data === 'string') {
    return mapType(data)
  }
  var main = ''
  switch (data.type) {
    case "Function":
      if (!data.params) {
        // "Function" used as type
        main = "Function"
        break
      }
      var n = 0;
      main = "(" + data.params.map(function (d) {
        var d2 = Object.create(d)
        d2.name = d2.name || "_" + (n++)
        return parsedToString(d2)
      }).join(', ') + ")" + (isRootFn ? (data.returns.type !== "void" ? ": " + parsedToString(data.returns) : "") : " => " + parsedToString(data.returns))
      break;
    case "union":
      main = data.content.map(simpleToString).map(function (v) { return '(' + v + ')' }).join(' | ')
      break;
    case "Object":
      if (data.properties) {
        main = "{" + Object.keys(data.properties).map(function (k) {
          return parsedToString(data.properties[k])
        }).join(', ') + "}"
      } else if (data.content) {
        main = "{[key: string]: " + data.content.map(simpleToString).join(', ') + "}"
      } else {
        main = "Object"
      }
      break;
    case "constructor":
      main = "typeof " + parsedToString(data.content[0])
      break;
    case "Array":
      main = "Array<" + data.content.map(simpleToString).join(', ') + '>'
      break;
    default:
      main = parsedToString(data.type)
  }
  if (data.name && data.name[data.name.length - 1] === '?') {
    // FIXME(FRAIN) Question mark shouldn't be part of a name
    data.optional = false
  }
  if (data.default) data.optional = false;
  return (data.rest ? "..." : "") + (data.name ? data.name + (data.optional ? '?' : "") : "") + ((data.name && main) ? ": " : "") + main + (data.default ? " = " + data.default : "")
}
