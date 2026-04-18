# 无碍药盒 · 3D 预览

欧阳天麒毕业设计展示页。扫展板二维码即可在手机/电脑上 360° 旋转查看药盒。

## 文件结构

```
.
├── index.html                 # 主页面（model-viewer）
├── assets/
│   └── combined.glb           # 组合态模型（清理后）
└── tools/
    └── clean-glb.mjs          # Rhino 导出的 glb 清理脚本
```

## Rhino 导出 glb 注意事项

Rhino 8 在 File → Export Selected 里选 `GLB (*.glb)` 即可。导出前**务必**：

1. `SelAll` 全选后 `Hide` 所有辅助几何
2. 只显示要展示的 brep/polysurface
3. 选中要导出的几何 → Export Selected → 文件类型选 GLB
4. 不要导出曲线（LINE_STRIP 会污染 bbox 导致 model-viewer 对不准焦）

## 清理 glb（可选）

若 Rhino 导出的 glb 里混进了参考曲线：

```bash
npm install
node tools/clean-glb.mjs assets/source.glb assets/combined.glb
```

脚本会：①删除所有 LINE_STRIP / POINTS 几何 ②整体居中到原点 ③压缩合并。
