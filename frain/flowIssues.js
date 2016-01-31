var parse = require("./parseGetDocsType").parse
var render = process.env.TARGET === 'flow' ? require("./renderFlowType") : require("./renderTypeScriptType")
var parsedToString = render.parsedToString
var mapType = render.mapType

module.exports = function handleBadLines(str) {
  // FIXME(Flow): https://github.com/facebook/flow/issues/813
  str = str.replace(
    /\nParamPrompt\.prototype\.paramTypes.\w+ =/g,
    "\n// $FlowFixMe$&"
  )
  // FIXME(Flow): https://github.com/facebook/flow/issues/813
  str = str.replace(
    /(static compile\(types, schema\) \{\n\s*let result)( = Object\.create\(null\))/,
    "$1: {[key: string]: NodeType}$2"
  )
  // FIXME:
  str = str.replace(
    /      content = this\.defaultContent()/g,
    "// $FlowFixMe\n      content = this.defaultContent()"
  )

  // FIXME(?): Flow cannot handle PM's infinite loops
  ;[
    "  subKind(sub: string, sup: string): bool {",
    "  isValid(doc: Node, requireTextblock: ?bool): bool {",
    "  siblingRange(from: Pos, to: Pos): {from: Pos, to: Pos} {",
    "Transform.prototype.split = function(pos: Pos, depth: number = 1, typeAfter: ?NodeType, attrsAfter: ?Object): Transform {",
    "export function samePathDepth(a: Pos, b: Pos): number {",
    "function leafAt(node: window.Node, offset: number): {node: window.Node, offset: number} {"
  ].forEach(function (line) {
    str = str.replace(
      "\n" + line,
      "// $FlowFixMe\n" + line
    )
  })

  // FIXME(?): Flow does not understand that node.firstChild is always set in this case
  str = str.replace(
    "let nodesRight = []\n  for (let node = sliced, i = 0; i <= start.path.length; i++, node = node.firstChild)\n    nodesRight.push(node)",
    "let nodesRight: Array<Node> = [] // $FlowFixMe\n  for (let node = sliced, i = 0; i <= start.path.length; i++, node = node.firstChild) // $FlowFixMe\n    nodesRight.push(node)"
  )

  // FIXME(?)
  str = str.replace(
    "let obj = {type: this.type.name}",
    "let obj: {type: string, attrs?: {}, content?: ?Object, marks?: Array<string>} = {type: this.type.name}"
  )
  // FIXME(?)
  str = str.replace(
    "let base = super.toJSON()",
    "let base: " +
    parsedToString(parse("{type: string, attrs: ?{}, content: ?string, marks: ?[string], text: ?string}")) +
    " = super.toJSON()"
  )
  // FIXME(Flow): https://github.com/facebook/flow/issues/1381
  str = str.replace(
    /[^\n]*getPrototypeOf/g,
    "// $FlowFixMe\n$&"
  )
  // FIXME(Flow): https://github.com/facebook/flow/issues/1234
  str = str.replace(
    /[^\n]*(\(|, )(to|start|end|from)(: number)? = this\.size/g,
    "// $FlowFixMe\n$&"
  )

  // FIXME(?): wrapped is possibly undefined, but not when (nextCut || ranges.current.length)
  str = str.replace(
    /\n      if \(ranges\.current\.length\)/,
    "$& // $FlowFixMe"
  )
  str = str.replace(
    /\n        if \(!\(nextCut = ranges\.nextChangeBefore\(end\)\)\)/,
    "$& // $FlowFixMe"
  )

  // FIXME(?): After-the-fact extensions
  str = str.replace(
    /\n[^\n]*prototype(\[Symbol\.iterator\]|\.serializeText|\.countCoordsAsChild =)/g,
    " // $FlowFixMe$&"
  )

  str = str.replace(
    "let keys = {",
    "let keys: {[keys: string]: Function} = {"
  )

  str = str.replace(
    "export const autoInputRules = Object.create(null)",
    "export const autoInputRules: {[keys: string]: InputRule} = Object.create(null)"
  )

  return str
}
