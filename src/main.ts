import { Scene, PerspectiveCamera, WebGLRenderer, AmbientLight, PointLight, Vector2, Raycaster } from 'three'
import './style.css'
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import { Graph } from "./Graph"
import data from './output.json' assert {type: 'json'}
import WebGL from 'three/examples/jsm/capabilities/WebGL'
let renderer: WebGLRenderer
let scene: Scene
let camera: PerspectiveCamera
const pointer = new Vector2()
const raycaster = new Raycaster()
const manipulator = new Graph()
//const profiling = new Clock()
// let t = 0
// let delta = 0
// function avgDelta(extra: number) {
//   const frames = 60
//   delta += (extra * 1000)
//   t++
//   if (t > frames) {
//     delta /= frames
//     console.log(`Delta over ${frames} frames: ${delta} milliseconds`)
//     t = 0
//     delta = 0
//   }
// }
function debug(state: boolean) {
  if (state) {
    Graph.addVertex( {name: "alvin", position: { x:10, y:0, z:10} } )
    Graph.addVertex( {name: "simon", position: { x:-10, y:0, z:-10}} )
    Graph.addVertex( {name: "dave", position: {x: 20, y: 0, z: -10}} )
    Graph.addEdge( {name: "brother", from: "simon", to: "alvin", directed: true} )
  } else {
    Graph.importData(data)
  }
}
function onPointerDown(event: PointerEvent) {
  // calculate pointer position in normalized device coordinates
	// (-1 to +1) for both components
  pointer.x = ( event.clientX / window.innerWidth ) * 2 - 1
  pointer.y = - ( event.clientY / window.innerHeight ) * 2 + 1

  raycaster.setFromCamera( pointer, camera )
  raycaster.layers.set( Graph.VERTEX_LAYER )
  const intersects = raycaster.intersectObjects( Graph.meshGroup.children, false )
  const element = intersects[0]
  if (typeof element === 'undefined') return

  // if not visible
  if (!element.object.layers.test(camera.layers)) return

  select(element.object.name)  
}
function select(element: string) {
  const newSelection = Graph.selectNeighborhood(element)
  if (newSelection) {
    camera.layers.set(Graph.SELECTED_LAYER)
  } else {
    camera.layers.set(Graph.ENABLED_LAYER)
  }
}
function init() {
  // performance monitoring
  
    // renderer
  const canvas = document.querySelector('#main')!
  renderer = new WebGLRenderer({
    canvas,
    antialias: true
  })
    renderer.setSize( window.innerWidth, window.innerHeight )
    renderer.setPixelRatio( window.devicePixelRatio )

  // camera
  camera = new PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 )
    camera.position.set( 0, 50, 80 )
    camera.lookAt( 0, 0, 0 )
    camera.layers.set(Graph.ENABLED_LAYER)
  // camera controls
  const controls = new OrbitControls( camera, renderer.domElement )

  // scene + lights
  scene = new Scene()
  // const grid = new GridHelper(100)
  // scene.add(grid)
  // lighting
  const pointLight = new PointLight(0xFFFFFF)
    pointLight.position.set(70,70,70)
    pointLight.layers.enableAll()
    scene.add( pointLight )
  const light = new AmbientLight( 0x606060 ); // soft white light
    light.layers.enableAll()
    scene.add( light )

  // graph
  debug(false)
  console.debug(Graph.meshGroup)
  scene.add( Graph.meshGroup )
  //Graph.selectNeighborhood("austin")

  Graph.update()
  controls.update()
}
function animate() {
  //profiling.start()
  requestAnimationFrame( animate )
  manipulator.labelRenderer.render( scene, camera )

  //avgDelta(profiling.getElapsedTime())
  //profiling.stop()
  
  renderer.render( scene, camera )
}

window.addEventListener('resize', function() {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize( window.innerWidth, window.innerHeight )
    manipulator.labelRenderer.setSize( window.innerWidth, window.innerHeight )
  }
)
window.addEventListener('pointerdown', onPointerDown)
if ( WebGL.isWebGLAvailable() ) {
	init()
	animate()
} else {
	const warning = WebGL.getWebGLErrorMessage()
	document.getElementById( 'main' )!.appendChild( warning )
}