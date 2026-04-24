#!/usr/bin/env node
// 从两个 Rhino 原始 glb 读每个 mesh 的 geometry bbox center，
// 算出"爆炸位移 delta"（exploded - combined），供前端动画用。

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

const V_TO_PART = {
  10704: 'cap',
  21174: 'chamber',
  7406:  'ring',
  4983:  'disc',
  8305:  'pusher',
  196:   'shaft',
  1872:  'gear',
  15362: 'base',
};

async function readBBox(path) {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.read(path);
  const meshes = doc.getRoot().listMeshes();
  const result = {};
  for (const mesh of meshes) {
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    let V = 0;
    for (const p of mesh.listPrimitives()) {
      const pos = p.getAttribute('POSITION');
      if (!pos) continue;
      V += pos.getCount();
      const arr = pos.getArray();
      for (let j = 0; j < arr.length; j += 3) {
        for (let k = 0; k < 3; k++) {
          if (arr[j+k] < min[k]) min[k] = arr[j+k];
          if (arr[j+k] > max[k]) max[k] = arr[j+k];
        }
      }
    }
    const partName = V_TO_PART[V];
    if (!partName) continue;
    result[partName] = [
      (min[0] + max[0]) / 2,
      (min[1] + max[1]) / 2,
      (min[2] + max[2]) / 2,
    ];
  }
  return result;
}

const combined = await readBBox('/Volumes/互通/拟合.glb');
const exploded = await readBBox('/Volumes/互通/纵向拆解.glb');

// 先算原始 delta
const rawDelta = {};
for (const part of Object.keys(combined)) {
  const c = combined[part], e = exploded[part];
  if (!e) continue;
  rawDelta[part] = [e[0]-c[0], e[1]-c[1], e[2]-c[2]];
}

// 两个文件可能有整体 scene 平移（用户在 Rhino 里不同位置导出）
// 用 pusher（送药器）作为参考基准减掉整体平移（送药器的爆炸位移只在 Y 方向）
const base = rawDelta.pusher || [0,0,0];
const baseX = base[0], baseZ = base[2]; // Y 是真实爆炸，不减

console.log('// 从 Rhino 原始 glb 计算，单位: m（glb 默认）');
console.log('// 已减去整体 scene 平移，只保留零件相对爆炸位移');
console.log('const EXPLODE_DELTA = {');
for (const [part, d] of Object.entries(rawDelta)) {
  const dx = +(d[0] - baseX).toFixed(5);
  const dy = +d[1].toFixed(5);
  const dz = +(d[2] - baseZ).toFixed(5);
  console.log(`  ${part}: [${dx}, ${dy}, ${dz}],`);
}
console.log('};');

console.log('\n// 每个零件在 combined 状态下的 Rhino 空间质心（调试用）');
console.log('const COMBINED_CENTER = {');
for (const [part, c] of Object.entries(combined)) {
  console.log(`  ${part}: [${c.map(x => x.toFixed(3)).join(', ')}],`);
}
console.log('};');
