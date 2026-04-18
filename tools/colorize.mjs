#!/usr/bin/env node
// 按 mesh index 给 glb 的每个 mesh 组分配材质（颜色 + 金属度 + 粗糙度）
// 用法: node tools/colorize.mjs <input.glb> <output.glb>

import { NodeIO } from '@gltf-transform/core';
import { prune, dedup } from '@gltf-transform/functions';
import { writeFileSync } from 'node:fs';

const [,, input, output] = process.argv;
if (!input || !output) {
  console.error('用法: node colorize.mjs <input.glb> <output.glb>');
  process.exit(1);
}

// 金驰保健品风调色板（深浅 + 金色点缀，高级感）
const palette = [
  { name: 'part-A', baseColor: [0.94, 0.94, 0.96, 1], metallic: 0.05, roughness: 0.38 },   // 冷白
  { name: 'part-B', baseColor: [0.18, 0.18, 0.22, 1], metallic: 0.55, roughness: 0.30 },   // 深灰金属
  { name: 'part-C', baseColor: [0.84, 0.66, 0.30, 1], metallic: 0.80, roughness: 0.22 },   // 金色
  { name: 'part-D', baseColor: [0.50, 0.60, 0.78, 1], metallic: 0.25, roughness: 0.42 },   // 蓝灰 兜底
];

const io = new NodeIO();
const doc = await io.read(input);
const root = doc.getRoot();

const meshes = root.listMeshes();
meshes.forEach((mesh, i) => {
  const cfg = palette[i % palette.length];
  const mat = doc.createMaterial(cfg.name)
    .setBaseColorFactor(cfg.baseColor)
    .setMetallicFactor(cfg.metallic)
    .setRoughnessFactor(cfg.roughness);
  mesh.listPrimitives().forEach(prim => prim.setMaterial(mat));
  console.log(`  mesh[${i}] → ${cfg.name} rgba(${cfg.baseColor.map(v=>v.toFixed(2)).join(',')})`);
});

await doc.transform(prune(), dedup());
const buf = await io.writeBinary(doc);
writeFileSync(output, buf);
console.log(`✓ ${input} → ${output} (${(buf.byteLength/1024).toFixed(1)} KB, ${meshes.length} meshes 着色)`);
