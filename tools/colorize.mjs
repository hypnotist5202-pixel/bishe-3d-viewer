#!/usr/bin/env node
// 按零件名精准上色（跨三个 glb 的同一零件保持一致材质）
// 用法: node tools/colorize.mjs <combined|exploded-v|exploded-h> <input.glb> <output.glb>

import { NodeIO } from '@gltf-transform/core';
import { prune, dedup } from '@gltf-transform/functions';
import { writeFileSync } from 'node:fs';

// 零件 → 三个 glb 的 mesh index 映射（V 数指纹识别得出）
const PART_MAP = {
  '上盖':   { 'combined': 2, 'exploded-v': 5, 'exploded-h': 0 },
  '药仓':   { 'combined': 8, 'exploded-v': 6, 'exploded-h': 4 },
  '限位环': { 'combined': 3, 'exploded-v': 4, 'exploded-h': 6 },
  '限位盘': { 'combined': 7, 'exploded-v': 3, 'exploded-h': 5 },
  '送药器': { 'combined': 6, 'exploded-v': 2, 'exploded-h': 3 },
  '齿轴':   { 'combined': 4, 'exploded-v': 1, 'exploded-h': 2 },
  '齿轮':   { 'combined': 5, 'exploded-v': 0, 'exploded-h': 1 },
  '底座':   { 'combined': 1, 'exploded-v': 7, 'exploded-h': 8 },
  '药片':   { 'combined': 0, 'exploded-v': null, 'exploded-h': 7 },
};

// PBR 材质参数（用户指定 2026-04-18）
const MAT = {
  '上盖':   { name: 'pg-petg-black-matte',  color: [0.15, 0.15, 0.17, 1], metallic: 0.0,  roughness: 0.72 }, // 灰黑磨砂 PETG
  '底座':   { name: 'pg-petg-black-matte',  color: [0.15, 0.15, 0.17, 1], metallic: 0.0,  roughness: 0.72 },
  '限位环': { name: 'pg-petg-black-matte',  color: [0.15, 0.15, 0.17, 1], metallic: 0.0,  roughness: 0.72 },
  '药仓':   { name: 'pg-petg-orange-gloss', color: [0.92, 0.45, 0.08, 1], metallic: 0.05, roughness: 0.18 }, // 橙光面 PETG
  '限位盘': { name: 'pg-petg-orange-gloss', color: [0.92, 0.45, 0.08, 1], metallic: 0.05, roughness: 0.18 },
  '送药器': { name: 'pg-petg-gray-gloss',   color: [0.55, 0.55, 0.58, 1], metallic: 0.02, roughness: 0.22 }, // 灰光面 PETG
  '齿轴':   { name: 'pg-brass-brushed',     color: [0.80, 0.60, 0.25, 1], metallic: 0.95, roughness: 0.48 }, // 磨砂黄铜
  '齿轮':   { name: 'pg-brass-brushed',     color: [0.80, 0.60, 0.25, 1], metallic: 0.95, roughness: 0.48 },
  '药片':   { name: 'pg-pill-white',        color: [0.96, 0.96, 0.94, 1], metallic: 0.0,  roughness: 0.60 }, // 白色药片
};

const [,, fileKey, input, output] = process.argv;
if (!fileKey || !input || !output) {
  console.error('用法: node colorize.mjs <combined|exploded-v|exploded-h> <input.glb> <output.glb>');
  process.exit(1);
}

const io = new NodeIO();
const doc = await io.read(input);
const root = doc.getRoot();
const meshes = root.listMeshes();

// 为每种材质创建共享 Material，按零件名映射上色
const matCache = {};
let colored = 0;

for (const [partName, indices] of Object.entries(PART_MAP)) {
  const meshIdx = indices[fileKey];
  if (meshIdx === null || meshIdx === undefined) continue;
  const mesh = meshes[meshIdx];
  if (!mesh) {
    console.warn(`  ⚠ ${fileKey} 找不到 mesh[${meshIdx}] for ${partName}`);
    continue;
  }
  const spec = MAT[partName];
  if (!matCache[spec.name]) {
    matCache[spec.name] = doc.createMaterial(spec.name)
      .setBaseColorFactor(spec.color)
      .setMetallicFactor(spec.metallic)
      .setRoughnessFactor(spec.roughness);
  }
  const mat = matCache[spec.name];
  mesh.listPrimitives().forEach(p => p.setMaterial(mat));
  console.log(`  ✓ ${partName.padEnd(4)} → mesh[${meshIdx}] 材质=${spec.name}`);
  colored++;
}

await doc.transform(prune(), dedup());
const buf = await io.writeBinary(doc);
writeFileSync(output, buf);
console.log(`✓ ${fileKey}: ${input} → ${output} (${(buf.byteLength/1024).toFixed(1)} KB, ${colored} 零件着色)`);
