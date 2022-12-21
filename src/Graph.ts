import { CSS2DObject, CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer"
import {
    Color,
    ConeGeometry,
    LineCurve3,
    Mesh,
    MeshLambertMaterial,
    MeshStandardMaterial,
    QuadraticBezierCurve3,
    SphereGeometry,
    TubeGeometry,
    Vector3
} from 'three'
// up direction required for the arrow heads in directed edges to point in correct direction
const DEFAULT_UP = new Vector3(0, 1, 0)



class Graph {
    readonly labelRenderer: CSS2DRenderer
    static readonly edges = new Map<string, Edge>()
    static readonly vertices = new Map<string, Vertex>()

    constructor() {
        this.labelRenderer = new CSS2DRenderer()
        this.labelRenderer.setSize(window.innerWidth, window.innerHeight)
        this.labelRenderer.domElement.id = 'labelRenderer'
        document.body.appendChild(this.labelRenderer.domElement)
        
        // document.addEventListener( 'pointerup', onPointerUp );
        // document.addEventListener( 'pointermove', onPointerMove );
        // ColorManagement.legacyMode = false;
    }

    static addVertex(parameters: VertexParameters): void {
        Graph.vertices.set(parameters.name, new Vertex(parameters))
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
                Graph.vertices.set(element.name, new Vertex({
                    name: element.name,
                    position: new Vector3().randomDirection().setLength(50)
                }))
            } else if (element.data === "edge") {
                if (typeof element.to === "undefined"
                    || typeof element.from === "undefined"
                    || typeof element.directed === "undefined") throw new Error(`Edge ${element.name} had malformed source and/or target vertices!`)
                Graph.addEdge({
                    name: element.name,
                    from: element.from,
                    to: element.to,
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
        this.material = new MeshLambertMaterial({ color: this.color })
        this.mesh = new Mesh(this.geometry, this.material)
            this.mesh.position.set(parameters.position.x, parameters.position.y, parameters.position.z)
            this.mesh.name = this.name
        this.label = new Label(this.name, "label vertex")
        this.mesh.add(this.label.object)
        console.debug(`added new vertex named ${this.name}!`)
        console.debug(this.mesh.position)
    }

    get position(): Vector3 {
        return this.mesh.position;
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
        this.color = parameters.color ?? this.source.color // new Color( Math.random() * 0xFFFFFF ) 

        this.path = new LineCurve3(this.source.position, this.target.position)
        this.tube = {
            radius: 0.25,
            tubularSegments: 20,
            radialSegments: 7
        }
        this.lineGeometry = new TubeGeometry(this.path, this.tube.tubularSegments, this.tube.radius, this.tube.radialSegments, false)
        this.material = new MeshLambertMaterial({ color: this.color })
        this.lineMesh = new Mesh(this.lineGeometry, this.material)



        this.label = new Label(this.value)
        this.lineMesh.add(this.label.object)
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
        this.label.object.position.copy(this.path.getPointAt(0.5))
    }

    // see buffer attributes example
    /*newSetCoordinates(from: Vector3, to: Vector3) {
        for (let i = 0; i < this.drawCount; i++) {
            //this.lineGeometry.geometry.attributes.position.array[ index ++ ]
        }
        

    }*/

}
class DirectedEdge extends Edge {
    readonly arrowGeometry: ConeGeometry
    readonly arrowMaterial: MeshStandardMaterial
    readonly arrowMesh: Mesh<ConeGeometry, MeshStandardMaterial>
    private readonly arrowRadius: number
    arrowLength: number

    constructor(parameters: EdgeParameters) {
        super(parameters)
        this.arrowRadius = 1
        this.arrowLength = 3;
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
        this.arrowMaterial = new MeshStandardMaterial({ color: this.color })
        this.arrowMesh = new Mesh(this.arrowGeometry, this.arrowMaterial)
        this.arrowMesh.matrixAutoUpdate = false

        this.path = new QuadraticBezierCurve3(
            this.source.position.clone(),
            // binormal vector converted to world coordinates
            this.source.position.clone().lerp(this.target.position, 0.5).add(binormal),
            this.target.position.clone()
        )
        this.lineGeometry.dispose()
        this.lineGeometry = new TubeGeometry(this.path, this.tube.tubularSegments, this.tube.radius, this.tube.radialSegments, false)
        this.lineMesh.geometry.dispose()
        this.lineMesh = new Mesh(this.lineGeometry, this.material)
        this.lineMesh.attach(this.arrowMesh)
        this.lineMesh.attach(this.label.object)
    }
    // GET POINT TO SHOW UP AND ANGLE ACCURATELY :)
    updateEdgePosition() {
        super.updateEdgePosition()
        // arrow
        //this.arrowMesh.matrix.lookAt( this.target.position, this.source.position, DEFAULT_UP )
        this.arrowMesh.matrix.setPosition(this.target.position)
        this.arrowMesh.matrix.lookAt(
            this.path.getPointAt(0.85),
            this.target.position,
            DEFAULT_UP
        )

        // tube


    }
}
class Label {
    element: HTMLDivElement
    object: CSS2DObject
    // textDiv.className = 'label'
    // textDiv.textContent = 'hello testing'
    constructor(content: string, className?: string) {
        this.element = document.createElement('div')
        this.element.className = className ? className : 'label'
        this.element.textContent = content ? content : 'Empty'
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

/*
    {
        "data": "edge",
        "name": "servant",
        "from": "tristan",
        "to": "cj",
        "directed": true
    },
    */