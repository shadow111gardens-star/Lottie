import type { Scene } from '../editor/model';
export type ProjectCategory = 'SVG' | 'Lottie' | 'Video' | 'Images';
export function sceneCategory(scene: Scene): ProjectCategory {
  if (scene.layers.some(layer => layer.media?.kind === 'video')) return 'Video';
  if (scene.layers.some(layer => layer.media?.kind === 'gif') || scene.files?.source?.some(file => /\.(png|jpe?g|webp|gif)$/i.test(file.name))) return 'Images';
  if (scene.lottie || scene.files?.lottie) return 'Lottie';
  return 'SVG';
}
export function projectCategory(project: { scene: Scene; category?: ProjectCategory; type: string }): ProjectCategory {
  return project.category ?? (project.scene.layers.length || project.scene.files || project.scene.lottie ? sceneCategory(project.scene) : project.type === 'Animation' ? 'Lottie' : 'SVG');
}
