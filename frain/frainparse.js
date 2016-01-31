var mapPmType = require('./mapPmType')
var parse = require("./parseGetDocsType").parse
var render = process.env.TARGET === 'flow' ? require("./renderFlowType") : require("./renderTypeScriptType")
var parsedToString = render.parsedToString
var mapType = render.mapType
var skipCommentLines = require('./utils').skipCommentLines

var handleDocTypes = require("./docTypes").handleDocTypes.bind(null, parsedToString)

function applyPatches(str, patches) {
  function applyPatch(str, p) {
    str = splice(str, p.at, p.length || 0, p.new)
    return str
  }
  str = patches.sort(function (p1, p2) {
    return p2.at - p1.at
  }).reduce(applyPatch, str)
  return str
}

function uniq(arr) {
  return arr.reduce(function (res,v) {
    if (res.indexOf(v) === -1) res.push(v);
    return res;
  }, [])
}

function splice(str, index, count, add) {
  return str.slice(0, index) + (add || "") + str.slice(index + count);
}

// FIXME(FRAIN): Could be an actual interface
var eventMixin = {
  on: parsedToString(parse("(type: string, handler: (...args: Array<any>) → void) → void")),
  off: parsedToString(parse("(type: string, handler: (...args: Array<any>) → void) → void")),
  signal: parsedToString(parse("(type: string, ...args: Array<any>) → void")),
  signalHandleable: parsedToString(parse("(type: string, ...args: Array<any>) → any")),
  signalPipelined: parsedToString(parse("(type: string, value: any) → any")),
  hasHandler: parsedToString(parse("(type: string) → bool"))
}

var classesWithEventMixin = [
  "ProseMirror",
  "MarkedRange"
]

function typeForProperty( className, propertyName ) {
  if (className === "SchemaItem" && propertyName === "registry") {
    return parsedToString(parse("Object<Object<() → *>>"))
  }
  if (className === "NodeSelection" && propertyName === "node") {
    return "Node"
  }
  if (classesWithEventMixin.indexOf(className) !== -1 && eventMixin[propertyName]) {
    return eventMixin[propertyName]
  }
  // FIXME(FRAIN): Try * instead of any
  return "any"
}

function createDocInterfaces(str, typeVisitor) {
  var re = /^[ \t]*\/\/ ;; (?:(?:#path=(\w+) #kind=interface)|(?:#kind=interface #path=(\w+)))$/mg;
  var match,
    substr,
    offset,
    offsetSkew = 0,
    ret = { patches: [], positions: [] }
  while (match = re.exec(str)) {
    offset = match.index + match[0].length + 1
    substr = str.substr(offset)
    substr = skipCommentLines(substr)
    offset = str.length - substr.length
    var name = match[1] || match[2]
    if (name === 'MenuGroup') {
      // FIXME(FRAIN) MenuGroup is not actually an interface, but a type alias
      continue;
    }

    typeVisitor.typeDefinition(name)
    var pos = findEndOfDocInterface(name, substr, offset)

    var newStr = "export type " + name + " = {};";
    ret.positions.push({
      className: name,
      begin: pos + offsetSkew + newStr.length - 2,
      end: pos + offsetSkew + newStr.length - 2,
      noStatic: true
    });
    ret.patches.push({ at: pos, new: newStr })
    offsetSkew += newStr.length
  }
  return ret
}

function findEndOfDocInterface(name, str, inOffset) {
  var match
  var re = new RegExp("^\\n\\/\\/ :: (.+)(?:\\n\\/\\/)? #path=" + name + "\\.(.+)\\n", "gm");
  var localOffset = 0
  while (match = re.exec(str)) {
    localOffset = str.length - skipCommentLines(str.substr(match.index + match[0].length)).length
  }
  return inOffset + localOffset
}

function findClassDefinitions(str) {
  var result = []
  var regex = /class (\w+) (?:extends \w+ )?{$/gm
  var endRegex = /^}$/gm
  var match
  while (match = regex.exec(str)) {
    result.push({
      className: match[1],
      begin: match.index + match[0].length
    })
    endRegex.lastIndex = result[result.length-1].begin
    result[result.length-1].end = endRegex.exec(str).index
  }
  return result
}

function findProperties(className, str, parse) {
  var properties = []
  var match
  // FIXME: Bad Fragment interface
  props = (className === "Fragment") ? ["replace", "lastChild", "appendInner", "forEach", "iter", "firstChild", "size", "child"] : [];
  if (className === "SchemaItem") {
    props = ["registry"]
  }
  if (className === "NodeSelection") {
    props = ["node"]
  }
  if (className === "NodeKind") {
    props = ["static text", "static inline", "static block", "static nextID", "static list_item"]
  }
  if (className === "Transform") {
    // FIXME(FRAIN): This could be done with a pre-analysis step (and be typed then)
    props = ["lift", "to", "wrap", "setBlockType", "setNodeType", "join", "addMark", "removeMark", "mark", "clearMarkup", "delete", "replace", "replaceWith", "insert", "insertText", "insertInline", "split", "depth", "splitIfNeeded", "depth"]
  }
  if (className === "Node") {
    // FIXME(PM): Only defined if node.isText
    props = ["text"]
  }
  if (className === "ProseMirror") {
    props = ["ranges", "history"]
  }
  if (classesWithEventMixin.indexOf(className) !== -1) {
    props = props.concat(Object.keys(eventMixin))
  }
  match = str.match(/(\s+)constructor[^{]+ {([\s\S]*?)\n\1}/);
  if (match) {
    props = props.concat(match[2].match(/this\.\w+/gm).map(function (p) { return p.substr(5) }));
    props = uniq(props);
  }
  return props.reduce(function (props, p) {
    props[p] = { name: p, type: typeForProperty(className, p) }
    return props
  }, Object.create(null))
}

function findPropertyDefinitions(positions, str, parse) {
  var properties = positions.reduce(function( properties, position ) {
    var substr = str.substr(position.begin + 1, position.end - position.begin)
    var className = position.className
    properties[className] = findProperties(className, substr, parse);
    return properties
  }, Object.create(null))
  return properties
}

function addPropertyDefinitions(positions, properties) {
  return positions.reduce( function (patches, position) {
    var className = position.className
    if (properties[ className ]) {
      var propsString = Object.keys(properties[ className ]).map(function (p) {
        var property = properties[className][p]
        // FIXME(PM?) In some interface definitions, the path does not contain `prototype`
        if (position.noStatic) property.name = property.name.replace(/^static /, '')
        var propString = parsedToString({type: "Object", properties: [property]})
        propString = propString.substr( 1, propString.length - 2 )
        return propString
      }).concat([""]).join("; ")
      patches.push({at: position.begin, new: propsString})
      delete properties[ className ]
    }
    return patches
  }, [])
}

function addPropertiesAndTypes(str, positions, typeImporter, parse) {
  positions = positions.concat(findClassDefinitions(str))
  var properties = findPropertyDefinitions(positions, str, parse)

  var res = handleDocTypes(str, typeImporter, parse, positions)
  Object.keys(res.props).reduce(function (properties, className) {
    if (!properties[className]) {
      properties[className] = {}
    }
    Object.assign( properties[className], res.props[className] )
    return properties
  }, properties)

  var patches = []
  patches = patches.concat(res.patches)
  patches = patches.concat(
    addPropertyDefinitions(positions, properties)
  );
  if (Object.keys(properties).length > 0) {
    console.warn( "Found properties but couldn't add them", properties )
  }
  return patches;
}

var fileMap = {
  Command: "edit",
  CommandParam: "edit/command",
  CommandSpec: "edit/command",
  Fragment: "model",
  Mappable: "transform/map",
  MapResult: "transform",
  Mark: "model",
  MarkType: "model",
  Node: "model",
  NodeType: "model",
  PosMap: "transform",
  ProseMirror: "edit",
  ResolvedPos: "model",
  Schema: "model",
  Selection: "edit/selection",
  Slice: "model",
  Step: "transform",
  StepResult: "transform",
  TextSelection: "edit/selection",
  Transform: "transform"
}

function TypeImporter (input) {
  var alreadyPresent = (function (alreadyPresent) {
    var re, match
    re = /^import {([^}]+)} from/gm
    while (match = re.exec(input)) {
      alreadyPresent = alreadyPresent.concat(match[1].split(',').map(function (str) { return str.trim() }))
    }
    re = /^export class (\w+)/gm
    while (match = re.exec(input)) {
      alreadyPresent.push(match[1])
    }
    return alreadyPresent
  })([]);
  var imports = [];

  function genImports() {
    return uniq(imports).filter(function (type) {
      return alreadyPresent.indexOf(type) === -1
    }).map(function (className) {
      return (process.env.TARGET === "flow" ? "import type" : "import" ) + " {" + className + "} from '../" + fileMap[className] + "'"
    }).concat("").join(";") // concat is for adding another ; at the end if anything gets imported
  }

  this.importType = function (type) {
    if (typeof type === 'string' && fileMap.hasOwnProperty(type)) imports.push(type)
  }

  this.addTypeImports = function (target) {
    return genImports() + target
  }

  this.typeUsage = this.importType
  this.typeDefinition = function (type) {
    alreadyPresent.push(type)
  }
}

var handleBadLines = process.env.TARGET === "flow" ? require('./flowIssues') : function (str) { return str; }

function handleData(str) {
  var typeImporter = new TypeImporter(str);
  var visitType = function (type, parse) {
    type = mapPmType(type, parse)
    typeImporter.importType(type)
    return type
  };
  var _parse = function (type) {
    return parse(type, visitType);
  };
  process.stdout.write("/* @flow weak */")

  var res = createDocInterfaces(str, typeImporter)
  str = applyPatches(str, res.patches);
  var patches = addPropertiesAndTypes(str, res.positions, typeImporter, _parse)
  str = applyPatches(str, patches)
  process.stdout.write(typeImporter.addTypeImports(handleBadLines(str)))
}

(function () {
  var str = "";
  process.stdin.on("data", function (chunk) { str += chunk })
  process.stdin.on("end", function (chunk) { handleData(str) })
})();
