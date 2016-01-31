"use strict"

var map = Object.create(null);
// FIXME: void?
map["()"] = "(): any"
map["DOMDocument"] = "window.Document"
map["DOMEvent"] = "window.Event"
map["DOMFragment"] = "DocumentFragment"
map["DOMNode"] = "window.Node"

var mapType = exports.mapType = function mapType(type) {
  var match;
  if (type === 'Iterator<Node>') {
    type = "{ next: () => Node | { done: bool }, atEnd: () => bool }"
  }
  if (typeof type === 'string') {
    if (map[type]) type = map[type]
    if (match = type.match(/^Object<(.*)>$/)) {
      type = "{[key: string]: " + mapType( match[1] ) + "}"
    }
    if (type === "DocumentFragment") {
      // FIXME(FLOW): https://github.com/facebook/flow/pull/1378
      type = "window.Node"
    }
  } else {
    console.warn( "What is this?", type, new Error().stack )
  }
  return type;
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
      if (data.name === "ctor" && data.params.length === 0) {
        // FIXME(?)
        return parsedToString({name: "ctor", type: "Class<any>"})
      }

      main = "(" + data.params.map(function (d) {
        var d2 = Object.create(d)
        d2.name = d2.name || "_"
        return parsedToString(d2)
      }).join(', ') + ")" + (isRootFn ? (data.returns.type !== "void" ? ": " + parsedToString(data.returns) : "") : " => " + parsedToString(data.returns))
      break;
    case "union":
      main = data.content.map(simpleToString).join(' | ')
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
      main = "*"
      break;
    case "Array":
      main = "Array<" + data.content.map(simpleToString).join(', ') + '>'
      break;
    default:
      main = parsedToString(data.type)
  }
  return (data.rest ? "..." : "") + (data.name || "") + ((data.name && main) ? ": " : "") + (data.optional ? '?' : '') + main + (data.default ? " = " + data.default : "")
}
