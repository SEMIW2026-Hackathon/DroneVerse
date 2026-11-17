import * as THREE from 'three';

export const SPARROW_ROTOR_CENTERS = [
  new THREE.Vector3(-0.249, 0.11, -0.132),
  new THREE.Vector3(0.249, 0.11, -0.132),
  new THREE.Vector3(-0.249, 0.11, 0.132),
  new THREE.Vector3(0.249, 0.11, 0.132),
] as const;

function meshesUnder(root: THREE.Object3D): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) meshes.push(object);
  });
  return meshes;
}

function findObject(scene: THREE.Object3D, names: string[]) {
  let match: THREE.Object3D | undefined;
  scene.traverse((object) => {
    if (!match && names.includes(object.name)) match = object;
  });
  return match;
}

function splitMeshes(
  meshes: THREE.Mesh[],
  modelRoot: THREE.Object3D,
  centers: readonly THREE.Vector3[],
): THREE.BufferGeometry[] {
  const positions = centers.map(() => [] as number[]);
  const rootInverse = modelRoot.matrixWorld.clone().invert();
  for (const mesh of meshes) {
    mesh.updateWorldMatrix(true, false);
    const toRoot = new THREE.Matrix4().multiplyMatrices(rootInverse, mesh.matrixWorld);
    const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
    const position = geometry.getAttribute('position');
    for (let vertex = 0; vertex < position.count; vertex += 3) {
      const points = [0, 1, 2].map((offset) =>
        new THREE.Vector3().fromBufferAttribute(position, vertex + offset).applyMatrix4(toRoot),
      );
      const centroid = points
        .reduce((sum, point) => sum.add(point), new THREE.Vector3())
        .multiplyScalar(1 / 3);
      let nearest = 0;
      let nearestDistance = Infinity;
      centers.forEach((center, index) => {
        const distance = Math.hypot(centroid.x - center.x, centroid.z - center.z);
        if (distance < nearestDistance) {
          nearest = index;
          nearestDistance = distance;
        }
      });
      const center = centers[nearest]!;
      points.forEach((point) =>
        positions[nearest]!.push(point.x - center.x, point.y - center.y, point.z - center.z),
      );
    }
    if (geometry !== mesh.geometry) geometry.dispose();
  }
  return positions.map((vertices) => {
    const result = new THREE.BufferGeometry();
    result.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    result.computeVertexNormals();
    return result;
  });
}

export function splitSparrowParts(scene: THREE.Group) {
  scene.updateWorldMatrix(true, true);
  const fanRoot = findObject(scene, ['Fan.006_20', 'Fan006_20']);
  const guardRoot = findObject(scene, ['Circle_16']);
  if (!fanRoot || !guardRoot) throw new Error('Sparrow GLB is missing fan or guard-ring meshes');
  const fanGeometry = splitMeshes(meshesUnder(fanRoot), scene, SPARROW_ROTOR_CENTERS);
  const guardGeometry = splitMeshes(meshesUnder(guardRoot), scene, SPARROW_ROTOR_CENTERS);
  const body = scene.clone(true);
  const bodyFanRoot = findObject(body, ['Fan.006_20', 'Fan006_20']);
  bodyFanRoot!.visible = false;
  body.getObjectByName('Circle_16')!.visible = false;
  body.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.material = new THREE.MeshStandardMaterial({
        color: '#f8fafc',
        roughness: 0.48,
        metalness: 0.08,
      });
    }
  });
  const bounds = new THREE.Box3().setFromObject(body);
  const width = Math.max(bounds.max.x - bounds.min.x, bounds.max.z - bounds.min.z, 1);
  return { body, fanGeometry, guardGeometry, scale: 2.4 / width };
}
