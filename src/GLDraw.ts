import { Vector3 } from "./WebGL/math";
import { Geometry } from "./WebGL";
import { piValue } from "./Constants";


//define enum values
/**
 * Enum for cylinder cap styles.
 * @readonly
 * @enum 
 * @property NONE
 * @property FLAT
 * @property ROUND
 */
export enum CAP {
    NONE = 0,
    FLAT = 1,
    ROUND = 2
};

export const phiStart = 0;
export const phiLength = piValue * 2;
export const thetaStart = 0;
export const thetaLength = piValue;

/**
 * Lower level utilities for creating WebGL shape geometries.
 * These are not intended for general consumption.
 * @namespace 
  */
export namespace GLDraw {

    // Rotation matrix around z and x axis - according to y basis vector
    function getRotationMatrix(dx: number, dy: number, dz: number) {
        // Using Math.hypot(dx,dy) instead of Math.sqrt(dx * dx + dy * dy)
        const dxy = Math.hypot(dx, dy);
        const { sin: sinA, cos: cosA } = dxy < 0.0001 ? { sin: 0, cos: 1 } : { sin: -dx / dxy, cos: dy / dxy };

        dy = -sinA * dx + cosA * dy;
        const dyz = Math.hypot(dy, dz);
        const { sin: sinB, cos: cosB } = dyz < 0.0001 ? { sin: 0, cos: 1 } : { sin: dz / dyz, cos: dy / dyz };

        const rot = new Float32Array([cosA, sinA, 0, -sinA * cosB, cosA * cosB, sinB, sinA * sinB, -cosA * sinB, cosB]);

        return rot;
    };


    // memoize capped cylinder for given radius cylVertexCache
    class CylVertexCache {

        // memoize both rounded and flat caps (hemisphere and circle)
        cache: any = {};


        // Ortho normal vectors for cylinder radius/ sphere cap equator and cones
        // Direction is j basis (0,1,0)
        basisVectors: any;

        constructor() {

            //initialize basisVectors
            let nvecs = [];

            const subdivisions = 4; // including the initial 2, eg. 4 => 16 subintervals
            const N = Math.pow(2, subdivisions);  // eg. 2**4 = 16 subintervals in total
            let M = 4; // 4
            let spacing = N / M;  // 16/4 = 4; if there were 5 subdivs, then 32/4 = 8.
            let j: number;

            nvecs[0] = new Vector3(-1, 0, 0);
            nvecs[spacing] = new Vector3(0, 0, 1);
            nvecs[spacing * 2] = new Vector3(1, 0, 0);
            nvecs[spacing * 3] = new Vector3(0, 0, -1);

            for (let i = 3; i <= subdivisions; i++) {
                // eg. i=3, we need to add 2**(3-1) = 4 new vecs. Call it M.
                // their spacing is N/M, eg. N=16, M=4, N/M=4; M=8, N/M=2.
                // they start off at half this spacing
                // and are equal to the average of the two vectors on either side
                M = Math.pow(2, (i - 1));
                spacing = N / M;
                for (j = 0; j < (M - 1); j++) {
                    nvecs[spacing / 2 + j * spacing] = nvecs[j * spacing].clone().add(nvecs[(j + 1) * spacing]).normalize();
                }
                // treat the last one specially so it wraps around to zero
                j = M - 1;
                nvecs[spacing / 2 + j * spacing] = nvecs[j * spacing].clone().add(nvecs[0]).normalize();
            }

            this.basisVectors = nvecs;
        };

        getVerticesForRadius(radius, cap, capType) {
            if (this.cache != null && this.cache[radius] != null && this.cache[radius][cap + capType] != null) {
                return this.cache[radius][cap + capType];
            }

            var w = this.basisVectors.length;
            var nvecs = [], norms = [];
            var n;

            for (let i = 0; i < w; i++) {
                // bottom
                nvecs.push(this.basisVectors[i].multiplyScalar(radius));
                // top
                nvecs.push(this.basisVectors[i].clone().multiplyScalar(radius));

                // NOTE: this normal is used for constructing sphere caps -
                // cylinder normals taken care of in drawCylinder
                n.copy(this.basisVectors[i]).normalize();
                norms.push(n);
                norms.push(n);
            }

            // norms[0]

            var verticesRows = [];

            // Require that heightSegments is even and >= 2
            // Equator points at h/2 (theta = pi/2)
            // (repeated) polar points at 0 and h (theta = 0 and pi)
            var heightSegments = 10, widthSegments = w; // 16 or however many
            // basis vectors for
            // cylinder

            if (heightSegments % 2 !== 0 || !heightSegments) {
                console.warn("heightSegments should be even");
            }

            var x: number, y:number;
            var polar = false, equator = false;

            for (y = 0; y <= heightSegments; y++) {

                polar = (y === 0 || y === heightSegments);
                equator = (y === heightSegments / 2);

                var verticesRow = [], toRow = [];

                for (x = 0; x <= widthSegments; x++) {

                    // Two vertices rows for equator pointing to previously
                    // constructed cyl points
                    if (equator) {
                        var xi = (x < widthSegments) ? 2 * x : 0;
                        toRow.push(xi + 1);
                        verticesRow.push(xi);

                        continue;
                    }

                    var u = x / widthSegments;
                    var v = y / heightSegments;

                    // Only push first polar point

                    if (!polar || x === 0) {

                        if (x < widthSegments) {
                            var vertex = new Vector3();
                            const phiStartLength = phiStart + u * phiLength;
                            vertex.x = -radius *
                                Math.cos(phiStartLength) *
                                Math.sin(thetaStart + v * thetaLength);
                            if (cap == 1)
                                vertex.y = 0;
                            else
                                vertex.y = radius * Math.cos(thetaStart + v * thetaLength);

                            vertex.z = radius *
                                Math.sin(phiStartLength) *
                                Math.sin(thetaStart + v * thetaLength);

                            if (Math.abs(vertex.z) < 1e-5)
                                vertex.z = 0;

                            if (cap == CAP.FLAT) {
                                n = new Vector3(0, Math.cos(thetaStart + v * thetaLength), 0);
                            }
                            else {
                                n = new Vector3(vertex.x, vertex.y, vertex.z);
                            }
                            n.normalize()

                            nvecs.push(vertex);
                            norms.push(n);

                            verticesRow.push(nvecs.length - 1);
                        }

                        // last point is just the first point for this row
                        else {
                            verticesRow.push(nvecs.length - widthSegments);
                        }

                    }

                    // x > 0; index to already added point
                    else if (polar)
                        verticesRow.push(nvecs.length - 1);

                }

                // extra equator row
                if (equator)
                    verticesRows.push(toRow);

                verticesRows.push(verticesRow);

            }

            var obj = {
                vertices: nvecs,
                normals: norms,
                verticesRows: verticesRows,
                w: widthSegments,
                h: heightSegments
            };

            if (!(radius in this.cache)) this.cache[radius] = {};
            this.cache[radius][cap + capType] = obj;

            return obj;

        }
    };

    var cylVertexCache = new CylVertexCache();


    /** 
     * Create a cylinder 
     * @memberof GLDraw 
     * @param {geometry}
     *            geo
     * @param {Point}
     *            from
     * @param {Point}
     *            to
     * @param {float}
     *            radius
     * @param {Color}
     *            color
     * @param {CAP} fromCap - 0 for none, 1 for flat, 2 for round
     * @param {CAP} toCap = 0 for none, 1 for flat, 2 for round
     *            
     * */
    export function drawCylinder(geo: Geometry, from, to, radius: number, color, fromCap:CAP = 0, toCap:CAP = 0) {
        if (!from || !to)
            return;

        // vertices
        var drawcaps = toCap || fromCap;
        color = color || { r: 0, g: 0, b: 0 };

        var e = getRotationMatrix(to.x-from.x, to.y-from.y, to.z-from.z);
        // get orthonormal vectors from cache
        // TODO: Will have orient with model view matrix according to direction

        var vobj = cylVertexCache.getVerticesForRadius(radius, toCap, "to");
        // w (n) corresponds to the number of orthonormal vectors for cylinder
        // (default 16)
        var n = vobj.w, h = vobj.h;

        // get orthonormal vector
        var n_verts = (drawcaps) ? h * n + 2 : 2 * n;

        var geoGroup = geo.updateGeoGroup(n_verts);

        var vertices = vobj.vertices, normals = vobj.normals, verticesRows = vobj.verticesRows;
        var toRow = verticesRows[h / 2], fromRow = verticesRows[h / 2 + 1];

        var start = geoGroup.vertices;
        var offset, faceoffset;
        var i, x, y, z;

        var vertexArray = geoGroup.vertexArray;
        var normalArray = geoGroup.normalArray;
        var colorArray = geoGroup.colorArray;
        var faceArray = geoGroup.faceArray;
        // add vertices, opposing vertices paired together
        for (i = 0; i < n; ++i) {

            let vi = 2 * i;

            x = e[0] * vertices[vi].x + e[3] * vertices[vi].y + e[6] * vertices[vi].z;
            y = e[1] * vertices[vi].x + e[4] * vertices[vi].y + e[7] * vertices[vi].z;
            z = e[5] * vertices[vi].y + e[8] * vertices[vi].z;

            offset = 3 * (start + vi);
            faceoffset = geoGroup.faceidx;

            // From & To
            vertexArray.set([x + from.x, y + from.y, z + from.z, x + to.x, y + to.y, z + to.z], offset)

            // Normals
            normalArray.set([x,y,z,x,y,z], offset)

            // Colors
            colorArray.set([color.r, color.g, color.b, color.r, color.g, color.b], offset);

            // Faces: 0 - 2 - 1, 1 - 2 - 3
            faceArray.set([fromRow[i] + start, fromRow[i + 1] + start, toRow[i] + start, toRow[i] + start, fromRow[i + 1] + start, toRow[i + 1] + start], faceoffset)

            geoGroup.faceidx += 6;

        }

        // SPHERE CAPS
        if (drawcaps) {
            // h - sphere rows, verticesRows.length - 2

            const ystart = (toCap) ? 0 : h / 2;
            const yend = (fromCap) ? h + 1 : h / 2 + 1;
            let v1, v2, v3, v4, x1, x2, x3, x4, y1, y2, y3, y4, z1, z2, z3, z4, nx1, nx2, nx3, nx4, ny1, ny2, ny3, ny4, nz1, nz2, nz3, nz4, v1offset, v2offset, v3offset, v4offset;

            for (y = ystart; y < yend; y++) {
                if (y === h / 2)
                    continue;
                // n number of points for each level (verticesRows[i].length -
                // 1)
                const cap = (y <= h / 2) ? to : from;
                const toObj = cylVertexCache.getVerticesForRadius(radius, toCap, "to");
                const fromObj = cylVertexCache.getVerticesForRadius(radius, fromCap, "from");
                if (cap === to) {
                    vertices = toObj.vertices;
                    normals = toObj.normals;
                    verticesRows = toObj.verticesRows;
                } else if (cap == from) {
                    vertices = fromObj.vertices;
                    normals = fromObj.normals;
                    verticesRows = fromObj.verticesRows;
                }
                for (x = 0; x < n; x++) {

                    faceoffset = geoGroup.faceidx;

                    v1 = verticesRows[y][x + 1];
                    v1offset = (v1 + start) * 3;
                    v2 = verticesRows[y][x];
                    v2offset = (v2 + start) * 3;
                    v3 = verticesRows[y + 1][x];
                    v3offset = (v3 + start) * 3;
                    v4 = verticesRows[y + 1][x + 1];
                    v4offset = (v4 + start) * 3;

                    // rotate sphere vectors
                    x1 = e[0] * vertices[v1].x + e[3] * vertices[v1].y + e[6] * vertices[v1].z;
                    x2 = e[0] * vertices[v2].x + e[3] * vertices[v2].y + e[6] * vertices[v2].z;
                    x3 = e[0] * vertices[v3].x + e[3] * vertices[v3].y + e[6] * vertices[v3].z;
                    x4 = e[0] * vertices[v4].x + e[3] * vertices[v4].y + e[6] * vertices[v4].z;

                    y1 = e[1] * vertices[v1].x + e[4] * vertices[v1].y + e[7] * vertices[v1].z;
                    y2 = e[1] * vertices[v2].x + e[4] * vertices[v2].y + e[7] * vertices[v2].z;
                    y3 = e[1] * vertices[v3].x + e[4] * vertices[v3].y + e[7] * vertices[v3].z;
                    y4 = e[1] * vertices[v4].x + e[4] * vertices[v4].y + e[7] * vertices[v4].z;

                    z1 = e[5] * vertices[v1].y + e[8] * vertices[v1].z;
                    z2 = e[5] * vertices[v2].y + e[8] * vertices[v2].z;
                    z3 = e[5] * vertices[v3].y + e[8] * vertices[v3].z;
                    z4 = e[5] * vertices[v4].y + e[8] * vertices[v4].z;

                    vertexArray.set([(x1 + cap.x), (y1 + cap.y), (z1 + cap.z)], v1offset);

                    vertexArray.set([(x2 + cap.x), (y2 + cap.y), (z2 + cap.z)], v2offset);

                    vertexArray.set([(x3 + cap.x), (y3 + cap.y), (z3 + cap.z)], v3offset);

                    vertexArray.set([(x4 + cap.x), (y4 + cap.y), (z4 + cap.z)], v4offset);

                    colorArray.set([color.r, color.g, color.b], v1offset);

                    colorArray.set([color.r, color.g, color.b], v2offset);

                    colorArray.set([color.r, color.g, color.b], v3offset);

                    colorArray.set([color.r, color.g, color.b], v4offset);

                    nx1 = e[0] * normals[v1].x + e[3] * normals[v1].y + e[6] * normals[v1].z;
                    nx2 = e[0] * normals[v2].x + e[3] * normals[v2].y + e[6] * normals[v2].z;
                    nx3 = e[0] * normals[v3].x + e[3] * normals[v3].y + e[6] * normals[v3].z;
                    nx4 = e[0] * normals[v4].x + e[3] * normals[v4].y + e[6] * normals[v4].z;

                    ny1 = e[1] * normals[v1].x + e[4] * normals[v1].y + e[7] * normals[v1].z;
                    ny2 = e[1] * normals[v2].x + e[4] * normals[v2].y + e[7] * normals[v2].z;
                    ny3 = e[1] * normals[v3].x + e[4] * normals[v3].y + e[7] * normals[v3].z;
                    ny4 = e[1] * normals[v4].x + e[4] * normals[v4].y + e[7] * normals[v4].z;

                    nz1 = e[5] * normals[v1].y + e[8] * normals[v1].z;
                    nz2 = e[5] * normals[v2].y + e[8] * normals[v2].z;
                    nz3 = e[5] * normals[v3].y + e[8] * normals[v3].z;
                    nz4 = e[5] * normals[v4].y + e[8] * normals[v4].z;

                    // if (Math.abs(vobj.sphereVertices[v1].y) === radius) {

                    if (y === 0) {//to center circle
                        // face = [v1, v3, v4];
                        // norm = [n1, n3, n4];

                        normalArray.set([nx1, ny1, nz1], v1offset);

                        normalArray.set([nx3, ny3, nz3], v3offset);

                        normalArray.set([nx4, ny4, nz4], v4offset);

                        faceArray.set([v1 + start, v3 + start, v4 + start], faceoffset);

                        geoGroup.faceidx += 3;

                    }

                    // else if (Math.abs(vobj.sphereVertices[v3].y) === radius)
                    // {
                    else if (y === yend - 1) {//from end center circle
                        // face = [v1, v2, v3];
                        // norm = [n1, n2, n3];

                        normalArray.set([nx1, ny1, nz1], v1offset);

                        normalArray.set([nx2, ny2, nz2], v2offset);

                        normalArray.set([nx3, ny3, nz3], v3offset);
                        
                        faceArray.set([v1 + start, v2 + start, v3 + start], faceoffset);

                        geoGroup.faceidx += 3;

                    }

                    else { // the rest of the circles
                        // face = [v1, v2, v3, v4];
                        // norm = [n1, n2, n3, n4];

                        normalArray.set([nx1, ny1, nz1], v1offset);

                        normalArray.set([nx2, ny2, nz2], v2offset);

                        normalArray.set([nx4, ny4, nz4], v4offset);

                        normalArray.set([nx2, ny2, nz2], v2offset);

                        normalArray.set([nx3, ny3, nz3], v3offset);

                        normalArray.set([nx4, ny4, nz4], v4offset);

                        faceArray.set([v1 + start, v2 + start, v4 + start, v2 + start, v3 + start, v4 + start], faceoffset);

                        geoGroup.faceidx += 6;
                    }

                }
            }

        }

        geoGroup.vertices += n_verts;
    };


    /** Create a cone 
     * @memberof GLDraw
     * @param {geometry}
     *            geo
     * @param {Point}
     *            from
     * @param {Point}
     *            to
     * @param {float}
     *            radius
     * @param {Color}
     *            color
     *            */
    export function drawCone (geo: Geometry, from, to, radius: number, color?) {
        if (!from || !to)
            return;

        //TODO: check if from and to do not contain x,y,z and if  so generate a center based on the passed selections

        color = color || { r: 0, g: 0, b: 0 };

        let ndir = new Vector3(to.x-from.x, to.y-from.y, to.z-from.z);
        var e = getRotationMatrix(ndir.x, ndir.y, ndir.z);
        ndir = ndir.normalize();

        // n vertices around bottom plust the two points
        var n = cylVertexCache.basisVectors.length;
        var basis = cylVertexCache.basisVectors;
        var n_verts = n + 2;

        //setup geo structures
        var geoGroup = geo.updateGeoGroup(n_verts);
        var start = geoGroup.vertices;
        var offset, faceoffset;
        var i, x, y, z;
        var vertexArray = geoGroup.vertexArray;
        var normalArray = geoGroup.normalArray;
        var colorArray = geoGroup.colorArray;
        var faceArray = geoGroup.faceArray;

        offset = start * 3;

        // From & To
        vertexArray.set([from.x, from.y, from.z, to.z, to.y, to.z], offset);

        // Normals
        normalArray.set([-ndir.x, -ndir.y, -ndir.z, ndir.x, ndir.y, ndir.z], offset);

        //Colors
        colorArray.set([color.r, color.g, color.b, color.r, color.g, color.b], offset);

        offset += 6;

        // add circle vertices
        for (i = 0; i < n; ++i) {
            var vec = basis[i].clone();
            vec.multiplyScalar(radius);
            x = e[0] * vec.x + e[3] * vec.y + e[6] * vec.z;
            y = e[1] * vec.x + e[4] * vec.y + e[7] * vec.z;
            z = e[5] * vec.y + e[8] * vec.z;

            // From
            vertexArray.set([x + from.x, y + from.y, z + from.z], offset);

            // Normals
            normalArray.set([x, y, z], offset);

            // Colors
            colorArray.set([color.r, color.g, color.b], offset);

            offset += 3;

        }
        geoGroup.vertices += (n + 2);
        //faces
        faceoffset = geoGroup.faceidx;
        for (i = 0; i < n; i++) {
            //two neighboring circle vertices
            var v1 = start + 2 + i;
            var v2 = start + 2 + ((i + 1) % n);

            faceArray.set([v1, v2, start], faceoffset)
            faceoffset += 3;

            faceArray.set([v1, v2, start + 1], faceoffset)
            faceoffset += 3;
        }
        geoGroup.faceidx += 6 * n;
    };


    // Sphere component sphereVertexCache
    class  SphereVertexCache {
        private cache = new Map<number, Map<number, any>>(); //sphereQuality then radius
        constructor() {}

        getVerticesForRadius(radius, sphereQuality) {
            sphereQuality = sphereQuality || 2;

            if (!this.cache.has(sphereQuality))  {
                this.cache.set(sphereQuality, new Map<number,any>());
            }
            let radiusCache = this.cache.get(sphereQuality);
            if (radiusCache.has(radius))
                return radiusCache.get(radius);

            var obj = {
                vertices: [],
                verticesRows: [],
                normals: []
            };
            // scale quality with radius heuristically
            var widthSegments = 16 * sphereQuality;
            var heightSegments = 10 * sphereQuality;
            if (radius < 1) {
                widthSegments = 10 * sphereQuality;
                heightSegments = 8 * sphereQuality;
            }

            let x, y;

            for (y = 0; y <= heightSegments; y++) {

                let verticesRow = [];
                for (x = 0; x <= widthSegments; x++) {

                    let u = x / widthSegments;
                    let v = y / heightSegments;
                    const phiStartLength = phiStart + u * phiLength;
                    let vx = -radius * Math.cos(phiStartLength) *
                        Math.sin(thetaStart + v * thetaLength);
                    let vy = radius * Math.cos(thetaStart + v * thetaLength);
                    let vz = radius * Math.sin(phiStartLength) *
                        Math.sin(thetaStart + v * thetaLength);

                    var n = new Vector3(vx, vy, vz);
                    n.normalize();

                    obj.vertices.push({x: vx, y: vy, z: vz});
                    obj.normals.push(n);

                    verticesRow.push(obj.vertices.length - 1);

                }

                obj.verticesRows.push(verticesRow);

            }

            radiusCache.set(radius, obj);
            return obj;
        }

    };
    var sphereVertexCache = new SphereVertexCache();

    /** Create a sphere.
     * @memberof GLDraw
     * @param {geometry}
     *            geo
     * @param {Point}
     *            pos
     * @param {float}
     *            radius
     * @param {Color}
     *            color
     * @param {number} quality of sphere (default 2, higher increases number of triangles)
     */
    export function drawSphere(geo:Geometry, pos, radius, color, sphereQuality?) {

        var vobj = sphereVertexCache.getVerticesForRadius(radius, sphereQuality);

        var vertices = vobj.vertices;
        var normals = vobj.normals;

        var geoGroup = geo.updateGeoGroup(vertices.length);

        var start = geoGroup.vertices;
        var vertexArray = geoGroup.vertexArray;
        var colorArray = geoGroup.colorArray;
        var faceArray = geoGroup.faceArray;
        var lineArray = geoGroup.lineArray;
        var normalArray = geoGroup.normalArray;

        for (let i = 0, il = vertices.length; i < il; ++i) {
            let offset = 3 * (start + i);
            let v = vertices[i];

            vertexArray.set([(v.x + pos.x), (v.y + pos.y), (v.z + pos.z)], offset);

            colorArray.set([color.r, color.g, color.b], offset);

        }

        geoGroup.vertices += vertices.length;

        let verticesRows = vobj.verticesRows;
        let h = verticesRows.length - 1;

        for (let y = 0; y < h; y++) {
            let w = verticesRows[y].length - 1;
            for (let x = 0; x < w; x++) {

                let faceoffset = geoGroup.faceidx, lineoffset = geoGroup.lineidx;

                let v1 = verticesRows[y][x + 1] + start, v1offset = v1 * 3;
                let v2 = verticesRows[y][x] + start, v2offset = v2 * 3;
                let v3 = verticesRows[y + 1][x] + start, v3offset = v3 * 3;
                let v4 = verticesRows[y + 1][x + 1] + start, v4offset = v4 * 3;

                let n1 = normals[v1 - start];
                let n2 = normals[v2 - start];
                let n3 = normals[v3 - start];
                let n4 = normals[v4 - start];

                if (Math.abs(vertices[v1 - start].y) === radius) {
                    // face = [v1, v3, v4];
                    // norm = [n1, n3, n4];

                    normalArray.set([n1.x, n1.y, n1.z], v1offset);

                    normalArray.set([n3.x, n3.y, n3.z], v3offset);

                    normalArray.set([n4.x, n4.y, n4.z], v4offset);

                    faceArray.set([v1, v3, v4], faceoffset);

                    lineArray.set([v1, v3, v1, v4, v3, v4], lineoffset);

                    geoGroup.faceidx += 3;
                    geoGroup.lineidx += 6;

                } else if (Math.abs(vertices[v3 - start].y) === radius) {
                    // face = [v1, v2, v3];
                    // norm = [n1, n2, n3];

                    normalArray.set([n1.x, n1.y, n1.z], v1offset);

                    normalArray.set([n2.x, n2.y, n2.z], v2offset);

                    normalArray.set([n3.x, n3.y, n3.z], v3offset);

                    faceArray.set([v1, v2, v3], faceoffset);

                    lineArray.set([v1, v2, v1, v3, v2, v1], lineoffset);

                    geoGroup.faceidx += 3;
                    geoGroup.lineidx += 6;

                } else {
                    // face = [v1, v2, v3, v4];
                    // norm = [n1, n2, n3, n4];

                    normalArray.set([n1.x, n1.y, n1.z], v1offset);

                    normalArray.set([n2.x, n2.y, n2.z], v2offset);

                    normalArray.set([n4.x, n4.y, n4.z], v4offset);

                    normalArray[v2offset] = n2.x;
                    normalArray[v3offset] = n3.x;
                    normalArray[v4offset] = n4.x;
                    normalArray[v2offset + 1] = n2.y;
                    normalArray[v3offset + 1] = n3.y;
                    normalArray[v4offset + 1] = n4.y;
                    normalArray[v2offset + 2] = n2.z;
                    normalArray[v3offset + 2] = n3.z;
                    normalArray[v4offset + 2] = n4.z;

                    faceArray.set([v1, v2, v4, v2, v3, v4], faceoffset);

                    lineArray.set([v1, v2, v1, v4, v2, v3, v3, v4], lineoffset);

                    geoGroup.faceidx += 6;
                    geoGroup.lineidx += 8;

                }

            }
        }

    };

}
