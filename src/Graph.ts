import { CSS2DObject, CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer"
import { BufferGeometry, Color, ConeGeometry, Line, LineBasicMaterial, Mesh, MeshStandardMaterial, SphereGeometry, Vector3 } from 'three'
// up direction required for the arrow heads in directed edges to point in correct direction
const DEFAULT_UP = new Vector3(0,1,0)

class Graph {
    static numVertices: number
    static numEdges: number
    readonly labelRenderer: CSS2DRenderer
    static readonly edges = new Map<number, Edge>()
    static readonly vertices = new Map<string, Vertex>()

    constructor() {
        Graph.numVertices = 0
        Graph.numEdges = 0

        this.labelRenderer = new CSS2DRenderer()
            this.labelRenderer.setSize( window.innerWidth, window.innerHeight )
            this.labelRenderer.domElement.id = 'labelRenderer'
            document.body.appendChild( this.labelRenderer.domElement )
    }

    static addVertex(parameters: VertexParameters): void {
        Graph.vertices.set(parameters.name, new Vertex(parameters))
        Graph.numVertices++
    }
    static addEdge(parameters: EdgeParameters): void {
        // create
        if ( !Graph.vertices.has(parameters.from)) throw new Error(`Could not find source vertex ${parameters.from}`)
        if ( !Graph.vertices.has(parameters.to)) throw new Error(`Could not find source vertex ${parameters.to}`)
        if ( parameters.directed === true ) {
            Graph.edges.set( Graph.numEdges, new DirectedEdge(parameters, Graph.numEdges) )

        } else {
            Graph.edges.set( Graph.numEdges, new Edge(parameters, Graph.numEdges) )
        }
        // render
        Graph.update(Graph.numEdges)
        Graph.numEdges++
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
    // overloaded function
    static getEdge(from: string, to: string): DirectedEdge
    static getEdge(from: string, to: string): Edge {
        const source = Graph.vertices.get(from)
        if (source === undefined) throw new Error(`Source ${from} does not exist!`)
        const dest = Graph.vertices.get(to)
        if (dest === undefined) throw new Error(`Destination vertex ${to} does not exist!`)
        const _ = [...Graph.edges.values()].find(edge => edge.source === source && edge.destination === dest) ??
            [...Graph.edges.values()].find(edge => edge.source === dest && edge.destination === source)
        if (_ === undefined) throw new Error(`Could not find the edge between ${from} and ${to}!`)
        return _
    }

    // optimize this maybe
    static update(identifier?: number) {
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
                    position: new Vector3(Math.random()*100 - 50, Math.random()*100 - 50, Math.random()*100 - 50)
                }))
                Graph.numVertices++;
            } else if (element.data === "edge") {
                if ( typeof element.to === "undefined" 
                || typeof element.from === "undefined"
                || typeof element.directed === "undefined" ) throw new Error(`Edge ${element.name} had malformed source and/or destination vertices!`)
                Graph.addEdge({
                    name: element.name,
                    from: element.from,
                    to: element.to,
                    directed: element.directed
                })
            } else {
                console.log(element)
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
    readonly material: MeshStandardMaterial
    readonly mesh: Mesh<SphereGeometry, MeshStandardMaterial>
    readonly label: Label

    constructor(parameters: VertexParameters) {
        this.name = parameters.name.toLowerCase()
        this.radius = parameters.radius ?? 5
        this.widthSegments = parameters.widthSegments ?? 16
        this.heightSegments = parameters.heightSegments ?? 8
        this.color = new Color(parameters.color ?? Math.random() * 0xFFFFFF) 
        
        this.geometry = new SphereGeometry( this.radius, this.widthSegments, this.heightSegments )
        this.material = new MeshStandardMaterial( { color: this.color } )
        this.mesh = new Mesh( this.geometry, this.material )
            this.mesh.position.set( parameters.position.x, parameters.position.y, parameters.position.z )
        this.label = new Label( this.name )
            this.mesh.add( this.label.object )
        console.log(`added new vertex named ${this.name}!`)
    }
    
    get position(): Vector3 {
        return this.mesh.position;
    }
}
class Edge {
    readonly id: number
    value: string
    color?: Color
    source: Vertex
    destination: Vertex

    //drawCount: number
    readonly label: Label
    readonly material: LineBasicMaterial
    readonly lineGeometry: BufferGeometry
    readonly lineMesh: Line
    
    constructor(parameters: EdgeParameters, id: number) {
        this.id = id
        this.value = parameters.name
        this.source = Graph.getVertex(parameters.from)
        this.destination = Graph.getVertex(parameters.to)
        this.label = new Label(this.value)
        this.color = parameters.color ? parameters.color : new Color( Math.random() * 0xFFFFFF )
        this.material = new LineBasicMaterial( { color: this.color } )
        this.lineGeometry = new BufferGeometry()
            // this.lineGeometry.name = id.toString()
            // this.lineGeometry.attributes.position.needsUpdate = true
            // this.drawCount = 2
            // this.lineGeometry.setDrawRange( 0, this.drawCount )
        this.lineMesh = new Line( this.lineGeometry, this.material )
        this.label = new Label( this.value )
            this.lineMesh.add( this.label.object )
    }

    updateEdgePosition(from?: string, to?: string) {
        if (from) {
            this.source = Graph.getVertex(from)
        }
        if (to) {
            this.destination = Graph.getVertex(to)
        }
        const points = []
        points.push( this.source.mesh.position )
        points.push( this.destination.mesh.position )
        this.lineGeometry.setFromPoints( points )
        this.label.object.position.lerpVectors( this.source.mesh.position, this.destination.mesh.position, 0.5 )
    }

    // see buffer attributes example
    /*newSetCoordinates(from: Vector3, to: Vector3) {
        for (let i = 0; i < this.drawCount; i++) {
            //this.lineGeometry.geometry.attributes.position.array[ index ++ ]
        }
        

    }*/

}
class DirectedEdge extends Edge {
    arrowGeometry: ConeGeometry
    arrowMaterial: MeshStandardMaterial
    arrowMesh: Mesh<ConeGeometry, MeshStandardMaterial>
    private readonly arrowRadius: number
    arrowLength: number

    constructor(parameters: EdgeParameters, id: number) {
        super(parameters, id)
        this.arrowRadius = 1
        this.arrowLength = 3;
        this.arrowGeometry = new ConeGeometry( this.arrowRadius, this.arrowLength, 7)
            this.arrowGeometry.translate( 0, (-this.arrowLength/2) - this.destination.radius, 0 )
            this.arrowGeometry.rotateX( Math.PI/2 )
        this.arrowMaterial = new MeshStandardMaterial( { color: this.color } )
        this.arrowMesh = new Mesh( this.arrowGeometry, this.arrowMaterial )
            this.arrowMesh.matrixAutoUpdate = false
        this.lineMesh.attach(this.arrowMesh)

        console.log(this)
    }
    // GET POINT TO SHOW UP AND ANGLE ACCURATELY :)
    updateEdgePosition() {
        super.updateEdgePosition()

        this.arrowMesh.matrix.lookAt( this.destination.position, this.source.position, DEFAULT_UP )
        this.arrowMesh.matrix.setPosition( this.destination.position )
    }
}
class Label {
    element: HTMLDivElement
    object: CSS2DObject
    // textDiv.className = 'label'
    // textDiv.textContent = 'hello testing'
    constructor(content: string, className?: string) {
        this.element = document.createElement( 'div' )
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
interface EdgeParameters{
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