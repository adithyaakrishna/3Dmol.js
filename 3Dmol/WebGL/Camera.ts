import type { Quaternion } from './math/Quaternion';
import { Object3D } from './core/Object3D';
import { Matrix4 } from './math';
/*
 * Simplified Perspective Camera
 */

/** @constructor */
export class Camera extends Object3D {
  fov: any;
  aspect: any;
  near: any;
  far: any;
  projectionMatrix: any;
  projectionMatrixInverse: any;
  matrixWorldInverse: any;
  right: number;
  left: number;
  top: number;
  bottom: number;
  ortho: boolean; constructor(fov, aspect, near, far, ortho) {
    super();

    this.fov = fov !== undefined ? fov : 50;
    this.aspect = aspect !== undefined ? aspect : 1;
    this.near = near !== undefined ? near : 0.1;
    this.far = far !== undefined ? far : 2000;

    this.projectionMatrix = new Matrix4();
    this.projectionMatrixInverse = new Matrix4();
    this.matrixWorldInverse = new Matrix4();

    var center = this.position.z;
    this.right = center * Math.tan(Math.PI / 180 * fov);
    this.left = -this.right;
    this.top = this.right / this.aspect;
    this.bottom = -this.top;

    this.ortho = !!ortho;

    this.updateProjectionMatrix();

  };


  lookAt(vector) {

    //Why is the parameter order switched (compared to Object3D)?
    this.matrix.lookAt(this.position, vector, this.up);

    if (this.rotationAutoUpdate) {

      if (this.useQuaternion === false)
        this.rotation.setEulerFromRotationMatrix(this.matrix, this.eulerOrder);
      else
        this.quaternion.copy(this.matrix.decompose()[1] as Quaternion);

    }

  };

  updateProjectionMatrix() {
    if (this.ortho) {
      this.projectionMatrix.makeOrthographic(this.left, this.right, this.top, this.bottom, this.near, this.far);
    } else {
      this.projectionMatrix.makePerspective(this.fov, this.aspect, this.near, this.far);
    }

    this.projectionMatrixInverse.getInverse(this.projectionMatrix);
  };
}