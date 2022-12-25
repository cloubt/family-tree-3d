import { CSS2DObject, CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer"
import {
    Color,
    ConeGeometry,
    Group,
    LineCurve3,
    Mesh,
    MeshLambertMaterial,
    QuadraticBezierCurve3,
    SphereGeometry,
    TubeGeometry,
    Vector3
} from 'three'
// up direction required for the arrow heads in directed edges to point in correct direction
const DEFAULT_UP = new Vector3(0, 1, 0)
function capitalize(string: string) {
    return string.at(0)?.toUpperCase() + string.slice(1)
}

class Graph {
    static readonly VERTEX_LAYER = 1
    static readonly EDGE_LAYER = 2
    static readonly ENABLED_LAYER = 0
    static readonly SELECTED_LAYER = 5

    readonly labelRenderer: CSS2DRenderer
    static readonly edges = new Map<string, Edge>()
    static readonly vertices = new Map<string, Vertex>()
    static meshGroup = new Group()
    static selectedNeighborhood = new Set<Vertex | Edge>()
    static selectedElement= ""
    constructor() {
        this.labelRenderer = new CSS2DRenderer()
        this.labelRenderer.setSize(window.innerWidth, window.innerHeight)
        this.labelRenderer.domElement.id = 'labelRenderer'
        document.body.appendChild(this.labelRenderer.domElement)

        Graph.meshGroup.name = "meshGroup"
        Graph.meshGroup.layers.enableAll()
    }

    static addVertex(parameters: VertexParameters): void {
        Graph.vertices.set( parameters.name, new Vertex(parameters) )
        //const vertex = Graph.getVertex( parameters.name )
    }
    static addEdge(parameters: EdgeParameters): void {
        // create
        if (!Graph.vertices.has(parameters.from)) throw new Error(`Could not find source vertex ${parameters.from}`)
        if (!Graph.vertices.has(parameters.to)) throw new Error(`Could not find source vertex ${parameters.to}`)
        if (parameters.directed === true) {
            const _ = new DirectedEdge(parameters)
            Graph.edges.set(_.lineGeometry.uuid, _)
            Graph.update(_.lineGeometry.uuid)
        } else {
            const _ = new Edge(parameters)
            Graph.edges.set(_.lineGeometry.uuid, _)
            Graph.update(_.lineGeometry.uuid)
        }
    }

    static getVertices(filter?: (value: Vertex, index?: number, array?: Vertex[]) => Vertex[]): Vertex[] {
        if (!filter) return [...Graph.vertices.values()]
        return [...Graph.vertices.values()].filter(filter) // spread operator trolling
    }
    static getEdges(filter?: (value: Edge, index: number, array: Edge[]) => Edge[]): Edge[] {
        if (!filter) return [...Graph.edges.values()]
        return [...Graph.edges.values()].filter(filter) // spread operator trolling
    }

    static getVertex(name: string): Vertex {
        const _ = Graph.vertices.get(name)
        if (_ === undefined) throw new Error(`Could not get vertex named ${name}`)
        return _
    }

    static getEdge(from: string, to?: string): Edge {
        if (typeof to === 'undefined') {
            const edge = Graph.edges.get(from)
            if (typeof edge === 'undefined') throw new Error(`Edge of uuid ${from} not found!`)
            return edge
        }
        const source = Graph.vertices.get(from)
        if (source === undefined) throw new Error(`Source ${from} does not exist!`)
        const dest = Graph.vertices.get(to)
        if (dest === undefined) throw new Error(`target vertex ${to} does not exist!`)
        const _ = [...Graph.edges.values()].find(edge => edge.source === source && edge.target === dest) ??
            [...Graph.edges.values()].find(edge => edge.source === dest && edge.target === source)
        if (_ === undefined) throw new Error(`Could not find the edge between ${from} and ${to}!`)
        return _
    }
    static getNeighborhood(object: string): Array<Edge | Vertex> {
        if (!Graph.vertices.has(object)) throw new Error(`Could not get neighborhood for nonexistent vertex ${object}!`)
        const arr: Set<string> = new Set()
        // connected edges
        Graph.edges.forEach(element => {
            if (element.source.name === object || element.target.name === object) {
                arr.add(element.uuid)
                arr.add(element.target.name)
                arr.add(element.source.name)
            }
        })
        // get actual stuff
        const _: Array<Edge|Vertex> = []
        arr.forEach(identifier => {
            // cheeky way to check if edge or not
            try {
                _.push(Graph.getEdge(identifier))
            } catch {
                _.push(Graph.getVertex(identifier))
            }
        })
        if (_.length === 0) return [Graph.getVertex(object)]
        return _

    }
    /*
    https://threejs.org/examples/?q=group#misc_animation_groups
    static highlightNeighborhood(object: string, scene: Array, color?: Color): void {
        const darkenKF = new NumberKeyframeTrack( '.material.opacity', [0, 1], [1, 0], InterpolateSmooth )
        const brightenKF = new NumberKeyframeTrack( '.material.opacity', [0, 1], [0, 1], InterpolateSmooth )
        const brightenClip = new AnimationClip( 'lighten', 1, [brightenKF])
        const darkenClip = new AnimationClip( 'darken', 1, [darkenKF])
        const neighborhoodGroup = new AnimationObjectGroup(...Graph.getNeighborhood(object))
        const sceneGroup = new AnimationObjectGroup(...scene)
        // add mixer, add clip action, add update in renderer
        
    }
    */
    // returns boolean stating whether or not it is a new selection
    
    static selectNeighborhood(object: string): boolean {
        if (!Graph.vertices.has(object)) throw new Error(`Invalid vertex name ${object}! Please only provide vertex names`)
        // clear set
        Graph.selectedNeighborhood.forEach((element) => {
            element.disable(Graph.SELECTED_LAYER)
            Graph.selectedNeighborhood.delete(element)
        })
        // turn off if you click the same person
        console.debug(Graph.selectedElement !== object)
        if (Graph.selectedElement === object) return false
        Graph.selectedElement = object
        const neighborhood = Graph.getNeighborhood(object)
        neighborhood.forEach(element => {
            Graph.selectedNeighborhood.add(element)
            element.enable(Graph.SELECTED_LAYER)
        })
        return true
    }

    // optimize this maybe
    static update(identifier?: string) {
        if (typeof identifier !== "undefined") {
            Graph.edges.get(identifier)?.updateEdgePosition()
            return
        }
        Graph.edges.forEach(edge => edge.updateEdgePosition())
    }

    static importData(elements: ImportDataParameters[]): any {
        elements.forEach((element: ImportDataParameters) => {
            if (element.data === "vertex") {
                Graph.vertices.set(element.name.toLowerCase(), new Vertex({
                    name: element.name.toLowerCase(),
                    position: new Vector3().randomDirection().setLength(50)
                }))
            } else if (element.data === "edge") {
                if (typeof element.to === "undefined"
                    || typeof element.from === "undefined"
                    || typeof element.directed === "undefined") throw new Error(`Edge ${element.name} had malformed source and/or target vertices!`)
                Graph.addEdge({
                    name: element.name.toLowerCase(),
                    from: element.from.toLowerCase(),
                    to: element.to.toLowerCase(),
                    directed: element.directed
                })
            } else {
                console.debug(element)
                throw new Error("something bad happened")
            }
        })
    }
}

class Vertex {
    name: string
    color: Color
    radius: number // 5
    widthSegments: number // 16
    heightSegments: number // 8
    geometry: SphereGeometry
    readonly material: MeshLambertMaterial
    readonly mesh: Mesh<SphereGeometry, MeshLambertMaterial>
    readonly label: Label

    constructor(parameters: VertexParameters) {
        this.name = parameters.name.toLowerCase()
        this.radius = parameters.radius ?? 3
        this.widthSegments = parameters.widthSegments ?? 16
        this.heightSegments = parameters.heightSegments ?? 8
        this.color = new Color(parameters.color ?? Math.random() * 0xFFFFFF)

        this.geometry = new SphereGeometry(this.radius, this.widthSegments, this.heightSegments)
        //this.material = new MeshStandardMaterial( { color: this.color } )
        this.material = new MeshLambertMaterial({ color: this.color, transparent: true })
        this.mesh = new Mesh(this.geometry, this.material)
            this.mesh.position.set(parameters.position.x, parameters.position.y, parameters.position.z)
            this.mesh.name = this.name
            this.mesh.layers.enable(Graph.VERTEX_LAYER)
            this.mesh.layers.enable(Graph.ENABLED_LAYER)
            Graph.meshGroup.add(this.mesh)
        this.label = new Label(this.name, "label vertex")
        this.mesh.add(this.label.object)
        console.debug(`added new vertex named ${this.name}!`)
        console.debug(this.mesh.position)
    }

    get position(): Vector3 {
        return this.mesh.position;
    }
    disable(layer?: number) {
        if (typeof layer === 'undefined') {
            this.mesh.layers.disableAll()
            this.mesh.layers.disableAll()
            return
        }
        this.mesh.layers.disable(layer)
        this.label.object.layers.disable(layer)
    }
    enable(layer: number) {
        this.mesh.layers.enable(layer)
        this.label.object.layers.enable(layer)
    }
}
class Edge {
    value: string
    color?: Color
    source: Vertex
    target: Vertex

    //drawCount: number
    readonly label: Label
    readonly material: MeshLambertMaterial
    lineGeometry: TubeGeometry
    lineMesh: Mesh
    path: LineCurve3
    readonly tube: { radius: number, tubularSegments: number, radialSegments: number }
    constructor(parameters: EdgeParameters) {
        this.value = parameters.name
        this.source = Graph.getVertex(parameters.from)
        this.target = Graph.getVertex(parameters.to)
        this.color = parameters.color ?? new Color( Math.random() * 0xFFFFFF ) // this.source.color //

        this.path = new LineCurve3(this.source.position, this.target.position)
        this.tube = {
            radius: 0.25,
            tubularSegments: 20,
            radialSegments: 7
        }
        this.material = new MeshLambertMaterial({ color: this.color, transparent: true })
        this.lineGeometry = new TubeGeometry(this.path, this.tube.tubularSegments, this.tube.radius, this.tube.radialSegments, false)
        this.lineMesh = new Mesh(this.lineGeometry, this.material)
            this.lineMesh.layers.enable(Graph.EDGE_LAYER)
            this.label = new Label(this.value)
            this.lineMesh.add(this.label.object)
            Graph.meshGroup.add(this.lineMesh)
    }

    get uuid() {
        return this.lineGeometry.uuid
    }
    updateEdgePosition(from?: string, to?: string) {
        if (from) {
            this.source = Graph.getVertex(from)
        }
        if (to) {
            this.target = Graph.getVertex(to)
        }
        this.label.object.position.copy(this.path.getPointAt(0.45))
    }
    disable(layer?: number) {
        if (typeof layer === 'undefined') {
            this.lineMesh.layers.disableAll()
            this.lineMesh.layers.disableAll()
            return
        }
        this.lineMesh.layers.disable(layer)
        this.label.object.layers.disable(layer)
    }
    enable(layer: number) {
        this.lineMesh.layers.enable(layer)
        this.label.object.layers.enable(layer)
    }
}
class DirectedEdge extends Edge {
    readonly arrowGeometry: ConeGeometry
    readonly arrowMesh: Mesh<ConeGeometry, MeshLambertMaterial>
    private readonly arrowRadius: number
    private readonly arrowLength: number

    constructor(parameters: EdgeParameters) {
        super(parameters)
        this.arrowRadius = 1
        this.arrowLength = 3
        this.color = this.source.color
        this.material.color.set( this.color )
        // deal with this
        // console.debug(`Path before operation:`)
        // console.debug(this.path.v2)
        //this.path.v2.add(new Vector3(0,10,0))
        // const matrix = new Matrix4().makeScale(1,1,2).makeRotationFromEuler(new Euler(0.5, 0.6, 0, 'XYZ'))
        // this.lineGeometry.applyMatrix4(matrix)
        // console.debug(`Path after operation:`)
        // console.debug(this.path.v2)
        const binormal = this.path.computeFrenetFrames(3).binormals[1].setLength(3)
        console.debug(`binormal vector for edge going from ${this.source.name} to ${this.target.name}`)
        console.debug(binormal)

        this.arrowGeometry = new ConeGeometry(this.arrowRadius, this.arrowLength, 7)
        this.arrowGeometry.translate(0, (-this.arrowLength / 2) - this.target.radius, 0)
        this.arrowGeometry.rotateX(-Math.PI / 2)
        //const matrix = new Matrix4().makeTranslation(1,3,2).makeRotationAxis()
        this.arrowMesh = new Mesh(this.arrowGeometry, this.material)
        this.arrowMesh.matrixAutoUpdate = false
        this.arrowMesh.layers.enable(Graph.EDGE_LAYER)

        this.path = new QuadraticBezierCurve3(
            this.source.position.clone(),
            // binormal vector converted to world coordinates
            this.source.position.clone().lerp(this.target.position, 0.5).add(binormal),
            this.target.position.clone()
        )
        Graph.meshGroup.remove(this.lineMesh)
        this.lineGeometry.dispose()
            this.lineGeometry = new TubeGeometry(this.path, this.tube.tubularSegments, this.tube.radius, this.tube.radialSegments, false)
        this.lineMesh.geometry.dispose()
            this.lineMesh = new Mesh(this.lineGeometry, this.material)
            this.lineMesh.layers.enable(Graph.EDGE_LAYER)
            this.lineMesh.attach(this.arrowMesh)
            this.lineMesh.attach(this.label.object)
            Graph.meshGroup.add(this.lineMesh)
    }
    // GET POINT TO SHOW UP AND ANGLE ACCURATELY :)
    updateEdgePosition() {
        super.updateEdgePosition()
        // arrow
        this.arrowMesh.matrix.setPosition(this.target.position)
        this.arrowMesh.matrix.lookAt(
            this.path.getPointAt(0.85),
            this.target.position,
            DEFAULT_UP
        )
    }
    disable(layer?: number) {
        super.disable(layer)
        if (typeof layer === 'undefined') {
            this.arrowMesh.layers.disableAll()
            return
        }
        this.arrowMesh.layers.disable(layer)
    }
    enable(layer: number) {
        super.enable(layer)
        this.arrowMesh.layers.enable(layer)

    }
}
class Label {
    element: HTMLDivElement
    object: CSS2DObject
    // textDiv.className = 'label'
    // textDiv.textContent = 'hello testing'
    constructor(content: string, className?: string) {
        this.element = document.createElement('div')
        this.element.className = className ?? 'label'
        this.element.textContent = capitalize(content) ?? 'Empty'
        this.object = new CSS2DObject(this.element)
    }
}

interface VertexParameters {
    name: string
    color?: Color
    position: Vector3Parameters
    radius?: number // 5
    widthSegments?: number // 16
    heightSegments?: number // 8
}
interface Vector3Parameters {
    x: number
    y: number
    z: number
}
interface EdgeParameters {
    name: string
    from: string
    to: string
    directed?: boolean
    color?: Color
}
interface ImportDataParameters {
    data: string
    name: string
    from?: string
    to?: string
    directed?: boolean
    color?: Color
    position?: Vector3Parameters
}

export {
    Graph
}