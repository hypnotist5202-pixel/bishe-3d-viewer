#!/usr/bin/env node
// 读取三个原始 glb，输出每个 mesh 的几何指纹（V 数 + bbox）
// exploded-v 按 Y 轴从上到下排序（对应纵向爆炸图零件层级）
// 其他两个按 V 数匹配跨文件找同一零件

import { NodeIO } from '@gltf-transform/core';
import { prune } from '@gltf-transform/functions';

const files = [
  { name: 'exploded-v (纵向)', path: '/Volumes/互通/纵向拆解.glb' },
  { name: 'combined  (装配)', path: '/Volumes/互通/拟合.glb' },
];

const io = new NodeIO();

async function analyze(file) {
  const doc = await io.read(file.path);
  await doc.transform(prune());
  const meshes = doc.getRoot().listMeshes();
  return meshes.map((m, i) => {
    let totalV = 0;
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (const p of m.listPrimitives()) {
      const pos = p.getAttribute('POSITION');
      if (!pos) continue;
      totalV += pos.getCount();
      const arr = pos.getArray();
      for (let j = 0; j < arr.length; j += 3) {
        for (let k = 0; k < 3; k++) {
          if (arr[j+k] < min[k]) min[k] = arr[j+k];
          if (arr[j+k] > max[k]) max[k] = arr[j+k];
        }
      }
    }
    return {
      idx: i,
      V: totalV,
      cx: (min[0]+max[0])/2,
      cy: (min[1]+max[1])/2,
      cz: (min[2]+max[2])/2,
      sx: max[0]-min[0],
      sy: max[1]-min[1],
      sz: max[2]-min[2],
    };
  });
}

const results = {};
for (const f of files) {
  results[f.name] = await analyze(f);
}

// 输出 exploded-v 按 Y 从高到低排（对应纵向爆炸图：上盖→底座）
console.log('\n═════ exploded-v 按 Y 从上到下排（对应纵向爆炸图零件层级） ═════');
const vList = [...results['exploded-v (纵向)']].sort((a,b) => b.cy - a.cy);
vList.forEach((d, rank) => {
  console.log(`  [上→下#${rank+1}] mesh[${d.idx}] V=${String(d.V).padStart(5)} Y中心=${d.cy.toFixed(3)} 尺寸(x×y×z)=(${d.sx.toFixed(3)}×${d.sy.toFixed(3)}×${d.sz.toFixed(3)})`);
});

// 输出 combined 按 mesh idx
console.log(`\n═════ combined (装配) (按 mesh idx 列出，用 V 数匹配同一零件) ═════`);
results['combined  (装配)'].forEach(d => {
  console.log(`  mesh[${d.idx}] V=${String(d.V).padStart(5)} 中心(${d.cx.toFixed(2)},${d.cy.toFixed(2)},${d.cz.toFixed(2)}) 尺寸=(${d.sx.toFixed(3)}×${d.sy.toFixed(3)}×${d.sz.toFixed(3)})`);
});

// 跨文件匹配表：按 V 数把两个文件的 mesh 串起来
console.log('\n═════ 跨文件零件匹配表（按 V 数唯一指纹） ═════');
console.log('  V数      exploded-v  combined');
const vData = results['exploded-v (纵向)'];
const cData = results['combined  (装配)'];
const allVs = [...new Set([...vData, ...cData].map(d => d.V))].sort((a,b) => b-a);
for (const V of allVs) {
  const vi = vData.find(d => d.V === V);
  const ci = cData.find(d => d.V === V);
  const fmt = (x) => x ? `mesh[${x.idx}]`.padEnd(10) : '(无)      ';
  console.log(`  ${String(V).padStart(5)}    ${fmt(vi)}  ${fmt(ci)}`);
}
