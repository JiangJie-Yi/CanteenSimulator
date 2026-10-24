// "Camera 1": the fixed view the shop is worked from while the kitchen is being tried out (the shop's closed). It starts as the home view of the
// dish on show, and the owner can move it (a shift of the position, in the world) and turn it (a turn about the vertical and a tilt, in degrees) in
// edit mode, where it's drawn as a camera in the scene.
import * as THREE from 'three'

export type V3 = [number, number, number]

/**
 * The pose camera 1 takes from the home view: the camera moved by `shift` (it keeps looking the same way), then turned `yaw` degrees about the vertical
 * and tilted `pitch` degrees about its own right-hand side (up is positive), the way it looks being what's returned as a point to look at.
 */
export function cameraOneOf(home: THREE.Vector3, homeTarget: THREE.Vector3, shift: V3, turn: V3) {
  const position = home.clone().add(new THREE.Vector3(...shift))
  const dir = homeTarget.clone().sub(home)
  const length = dir.length() || 1
  dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), (turn[1] * Math.PI) / 180)
  const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize()
  if (right.lengthSq() > 0) dir.applyAxisAngle(right, (turn[0] * Math.PI) / 180)
  const target = position.clone().add(dir.normalize().multiplyScalar(length))
  return { position, target }
}
