#!/usr/bin/env node
// 清理 Rhino 导出残留的曲线（LINE_STRIP / LINES / POINTS），并把模型居中到原点
// 用法: node tools/clean-glb.mjs <input.glb> <output.glb>

import { NodeIO } from '@gltf-transform/core';
import { center, prune, dedup } from '@gltf-transform/functions';
import { writeFileSync } from 'node:fs';

const [,, inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) {
  console.error('用法: node clean-glb.mjs <input.glb> <output.glb>');
  process.exit(1);
}

const TRIANGLES = 4; // glTF primitive mode
const io = new NodeIO();
const doc = await io.read(inputPath);
const root = doc.getRoot();

let removedPrims = 0;
for (const mesh of root.listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    const mode = prim.getMode();
    if (mode !== TRIANGLES && mode !== 5 /* TRIANGLE_STRIP */ && mode !== 6 /* TRIANGLE_FAN */) {
      mesh.removePrimitive(prim);
      prim.dispose();
      removedPrims++;
    }
  }
  if (mesh.listPrimitives().length === 0) mesh.dispose();
}

await doc.transform(
  prune(),
  dedup(),
  center({ pivot: 'center' })
);

const glbBuffer = await io.writeBinary(doc);
writeFileSync(outputPath, glbBuffer);
console.log(`✓ 删除 ${removedPrims} 个非三角几何 (曲线/点)`);
console.log(`✓ 场景已居中到原点`);
console.log(`✓ 输出: ${outputPath} (${(glbBuffer.byteLength/1024).toFixed(1)} KB)`);
