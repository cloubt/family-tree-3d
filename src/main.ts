import { Scene, PerspectiveCamera, WebGLRenderer, AmbientLight, PointLight, Clock, GridHelper, Vector2, Raycaster } from 'three'
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
const profiling = new Clock()
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
function onPointerDown(event: PointerEvent) {
  // calculate pointer position in normalized device coordinates
	// (-1 to +1) for both components
  pointer.x = ( event.clientX / window.innerWidth ) * 2 - 1
  pointer.y = - ( event.clientY / window.innerHeight ) * 2 + 1

  raycaster.setFromCamera( pointer, camera )
  const intersects = raycaster.intersectObjects( scene.children, false )
  intersects.forEach(i => {
    // ensure vertex selected
    if (!i.object.isObject3D) return
    if (i.object.name === '') return
    console.debug(Graph.getNeighborhood(i.object.name))

  })
  console.debug(intersects)
}

function init() {
  // performance monitoring
  
    // renderer
  const canvas = document.querySelector('#main')!
  renderer = new WebGLRenderer({
    canvas,
  })
    renderer.setSize( window.innerWidth, window.innerHeight )
    renderer.setPixelRatio( window.devicePixelRatio )

  // camera
  camera = new PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 )
    camera.position.set( 0, 0, 30 )
    camera.lookAt( 0, 0, 0 )

  // camera controls
  const controls = new OrbitControls( camera, renderer.domElement )

  // scene
  scene = new Scene()
  // const grid = new GridHelper(100)
  // scene.add(grid)
  // lighting
  const pointLight = new PointLight(0xFFFFFF)
    pointLight.position.set(20,20,20)
    scene.add( pointLight )
  const light = new AmbientLight( 0x606060 ); // soft white light
    scene.add( light )

  // graph

  // Graph.addVertex( {name: "alvin", position: { x:10, y:0, z:10} } )
  // Graph.addVertex( {name: "simon", position: { x:-10, y:0, z:-10}} )
  // Graph.addVertex( {name: "dave", position: {x: 20, y: 0, z: -10}} )
  // Graph.addEdge( {name: "brother", from: "simon", to: "alvin", directed: true} )
  Graph.importData(data)
  Graph.getVertices().forEach((vertex) => scene.add( vertex.mesh! ))
  Graph.getEdges().forEach(edge => scene.add( edge.lineMesh! ) )
  Graph.update()
  controls.update()
}
function animate() {
  profiling.start()
  requestAnimationFrame( animate )
  manipulator.labelRenderer.render( scene, camera )

  //avgDelta(profiling.getElapsedTime())
  profiling.stop()
  
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