var assert = require("assert")
var parse = require("../parseGetDocsType").parse

var parsedToFlowString = require("../renderFlowType").parsedToString

function tParseData(inp, out) {
  assert.deepEqual(parse(inp), out);
}
function tRoundtrip(inp, out) {
  assert.deepEqual(parsedToFlowString(parse(inp), true), out);
}

tRoundtrip(
  "{ pos: Pos, left: number}",
  "{pos: Pos, left: number}"
)
tRoundtrip(
  "(?Pos, ?number) => void",
  "(_: ?Pos, _: ?number)"
)
tRoundtrip(
  "(string, ?CmdSpec) → bool",
  "(_: string, _: ?CmdSpec): bool"
)
tRoundtrip(
  "(string, ?Object, ...union<string, DOMNode>) => void",
  "(_: string, _: ?Object, ..._: string | window.Node)"
)
tRoundtrip(
  "(ProseMirror, () -> ?() -> ?()) => void",
  "(_: ProseMirror, _: () => ?() => ?() => void)"
)

tRoundtrip(
  "{ render: (pm: ProseMirror) → ?DOMNode}",
  "{render: (pm: ProseMirror) => ?window.Node}"
)
tRoundtrip(
  "{type: string, attrs: ?Object, content: ?string, marks: ?[string]}",
  "{type: string, attrs: ?Object, content: ?string, marks: ?Array<string>}"
)
tRoundtrip(
  "bool Tells you whether the position was deleted, that is,",
  "bool"
)

tRoundtrip(
  "(string, ?Object) → (...content: union<string, Node>) → Node",
  "(_: string, _: ?Object): (...content: string | Node) => Node"
)

tParseData(
  "(string, ?Object) → (...content: union<string, Node>) → Node",
  {
    type: "Function",
    params: [
      {type: "string"},
      {optional: true, type: "Object"}
    ],
    returns: {
      type: "Function",
      params: [
        {rest: true, name: "content", type: "union", content: [{type:"string"}, {type:"Node"}]}
      ],
      returns: {
        type: "Node"
      }
    }
  }
)

tParseData(
  "Object<Object<() → any>>",
  {
    type: "Object",
    content: [
      {
        type: "Object",
        content: [
          {
            type: "Function",
            params: [],
            returns: {
              type: "any"
            }
          }
        ]
      }
    ]
  }
)

/*
tParseData(
  "{text: ?string}",
  {
    type: "Object",
    properties: {
      optional: true,
      name: "text",
      type: "string"
    }
  }
)
*/

tParseData(
  "(Node, bool, ?Item) → ?{transform: Transform, selection: {type: constructor<Selection>, a: number, b: number}, ids: [number]}",
  {
    type: 'Function',
    params:
     [ { type: 'Node' },
       { type: 'bool' },
       { type: 'Item', optional: true } ],
    "returns": {
      "type": "Object",
      "optional": true,
      "properties": {
        "transform": {
          "type": "Transform",
          "name": "transform"
        },
        "selection": {
          "type": "Object",
          "name": "selection",
          "properties": {
            "type": {
              "type": "constructor",
              "name": "type",
              "content": [
                {
                  "type": "Selection"
                }
              ]
            },
            "a": {
              "type": "number",
              "name": "a"
            },
            "b": {
              "type": "number",
              "name": "b"
            }
          }
        },
        "ids": {
          "type": "Array",
          "name": "ids",
          "content": [
            {
              "type": "number"
            }
          ]
        }
      }
    }
  }
)

tParseData(
  "(Node, bool, ?Item) → ?{transform: Transform, selection: SelectionToken, ids: [number]}",
  {
    type: 'Function',
    params:
     [ { type: 'Node' },
       { type: 'bool' },
       { type: 'Item', optional: true } ],
    "returns": {
      "type": "Object",
      "optional": true,
      "properties": {
        "transform": {
          "type": "Transform",
          "name": "transform"
        },
        "selection": {
          "type": "SelectionToken",
          "name": "selection"
        },
        "ids": {
          "type": "Array",
          "name": "ids",
          "content": [
            {
              "type": "number"
            }
          ]
        }
      }
    }
  }
)
