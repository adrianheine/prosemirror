'use strict'

var skipCommentLines = require('./utils').skipCommentLines

function addTypesToFn(parsedToString, args, parsed) {
  args = args === '' ? [] : args.split(", ").map(function(p) { return p.split(" = ") })
  if (args.length !== parsed.params.length) {
    console.warn("Different number of names and types", args, parsed.params);
  }
  args.forEach(function(argD, k) {
    parsed.params[k] = parsed.params[k] || {type:""}
    if ((argD[0].substr(0, 3) === '...') !== Boolean(parsed.params[k].rest)) {
      console.warn("Doc and code cannot agree whether it's a rest parameter");
    }
    argD[0] = argD[0].replace(/^\.{3}/, "")
    if (parsed.params[k].name && parsed.params[k].name !== argD[0]) {
      console.warn("Arg name and arg name at type do not match", k, args, parsed.params)
    }
    parsed.params[k].name = argD[0]
    parsed.params[k].default = argD[1]
    // FIXME(FRAIN): Flow-specific
    // Trim optional marks for args with non-null default value
    parsed.params[k].optional = parsed.params[k].optional && (!argD[1] || argD[1] === "null")
  })
  // FIXME(FLOW): https://github.com/facebook/flow/issues/1455
  return parsedToString(parsed, true).replace("?Fragment | Node | Array<Node>", "?Array<Node> | Fragment | Node")
}

function handleDocTypes(parsedToString, str, typeVisitor, parse, positions) {
  var re = /^[ \t]*\/\/ ::? ?(.*)(?:(?:\n\/\/)?( #path=\S+))?[\n ]/mg
  var match,
    substr,
    ret = { props: Object.create(null), patches: [] },
    offset
  var addProperty = addProp.bind(null, ret.props)
  while (match = re.exec(str)) {
    offset = match.index + match[0].length
    substr = str.substr(offset)
    substr = skipCommentLines(substr)
    offset = str.length - substr.length
    var match0 = match[0]
    var virtual = match[1] + (match[2] || '')
    match = virtual.match(/^(.+) #path=(\S+)$/)
    if (match) {
      // Path given
      if (match[2].match(/#events#/)) {
        // Event documentation
        continue
      }
      findPropertyType(match[2], parse(match[1]), addProperty)
    }
    if (virtual.match(/#kind=option/)) {
      // Option documentation
      continue
    }
    var match2 = virtual.match(/^(\(.*\)(?: → (.+?))?)(?:$| #path)/)
    var patch
    if (match2) {
      patch = addArgsTypes(parsedToString, match0, parse(match2[1]), substr, Boolean(match))
    } else {
      patch = addNonFnType(parsedToString, match0, parse(virtual), substr, addProperty, findClassName.bind(null, positions, offset), Boolean(match))
    }
    if (patch) {
      patch.at += offset
      ret.patches.push(patch)
    }
  }
  return ret
}

function addArgsTypes(parsedToString, raw, type, str, alreadyHandled) {
  var match2 = str.match(/^([ \t]*(?:(?:export\s+)|(?:[\w.]+\s*=\s*))?function\s*(?:\s\w+)?)\(([^(]+)\)/);
  if (!match2)  {
    // FIXME(FRAIN): This allows only one level of parens nesting inside the arguments list
    match2 = str.match(/^([ \t]*(?:static\s+)?\w+)\((((?:[^(]|\([^(]*\)))*)\)/);
    if (!match2) {
      match2 = str.match(/^([ \t]*Transform\.define\("\w+", function)\(([^(]+)\)/);
      if (!match2) {
        if (!alreadyHandled) {
          console.warn("Fn comment but no definition found", JSON.stringify(raw), JSON.stringify(str.match(/^[^\n]*(\n[^\n]+)?/)[0]));
        }
        return
      }
      // The resulting method on Transform.prototype actually returns Transform,
      // but the function that is used for declaring it does not
      type.returns = "void"
    }
  }
  return {
    at: match2.index,
    length: match2[0].length,
    new: match2[1] + addTypesToFn(parsedToString, match2[2], type)
  }
}

function addNonFnType(parsedToString, match0, type, str, addProperty, getClassName, alreadyHandled) {
  var firstLine = str.substr(0, str.indexOf('\n'));
  var match2 = firstLine.match(/^([ \t]*)(?:((?:export )?(?:let|var|const) [\w.]+)(\s*=)|((?:static )?get [\w.]+\(\)))/);
  if (!match2) {
    if (match2 = firstLine.match(/(\w+\.(?:prototype\.)?\w+) = /)) {
      if (!firstLine.match(/^[ \t]*(\w+\.(?:prototype\.)?\w+) = /)) {
        // FIXME(FRAIN) Cannot handle this
        // Currently only happens for `ProseMirror.prototype.apply.scroll = `
        return
      }
      if (match2[1].match(/^this/)) {
        match2[1] = getClassName() + ".prototype" + match2[1].substr(4)
      }
      findPropertyType(match2[1], type, addProperty)
      return
    }
    if (!alreadyHandled) {
      console.warn("Type comment but no definition found", JSON.stringify(match0), JSON.stringify(str.match(/^[^\n]*(\n[^\n]+)?/)[0]));
    }
    return
  }
  return {
    at: match2.index,
    length: match2[0].length,
    new: match2[1] + (match2[2] || match2[4]) + ": " + parsedToString(type) + (match2[3] || "")
  }
}

function findClassName(positions, index) {
  var i = 0;
  while (positions[i].begin > index) {
    ++i
  }
  return positions[i].className
}

function addProp(props, className, name, isStatic, type) {
  if (!props[className]) props[className] = Object.create(null)
  if (className === 'CommandSpec' && name !== 'run') {
    // FIXME(PM)
    name += "?"
  }
  name = (isStatic ? 'static ' : '' ) + name
  type.name = name
  props[className][name] = type
}

function findPropertyType(path, type, addProperty) {
  var match = path.match(/^(\w+)\.(prototype\.)?([^\.#]+)$/)
  if (!match) {
    console.warn("Could not find property type", path)
    return
  }
  addProperty(match[1], match[3], match[2] === undefined, type)
}

exports.handleDocTypes = handleDocTypes
