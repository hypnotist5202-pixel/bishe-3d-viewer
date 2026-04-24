#!/usr/bin/env node
// 按零件名精准上色（跨两个 glb 的同一零件保持一致材质）
// 用法: node tools/colorize.mjs <combined|exploded-v> <input.glb> <output.glb>

import { NodeIO } from '@gltf-transform/core';
import { prune, dedup } from '@gltf-transform/functions';
import { ALL_EXTENSIONS, KHRMaterialsSpecular } from '@gltf-transform/extensions';
import { writeFileSync } from 'node:fs';

// 零件 → 两个 glb 的 mesh index 映射（V 数指纹识别得出 · 2026-04-24 更新：盖子改款）
const PART_MAP = {
  '上盖':   { 'combined': 0, 'exploded-v': 1 }, // V=10704
  '药仓':   { 'combined': 7, 'exploded-v': 0 }, // V=21174
  '限位环': { 'combined': 2, 'exploded-v': 5 }, // V=7406
  '限位盘': { 'combined': 6, 'exploded-v': 2 }, // V=4983
  '送药器': { 'combined': 5, 'exploded-v': 6 }, // V=8305
  '齿轴':   { 'combined': 3, 'exploded-v': 3 }, // V=196
  '齿轮':   { 'combined': 4, 'exploded-v': 4 }, // V=1872
  '底座':   { 'combined': 1, 'exploded-v': 7 }, // V=15362
};

// PBR 材质参数（2026-04-24 用户调整配色）
const MAT = {
  '上盖':   { name: 'pg-petg-orange-gloss', color: [0.92, 0.45, 0.08, 1], metallic: 0.05, roughness: 0.18 }, // 橙光面 PETG
  '底座':   { name: 'pg-petg-black-matte',  color: [0.13, 0.13, 0.14, 1], metallic: 0.0,  roughness: 0.9, killSpecular: true }, // 黑哑光 + 关菲涅尔
  '限位环': { name: 'pg-petg-black-matte',  color: [0.13, 0.13, 0.14, 1], metallic: 0.0,  roughness: 0.9, killSpecular: true },
  '药仓':   { name: 'pg-petg-white',        color: [0.92, 0.92, 0.90, 1], metallic: 0.0,  roughness: 0.25 }, // 白光面 PETG
  '限位盘': { name: 'pg-petg-white',        color: [0.92, 0.92, 0.90, 1], metallic: 0.0,  roughness: 0.25 },
  '送药器': { name: 'pg-petg-brown',        color: [0.42, 0.25, 0.14, 1], metallic: 0.02, roughness: 0.30 }, // 棕光面 PETG
  '齿轴':   { name: 'pg-brass-brushed',     color: [0.80, 0.60, 0.25, 1], metallic: 0.95, roughness: 0.48 }, // 磨砂黄铜
  '齿轮':   { name: 'pg-brass-brushed',     color: [0.80, 0.60, 0.25, 1], metallic: 0.95, roughness: 0.48 },
};

const [,, fileKey, input, output] = process.argv;
if (!fileKey || !input || !output) {
  console.error('用法: node colorize.mjs <combined|exploded-v> <input.glb> <output.glb>');
  process.exit(1);
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(input);
const root = doc.getRoot();
const meshes = root.listMeshes();
const allNodes = root.listNodes();
const specularExt = doc.createExtension(KHRMaterialsSpecular);

// 节点名 ASCII key（中文在 glb 里有概率被某些 tooling 截断，ASCII 更稳）
const PART_KEY = {
  '上盖': 'cap', '药仓': 'chamber', '限位环': 'ring', '限位盘': 'disc',
  '送药器': 'pusher', '齿轴': 'shaft', '齿轮': 'gear', '底座': 'base',
};

// 为每种材质创建共享 Material，按零件名映射上色 + 同时给 node 命名（供前端按名查找）
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
    const m = doc.createMaterial(spec.name)
      .setBaseColorFactor(spec.color)
      .setMetallicFactor(spec.metallic)
      .setRoughnessFactor(spec.roughness);
    if (spec.killSpecular) {
      const s = specularExt.createSpecular().setSpecularFactor(0).setSpecularColorFactor([0,0,0]);
      m.setExtension('KHR_materials_specular', s);
    }
    matCache[spec.name] = m;
  }
  const mat = matCache[spec.name];
  mesh.listPrimitives().forEach(p => p.setMaterial(mat));

  // 给引用此 mesh 的 node 命名，同时给 mesh 本身命名（双保险）
  const partKey = PART_KEY[partName] || partName;
  mesh.setName(partKey);
  const node = allNodes.find(n => n.getMesh() === mesh);
  if (node) node.setName(partKey);

  const tag = spec.killSpecular ? '[kill-specular]' : '';
  console.log(`  ✓ ${partName.padEnd(4)} → mesh[${meshIdx}] node="${partKey}" 材质=${spec.name} ${tag}`);
  colored++;
}

await doc.transform(prune(), dedup());
const buf = await io.writeBinary(doc);
writeFileSync(output, buf);
console.log(`✓ ${fileKey}: ${input} → ${output} (${(buf.byteLength/1024).toFixed(1)} KB, ${colored} 零件着色)`);
