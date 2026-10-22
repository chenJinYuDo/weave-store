import { useEffect, useRef, useState } from "react"
import * as THREE from "three"
import { OrbitControls } from "three/addons/controls/OrbitControls.js"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"

import { cn } from "cn"

export function DrapeView({
  url,
  urls,
  className,
  onReady,
  onFail,
}: {
  url?: string
  urls?: string[]
  className?: string
  onReady?: () => void
  onFail?: () => void
}) {
  const container = useRef<HTMLDivElement>(null)
  const rotate = useRef<(direction: number) => void>(() => {})
  const [yaw, setYaw] = useState(0)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const element = container.current
    if (!element) {
      return
    }
    setFailed(false)
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.domElement.className = "h-full w-full"
    element.appendChild(renderer.domElement)
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 20)
    camera.position.set(0, 0.05, 1.35)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enablePan = false
    controls.minDistance = 0.45
    controls.maxDistance = 3
    controls.target.set(0, 0, 0)
    scene.add(new THREE.AmbientLight(0xffffff, 0.85))
    const sun = new THREE.DirectionalLight(0xffffff, 1.15)
    sun.position.set(0.5, 1.1, 0.8)
    scene.add(sun)
    const offset = new THREE.Vector3()
    const spherical = new THREE.Spherical()
    rotate.current = (direction) => {
      offset.subVectors(camera.position, controls.target)
      spherical.setFromVector3(offset)
      spherical.theta += direction * 0.45
      offset.setFromSpherical(spherical)
      camera.position.copy(controls.target).add(offset)
      controls.update()
      setYaw(spherical.theta)
    }
    const remember = () => {
      offset.subVectors(camera.position, controls.target)
      spherical.setFromVector3(offset)
      setYaw(spherical.theta)
    }
    renderer.domElement.addEventListener("pointerup", remember)
    let frame = 0
    const draw = () => {
      frame = window.requestAnimationFrame(draw)
      controls.update()
      renderer.render(scene, camera)
    }
    const resize = () => {
      const width = element.clientWidth
      const height = element.clientHeight
      if (width === 0 || height === 0) {
        return
      }
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height, false)
    }
    const observer = new ResizeObserver(resize)
    observer.observe(element)
    resize()
    const list = urls ?? (url ? [url] : [])
    let model: THREE.Object3D | null = null
    const loader = new GLTFLoader()
    let cancel = false
    const loadOne = (item: string) =>
      new Promise<THREE.Object3D>((resolve, reject) => {
        loader.load(
          item,
          (gltf) => resolve(gltf.scene),
          undefined,
          () => reject(new Error(item)),
        )
      })
    void (async () => {
      const group = new THREE.Group()
      for (const item of list) {
        try {
          group.add(await loadOne(item))
          if (cancel) {
            return
          }
          if (item.includes("/body.gltf")) {
            onReady?.()
          }
        } catch {
          if (cancel) {
            return
          }
          if (item.includes("/body.gltf")) {
            onFail?.()
          } else {
            setFailed(true)
          }
        }
      }
      if (cancel || group.children.length === 0) {
        return
      }
      model = group
      scene.add(group)
      const box = new THREE.Box3().setFromObject(group)
      const center = box.getCenter(new THREE.Vector3())
      const size = box.getSize(new THREE.Vector3())
      controls.target.copy(center)
      const vertical = (camera.fov * Math.PI) / 360
      const horizontal = Math.atan(Math.tan(vertical) * Math.max(camera.aspect, 0.5))
      const distance =
        size.y > 1.2
          ? 1.075 / Math.tan(vertical)
          : Math.max(size.y / 2 / Math.tan(vertical), size.x / 2 / Math.tan(horizontal)) * 1.25
      controls.minDistance = Math.min(0.2, distance * 0.2)
      controls.maxDistance = Math.max(distance * 3, 8)
      camera.position.set(center.x, center.y, center.z + distance)
      camera.near = Math.max(0.01, distance / 100)
      camera.far = distance * 20
      camera.lookAt(center)
      camera.updateProjectionMatrix()
      controls.update()
      remember()
    })()
    draw()
    return () => {
      cancel = true
      window.cancelAnimationFrame(frame)
      observer.disconnect()
      if (model) {
        scene.remove(model)
      }
      renderer.domElement.removeEventListener("pointerup", remember)
      controls.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [url, urls?.join("|")])

  return (
    <div
      ref={container}
      tabIndex={0}
      data-yaw={yaw.toFixed(3)}
      aria-label="垂坠结果"
      onPointerDown={() => container.current?.focus()}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") {
          rotate.current(1)
        }
        if (event.key === "ArrowLeft") {
          rotate.current(-1)
        }
      }}
      className={cn(
        "relative overflow-hidden rounded-[16px] bg-muted outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF]",
        className,
      )}
    >
      {failed ? (
        <p className="p-4 text-[17px] text-muted-foreground">垂坠没有完成</p>
      ) : null}
    </div>
  )
}
