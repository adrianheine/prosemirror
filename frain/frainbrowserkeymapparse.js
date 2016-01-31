var str = "";

process.stdin.on("data", function (chunk) { str += chunk })
process.stdin.on("end", function (chunk) { handleData(str) })

var badStuff = [
  /^\s*\(this \|\| window\)\.browserKeymap = mod\(\)$/m,
  /^\s*module\.exports = mod\(\)$/m,
  /^\s*else if \(typeof define == "function" && define\.amd\) \/\/ AMD$/m,
  /^\s*: typeof os != "undefined" \? os\.platform\(\) == "darwin" : false$/m
]

function insertFixmes(str) {
  return badStuff.reduce(function (str, regex) {
    return str.replace(regex, '// $FlowFixMe\n$&')
  }, str)
}

function handleData(str) {
  // FIXME(FLOW): https://github.com/facebook/flow/issues/380
  process.stdout.write(insertFixmes(str.replace(/var keyNames = \{[^}]+\}/, function (match) {
    return match.replace(/ (\d+):/g, ' "$1":')
  })));
}
