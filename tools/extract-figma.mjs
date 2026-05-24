import fs from "fs";
import pako from "pako";
import zstdPkg from "zstd-codec";
import { decodeBinarySchema, compileSchema } from "kiwi-schema";
import { FigmaArchiveParser } from "../node_modules/fig-kiwi/dist/index.esm.js";

const { ZstdCodec } = zstdPkg;

const file = process.argv[2] || ".fig-inspect/canvas.fig";
const rootId = process.argv[3] || "41:3845";
const maxDepth = Number(process.argv[4] || 5);
const mode = process.argv[5] || "tree";

const gid = (node) => `${node.guid.sessionID}:${node.guid.localID}`;
const parentId = (node) =>
  node.parentIndex?.guid
    ? `${node.parentIndex.guid.sessionID}:${node.parentIndex.guid.localID}`
    : "";

const paintColor = (paint) => {
  const c = paint?.color;
  if (!c) return "";
  return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(
    c.b * 255
  )},${c.a ?? 1})`;
};

const firstPaint = (node, key = "fillPaints") => {
  const paint = node[key]?.find?.((item) => item.visible !== false);
  return paint ? `${paint.type}:${paintColor(paint)}` : "";
};

const short = (value, length = 140) => {
  if (value == null) return "";
  const text = String(value).replace(/\s+/g, " ").trim();
  return text.length > length ? `${text.slice(0, length)}...` : text;
};

function decode(callback) {
  const archive = FigmaArchiveParser.parseArchive(fs.readFileSync(file));
  const schema = decodeBinarySchema(pako.inflateRaw(archive.files[0]));
  const compiled = compileSchema(schema);
  ZstdCodec.run((zstd) => {
    const data = new zstd.Simple().decompress(archive.files[1]);
    callback(compiled.decodeMessage(data));
  });
}

decode((message) => {
  const nodes = message.nodeChanges;
  const byId = new Map(nodes.map((node) => [gid(node), node]));
  const byParent = new Map();

  for (const node of nodes) {
    const parent = parentId(node);
    if (!byParent.has(parent)) byParent.set(parent, []);
    byParent.get(parent).push(node);
  }

  for (const children of byParent.values()) {
    children.sort(
      (a, b) =>
        (a.transform?.m12 || 0) - (b.transform?.m12 || 0) ||
        (a.transform?.m02 || 0) - (b.transform?.m02 || 0)
    );
  }

  const printNode = (node, depth) => {
    const indent = "  ".repeat(depth);
    const size = node.size
      ? `${Math.round(node.size.x * 100) / 100}x${Math.round(node.size.y * 100) / 100}`
      : "";
    const pos = node.transform
      ? `${Math.round(node.transform.m02 * 100) / 100},${Math.round(
          node.transform.m12 * 100
        ) / 100}`
      : "";
    const text = node.textData?.characters;
    const textInfo = text
      ? ` text="${short(text)}" fs=${node.fontSize} lh=${JSON.stringify(
          node.lineHeight
        )} font=${node.fontName?.family}/${node.fontName?.style}`
      : "";
    const paintInfo = firstPaint(node) ? ` fill=${firstPaint(node)}` : "";
    const strokeInfo = firstPaint(node, "strokePaints")
      ? ` stroke=${firstPaint(node, "strokePaints")}`
      : "";
    const radius =
      node.cornerRadius !== undefined ? ` radius=${node.cornerRadius}` : "";

    if (depth <= maxDepth || text) {
      console.log(
        `${indent}${node.type} ${gid(node)} "${node.name}" ${size} @${pos}${textInfo}${paintInfo}${strokeInfo}${radius}`
      );
    }
  };

  const walk = (id, depth = 0) => {
    const node = byId.get(id);
    if (!node) return;
    printNode(node, depth);
    if (depth >= maxDepth) return;
    for (const child of byParent.get(id) || []) walk(gid(child), depth + 1);
  };

  if (mode === "text") {
    const descendants = new Set();
    const collect = (id) => {
      descendants.add(id);
      for (const child of byParent.get(id) || []) collect(gid(child));
    };
    const absolute = (node) => {
      let x = 0;
      let y = 0;
      let current = node;
      while (current) {
        x += current.transform?.m02 || 0;
        y += current.transform?.m12 || 0;
        current = byId.get(parentId(current));
      }
      return [Math.round(x * 100) / 100, Math.round(y * 100) / 100];
    };

    collect(rootId);
    for (const node of nodes.filter(
      (item) => descendants.has(gid(item)) && item.type === "TEXT"
    )) {
      const [x, y] = absolute(node);
      console.log(
        `${gid(node)} @${x},${y} ${Math.round(node.size.x * 100) / 100}x${
          Math.round(node.size.y * 100) / 100
        } fs=${node.fontSize} lh=${JSON.stringify(node.lineHeight)} font=${
          node.fontName?.family
        }/${node.fontName?.style} fill=${firstPaint(node)} text="${short(
          node.textData?.characters,
          500
        )}"`
      );
    }
    return;
  }

  walk(rootId);
});
