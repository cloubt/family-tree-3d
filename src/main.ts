import { Scene, PerspectiveCamera, WebGLRenderer, AmbientLight, PointLight, GridHelper, Color, ArrowHelper, Vector3 } from 'three'
import './style.css'
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import { Graph } from "./Graph"
import WebGL from 'three/examples/jsm/capabilities/WebGL'

let renderer: WebGLRenderer
let scene: Scene
let camera: PerspectiveCamera
const manipulator = new Graph()
let t = 0

function init() {
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

// controls
const controls = new OrbitControls( camera, renderer.domElement )

// scene
scene = new Scene()
const hi = new GridHelper(100, 100)
scene.add(hi)

// lighting
const pointLight = new PointLight(0xFFFFFF)
  pointLight.position.set(20,20,20)
  scene.add( pointLight )
const light = new AmbientLight( 0x606060 ); // soft white light
  scene.add( light )

// graph
manipulator.addVertex({name: "+x", position: {x: 15, y: 0, z: 15}})
manipulator.addVertex({name: "simon", position: {x: 0, y: 0, z: 0}})
manipulator.addVertex( {name: "+z", position: {x: -15, y: 0, z: 45}} )
Graph.getVertices().forEach((vertex) => scene.add( vertex.mesh! ))
manipulator.addEdge( {value: "pee", from: "+x", to: "simon"} )
manipulator.addEdge( {value: "hello", from: "+z", to: "simon", directed: true, color: new Color(0x00FF00)} )
//scene.add(Graph.getEdge("+z", "+x").arrowMesh)
//manipulator.addEdge( {value: "poop", from: "simon", to: "+z"} )
Graph.getEdges().forEach(edge => scene.add( edge.lineMesh! ) )

controls.update()
}
function animate() {

  requestAnimationFrame( animate )
  t += 0.005
  manipulator.labelRenderer.render( scene, camera )
  Graph.vertices.get("simon")!.mesh.position.set(Math.cos(t) * 20, Math.sin(t) * 20, 0)
  manipulator.update()

  renderer.render( scene, camera )
}


init()
if ( WebGL.isWebGLAvailable() ) {
	// Initiate function or other initializations here
	animate()
} else {
	const warning = WebGL.getWebGLErrorMessage()
	document.getElementById( 'main' )!.appendChild( warning )
}

window.addEventListener('resize', function() {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize( window.innerWidth, window.innerHeight )
    manipulator.labelRenderer.setSize( window.innerWidth, window.innerHeight )
  }
)