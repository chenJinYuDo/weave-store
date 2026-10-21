declare module "three" {
  export const SRGBColorSpace: string

  export class Vector3 {
    set(x: number, y: number, z: number): this
    copy(value: Vector3): this
    add(value: Vector3): this
    subVectors(a: Vector3, b: Vector3): this
    setFromSpherical(spherical: Spherical): this
  }

  export class Spherical {
    theta: number
    setFromVector3(value: Vector3): this
  }

  export class Object3D {
    position: Vector3
  }

  export class Scene extends Object3D {
    add(...objects: Object3D[]): this
    remove(...objects: Object3D[]): this
  }

  export class Camera extends Object3D {}

  export class PerspectiveCamera extends Camera {
    constructor(fov: number, aspect: number, near: number, far: number)
    aspect: number
    updateProjectionMatrix(): void
  }

  export class Light extends Object3D {}

  export class AmbientLight extends Light {
    constructor(color: number, intensity?: number)
  }

  export class DirectionalLight extends Light {
    constructor(color: number, intensity?: number)
  }

  export class WebGLRenderer {
    constructor(parameters?: { antialias?: boolean; alpha?: boolean })
    domElement: HTMLCanvasElement
    outputColorSpace: string
    setPixelRatio(value: number): void
    setSize(width: number, height: number, updateStyle?: boolean): void
    render(scene: Scene, camera: Camera): void
    dispose(): void
  }
}

declare module "three/addons/controls/OrbitControls.js" {
  import { Camera, Vector3 } from "three"

  export class OrbitControls {
    constructor(camera: Camera, element?: HTMLElement)
    enabled: boolean
    enablePan: boolean
    minDistance: number
    maxDistance: number
    target: Vector3
    update(): boolean
    dispose(): void
  }
}

declare module "three/addons/loaders/GLTFLoader.js" {
  import { Object3D } from "three"

  export class GLTFLoader {
    load(
      url: string,
      onLoad: (gltf: { scene: Object3D }) => void,
      onProgress?: (event: ProgressEvent) => void,
      onError?: (error: unknown) => void,
    ): void
  }
}
