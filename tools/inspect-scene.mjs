#!/usr/bin/env node
// 探索 combined.glb 的 scene graph：节点名 / 层级 / mesh 引用 / 初始 transform
// 目的：确认每个零件是独立 node 可单独驱动位移/旋转（前端 JS 做机械动画的地基）

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

const path = process.argv[2] || 'assets/combined.glb';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(path);
const root = doc.getRoot();
const scene = root.getDefaultScene() || root.listScenes()[0];
const meshes = root.listMeshes();

// 建 mesh → V 数（指纹反向匹配零件名）
const V_TO_PART = {
  10704: '上盖',
  21174: '药仓',
  7406:  '限位环',
  4983:  '限位盘',
  8305:  '送药器',
  196:   '齿轴',
  1872:  '齿轮',
  15362: '底座',
};

function meshFingerprint(mesh) {
  let V = 0;
  for (const p of mesh.listPrimitives()) {
    const pos = p.getAttribute('POSITION');
    if (pos) V += pos.getCount();
  }
  return V;
}

function walk(node, depth = 0) {
  const indent = '  '.repeat(depth);
  const name = node.getName() || '(无名)';
  const t = node.getTranslation();
  const r = node.getRotation();
  const s = node.getScale();
  const mesh = node.getMesh();
  let label = `${indent}[node] "${name}"`;
  if (mesh) {
    const idx = meshes.indexOf(mesh);
    const V = meshFingerprint(mesh);
    const partName = V_TO_PART[V] || '?';
    label += ` → mesh[${idx}] V=${V} ${partName ? `【${partName}】` : ''}`;
  }
  console.log(label);
  console.log(`${indent}    T=(${t.map(x => x.toFixed(3)).join(', ')}) R=(${r.map(x => x.toFixed(3)).join(', ')}) S=(${s.map(x => x.toFixed(3)).join(', ')})`);
  for (const child of node.listChildren()) walk(child, depth + 1);
}

console.log(`═════ Scene Graph: ${path} ═════`);
for (const n of scene.listChildren()) walk(n);

console.log(`\n═════ 可寻址性验证 ═════`);
const allNodes = root.listNodes();
const meshNodes = allNodes.filter(n => n.getMesh());
console.log(`total nodes: ${allNodes.length} · mesh-bearing nodes: ${meshNodes.length}`);
console.log(`→ 每个零件是否独立 node：${meshNodes.length === meshes.length ? '✓ 是（可单独驱动）' : '✗ 否（需要 split mesh）'}`);
