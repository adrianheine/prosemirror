set -e

TARGET=${TARGET:-flow}
FLOW=~/bin/flow/flow
TYPESCRIPT=$PWD/node_modules/.bin/tsc
WORKING_DIR=fraindir/$TARGET

rm -rf $WORKING_DIR
mkdir -p $WORKING_DIR

for f in src/*/*.js
do
  mkdir -p `dirname $WORKING_DIR/$f`
  echo $f
  cat $f | nodejs frain/frainparse.js > $WORKING_DIR/$f
  if [ $TARGET = "typescript" ]
  then
    f_ts=$(echo $f | sed "s/js$/ts/")
    ln -s `basename $f` $WORKING_DIR/$f_ts
  fi
done

if [ $TARGET = "flow" ]
then
  mkdir -p $WORKING_DIR/lib-interfaces
  echo 'declare class MarkdownToken {
    type: string;
    content: string;
    children: Array<MarkdownToken>;
    attrs: Array<[string,string]>;
  }
  declare module "markdown-it" {
    declare function exports(_: string): () => {parse: (text: string, env: {}) => Array<MarkdownToken>};
  }' > $WORKING_DIR/lib-interfaces/markdown-it.js

  echo 'declare module "xmldom" {
    declare class XMLDOMNode {}
    declare class DOMParser {
      parseFromString(str: string): XMLDOMNode;
    }
    declare class XMLSerializer {
      serializeToString(node: XMLDOMNode): string;
    }
  }' > $WORKING_DIR/lib-interfaces/xmldom.js

  echo 'declare module "source-map-support" {
    declare function install(): void;
  }' > $WORKING_DIR/lib-interfaces/source-map-support.js

  echo 'declare module "browserkeymap" {
    declare class exports {
      static keyName(_: Event): ?string;
      static normalizeKeyName(_: string): string;
      static isModifierKey(_: string): bool;
      lookup(_: string, _: ?any): any;
    }
  }' > $WORKING_DIR/lib-interfaces/browserkeymap.js

  # FIXME(Flow): https://github.com/facebook/flow/pull/1587
  echo 'declare class DataTransfer {
    dropEffect: string;
    effectAllowed: string;

    // items: DataTransferItemList items;

    setDragImage(image: Element, x: number, y: number): void;

    /* old interface */
    types: Array<string>;
    getData(format: string): string;
    setData(format: string, data: string): void;
    clearData(format?: string): void;
  }' > $WORKING_DIR/lib-interfaces/datatransfer.js

  echo '[ignore]
  .*/node_modules/.*

  [include]

  [libs]
  ../lib-interfaces/

  [options]
  unsafe.enable_getters_and_setters=true
  suppress_comment= \\\\(.\\\\|\\n\\\\)*\\\\$FlowFixMe' >> $WORKING_DIR/src/.flowconfig

  ( cd $WORKING_DIR && $FLOW check --color always --show-all-errors src/ )
else
  echo '
declare var _DOMDocument: Document;
declare var _DOMEvent: Event;
declare var _DOMFragment: DocumentFragment;
declare var _DOMNode: Node;
  ' >> $WORKING_DIR/lib.d.ts
  TYPE_OUT=$( cd $WORKING_DIR && $TYPESCRIPT -t es5 src/*/*.ts --out /dev/null lib.d.ts || true )
  echo "$TYPE_OUT"
  echo "$TYPE_OUT" | wc -l
fi
