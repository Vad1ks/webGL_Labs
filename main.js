'use strict';

let gl;                         // The webgl context.
let surface;                    // A surface model
let shProgram;                  // A shader program
let spaceball;                  // A SimpleRotator object that lets the user rotate the view by mouse.
let surfaceType;

function deg2rad(angle) {
    return angle * Math.PI / 180;
}


// Constructor
function Model(name) {
    this.name = name;
    this.iVertexBuffer = gl.createBuffer();
    this.iNormalBuffer = gl.createBuffer();
    this.count = 0;

    this.BufferData = function(vertices, normals) {

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STREAM_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STREAM_DRAW);
        this.count = vertices.length/3;
    }

    this.Draw = function() {

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);
        
        gl.vertexAttribPointer(shProgram.iNormal, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iNormal); 
        if (surfaceType.checked) {
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.count);
          } else {
            let pointsLength = 1
            const stepLength = this.count / pointsLength;
            for (let step = 0; step < this.count; step += stepLength) {
              gl.drawArrays(gl.LINE_STRIP, step, stepLength);
            }
        }
    }
}


// Constructor
function ShaderProgram(name, program) {

    this.name = name;
    this.prog = program;

    // Location of the attribute variable in the shader program.
    this.iAttribVertex = -1;
    // Location of the uniform specifying a color for the primitive.
    this.iColor = -1;
    // Location of the uniform matrix representing the combined transformation.
    this.iModelViewProjectionMatrix = -1;

    // Normals
    this.iNormal = -1;
    this.iNormalMatrix = -1;
    this.Use = function() {
        gl.useProgram(this.prog);
    }
}


/* Draws a colored cube, along with a set of coordinate axes.
 * (Note that the use of the above drawPrimitive function is not an efficient
 * way to draw with WebGL.  Here, the geometry is so simple that it doesn't matter.)
 */
function draw() { 
    gl.clearColor(0,0,0,1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    /* Set the values of the projection transformation */
    let projection = m4.perspective(Math.PI/8, 1, 8, 12); 
    
    /* Get the view matrix from the SimpleRotator object.*/
    let modelView = spaceball.getViewMatrix();

    let rotateToPointZero = m4.axisRotation([0.707,0.707,0], 0.7);
    let translateToPointZero = m4.translation(0,0,-10);

    let matAccum0 = m4.multiply(rotateToPointZero, modelView );
    let matAccum1 = m4.multiply(translateToPointZero, matAccum0 );

    const modelviewInv = m4.inverse(matAccum1, new Float32Array(16));
    const normalMatrix = m4.transpose(modelviewInv, new Float32Array(16));  
        
    /* Multiply the projection matrix times the modelview matrix to give the
       combined transformation matrix, and send that to the shader program. */
    let modelViewProjection = m4.multiply(projection, matAccum1 );

    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, modelViewProjection );

    gl.uniformMatrix4fv(shProgram.iNormalMatrix, false, normalMatrix);
    
    /* Draw the six faces of a cube, with different colors. */
    gl.uniform4fv(shProgram.iColor, [1,1,0,1] );

    surface.Draw();
}

function rerender() {
    let surfaceData = CreateSurfaceData()
    surface.BufferData(surfaceData[0],surfaceData[1]);
    draw();
  }

function getX (u, v, alpha, phi, theta, c){
    return c * u + v * (Math.sin(phi) + Math.tan(alpha) * Math.cos(phi) * Math.cos(theta));
}

function getY (v, alpha, theta){
    return v * Math.tan(alpha) * Math.sin(theta);
}

function getZ(v, alpha, phi, theta, H){
    return H + v * (Math.tan(alpha) * Math.sin(phi) * Math.cos(theta) - Math.cos(phi));
}

function getDerivativeU(u,v,alpha,phi,c,p,theta0){
    let dx_du = c - p*v * Math.tan(alpha) * Math.cos(phi) * Math.sin(p*u+theta0);
    let dy_du = p * v * Math.tan(alpha) * Math.cos(p*u+theta0);
    let dz_du = -p * v * Math.tan(alpha) * Math.sin(phi) * Math.sin(p*u+theta0);
    return [dx_du,dy_du,dz_du];
}

function getDerivativeV(u,alpha,phi,p,theta0,){
    let dx_dv = Math.tan(alpha) * Math.cos(phi) * Math.cos(p*u+theta0) + Math.sin(phi);
    let dy_dv = Math.tan(alpha) * Math.sin(p*u+theta0);
    let dz_dv = Math.tan(alpha) * Math.sin(phi) * Math.cos(p*u+theta0) - Math.cos(phi);
    return [dx_dv,dy_dv,dz_dv];
}

function CreateSurfaceData()
{
    let vertexList = [];
    let normalsList = [];

    const H = 1;
    const c = 5;
    const p = 8 * Math.PI
    const alpha = 0.033 * Math.PI;
    const theta0 = 0;
    const phi = 0 * Math.PI;

    let step = surfaceType.checked? 0.05 : 0;
    let uStep = 0.005;
    for (let u = 0; u < 1; u += uStep) {
        for (let v = -5; v < 5; v += 0.01) {
            let theta = p * u + theta0;
            let x = getX(u,v,alpha,phi,theta,c);
            let y = getY(v,alpha,theta);
            let z = getZ(v,alpha,p,theta,H);
            let derU = getDerivativeU(u,v,x,y,z,alpha,phi,c,p,theta0);
            let derV = getDerivativeV(u,v,x,y,z,alpha,phi,p,theta0);
            let res = m4.cross(derU,derV);

            vertexList.push(x * 0.35 , y * 0.35, z * 0.35);
            normalsList.push(res[0], res[1], res[2]);

            theta = p * u+step + theta0;
            x = getX(u+step,v,alpha,phi,theta,c);
            y = getY(v,alpha,theta);
            z = getZ(v,alpha,p,theta,H);
            derU = getDerivativeU(u,v,x,y,z,alpha,phi,c,p,theta0);
            derV = getDerivativeV(u,v,x,y,z,alpha,phi,p,theta0);
            res = m4.cross(derU,derV);

            vertexList.push(x * 0.35 , y * 0.35, z * 0.35);
            normalsList.push(res[0], res[1], res[2]);
      }
    }
    return [vertexList, normalsList];
}

/* Initialize the WebGL context. Called from init() */
function initGL() {
    let prog = createProgram( gl, vertexShaderSource, fragmentShaderSource );

    shProgram = new ShaderProgram('Basic', prog);
    shProgram.Use();

    shProgram.iAttribVertex              = gl.getAttribLocation(prog, "vertex");
    shProgram.iModelViewProjectionMatrix = gl.getUniformLocation(prog, "ModelViewProjectionMatrix");
    shProgram.iColor                     = gl.getUniformLocation(prog, "color");

    shProgram.iNormal                    = gl.getAttribLocation(prog, 'normal');
    shProgram.iNormalMatrix              = gl.getUniformLocation(prog, 'normalMat');

    surface = new Model('Surface');
    let surfaceData = CreateSurfaceData()
    surface.BufferData(surfaceData[0],surfaceData[1]);
    gl.enable(gl.DEPTH_TEST);
}


/* Creates a program for use in the WebGL context gl, and returns the
 * identifier for that program.  If an error occurs while compiling or
 * linking the program, an exception of type Error is thrown.  The error
 * string contains the compilation or linking error.  If no error occurs,
 * the program identifier is the return value of the function.
 * The second and third parameters are strings that contain the
 * source code for the vertex shader and for the fragment shader.
 */
function createProgram(gl, vShader, fShader) {
    let vsh = gl.createShader( gl.VERTEX_SHADER );
    gl.shaderSource(vsh,vShader);
    gl.compileShader(vsh);
    if ( ! gl.getShaderParameter(vsh, gl.COMPILE_STATUS) ) {
        throw new Error("Error in vertex shader:  " + gl.getShaderInfoLog(vsh));
     }
    let fsh = gl.createShader( gl.FRAGMENT_SHADER );
    gl.shaderSource(fsh, fShader);
    gl.compileShader(fsh);
    if ( ! gl.getShaderParameter(fsh, gl.COMPILE_STATUS) ) {
       throw new Error("Error in fragment shader:  " + gl.getShaderInfoLog(fsh));
    }
    let prog = gl.createProgram();
    gl.attachShader(prog,vsh);
    gl.attachShader(prog, fsh);
    gl.linkProgram(prog);
    if ( ! gl.getProgramParameter( prog, gl.LINK_STATUS) ) {
       throw new Error("Link error in program:  " + gl.getProgramInfoLog(prog));
    }
    return prog;
}


/**
 * initialization function that will be called when the page has loaded
 */
function init() {
    surfaceType = document.getElementById('SurfaceType');
    let canvas;
    
    try {
        canvas = document.getElementById("webglcanvas");
        gl = canvas.getContext("webgl");
        if ( ! gl ) {
            throw "Browser does not support WebGL";
        }
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not get a WebGL graphics context.</p>";
        return;
    }
    try {
        initGL();  // initialize the WebGL graphics context
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not initialize the WebGL graphics context: " + e + "</p>";
        return;
    }

    spaceball = new TrackballRotator(canvas, draw, 0);

    draw();
}
